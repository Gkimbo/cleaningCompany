/**
 * Payment Retry Monitor
 * Handles automatic retry of failed payment captures with escalating notifications.
 * After 2 days of failed payments, the appointment is auto-cancelled.
 *
 * Timeline:
 * - Hour 0: Initial failure - notification sent to homeowner
 * - Hours 4, 12, 24, 36: Retry attempts with notifications
 * - Hour 48 (2 days): Auto-cancel if still failing
 */

const { Op } = require("sequelize");
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
const { UserAppointments, User, UserHomes, Payment, EmployeeJobAssignment } = require("../../models");
const NotificationService = require("../NotificationService");
const Email = require("../sendNotifications/EmailClass");
const PushNotification = require("../sendNotifications/PushNotificationClass");
const EncryptionService = require("../EncryptionService");
const HomeownerFreezeService = require("../HomeownerFreezeService");

// Configuration
const AUTO_CANCEL_HOURS = 48; // 2 days
const RETRY_INTERVALS_HOURS = [4, 12, 24, 36]; // Retry at these hours after first failure
const MIN_RETRY_INTERVAL_HOURS = 4; // Minimum time between retries

/**
 * Main function to process all failed payments
 * @param {Object} io - Socket.io instance for real-time notifications
 * @returns {Object} Summary of processed payments
 */
async function processFailedPayments(io = null) {
  const now = new Date();
  const results = { retried: 0, succeeded: 0, cancelled: 0, errors: 0 };

  try {
    console.log("[PaymentRetryMonitor] Starting payment retry check...");

    // Find all appointments with failed payments that haven't been cancelled or paused
    const failedPaymentAppointments = await UserAppointments.findAll({
      where: {
        paymentCaptureFailed: true,
        wasCancelled: { [Op.ne]: true },
        isPaused: { [Op.ne]: true }, // Skip paused appointments (homeowner frozen)
        completed: false,
      },
      include: [
        {
          model: User,
          as: "user",
          attributes: [
            "id",
            "firstName",
            "lastName",
            "email",
            "notificationEmail",
            "expoPushToken",
            "notifications",
            "stripeCustomerId",
          ],
        },
        {
          model: UserHomes,
          as: "home",
          attributes: ["id", "address", "city", "state"],
        },
      ],
    });

    console.log(
      `[PaymentRetryMonitor] Found ${failedPaymentAppointments.length} appointments with failed payments`
    );

    for (const appointment of failedPaymentAppointments) {
      try {
        // Initialize first failure timestamp if not set
        if (!appointment.paymentFirstFailedAt) {
          await appointment.update({
            paymentFirstFailedAt: now,
          });
        }

        const hoursSinceFirstFailure = appointment.paymentFirstFailedAt
          ? (now - new Date(appointment.paymentFirstFailedAt)) / (1000 * 60 * 60)
          : 0;

        // Check if we should auto-cancel (2 days passed)
        // Only cancel future appointments - if the cleaning already happened, keep trying to collect
        const appointmentDate = new Date(appointment.date + "T23:59:59");
        const isPastAppointment = appointmentDate < new Date();

        if (hoursSinceFirstFailure >= AUTO_CANCEL_HOURS && !isPastAppointment) {
          await autoCancelAppointment(appointment, io);
          results.cancelled++;
          continue;
        }

        // Check if enough time has passed since last retry
        const hoursSinceLastRetry = appointment.lastPaymentRetryAt
          ? (now - new Date(appointment.lastPaymentRetryAt)) / (1000 * 60 * 60)
          : MIN_RETRY_INTERVAL_HOURS + 1; // Ensure first retry can happen

        if (hoursSinceLastRetry < MIN_RETRY_INTERVAL_HOURS) {
          // Too soon for another retry
          continue;
        }

        // Attempt payment retry
        results.retried++;
        const success = await retryPaymentCapture(appointment, io);

        if (success) {
          results.succeeded++;
        }
      } catch (error) {
        results.errors++;
        console.error(
          `[PaymentRetryMonitor] Error processing appointment ${appointment.id}:`,
          error.message
        );
      }
    }

    console.log(
      `[PaymentRetryMonitor] Completed. Retried: ${results.retried}, Succeeded: ${results.succeeded}, Cancelled: ${results.cancelled}, Errors: ${results.errors}`
    );

    return results;
  } catch (error) {
    console.error("[PaymentRetryMonitor] Fatal error:", error);
    return { ...results, errors: results.errors + 1 };
  }
}

