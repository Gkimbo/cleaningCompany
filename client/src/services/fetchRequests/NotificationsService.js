/**
 * NotificationsService - Client-side service for notifications API calls
 */

import { API_BASE } from "../config";

class NotificationsService {
  /**
   * Get all notifications for the authenticated user
   * @param {string} token - Auth token
   * @param {number} page - Page number (default: 1)
   * @param {number} limit - Items per page (default: 20)
   * @param {boolean} unreadOnly - Filter to unread only
   * @returns {Object} { notifications, pagination }
   */
  static async getNotifications(token, page = 1, limit = 20, unreadOnly = false) {
    try {
      const url = `${API_BASE}/notifications?page=${page}&limit=${limit}&unreadOnly=${unreadOnly}`;
      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      return await response.json();
    } catch (error) {
      console.error("Error fetching notifications:", error);
      return { notifications: [], pagination: { total: 0 } };
    }
  }

  /**
   * Get unread notification count
   * @param {string} token - Auth token
   * @returns {Object} { unreadCount, actionRequiredCount }
   */
  static async getUnreadCount(token) {
    try {
      const response = await fetch(`${API_BASE}/notifications/unread-count`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      return await response.json();
    } catch (error) {
      console.error("Error fetching unread count:", error);
      return { unreadCount: 0, actionRequiredCount: 0 };
    }
  }

  /**
   * Get notifications requiring user action
   * @param {string} token - Auth token
   * @returns {Object} { notifications }
   */
  static async getActionRequired(token) {
    try {
      const response = await fetch(`${API_BASE}/notifications/action-required`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      return await response.json();
    } catch (error) {
      console.error("Error fetching action-required notifications:", error);
      return { notifications: [] };
    }
  }

  /**
   * Get a single notification by ID
   * @param {string} token - Auth token
   * @param {number} notificationId - Notification ID
   * @returns {Object} { notification }
   */
  static async getNotificationById(token, notificationId) {
    try {
      const response = await fetch(`${API_BASE}/notifications/${notificationId}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      return await response.json();
    } catch (error) {
      console.error("Error fetching notification:", error);
      return { notification: null };
    }
  }

  /**
   * Mark a notification as read
   * @param {string} token - Auth token
   * @param {number} notificationId - Notification ID
   * @returns {Object} { message, notification }
   */
  static async markAsRead(token, notificationId) {
    try {
      const response = await fetch(`${API_BASE}/notifications/${notificationId}/read`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      return await response.json();
    } catch (error) {
      console.error("Error marking notification as read:", error);
      return { error: "Failed to mark as read" };
    }
  }

  /**
   * Mark all notifications as read
   * @param {string} token - Auth token
   * @returns {Object} { message, updatedCount }
   */
  static async markAllAsRead(token) {
    try {
      const response = await fetch(`${API_BASE}/notifications/mark-all-read`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      return await response.json();
    } catch (error) {
      console.error("Error marking all as read:", error);
      return { error: "Failed to mark all as read" };
    }
  }

  /**
   * Delete a notification
   * @param {string} token - Auth token
   * @param {number} notificationId - Notification ID
   * @returns {Object} { message }
   */
  static async deleteNotification(token, notificationId) {
    try {
      const response = await fetch(`${API_BASE}/notifications/${notificationId}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      return await response.json();
    } catch (error) {
      console.error("Error deleting notification:", error);
      return { error: "Failed to delete notification" };
    }
  }

  /**
   * Get pending approval appointments (for clients)
   * @param {string} token - Auth token
   * @returns {Object} { appointments }
   */
  static async getPendingApprovalAppointments(token) {
    try {
      const response = await fetch(`${API_BASE}/appointments/pending-approval`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      return await response.json();
    } catch (error) {
      console.error("Error fetching pending approval appointments:", error);
      return { appointments: [] };
    }
  }

  /**
   * Respond to a pending booking (accept or decline)
   * @param {string} token - Auth token
   * @param {number} appointmentId - Appointment ID
   * @param {string} action - 'accept' or 'decline'
   * @param {string} declineReason - Optional reason for declining
   * @param {string[]} suggestedDates - Optional suggested alternative dates
   * @returns {Object} { message, appointment }
   */
  static async respondToBooking(token, appointmentId, action, declineReason = null, suggestedDates = null) {
    try {
      const response = await fetch(`${API_BASE}/appointments/${appointmentId}/respond`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          action,
          declineReason,
          suggestedDates,
        }),
      });
      return await response.json();
    } catch (error) {
      console.error("Error responding to booking:", error);
      return { error: "Failed to respond to booking" };
    }
  }

  /**
   * Book appointment for a client (business owner only)
   * @param {string} token - Auth token
   * @param {number} cleanerClientId - CleanerClient relationship ID
   * @param {Object} bookingData - { date, price, timeWindow, notes }
   * @returns {Object} { message, appointment }
   */
  static async bookForClient(token, cleanerClientId, bookingData) {
    try {
      const response = await fetch(`${API_BASE}/cleaner-clients/${cleanerClientId}/book-for-client`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(bookingData),
      });
      return await response.json();
    } catch (error) {
      console.error("Error booking for client:", error);
      return { error: "Failed to create booking" };
    }
  }

