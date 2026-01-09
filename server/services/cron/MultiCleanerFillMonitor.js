/**
 * Multi-Cleaner Fill Monitor Job
 *
 * Monitors unfilled multi-cleaner jobs and sends notifications:
 * - 7 days before: Urgent fill notifications to nearby cleaners
 * - 3 days before: Final warning to homeowner with options
 */

const { Op } = require("sequelize");
const {
  MultiCleanerJob,
  UserAppointments,
  UserHomes,
  User,
  CleanerJobCompletion,
  CleanerJobOffer,
} = require("../../models");
const NotificationService = require("../NotificationService");
const MultiCleanerService = require("../MultiCleanerService");
const MultiCleanerPricingService = require("../MultiCleanerPricingService");
const { getPricingConfig } = require("../../config/businessConfig");
const EncryptionService = require("../EncryptionService");
const Email = require("../sendNotifications/EmailClass");
const PushNotification = require("../sendNotifications/PushNotificationClass");

/**
 * Process jobs that need urgent fill notifications (7 days out)
 * Sends notifications every 6 hours until the job is filled
 * @param {Object} io - Socket.io instance
 * @returns {Promise<number>} Number of jobs processed
 */
async function processUrgentFillNotifications(io = null) {
  const config = await getPricingConfig();
  const urgentDays = config?.multiCleaner?.urgentFillDays || 7;
  const urgentIntervalHours = config?.multiCleaner?.urgentNotificationIntervalHours || 6;

  const urgentDate = new Date();
  urgentDate.setDate(urgentDate.getDate() + urgentDays);
  const urgentDateStr = urgentDate.toISOString().split("T")[0];

  // Time threshold for resending notifications (6 hours ago)
  const resendThreshold = new Date();
  resendThreshold.setHours(resendThreshold.getHours() - urgentIntervalHours);

  // Find jobs that need urgent notifications:
  // - Status is open or partially_filled
  // - Appointment date is within 7 days
  // - Either never notified OR last notified more than 6 hours ago
  const jobs = await MultiCleanerJob.findAll({
    where: {
      status: { [Op.in]: ["open", "partially_filled"] },
      [Op.or]: [
        { urgentNotificationSentAt: null },
        { urgentNotificationSentAt: { [Op.lte]: resendThreshold } },
      ],
    },
    include: [
      {
        model: UserAppointments,
        as: "appointment",
        where: {
          date: { [Op.lte]: urgentDateStr },
        },
        include: [{ model: UserHomes, as: "home" }],
      },
    ],
  });

  let processed = 0;

  for (const job of jobs) {
    try {
      const { appointment } = job;
      const slotsRemaining = job.getRemainingSlots();

      // Skip if no slots remaining (shouldn't happen but safety check)
      if (slotsRemaining <= 0) continue;

      // Calculate earnings for the offer
      const totalPrice = await MultiCleanerPricingService.calculateTotalJobPrice(
        appointment.home,
        appointment,
        job.totalCleanersRequired
      );
      const earningsBreakdown = await MultiCleanerPricingService.calculatePerCleanerEarnings(
        totalPrice,
        job.totalCleanersRequired
      );
      const perCleanerEarnings = earningsBreakdown.cleanerEarnings[0]?.netAmount || 0;

      // Calculate days until appointment for urgency messaging
      const appointmentDate = new Date(appointment.date);
      const today = new Date();
      const daysUntil = Math.ceil((appointmentDate - today) / (1000 * 60 * 60 * 24));

      // Find nearby cleaners to notify
      // For now, notify all cleaners - in production, filter by location
      const cleaners = await User.findAll({
        where: {
          type: "cleaner",
          accountFrozen: false,
        },
        attributes: ["id", "firstName", "expoPushToken"],
        limit: 50,
      });

      // Get already assigned cleaner IDs
      const assignedCleanerIds = await CleanerJobCompletion.findAll({
        where: { multiCleanerJobId: job.id },
        attributes: ["cleanerId"],
      }).then((completions) => completions.map((c) => c.cleanerId));

      // Build urgent message based on days remaining
      let urgencyPrefix = "";
      if (daysUntil <= 1) {
        urgencyPrefix = "🚨 URGENT: ";
      } else if (daysUntil <= 3) {
        urgencyPrefix = "⚠️ ";
      }

      // Notify eligible cleaners
      let notifiedCount = 0;
      for (const cleaner of cleaners) {
        if (assignedCleanerIds.includes(cleaner.id)) continue;

        await NotificationService.createNotification({
          userId: cleaner.id,
          type: "multi_cleaner_urgent",
          title: `${urgencyPrefix}Multi-cleaner job needs you!`,
          body: `$${(perCleanerEarnings / 100).toFixed(2)} for ${slotsRemaining > 1 ? "one of " : ""}${slotsRemaining} open slot(s) - ${daysUntil} day${daysUntil !== 1 ? "s" : ""} away`,
          data: {
            appointmentId: appointment.id,
            multiCleanerJobId: job.id,
            earningsOffered: perCleanerEarnings,
            daysUntilAppointment: daysUntil,
          },
          actionRequired: true,
          expiresAt: new Date(Date.now() + urgentIntervalHours * 60 * 60 * 1000), // Expires at next notification cycle
        });
        notifiedCount++;
      }

      // Update last notification time
      await job.update({ urgentNotificationSentAt: new Date() });
      processed++;

      const isResend = job.urgentNotificationSentAt !== null;
      console.log(
        `[MultiCleanerFillMonitor] ${isResend ? "Resent" : "Sent"} urgent fill notifications for job ${job.id} to ${notifiedCount} cleaners (${daysUntil} days until appointment)`
      );
    } catch (error) {
      console.error(
        `[MultiCleanerFillMonitor] Error processing urgent fill for job ${job.id}:`,
        error
      );
    }
  }

  return processed;
}

