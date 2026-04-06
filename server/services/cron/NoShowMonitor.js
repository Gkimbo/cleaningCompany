/**
 * No-Show Monitor
 *
 * Handles detection and processing of cleaner no-shows:
 * - Detects jobs where scheduled end time passed but cleaner never started
 * - Sends warning notifications before marking as no-show
 * - Marks cleaners as no-show after grace period
 * - Notifies homeowners with options (reschedule, refund)
 * - Voids payment authorizations
 * - Tracks no-show incidents on cleaner records
 *
 * Timeline:
 * - Scheduled end time passes
 * - 1 hour grace period with warning notifications to cleaner
 * - After grace period: mark as no-show, notify homeowner, void payment
 */

const { Op } = require("sequelize");
const {
  UserAppointments,
  CleanerJobCompletion,
  MultiCleanerJob,
  User,
  UserHomes,
  PricingConfig,
} = require("../../models");
const NotificationService = require("../NotificationService");
const EncryptionService = require("../EncryptionService");
const Email = require("../sendNotifications/EmailClass");
const PushNotification = require("../sendNotifications/PushNotificationClass");
const MultiCleanerService = require("../MultiCleanerService");

/**
 * Notify owner and HR staff when a cleaner has multiple no-shows
 * @param {Object} cleaner - The cleaner user object
 * @param {number} noShowCount - Total no-show count
 * @param {string} formattedDate - Formatted date of the no-show
 * @param {string} location - Address where no-show occurred
 */
async function notifyOwnerAndHROfNoShows(cleaner, noShowCount, formattedDate, location) {
  try {
    const cleanerName = `${EncryptionService.decrypt(cleaner.firstName)} ${EncryptionService.decrypt(cleaner.lastName)}`;
    const cleanerEmail = cleaner.email ? EncryptionService.decrypt(cleaner.email) : "N/A";

    // Find owner and HR staff to notify
    const staffToNotify = await User.findAll({
      where: {
        type: { [Op.in]: ["owner", "humanResources"] },
        accountFrozen: false,
      },
      attributes: ["id", "firstName", "email", "expoPushToken", "type"],
    });

    const notificationTitle = noShowCount >= 3
      ? `⚠️ Cleaner has ${noShowCount} no-shows`
      : `Cleaner has ${noShowCount} no-shows`;

    const notificationBody = `${cleanerName} (${cleanerEmail}) was marked as a no-show on ${formattedDate} at ${location}. This is their ${noShowCount}${getOrdinalSuffix(noShowCount)} no-show.`;

    for (const staff of staffToNotify) {
      // In-app notification
      await NotificationService.createNotification({
        userId: staff.id,
        type: "cleaner_multiple_no_shows",
        title: notificationTitle,
        body: notificationBody,
        data: {
          cleanerId: cleaner.id,
          cleanerName,
          noShowCount,
          date: formattedDate,
          location,
        },
        actionRequired: noShowCount >= 3, // Require action for 3+ no-shows
      });

      // Email notification
      const staffEmail = staff.email ? EncryptionService.decrypt(staff.email) : null;
      if (staffEmail) {
        try {
          await Email.sendCleanerMultipleNoShows(
            staffEmail,
            EncryptionService.decrypt(staff.firstName),
            cleanerName,
            cleanerEmail,
            noShowCount,
            formattedDate,
            location,
            cleaner.id
          );
        } catch (emailError) {
          console.error(
            `[NoShowMonitor] Failed to send no-show alert email to ${staff.type} ${staff.id}:`,
            emailError.message
          );
        }
      }

      // Push notification for 3+ no-shows
      if (staff.expoPushToken && noShowCount >= 3) {
        try {
          await PushNotification.sendPush(
            staff.expoPushToken,
            notificationTitle,
            `${cleanerName} now has ${noShowCount} no-shows. Review required.`
          );
        } catch (pushError) {
          console.error(
            `[NoShowMonitor] Failed to send no-show alert push to ${staff.type} ${staff.id}:`,
            pushError.message
          );
        }
      }
    }

    console.log(
      `[NoShowMonitor] Notified ${staffToNotify.length} owner/HR staff about cleaner ${cleaner.id} with ${noShowCount} no-shows`
    );
  } catch (error) {
    console.error("[NoShowMonitor] Error notifying owner/HR of no-shows:", error);
  }
}

