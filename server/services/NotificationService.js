const { Notification, User } = require("../models");
const { Op } = require("sequelize");
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

  // ============================================
  // Multi-Cleaner Job Notification Helpers
  // ============================================

  /**
   * Notify cleaner about a multi-cleaner job offer
   */
  static async notifyMultiCleanerOffer({
    cleanerId,
    appointmentId,
    multiCleanerJobId,
    earningsAmount,
    roomAssignments,
    appointmentDate,
    io = null,
  }) {
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 48);

    return this.notifyUser({
      userId: cleanerId,
      type: "multi_cleaner_offer",
      title: "Multi-Cleaner Job Available",
      body: `$${(earningsAmount / 100).toFixed(2)} for a multi-cleaner job on ${formatDate(appointmentDate)}. Tap to view details.`,
      data: {
        appointmentId,
        multiCleanerJobId,
        earningsAmount,
        roomAssignments,
      },
      actionRequired: true,
      relatedAppointmentId: appointmentId,
      expiresAt,
      sendPush: true,
      sendEmail: true,
      io,
    });
  }

  /**
   * Notify when a multi-cleaner slot is filled
   */
  static async notifySlotFilled({
    userId,
    appointmentId,
    multiCleanerJobId,
    remainingSlots,
    newCleanerName,
    io = null,
  }) {
    const body = remainingSlots > 0
      ? `${newCleanerName} has joined the job. ${remainingSlots} slot(s) remaining.`
      : `${newCleanerName} has joined. All slots are now filled!`;

    return this.notifyUser({
      userId,
      type: "multi_cleaner_slot_filled",
      title: "Co-cleaner joined",
      body,
      data: {
        appointmentId,
        multiCleanerJobId,
        remainingSlots,
      },
      relatedAppointmentId: appointmentId,
      sendPush: true,
      sendEmail: false,
      io,
    });
  }

  /**
   * Notify about urgent need to fill multi-cleaner slots
   */
  static async notifyUrgentFill({
    cleanerId,
    appointmentId,
    multiCleanerJobId,
    daysRemaining,
    earningsAmount,
    io = null,
  }) {
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24);

    return this.notifyUser({
      userId: cleanerId,
      type: "multi_cleaner_urgent",
      title: "Urgent: Job needs cleaners!",
      body: `$${(earningsAmount / 100).toFixed(2)} for a job in ${daysRemaining} days. Tap to join now!`,
      data: {
        appointmentId,
        multiCleanerJobId,
        earningsAmount,
        daysRemaining,
      },
      actionRequired: true,
      relatedAppointmentId: appointmentId,
      expiresAt,
      sendPush: true,
      sendEmail: true,
      io,
    });
  }

  /**
   * Notify about co-cleaner dropout
   */
  static async notifyCleanerDropout({
    userId,
    appointmentId,
    multiCleanerJobId,
    remainingCleaners,
    isHomeowner,
    options = [],
    io = null,
  }) {
    const title = isHomeowner
      ? "Cleaner update for your appointment"
      : "Co-cleaner unavailable";

    const body = isHomeowner
      ? `One cleaner is no longer available. ${remainingCleaners} cleaner(s) still assigned.`
      : `A co-cleaner has dropped out. You may be offered to complete the job solo for full pay.`;

    return this.notifyUser({
      userId,
      type: "cleaner_dropout",
      title,
      body,
      data: {
        appointmentId,
        multiCleanerJobId,
        remainingCleaners,
        options,
      },
      actionRequired: !isHomeowner, // Cleaners need to take action
      relatedAppointmentId: appointmentId,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      sendPush: true,
      sendEmail: true,
      io,
    });
  }

  /**
   * Offer solo completion to remaining cleaner
   */
  static async notifySoloCompletionOffer({
    cleanerId,
    appointmentId,
    multiCleanerJobId,
    bonusAmount,
    appointmentDate,
    io = null,
  }) {
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 12);

    return this.notifyUser({
      userId: cleanerId,
      type: "solo_completion_offer",
      title: "Complete job solo for full pay",
      body: `You can complete the ${formatDate(appointmentDate)} job solo for $${(bonusAmount / 100).toFixed(2)}. Respond within 12 hours.`,
      data: {
        appointmentId,
        multiCleanerJobId,
        bonusAmount,
      },
      actionRequired: true,
      relatedAppointmentId: appointmentId,
      expiresAt,
      sendPush: true,
      sendEmail: true,
      io,
    });
  }

  /**
   * Notify about partial job completion
   */
  static async notifyPartialCompletion({
    homeownerId,
    appointmentId,
    multiCleanerJobId,
    completedRooms,
    totalRooms,
    options = [],
    io = null,
  }) {
    const percentage = Math.round((completedRooms / totalRooms) * 100);

    return this.notifyUser({
      userId: homeownerId,
      type: "partial_completion",
      title: "Partial cleaning complete",
      body: `Your cleaning is ${percentage}% complete (${completedRooms}/${totalRooms} rooms). Tap to view options.`,
      data: {
        appointmentId,
        multiCleanerJobId,
        completedRooms,
        totalRooms,
        percentage,
        options,
      },
      actionRequired: true,
      relatedAppointmentId: appointmentId,
      sendPush: true,
      sendEmail: true,
      io,
    });
  }

  // =====================================
  // Business Employee Notifications
  // =====================================

  /**
   * Notify an employee that they have been assigned to a job
   */
  static async notifyEmployeeJobAssigned({
    employeeUserId,
    employeeName,
    appointmentId,
    appointmentDate,
    clientName,
    address,
    payAmount,
    businessName,
    io = null,
  }) {
    const formattedDate = formatDate(appointmentDate);
    const payDisplay = payAmount ? `$${(payAmount / 100).toFixed(2)}` : "";

    return this.notifyUser({
      userId: employeeUserId,
      type: "employee_job_assigned",
      title: "New job assigned",
      body: `You've been assigned a cleaning on ${formattedDate}${payDisplay ? ` for ${payDisplay}` : ""}.`,
      data: {
        appointmentId,
        appointmentDate,
        clientName,
        address,
        payAmount,
      },
      actionRequired: false,
      relatedAppointmentId: appointmentId,
      sendPush: true,
      sendEmail: true,
      emailOptions: {
        sendFunction: Email.sendEmployeeJobAssigned,
        args: [employeeName, appointmentDate, clientName, address, payAmount, businessName],
      },
      io,
    });
  }

  /**
   * Notify an employee that their job has been reassigned
   */
  static async notifyEmployeeJobReassigned({
    employeeUserId,
    appointmentId,
    appointmentDate,
    io = null,
  }) {
    const formattedDate = formatDate(appointmentDate);

    return this.notifyUser({
      userId: employeeUserId,
      type: "employee_job_reassigned",
      title: "Job reassigned",
      body: `Your job on ${formattedDate} has been reassigned to another team member.`,
      data: {
        appointmentId,
        appointmentDate,
      },
      actionRequired: false,
      relatedAppointmentId: appointmentId,
      sendPush: true,
      sendEmail: false,
      io,
    });
  }

  /**
   * Notify an employee that their pay has been changed
   */
  static async notifyEmployeePayChanged({
    employeeUserId,
    appointmentId,
    appointmentDate,
    oldPay,
    newPay,
    io = null,
  }) {
    const formattedDate = formatDate(appointmentDate);
    const oldPayDisplay = `$${(oldPay / 100).toFixed(2)}`;
    const newPayDisplay = `$${(newPay / 100).toFixed(2)}`;

    return this.notifyUser({
      userId: employeeUserId,
      type: "employee_pay_changed",
      title: "Pay updated",
      body: `Pay for your ${formattedDate} job changed from ${oldPayDisplay} to ${newPayDisplay}.`,
      data: {
        appointmentId,
        appointmentDate,
        oldPay,
        newPay,
      },
      actionRequired: false,
      relatedAppointmentId: appointmentId,
      sendPush: true,
      sendEmail: false,
      io,
    });
  }

  /**
   * Notify business owner that an employee accepted their invite
   */
  static async notifyEmployeeAcceptedInvite({
    businessOwnerId,
    employeeName,
    io = null,
  }) {
    return this.notifyUser({
      userId: businessOwnerId,
      type: "employee_accepted_invite",
      title: "New team member",
      body: `${employeeName} has joined your team!`,
      data: {
        employeeName,
      },
      actionRequired: false,
      sendPush: true,
      sendEmail: false,
      io,
    });
  }

  /**
   * Notify business owner that an employee started a job
   */
  static async notifyEmployeeJobStarted({
    businessOwnerId,
    employeeName,
    appointmentId,
    clientName,
    io = null,
  }) {
    return this.notifyUser({
      userId: businessOwnerId,
      type: "employee_started_job",
      title: "Job started",
      body: `${employeeName} has started the cleaning for ${clientName}.`,
      data: {
        employeeName,
        appointmentId,
        clientName,
      },
      actionRequired: false,
      relatedAppointmentId: appointmentId,
      sendPush: true,
      sendEmail: false,
      io,
    });
  }

  /**
   * Notify business owner that an employee completed a job
   */
  static async notifyEmployeeJobCompleted({
    businessOwnerId,
    employeeName,
    appointmentId,
    clientName,
    io = null,
  }) {
    return this.notifyUser({
      userId: businessOwnerId,
      type: "employee_completed_job",
      title: "Job completed",
      body: `${employeeName} has completed the cleaning for ${clientName}.`,
      data: {
        employeeName,
        appointmentId,
        clientName,
      },
      actionRequired: false,
      relatedAppointmentId: appointmentId,
      sendPush: true,
      sendEmail: false,
      io,
    });
  }

  /**
   * Notify client when cleaner changes their cleaning price
   */
  static async notifyPriceChange({
    clientId,
    cleanerId,
    cleanerName,
    businessName,
    oldPrice,
    newPrice,
    homeAddress,
    io = null,
  }) {
    try {
      const client = await User.findByPk(clientId);
      if (!client) {
        console.error(`[NotificationService] Client ${clientId} not found for price change notification`);
        return { success: false, error: "Client not found" };
      }

      const clientName = client.firstName || "there";
      const displayName = businessName || cleanerName;
      const oldPriceDisplay = `$${(oldPrice / 100).toFixed(2)}`;
      const newPriceDisplay = `$${(newPrice / 100).toFixed(2)}`;

      // 1. Create in-app notification
      const notification = await this.createNotification({
        userId: clientId,
        type: "price_change",
        title: "Cleaning Price Updated",
        body: `${displayName} updated your cleaning price from ${oldPriceDisplay} to ${newPriceDisplay}`,
        data: {
          cleanerId,
          oldPrice,
          newPrice,
          homeAddress,
        },
        actionRequired: false,
      });

      // 2. Send push notification if client has token
      if (client.expoPushToken) {
        await PushNotification.sendPushNotification(
          client.expoPushToken,
          "Cleaning Price Updated",
          `Your cleaning price has been updated to ${newPriceDisplay}`,
          { type: "price_change", cleanerId }
        );
      }

      // 3. Send email notification
      if (client.email) {
        await Email.sendPriceChangeNotification({
          clientEmail: client.email,
          clientName,
          cleanerName,
          businessName,
          oldPrice,
          newPrice,
          homeAddress,
        });
      }

      // 4. Emit socket event for real-time update
      if (io) {
        io.to(`user_${clientId}`).emit("notification", {
          type: "price_change",
          notification,
        });
        // Update unread count
        const unreadCount = await Notification.count({
          where: { userId: clientId, read: false },
        });
        io.to(`user_${clientId}`).emit("unreadNotifications", unreadCount);
      }

      console.log(`[NotificationService] Price change notification sent to client ${clientId}`);
      return { success: true, notification };
    } catch (error) {
      console.error("[NotificationService] Price change notification error:", error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Find an active (non-expired) notification of a specific type
   * @param {number} userId - User ID
   * @param {string} type - Notification type
   * @param {number} appointmentId - Related appointment ID
   * @returns {Promise<Object|null>} Active notification or null
   */
  static async findActiveNotification(userId, type, appointmentId) {
    if (!userId) return null;

    const now = new Date();
    const notification = await Notification.findOne({
      where: {
        userId,
        type,
        [Op.or]: [
          { expiresAt: null },
          { expiresAt: { [Op.gt]: now } },
        ],
      },
      order: [["createdAt", "DESC"]],
    });

    // Check if notification data matches the appointment
    if (notification && notification.data) {
      const data = typeof notification.data === "string"
        ? JSON.parse(notification.data)
        : notification.data;
      if (data.appointmentId === appointmentId) {
        return notification;
      }
    }

    return null;
  }

  /**
   * Find an expired notification of a specific type
   * @param {number} userId - User ID
   * @param {string} type - Notification type
   * @param {number} appointmentId - Related appointment ID
   * @returns {Promise<Object|null>} Expired notification or null
   */
  static async findExpiredNotification(userId, type, appointmentId) {
    if (!userId) return null;

    const now = new Date();
    const notification = await Notification.findOne({
      where: {
        userId,
        type,
        expiresAt: { [Op.lt]: now },
      },
      order: [["createdAt", "DESC"]],
    });

    // Check if notification data matches the appointment
    if (notification && notification.data) {
      const data = typeof notification.data === "string"
        ? JSON.parse(notification.data)
        : notification.data;
      if (data.appointmentId === appointmentId) {
        return notification;
      }
    }

    return null;
  }
}

module.exports = NotificationService;
