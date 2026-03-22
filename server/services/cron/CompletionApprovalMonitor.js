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
  EmployeeJobAssignment,
  BusinessEmployee,
  Payment,
  sequelize,
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
// Circuit breaker configuration
const CIRCUIT_BREAKER_THRESHOLD = 5; // Stop after 5 consecutive errors
const CIRCUIT_BREAKER_RESET_MS = 5 * 60 * 1000; // 5 minute cool-down

// Circuit breaker state (in-memory, resets on process restart)
let circuitBreakerState = {
  consecutiveErrors: 0,
  lastError: null,
  circuitOpen: false,
  circuitOpenedAt: null,
};

function resetCircuitBreaker() {
  circuitBreakerState = {
    consecutiveErrors: 0,
    lastError: null,
    circuitOpen: false,
    circuitOpenedAt: null,
  };
}

function checkCircuitBreaker() {
  if (!circuitBreakerState.circuitOpen) return true;

  // Check if cool-down period has passed
  const now = Date.now();
  if (now - circuitBreakerState.circuitOpenedAt > CIRCUIT_BREAKER_RESET_MS) {
    console.log("[CompletionApprovalMonitor] Circuit breaker reset after cool-down period");
    resetCircuitBreaker();
    return true;
  }

  return false;
}

function recordError(error) {
  circuitBreakerState.consecutiveErrors++;
  circuitBreakerState.lastError = error.message;

  if (circuitBreakerState.consecutiveErrors >= CIRCUIT_BREAKER_THRESHOLD) {
    circuitBreakerState.circuitOpen = true;
    circuitBreakerState.circuitOpenedAt = Date.now();
    console.error(`[CompletionApprovalMonitor] CRITICAL: Circuit breaker opened after ${CIRCUIT_BREAKER_THRESHOLD} consecutive errors. Last error: ${error.message}`);
    console.error("[CompletionApprovalMonitor] Processing halted - manual intervention may be required");
    return false; // Signal to stop processing
  }
  return true; // Continue processing
}

function recordSuccess() {
  // Reset consecutive errors on success
  circuitBreakerState.consecutiveErrors = 0;
}