/**
 * Attempt to retry payment capture for an appointment
 * @param {Object} appointment - The appointment with failed payment
 * @param {Object} io - Socket.io instance
 * @returns {boolean} True if payment succeeded
 */
async function retryPaymentCapture(appointment, io) {
  const now = new Date();
  const homeowner = appointment.user;

  if (!homeowner) {
    console.error(
      `[PaymentRetryMonitor] No homeowner found for appointment ${appointment.id}`
    );
    return false;
  }

  try {
    let paymentIntent;

    // Try to capture the existing payment intent
    if (appointment.paymentIntentId) {
      try {
        // First check the payment intent status
        const existingIntent = await stripe.paymentIntents.retrieve(
          appointment.paymentIntentId
        );

        if (existingIntent.status === "succeeded") {
          // Payment already succeeded - clear the failure flag
          await appointment.update({
            paymentCaptureFailed: false,
            paymentStatus: "captured",
            lastPaymentRetryAt: now,
          });
          console.log(
            `[PaymentRetryMonitor] Payment already succeeded for appointment ${appointment.id}`
          );
          await notifyPaymentSuccess(appointment, homeowner, io);
          return true;
        }

        if (existingIntent.status === "requires_capture") {
          // Capture the payment
          paymentIntent = await stripe.paymentIntents.capture(
            appointment.paymentIntentId
          );
        } else if (existingIntent.status === "canceled") {
          // Need to create a new payment intent
          paymentIntent = await createNewPaymentIntent(appointment, homeowner);
        } else {
          // Other status - try to capture anyway
          paymentIntent = await stripe.paymentIntents.capture(
            appointment.paymentIntentId
          );
        }
      } catch (captureError) {
        // Capture failed - try creating a new payment intent
        console.log(
          `[PaymentRetryMonitor] Capture failed for appointment ${appointment.id}: ${captureError.message}`
        );
        paymentIntent = await createNewPaymentIntent(appointment, homeowner);
      }
    } else {
      // No payment intent exists - create one
      paymentIntent = await createNewPaymentIntent(appointment, homeowner);
    }

    if (paymentIntent && paymentIntent.status === "succeeded") {
      // Payment succeeded!
      await appointment.update({
        paymentCaptureFailed: false,
        paymentStatus: "captured",
        paymentIntentId: paymentIntent.id,
        amountPaid: paymentIntent.amount,
        lastPaymentRetryAt: now,
      });

      // Record in Payment table
      await Payment.create({
        appointmentId: appointment.id,
        stripePaymentIntentId: paymentIntent.id,
        amount: paymentIntent.amount,
        currency: paymentIntent.currency || "usd",
        status: "succeeded",
        type: "capture",
        metadata: { retrySuccess: true, retryCount: appointment.paymentRetryCount },
      });

      console.log(
        `[PaymentRetryMonitor] Payment retry succeeded for appointment ${appointment.id}`
      );

      await notifyPaymentSuccess(appointment, homeowner, io);
      return true;
    } else {
      // Payment failed again
      const currentRetryCount = appointment.paymentRetryCount || 0;
      await appointment.update({
        paymentRetryCount: currentRetryCount + 1,
        lastPaymentRetryAt: now,
      });

      await notifyPaymentRetryFailed(appointment, homeowner, io);
      return false;
    }
  } catch (error) {
    console.error(
      `[PaymentRetryMonitor] Payment retry failed for appointment ${appointment.id}:`,
      error.message
    );

    // Update retry tracking
    const currentRetryCount = appointment.paymentRetryCount || 0;
    await appointment.update({
      paymentRetryCount: currentRetryCount + 1,
      lastPaymentRetryAt: now,
    });

    // Record failure (price already in cents)
    await Payment.create({
      appointmentId: appointment.id,
      stripePaymentIntentId: appointment.paymentIntentId,
      amount: appointment.price,
      currency: "usd",
      status: "failed",
      type: "capture",
      failureReason: error.message,
      metadata: { retryAttempt: appointment.paymentRetryCount + 1 },
    });

    await notifyPaymentRetryFailed(appointment, homeowner, io);
    return false;
  }
}

