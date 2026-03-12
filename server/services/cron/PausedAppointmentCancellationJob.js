/**
 * Paused Appointment Cancellation Job
 *
 * Checks daily for paused appointments (from frozen homeowner accounts)
 * that are now within 7 days of their scheduled date.
 * These appointments are cancelled and both the homeowner and cleaner are notified.
 *
 * Schedule: Once daily (recommended: early morning)
 */

const { Op } = require("sequelize");
const {
  UserAppointments,
  UserCleanerAppointments,
  UserHomes,
  UserPendingRequests,
  User,
  Payout,
  MultiCleanerJob,
  CleanerJoinRequest,
  CleanerJobOffer,
  CleanerRoomAssignment,
  CleanerJobCompletion,
  EmployeeJobAssignment,
} = require("../../models");
const NotificationService = require("../NotificationService");
const Email = require("../sendNotifications/EmailClass");
const PushNotification = require("../sendNotifications/PushNotificationClass");
const EncryptionService = require("../EncryptionService");
const TimezoneService = require("../TimezoneService");

// Helper to safely decrypt a field
const safeDecrypt = (value) => {
  if (!value) return null;
  try {
    return EncryptionService.decrypt(value);
  } catch (error) {
    return "[encrypted]";
  }
};

/**
 * Process paused appointments that are now within 7 days
 * These need to be cancelled with notifications to both parties
 *
 * @param {Object} io - Socket.io instance for real-time notifications
 * @returns {Object} Summary of processed appointments
 */
