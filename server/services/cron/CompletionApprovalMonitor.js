/**
 * Completion Approval Monitor
 *
 * Handles the 2-step completion confirmation flow:
 * - Processes auto-approvals when homeowner doesn't respond within the configured time
 * - Triggers payouts after approval
 * - Sends notifications to homeowners and cleaners
 */

const { Op } = require("sequelize");
const {
  UserAppointments,
  CleanerJobCompletion,
  User,
  UserHomes,
  PricingConfig,
} = require("../../models");
const NotificationService = require("../NotificationService");
const EncryptionService = require("../EncryptionService");
const Email = require("../sendNotifications/EmailClass");
const PushNotification = require("../sendNotifications/PushNotificationClass");

/**
 * Process auto-approvals for single-cleaner jobs
 * Finds appointments where:
 * - completionStatus === 'submitted'
 * - autoApprovalExpiresAt < now
 * - completed === false (payout not yet sent)
 */
async function processAutoApprovalsSingleCleaner(io = null) {
  const now = new Date();
  let processed = 0;
  let errors = 0;

  try {
    const expiredApprovals = await UserAppointments.findAll({
      where: {
        completionStatus: "submitted",
        autoApprovalExpiresAt: { [Op.lt]: now },
        completed: false,
        isMultiCleanerJob: false,
      },
      include: [
        {
          model: User,
          as: "user",
          attributes: ["id", "firstName", "lastName", "email", "expoPushToken", "notifications"],
        },
        {
          model: UserHomes,
          as: "home",
          attributes: ["id", "address", "city"],
        },
      ],
    });

    console.log(
      `[CompletionApprovalMonitor] Found ${expiredApprovals.length} single-cleaner auto-approvals to process`
    );

    for (const appointment of expiredApprovals) {
      try {
        // Get cleaner info
        const cleanerIds = appointment.employeesAssigned || [];
        const cleanerId = cleanerIds[0];
        const cleaner = cleanerId ? await User.findByPk(cleanerId) : null;

        // Auto-approve
        await appointment.update({
          completionStatus: "auto_approved",
          completionApprovedAt: now,
          completionApprovedBy: null, // null = system auto-approved
          completed: true,
        });

        // Notify homeowner
        if (appointment.user) {
          const homeownerFirstName = EncryptionService.decrypt(appointment.user.firstName);
          const homeAddress = appointment.home
            ? `${EncryptionService.decrypt(appointment.home.address)}, ${EncryptionService.decrypt(appointment.home.city)}`
            : "your home";
          const cleanerName = cleaner
            ? EncryptionService.decrypt(cleaner.firstName)
            : "Your cleaner";

          // In-app notification
          await NotificationService.createNotification(
            appointment.userId,
            `Your cleaning on ${appointment.date} has been auto-approved. Payment sent to ${cleanerName}.`
          );

          // Email notification
          const homeownerEmail = appointment.user.email
            ? EncryptionService.decrypt(appointment.user.email)
            : null;
          if (homeownerEmail) {
            await Email.sendCompletionAutoApproved(
              homeownerEmail,
              homeownerFirstName,
              appointment.date,
              homeAddress,
              cleanerName
            );
          }

          // Push notification
          if (appointment.user.expoPushToken) {
            await PushNotification.sendPushCompletionAutoApproved(
              appointment.user.expoPushToken,
              appointment.date,
              "homeowner"
            );
          }
        }

        // Notify cleaner
        if (cleaner) {
          const cleanerFirstName = EncryptionService.decrypt(cleaner.firstName);

          // In-app notification
          await NotificationService.createNotification(
            cleanerId,
            `Your job completion for ${appointment.date} was approved! Payment is on the way.`
          );

          // Email notification
          const cleanerEmail = cleaner.email
            ? EncryptionService.decrypt(cleaner.email)
            : null;
          if (cleanerEmail) {
            await Email.sendCompletionApprovedCleaner(
              cleanerEmail,
              cleanerFirstName,
              appointment.date,
              appointment.price
            );
          }

          // Push notification
          if (cleaner.expoPushToken) {
            await PushNotification.sendPushCompletionApproved(
              cleaner.expoPushToken,
              appointment.date,
              appointment.price
            );
          }
        }

        processed++;
        console.log(
          `[CompletionApprovalMonitor] Auto-approved single-cleaner appointment ${appointment.id}`
        );
      } catch (error) {
        errors++;
        console.error(
          `[CompletionApprovalMonitor] Error processing single-cleaner appointment ${appointment.id}:`,
          error
        );
      }
    }

    return { processed, errors };
  } catch (error) {
    console.error("[CompletionApprovalMonitor] Error in processAutoApprovalsSingleCleaner:", error);
    return { processed, errors: errors + 1 };
  }
}

/**
 * Process auto-approvals for multi-cleaner jobs
 * Each cleaner's completion is handled independently
 */
