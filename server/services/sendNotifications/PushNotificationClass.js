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

  // 9. New Application notification (to managers)
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
}

module.exports = PushNotification;