/**
 * Create a new payment intent for an appointment
 * @param {Object} appointment - The appointment
 * @param {Object} homeowner - The homeowner user
 * @returns {Object|null} The payment intent or null if failed
 */
async function createNewPaymentIntent(appointment, homeowner) {
  if (!homeowner.stripeCustomerId) {
    throw new Error("No Stripe customer ID for homeowner");
  }

  // Get the customer's default payment method
  const customer = await stripe.customers.retrieve(homeowner.stripeCustomerId);
  const defaultPaymentMethod = customer.invoice_settings?.default_payment_method;

  if (!defaultPaymentMethod) {
    throw new Error("No default payment method on file");
  }

  // Price is already stored in cents
  const priceInCents = appointment.price;

  const paymentIntent = await stripe.paymentIntents.create({
    amount: priceInCents,
    currency: "usd",
    customer: homeowner.stripeCustomerId,
    payment_method: defaultPaymentMethod,
    confirm: true,
    automatic_payment_methods: {
      enabled: true,
      allow_redirects: "never",
    },
    metadata: {
      appointmentId: appointment.id,
      isRetry: "true",
    },
  });

  return paymentIntent;
}

/**
 * Auto-cancel an appointment due to persistent payment failure
 * @param {Object} appointment - The appointment to cancel
 * @param {Object} io - Socket.io instance
 */
async function autoCancelAppointment(appointment, io) {
  const homeowner = appointment.user;

  try {
    // Cancel the appointment
    await appointment.update({
      wasCancelled: true,
      cancellationReason: "payment_failed",
      cancelledBy: "system",
      cancelledAt: new Date(),
      paymentStatus: "cancelled",
    });

    console.log(
      `[PaymentRetryMonitor] Auto-cancelled appointment ${appointment.id} due to payment failure`
    );

    // Get home address for notifications
    const homeAddress = appointment.home
      ? `${EncryptionService.decrypt(appointment.home.address)}, ${EncryptionService.decrypt(appointment.home.city)}`
      : "your property";

    // Notify homeowner
    if (homeowner) {
      const homeownerFirstName = homeowner.firstName
        ? EncryptionService.decrypt(homeowner.firstName)
        : "Valued Customer";

      // In-app notification
      await NotificationService.createNotification({
        userId: homeowner.id,
        type: "appointment_cancelled_payment",
        title: "Appointment Cancelled - Payment Issue",
        body: `Your cleaning on ${appointment.date} has been cancelled because we were unable to process your payment after multiple attempts. Please update your payment method to rebook.`,
        data: {
          appointmentId: appointment.id,
          date: appointment.date,
          reason: "payment_failed",
        },
        actionRequired: true,
        relatedAppointmentId: appointment.id,
      });

      // Email notification
      const homeownerEmail = homeowner.notificationEmail || homeowner.email;
      if (homeownerEmail) {
        const decryptedEmail = EncryptionService.decrypt(homeownerEmail);
        await Email.sendPaymentFailureCancellation(
          decryptedEmail,
          homeownerFirstName,
          appointment.date,
          homeAddress
        );
      }

      // Push notification
      if (homeowner.expoPushToken) {
        await PushNotification.sendPushNotification(
          homeowner.expoPushToken,
          "Appointment Cancelled",
          `Your cleaning on ${appointment.date} was cancelled due to payment issues.`,
          { appointmentId: appointment.id, type: "appointment_cancelled_payment" }
        );
      }
    }

    // Notify assigned cleaner(s) if any
    if (appointment.employeesAssigned && appointment.employeesAssigned.length > 0) {
      for (const cleanerId of appointment.employeesAssigned) {
        try {
          const cleaner = await User.findByPk(cleanerId);
          if (cleaner) {
            const cleanerFirstName = cleaner.firstName
              ? EncryptionService.decrypt(cleaner.firstName)
              : "Cleaner";

            // In-app notification
            await NotificationService.createNotification({
              userId: cleaner.id,
              type: "appointment_cancelled_payment",
              title: "Job Cancelled - Payment Issue",
              body: `The cleaning job on ${appointment.date} at ${homeAddress} has been cancelled due to client payment issues.`,
              data: {
                appointmentId: appointment.id,
                date: appointment.date,
                reason: "client_payment_failed",
              },
              relatedAppointmentId: appointment.id,
            });

            // Email notification
            const cleanerEmail = cleaner.notificationEmail || cleaner.email;
            if (cleanerEmail) {
              const decryptedEmail = EncryptionService.decrypt(cleanerEmail);
              await Email.sendJobCancelledPaymentIssue(
                decryptedEmail,
                cleanerFirstName,
                appointment.date,
                homeAddress
              );
            }

            // Push notification
            if (cleaner.expoPushToken) {
              await PushNotification.sendPushNotification(
                cleaner.expoPushToken,
                "Job Cancelled",
                `The cleaning on ${appointment.date} has been cancelled due to payment issues.`,
                { appointmentId: appointment.id, type: "appointment_cancelled_payment" }
              );
            }
          }
        } catch (cleanerError) {
          console.error(
            `[PaymentRetryMonitor] Error notifying cleaner ${cleanerId}:`,
            cleanerError.message
          );
        }
      }
    }

    // Notify business owners that the job has been cancelled
    await notifyBusinessOwnersOfPaymentIssue(appointment, homeAddress, "cancelled", io);

    // Emit socket event
    if (io) {
      io.to(`user_${homeowner?.id}`).emit("appointmentCancelled", {
        appointmentId: appointment.id,
        reason: "payment_failed",
      });
    }

    // Check for repeated payment failures (3+ in 3 months) - issue warning
    if (homeowner) {
      try {
        const threeMonthsAgo = new Date();
        threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);

        // Count payment failure cancellations for this homeowner in the last 3 months
        const paymentFailureCancellations = await UserAppointments.count({
          where: {
            userId: homeowner.id,
            wasCancelled: true,
            cancellationReason: "payment_failed",
            cancelledAt: { [Op.gte]: threeMonthsAgo },
          },
        });

        // If 3 or more payment failures, issue warning (auto-freeze after 3 warnings)
        if (paymentFailureCancellations >= 3) {
          const result = await HomeownerFreezeService.checkAndWarnHomeowner(
            homeowner.id,
            "payment_failure",
            0, // System-triggered
            io
          );

          if (result.frozen) {
            console.log(
              `[PaymentRetryMonitor] Homeowner ${homeowner.id} auto-frozen after ${paymentFailureCancellations} payment failures`
            );
          } else if (result.warned) {
            console.log(
              `[PaymentRetryMonitor] Warning issued to homeowner ${homeowner.id} for repeated payment failures (${paymentFailureCancellations} failures, warning ${result.warningCount}/3)`
            );
          }
        }
      } catch (warnError) {
        console.error(
          `[PaymentRetryMonitor] Error checking payment failure warnings for homeowner ${homeowner.id}:`,
          warnError.message
        );
      }
    }
  } catch (error) {
    console.error(
      `[PaymentRetryMonitor] Error auto-cancelling appointment ${appointment.id}:`,
      error.message
    );
    throw error;
  }
}

