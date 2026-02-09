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
 * Process expired solo completion offers
 * If a solo offer was sent 12+ hours ago and cleaner didn't respond,
 * notify homeowner and release the cleaner
 * @param {Object} io - Socket.io instance
 * @returns {Promise<number>} Number of jobs processed
 */
async function processExpiredSoloOffers(io = null) {
  // Solo offers expire after 12 hours
  const expirationThreshold = new Date();
  expirationThreshold.setHours(expirationThreshold.getHours() - 12);

  // Find jobs where:
  // - Solo offer was sent (job is partially_filled with 1 cleaner)
  // - Offer was sent more than 12 hours ago
  // - Cleaner hasn't accepted (soloCleanerConsent is still false)
  // - Offer hasn't already been marked as expired or declined
  const jobs = await MultiCleanerJob.findAll({
    where: {
      status: "partially_filled",
      cleanersConfirmed: { [Op.lte]: 1 },
      soloOfferExpired: { [Op.or]: [false, null] },
      soloOfferDeclined: { [Op.or]: [false, null] },
    },
    include: [
      {
        model: UserAppointments,
        as: "appointment",
        where: {
          soloCleanerConsent: { [Op.or]: [false, null] },
          completed: false,
        },
      },
      {
        model: CleanerJobCompletion,
        as: "completions",
        where: {
          status: { [Op.notIn]: ["dropped_out", "no_show"] },
        },
        required: false,
      },
    ],
  });

  let processed = 0;

  for (const job of jobs) {
    try {
      // Check if there's an unexpired solo_completion_offer notification
      // If so, skip - the offer is still active
      const activeOffer = await NotificationService.findActiveNotification(
        job.completions[0]?.cleanerId,
        "solo_completion_offer",
        job.appointmentId
      );

      if (activeOffer) {
        // Offer still active, skip
        continue;
      }

      // Check if offer was sent but is now expired (notification expired)
      const expiredOffer = await NotificationService.findExpiredNotification(
        job.completions[0]?.cleanerId,
        "solo_completion_offer",
        job.appointmentId
      );

      if (!expiredOffer) {
        // No offer was sent yet, skip
        continue;
      }

      // Offer expired - handle it
      await MultiCleanerService.handleExpiredSoloOffer(job.id);
      processed++;

      console.log(
        `[MultiCleanerFillMonitor] Processed expired solo offer for job ${job.id}`
      );
    } catch (error) {
      console.error(
        `[MultiCleanerFillMonitor] Error processing expired solo offer for job ${job.id}:`,
        error
      );
    }
  }

  return processed;
}

/**
 * Process expired extra work offers
 * If extra work offers were sent 12+ hours ago and cleaners didn't respond,
 * release non-responsive cleaners and notify homeowner
 * @param {Object} io - Socket.io instance
 * @returns {Promise<number>} Number of jobs processed
 */
