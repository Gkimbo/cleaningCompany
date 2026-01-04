const { Notification, User } = require("../models");
const PushNotification = require("./sendNotifications/PushNotificationClass");
const Email = require("./sendNotifications/EmailClass");

// Helper function to format date
const formatDate = (dateString) => {
  const options = {
    weekday: "long",
    month: "short",
    day: "numeric",
    year: "numeric",
  };
  return new Date(dateString).toLocaleDateString(undefined, options);
};

/**
 * Unified Notification Service
 * Handles creating in-app notifications, sending push/email, and emitting socket events
 */
class NotificationService {
  /**
   * Create an in-app notification
   */
  static async createNotification({
    userId,
    type,
    title,
    body,
    data = {},
    actionRequired = false,
    relatedAppointmentId = null,
    relatedCleanerClientId = null,
    expiresAt = null,
  }) {
    try {
      const notification = await Notification.create({
        userId,
        type,
        title,
        body,
        data,
        actionRequired,
        relatedAppointmentId,
        relatedCleanerClientId,
        expiresAt,
      });

      console.log(`[NotificationService] Created in-app notification for user ${userId}: ${type}`);
      return notification;
    } catch (error) {
      console.error("[NotificationService] Error creating notification:", error);
      throw error;
    }
  }

  /**
   * Send multi-channel notification (in-app + push + email + socket)
   * @param {Object} params - Notification parameters
   * @param {Object} io - Socket.io instance for real-time updates
   */
  static async notifyUser({
    userId,
    type,
    title,
    body,
    data = {},
    actionRequired = false,
    relatedAppointmentId = null,
    relatedCleanerClientId = null,
    expiresAt = null,
    sendPush = true,
    sendEmail = true,
    emailOptions = null, // { template, templateData } for custom emails
    io = null,
  }) {
    try {
      // 1. Get user for push token and email preferences
      const user = await User.findByPk(userId);
      if (!user) {
        console.error(`[NotificationService] User ${userId} not found`);
        return null;
      }

      // 2. Create in-app notification
      const notification = await this.createNotification({
        userId,
        type,
        title,
        body,
        data,
        actionRequired,
        relatedAppointmentId,
        relatedCleanerClientId,
        expiresAt,
      });

      // 3. Send push notification if user has token
      if (sendPush && user.expoPushToken) {
        await PushNotification.sendPushNotification(
          user.expoPushToken,
          title,
          body,
          { ...data, notificationId: notification.id, type }
        );
      }

      // 4. Emit socket event for real-time update
      if (io) {
        io.to(`user_${userId}`).emit("notification", {
          notification: {
            id: notification.id,
            type,
            title,
            body,
            data,
            actionRequired,
            createdAt: notification.createdAt,
            expiresAt,
          },
        });

        // Also emit unread count update
        const unreadCount = await Notification.getUnreadCount(userId);
        io.to(`user_${userId}`).emit("notification_count_update", { unreadCount });
      }

      // 5. Send email if user has notifications enabled and emailOptions provided
      if (sendEmail && emailOptions && user.notifications?.includes("email")) {
        const emailAddress = user.getNotificationEmail ? user.getNotificationEmail() : user.email;
        if (emailAddress && emailOptions.sendFunction) {
          await emailOptions.sendFunction(emailAddress, ...emailOptions.args);
        }
      }

      return notification;
    } catch (error) {
      console.error("[NotificationService] Error sending notification:", error);
      throw error;
    }
  }

  /**
   * Notify client about a pending booking from their business owner
   */
  static async notifyPendingBooking({
    clientId,
    cleanerId,
    appointmentId,
    appointmentDate,
    price,
    cleanerName,
    io = null,
  }) {
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 48); // 48 hours from now