/**
 * Get ordinal suffix for a number (1st, 2nd, 3rd, etc.)
 */
function getOrdinalSuffix(n) {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return s[(v - 20) % 10] || s[v] || s[0];
}

/**
 * Get no-show configuration from PricingConfig
 */
async function getNoShowConfig() {
  const config = await PricingConfig.getActive();
  return {
    // Grace period after scheduled end before marking as no-show (in minutes)
    graceMinutes: config?.noShowGraceMinutes || 60,
    // Warning intervals during grace period (minutes after scheduled end)
    warningIntervals: config?.noShowWarningIntervals || [15, 30, 45],
  };
}

/**
 * Parse time window string to get end hour
 * @param {string} timeWindow - Time window string like "anytime", "10-3", "11-4", "12-2"
 * @returns {number} End hour
 */
function getEndHour(timeWindow) {
  const windows = {
    anytime: 18,
    "10-3": 15,
    "11-4": 16,
    "12-2": 14,
  };
  return windows[timeWindow] || 18;
}

/**
 * Calculate scheduled end time from date and time window
 * @param {string} dateStr - Date string (YYYY-MM-DD)
 * @param {string} timeWindow - Time window string
 * @returns {Date}
 */
function calculateScheduledEndTime(dateStr, timeWindow) {
  const endHour = getEndHour(timeWindow);
  const [year, month, day] = dateStr.split("-").map(Number);
  return new Date(year, month - 1, day, endHour, 0, 0);
}

/**
 * Get warning number based on minutes passed since scheduled end
 * @param {number} minutesPassed - Minutes since scheduled end
 * @param {number[]} intervals - Warning intervals in minutes
 * @returns {number} Warning number (1-3) or 0 if no warning due
 */
function getWarningNumber(minutesPassed, intervals) {
  for (let i = intervals.length - 1; i >= 0; i--) {
    if (minutesPassed >= intervals[i]) {
      return i + 1;
    }
  }
  return 0;
}

/**
 * Process warning notifications for single-cleaner jobs
 * Sends escalating warnings to cleaners who haven't started their jobs
 */