/**
 * Process jobs that need homeowner final warning (3 days out)
 * @param {Object} io - Socket.io instance
 * @returns {Promise<number>} Number of jobs processed
 */
async function processFinalWarnings(io = null) {
  const config = await getPricingConfig();
  const finalDays = config?.multiCleaner?.finalWarningDays || 3;

  const warningDate = new Date();
  warningDate.setDate(warningDate.getDate() + finalDays);
  const warningDateStr = warningDate.toISOString().split("T")[0];

  const jobs = await MultiCleanerJob.findAll({
    where: {
      status: { [Op.in]: ["open", "partially_filled"] },
      finalWarningAt: null,
    },
    include: [
      {
        model: UserAppointments,
        as: "appointment",
        where: {
          date: { [Op.lte]: warningDateStr },
        },
        include: [
          { model: UserHomes, as: "home" },
          { model: User, as: "user" },
        ],
      },
    ],
  });

  let processed = 0;

  for (const job of jobs) {
    try {
      const { appointment } = job;
      const slotsRemaining = job.getRemainingSlots();
      const cleanersConfirmed = job.cleanersConfirmed;

      let message;
      if (cleanersConfirmed === 0) {
        message = `Your ${appointment.date} appointment still needs ${slotsRemaining} cleaner(s). You can proceed with fewer cleaners, reschedule, or cancel without penalty.`;
      } else {
        message = `Your ${appointment.date} appointment has ${cleanersConfirmed} cleaner(s) assigned but still needs ${slotsRemaining} more. You can proceed with fewer cleaners or take other action.`;
      }

      // Notify homeowner
      await NotificationService.createNotification({
        userId: appointment.userId,
        type: "multi_cleaner_final_warning",
        title: "Action needed for your cleaning",
        body: message,
        data: {
          appointmentId: appointment.id,
          multiCleanerJobId: job.id,
          cleanersNeeded: job.totalCleanersRequired,
          cleanersConfirmed: cleanersConfirmed,
          slotsRemaining: slotsRemaining,
          options: ["proceed_with_one", "cancel", "reschedule"],
        },
        actionRequired: true,
      });

      // Mark as sent
      await job.update({ finalWarningAt: new Date() });
      processed++;

      console.log(
        `[MultiCleanerFillMonitor] Sent final warning for job ${job.id} to homeowner ${appointment.userId}`
      );
    } catch (error) {
      console.error(
        `[MultiCleanerFillMonitor] Error processing final warning for job ${job.id}:`,
        error
      );
    }
  }

  return processed;
}