    return this.notifyUser({
      userId: clientId,
      type: "pending_booking",
      title: "New Booking Request",
      body: `${cleanerName} has scheduled a cleaning for ${formatDate(appointmentDate)}. Tap to accept or decline.`,
      data: {
        appointmentId,
        appointmentDate,
        price,
        cleanerId,
        cleanerName,
      },
      actionRequired: true,
      relatedAppointmentId: appointmentId,
      expiresAt,
      sendPush: true,
      sendEmail: true,
      emailOptions: {
        sendFunction: Email.sendPendingBookingEmail,
        args: [appointmentDate, price, cleanerName, expiresAt],
      },
      io,
    });
  }

  /**
   * Notify business owner that client accepted the booking
   */
  static async notifyBookingAccepted({
    cleanerId,
    clientId,
    appointmentId,
    appointmentDate,
    clientName,
    io = null,
  }) {
    return this.notifyUser({
      userId: cleanerId,
      type: "booking_accepted",
      title: "Booking Accepted!",
      body: `${clientName} has accepted your booking for ${formatDate(appointmentDate)}.`,
      data: {
        appointmentId,
        appointmentDate,
        clientId,
        clientName,
      },
      actionRequired: false,
      relatedAppointmentId: appointmentId,
      sendPush: true,
      sendEmail: true,
      emailOptions: {
        sendFunction: Email.sendBookingAcceptedEmail,
        args: [appointmentDate, clientName],
      },
      io,
    });
  }

  /**
   * Notify business owner that client declined the booking
   */
  static async notifyBookingDeclined({
    cleanerId,
    clientId,
    appointmentId,
    appointmentDate,
    clientName,
    declineReason = null,
    suggestedDates = null,
    io = null,
  }) {
    const hasSuggestions = suggestedDates && suggestedDates.length > 0;
    const body = hasSuggestions
      ? `${clientName} declined your booking for ${formatDate(appointmentDate)} but suggested alternative dates.`
      : `${clientName} declined your booking for ${formatDate(appointmentDate)}.${declineReason ? ` Reason: ${declineReason}` : ""}`;

    return this.notifyUser({
      userId: cleanerId,
      type: "booking_declined",
      title: "Booking Declined",
      body,
      data: {
        appointmentId,
        appointmentDate,
        clientId,
        clientName,
        declineReason,
        suggestedDates,
      },
      actionRequired: hasSuggestions, // Action required if there are suggested dates to rebook
      relatedAppointmentId: appointmentId,
      sendPush: true,
      sendEmail: true,
      emailOptions: {
        sendFunction: Email.sendBookingDeclinedEmail,
        args: [appointmentDate, clientName, declineReason, suggestedDates],
      },
      io,
    });
  }

  /**
   * Notify business owner that booking expired (client didn't respond in 48 hours)
   */
  static async notifyBookingExpired({
    cleanerId,
    clientId,
    appointmentId,
    appointmentDate,
    clientName,
    io = null,
  }) {
    return this.notifyUser({
      userId: cleanerId,
      type: "booking_expired",
      title: "Booking Expired",
      body: `Your booking for ${clientName} on ${formatDate(appointmentDate)} has expired. The client didn't respond within 48 hours.`,
      data: {
        appointmentId,
        appointmentDate,
        clientId,
        clientName,
      },
      actionRequired: true, // Can rebook
      relatedAppointmentId: appointmentId,
      sendPush: true,
      sendEmail: true,
      emailOptions: {
        sendFunction: Email.sendBookingExpiredEmail,
        args: [appointmentDate, clientName],
      },
      io,
    });
  }

  /**
   * Notify client that a rebooked appointment is available
   */
  static async notifyRebooking({
    clientId,
    cleanerId,
    appointmentId,
    appointmentDate,
    price,
    cleanerName,
    rebookingAttempt,
    io = null,
  }) {
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 48);

    return this.notifyUser({
      userId: clientId,
      type: "pending_booking",
      title: "New Booking Request",
      body: `${cleanerName} has rescheduled your cleaning to ${formatDate(appointmentDate)}. Tap to accept or decline.`,
      data: {
        appointmentId,
        appointmentDate,
        price,
        cleanerId,
        cleanerName,
        rebookingAttempt,
      },
      actionRequired: true,
      relatedAppointmentId: appointmentId,
      expiresAt,
      sendPush: true,
      sendEmail: true,
      emailOptions: {
        sendFunction: Email.sendPendingBookingEmail,
        args: [appointmentDate, price, cleanerName, expiresAt],
      },
      io,
    });
  }

  /**
   * Get pending booking notifications for a user
   */
  static async getPendingBookingNotifications(userId) {
    return Notification.findAll({
      where: {
        userId,
        type: "pending_booking",
        actionRequired: true,
        isRead: false,
      },
      order: [["createdAt", "DESC"]],
    });
  }

  /**
   * Mark notification as read when action is taken
   */
  static async markAsActioned(notificationId) {
    const notification = await Notification.findByPk(notificationId);
    if (notification) {
      await notification.update({
        isRead: true,
        actionRequired: false,
      });
    }
    return notification;
  }

  /**
   * Clean up expired notifications
   */
  static async cleanupExpiredNotifications() {
    const { Op } = require("sequelize");
    const now = new Date();

    const deleted = await Notification.destroy({
      where: {
        expiresAt: {
          [Op.lt]: now,
        },
      },
    });

    console.log(`[NotificationService] Cleaned up ${deleted} expired notifications`);
    return deleted;
  }
}

module.exports = NotificationService;
