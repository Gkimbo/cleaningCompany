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

  // 19. Message reaction notification
  static async sendPushReaction(expoPushToken, reactorName, emoji, messagePreview) {
    const truncatedMessage = messagePreview.length > 30
      ? messagePreview.substring(0, 30) + "..."
      : messagePreview;
    const title = `${reactorName} reacted ${emoji}`;
    const body = `to your message: "${truncatedMessage}"`;

    return this.sendPushNotification(expoPushToken, title, body, {
      type: "message_reaction",
      reactorName,
      emoji,
    });
  }

  // 20. Cleaning completed notification (to homeowner)
  static async sendPushCleaningCompleted(expoPushToken, userName, appointmentDate, address) {
    const fullAddress = `${address.street}, ${address.city}`;
    const title = "Your Home is Sparkling Clean! ✨";
    const body = `Hi ${userName}! Your cleaning on ${formatDate(appointmentDate)} at ${fullAddress} is complete. Log in to leave a review!`;

    return this.sendPushNotification(expoPushToken, title, body, {
      type: "cleaning_completed",
      appointmentDate,
      requiresReview: true,
    });
  }

  // 21. Review reminder notification (to homeowner)
  static async sendPushReviewReminder(expoPushToken, userName, pendingReviewCount) {
    const title = "Don't Forget to Review! ⭐";
    const body = `Hi ${userName}! You have ${pendingReviewCount} cleaning${pendingReviewCount > 1 ? 's' : ''} waiting for your review. Your feedback helps our cleaners!`;

    return this.sendPushNotification(expoPushToken, title, body, {
      type: "review_reminder",
      pendingReviewCount,
    });
  }

  // ==========================================
  // CLEANER CLIENT ONBOARDING NOTIFICATIONS
  // ==========================================

  // 22. Client invitation accepted (to cleaner)
  static async sendPushInvitationAccepted(expoPushToken, cleanerName, clientName) {
    const title = "New Client Joined! 🎉";
    const body = `${clientName} accepted your invitation and is now on Kleanr. View them in My Clients.`;

    return this.sendPushNotification(expoPushToken, title, body, {
      type: "invitation_accepted",
      clientName,
    });
  }

  // 23. Recurring schedule created (to client)
  static async sendPushRecurringScheduleCreated(expoPushToken, clientName, cleanerName, frequency) {
    const frequencyText = frequency === 'weekly' ? 'weekly' : frequency === 'biweekly' ? 'bi-weekly' : 'monthly';
    const title = "Recurring Cleaning Set Up 📅";
    const body = `Hi ${clientName}! ${cleanerName} set up ${frequencyText} cleanings for you. View your schedule in the app.`;

    return this.sendPushNotification(expoPushToken, title, body, {
      type: "recurring_schedule_created",
      frequency,
    });
  }

  // 24. Cleaner booked appointment (to client - no approval needed)
  static async sendPushCleanerBookedAppointment(expoPushToken, clientName, cleanerName, appointmentDate, address) {
    const fullAddress = `${address.street}, ${address.city}`;
    const title = "Cleaning Scheduled! 🧹";
    const body = `Hi ${clientName}! ${cleanerName} booked a cleaning for ${formatDate(appointmentDate)} at ${fullAddress}.`;

    return this.sendPushNotification(expoPushToken, title, body, {
      type: "cleaner_booked_appointment",
      appointmentDate,
    });
  }

  // 25. Auto-payment processed (to client)
  static async sendPushAutoPaymentProcessed(expoPushToken, clientName, amount, appointmentDate) {
    const title = "Payment Processed ✅";
    const body = `Hi ${clientName}! $${amount.toFixed(2)} was charged for your cleaning on ${formatDate(appointmentDate)}. View receipt in app.`;

    return this.sendPushNotification(expoPushToken, title, body, {
      type: "auto_payment_processed",
      amount,
      appointmentDate,
    });
  }

  // 26. Payout received (to cleaner)
  static async sendPushPayoutReceived(expoPushToken, cleanerName, amount, clientName) {
    const title = "Payout on the Way! 💰";
    const body = `Hi ${cleanerName}! $${amount.toFixed(2)} is being sent to your bank for the ${clientName} cleaning.`;

    return this.sendPushNotification(expoPushToken, title, body, {
      type: "payout_received",
      amount,
    });
  }

  // 27. Upcoming cleaner-booked cleaning reminder (to client)
  static async sendPushUpcomingCleanerBookedCleaning(expoPushToken, clientName, cleanerName, appointmentDate, address) {
    const fullAddress = `${address.street}, ${address.city}`;
    const title = "Cleaning Tomorrow! 🏠";
    const body = `Hi ${clientName}! ${cleanerName} will clean your home at ${fullAddress} tomorrow. Payment will be charged after completion.`;

    return this.sendPushNotification(expoPushToken, title, body, {
      type: "upcoming_cleaner_booked",
      appointmentDate,
    });
  }

  // 28. Recurring schedule paused (to client)
  static async sendPushRecurringSchedulePaused(expoPushToken, clientName, cleanerName, pausedUntil) {
    const title = "Schedule Paused ⏸️";
    const body = pausedUntil
      ? `Hi ${clientName}! Your recurring cleanings with ${cleanerName} are paused until ${formatDate(pausedUntil)}.`
      : `Hi ${clientName}! Your recurring cleanings with ${cleanerName} have been paused.`;

    return this.sendPushNotification(expoPushToken, title, body, {
      type: "recurring_schedule_paused",
      pausedUntil,
    });
  }

  // 29. Recurring schedule resumed (to client)
  static async sendPushRecurringScheduleResumed(expoPushToken, clientName, cleanerName, nextDate) {
    const title = "Schedule Resumed ▶️";
    const body = `Hi ${clientName}! Your recurring cleanings with ${cleanerName} are back on. Next cleaning: ${formatDate(nextDate)}.`;

    return this.sendPushNotification(expoPushToken, title, body, {
      type: "recurring_schedule_resumed",
      nextDate,
    });
  }

  // 30. Suspicious activity report (to HR/Owner)
  static async sendPushSuspiciousActivityReport(expoPushToken, staffName, reporterName, reportedUserName, pendingCount) {
    const title = "⚠️ Suspicious Activity Report";
    const body = `${reporterName} reported ${reportedUserName} for suspicious messaging. You have ${pendingCount} pending report${pendingCount !== 1 ? 's' : ''} to review.`;

    return this.sendPushNotification(expoPushToken, title, body, {
      type: "suspicious_activity_report",
      reporterName,
      reportedUserName,
      pendingCount,
    });
  }

  // ==========================================
  // BUSINESS OWNER BOOKING NOTIFICATIONS
  // ==========================================

  // 31. Pending booking request (to client - needs approval)
  static async sendPushPendingBooking(expoPushToken, clientName, cleanerName, appointmentDate, expiresInHours = 48) {
    const title = "New Booking Request 📅";
    const body = `Hi ${clientName}! ${cleanerName} has scheduled a cleaning for ${formatDate(appointmentDate)}. Accept or decline within ${expiresInHours} hours.`;

    return this.sendPushNotification(expoPushToken, title, body, {
      type: "pending_booking",
      appointmentDate,
      cleanerName,
      actionRequired: true,
    });
  }

  // 32. Booking accepted (to business owner)
  static async sendPushBookingAccepted(expoPushToken, cleanerName, clientName, appointmentDate) {
    const title = "Booking Accepted! ✅";
    const body = `Great news ${cleanerName}! ${clientName} accepted your booking for ${formatDate(appointmentDate)}.`;

    return this.sendPushNotification(expoPushToken, title, body, {
      type: "booking_accepted",
      appointmentDate,
      clientName,
    });
  }

  // 33. Booking declined (to business owner)
  static async sendPushBookingDeclined(expoPushToken, cleanerName, clientName, appointmentDate, hasSuggestedDates = false) {
    const title = "Booking Declined";
    const body = hasSuggestedDates
      ? `${clientName} declined your booking for ${formatDate(appointmentDate)} but suggested alternative dates. Tap to view.`
      : `${clientName} declined your booking for ${formatDate(appointmentDate)}. You can rebook another date.`;

    return this.sendPushNotification(expoPushToken, title, body, {
      type: "booking_declined",
      appointmentDate,
      clientName,
      hasSuggestedDates,
      actionRequired: hasSuggestedDates,
    });
  }

  // 34. Booking expired (to business owner - client didn't respond)
  static async sendPushBookingExpired(expoPushToken, cleanerName, clientName, appointmentDate) {
    const title = "Booking Request Expired ⏰";
    const body = `Your booking request for ${clientName} on ${formatDate(appointmentDate)} has expired. The client didn't respond in time.`;

    return this.sendPushNotification(expoPushToken, title, body, {
      type: "booking_expired",
      appointmentDate,
      clientName,
      actionRequired: true, // Can rebook
    });
  }

  // ============================================================================
  // EDGE CASE MULTI-CLEANER PUSH NOTIFICATIONS
  // ============================================================================

  // 35. Edge case decision required (to homeowner)
  static async sendPushEdgeCaseDecision(expoPushToken, homeownerName, cleanerName, appointmentDate, decisionHours) {
    const title = "Action Needed: 1 Cleaner Confirmed ⏰";
    const body = `${cleanerName} is confirmed for your ${appointmentDate} cleaning, but we need a 2nd cleaner. Tap to choose: proceed with 1 or cancel with no fees. You have ${decisionHours}h to decide.`;

    return this.sendPushNotification(expoPushToken, title, body, {
      type: "edge_case_decision_required",
      appointmentDate,
      cleanerName,
      decisionHours,
      actionRequired: true,
    });
  }

  // 36. Edge case cleaner confirmed (to cleaner)
  static async sendPushEdgeCaseCleanerConfirmed(expoPushToken, cleanerName, appointmentDate, address) {
    const title = "You're Confirmed! ✅";
    const body = `You're confirmed for the ${appointmentDate} cleaning at ${address}. You'll receive full pay. A 2nd cleaner may still join.`;

    return this.sendPushNotification(expoPushToken, title, body, {
      type: "edge_case_cleaner_confirmed",
      appointmentDate,
      address,
    });
  }

  // 37. Edge case cleaner cancelled (to cleaner)
  static async sendPushEdgeCaseCleanerCancelled(expoPushToken, cleanerName, appointmentDate, address) {
    const title = "Job Cancelled";
    const body = `The ${appointmentDate} cleaning at ${address} was cancelled because no 2nd cleaner was found. Check the app for more jobs!`;

    return this.sendPushNotification(expoPushToken, title, body, {
      type: "edge_case_cleaner_cancelled",
      appointmentDate,
      address,
    });
  }

  // 38. Edge case second cleaner joined (to original cleaner)
  static async sendPushEdgeCaseSecondCleanerJoined(expoPushToken, originalCleanerName, newCleanerName, appointmentDate) {
    const title = `${newCleanerName} joined your team! 👥`;
    const body = `Good news! ${newCleanerName} will be cleaning with you on ${appointmentDate}. Payment will be split.`;

    return this.sendPushNotification(expoPushToken, title, body, {
      type: "edge_case_second_cleaner_joined",
      appointmentDate,
      newCleanerName,
    });
  }

  // ==========================================
  // 2-STEP COMPLETION CONFIRMATION NOTIFICATIONS
  // ==========================================

  // 39. Completion awaiting approval (to homeowner)
  static async sendPushCompletionAwaitingApproval(expoPushToken, appointmentDate, cleanerName) {
    const title = "Cleaning Complete! ✨";
    const body = `${cleanerName} finished cleaning on ${appointmentDate}. Please review and approve in the app.`;

    return this.sendPushNotification(expoPushToken, title, body, {
      type: "completion_awaiting_approval",
      appointmentDate,
      cleanerName,
      requiresAction: true,
    });
  }

  // 40. Completion approved (to cleaner)
  static async sendPushCompletionApproved(expoPushToken, appointmentDate, payoutAmount) {
    const formattedPayout = payoutAmount ? `$${parseFloat(payoutAmount).toFixed(2)}` : "your payment";
    const title = "Job Approved! 🎉";
    const body = `Your cleaning on ${appointmentDate} was approved! ${formattedPayout} is on the way.`;

    return this.sendPushNotification(expoPushToken, title, body, {
      type: "completion_approved",
      appointmentDate,
      payoutAmount,
    });
  }

  // 41. Completion auto-approved (to homeowner)
  static async sendPushCompletionAutoApproved(expoPushToken, appointmentDate, recipient = "homeowner") {
    if (recipient === "homeowner") {
      const title = "Cleaning Auto-Approved";
      const body = `Your cleaning on ${appointmentDate} was auto-approved. Payment sent to cleaner.`;

      return this.sendPushNotification(expoPushToken, title, body, {
        type: "completion_auto_approved",
        appointmentDate,
      });
    } else {
      // For cleaner
      const title = "Job Auto-Approved! 🎉";
      const body = `Your cleaning on ${appointmentDate} was auto-approved! Payment is on the way.`;

      return this.sendPushNotification(expoPushToken, title, body, {
        type: "completion_auto_approved",
        appointmentDate,
      });
    }
  }

  // ==========================================
  // CANCELLATION APPEAL NOTIFICATIONS
  // ==========================================

  // 42. Appeal submitted confirmation (to user)
  static async sendPushAppealSubmitted(expoPushToken, userName, appointmentDate, confirmationId) {
    const title = "Appeal Received 📋";
    const body = `Your appeal for the ${appointmentDate} cancellation has been received. We'll review it within 48 hours. Reference: ${confirmationId}`;

    return this.sendPushNotification(expoPushToken, title, body, {
      type: "appeal_submitted",
      appointmentDate,
      confirmationId,
    });
  }

  // 43. Appeal assigned (to HR/reviewer)
  static async sendPushAppealAssigned(expoPushToken, reviewerName, appealId, priority, category) {
    const priorityLabel = priority === "urgent" ? "🔴 URGENT" : priority === "high" ? "🟠 HIGH PRIORITY" : "";
    const title = `New Appeal Assigned ${priorityLabel}`;
    const body = `You've been assigned appeal #${appealId} (${category}). Please review within SLA deadline.`;

    return this.sendPushNotification(expoPushToken, title, body, {
      type: "appeal_assigned",
      appealId,
      priority,
      category,
      actionRequired: true,
    });
  }

  // 44. Appeal approved (to user)
  static async sendPushAppealApproved(expoPushToken, userName, appointmentDate, refundAmount) {
    const refundText = refundAmount ? ` A refund of $${(refundAmount / 100).toFixed(2)} has been processed.` : "";
    const title = "Appeal Approved! ✅";
    const body = `Good news! Your appeal for the ${appointmentDate} cancellation was approved.${refundText}`;

    return this.sendPushNotification(expoPushToken, title, body, {
      type: "appeal_approved",
      appointmentDate,
      refundAmount,
    });
  }

  // 45. Appeal partially approved (to user)
  static async sendPushAppealPartiallyApproved(expoPushToken, userName, appointmentDate, resolutionSummary) {
    const title = "Appeal Partially Approved";
    const body = `Your appeal for the ${appointmentDate} cancellation has been reviewed. ${resolutionSummary || "Some relief has been granted."}`;

    return this.sendPushNotification(expoPushToken, title, body, {
      type: "appeal_partially_approved",
      appointmentDate,
      resolutionSummary,
    });
  }

  // 46. Appeal denied (to user)
  static async sendPushAppealDenied(expoPushToken, userName, appointmentDate) {
    const title = "Appeal Decision";
    const body = `Your appeal for the ${appointmentDate} cancellation was reviewed. Unfortunately, we couldn't grant relief. Check the app for details.`;

    return this.sendPushNotification(expoPushToken, title, body, {
      type: "appeal_denied",
      appointmentDate,
    });
  }

  // 47. Appeal documents requested (to user)
  static async sendPushAppealDocumentsRequested(expoPushToken, userName, appointmentDate) {
    const title = "Documents Needed 📄";
    const body = `To complete your appeal for the ${appointmentDate} cancellation, we need supporting documents. Please upload them in the app.`;

    return this.sendPushNotification(expoPushToken, title, body, {
      type: "appeal_documents_requested",
      appointmentDate,
      actionRequired: true,
    });
  }

  // 48. Appeal SLA warning (to HR/reviewer)
  static async sendPushAppealSLAWarning(expoPushToken, reviewerName, appealId, hoursRemaining) {
    const title = "⚠️ SLA Warning";
    const body = `Appeal #${appealId} needs response within ${hoursRemaining} hours to meet SLA.`;

    return this.sendPushNotification(expoPushToken, title, body, {
      type: "appeal_sla_warning",
      appealId,
      hoursRemaining,
      actionRequired: true,
    });
  }

  // 49. Appeal SLA breached (to HR manager/owner)
  static async sendPushAppealSLABreached(expoPushToken, staffName, appealId, assignedTo) {
    const title = "🔴 SLA Breach Alert";
    const body = `Appeal #${appealId} has exceeded SLA deadline. ${assignedTo ? `Assigned to reviewer #${assignedTo}` : "Unassigned"}. Immediate attention required.`;

    return this.sendPushNotification(expoPushToken, title, body, {
      type: "appeal_sla_breached",
      appealId,
      assignedTo,
      actionRequired: true,
    });
  }

  // =========================================================================
  // Auto-Complete Reminder Notifications
  // =========================================================================

  // 50. Auto-complete reminder to cleaner
  static async sendPushAutoCompleteReminder(expoPushToken, date, address, reminderNum, minutesLeft) {
    const hoursLeft = Math.floor(minutesLeft / 60);
    const timeRemaining = hoursLeft > 0 ? `${hoursLeft} hours` : `${minutesLeft} minutes`;

    const titles = {
      1: "Don't Forget! 📋",
      2: "Reminder: Complete Job 📋",
      3: "Important: Job Completion ⚠️",
      4: "URGENT: Complete Now! ⚠️",
      5: "FINAL: Auto-Complete Soon! 🚨",
    };

    const bodies = {
      1: `Please mark your job on ${date} complete.`,
      2: `${timeRemaining} left to mark your ${date} job complete.`,
      3: `${timeRemaining} remaining! Complete your ${date} job now.`,
      4: `Only ~1 hour left! Mark your ${date} job complete now.`,
      5: `Job will auto-complete in ${minutesLeft} min. Act now!`,
    };

    const title = titles[reminderNum] || titles[1];
    const body = bodies[reminderNum] || bodies[1];

    return this.sendPushNotification(expoPushToken, title, body, {
      type: "auto_complete_reminder",
      date,
      address,
      reminderNum,
      minutesLeft,
      actionRequired: true,
    });
  }

  // 51. Job auto-completed notification to cleaner
  static async sendPushJobAutoCompleted(expoPushToken, date) {
    const title = "Job Auto-Completed 🤖";
    const body = `Your job on ${date} was automatically marked complete. Homeowner has 24 hours to review.`;

    return this.sendPushNotification(expoPushToken, title, body, {
      type: "job_auto_completed",
      date,
    });
  }

  // 52. Job auto-completed notification to homeowner
  static async sendPushJobAutoCompletedHomeowner(expoPushToken, date, cleanerName) {
    const title = "Cleaning Complete! 🏠";
    const body = `${cleanerName}'s cleaning on ${date} is done. Please review within 24 hours.`;

    return this.sendPushNotification(expoPushToken, title, body, {
      type: "job_auto_completed_homeowner",
      date,
      cleanerName,
      actionRequired: true,
    });
  }
}

module.exports = PushNotification;