/**
 * Notify homeowner and cleaner of successful payment retry
 */
async function notifyPaymentSuccess(appointment, homeowner, io) {
  const homeownerFirstName = homeowner.firstName
    ? EncryptionService.decrypt(homeowner.firstName)
    : "Valued Customer";

  const home = appointment.home;
  const homeAddress = home
    ? `${EncryptionService.decrypt(home.address)}, ${EncryptionService.decrypt(home.city)}`
    : "the property";

  // In-app notification for homeowner
  await NotificationService.createNotification({
    userId: homeowner.id,
    type: "payment_retry_success",
    title: "Payment Successful",
    body: `Great news! Your payment for the cleaning on ${appointment.date} has been processed successfully.`,
    data: {
      appointmentId: appointment.id,
      date: appointment.date,
    },
    relatedAppointmentId: appointment.id,
  });

  // Email notification for homeowner
  const homeownerEmail = homeowner.notificationEmail || homeowner.email;
  if (homeownerEmail) {
    const decryptedEmail = EncryptionService.decrypt(homeownerEmail);
    await Email.sendPaymentRetrySuccess(
      decryptedEmail,
      homeownerFirstName,
      appointment.date
    );
  }

  // Push notification for homeowner
  if (homeowner.expoPushToken) {
    await PushNotification.sendPushNotification(
      homeowner.expoPushToken,
      "Payment Successful",
      `Your payment for ${appointment.date} has been processed.`,
      { appointmentId: appointment.id, type: "payment_retry_success" }
    );
  }

  // Notify assigned cleaner(s) that payment issue is resolved
  if (appointment.employeesAssigned && appointment.employeesAssigned.length > 0) {
    for (const cleanerId of appointment.employeesAssigned) {
      try {
        const cleaner = await User.findByPk(cleanerId);
        if (cleaner) {
          // In-app notification for cleaner
          await NotificationService.createNotification({
            userId: cleaner.id,
            type: "payment_retry_success",
            title: "Payment Issue Resolved",
            body: `Good news! The payment issue for the job on ${appointment.date} at ${homeAddress} has been resolved. The job is confirmed.`,
            data: {
              appointmentId: appointment.id,
              date: appointment.date,
            },
            relatedAppointmentId: appointment.id,
          });

          // Push notification for cleaner
          if (cleaner.expoPushToken) {
            await PushNotification.sendPushNotification(
              cleaner.expoPushToken,
              "Payment Issue Resolved",
              `Job on ${appointment.date} is confirmed - payment resolved!`,
              { appointmentId: appointment.id, type: "payment_retry_success" }
            );
          }
        }
      } catch (cleanerError) {
        console.error(
          `[PaymentRetryMonitor] Error notifying cleaner ${cleanerId} of success:`,
          cleanerError.message
        );
      }
    }
  }

  // Notify business owners that payment issue is resolved
  await notifyBusinessOwnersOfPaymentIssue(appointment, homeAddress, "success", io);

  // Emit socket event
  if (io) {
    io.to(`user_${homeowner.id}`).emit("paymentSuccess", {
      appointmentId: appointment.id,
    });
  }
}

