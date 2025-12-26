const { Expo } = require("expo-server-sdk");

// Create a new Expo SDK client
const expo = new Expo();

// Helper function to format date (same as EmailClass)
const formatDate = (dateString) => {
  const options = {
    weekday: "long",
    month: "short",
    day: "numeric",
    year: "numeric",
  };
  return new Date(dateString).toLocaleDateString(undefined, options);
};

class PushNotification {
  // Check if a token is valid Expo push token
  static isValidExpoPushToken(token) {
    return Expo.isExpoPushToken(token);
  }

  // Core send method
  static async sendPushNotification(expoPushToken, title, body, data = {}) {
    if (!expoPushToken || !this.isValidExpoPushToken(expoPushToken)) {
      console.log("[Push] Invalid or missing Expo push token");
      return null;
    }

    const message = {
      to: expoPushToken,
      sound: "default",
      title,
      body,
      data,
    };

    try {
      const chunks = expo.chunkPushNotifications([message]);
      const tickets = [];

      for (const chunk of chunks) {
        const ticketChunk = await expo.sendPushNotificationsAsync(chunk);
        tickets.push(...ticketChunk);
      }

      console.log("[Push] Notification sent successfully");
      return tickets;
    } catch (error) {
      console.error("[Push] Error sending notification:", error);
      return null;
    }
  }

  // 1. Cancellation notification (to homeowner)
  static async sendPushCancellation(expoPushToken, userName, appointmentDate, address) {
    const fullAddress = `${address.street}, ${address.city}`;
    const title = "Appointment Cancelled";
    const body = `Hi ${userName}, your cleaning on ${formatDate(appointmentDate)} at ${fullAddress} has been cancelled. The appointment is still open for other cleaners.`;

    return this.sendPushNotification(expoPushToken, title, body, {
      type: "appointment_cancelled",
      appointmentDate,
    });
  }

  // 2. Confirmation notification (to homeowner)
  static async sendPushConfirmation(expoPushToken, userName, appointmentDate, address) {
    const fullAddress = `${address.street}, ${address.city}`;
    const title = "Cleaning Confirmed!";
    const body = `Great news ${userName}! A cleaner has confirmed your cleaning on ${formatDate(appointmentDate)} at ${fullAddress}.`;

    return this.sendPushNotification(expoPushToken, title, body, {
      type: "appointment_confirmed",
      appointmentDate,
    });
  }

  // 3. Employee Request notification (to homeowner)
  static async sendPushEmployeeRequest(expoPushToken, userName, cleanerName, cleanerRating, appointmentDate) {
    const ratingDisplay = cleanerRating !== "No ratings yet" ? ` (${cleanerRating} stars)` : "";
    const title = "New Cleaning Request";
    const body = `${cleanerName}${ratingDisplay} wants to clean your home on ${formatDate(appointmentDate)}. Tap to review.`;

    return this.sendPushNotification(expoPushToken, title, body, {
      type: "employee_request",
      appointmentDate,
    });
  }

  // 4. Request Approved notification (to cleaner)
  static async sendPushRequestApproved(expoPushToken, cleanerName, homeownerName, appointmentDate, address) {
    const fullAddress = `${address.street}, ${address.city}`;
    const title = "Request Approved!";
    const body = `Congrats ${cleanerName}! ${homeownerName} approved your request for ${formatDate(appointmentDate)} at ${fullAddress}.`;

    return this.sendPushNotification(expoPushToken, title, body, {
      type: "request_approved",
      appointmentDate,
    });
  }

  // 5. Request Denied notification (to cleaner)
  static async sendPushRequestDenied(expoPushToken, cleanerName, appointmentDate) {
    const title = "Request Update";
    const body = `Hi ${cleanerName}, your request for ${formatDate(appointmentDate)} was not approved. Check out other available jobs!`;

    return this.sendPushNotification(expoPushToken, title, body, {
      type: "request_denied",
      appointmentDate,
    });
  }

  // 6. Remove Request notification (to homeowner)
  static async sendPushRemoveRequest(expoPushToken, userName, appointmentDate) {
    const title = "Request Withdrawn";
    const body = `Hi ${userName}, a cleaner withdrew their request for ${formatDate(appointmentDate)}. Your appointment is still open.`;

    return this.sendPushNotification(expoPushToken, title, body, {
      type: "request_removed",
      appointmentDate,
    });
  }

  // 7. New Message notification
  static async sendPushNewMessage(expoPushToken, userName, senderName, messagePreview) {
    const truncatedMessage = messagePreview.length > 50
      ? messagePreview.substring(0, 50) + "..."
      : messagePreview;
    const title = `Message from ${senderName}`;
    const body = truncatedMessage;

    return this.sendPushNotification(expoPushToken, title, body, {
      type: "new_message",
      senderName,
    });
  }