/**
 * Process jobs that have some cleaners but still have unfilled slots
 * Offer solo completion to remaining cleaners (1 day out)
 * @param {Object} io - Socket.io instance
 * @returns {Promise<number>} Number processed
 */
async function processSoloCompletionOffers(io = null) {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = tomorrow.toISOString().split("T")[0];

  const jobs = await MultiCleanerJob.findAll({
    where: {
      status: "partially_filled",
      cleanersConfirmed: 1, // Exactly 1 cleaner
    },
    include: [
      {
        model: UserAppointments,
        as: "appointment",
        where: {
          date: { [Op.lte]: tomorrowStr },
        },
      },
      {
        model: CleanerJobCompletion,
        as: "completions",
        where: {
          status: { [Op.notIn]: ["dropped_out", "no_show"] },
        },
      },
    ],
  });

  let processed = 0;

  for (const job of jobs) {
    try {
      const remainingCleaner = job.completions[0];
      if (!remainingCleaner) continue;

      await MultiCleanerService.offerSoloCompletion(job.id, remainingCleaner.cleanerId);
      processed++;

      console.log(
        `[MultiCleanerFillMonitor] Offered solo completion for job ${job.id} to cleaner ${remainingCleaner.cleanerId}`
      );
    } catch (error) {
      console.error(
        `[MultiCleanerFillMonitor] Error processing solo completion for job ${job.id}:`,
        error
      );
    }
  }

  return processed;
}

/**
 * Process edge case homes that need homeowner decision
 * For edge case homes (3/2, 2/3, 3/3) with exactly 1 cleaner confirmed at 3 days out,
 * send notification asking homeowner to proceed or cancel
 * @param {Object} io - Socket.io instance
 * @returns {Promise<number>} Number of jobs processed
 */