async function processAutoApprovalsSingleCleaner(io = null) {
  const now = new Date();
  let processed = 0;
  let errors = 0;

  // Check circuit breaker before starting
  if (!checkCircuitBreaker()) {
    console.warn("[CompletionApprovalMonitor] Circuit breaker is open - skipping processing");
    return { processed: 0, errors: 0, circuitBreakerOpen: true };
  }

  try {
    const expiredApprovals = await UserAppointments.findAll({
      where: {
        completionStatus: "submitted",
        autoApprovalExpiresAt: { [Op.lt]: now },
        completed: false,
        isMultiCleanerJob: false,
        isPaused: { [Op.ne]: true }, // Skip paused appointments (homeowner frozen)
        wasCancelled: { [Op.ne]: true }, // Skip cancelled appointments
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
      // Use transaction with row-level locking to prevent race conditions
      // between auto-approval and manual approval
      const t = await sequelize.transaction();

      try {
        // Re-fetch appointment with exclusive lock to ensure it hasn't been approved
        const lockedAppointment = await UserAppointments.findByPk(appointment.id, {
          lock: t.LOCK.UPDATE,
          transaction: t,
        });

        // Check if already approved by homeowner (race condition check)
        if (!lockedAppointment ||
            lockedAppointment.completionStatus !== "submitted" ||
            lockedAppointment.completed === true) {
          await t.rollback();
          console.log(
            `[CompletionApprovalMonitor] Appointment ${appointment.id} already approved, skipping`
          );
          continue;
        }

        // Get cleaner info
        const cleanerIds = lockedAppointment.employeesAssigned || [];
        const cleanerId = cleanerIds[0];
        const cleaner = cleanerId ? await User.findByPk(cleanerId) : null;

        // Auto-approve within transaction
        await lockedAppointment.update({
          completionStatus: "auto_approved",
          completionApprovedAt: now,
          completionApprovedBy: null, // null = system auto-approved
          completed: true,
        }, { transaction: t });

        // Commit the approval status change before processing payout
        await t.commit();

        // Audit logging for auto-approval
        console.log(`[CompletionApprovalMonitor] Auto-approval audit:`, {
          appointmentId: appointment.id,
          approvedAt: now.toISOString(),
          completionStatus: "auto_approved",
          approvalType: "auto",
          expirationTime: appointment.autoApprovalExpiresAt,
        });

        // Create audit trail record
        try {
          await Payment.create({
            transactionId: Payment.generateTransactionId(),
            type: "approval",
            status: "succeeded",
            amount: appointment.price,
            userId: appointment.userId,
            appointmentId: appointment.id,
            currency: "usd",
            taxYear: new Date().getFullYear(),
            reportable: false,
            description: `Auto-approval for appointment ${appointment.id} after expiration window`,
            metadata: {
              approvalType: "auto",
              approvedAt: now.toISOString(),
              expirationTime: appointment.autoApprovalExpiresAt?.toISOString(),
              previousStatus: "submitted",
            },
            processedAt: now,
          });
        } catch (auditError) {
          console.error(`[CompletionApprovalMonitor] Failed to create audit record:`, auditError);
        }

        // Process payout to cleaner(s) - has its own transaction/locking
        let payoutSuccess = false;
        try {
          const { processSingleCleanerPayout } = require("./payoutHelpers");
          const payoutResults = await processSingleCleanerPayout(lockedAppointment);

          // Check if at least one payout succeeded
          payoutSuccess = payoutResults.some(r => r.status === "success");

          for (const result of payoutResults) {
            if (result.status === "success") {
              console.log(
                `[CompletionApprovalMonitor] Payout processed for cleaner ${result.cleanerId} on appointment ${appointment.id}`
              );
            } else if (result.status === "skipped") {
              console.warn(
                `[CompletionApprovalMonitor] Payout skipped for cleaner ${result.cleanerId}: ${result.reason}`
              );
            } else if (result.status === "failed") {
              console.error(
                `[CompletionApprovalMonitor] Payout failed for cleaner ${result.cleanerId}: ${result.error}`,
                { reason: result.reason, canRetry: result.canRetry }
              );
            } else if (result.status === "already_paid") {
              console.log(
                `[CompletionApprovalMonitor] Cleaner ${result.cleanerId} already paid for appointment ${appointment.id}`
              );
              payoutSuccess = true; // Already paid counts as success
            }
          }
        } catch (payoutError) {
          console.error(
            `[CompletionApprovalMonitor] Unexpected payout error for appointment ${appointment.id}:`,
            payoutError
          );
        }

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
          await NotificationService.createNotification({
            userId: appointment.userId,
            type: "completion_auto_approved",
            title: "Cleaning Auto-Approved",
            body: `Your cleaning on ${appointment.date} has been auto-approved. Payment sent to ${cleanerName}.`,
            data: { appointmentId: appointment.id, cleanerName },
            relatedAppointmentId: appointment.id,
          });

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
          await NotificationService.createNotification({
            userId: cleanerId,
            type: "completion_approved_cleaner",
            title: "Job Approved!",
            body: `Your job completion for ${appointment.date} was approved! Payment is on the way.`,
            data: { appointmentId: appointment.id, appointmentDate: appointment.date, price: appointment.price },
            relatedAppointmentId: appointment.id,
          });

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

        // Notify business owner if an employee completed this job
        try {
          const employeeAssignment = await EmployeeJobAssignment.findOne({
            where: {
              appointmentId: appointment.id,
              isSelfAssignment: false,
            },
            include: [{
              model: BusinessEmployee,
              as: "employee",
              attributes: ["id", "userId"],
              include: [{
                model: User,
                as: "user",
                attributes: ["id", "firstName"],
              }],
            }],
          });

          if (employeeAssignment && employeeAssignment.businessOwnerId) {
            const businessOwner = await User.findByPk(employeeAssignment.businessOwnerId);

            if (businessOwner) {
              const employeeName = employeeAssignment.employee?.user?.firstName
                ? EncryptionService.decrypt(employeeAssignment.employee.user.firstName)
                : "Your employee";
              const clientName = appointment.user
                ? EncryptionService.decrypt(appointment.user.firstName)
                : "your client";

              // In-app notification for business owner
              await NotificationService.createNotification({
                userId: businessOwner.id,
                type: "employee_job_auto_approved",
                title: "Employee Job Auto-Approved",
                body: `${employeeName}'s job for ${clientName} on ${appointment.date} was auto-approved. Payment sent.`,
                data: { appointmentId: appointment.id, employeeName, clientName },
                relatedAppointmentId: appointment.id,
              });

              // Push notification to business owner
              if (businessOwner.expoPushToken) {
                await PushNotification.sendPushNotification(
                  businessOwner.expoPushToken,
                  "Job Auto-Approved",
                  `${employeeName}'s cleaning for ${clientName} was approved. Payment sent.`,
                  { appointmentId: appointment.id, type: "employee_job_approved" }
                );
              }

              console.log(
                `[CompletionApprovalMonitor] Business owner ${businessOwner.id} notified of employee job auto-approval`
              );
            }
          }
        } catch (businessNotificationError) {
          console.error(
            `[CompletionApprovalMonitor] Error notifying business owner:`,
            businessNotificationError
          );
        }

        processed++;
        recordSuccess(); // Reset circuit breaker on success
        console.log(
          `[CompletionApprovalMonitor] Auto-approved single-cleaner appointment ${appointment.id}`
        );
      } catch (error) {
        // Rollback transaction if it hasn't been committed yet
        if (t && !t.finished) {
          await t.rollback();
        }
        errors++;
        console.error(
          `[CompletionApprovalMonitor] Error processing single-cleaner appointment ${appointment.id}:`,
          error
        );

        // Check circuit breaker - stop processing if threshold exceeded
        if (!recordError(error)) {
          console.error("[CompletionApprovalMonitor] Circuit breaker tripped - stopping single-cleaner processing");
          return { processed, errors, circuitBreakerTripped: true };
        }
      }
    }

    return { processed, errors };
  } catch (error) {
    console.error("[CompletionApprovalMonitor] Error in processAutoApprovalsSingleCleaner:", error);
    recordError(error); // Track fatal errors too
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

        // Skip if appointment is paused or cancelled
        if (appointment?.isPaused || appointment?.wasCancelled) {
          console.log(
            `[CompletionApprovalMonitor] Skipping auto-approval for completion ${completion.id} - appointment ${appointment.id} is paused or cancelled`
          );
          continue;
        }

        // Auto-approve this cleaner's completion
        await completion.update({
          completionStatus: "auto_approved",
          completionApprovedAt: now,
          completionApprovedBy: null, // null = system auto-approved
          status: "completed",
          completedAt: now,
        });

        // Process payout for this cleaner
        try {
          const { processMultiCleanerPayoutForCleaner } = require("./payoutHelpers");
          const payoutResult = await processMultiCleanerPayoutForCleaner(appointment, completion.cleanerId);

          if (payoutResult.status === "success") {
            console.log(
              `[CompletionApprovalMonitor] Payout processed for cleaner ${completion.cleanerId} on appointment ${appointment.id}`
            );
          } else if (payoutResult.status === "skipped") {
            console.warn(
              `[CompletionApprovalMonitor] Payout skipped for cleaner ${completion.cleanerId}: ${payoutResult.reason}`
            );
          } else if (payoutResult.status === "failed") {
            console.error(
              `[CompletionApprovalMonitor] Payout failed for cleaner ${completion.cleanerId}: ${payoutResult.error}`,
              { reason: payoutResult.reason, canRetry: payoutResult.canRetry }
            );
          } else if (payoutResult.status === "already_paid") {
            console.log(
              `[CompletionApprovalMonitor] Cleaner ${completion.cleanerId} already paid for appointment ${appointment.id}`
            );
          }
        } catch (payoutError) {
          console.error(
            `[CompletionApprovalMonitor] Unexpected payout error for cleaner ${completion.cleanerId}:`,
            payoutError
          );
        }

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
          await NotificationService.createNotification({
            userId: homeowner.id,
            type: "completion_auto_approved",
            title: "Cleaning Auto-Approved",
            body: `${cleanerFirstName}'s work on ${appointment.date} has been auto-approved. Payment sent.`,
            data: { appointmentId: appointment.id, cleanerId: cleaner.id, cleanerName: cleanerFirstName },
            relatedAppointmentId: appointment.id,
          });

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
          await NotificationService.createNotification({
            userId: cleaner.id,
            type: "completion_approved_cleaner",
            title: "Work Approved!",
            body: `Your work on ${appointment.date} was auto-approved! Payment is on the way.`,
            data: { appointmentId: appointment.id, appointmentDate: appointment.date },
            relatedAppointmentId: appointment.id,
          });

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

        // Check if all cleaners in this job are now approved - if so, mark parent appointment as completed
        await checkAndUpdateParentAppointmentCompletion(appointment.id);

        processed++;
        recordSuccess(); // Reset circuit breaker on success
        console.log(
          `[CompletionApprovalMonitor] Auto-approved multi-cleaner completion ${completion.id} for cleaner ${completion.cleanerId}`
        );
      } catch (error) {
        errors++;
        console.error(
          `[CompletionApprovalMonitor] Error processing multi-cleaner completion ${completion.id}:`,
          error
        );

        // Check circuit breaker - stop processing if threshold exceeded
        if (!recordError(error)) {
          console.error("[CompletionApprovalMonitor] Circuit breaker tripped - stopping multi-cleaner processing");
          return { processed, errors, circuitBreakerTripped: true };
        }
      }
    }

    return { processed, errors };
  } catch (error) {
    console.error("[CompletionApprovalMonitor] Error in processAutoApprovalsMultiCleaner:", error);
    recordError(error); // Track fatal errors too
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

/**
 * Check if all cleaners in a multi-cleaner job have been approved
 * If so, mark the parent appointment as completed
 */
async function checkAndUpdateParentAppointmentCompletion(appointmentId) {
  const { Op } = require("sequelize");

  try {
    const appointment = await UserAppointments.findByPk(appointmentId);

    if (!appointment || !appointment.isMultiCleanerJob) {
      return false;
    }

    // Get all completion records for this appointment (excluding dropped/no-show)
    const completions = await CleanerJobCompletion.findAll({
      where: {
        appointmentId,
        status: { [Op.notIn]: ["dropped_out", "no_show"] },
      },
    });

    if (completions.length === 0) {
      return false;
    }

    // Check if all active cleaners have been approved (approved or auto_approved)
    const allApproved = completions.every(
      (c) => c.completionStatus === "approved" || c.completionStatus === "auto_approved"
    );

    if (allApproved && !appointment.completed) {
      // All cleaners are done - mark parent appointment as completed
      await appointment.update({
        completed: true,
        completionStatus: "auto_approved",
        completionApprovedAt: new Date(),
      });

      console.log(`[CompletionApprovalMonitor] All cleaners approved for multi-cleaner appointment ${appointmentId} - marked as completed`);
      return true;
    }

    return false;
  } catch (error) {
    console.error(`[CompletionApprovalMonitor] Error checking parent appointment completion for ${appointmentId}:`, error);
    return false;
  }
}

module.exports = {
  processAutoApprovals,
  processAutoApprovalsSingleCleaner,
  processAutoApprovalsMultiCleaner,
  getAutoApprovalHours,
  calculateAutoApprovalExpiration,
  startCompletionApprovalMonitor,
};
