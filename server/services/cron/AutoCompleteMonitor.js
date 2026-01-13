/**
 * Auto-Complete Monitor
 *
 * Handles auto-completion when cleaners forget to mark jobs complete:
 * - Sends reminder notifications at configured intervals after scheduled end
 * - Auto-completes jobs after the configured hours past scheduled end
 * - Works for both single-cleaner and multi-cleaner jobs
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
 * Parse time window string to get start and end hours
 * @param {string} timeWindow - Time window string like "anytime", "10-3", "11-4", "12-2"
 * @returns {{ start: number, end: number }}
 */
function parseTimeWindow(timeWindow) {
  const windows = {
    anytime: { start: 8, end: 18 },
    "10-3": { start: 10, end: 15 },
    "11-4": { start: 11, end: 16 },
    "12-2": { start: 12, end: 14 },
  };
  return windows[timeWindow] || windows.anytime;
}

/**
 * Calculate the scheduled end time from date and time window
 * @param {string} dateStr - Date string (YYYY-MM-DD)
 * @param {string} timeWindow - Time window string
 * @returns {Date}
 */
function calculateScheduledEndTime(dateStr, timeWindow) {
  const { end } = parseTimeWindow(timeWindow);
  // Parse date as local time, not UTC
  const [year, month, day] = dateStr.split("-").map(Number);
  const endTime = new Date(year, month - 1, day, end, 0, 0);
  return endTime;
}

/**
 * Get auto-complete configuration from PricingConfig
 */
async function getAutoCompleteConfig() {
  const config = await PricingConfig.getActive();
  return {
    hoursAfterEnd: config?.autoCompleteHoursAfterEnd || 4,
    reminderIntervals: config?.autoCompleteReminderIntervals || [30, 60, 120, 180, 210],
    autoApprovalHours: config?.completionAutoApprovalHours || 24,
  };
}

/**
 * Get the reminder number based on minutes passed since scheduled end
 * @param {number} minutesPassed - Minutes since scheduled end
 * @param {number[]} intervals - Array of reminder intervals in minutes
 * @returns {number} Reminder number (1-5) or 0 if no reminder due
 */
function getReminderNumber(minutesPassed, intervals) {
  for (let i = intervals.length - 1; i >= 0; i--) {
    if (minutesPassed >= intervals[i]) {
      return i + 1;
    }
  }
  return 0;
}

/**
 * Calculate minutes remaining until auto-complete
 * @param {Date} autoCompleteAt - When auto-complete triggers
 * @returns {number}
 */
function getMinutesUntilAutoComplete(autoCompleteAt) {
  const remaining = new Date(autoCompleteAt).getTime() - Date.now();
  return Math.max(0, Math.floor(remaining / 60000));
}

/**
 * Process reminders for single-cleaner jobs
 */