async function processEdgeCaseDecisions(io = null) {
  const config = await getPricingConfig();
  const decisionDays = config?.multiCleaner?.edgeCaseDecisionDays || 3;
  const decisionHours = config?.multiCleaner?.edgeCaseDecisionHours || 24;

  const decisionDate = new Date();
  decisionDate.setDate(decisionDate.getDate() + decisionDays);
  const decisionDateStr = decisionDate.toISOString().split("T")[0];

  // Find edge case jobs that need decision notifications:
  // - Status is partially_filled
  // - Exactly 1 cleaner confirmed
  // - Appointment date is within 3 days
  // - Edge case decision not already sent
  // - totalCleanersRequired is 2 (edge case homes require 2 cleaners)
  const jobs = await MultiCleanerJob.findAll({
    where: {
      status: "partially_filled",
      cleanersConfirmed: 1,
      totalCleanersRequired: 2,
      edgeCaseDecisionRequired: false,
    },
    include: [
      {
        model: UserAppointments,
        as: "appointment",
        where: {
          date: { [Op.lte]: decisionDateStr },
          completed: false,
        },
        include: [
          { model: UserHomes, as: "home" },
          { model: User, as: "user" },
        ],
      },
    ],
  });

  let processed = 0;

  for (const job of jobs) {
    try {
      const { appointment } = job;
      const home = appointment.home;
      const homeowner = appointment.user;

      if (!home || !homeowner) continue;

      // Verify this is an edge case home
      const isEdge = await MultiCleanerService.isEdgeLargeHome(
        home.numBeds,
        home.numBaths,
        config
      );
      if (!isEdge) continue;

      // Get the confirmed cleaner
      const confirmedCompletion = await CleanerJobCompletion.findOne({
        where: {
          multiCleanerJobId: job.id,
          status: { [Op.notIn]: ["dropped_out", "no_show"] },
        },
        include: [{ model: User, as: "cleaner" }],
      });

      if (!confirmedCompletion || !confirmedCompletion.cleaner) continue;

      const confirmedCleaner = confirmedCompletion.cleaner;
      const expiresAt = new Date(Date.now() + decisionHours * 60 * 60 * 1000);

      // Update job with edge case decision fields
      await job.update({
        edgeCaseDecisionRequired: true,
        edgeCaseDecisionSentAt: new Date(),
        edgeCaseDecisionExpiresAt: expiresAt,
        homeownerDecision: "pending",
      });

      // Format date and address for notifications
      const appointmentDate = new Date(appointment.date);
      const formattedDate = appointmentDate.toLocaleDateString("en-US", {
        weekday: "long",
        month: "short",
        day: "numeric",
        year: "numeric",
      });
      const homeAddress = {
        street: EncryptionService.decrypt(home.address),
        city: EncryptionService.decrypt(home.city),
        state: EncryptionService.decrypt(home.state),
        zipcode: EncryptionService.decrypt(home.zipcode),
      };
      const cleanerName = EncryptionService.decrypt(confirmedCleaner.firstName);

      // Create in-app notification
      await NotificationService.createNotification({
        userId: homeowner.id,
        type: "edge_case_decision_required",
        title: "Action needed: Your cleaning has 1 cleaner confirmed",
        body: `Your cleaning on ${formattedDate} has ${cleanerName} confirmed, but we couldn't find a second cleaner. Choose to proceed with 1 cleaner or cancel with no fees.`,
        data: {
          appointmentId: appointment.id,
          multiCleanerJobId: job.id,
          cleanerName: cleanerName,
          expiresAt: expiresAt.toISOString(),
          options: ["proceed", "cancel"],
        },
        actionRequired: true,
        expiresAt: expiresAt,
      });

      // Send email notification
      const homeownerEmail = EncryptionService.decrypt(homeowner.email);
      const homeownerFirstName = EncryptionService.decrypt(homeowner.firstName);

      if (homeownerEmail) {
        try {
          await Email.sendEdgeCaseDecisionRequired(
            homeownerEmail,
            homeownerFirstName,
            cleanerName,
            formattedDate,
            homeAddress,
            decisionHours,
            appointment.id,
            job.id
          );
        } catch (emailError) {
          console.error(
            `[MultiCleanerFillMonitor] Failed to send edge case email for job ${job.id}:`,
            emailError
          );
        }
      }

      // Send push notification
      if (homeowner.expoPushToken) {
        try {
          await PushNotification.sendPushEdgeCaseDecision(
            homeowner.expoPushToken,
            homeownerFirstName,
            cleanerName,
            formattedDate,
            decisionHours
          );
        } catch (pushError) {
          console.error(
            `[MultiCleanerFillMonitor] Failed to send edge case push for job ${job.id}:`,
            pushError
          );
        }
      }

      processed++;
      console.log(
        `[MultiCleanerFillMonitor] Sent edge case decision request for job ${job.id} to homeowner ${homeowner.id} (expires in ${decisionHours}h)`
      );
    } catch (error) {
      console.error(
        `[MultiCleanerFillMonitor] Error processing edge case decision for job ${job.id}:`,
        error
      );
    }
  }

  return processed;
}

/**
 * Process expired edge case decisions - auto-proceed with 1 cleaner
 * @param {Object} io - Socket.io instance
 * @returns {Promise<number>} Number of jobs processed
 */