async function processNoShowWarnings(io = null) {
  const now = new Date();
  let warningsSent = 0;
  let errors = 0;

  try {
    const config = await getNoShowConfig();
    const graceEndThreshold = new Date(now.getTime() - config.graceMinutes * 60 * 1000);

    // Find jobs where:
    // - Scheduled end time has passed
    // - Grace period has NOT fully passed yet (still in warning window)
    // - Cleaner never started (jobStartedAt is null)
    // - Not completed, not cancelled
    // - Is assigned (single-cleaner jobs)
    const jobsNeedingWarnings = await UserAppointments.findAll({
      where: {
        scheduledEndTime: {
          [Op.lt]: now, // Scheduled end has passed
          [Op.gt]: graceEndThreshold, // But still within grace period
        },
        jobStartedAt: null, // Never started
        completed: false,
        wasCancelled: false,
        isPaused: { [Op.ne]: true },
        hasBeenAssigned: true,
        isMultiCleanerJob: false,
      },
      include: [
        {
          model: UserHomes,
          as: "home",
          attributes: ["id", "address", "city"],
        },
      ],
    });

    console.log(
      `[NoShowMonitor] Found ${jobsNeedingWarnings.length} single-cleaner jobs to check for no-show warnings`
    );

    for (const appointment of jobsNeedingWarnings) {
      try {
        const scheduledEnd = new Date(appointment.scheduledEndTime);
        const minutesPassed = Math.floor((now.getTime() - scheduledEnd.getTime()) / 60000);
        const expectedWarningNum = getWarningNumber(minutesPassed, config.warningIntervals);

        // Check if we should send a new warning
        const currentWarnings = appointment.noShowWarningsSent || 0;
        if (expectedWarningNum > currentWarnings) {
          const cleanerIds = appointment.employeesAssigned || [];
          const cleanerId = cleanerIds[0];
          const cleaner = cleanerId ? await User.findByPk(cleanerId) : null;

          if (!cleaner) {
            console.log(`[NoShowMonitor] No cleaner found for appointment ${appointment.id}`);
            continue;
          }

          const cleanerFirstName = EncryptionService.decrypt(cleaner.firstName);
          const cleanerEmail = cleaner.email ? EncryptionService.decrypt(cleaner.email) : null;
          const homeAddress = appointment.home
            ? `${EncryptionService.decrypt(appointment.home.address)}, ${EncryptionService.decrypt(appointment.home.city)}`
            : "the scheduled location";
          const minutesRemaining = config.graceMinutes - minutesPassed;

          // Build escalating warning message
          const warningMessages = {
            1: `Reminder: Your cleaning job today at ${homeAddress} was scheduled to end. Please start the job or contact support.`,
            2: `URGENT: You have ${minutesRemaining} minutes to start your job at ${homeAddress} before being marked as a no-show.`,
            3: `FINAL WARNING: Start your job at ${homeAddress} NOW or you will be marked as a no-show in ${minutesRemaining} minutes.`,
          };

          const warningTitles = {
            1: "Job Not Started",
            2: "Urgent: Start Your Job",
            3: "Final Warning: No-Show Imminent",
          };

          // In-app notification
          await NotificationService.createNotification({
            userId: cleanerId,
            type: "no_show_warning",
            title: warningTitles[expectedWarningNum],
            body: warningMessages[expectedWarningNum],
            data: {
              appointmentId: appointment.id,
              warningNumber: expectedWarningNum,
              minutesRemaining,
            },
            actionRequired: true,
          });

          // Email notification
          if (cleanerEmail) {
            try {
              await Email.sendNoShowWarning(
                cleanerEmail,
                cleanerFirstName,
                appointment.date,
                homeAddress,
                expectedWarningNum,
                minutesRemaining
              );
            } catch (emailError) {
              console.error(
                `[NoShowMonitor] Failed to send warning email for appointment ${appointment.id}:`,
                emailError.message
              );
            }
          }

          // Push notification
          if (cleaner.expoPushToken) {
            try {
              await PushNotification.sendPushNoShowWarning(
                cleaner.expoPushToken,
                warningTitles[expectedWarningNum],
                warningMessages[expectedWarningNum],
                appointment.id
              );
            } catch (pushError) {
              console.error(
                `[NoShowMonitor] Failed to send warning push for appointment ${appointment.id}:`,
                pushError.message
              );
            }
          }

          // Update warning count
          await appointment.update({
            noShowWarningsSent: expectedWarningNum,
            lastNoShowWarningAt: now,
          });

          warningsSent++;
          console.log(
            `[NoShowMonitor] Sent warning #${expectedWarningNum} for appointment ${appointment.id} to cleaner ${cleanerId}`
          );
        }
      } catch (error) {
        errors++;
        console.error(
          `[NoShowMonitor] Error processing warning for appointment ${appointment.id}:`,
          error
        );
      }
    }

    return { warningsSent, errors };
  } catch (error) {
    console.error("[NoShowMonitor] Error in processNoShowWarnings:", error);
    return { warningsSent, errors: errors + 1 };
  }
}

/**
 * Process warning notifications for multi-cleaner jobs
 */