async function processExpiredExtraWorkOffers(io = null) {
  const now = new Date();

  // Find jobs where:
  // - Extra work offers were sent
  // - Offers have expired (past extraWorkOffersExpireAt)
  // - Offers haven't already been marked as expired
  const jobs = await MultiCleanerJob.findAll({
    where: {
      extraWorkOffersSentAt: { [Op.ne]: null },
      extraWorkOffersExpireAt: { [Op.lt]: now },
      extraWorkOffersExpired: { [Op.or]: [false, null] },
    },
    include: [
      {
        model: UserAppointments,
        as: "appointment",
        where: {
          completed: false,
        },
      },
      {
        model: CleanerJobCompletion,
        as: "completions",
        required: false,
      },
    ],
  });

  let processed = 0;

  for (const job of jobs) {
    try {
      // Check if any cleaners haven't responded
      const nonResponsive = job.completions.filter(
        (c) =>
          !["dropped_out", "no_show"].includes(c.status) &&
          !c.extraWorkAccepted &&
          !c.extraWorkDeclined
      );

      if (nonResponsive.length === 0) {
        // All cleaners responded, just mark as processed
        await job.update({
          extraWorkOffersExpired: true,
          extraWorkOffersExpiredAt: now,
        });
        continue;
      }

      // Handle the expired offers
      await MultiCleanerService.handleExpiredExtraWorkOffers(job.id);
      processed++;

      console.log(
        `[MultiCleanerFillMonitor] Processed expired extra work offers for job ${job.id}, ${nonResponsive.length} non-responsive`
      );
    } catch (error) {
      console.error(
        `[MultiCleanerFillMonitor] Error processing expired extra work offers for job ${job.id}:`,
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
  // - At least 1 cleaner confirmed, but fewer than required
  // - Appointment date is within 3 days
  // - Edge case decision not already sent
  const jobs = await MultiCleanerJob.findAll({
    where: {
      status: "partially_filled",
      cleanersConfirmed: { [Op.gte]: 1 },
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

      // Skip jobs that are already filled
      if (job.cleanersConfirmed >= job.totalCleanersRequired) continue;

      // Get all confirmed cleaners
      const confirmedCompletions = await CleanerJobCompletion.findAll({
        where: {
          multiCleanerJobId: job.id,
          status: { [Op.notIn]: ["dropped_out", "no_show"] },
        },
        include: [{ model: User, as: "cleaner" }],
      });

      if (confirmedCompletions.length === 0) continue;

      // Calculate shortfall
      const confirmedCount = confirmedCompletions.length;
      const requiredCount = job.totalCleanersRequired;
      const shortfall = requiredCount - confirmedCount;

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

      // Build cleaner names list
      const cleanerNames = confirmedCompletions
        .filter((c) => c.cleaner)
        .map((c) => EncryptionService.decrypt(c.cleaner.firstName));
      const cleanerNamesDisplay =
        cleanerNames.length === 1
          ? cleanerNames[0]
          : cleanerNames.length === 2
            ? `${cleanerNames[0]} and ${cleanerNames[1]}`
            : `${cleanerNames.slice(0, -1).join(", ")}, and ${cleanerNames[cleanerNames.length - 1]}`;

      // Build dynamic message based on shortfall
      const cleanerWord = confirmedCount === 1 ? "cleaner" : "cleaners";
      const shortfallWord = shortfall === 1 ? "cleaner" : "cleaners";
      const notificationTitle = `Action needed: Your cleaning has ${confirmedCount} of ${requiredCount} ${cleanerWord}`;
      const notificationBody = `Your cleaning on ${formattedDate} has ${cleanerNamesDisplay} confirmed, but we couldn't find ${shortfall} more ${shortfallWord}. Choose to proceed with ${confirmedCount} ${cleanerWord} or cancel with no fees.`;

      // Create in-app notification
      await NotificationService.createNotification({
        userId: homeowner.id,
        type: "edge_case_decision_required",
        title: notificationTitle,
        body: notificationBody,
        data: {
          appointmentId: appointment.id,
          multiCleanerJobId: job.id,
          cleanerNames: cleanerNames,
          confirmedCount: confirmedCount,
          requiredCount: requiredCount,
          shortfall: shortfall,
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
            cleanerNamesDisplay,
            formattedDate,
            homeAddress,
            decisionHours,
            appointment.id,
            job.id,
            confirmedCount,
            requiredCount
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
            cleanerNamesDisplay,
            formattedDate,
            decisionHours,
            confirmedCount,
            requiredCount
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
        `[MultiCleanerFillMonitor] Sent edge case decision request for job ${job.id} to homeowner ${homeowner.id} (${confirmedCount}/${requiredCount} cleaners, expires in ${decisionHours}h)`
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

      // Get all confirmed cleaners
      const confirmedCompletions = await CleanerJobCompletion.findAll({
        where: {
          multiCleanerJobId: job.id,
          status: { [Op.notIn]: ["dropped_out", "no_show"] },
        },
        include: [{ model: User, as: "cleaner" }],
      });

      if (confirmedCompletions.length === 0) continue;

      const confirmedCount = confirmedCompletions.length;
      const requiredCount = job.totalCleanersRequired;

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

      // Build cleaner names list
      const cleanerNames = confirmedCompletions
        .filter((c) => c.cleaner)
        .map((c) => EncryptionService.decrypt(c.cleaner.firstName));
      const cleanerNamesDisplay =
        cleanerNames.length === 1
          ? cleanerNames[0]
          : cleanerNames.length === 2
            ? `${cleanerNames[0]} and ${cleanerNames[1]}`
            : `${cleanerNames.slice(0, -1).join(", ")}, and ${cleanerNames[cleanerNames.length - 1]}`;

      const homeownerFirstName = EncryptionService.decrypt(homeowner.firstName);
      const homeownerEmail = EncryptionService.decrypt(homeowner.email);

      // Dynamic messages based on cleaner count
      const cleanerWord = confirmedCount === 1 ? "cleaner" : "cleaners";
      const cleanerTitle = confirmedCount === 1
        ? "Your cleaning will proceed with 1 cleaner"
        : `Your cleaning will proceed with ${confirmedCount} cleaners`;
      const cleanerBody = confirmedCount === 1
        ? `No response received for your cleaning on ${formattedDate}. ${cleanerNamesDisplay} will complete your cleaning. Normal cancellation fees now apply.`
        : `No response received for your cleaning on ${formattedDate}. ${cleanerNamesDisplay} will complete your cleaning (originally needed ${requiredCount}). Normal cancellation fees now apply.`;

      // Notify homeowner that we auto-proceeded
      await NotificationService.createNotification({
        userId: homeowner.id,
        type: "edge_case_auto_proceeded",
        title: cleanerTitle,
        body: cleanerBody,
        data: {
          appointmentId: appointment.id,
          multiCleanerJobId: job.id,
          cleanerNames: cleanerNames,
          confirmedCount: confirmedCount,
          requiredCount: requiredCount,
        },
      });

      // Send email to homeowner
      if (homeownerEmail) {
        try {
          await Email.sendEdgeCaseAutoProceeded(
            homeownerEmail,
            homeownerFirstName,
            cleanerNamesDisplay,
            formattedDate,
            homeAddress,
            appointment.id,
            confirmedCount,
            requiredCount
          );
        } catch (emailError) {
          console.error(
            `[MultiCleanerFillMonitor] Failed to send auto-proceed email to homeowner for job ${job.id}:`,
            emailError
          );
        }
      }

      // Notify each confirmed cleaner
      for (const completion of confirmedCompletions) {
        if (!completion.cleaner) continue;

        const cleaner = completion.cleaner;
        const cleanerEmail = EncryptionService.decrypt(cleaner.email);
        const cleanerFirstName = EncryptionService.decrypt(cleaner.firstName);

        // Dynamic message based on whether solo or team
        const isSolo = confirmedCount === 1;
        const cleanerNotificationTitle = isSolo
          ? "You're confirmed as the sole cleaner"
          : `You're confirmed with ${confirmedCount - 1} other ${confirmedCount - 1 === 1 ? "cleaner" : "cleaners"}`;
        const cleanerNotificationBody = isSolo
          ? `You're confirmed to clean ${homeAddress.street} on ${formattedDate}. You'll receive the full cleaning pay. Additional cleaners may still join before the appointment.`
          : `You're confirmed to clean ${homeAddress.street} on ${formattedDate} with ${cleanerNamesDisplay.replace(cleanerFirstName, "").replace(/^(, and | and |, )/, "").trim() || "your team"}. Originally needed ${requiredCount} cleaners.`;

        await NotificationService.createNotification({
          userId: cleaner.id,
          type: "edge_case_cleaner_confirmed",
          title: cleanerNotificationTitle,
          body: cleanerNotificationBody,
          data: {
            appointmentId: appointment.id,
            multiCleanerJobId: job.id,
            confirmedCount: confirmedCount,
            requiredCount: requiredCount,
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
              isSolo, // fullPay only if solo
              confirmedCount,
              requiredCount
            );
          } catch (emailError) {
            console.error(
              `[MultiCleanerFillMonitor] Failed to send cleaner confirmed email for job ${job.id}:`,
              emailError
            );
          }
        }

        // Send push notification to cleaner
        if (cleaner.expoPushToken) {
          try {
            await PushNotification.sendPushEdgeCaseCleanerConfirmed(
              cleaner.expoPushToken,
              cleanerFirstName,
              formattedDate,
              homeAddress.street,
              confirmedCount,
              requiredCount
            );
          } catch (pushError) {
            console.error(
              `[MultiCleanerFillMonitor] Failed to send cleaner push for job ${job.id}:`,
              pushError
            );
          }
        }
      }

      const cleanerIds = confirmedCompletions.map((c) => c.cleaner?.id).filter(Boolean);
      processed++;
      console.log(
        `[MultiCleanerFillMonitor] Auto-proceeded job ${job.id} - homeowner ${homeowner.id} didn't respond, ${confirmedCount}/${requiredCount} cleaners confirmed: [${cleanerIds.join(", ")}]`
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

    // Get all confirmed cleaners before cancelling
    const confirmedCompletions = await CleanerJobCompletion.findAll({
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

    // Notify all confirmed cleaners of cancellation (no compensation)
    const confirmedCount = confirmedCompletions.length;
    const requiredCount = multiCleanerJob.totalCleanersRequired;
    const shortfall = requiredCount - confirmedCount;
    const shortfallText = shortfall === 1 ? "another cleaner" : `${shortfall} more cleaners`;

    for (const completion of confirmedCompletions) {
      if (!completion.cleaner) continue;

      const cleaner = completion.cleaner;
      const cleanerEmail = EncryptionService.decrypt(cleaner.email);
      const cleanerFirstName = EncryptionService.decrypt(cleaner.firstName);

      await NotificationService.createNotification({
        userId: cleaner.id,
        type: "edge_case_cleaner_cancelled",
        title: "Cleaning cancelled - not enough cleaners",
        body: `The cleaning on ${formattedDate} at ${homeAddress.street} has been cancelled because we couldn't find ${shortfallText}. The homeowner has cancelled with no fees.`,
        data: {
          appointmentId: appointment.id,
          reason: reason,
          confirmedCount: confirmedCount,
          requiredCount: requiredCount,
        },
      });

      if (cleanerEmail) {
        try {
          await Email.sendEdgeCaseCleanerCancelled(
            cleanerEmail,
            cleanerFirstName,
            formattedDate,
            homeAddress,
            reason,
            confirmedCount,
            requiredCount
          );
        } catch (emailError) {
          console.error(
            `[EdgeCase] Failed to send cancellation email to cleaner ${cleaner.id}:`,
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
            homeAddress.street,
            confirmedCount,
            requiredCount
          );
        } catch (pushError) {
          console.error(
            `[EdgeCase] Failed to send cancellation push to cleaner ${cleaner.id}:`,
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
    expiredSoloOffers: 0,
    expiredExtraWorkOffers: 0,
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
    results.expiredSoloOffers = await processExpiredSoloOffers(io);
  } catch (error) {
    console.error("[MultiCleanerFillMonitor] Error in expired solo offers:", error);
    results.errors++;
  }

  try {
    results.expiredExtraWorkOffers = await processExpiredExtraWorkOffers(io);
  } catch (error) {
    console.error("[MultiCleanerFillMonitor] Error in expired extra work offers:", error);
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
    `[MultiCleanerFillMonitor] Completed. Urgent: ${results.urgentFillNotifications}, Warnings: ${results.finalWarnings}, Solo: ${results.soloCompletionOffers}, ExpiredSolo: ${results.expiredSoloOffers}, ExpiredExtraWork: ${results.expiredExtraWorkOffers}, EdgeCase: ${results.edgeCaseDecisions}, ExpiredEdgeCase: ${results.expiredEdgeCaseDecisions}`
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
  processExpiredSoloOffers,
  processExpiredExtraWorkOffers,
  processEdgeCaseDecisions,
  processExpiredEdgeCaseDecisions,
  cancelEdgeCaseAppointment,
};