/**
 * Notify homeowner of failed payment retry
 */
async function notifyPaymentRetryFailed(appointment, homeowner, io) {
  const hoursSinceFirstFailure = appointment.paymentFirstFailedAt
    ? (new Date() - new Date(appointment.paymentFirstFailedAt)) / (1000 * 60 * 60)
    : 0;
  const hoursRemaining = Math.max(0, Math.ceil(AUTO_CANCEL_HOURS - hoursSinceFirstFailure));

  const homeownerFirstName = homeowner.firstName
    ? EncryptionService.decrypt(homeowner.firstName)
    : "Valued Customer";

  const homeAddress = appointment.home
    ? `${EncryptionService.decrypt(appointment.home.address)}, ${EncryptionService.decrypt(appointment.home.city)}`
    : "your property";

  // In-app notification
  await NotificationService.createNotification({
    userId: homeowner.id,
    type: "payment_retry_failed",
    title: "Payment Failed - Action Required",
    body: `We were unable to process payment for your cleaning on ${appointment.date}. Please update your payment method within ${hoursRemaining} hours to avoid cancellation.`,
    data: {
      appointmentId: appointment.id,
      date: appointment.date,
      hoursRemaining,
      retryCount: appointment.paymentRetryCount,
    },
    actionRequired: true,
    relatedAppointmentId: appointment.id,
  });

  // Email notification
  const homeownerEmail = homeowner.notificationEmail || homeowner.email;
  if (homeownerEmail) {
    const decryptedEmail = EncryptionService.decrypt(homeownerEmail);
    await Email.sendPaymentRetryFailed(
      decryptedEmail,
      homeownerFirstName,
      appointment.date,
      homeAddress,
      hoursRemaining,
      appointment.paymentRetryCount + 1
    );
  }

  // Push notification
  if (homeowner.expoPushToken) {
    await PushNotification.sendPushNotification(
      homeowner.expoPushToken,
      "Payment Failed - Update Required",
      `Payment failed for ${appointment.date}. Update payment method within ${hoursRemaining}h.`,
      { appointmentId: appointment.id, type: "payment_retry_failed" }
    );
  }

  // Emit socket event
  if (io) {
    io.to(`user_${homeowner.id}`).emit("paymentFailed", {
      appointmentId: appointment.id,
      hoursRemaining,
    });
  }
}

/**
 * Initial notification when payment first fails
 * Called from outside this module when a payment capture initially fails
 */