async function processReminders(io = null) {
  const now = new Date();
  let remindersSent = 0;
  let errors = 0;

  try {
    const config = await getAutoCompleteConfig();

    // Find jobs that:
    // - Have completionStatus = 'in_progress' (not yet submitted)
    // - scheduledEndTime has passed
    // - autoCompleteAt has NOT passed yet (we're in the reminder window)
    const jobsNeedingReminders = await UserAppointments.findAll({
      where: {
        completionStatus: "in_progress",
        scheduledEndTime: { [Op.lt]: now },
        autoCompleteAt: { [Op.gt]: now },
        completed: false,
        wasCancelled: false,
        hasBeenAssigned: true,
        isMultiCleanerJob: false,
      },
      include: [
        {
          model: User,
          as: "user",
          attributes: ["id", "firstName", "lastName", "email"],
        },
        {
          model: UserHomes,
          as: "home",
          attributes: ["id", "address", "city"],
        },
      ],
    });

    console.log(
      `[AutoCompleteMonitor] Found ${jobsNeedingReminders.length} single-cleaner jobs to check for reminders`
    );

    for (const appointment of jobsNeedingReminders) {
      try {
        const scheduledEnd = new Date(appointment.scheduledEndTime);
        const minutesPassed = Math.floor((now.getTime() - scheduledEnd.getTime()) / 60000);
        const expectedReminderNum = getReminderNumber(minutesPassed, config.reminderIntervals);

        // Check if we should send a new reminder
        if (expectedReminderNum > appointment.autoCompleteRemindersSent) {
          // Get cleaner info
          const cleanerIds = appointment.employeesAssigned || [];
          const cleanerId = cleanerIds[0];
          const cleaner = cleanerId ? await User.findByPk(cleanerId) : null;

          if (!cleaner) {
            console.log(`[AutoCompleteMonitor] No cleaner found for appointment ${appointment.id}`);
            continue;
          }

          const cleanerFirstName = EncryptionService.decrypt(cleaner.firstName);
          const cleanerEmail = cleaner.email ? EncryptionService.decrypt(cleaner.email) : null;
          const homeAddress = appointment.home
            ? `${EncryptionService.decrypt(appointment.home.address)}, ${EncryptionService.decrypt(appointment.home.city)}`
            : "the home";
          const minutesLeft = getMinutesUntilAutoComplete(appointment.autoCompleteAt);

          // Send reminder via all channels
          // In-app notification
          await NotificationService.createNotification(
            cleanerId,
            getInAppReminderMessage(expectedReminderNum, appointment.date, minutesLeft),
            { appointmentId: appointment.id }
          );

          // Email notification
          if (cleanerEmail) {
            await Email.sendAutoCompleteReminder(
              cleanerEmail,
              cleanerFirstName,
              appointment.date,
              homeAddress,
              expectedReminderNum,
              minutesLeft
            );
          }

          // Push notification
          if (cleaner.expoPushToken) {
            await PushNotification.sendPushAutoCompleteReminder(
              cleaner.expoPushToken,
              appointment.date,
              homeAddress,
              expectedReminderNum,
              minutesLeft
            );
          }

          // Update reminder count
          await appointment.update({
            autoCompleteRemindersSent: expectedReminderNum,
            lastReminderSentAt: now,
          });

          remindersSent++;
          console.log(
            `[AutoCompleteMonitor] Sent reminder #${expectedReminderNum} for appointment ${appointment.id} to cleaner ${cleanerId}`
          );
        }
      } catch (error) {
        errors++;
        console.error(
          `[AutoCompleteMonitor] Error processing reminder for appointment ${appointment.id}:`,
          error
        );
      }
    }

    return { remindersSent, errors };
  } catch (error) {
    console.error("[AutoCompleteMonitor] Error in processReminders:", error);
    return { remindersSent, errors: errors + 1 };
  }
}

/**
 * Process reminders for multi-cleaner jobs
 */