async function processExpiredEdgeCaseDecisions(io = null) {
  const now = new Date();

  // Find jobs with expired pending decisions
  const jobs = await MultiCleanerJob.findAll({
    where: {
      edgeCaseDecisionRequired: true,
      homeownerDecision: "pending",
      edgeCaseDecisionExpiresAt: { [Op.lt]: now },
    },
    include: [
      {
        model: UserAppointments,
        as: "appointment",
        where: {
          completed: false,
        },
        include: [
          { model: UserHomes, as: "home" },
          { model: User, as: "user" },
        ],
      },
    ],
  });

  let processed = 0;

  for (const job of jobs) {
    try {
      const { appointment } = job;
      const home = appointment.home;
      const homeowner = appointment.user;

      if (!home || !homeowner) continue;

      // Get the confirmed cleaner
      const confirmedCompletion = await CleanerJobCompletion.findOne({
        where: {
          multiCleanerJobId: job.id,
          status: { [Op.notIn]: ["dropped_out", "no_show"] },
        },
        include: [{ model: User, as: "cleaner" }],
      });

      if (!confirmedCompletion || !confirmedCompletion.cleaner) continue;

      const confirmedCleaner = confirmedCompletion.cleaner;

      // Auto-proceed: Update job status
      await job.update({
        homeownerDecision: "auto_proceeded",
        homeownerDecisionAt: now,
        // Keep the job as partially_filled but allow payment capture
      });

      // Format date and address for notifications
      const appointmentDate = new Date(appointment.date);
      const formattedDate = appointmentDate.toLocaleDateString("en-US", {
        weekday: "long",
        month: "short",
        day: "numeric",
        year: "numeric",
      });
      const homeAddress = {
        street: EncryptionService.decrypt(home.address),
        city: EncryptionService.decrypt(home.city),
        state: EncryptionService.decrypt(home.state),
        zipcode: EncryptionService.decrypt(home.zipcode),
      };
      const cleanerName = EncryptionService.decrypt(confirmedCleaner.firstName);
      const homeownerFirstName = EncryptionService.decrypt(homeowner.firstName);
      const homeownerEmail = EncryptionService.decrypt(homeowner.email);

      // Notify homeowner that we auto-proceeded
      await NotificationService.createNotification({
        userId: homeowner.id,
        type: "edge_case_auto_proceeded",
        title: "Your cleaning will proceed with 1 cleaner",
        body: `No response received for your cleaning on ${formattedDate}. ${cleanerName} will complete your cleaning. Normal cancellation fees now apply.`,
        data: {
          appointmentId: appointment.id,
          multiCleanerJobId: job.id,
          cleanerName: cleanerName,
        },
      });

      // Send email to homeowner
      if (homeownerEmail) {
        try {
          await Email.sendEdgeCaseAutoProceeded(
            homeownerEmail,
            homeownerFirstName,
            cleanerName,
            formattedDate,
            homeAddress,
            appointment.id
          );
        } catch (emailError) {
          console.error(
            `[MultiCleanerFillMonitor] Failed to send auto-proceed email to homeowner for job ${job.id}:`,
            emailError
          );
        }
      }

      // Notify cleaner they're confirmed as sole cleaner
      const cleanerEmail = EncryptionService.decrypt(confirmedCleaner.email);
      const cleanerFirstName = EncryptionService.decrypt(confirmedCleaner.firstName);

      await NotificationService.createNotification({
        userId: confirmedCleaner.id,
        type: "edge_case_cleaner_confirmed",
        title: "You're confirmed as the sole cleaner",
        body: `You're confirmed to clean ${homeAddress.street} on ${formattedDate}. You'll receive the full cleaning pay. A second cleaner may still join before the appointment.`,
        data: {
          appointmentId: appointment.id,
          multiCleanerJobId: job.id,
        },
      });

      if (cleanerEmail) {
        try {
          await Email.sendEdgeCaseCleanerConfirmed(
            cleanerEmail,
            cleanerFirstName,
            formattedDate,
            homeAddress,
            appointment.id,
            true // fullPay
          );
        } catch (emailError) {
          console.error(
            `[MultiCleanerFillMonitor] Failed to send cleaner confirmed email for job ${job.id}:`,
            emailError
          );
        }
      }

      // Send push notification to cleaner
      if (confirmedCleaner.expoPushToken) {
        try {
          await PushNotification.sendPushEdgeCaseCleanerConfirmed(
            confirmedCleaner.expoPushToken,
            cleanerFirstName,
            formattedDate,
            homeAddress.street
          );
        } catch (pushError) {
          console.error(
            `[MultiCleanerFillMonitor] Failed to send cleaner push for job ${job.id}:`,
            pushError
          );
        }
      }

      processed++;
      console.log(
        `[MultiCleanerFillMonitor] Auto-proceeded job ${job.id} - homeowner ${homeowner.id} didn't respond, cleaner ${confirmedCleaner.id} confirmed`
      );
    } catch (error) {
      console.error(
        `[MultiCleanerFillMonitor] Error processing expired edge case for job ${job.id}:`,
        error
      );
    }
  }

  return processed;
}

/**
 * Cancel an edge case appointment when homeowner chooses to cancel
 * @param {MultiCleanerJob} multiCleanerJob - The multi-cleaner job
 * @param {string} reason - Cancellation reason
 * @returns {Promise<Object>} Result of cancellation
 */