async function notifyInitialPaymentFailure(appointment, io = null) {
  try {
    // Ensure first failure timestamp is set (may already be set by caller)
    if (!appointment.paymentFirstFailedAt) {
      await appointment.update({
        paymentFirstFailedAt: new Date(),
        paymentCaptureFailed: true,
      });
    }

    const homeowner = await User.findByPk(appointment.userId);
    if (!homeowner) {
      console.error(
        `[PaymentRetryMonitor] No homeowner found for appointment ${appointment.id}`
      );
      return;
    }

    const home = await UserHomes.findByPk(appointment.homeId);
    const homeAddress = home
      ? `${EncryptionService.decrypt(home.address)}, ${EncryptionService.decrypt(home.city)}`
      : "your property";

    const homeownerFirstName = homeowner.firstName
      ? EncryptionService.decrypt(homeowner.firstName)
      : "Valued Customer";

    // In-app notification
    await NotificationService.createNotification({
      userId: homeowner.id,
      type: "payment_failed",
      title: "Payment Failed - Action Required",
      body: `We were unable to process payment for your cleaning on ${appointment.date}. Please update your payment method to avoid cancellation. We'll retry automatically over the next 48 hours.`,
      data: {
        appointmentId: appointment.id,
        date: appointment.date,
        hoursRemaining: AUTO_CANCEL_HOURS,
      },
      actionRequired: true,
      relatedAppointmentId: appointment.id,
    });

    // Email notification
    const homeownerEmail = homeowner.notificationEmail || homeowner.email;
    if (homeownerEmail) {
      const decryptedEmail = EncryptionService.decrypt(homeownerEmail);
      await Email.sendPaymentFailed(
        decryptedEmail,
        homeownerFirstName,
        appointment.date,
        homeAddress,
        AUTO_CANCEL_HOURS
      );
    }

    // Push notification
    if (homeowner.expoPushToken) {
      await PushNotification.sendPushNotification(
        homeowner.expoPushToken,
        "Payment Failed - Update Required",
        `Payment failed for ${appointment.date}. Please update your payment method.`,
        { appointmentId: appointment.id, type: "payment_failed" }
      );
    }

    // Notify assigned cleaner(s) about the payment issue
    if (appointment.employeesAssigned && appointment.employeesAssigned.length > 0) {
      for (const cleanerId of appointment.employeesAssigned) {
        try {
          const cleaner = await User.findByPk(cleanerId);
          if (cleaner) {
            const cleanerFirstName = cleaner.firstName
              ? EncryptionService.decrypt(cleaner.firstName)
              : "Cleaner";

            // In-app notification for cleaner
            await NotificationService.createNotification({
              userId: cleaner.id,
              type: "payment_failed",
              title: "Job Payment Issue",
              body: `There's a payment issue with the cleaning job on ${appointment.date} at ${homeAddress}. We're working to resolve it. The job may be cancelled if payment isn't resolved within 48 hours.`,
              data: {
                appointmentId: appointment.id,
                date: appointment.date,
                hoursRemaining: AUTO_CANCEL_HOURS,
              },
              relatedAppointmentId: appointment.id,
            });

            // Push notification for cleaner
            if (cleaner.expoPushToken) {
              await PushNotification.sendPushNotification(
                cleaner.expoPushToken,
                "Job Payment Issue",
                `Payment issue for job on ${appointment.date}. May be cancelled if not resolved.`,
                { appointmentId: appointment.id, type: "payment_failed" }
              );
            }
          }
        } catch (cleanerError) {
          console.error(
            `[PaymentRetryMonitor] Error notifying cleaner ${cleanerId}:`,
            cleanerError.message
          );
        }
      }
    }

    // Notify business owners who have employees assigned to this job
    await notifyBusinessOwnersOfPaymentIssue(appointment, homeAddress, "initial", io);

    // Emit socket event
    if (io) {
      io.to(`user_${homeowner.id}`).emit("paymentFailed", {
        appointmentId: appointment.id,
        hoursRemaining: AUTO_CANCEL_HOURS,
      });
    }

    console.log(
      `[PaymentRetryMonitor] Sent initial payment failure notification for appointment ${appointment.id}`
    );
  } catch (error) {
    console.error(
      `[PaymentRetryMonitor] Error sending initial failure notification:`,
      error.message
    );
  }
}

/**
 * Notify business owners who have employees assigned to this job about payment issues
 * @param {Object} appointment - The appointment with payment issue
 * @param {string} homeAddress - Human-readable address
 * @param {string} eventType - "initial", "success", "cancelled"
 * @param {Object} io - Socket.io instance
 */