async function processAutoApprovalsMultiCleaner(io = null) {
  const now = new Date();
  let processed = 0;
  let errors = 0;

  try {
    const expiredApprovals = await CleanerJobCompletion.findAll({
      where: {
        completionStatus: "submitted",
        autoApprovalExpiresAt: { [Op.lt]: now },
      },
      include: [
        {
          model: User,
          as: "cleaner",
          attributes: ["id", "firstName", "lastName", "email", "expoPushToken", "notifications"],
        },
        {
          model: UserAppointments,
          as: "appointment",
          include: [
            {
              model: User,
              as: "user",
              attributes: ["id", "firstName", "lastName", "email", "expoPushToken", "notifications"],
            },
            {
              model: UserHomes,
              as: "home",
              attributes: ["id", "address", "city"],
            },
          ],
        },
      ],
    });

    console.log(
      `[CompletionApprovalMonitor] Found ${expiredApprovals.length} multi-cleaner auto-approvals to process`
    );

    for (const completion of expiredApprovals) {
      try {
        const appointment = completion.appointment;
        const cleaner = completion.cleaner;
        const homeowner = appointment?.user;

        // Auto-approve this cleaner's completion
        await completion.update({
          completionStatus: "auto_approved",
          completionApprovedAt: now,
          completionApprovedBy: null, // null = system auto-approved
          status: "completed",
          completedAt: now,
        });

        const cleanerFirstName = cleaner
          ? EncryptionService.decrypt(cleaner.firstName)
          : "Cleaner";
        const homeAddress = appointment?.home
          ? `${EncryptionService.decrypt(appointment.home.address)}, ${EncryptionService.decrypt(appointment.home.city)}`
          : "the home";

        // Notify homeowner about this cleaner's auto-approval
        if (homeowner) {
          const homeownerFirstName = EncryptionService.decrypt(homeowner.firstName);

          // In-app notification
          await NotificationService.createNotification(
            homeowner.id,
            `${cleanerFirstName}'s work on ${appointment.date} has been auto-approved. Payment sent.`
          );

          // Email notification
          const homeownerEmail = homeowner.email
            ? EncryptionService.decrypt(homeowner.email)
            : null;
          if (homeownerEmail) {
            await Email.sendCompletionAutoApproved(
              homeownerEmail,
              homeownerFirstName,
              appointment.date,
              homeAddress,
              cleanerFirstName
            );
          }

          // Push notification
          if (homeowner.expoPushToken) {
            await PushNotification.sendPushCompletionAutoApproved(
              homeowner.expoPushToken,
              appointment.date,
              "homeowner"
            );
          }
        }

        // Notify cleaner
        if (cleaner) {
          // In-app notification
          await NotificationService.createNotification(
            cleaner.id,
            `Your work on ${appointment.date} was auto-approved! Payment is on the way.`
          );

          // Email notification
          const cleanerEmail = cleaner.email
            ? EncryptionService.decrypt(cleaner.email)
            : null;
          if (cleanerEmail) {
            await Email.sendCompletionApprovedCleaner(
              cleanerEmail,
              cleanerFirstName,
              appointment.date,
              null // Price calculated separately for multi-cleaner
            );
          }

          // Push notification
          if (cleaner.expoPushToken) {
            await PushNotification.sendPushCompletionApproved(
              cleaner.expoPushToken,
              appointment.date,
              null
            );
          }
        }

        processed++;
        console.log(
          `[CompletionApprovalMonitor] Auto-approved multi-cleaner completion ${completion.id} for cleaner ${completion.cleanerId}`
        );
      } catch (error) {
        errors++;
        console.error(
          `[CompletionApprovalMonitor] Error processing multi-cleaner completion ${completion.id}:`,
          error
        );
      }
    }

    return { processed, errors };
  } catch (error) {
    console.error("[CompletionApprovalMonitor] Error in processAutoApprovalsMultiCleaner:", error);
    return { processed, errors: errors + 1 };
  }
}

/**
 * Main function to process all auto-approvals
 */
async function processAutoApprovals(io = null) {
  console.log("[CompletionApprovalMonitor] Starting auto-approval processing...");

  const singleCleanerResults = await processAutoApprovalsSingleCleaner(io);
  const multiCleanerResults = await processAutoApprovalsMultiCleaner(io);

  const summary = {
    singleCleaner: singleCleanerResults,
    multiCleaner: multiCleanerResults,
    totalProcessed: singleCleanerResults.processed + multiCleanerResults.processed,
    totalErrors: singleCleanerResults.errors + multiCleanerResults.errors,
    timestamp: new Date().toISOString(),
  };

  console.log(
    `[CompletionApprovalMonitor] Completed. Processed: ${summary.totalProcessed}, Errors: ${summary.totalErrors}`
  );

  return summary;
}

/**
 * Get the configured auto-approval hours from PricingConfig
 */
async function getAutoApprovalHours() {
  const config = await PricingConfig.getActive();
  return config?.completionAutoApprovalHours || 4; // Default to 4 hours
}

/**
 * Calculate auto-approval expiration time
 */
async function calculateAutoApprovalExpiration() {
  const hours = await getAutoApprovalHours();
  return new Date(Date.now() + hours * 60 * 60 * 1000);
}

/**
 * Start the completion approval monitor as a recurring job
 * @param {Object} io - Socket.io instance for real-time notifications
 * @param {number} intervalMs - How often to check for auto-approvals (default: 15 minutes)
 */
function startCompletionApprovalMonitor(io = null, intervalMs = 15 * 60 * 1000) {
  console.log(
    `[CompletionApprovalMonitor] Starting monitor with ${intervalMs / 1000}s interval`
  );

  // Run immediately on start
  processAutoApprovals(io);

  // Then run at the specified interval
  const intervalId = setInterval(() => {
    processAutoApprovals(io);
  }, intervalMs);

  return intervalId;
}

module.exports = {
  processAutoApprovals,
  processAutoApprovalsSingleCleaner,
  processAutoApprovalsMultiCleaner,
  getAutoApprovalHours,
  calculateAutoApprovalExpiration,
  startCompletionApprovalMonitor,
};