async function processPausedAppointmentCancellations(io = null) {
  const now = new Date();
  const results = { cancelled: 0, skipped: 0, errors: 0 };

  try {
    // Calculate 7 days from now
    const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const todayStr = TimezoneService.getTodayInTimezone();
    const sevenDaysStr = TimezoneService.formatDateInTimezone(sevenDaysFromNow);

    console.log(
      `[PausedAppointmentCancellationJob] Checking for paused appointments between ${todayStr} and ${sevenDaysStr}`
    );

    // Find paused appointments that are now within 7 days
    const pausedAppointments = await UserAppointments.findAll({
      where: {
        isPaused: true,
        pauseReason: "homeowner_account_frozen",
        date: {
          [Op.gte]: todayStr,
          [Op.lte]: sevenDaysStr,
        },
        wasCancelled: false,
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
            "expoPushToken",
            "notifications",
            "notificationEmail",
          ],
        },
        {
          model: UserHomes,
          as: "home",
          attributes: ["id", "address", "city", "state", "zipcode"],
        },
      ],
    });

    console.log(
      `[PausedAppointmentCancellationJob] Found ${pausedAppointments.length} paused appointments to cancel`
    );

    for (const appointment of pausedAppointments) {
      try {
        const homeowner = appointment.user;
        const home = appointment.home;

        // Verify homeowner is still frozen (safety check for race conditions)
        if (homeowner) {
          const currentHomeowner = await User.findByPk(homeowner.id, {
            attributes: ["id", "accountFrozen"],
          });
          if (currentHomeowner && !currentHomeowner.accountFrozen) {
            // Homeowner was unfrozen - resume the appointment instead of cancelling
            console.log(
              `[PausedAppointmentCancellationJob] Homeowner ${homeowner.id} is no longer frozen, resuming appointment ${appointment.id}`
            );
            await appointment.update({
              isPaused: false,
              pausedAt: null,
              pauseReason: null,
            });
            // Also resume multi-cleaner job if exists
            if (appointment.isMultiCleanerJob && appointment.multiCleanerJobId) {
              await MultiCleanerJob.update(
                { status: "open" },
                { where: { id: appointment.multiCleanerJobId, status: "paused" } }
              );
            }
            results.skipped++;
            continue;
          }
        }

        // Get assigned cleaners before removing assignments
        const assignedCleanerIds = appointment.employeesAssigned || [];
        const cleaners = assignedCleanerIds.length > 0
          ? await User.findAll({
              where: { id: { [Op.in]: assignedCleanerIds } },
              attributes: [
                "id",
                "firstName",
                "lastName",
                "email",
                "expoPushToken",
                "notifications",
                "notificationEmail",
              ],
            })
          : [];

        // Also check for multi-cleaner job completions
        let multiCleanerCleaners = [];
        if (appointment.isMultiCleanerJob && appointment.multiCleanerJobId) {
          const completions = await CleanerJobCompletion.findAll({
            where: {
              multiCleanerJobId: appointment.multiCleanerJobId,
              status: { [Op.notIn]: ["dropped_out", "no_show"] },
            },
            include: [
              {
                model: User,
                as: "cleaner",
                attributes: [
                  "id",
                  "firstName",
                  "lastName",
                  "email",
                  "expoPushToken",
                  "notifications",
                  "notificationEmail",
                ],
              },
            ],
          });
          multiCleanerCleaners = completions
            .filter((c) => c.cleaner)
            .map((c) => c.cleaner);
        }

        // Combine all cleaners (avoid duplicates)
        const allCleanerIds = new Set([
          ...assignedCleanerIds,
          ...multiCleanerCleaners.map((c) => c.id),
        ]);
        const allCleaners = [
          ...cleaners,
          ...multiCleanerCleaners.filter((c) => !assignedCleanerIds.includes(c.id)),
        ];

        // Remove cleaner assignments
        await UserCleanerAppointments.destroy({
          where: { appointmentId: appointment.id },
        });

        // Remove pending requests
        await UserPendingRequests.destroy({
          where: { appointmentId: appointment.id },
        });

        // Delete pending payouts
        await Payout.destroy({
          where: {
            appointmentId: appointment.id,
            status: "pending",
          },
        });

        // Remove employee job assignments if this was a business employee job
        if (appointment.assignedToBusinessEmployee) {
          await EmployeeJobAssignment.destroy({
            where: { appointmentId: appointment.id },
          });
        }

        // Cancel multi-cleaner job if exists
        if (appointment.isMultiCleanerJob && appointment.multiCleanerJobId) {
          try {
            await MultiCleanerJob.update(
              { status: "cancelled" },
              { where: { id: appointment.multiCleanerJobId } }
            );
            await CleanerJoinRequest.destroy({
              where: { multiCleanerJobId: appointment.multiCleanerJobId },
            });
            await CleanerJobOffer.destroy({
              where: { multiCleanerJobId: appointment.multiCleanerJobId },
            });
            await CleanerRoomAssignment.destroy({
              where: { multiCleanerJobId: appointment.multiCleanerJobId },
            });
            await CleanerJobCompletion.destroy({
              where: { multiCleanerJobId: appointment.multiCleanerJobId },
            });
          } catch (mcjError) {
            console.error(
              `[PausedAppointmentCancellationJob] Failed to cancel multi-cleaner job ${appointment.multiCleanerJobId}:`,
              mcjError
            );
          }
        }

        // Mark appointment as cancelled
        await appointment.update({
          wasCancelled: true,
          cancellationType: "system",
          cancellationReason: "Homeowner account suspended - appointment date approaching",
          cancellationConfirmedAt: now,
          hasBeenAssigned: false,
          employeesAssigned: null,
          isPaused: false,
          pausedAt: null,
          pauseReason: null,
        });

        // Format home address for notifications
        const homeAddress = home
          ? `${safeDecrypt(home.address)}, ${safeDecrypt(home.city)}`
          : "Unknown address";

        // Notify homeowner
        if (homeowner) {
          const homeownerFirstName = safeDecrypt(homeowner.firstName) || "Homeowner";
          const homeownerEmail = homeowner.notificationEmail || homeowner.email;
          const decryptedEmail = homeownerEmail ? safeDecrypt(homeownerEmail) : null;

          try {
            // In-app notification
            await NotificationService.notifyUser({
              userId: homeowner.id,
              type: "paused_appointment_cancelled",
              title: "Paused Appointment Cancelled",
              body: `Your cleaning scheduled for ${appointment.date} at ${homeAddress} has been cancelled because your account is suspended and the appointment date is approaching.`,
              data: {
                appointmentId: appointment.id,
                date: appointment.date,
                reason: "account_suspended_approaching",
              },
              actionRequired: false,
              sendPush: true,
              io,
            });

            // Email notification
            if (decryptedEmail) {
              try {
                await Email.sendPausedAppointmentCancelledHomeowner(
                  decryptedEmail,
                  homeownerFirstName,
                  appointment.date,
                  homeAddress
                );
              } catch (emailError) {
                console.error(
                  `[PausedAppointmentCancellationJob] Email error for homeowner ${homeowner.id}:`,
                  emailError
                );
              }
            }
          } catch (notifyError) {
            console.error(
              `[PausedAppointmentCancellationJob] Error notifying homeowner ${homeowner.id}:`,
              notifyError
            );
          }
        }

        // Notify all assigned cleaners
        for (const cleaner of allCleaners) {
          try {
            const cleanerFirstName = safeDecrypt(cleaner.firstName) || "Cleaner";
            const cleanerEmail = cleaner.notificationEmail || cleaner.email;
            const decryptedCleanerEmail = cleanerEmail ? safeDecrypt(cleanerEmail) : null;

            // In-app notification
            await NotificationService.notifyUser({
              userId: cleaner.id,
              type: "appointment_cancelled_by_system",
              title: "Appointment Cancelled",
              body: `Your cleaning job on ${appointment.date} at ${homeAddress} has been cancelled. The homeowner's account has been suspended.`,
              data: {
                appointmentId: appointment.id,
                date: appointment.date,
                reason: "homeowner_account_suspended",
              },
              actionRequired: false,
              sendPush: true,
              io,
            });

            // Email notification
            if (decryptedCleanerEmail) {
              try {
                await Email.sendAppointmentCancelledCleaner(
                  decryptedCleanerEmail,
                  cleanerFirstName,
                  appointment.date,
                  homeAddress,
                  "The homeowner's account has been suspended"
                );
              } catch (emailError) {
                console.error(
                  `[PausedAppointmentCancellationJob] Email error for cleaner ${cleaner.id}:`,
                  emailError
                );
              }
            }

            // Push notification
            if (cleaner.expoPushToken && cleaner.notifications !== false) {
              try {
                await PushNotification.sendPushNotification(
                  cleaner.expoPushToken,
                  "Appointment Cancelled",
                  `Your job on ${appointment.date} at ${homeAddress} has been cancelled.`,
                  {
                    type: "appointment_cancelled_by_system",
                    appointmentId: appointment.id,
                  }
                );
              } catch (pushError) {
                console.error(
                  `[PausedAppointmentCancellationJob] Push error for cleaner ${cleaner.id}:`,
                  pushError
                );
              }
            }

            console.log(
              `[PausedAppointmentCancellationJob] Notified cleaner ${cleaner.id} about cancelled appointment ${appointment.id}`
            );
          } catch (cleanerNotifyError) {
            console.error(
              `[PausedAppointmentCancellationJob] Error notifying cleaner ${cleaner.id}:`,
              cleanerNotifyError
            );
          }
        }

        // Notify business owner if appointment was booked by them
        if (appointment.bookedByCleanerId && appointment.bookedByCleanerId !== homeowner?.id) {
          try {
            const businessOwner = await User.findByPk(appointment.bookedByCleanerId, {
              attributes: [
                "id",
                "firstName",
                "lastName",
                "email",
                "expoPushToken",
                "notifications",
                "notificationEmail",
              ],
            });

            if (businessOwner) {
              const boFirstName = safeDecrypt(businessOwner.firstName) || "Business Owner";
              const homeownerName = homeowner
                ? `${safeDecrypt(homeowner.firstName) || ""} ${safeDecrypt(homeowner.lastName) || ""}`.trim() || "the homeowner"
                : "the homeowner";

              await NotificationService.notifyUser({
                userId: businessOwner.id,
                type: "booked_appointment_cancelled",
                title: "Booked Appointment Cancelled",
                body: `The appointment you booked for ${homeownerName} on ${appointment.date} has been cancelled because their account is suspended.`,
                data: {
                  appointmentId: appointment.id,
                  date: appointment.date,
                  homeownerId: homeowner?.id,
                  reason: "homeowner_account_suspended",
                },
                actionRequired: false,
                sendPush: true,
                io,
              });

              console.log(
                `[PausedAppointmentCancellationJob] Notified business owner ${businessOwner.id} about cancelled appointment ${appointment.id}`
              );
            }
          } catch (boNotifyError) {
            console.error(
              `[PausedAppointmentCancellationJob] Error notifying business owner for appointment ${appointment.id}:`,
              boNotifyError
            );
          }
        }

        results.cancelled++;
        console.log(
          `[PausedAppointmentCancellationJob] Cancelled appointment ${appointment.id} (${appointment.date}) - notified ${allCleaners.length} cleaner(s)`
        );
      } catch (error) {
        results.errors++;
        console.error(
          `[PausedAppointmentCancellationJob] Error processing appointment ${appointment.id}:`,
          error
        );
      }
    }

    console.log(
      `[PausedAppointmentCancellationJob] Completed. Cancelled: ${results.cancelled}, Errors: ${results.errors}`
    );
    return results;
  } catch (error) {
    console.error("[PausedAppointmentCancellationJob] Fatal error:", error);
    throw error;
  }
}

/**
 * Start the paused appointment cancellation job as a recurring interval
 * @param {Object} io - Socket.io instance
 * @param {number} intervalMs - Interval in milliseconds (default: 24 hours)
 * @returns {Object} Interval reference for cleanup
 */
function startPausedAppointmentCancellationJob(io, intervalMs = 24 * 60 * 60 * 1000) {
  console.log(
    `[PausedAppointmentCancellationJob] Starting paused appointment cancellation job (interval: ${intervalMs}ms)`
  );

  // Run once on startup to catch any appointments that need cancellation
  processPausedAppointmentCancellations(io).catch((err) => {
    console.error("[PausedAppointmentCancellationJob] Error on initial run:", err);
  });

  // Then run on scheduled interval (daily)
  const interval = setInterval(() => {
    processPausedAppointmentCancellations(io).catch((err) => {
      console.error("[PausedAppointmentCancellationJob] Error on interval run:", err);
    });
  }, intervalMs);

  return interval;
}

module.exports = {
  processPausedAppointmentCancellations,
  startPausedAppointmentCancellationJob,
};