async function notifyBusinessOwnersOfPaymentIssue(appointment, homeAddress, eventType, io) {
  try {
    // Find all business owner assignments for this appointment
    const assignments = await EmployeeJobAssignment.findAll({
      where: {
        appointmentId: appointment.id,
        status: { [Op.notIn]: ["cancelled", "unassigned"] },
      },
      attributes: ["businessOwnerId"],
      group: ["businessOwnerId"],
    });

    if (!assignments || assignments.length === 0) {
      return; // No business owners assigned to this job
    }

    // Get unique business owner IDs
    const businessOwnerIds = [...new Set(assignments.map(a => a.businessOwnerId))];

    for (const businessOwnerId of businessOwnerIds) {
      try {
        const businessOwner = await User.findByPk(businessOwnerId);
        if (!businessOwner) continue;

        const ownerFirstName = businessOwner.firstName
          ? EncryptionService.decrypt(businessOwner.firstName)
          : "Business Owner";

        let notificationTitle, notificationBody, pushTitle, pushBody;

        if (eventType === "initial") {
          notificationTitle = "Client Payment Issue - Job at Risk";
          notificationBody = `Payment failed for the job on ${appointment.date} at ${homeAddress}. The client has been notified. The job may be cancelled if not resolved within 48 hours.`;
          pushTitle = "Job Payment Issue";
          pushBody = `Payment failed for job on ${appointment.date}. May be cancelled.`;
        } else if (eventType === "success") {
          notificationTitle = "Payment Issue Resolved";
          notificationBody = `The payment issue for the job on ${appointment.date} at ${homeAddress} has been resolved. The job will proceed as scheduled.`;
          pushTitle = "Payment Resolved";
          pushBody = `Payment resolved for job on ${appointment.date}.`;
        } else if (eventType === "cancelled") {
          notificationTitle = "Job Cancelled - Payment Failed";
          notificationBody = `The job on ${appointment.date} at ${homeAddress} has been cancelled due to unresolved payment issues. The assignment has been removed.`;
          pushTitle = "Job Cancelled";
          pushBody = `Job on ${appointment.date} cancelled due to payment failure.`;
        }

        // In-app notification for business owner
        await NotificationService.createNotification({
          userId: businessOwner.id,
          type: eventType === "success" ? "payment_resolved" : "payment_failed",
          title: notificationTitle,
          body: notificationBody,
          data: {
            appointmentId: appointment.id,
            date: appointment.date,
            eventType,
          },
          relatedAppointmentId: appointment.id,
        });

        // Push notification for business owner
        if (businessOwner.expoPushToken) {
          await PushNotification.sendPushNotification(
            businessOwner.expoPushToken,
            pushTitle,
            pushBody,
            { appointmentId: appointment.id, type: `payment_${eventType}` }
          );
        }

        // Socket event for real-time update
        if (io) {
          io.to(`user_${businessOwner.id}`).emit(
            eventType === "success" ? "paymentResolved" : "paymentFailed",
            {
              appointmentId: appointment.id,
              eventType,
            }
          );
        }
      } catch (ownerError) {
        console.error(
          `[PaymentRetryMonitor] Error notifying business owner ${businessOwnerId}:`,
          ownerError.message
        );
      }
    }
  } catch (error) {
    console.error(
      `[PaymentRetryMonitor] Error notifying business owners:`,
      error.message
    );
  }
}

/**
 * Start the payment retry monitor cron job
 * @param {Object} io - Socket.io instance
 * @param {number} intervalMs - Interval in milliseconds (default: 4 hours)
 */
function startPaymentRetryMonitor(io, intervalMs = 4 * 60 * 60 * 1000) {
  console.log(
    `[PaymentRetryMonitor] Starting with interval: ${intervalMs / 1000 / 60} minutes`
  );

  // Run immediately on startup
  setTimeout(() => {
    processFailedPayments(io).catch((err) => {
      console.error("[PaymentRetryMonitor] Initial run failed:", err.message);
    });
  }, 30000); // 30 second delay for startup

  // Then run on interval
  setInterval(() => {
    processFailedPayments(io).catch((err) => {
      console.error("[PaymentRetryMonitor] Scheduled run failed:", err.message);
    });
  }, intervalMs);
}

module.exports = {
  processFailedPayments,
  notifyInitialPaymentFailure,
  startPaymentRetryMonitor,
  AUTO_CANCEL_HOURS,
};
