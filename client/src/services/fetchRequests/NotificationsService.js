/**
 * NotificationsService - Client-side service for notifications API calls
 */

import HttpClient from "../HttpClient";

class NotificationsService {
  /**
   * Get all notifications for the authenticated user
   */
  static async getNotifications(token, page = 1, limit = 20, unreadOnly = false) {
    const result = await HttpClient.get(`/notifications?page=${page}&limit=${limit}&unreadOnly=${unreadOnly}`, { token });

    if (result.success === false) {
      if (__DEV__) console.warn("[Notifications] getNotifications failed:", result.error);
      return { notifications: [], pagination: { total: 0 } };
    }

    return result;
  }

  /**
   * Get unread notification count
   */
  static async getUnreadCount(token) {
    const result = await HttpClient.get("/notifications/unread-count", { token });

    if (result.success === false) {
      if (__DEV__) console.warn("[Notifications] getUnreadCount failed:", result.error);
      return { unreadCount: 0, actionRequiredCount: 0 };
    }

    return result;
  }

  /**
   * Get notifications requiring user action
   */
  static async getActionRequired(token) {
    const result = await HttpClient.get("/notifications/action-required", { token });

    if (result.success === false) {
      if (__DEV__) console.warn("[Notifications] getActionRequired failed:", result.error);
      return { notifications: [] };
    }

    return result;
  }

  /**
   * Get a single notification by ID
   */
  static async getNotificationById(token, notificationId) {
    const result = await HttpClient.get(`/notifications/${notificationId}`, { token });

    if (result.success === false) {
      if (__DEV__) console.warn("[Notifications] getNotificationById failed:", result.error);
      return { notification: null };
    }

    return result;
  }

  /**
   * Mark a notification as read
   */
  static async markAsRead(token, notificationId) {
    const result = await HttpClient.patch(`/notifications/${notificationId}/read`, {}, { token });

    if (result.success === false) {
      return { error: result.error || "Failed to mark as read" };
    }

    return result;
  }

  /**
   * Mark all notifications as read
   */
  static async markAllAsRead(token) {
    const result = await HttpClient.post("/notifications/mark-all-read", {}, { token });

    if (result.success === false) {
      return { error: result.error || "Failed to mark all as read" };
    }

    return result;
  }

  /**
   * Delete a notification
   */
  static async deleteNotification(token, notificationId) {
    const result = await HttpClient.delete(`/notifications/${notificationId}`, { token });

    if (result.success === false) {
      return { error: result.error || "Failed to delete notification" };
    }

    return result;
  }

  /**
   * Get pending approval appointments (for clients)
   */
  static async getPendingApprovalAppointments(token) {
    const result = await HttpClient.get("/appointments/pending-approval", { token });

    if (result.success === false) {
      if (__DEV__) console.warn("[Notifications] getPendingApprovalAppointments failed:", result.error);
      return { appointments: [] };
    }

    return result;
  }

  /**
   * Respond to a pending booking (accept or decline)
   */
  static async respondToBooking(token, appointmentId, action, declineReason = null, suggestedDates = null) {
    const result = await HttpClient.post(
      `/appointments/${appointmentId}/respond`,
      { action, declineReason, suggestedDates },
      { token }
    );

    if (result.success === false) {
      return { error: result.error || "Failed to respond to booking" };
    }

    return result;
  }

  /**
   * Book appointment for a client (business owner only)
   */
  static async bookForClient(token, cleanerClientId, bookingData) {
    const result = await HttpClient.post(`/cleaner-clients/${cleanerClientId}/book-for-client`, bookingData, { token });

    if (result.success === false) {
      return { error: result.error || "Failed to create booking" };
    }

    return result;
  }

  /**
   * Rebook after a declined appointment (business owner only)
   */
  static async rebookAppointment(token, originalAppointmentId, bookingData) {
    const result = await HttpClient.post(`/appointments/${originalAppointmentId}/rebook`, bookingData, { token });

    if (result.success === false) {
      return { error: result.error || "Failed to create rebooking" };
    }

    return result;
  }

  /**
   * Get pending bookings for a client relationship (business owner only)
   */
  static async getPendingBookingsForClient(token, cleanerClientId) {
    const result = await HttpClient.get(`/cleaner-clients/${cleanerClientId}/pending-bookings`, { token });

    if (result.success === false) {
      if (__DEV__) console.warn("[Notifications] getPendingBookingsForClient failed:", result.error);
      return { pendingBookings: [] };
    }

    return result;
  }

  // =====================================
  // New Home Request Methods
  // =====================================

  /**
   * Accept a new home request (business owner only)
   */
  static async acceptNewHomeRequest(token, requestId) {
    const result = await HttpClient.post(`/new-home-requests/${requestId}/accept`, {}, { token });

    if (result.success === false) {
      return { success: false, error: result.error || "Failed to accept request" };
    }

    return result;
  }

  /**
   * Decline a new home request (business owner only)
   */
  static async declineNewHomeRequest(token, requestId, reason = null) {
    const result = await HttpClient.post(`/new-home-requests/${requestId}/decline`, { reason }, { token });

    if (result.success === false) {
      return { success: false, error: result.error || "Failed to decline request" };
    }

    return result;
  }

  /**
   * Get new home request status for a home (client only)
   */
  static async getNewHomeRequestStatus(token, homeId) {
    const result = await HttpClient.get(`/new-home-requests/${homeId}/status`, { token });

    if (result.success === false) {
      return { success: false, requests: [], isMarketplaceEnabled: false };
    }

    return result;
  }

  /**
   * Toggle marketplace visibility for a home (client only)
   */
  static async toggleHomeMarketplace(token, homeId, enabled) {
    const result = await HttpClient.patch(`/new-home-requests/${homeId}/marketplace`, { enabled }, { token });

    if (result.success === false) {
      return { success: false, error: result.error || "Failed to update marketplace setting" };
    }

    return result;
  }

  /**
   * Re-request cleaning for a declined home (client only)
   */
  static async requestAgain(token, requestId) {
    const result = await HttpClient.post(`/new-home-requests/${requestId}/request-again`, {}, { token });

    if (result.success === false) {
      return { success: false, error: result.error || "Failed to send request" };
    }

    return result;
  }
}

export default NotificationsService;