async function processMultiCleanerReminders(io = null) {
  const now = new Date();
  let remindersSent = 0;
  let errors = 0;

  try {
    const config = await getAutoCompleteConfig();

    // Find individual cleaner completions that need reminders
    const completionsNeedingReminders = await CleanerJobCompletion.findAll({
      where: {
        completionStatus: "in_progress",
        autoCompleteAt: { [Op.gt]: now },
        status: { [Op.in]: ["assigned", "started"] }, // Not completed yet
      },
      include: [
        {
          model: User,
          as: "cleaner",
          attributes: ["id", "firstName", "lastName", "email", "expoPushToken"],
        },
        {
          model: UserAppointments,
          as: "appointment",
          where: {
            scheduledEndTime: { [Op.lt]: now },
            wasCancelled: false,
          },
          include: [
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
      `[AutoCompleteMonitor] Found ${completionsNeedingReminders.length} multi-cleaner completions to check for reminders`
    );

    for (const completion of completionsNeedingReminders) {
      try {
        const appointment = completion.appointment;
        const scheduledEnd = new Date(appointment.scheduledEndTime);
        const minutesPassed = Math.floor((now.getTime() - scheduledEnd.getTime()) / 60000);
        const expectedReminderNum = getReminderNumber(minutesPassed, config.reminderIntervals);

        if (expectedReminderNum > completion.autoCompleteRemindersSent) {
          const cleaner = completion.cleaner;
          if (!cleaner) continue;

          const cleanerFirstName = EncryptionService.decrypt(cleaner.firstName);
          const cleanerEmail = cleaner.email ? EncryptionService.decrypt(cleaner.email) : null;
          const homeAddress = appointment.home
            ? `${EncryptionService.decrypt(appointment.home.address)}, ${EncryptionService.decrypt(appointment.home.city)}`
            : "the home";
          const minutesLeft = getMinutesUntilAutoComplete(completion.autoCompleteAt);

          // Send notifications
          await NotificationService.createNotification(
            cleaner.id,
            getInAppReminderMessage(expectedReminderNum, appointment.date, minutesLeft),
            { appointmentId: appointment.id }
          );

          if (cleanerEmail) {
            await Email.sendAutoCompleteReminder(
              cleanerEmail,
              cleanerFirstName,
              appointment.date,
              homeAddress,
              expectedReminderNum,
              minutesLeft
            );
          }

          if (cleaner.expoPushToken) {
            await PushNotification.sendPushAutoCompleteReminder(
              cleaner.expoPushToken,
              appointment.date,
              homeAddress,
              expectedReminderNum,
              minutesLeft
            );
          }

          await completion.update({
            autoCompleteRemindersSent: expectedReminderNum,
            lastReminderSentAt: now,
          });

          remindersSent++;
          console.log(
            `[AutoCompleteMonitor] Sent reminder #${expectedReminderNum} for multi-cleaner completion ${completion.id}`
          );
        }
      } catch (error) {
        errors++;
        console.error(
          `[AutoCompleteMonitor] Error processing multi-cleaner reminder for completion ${completion.id}:`,
          error
        );
      }
    }

    return { remindersSent, errors };
  } catch (error) {
    console.error("[AutoCompleteMonitor] Error in processMultiCleanerReminders:", error);
    return { remindersSent, errors: errors + 1 };
  }
}

/**
 * Generate in-app reminder message based on reminder number
 */
function getInAppReminderMessage(reminderNum, date, minutesLeft) {
  const messages = {
    1: `Don't forget to mark your job on ${date} complete!`,
    2: `Your job on ${date} will auto-complete in ${Math.floor(minutesLeft / 60)} hours. Please mark it complete.`,
    3: `${Math.floor(minutesLeft / 60)} hours remaining to mark your job on ${date} complete.`,
    4: `Only 1 hour left! Please mark your job on ${date} complete now.`,
    5: `FINAL REMINDER: Your job on ${date} will auto-complete in ${minutesLeft} minutes.`,
  };
  return messages[reminderNum] || messages[1];
}

/**
 * Process auto-completions for single-cleaner jobs
 */
async function processAutoCompletions(io = null) {
  const now = new Date();
  let autoCompleted = 0;
  let errors = 0;

  try {
    const config = await getAutoCompleteConfig();

    // Find jobs where autoCompleteAt has passed
    const jobsToAutoComplete = await UserAppointments.findAll({
      where: {
        completionStatus: "in_progress",
        autoCompleteAt: { [Op.lt]: now },
        completed: false,
        wasCancelled: false,
        hasBeenAssigned: true,
        isMultiCleanerJob: false,
      },
      include: [
        {
          model: User,
          as: "user",
          attributes: ["id", "firstName", "lastName", "email", "expoPushToken"],
        },
        {
          model: UserHomes,
          as: "home",
          attributes: ["id", "address", "city"],
        },
      ],
    });

    console.log(
      `[AutoCompleteMonitor] Found ${jobsToAutoComplete.length} single-cleaner jobs to auto-complete`
    );

    for (const appointment of jobsToAutoComplete) {
      try {
        const cleanerIds = appointment.employeesAssigned || [];
        const cleanerId = cleanerIds[0];
        const cleaner = cleanerId ? await User.findByPk(cleanerId) : null;

        // Calculate auto-approval expiration (24 hours from now)
        const autoApprovalExpiresAt = new Date(
          now.getTime() + config.autoApprovalHours * 60 * 60 * 1000
        );

        // Auto-complete: set status to submitted (triggers homeowner approval flow)
        await appointment.update({
          completionStatus: "submitted",
          completionSubmittedAt: now,
          autoCompletedBySystem: true,
          autoApprovalExpiresAt,
          autoCompleteAt: null, // Clear since we've auto-completed
        });

        const homeAddress = appointment.home
          ? `${EncryptionService.decrypt(appointment.home.address)}, ${EncryptionService.decrypt(appointment.home.city)}`
          : "the home";

        // Notify cleaner that job was auto-completed
        if (cleaner) {
          const cleanerFirstName = EncryptionService.decrypt(cleaner.firstName);
          const cleanerEmail = cleaner.email ? EncryptionService.decrypt(cleaner.email) : null;

          await NotificationService.createNotification(
            cleanerId,
            `Your job on ${appointment.date} was auto-completed by the system. The homeowner has 24 hours to review.`,
            { appointmentId: appointment.id }
          );

          if (cleanerEmail) {
            await Email.sendJobAutoCompleted(
              cleanerEmail,
              cleanerFirstName,
              appointment.date,
              homeAddress
            );
          }

          if (cleaner.expoPushToken) {
            await PushNotification.sendPushJobAutoCompleted(
              cleaner.expoPushToken,
              appointment.date
            );
          }
        }

        // Notify homeowner that job was submitted for review
        if (appointment.user) {
          const homeownerFirstName = EncryptionService.decrypt(appointment.user.firstName);
          const homeownerEmail = appointment.user.email
            ? EncryptionService.decrypt(appointment.user.email)
            : null;
          const cleanerName = cleaner
            ? EncryptionService.decrypt(cleaner.firstName)
            : "Your cleaner";

          await NotificationService.createNotification(
            appointment.userId,
            `Your cleaning on ${appointment.date} has been marked complete. Please review within 24 hours.`,
            { appointmentId: appointment.id }
          );

          if (homeownerEmail) {
            await Email.sendJobAutoCompletedHomeowner(
              homeownerEmail,
              homeownerFirstName,
              appointment.date,
              cleanerName
            );
          }

          if (appointment.user.expoPushToken) {
            await PushNotification.sendPushJobAutoCompletedHomeowner(
              appointment.user.expoPushToken,
              appointment.date,
              cleanerName
            );
          }
        }

        autoCompleted++;
        console.log(
          `[AutoCompleteMonitor] Auto-completed single-cleaner appointment ${appointment.id}`
        );
      } catch (error) {
        errors++;
        console.error(
          `[AutoCompleteMonitor] Error auto-completing appointment ${appointment.id}:`,
          error
        );
      }
    }

    return { autoCompleted, errors };
  } catch (error) {
    console.error("[AutoCompleteMonitor] Error in processAutoCompletions:", error);
    return { autoCompleted, errors: errors + 1 };
  }
}

/**
 * Process auto-completions for multi-cleaner jobs
 */
async function processMultiCleanerAutoCompletions(io = null) {
  const now = new Date();
  let autoCompleted = 0;
  let errors = 0;

  try {
    const config = await getAutoCompleteConfig();

    const completionsToAutoComplete = await CleanerJobCompletion.findAll({
      where: {
        completionStatus: "in_progress",
        autoCompleteAt: { [Op.lt]: now },
        status: { [Op.in]: ["assigned", "started"] },
      },
      include: [
        {
          model: User,
          as: "cleaner",
          attributes: ["id", "firstName", "lastName", "email", "expoPushToken"],
        },
        {
          model: UserAppointments,
          as: "appointment",
          where: {
            wasCancelled: false,
          },
          include: [
            {
              model: User,
              as: "user",
              attributes: ["id", "firstName", "lastName", "email", "expoPushToken"],
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
      `[AutoCompleteMonitor] Found ${completionsToAutoComplete.length} multi-cleaner completions to auto-complete`
    );

    for (const completion of completionsToAutoComplete) {
      try {
        const appointment = completion.appointment;
        const cleaner = completion.cleaner;
        const homeowner = appointment?.user;

        const autoApprovalExpiresAt = new Date(
          now.getTime() + config.autoApprovalHours * 60 * 60 * 1000
        );

        await completion.update({
          completionStatus: "submitted",
          completionSubmittedAt: now,
          autoCompletedBySystem: true,
          autoApprovalExpiresAt,
          autoCompleteAt: null,
          status: "completed",
          completedAt: now,
        });

        const homeAddress = appointment?.home
          ? `${EncryptionService.decrypt(appointment.home.address)}, ${EncryptionService.decrypt(appointment.home.city)}`
          : "the home";

        // Notify cleaner
        if (cleaner) {
          const cleanerFirstName = EncryptionService.decrypt(cleaner.firstName);
          const cleanerEmail = cleaner.email ? EncryptionService.decrypt(cleaner.email) : null;

          await NotificationService.createNotification(
            cleaner.id,
            `Your work on ${appointment.date} was auto-completed. The homeowner has 24 hours to review.`,
            { appointmentId: appointment.id }
          );

          if (cleanerEmail) {
            await Email.sendJobAutoCompleted(
              cleanerEmail,
              cleanerFirstName,
              appointment.date,
              homeAddress
            );
          }

          if (cleaner.expoPushToken) {
            await PushNotification.sendPushJobAutoCompleted(cleaner.expoPushToken, appointment.date);
          }
        }

        // Notify homeowner
        if (homeowner) {
          const homeownerFirstName = EncryptionService.decrypt(homeowner.firstName);
          const homeownerEmail = homeowner.email
            ? EncryptionService.decrypt(homeowner.email)
            : null;
          const cleanerName = cleaner
            ? EncryptionService.decrypt(cleaner.firstName)
            : "A cleaner";

          await NotificationService.createNotification(
            homeowner.id,
            `${cleanerName}'s work on ${appointment.date} has been marked complete. Please review within 24 hours.`,
            { appointmentId: appointment.id }
          );

          if (homeownerEmail) {
            await Email.sendJobAutoCompletedHomeowner(
              homeownerEmail,
              homeownerFirstName,
              appointment.date,
              cleanerName
            );
          }

          if (homeowner.expoPushToken) {
            await PushNotification.sendPushJobAutoCompletedHomeowner(
              homeowner.expoPushToken,
              appointment.date,
              cleanerName
            );
          }
        }

        autoCompleted++;
        console.log(
          `[AutoCompleteMonitor] Auto-completed multi-cleaner completion ${completion.id}`
        );
      } catch (error) {
        errors++;
        console.error(
          `[AutoCompleteMonitor] Error auto-completing multi-cleaner completion ${completion.id}:`,
          error
        );
      }
    }

    return { autoCompleted, errors };
  } catch (error) {
    console.error("[AutoCompleteMonitor] Error in processMultiCleanerAutoCompletions:", error);
    return { autoCompleted, errors: errors + 1 };
  }
}

/**
 * Main function to run all auto-complete monitoring tasks
 */
async function runAutoCompleteMonitor(io = null) {
  console.log("[AutoCompleteMonitor] Starting auto-complete monitoring...");

  const [
    reminderResults,
    multiReminderResults,
    autoCompleteResults,
    multiAutoCompleteResults,
  ] = await Promise.all([
    processReminders(io),
    processMultiCleanerReminders(io),
    processAutoCompletions(io),
    processMultiCleanerAutoCompletions(io),
  ]);

  const summary = {
    reminders: {
      singleCleaner: reminderResults,
      multiCleaner: multiReminderResults,
      total: reminderResults.remindersSent + multiReminderResults.remindersSent,
    },
    autoCompletions: {
      singleCleaner: autoCompleteResults,
      multiCleaner: multiAutoCompleteResults,
      total: autoCompleteResults.autoCompleted + multiAutoCompleteResults.autoCompleted,
    },
    totalErrors:
      reminderResults.errors +
      multiReminderResults.errors +
      autoCompleteResults.errors +
      multiAutoCompleteResults.errors,
    timestamp: new Date().toISOString(),
  };

  console.log(
    `[AutoCompleteMonitor] Completed. Reminders: ${summary.reminders.total}, Auto-completions: ${summary.autoCompletions.total}, Errors: ${summary.totalErrors}`
  );

  return summary;
}

/**
 * Start the auto-complete monitor as a recurring job
 * @param {Object} io - Socket.io instance for real-time notifications
 * @param {number} intervalMs - How often to check (default: 5 minutes)
 */
function startAutoCompleteMonitor(io = null, intervalMs = 5 * 60 * 1000) {
  console.log(
    `[AutoCompleteMonitor] Starting monitor with ${intervalMs / 1000}s interval`
  );

  // Run immediately on start
  runAutoCompleteMonitor(io);

  // Then run at the specified interval
  const intervalId = setInterval(() => {
    runAutoCompleteMonitor(io);
  }, intervalMs);

  return intervalId;
}

module.exports = {
  runAutoCompleteMonitor,
  processReminders,
  processMultiCleanerReminders,
  processAutoCompletions,
  processMultiCleanerAutoCompletions,
  startAutoCompleteMonitor,
  parseTimeWindow,
  calculateScheduledEndTime,
  getAutoCompleteConfig,
};