async function processMultiCleanerNoShowWarnings(io = null) {
  const now = new Date();
  let warningsSent = 0;
  let errors = 0;

  try {
    const config = await getNoShowConfig();
    const graceEndThreshold = new Date(now.getTime() - config.graceMinutes * 60 * 1000);

    // Find multi-cleaner completions where cleaner never started
    const completionsNeedingWarnings = await CleanerJobCompletion.findAll({
      where: {
        jobStartedAt: null, // Never started
        status: { [Op.in]: ["assigned"] }, // Still assigned (not dropped out, not completed)
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
            scheduledEndTime: {
              [Op.lt]: now,
              [Op.gt]: graceEndThreshold,
            },
            wasCancelled: false,
            isPaused: { [Op.ne]: true },
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
      `[NoShowMonitor] Found ${completionsNeedingWarnings.length} multi-cleaner completions to check for no-show warnings`
    );

    for (const completion of completionsNeedingWarnings) {
      try {
        const appointment = completion.appointment;
        const scheduledEnd = new Date(appointment.scheduledEndTime);
        const minutesPassed = Math.floor((now.getTime() - scheduledEnd.getTime()) / 60000);
        const expectedWarningNum = getWarningNumber(minutesPassed, config.warningIntervals);

        const currentWarnings = completion.noShowWarningsSent || 0;
        if (expectedWarningNum > currentWarnings) {
          const cleaner = completion.cleaner;
          if (!cleaner) continue;

          const cleanerFirstName = EncryptionService.decrypt(cleaner.firstName);
          const cleanerEmail = cleaner.email ? EncryptionService.decrypt(cleaner.email) : null;
          const homeAddress = appointment.home
            ? `${EncryptionService.decrypt(appointment.home.address)}, ${EncryptionService.decrypt(appointment.home.city)}`
            : "the scheduled location";
          const minutesRemaining = config.graceMinutes - minutesPassed;

          const warningMessages = {
            1: `Reminder: Your team cleaning job at ${homeAddress} was scheduled to end. Please start the job or contact support.`,
            2: `URGENT: You have ${minutesRemaining} minutes to start your job at ${homeAddress} before being marked as a no-show.`,
            3: `FINAL WARNING: Start your job at ${homeAddress} NOW or you will be marked as a no-show in ${minutesRemaining} minutes.`,
          };

          const warningTitles = {
            1: "Team Job Not Started",
            2: "Urgent: Start Your Job",
            3: "Final Warning: No-Show Imminent",
          };

          await NotificationService.createNotification({
            userId: cleaner.id,
            type: "no_show_warning",
            title: warningTitles[expectedWarningNum],
            body: warningMessages[expectedWarningNum],
            data: {
              appointmentId: appointment.id,
              completionId: completion.id,
              warningNumber: expectedWarningNum,
              minutesRemaining,
            },
            actionRequired: true,
          });

          if (cleanerEmail) {
            try {
              await Email.sendNoShowWarning(
                cleanerEmail,
                cleanerFirstName,
                appointment.date,
                homeAddress,
                expectedWarningNum,
                minutesRemaining
              );
            } catch (emailError) {
              console.error(
                `[NoShowMonitor] Failed to send warning email for completion ${completion.id}:`,
                emailError.message
              );
            }
          }

          if (cleaner.expoPushToken) {
            try {
              await PushNotification.sendPushNoShowWarning(
                cleaner.expoPushToken,
                warningTitles[expectedWarningNum],
                warningMessages[expectedWarningNum],
                appointment.id
              );
            } catch (pushError) {
              console.error(
                `[NoShowMonitor] Failed to send warning push for completion ${completion.id}:`,
                pushError.message
              );
            }
          }

          await completion.update({
            noShowWarningsSent: expectedWarningNum,
            lastNoShowWarningAt: now,
          });

          warningsSent++;
          console.log(
            `[NoShowMonitor] Sent warning #${expectedWarningNum} for multi-cleaner completion ${completion.id}`
          );
        }
      } catch (error) {
        errors++;
        console.error(
          `[NoShowMonitor] Error processing multi-cleaner warning for completion ${completion.id}:`,
          error
        );
      }
    }

    return { warningsSent, errors };
  } catch (error) {
    console.error("[NoShowMonitor] Error in processMultiCleanerNoShowWarnings:", error);
    return { warningsSent, errors: errors + 1 };
  }
}

/**
 * Process no-shows for single-cleaner jobs
 * Marks cleaners as no-show after grace period expires
 */
async function processNoShows(io = null) {
  const now = new Date();
  let noShowsProcessed = 0;
  let errors = 0;

  try {
    const config = await getNoShowConfig();
    const graceEndThreshold = new Date(now.getTime() - config.graceMinutes * 60 * 1000);

    // Find jobs where grace period has fully passed
    const jobsWithNoShows = await UserAppointments.findAll({
      where: {
        scheduledEndTime: { [Op.lt]: graceEndThreshold }, // Grace period passed
        jobStartedAt: null, // Never started
        completed: false,
        wasCancelled: false,
        isPaused: { [Op.ne]: true },
        hasBeenAssigned: true,
        isMultiCleanerJob: false,
        noShowProcessedAt: null, // Not already processed as no-show
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
          attributes: ["id", "address", "city", "state"],
        },
      ],
    });

    console.log(
      `[NoShowMonitor] Found ${jobsWithNoShows.length} single-cleaner jobs with no-shows to process`
    );

    for (const appointment of jobsWithNoShows) {
      try {
        const cleanerIds = appointment.employeesAssigned || [];
        const cleanerId = cleanerIds[0];
        const cleaner = cleanerId ? await User.findByPk(cleanerId) : null;
        const homeowner = appointment.user;

        const homeAddress = appointment.home
          ? {
              street: EncryptionService.decrypt(appointment.home.address),
              city: EncryptionService.decrypt(appointment.home.city),
              state: EncryptionService.decrypt(appointment.home.state),
            }
          : null;
        const homeAddressStr = homeAddress
          ? `${homeAddress.street}, ${homeAddress.city}`
          : "the scheduled location";

        const appointmentDate = new Date(appointment.date);
        const formattedDate = appointmentDate.toLocaleDateString("en-US", {
          weekday: "long",
          month: "short",
          day: "numeric",
        });

        // 1. Mark cleaner as no-show and increment their no-show count
        if (cleaner) {
          const cleanerFirstName = EncryptionService.decrypt(cleaner.firstName);
          const cleanerEmail = cleaner.email ? EncryptionService.decrypt(cleaner.email) : null;

          // Increment no-show count on user record
          const currentNoShows = cleaner.noShowCount || 0;
          await cleaner.update({
            noShowCount: currentNoShows + 1,
            lastNoShowAt: now,
          });

          // Notify cleaner they've been marked as no-show
          await NotificationService.createNotification({
            userId: cleanerId,
            type: "marked_no_show",
            title: "No-Show Recorded",
            body: `You were marked as a no-show for the cleaning on ${formattedDate} at ${homeAddressStr}. This affects your reliability score.`,
            data: {
              appointmentId: appointment.id,
              noShowCount: currentNoShows + 1,
            },
          });

          if (cleanerEmail) {
            try {
              await Email.sendNoShowRecorded(
                cleanerEmail,
                cleanerFirstName,
                formattedDate,
                homeAddressStr,
                currentNoShows + 1
              );
            } catch (emailError) {
              console.error(
                `[NoShowMonitor] Failed to send no-show email to cleaner ${cleanerId}:`,
                emailError.message
              );
            }
          }

          if (cleaner.expoPushToken) {
            try {
              await PushNotification.sendPushNoShowRecorded(
                cleaner.expoPushToken,
                formattedDate
              );
            } catch (pushError) {
              console.error(
                `[NoShowMonitor] Failed to send no-show push to cleaner ${cleanerId}:`,
                pushError.message
              );
            }
          }

          // Notify owner and HR if cleaner has multiple no-shows (2+)
          const newNoShowCount = currentNoShows + 1;
          if (newNoShowCount >= 2) {
            await notifyOwnerAndHROfNoShows(cleaner, newNoShowCount, formattedDate, homeAddressStr);
          }
        }

        // 2. Void payment authorization if exists
        if (appointment.paymentIntentId && appointment.paymentStatus === "pending") {
          try {
            const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
            await stripe.paymentIntents.cancel(appointment.paymentIntentId);
            console.log(
              `[NoShowMonitor] Voided payment intent ${appointment.paymentIntentId} for appointment ${appointment.id}`
            );
          } catch (stripeError) {
            console.error(
              `[NoShowMonitor] Could not void payment for appointment ${appointment.id}:`,
              stripeError.message
            );
          }
        }

        // 3. Update appointment status
        await appointment.update({
          noShowProcessedAt: now,
          noShowCleanerId: cleanerId,
          hasBeenAssigned: false,
          employeesAssigned: [],
          paymentStatus: "cancelled",
        });

        // 4. Notify homeowner with options
        if (homeowner) {
          const homeownerFirstName = EncryptionService.decrypt(homeowner.firstName);
          const homeownerEmail = homeowner.email
            ? EncryptionService.decrypt(homeowner.email)
            : null;
          const cleanerName = cleaner
            ? EncryptionService.decrypt(cleaner.firstName)
            : "Your cleaner";

          await NotificationService.createNotification({
            userId: homeowner.id,
            type: "cleaner_no_show",
            title: "Your Cleaner Didn't Show Up",
            body: `${cleanerName} didn't show up for your cleaning on ${formattedDate}. We're sorry for the inconvenience. You can reschedule or request a refund.`,
            data: {
              appointmentId: appointment.id,
              options: ["reschedule", "refund"],
            },
            actionRequired: true,
          });

          if (homeownerEmail) {
            try {
              await Email.sendCleanerNoShow(
                homeownerEmail,
                homeownerFirstName,
                cleanerName,
                formattedDate,
                homeAddressStr,
                appointment.id
              );
            } catch (emailError) {
              console.error(
                `[NoShowMonitor] Failed to send no-show email to homeowner ${homeowner.id}:`,
                emailError.message
              );
            }
          }

          if (homeowner.expoPushToken) {
            try {
              await PushNotification.sendPushCleanerNoShow(
                homeowner.expoPushToken,
                cleanerName,
                formattedDate
              );
            } catch (pushError) {
              console.error(
                `[NoShowMonitor] Failed to send no-show push to homeowner ${homeowner.id}:`,
                pushError.message
              );
            }
          }
        }

        noShowsProcessed++;
        console.log(
          `[NoShowMonitor] Processed no-show for appointment ${appointment.id}, cleaner ${cleanerId}`
        );
      } catch (error) {
        errors++;
        console.error(
          `[NoShowMonitor] Error processing no-show for appointment ${appointment.id}:`,
          error
        );
      }
    }

    return { noShowsProcessed, errors };
  } catch (error) {
    console.error("[NoShowMonitor] Error in processNoShows:", error);
    return { noShowsProcessed, errors: errors + 1 };
  }
}

/**
 * Process no-shows for multi-cleaner jobs
 */
async function processMultiCleanerNoShows(io = null) {
  const now = new Date();
  let noShowsProcessed = 0;
  let errors = 0;

  try {
    const config = await getNoShowConfig();
    const graceEndThreshold = new Date(now.getTime() - config.graceMinutes * 60 * 1000);

    // Find multi-cleaner completions where grace period has passed
    const completionsWithNoShows = await CleanerJobCompletion.findAll({
      where: {
        jobStartedAt: null,
        status: { [Op.in]: ["assigned"] },
        noShowProcessedAt: null,
      },
      include: [
        {
          model: User,
          as: "cleaner",
          attributes: ["id", "firstName", "lastName", "email", "expoPushToken", "noShowCount"],
        },
        {
          model: MultiCleanerJob,
          as: "multiCleanerJob",
        },
        {
          model: UserAppointments,
          as: "appointment",
          where: {
            scheduledEndTime: { [Op.lt]: graceEndThreshold },
            wasCancelled: false,
            isPaused: { [Op.ne]: true },
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
              attributes: ["id", "address", "city", "state"],
            },
          ],
        },
      ],
    });

    console.log(
      `[NoShowMonitor] Found ${completionsWithNoShows.length} multi-cleaner completions with no-shows to process`
    );

    for (const completion of completionsWithNoShows) {
      try {
        const cleaner = completion.cleaner;
        const appointment = completion.appointment;
        const homeowner = appointment?.user;
        const multiCleanerJob = completion.multiCleanerJob;

        if (!cleaner || !appointment) continue;

        const cleanerFirstName = EncryptionService.decrypt(cleaner.firstName);
        const cleanerEmail = cleaner.email ? EncryptionService.decrypt(cleaner.email) : null;
        const homeAddress = appointment.home
          ? {
              street: EncryptionService.decrypt(appointment.home.address),
              city: EncryptionService.decrypt(appointment.home.city),
            }
          : null;
        const homeAddressStr = homeAddress
          ? `${homeAddress.street}, ${homeAddress.city}`
          : "the scheduled location";

        const appointmentDate = new Date(appointment.date);
        const formattedDate = appointmentDate.toLocaleDateString("en-US", {
          weekday: "long",
          month: "short",
          day: "numeric",
        });

        // 1. Mark this cleaner as no-show
        const currentNoShows = cleaner.noShowCount || 0;
        await cleaner.update({
          noShowCount: currentNoShows + 1,
          lastNoShowAt: now,
        });

        // 2. Update completion record
        await completion.update({
          status: "no_show",
          noShowProcessedAt: now,
        });

        // 3. Notify cleaner
        await NotificationService.createNotification({
          userId: cleaner.id,
          type: "marked_no_show",
          title: "No-Show Recorded",
          body: `You were marked as a no-show for the team cleaning on ${formattedDate}. This affects your reliability score.`,
          data: {
            appointmentId: appointment.id,
            completionId: completion.id,
            noShowCount: currentNoShows + 1,
          },
        });

        if (cleanerEmail) {
          try {
            await Email.sendNoShowRecorded(
              cleanerEmail,
              cleanerFirstName,
              formattedDate,
              homeAddressStr,
              currentNoShows + 1
            );
          } catch (emailError) {
            console.error(
              `[NoShowMonitor] Failed to send no-show email to cleaner ${cleaner.id}:`,
              emailError.message
            );
          }
        }

        // Notify owner and HR if cleaner has multiple no-shows (2+)
        const newNoShowCount = currentNoShows + 1;
        if (newNoShowCount >= 2) {
          await notifyOwnerAndHROfNoShows(cleaner, newNoShowCount, formattedDate, homeAddressStr);
        }

        // 4. Use MultiCleanerService to handle the no-show (rebalances work, notifies team, etc.)
        if (multiCleanerJob) {
          try {
            await MultiCleanerService.handleNoShow(multiCleanerJob.id, cleaner.id);
          } catch (mcError) {
            console.error(
              `[NoShowMonitor] Error in MultiCleanerService.handleNoShow for job ${multiCleanerJob.id}:`,
              mcError.message
            );
          }
        }

        noShowsProcessed++;
        console.log(
          `[NoShowMonitor] Processed no-show for multi-cleaner completion ${completion.id}, cleaner ${cleaner.id}`
        );
      } catch (error) {
        errors++;
        console.error(
          `[NoShowMonitor] Error processing multi-cleaner no-show for completion ${completion.id}:`,
          error
        );
      }
    }

    return { noShowsProcessed, errors };
  } catch (error) {
    console.error("[NoShowMonitor] Error in processMultiCleanerNoShows:", error);
    return { noShowsProcessed, errors: errors + 1 };
  }
}