async function cancelEdgeCaseAppointment(multiCleanerJob, reason = "lack_of_cleaners") {
  try {
    const appointment = await UserAppointments.findByPk(multiCleanerJob.appointmentId, {
      include: [
        { model: UserHomes, as: "home" },
        { model: User, as: "user" },
      ],
    });

    if (!appointment) {
      return { success: false, error: "Appointment not found" };
    }

    const home = appointment.home;
    const homeowner = appointment.user;

    // Get the confirmed cleaner before cancelling
    const confirmedCompletion = await CleanerJobCompletion.findOne({
      where: {
        multiCleanerJobId: multiCleanerJob.id,
        status: { [Op.notIn]: ["dropped_out", "no_show"] },
      },
      include: [{ model: User, as: "cleaner" }],
    });

    // Void any payment authorization if it exists
    if (appointment.paymentIntentId) {
      try {
        const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
        await stripe.paymentIntents.cancel(appointment.paymentIntentId);
      } catch (stripeError) {
        // Payment intent may already be cancelled or in a state that can't be cancelled
        console.log(
          `[EdgeCase] Could not cancel payment intent for appointment ${appointment.id}:`,
          stripeError.message
        );
      }
    }

    // Update multi-cleaner job status
    await multiCleanerJob.update({
      status: "cancelled",
      homeownerDecision: "cancel",
      homeownerDecisionAt: new Date(),
    });

    // Update appointment status - no cancellation fee for edge case cancels
    await appointment.update({
      paymentStatus: "cancelled",
      hasBeenAssigned: false,
    });

    // Remove cleaner assignments
    await CleanerJobCompletion.update(
      { status: "dropped_out" },
      { where: { multiCleanerJobId: multiCleanerJob.id } }
    );

    // Format notifications
    const appointmentDate = new Date(appointment.date);
    const formattedDate = appointmentDate.toLocaleDateString("en-US", {
      weekday: "long",
      month: "short",
      day: "numeric",
      year: "numeric",
    });
    const homeAddress = {
      street: EncryptionService.decrypt(home.address),
      city: EncryptionService.decrypt(home.city),
      state: EncryptionService.decrypt(home.state),
      zipcode: EncryptionService.decrypt(home.zipcode),
    };

    // Notify homeowner of cancellation
    const homeownerEmail = EncryptionService.decrypt(homeowner.email);
    const homeownerFirstName = EncryptionService.decrypt(homeowner.firstName);

    await NotificationService.createNotification({
      userId: homeowner.id,
      type: "edge_case_cancelled",
      title: "Your cleaning has been cancelled",
      body: `Your cleaning on ${formattedDate} has been cancelled due to insufficient cleaners. No cancellation fees apply.`,
      data: {
        appointmentId: appointment.id,
        reason: reason,
      },
    });

    if (homeownerEmail) {
      try {
        await Email.sendEdgeCaseCancelled(
          homeownerEmail,
          homeownerFirstName,
          formattedDate,
          homeAddress,
          reason
        );
      } catch (emailError) {
        console.error(
          `[EdgeCase] Failed to send cancellation email to homeowner:`,
          emailError
        );
      }
    }

    // Notify cleaner of cancellation (no compensation)
    if (confirmedCompletion && confirmedCompletion.cleaner) {
      const cleaner = confirmedCompletion.cleaner;
      const cleanerEmail = EncryptionService.decrypt(cleaner.email);
      const cleanerFirstName = EncryptionService.decrypt(cleaner.firstName);

      await NotificationService.createNotification({
        userId: cleaner.id,
        type: "edge_case_cleaner_cancelled",
        title: "Cleaning cancelled - no second cleaner",
        body: `The cleaning on ${formattedDate} at ${homeAddress.street} has been cancelled because no second cleaner was found. The homeowner has cancelled with no fees.`,
        data: {
          appointmentId: appointment.id,
          reason: reason,
        },
      });

      if (cleanerEmail) {
        try {
          await Email.sendEdgeCaseCleanerCancelled(
            cleanerEmail,
            cleanerFirstName,
            formattedDate,
            homeAddress,
            reason
          );
        } catch (emailError) {
          console.error(
            `[EdgeCase] Failed to send cancellation email to cleaner:`,
            emailError
          );
        }
      }

      // Send push to cleaner
      if (cleaner.expoPushToken) {
        try {
          await PushNotification.sendPushEdgeCaseCleanerCancelled(
            cleaner.expoPushToken,
            cleanerFirstName,
            formattedDate,
            homeAddress.street
          );
        } catch (pushError) {
          console.error(
            `[EdgeCase] Failed to send cancellation push to cleaner:`,
            pushError
          );
        }
      }
    }

    console.log(
      `[EdgeCase] Cancelled appointment ${appointment.id} due to ${reason}`
    );

    return { success: true };
  } catch (error) {
    console.error(`[EdgeCase] Error cancelling appointment:`, error);
    return { success: false, error: error.message };
  }
}

