/**
 * Unassigned Expired Appointment Job
 * Auto-cancels appointments that have passed their date without a cleaner being assigned.
 * Runs daily to clean up orphaned appointments that would otherwise remain in limbo.
 */

const { Op } = require("sequelize");
const { UserAppointments, User, UserHomes } = require("../../models");
const NotificationService = require("../NotificationService");
const Email = require("../sendNotifications/EmailClass");
const PushNotification = require("../sendNotifications/PushNotificationClass");
const EncryptionService = require("../EncryptionService");

/**
 * Process expired unassigned appointments
 * Finds appointments where date has passed and no cleaner was assigned
 * @param {Object} io - Socket.io instance for real-time notifications
 * @returns {Object} Summary of processed appointments
 */
async function processExpiredUnassignedAppointments(io = null) {
  const now = new Date();
  const results = { cancelled: 0, skipped: 0, errors: 0, refunded: 0 };

  try {
    // Get yesterday's date (we cancel the day AFTER the appointment)
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    yesterday.setHours(23, 59, 59, 999);
    const yesterdayStr = yesterday.toISOString().split("T")[0];

    console.log(
      `[UnassignedExpiredJob] Checking for unassigned appointments on or before ${yesterdayStr}`
    );

    // Find appointments that:
    // - Date is before today (yesterday or earlier)
    // - No cleaner assigned (hasBeenAssigned is false AND employeesAssigned is empty)
    // - Not assigned to a business employee
    // - Not waiting for client response (business owner booking pending)
    // - Not cancelled
    // - Not completed
    // - Not a demo appointment
    const expiredAppointments = await UserAppointments.findAll({
      where: {
        date: {
          [Op.lte]: yesterdayStr,
        },
        wasCancelled: { [Op.ne]: true },
        completed: false,
        isDemoAppointment: { [Op.ne]: true },
        // Exclude appointments waiting for client response
        clientResponsePending: { [Op.ne]: true },
        // Exclude appointments assigned to business employees
        assignedToBusinessEmployee: { [Op.ne]: true },
        // Only include truly unassigned appointments
        hasBeenAssigned: { [Op.ne]: true },
        [Op.or]: [
          { employeesAssigned: null },
          { employeesAssigned: [] },
        ],
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
          model: User,
          as: "bookedByCleaner",
          attributes: [
            "id",
            "firstName",
            "lastName",
            "email",
            "expoPushToken",
            "notifications",
            "notificationEmail",
          ],
          required: false,
        },
      ],
    });

    console.log(
      `[UnassignedExpiredJob] Found ${expiredAppointments.length} expired unassigned appointments`
    );

    for (const appointment of expiredAppointments) {
      try {
        const homeowner = appointment.user;

        if (!homeowner) {
          console.log(
            `[UnassignedExpiredJob] Skipping appointment ${appointment.id}: No homeowner found`
          );
          results.skipped++;
          continue;
        }

        // Get home address for notification
        let homeAddress = null;
        if (appointment.homeId) {
          const home = await UserHomes.findByPk(appointment.homeId);
          if (home) {
            homeAddress = {
              street: home.address,
              city: home.city,
              state: home.state,
              zipcode: home.zipcode,
            };
          }
        }

        // Cancel the appointment
        await appointment.update({
          wasCancelled: true,
          cancelledAt: now,
          cancellationType: "system",
          cancellationReason: "No cleaner was available for this appointment",
          cancellationConfirmedAt: now,
        });

        console.log(
          `[UnassignedExpiredJob] Cancelled appointment ${appointment.id}`
        );

        // Get decrypted user info for notifications
        const firstName = homeowner.firstName
          ? EncryptionService.decrypt(homeowner.firstName)
          : "";
        const lastName = homeowner.lastName
          ? EncryptionService.decrypt(homeowner.lastName)
          : "";
        const userName = `${firstName} ${lastName}`.trim() || "Valued Customer";
        const userEmail = homeowner.notificationEmail || homeowner.email;
        const decryptedEmail = userEmail
          ? EncryptionService.decrypt(userEmail)
          : null;

        // Send notifications to homeowner
        try {
          // In-app notification
          await NotificationService.notifyUser({
            userId: homeowner.id,
            type: "appointment_expired_unassigned",
            title: "Appointment Auto-Cancelled",
            message: `Your cleaning scheduled for ${appointment.date} was automatically cancelled because no cleaner was available. We apologize for the inconvenience.`,
            data: {
              appointmentId: appointment.id,
              date: appointment.date,
              reason: "no_cleaner_available",
            },
            io,
          });

          // Email notification
          if (decryptedEmail && homeAddress) {
            await Email.sendUnassignedExpiredNotification(
              decryptedEmail,
              homeAddress,
              userName,
              appointment.date
            );
          }

          // Push notification
          if (homeowner.expoPushToken && homeowner.notifications !== false) {
            await PushNotification.sendPushNotification(
              homeowner.expoPushToken,
              "Appointment Cancelled",
              `Your cleaning on ${appointment.date} was cancelled - no cleaner was available. Tap to rebook.`,
              {
                type: "appointment_expired_unassigned",
                appointmentId: appointment.id,
              }
            );
          }
        } catch (notifyError) {
          console.error(
            `[UnassignedExpiredJob] Error sending notifications for appointment ${appointment.id}:`,
            notifyError
          );
        }

        // Notify business owner if appointment was booked by them
        const businessOwner = appointment.bookedByCleaner;
        if (businessOwner && businessOwner.id !== homeowner.id) {
          try {
            const boFirstName = businessOwner.firstName
              ? EncryptionService.decrypt(businessOwner.firstName)
              : "";
            const boLastName = businessOwner.lastName
              ? EncryptionService.decrypt(businessOwner.lastName)
              : "";
            const boName = `${boFirstName} ${boLastName}`.trim() || "Business Owner";

            // In-app notification to business owner
            await NotificationService.notifyUser({
              userId: businessOwner.id,
              type: "booked_appointment_expired",
              title: "Booked Appointment Auto-Cancelled",
              message: `The appointment you booked for ${userName} on ${appointment.date} was automatically cancelled because no cleaner was assigned.`,
              data: {
                appointmentId: appointment.id,
                date: appointment.date,
                homeownerId: homeowner.id,
                reason: "no_cleaner_available",
              },
              io,
            });

            // Push notification to business owner
            if (businessOwner.expoPushToken && businessOwner.notifications !== false) {
              await PushNotification.sendPushNotification(
                businessOwner.expoPushToken,
                "Booked Appointment Cancelled",
                `Your booked appointment for ${userName} on ${appointment.date} was cancelled - no cleaner was assigned.`,
                {
                  type: "booked_appointment_expired",
                  appointmentId: appointment.id,
                }
              );
            }

            console.log(
              `[UnassignedExpiredJob] Notified business owner ${businessOwner.id} about cancelled appointment ${appointment.id}`
            );
          } catch (boNotifyError) {
            console.error(
              `[UnassignedExpiredJob] Error notifying business owner for appointment ${appointment.id}:`,
              boNotifyError
            );
          }
        }

        // Handle refund if payment was captured (edge case)
        if (appointment.paid && appointment.paymentIntentId) {
          try {
            // Note: Payment should typically only be captured when cleaner is assigned
            // This is a safety net for edge cases
            console.log(
              `[UnassignedExpiredJob] Appointment ${appointment.id} has payment - refund may be needed`
            );
            // TODO: Implement refund logic if needed
            // For now, just log it - payment shouldn't exist without cleaner assignment
            results.refunded++;
          } catch (refundError) {
            console.error(
              `[UnassignedExpiredJob] Error handling refund for appointment ${appointment.id}:`,
              refundError
            );
          }
        }

        results.cancelled++;
      } catch (error) {
        results.errors++;
        console.error(
          `[UnassignedExpiredJob] Error processing appointment ${appointment.id}:`,
          error
        );
      }
    }

    console.log(
      `[UnassignedExpiredJob] Completed. Cancelled: ${results.cancelled}, Skipped: ${results.skipped}, Errors: ${results.errors}, Refunds flagged: ${results.refunded}`
    );
    return results;
  } catch (error) {
    console.error("[UnassignedExpiredJob] Fatal error:", error);
    throw error;
  }
}

/**
 * Start the expired unassigned job as a recurring interval
 * @param {Object} io - Socket.io instance
 * @param {number} intervalMs - Interval in milliseconds (default: 24 hours)
 * @returns {Object} Interval reference for cleanup
 */
function startUnassignedExpiredJob(io, intervalMs = 24 * 60 * 60 * 1000) {
  console.log(
    `[UnassignedExpiredJob] Starting expired unassigned job (interval: ${intervalMs}ms)`
  );

  // Run once on startup to catch any appointments that expired while server was down
  processExpiredUnassignedAppointments(io).catch((err) => {
    console.error("[UnassignedExpiredJob] Error on initial run:", err);
  });

  // Then run on scheduled interval
  const interval = setInterval(() => {
    processExpiredUnassignedAppointments(io).catch((err) => {
      console.error("[UnassignedExpiredJob] Error on interval run:", err);
    });
  }, intervalMs);

  return interval;
}

module.exports = {
  processExpiredUnassignedAppointments,
  startUnassignedExpiredJob,
};