/**
 * Main function to run all no-show monitoring tasks
 */
async function runNoShowMonitor(io = null) {
  console.log("[NoShowMonitor] Starting no-show monitoring...");

  const [
    warningResults,
    multiWarningResults,
    noShowResults,
    multiNoShowResults,
  ] = await Promise.all([
    processNoShowWarnings(io),
    processMultiCleanerNoShowWarnings(io),
    processNoShows(io),
    processMultiCleanerNoShows(io),
  ]);

  const summary = {
    warnings: {
      singleCleaner: warningResults,
      multiCleaner: multiWarningResults,
      total: warningResults.warningsSent + multiWarningResults.warningsSent,
    },
    noShows: {
      singleCleaner: noShowResults,
      multiCleaner: multiNoShowResults,
      total: noShowResults.noShowsProcessed + multiNoShowResults.noShowsProcessed,
    },
    totalErrors:
      warningResults.errors +
      multiWarningResults.errors +
      noShowResults.errors +
      multiNoShowResults.errors,
    timestamp: new Date().toISOString(),
  };

  console.log(
    `[NoShowMonitor] Completed. Warnings: ${summary.warnings.total}, No-shows: ${summary.noShows.total}, Errors: ${summary.totalErrors}`
  );

  return summary;
}

/**
 * Start the no-show monitor as a recurring job
 * @param {Object} io - Socket.io instance for real-time notifications
 * @param {number} intervalMs - How often to check (default: 5 minutes)
 */
function startNoShowMonitor(io = null, intervalMs = 5 * 60 * 1000) {
  console.log(
    `[NoShowMonitor] Starting monitor with ${intervalMs / 1000}s interval`
  );

  // Run immediately on start
  runNoShowMonitor(io);

  // Then run at the specified interval
  const intervalId = setInterval(() => {
    runNoShowMonitor(io);
  }, intervalMs);

  return intervalId;
}

module.exports = {
  runNoShowMonitor,
  startNoShowMonitor,
  processNoShowWarnings,
  processMultiCleanerNoShowWarnings,
  processNoShows,
  processMultiCleanerNoShows,
  getNoShowConfig,
};