/**
 * Main monitor function - runs all checks
 * @param {Object} io - Socket.io instance
 * @returns {Object} Summary of processing
 */
async function processMultiCleanerFillMonitor(io = null) {
  console.log("[MultiCleanerFillMonitor] Starting fill monitor job...");

  const results = {
    urgentFillNotifications: 0,
    finalWarnings: 0,
    soloCompletionOffers: 0,
    edgeCaseDecisions: 0,
    expiredEdgeCaseDecisions: 0,
    errors: 0,
    timestamp: new Date().toISOString(),
  };

  try {
    results.urgentFillNotifications = await processUrgentFillNotifications(io);
  } catch (error) {
    console.error("[MultiCleanerFillMonitor] Error in urgent fill:", error);
    results.errors++;
  }

  try {
    results.finalWarnings = await processFinalWarnings(io);
  } catch (error) {
    console.error("[MultiCleanerFillMonitor] Error in final warnings:", error);
    results.errors++;
  }

  try {
    results.soloCompletionOffers = await processSoloCompletionOffers(io);
  } catch (error) {
    console.error("[MultiCleanerFillMonitor] Error in solo offers:", error);
    results.errors++;
  }

  try {
    results.edgeCaseDecisions = await processEdgeCaseDecisions(io);
  } catch (error) {
    console.error("[MultiCleanerFillMonitor] Error in edge case decisions:", error);
    results.errors++;
  }

  try {
    results.expiredEdgeCaseDecisions = await processExpiredEdgeCaseDecisions(io);
  } catch (error) {
    console.error("[MultiCleanerFillMonitor] Error in expired edge case decisions:", error);
    results.errors++;
  }

  console.log(
    `[MultiCleanerFillMonitor] Completed. Urgent: ${results.urgentFillNotifications}, Warnings: ${results.finalWarnings}, Solo: ${results.soloCompletionOffers}, EdgeCase: ${results.edgeCaseDecisions}, ExpiredEdgeCase: ${results.expiredEdgeCaseDecisions}`
  );

  return results;
}

/**
 * Start the monitor as a recurring interval
 * @param {Object} io - Socket.io instance
 * @param {number} intervalMs - Interval in milliseconds (default: 1 hour)
 * @returns {Object} Interval reference for cleanup
 */
function startFillMonitorJob(io, intervalMs = 60 * 60 * 1000) {
  console.log(
    `[MultiCleanerFillMonitor] Starting fill monitor job (interval: ${intervalMs}ms)`
  );

  // Run immediately on start
  processMultiCleanerFillMonitor(io).catch((err) => {
    console.error("[MultiCleanerFillMonitor] Error on initial run:", err);
  });

  // Then run on interval
  const interval = setInterval(() => {
    processMultiCleanerFillMonitor(io).catch((err) => {
      console.error("[MultiCleanerFillMonitor] Error on interval run:", err);
    });
  }, intervalMs);

  return interval;
}

module.exports = {
  processMultiCleanerFillMonitor,
  startFillMonitorJob,
  processUrgentFillNotifications,
  processFinalWarnings,
  processSoloCompletionOffers,
  processEdgeCaseDecisions,
  processExpiredEdgeCaseDecisions,
  cancelEdgeCaseAppointment,
};