  // 8. Broadcast notification
  static async sendPushBroadcast(expoPushToken, userName, broadcastTitle, content) {
    const truncatedContent = content.length > 100
      ? content.substring(0, 100) + "..."
      : content;

    return this.sendPushNotification(expoPushToken, broadcastTitle, truncatedContent, {
      type: "broadcast",
    });
  }

  // 9. New Application notification (to owners)
  static async sendPushNewApplication(expoPushToken, applicantName) {
    const title = "New Cleaner Application";
    const body = `${applicantName} submitted a new cleaner application. Tap to review.`;

    return this.sendPushNotification(expoPushToken, title, body, {
      type: "new_application",
      applicantName,
    });
  }

  // 10. Unassigned Appointment Warning (to homeowner)
  static async sendPushUnassignedWarning(expoPushToken, userName, appointmentDate, address) {
    const fullAddress = `${address.street}, ${address.city}`;
    const title = "Appointment Reminder";
    const body = `Hi ${userName}, your cleaning on ${formatDate(appointmentDate)} at ${fullAddress} has no cleaner assigned yet. We're working on it!`;

    return this.sendPushNotification(expoPushToken, title, body, {
      type: "unassigned_warning",
      appointmentDate,
    });
  }

  // 11. Username Recovery
  static async sendPushUsernameRecovery(expoPushToken, username) {
    const title = "Username Recovery";
    const body = `Your Kleanr username is: ${username}`;

    return this.sendPushNotification(expoPushToken, title, body, {
      type: "username_recovery",
    });
  }

  // 12. Password Reset
  static async sendPushPasswordReset(expoPushToken, username) {
    const title = "Password Reset";
    const body = `Hi ${username}, your password has been reset. Check your email for the temporary password.`;

    return this.sendPushNotification(expoPushToken, title, body, {
      type: "password_reset",
    });
  }

  // Home Size Adjustment Push Notifications

  // 13. Home size adjustment request (to homeowner)
  static async sendPushHomeSizeAdjustment(expoPushToken, userName, cleanerName, priceDifference) {
    const title = "Home Size Discrepancy";
    const priceText = priceDifference > 0 ? ` (+$${priceDifference.toFixed(2)})` : "";
    const body = `Hi ${userName}, ${cleanerName} reports your home is larger than on file${priceText}. Tap to review and respond.`;

    return this.sendPushNotification(expoPushToken, title, body, {
      type: "home_size_adjustment",
    });
  }

  // 14. Adjustment approved (to cleaner)
  static async sendPushAdjustmentApproved(expoPushToken, cleanerName, address) {
    const title = "Adjustment Approved";
    const body = `Hi ${cleanerName}, your home size report for ${address} was approved. The home details have been updated.`;

    return this.sendPushNotification(expoPushToken, title, body, {
      type: "adjustment_approved",
    });
  }

  // 15. Adjustment needs owner review (to owner)
  static async sendPushAdjustmentNeedsReview(expoPushToken, requestId) {
    const title = "Dispute Needs Review";
    const body = `A homeowner has denied a home size adjustment. Please review request #${requestId}.`;

    return this.sendPushNotification(expoPushToken, title, body, {
      type: "adjustment_needs_review",
      requestId: String(requestId),
    });
  }

  // 16. Adjustment resolved (to both parties)
  static async sendPushAdjustmentResolved(expoPushToken, userName, approved) {
    const title = approved ? "Dispute Resolved - Approved" : "Dispute Resolved - Denied";
    const body = approved
      ? `Hi ${userName}, the owner approved the home size adjustment. Details updated.`
      : `Hi ${userName}, the owner has denied the home size adjustment request.`;

    return this.sendPushNotification(expoPushToken, title, body, {
      type: "adjustment_resolved",
      approved,
    });
  }

  // 17. Payment failed reminder
  static async sendPushPaymentFailed(expoPushToken, userName, appointmentDate, daysRemaining) {
    const title = "⚠️ Payment Failed";
    const body = `Hi ${userName}, payment failed for your ${appointmentDate} appointment. Please retry payment in the app. Cancellation in ${daysRemaining} day${daysRemaining !== 1 ? "s" : ""}.`;

    return this.sendPushNotification(expoPushToken, title, body, {
      type: "payment_failed",
      daysRemaining,
    });
  }

  // 18. Supply reminder (to cleaner - morning of appointment)
  static async sendPushSupplyReminder(expoPushToken, cleanerName, appointmentDate, address) {
    const fullAddress = `${address.street}, ${address.city}`;
    const title = "Don't Forget Your Supplies!";
    const body = `Hi ${cleanerName}! Before heading to ${fullAddress} today, remember to bring: toilet paper, paper towels, and trash bags.`;

    return this.sendPushNotification(expoPushToken, title, body, {
      type: "supply_reminder",
      appointmentDate,
      canSnooze: true,
      snoozeAction: "snooze-supply-reminder",
    });
  }
}

module.exports = PushNotification;