  /**
   * Rebook after a declined appointment (business owner only)
   * @param {string} token - Auth token
   * @param {number} originalAppointmentId - Original declined appointment ID
   * @param {Object} bookingData - { date, price, timeWindow }
   * @returns {Object} { message, appointment }
   */
  static async rebookAppointment(token, originalAppointmentId, bookingData) {
    try {
      const response = await fetch(`${API_BASE}/appointments/${originalAppointmentId}/rebook`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(bookingData),
      });
      return await response.json();
    } catch (error) {
      console.error("Error rebooking appointment:", error);
      return { error: "Failed to create rebooking" };
    }
  }

  /**
   * Get pending bookings for a client relationship (business owner only)
   * @param {string} token - Auth token
   * @param {number} cleanerClientId - CleanerClient relationship ID
   * @returns {Object} { pendingBookings }
   */
  static async getPendingBookingsForClient(token, cleanerClientId) {
    try {
      const response = await fetch(`${API_BASE}/cleaner-clients/${cleanerClientId}/pending-bookings`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      return await response.json();
    } catch (error) {
      console.error("Error fetching pending bookings:", error);
      return { pendingBookings: [] };
    }
  }

  // =====================================
  // New Home Request Methods
  // =====================================

  /**
   * Accept a new home request (business owner only)
   * @param {string} token - Auth token
   * @param {number} requestId - NewHomeRequest ID
   * @returns {Object} { success, message, request, cleanerClient }
   */
  static async acceptNewHomeRequest(token, requestId) {
    try {
      const response = await fetch(`${API_BASE}/new-home-requests/${requestId}/accept`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      });
      return await response.json();
    } catch (error) {
      console.error("Error accepting new home request:", error);
      return { success: false, error: "Failed to accept request" };
    }
  }

  /**
   * Decline a new home request (business owner only)
   * @param {string} token - Auth token
   * @param {number} requestId - NewHomeRequest ID
   * @param {string} reason - Optional decline reason
   * @returns {Object} { success, message, request }
   */
  static async declineNewHomeRequest(token, requestId, reason = null) {
    try {
      const response = await fetch(`${API_BASE}/new-home-requests/${requestId}/decline`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ reason }),
      });
      return await response.json();
    } catch (error) {
      console.error("Error declining new home request:", error);
      return { success: false, error: "Failed to decline request" };
    }
  }

  /**
   * Get new home request status for a home (client only)
   * @param {string} token - Auth token
   * @param {number} homeId - Home ID
   * @returns {Object} { success, requests, isMarketplaceEnabled }
   */
  static async getNewHomeRequestStatus(token, homeId) {
    try {
      const response = await fetch(`${API_BASE}/new-home-requests/${homeId}/status`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      return await response.json();
    } catch (error) {
      console.error("Error fetching new home request status:", error);
      return { success: false, requests: [], isMarketplaceEnabled: false };
    }
  }

  /**
   * Toggle marketplace visibility for a home (client only)
   * @param {string} token - Auth token
   * @param {number} homeId - Home ID
   * @param {boolean} enabled - Whether to enable marketplace
   * @returns {Object} { success, message, isMarketplaceEnabled }
   */
  static async toggleHomeMarketplace(token, homeId, enabled) {
    try {
      const response = await fetch(`${API_BASE}/new-home-requests/${homeId}/marketplace`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ enabled }),
      });
      return await response.json();
    } catch (error) {
      console.error("Error toggling marketplace:", error);
      return { success: false, error: "Failed to update marketplace setting" };
    }
  }

  /**
   * Re-request cleaning for a declined home (client only)
   * @param {string} token - Auth token
   * @param {number} requestId - NewHomeRequest ID
   * @returns {Object} { success, message, request }
   */
  static async requestAgain(token, requestId) {
    try {
      const response = await fetch(`${API_BASE}/new-home-requests/${requestId}/request-again`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      });
      return await response.json();
    } catch (error) {
      console.error("Error re-requesting:", error);
      return { success: false, error: "Failed to send request" };
    }
  }
}

export default NotificationsService;
