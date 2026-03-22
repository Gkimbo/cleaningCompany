/**
 * CleanerClientService - Client-side service for cleaner-client API calls
 */

import HttpClient from "../HttpClient";

class CleanerClientService {
  // =====================
  // CLEANER ENDPOINTS
  // =====================

  /**
   * Invite a new client
   */
  static async inviteClient(token, clientData) {
    const result = await HttpClient.post("/cleaner-clients/invite", clientData, { token });

    if (result.success === false) {
      if (__DEV__) console.warn("[CleanerClient] inviteClient failed:", result.error);
      return { success: false, error: result.error || "Failed to send invitation" };
    }

    return result;
  }

  /**
   * Get all clients for the authenticated cleaner
   */
  static async getClients(token, status = null) {
    const url = status ? `/cleaner-clients?status=${status}` : "/cleaner-clients";
    const result = await HttpClient.get(url, { token });

    if (result.success === false) {
      if (__DEV__) console.warn("[CleanerClient] getClients failed:", result.error);
      return { clients: [] };
    }

    return result;
  }

  /**
   * Get a specific client relationship
   */
  static async getClient(token, clientId) {
    const result = await HttpClient.get(`/cleaner-clients/${clientId}`, { token });

    if (result.success === false) {
      if (__DEV__) console.warn("[CleanerClient] getClient failed:", result.error);
      return null;
    }

    return result;
  }

  /**
   * Get full client details with home info and appointments
   */
  static async getClientFull(token, clientId) {
    const result = await HttpClient.get(`/cleaner-clients/${clientId}/full`, { token });

    if (result.success === false) {
      return { error: result.error || "Failed to fetch client details" };
    }

    return result;
  }

  /**
   * Update home details for a client
   */
  static async updateClientHome(token, clientId, updates) {
    const result = await HttpClient.patch(`/cleaner-clients/${clientId}/home`, updates, { token });

    if (result.success === false) {
      return { success: false, error: result.error || "Failed to update home details" };
    }

    return result;
  }

  /**
   * Update a client relationship
   */
  static async updateClient(token, clientId, updates) {
    const result = await HttpClient.patch(`/cleaner-clients/${clientId}`, updates, { token });

    if (result.success === false) {
      return { success: false, error: result.error || "Failed to update client" };
    }

    return result;
  }

  /**
   * Deactivate a client relationship
   */
  static async deactivateClient(token, clientId) {
    const result = await HttpClient.delete(`/cleaner-clients/${clientId}`, { token });

    if (result.success === false) {
      return { success: false, error: result.error || "Failed to deactivate client" };
    }

    return result;
  }

  /**
   * Resend an invitation email
   */
  static async resendInvite(token, clientId) {
    const result = await HttpClient.post(`/cleaner-clients/${clientId}/resend-invite`, {}, { token });

    if (result.success === false) {
      return { success: false, error: result.error || "Failed to resend invitation" };
    }

    return result;
  }

  /**
   * Book an appointment for a linked client (cleaner-initiated booking)
   */
  static async bookForClient(token, clientId, bookingData) {
    const result = await HttpClient.post(`/cleaner-clients/${clientId}/book-for-client`, bookingData, { token });

    if (result.success === false) {
      return { success: false, error: result.error || "Failed to book appointment" };
    }

    return result;
  }

  // =====================
  // PUBLIC ENDPOINTS (for invitation acceptance)
  // =====================

  /**
   * Validate an invitation token
   */
  static async validateInvitation(inviteToken) {
    const result = await HttpClient.get(`/cleaner-clients/invitations/${inviteToken}`, { skipAuth: true });

    if (result.success === false) {
      return { valid: false, error: result.error || "Failed to validate invitation" };
    }

    return result;
  }

  /**
   * Accept an invitation and create account
   */
  static async acceptInvitation(inviteToken, userData) {
    const result = await HttpClient.post(`/cleaner-clients/invitations/${inviteToken}/accept`, userData, { skipAuth: true });

    if (result.success === false) {
      return { success: false, error: result.error || "Failed to accept invitation" };
    }

    return result;
  }

  /**
   * Decline an invitation
   */
  static async declineInvitation(inviteToken) {
    const result = await HttpClient.post(`/cleaner-clients/invitations/${inviteToken}/decline`, {}, { skipAuth: true });

    if (result.success === false) {
      return { success: false, error: result.error || "Failed to decline invitation" };
    }

    return result;
  }

  // =====================
  // RECURRING SCHEDULES
  // =====================

  /**
   * Create a recurring schedule for a client
   */
  static async createRecurringSchedule(token, scheduleData) {
    const result = await HttpClient.post("/recurring-schedules", scheduleData, { token });

    if (result.success === false) {
      return { success: false, error: result.error || "Failed to create recurring schedule" };
    }

    return result;
  }

  /**
   * Get all recurring schedules for the cleaner
   */
  static async getRecurringSchedules(token, cleanerClientId = null) {
    const url = cleanerClientId
      ? `/recurring-schedules?cleanerClientId=${cleanerClientId}&activeOnly=true`
      : "/recurring-schedules?activeOnly=true";
    const result = await HttpClient.get(url, { token });

    if (result.success === false) {
      if (__DEV__) console.warn("[CleanerClient] getRecurringSchedules failed:", result.error);
      return { schedules: [] };
    }

    return result;
  }

  /**
   * Get a specific recurring schedule
   */
  static async getRecurringSchedule(token, scheduleId) {
    const result = await HttpClient.get(`/recurring-schedules/${scheduleId}`, { token });

    if (result.success === false) {
      if (__DEV__) console.warn("[CleanerClient] getRecurringSchedule failed:", result.error);
      return null;
    }

    return result;
  }

  /**
   * Update a recurring schedule
   */
  static async updateRecurringSchedule(token, scheduleId, updates) {
    const result = await HttpClient.patch(`/recurring-schedules/${scheduleId}`, updates, { token });

    if (result.success === false) {
      return { success: false, error: result.error || "Failed to update recurring schedule" };
    }

    return result;
  }

  /**
   * Delete (deactivate) a recurring schedule
   */
  static async deleteRecurringSchedule(token, scheduleId, cancelFutureAppointments = false) {
    const url = cancelFutureAppointments
      ? `/recurring-schedules/${scheduleId}?cancelFutureAppointments=true`
      : `/recurring-schedules/${scheduleId}`;
    const result = await HttpClient.delete(url, { token });

    if (result.success === false) {
      return { success: false, error: result.error || "Failed to delete recurring schedule" };
    }

    return result;
  }

  /**
   * Pause a recurring schedule
   */
  static async pauseRecurringSchedule(token, scheduleId, until = null, reason = null) {
    const result = await HttpClient.post(`/recurring-schedules/${scheduleId}/pause`, { until, reason }, { token });

    if (result.success === false) {
      return { success: false, error: result.error || "Failed to pause recurring schedule" };
    }

    return result;
  }

  /**
   * Resume a paused recurring schedule
   */
  static async resumeRecurringSchedule(token, scheduleId) {
    const result = await HttpClient.post(`/recurring-schedules/${scheduleId}/resume`, {}, { token });

    if (result.success === false) {
      return { success: false, error: result.error || "Failed to resume recurring schedule" };
    }

    return result;
  }

  // =====================
  // PREFERRED CLEANER ENDPOINTS
  // =====================

  /**
   * Get all client appointments for the business owner
   */
  static async getClientAppointments(token) {
    const result = await HttpClient.get("/preferred-cleaner/my-client-appointments", { token });

    if (result.success === false) {
      if (__DEV__) console.warn("[CleanerClient] getClientAppointments failed:", result.error);
      return { pending: [], declined: [], upcoming: [] };
    }

    return result;
  }

  /**
   * Get appointments booked FOR clients that are awaiting their response
   */
  static async getPendingClientResponses(token) {
    const result = await HttpClient.get("/cleaner-clients/pending-client-responses", { token });

    if (result.success === false) {
      if (__DEV__) console.warn("[CleanerClient] getPendingClientResponses failed:", result.error);
      return { pending: [], declined: [], expired: [], total: 0 };
    }

    return result;
  }

  /**
   * Accept an appointment from a client
   */
  static async acceptClientAppointment(token, appointmentId) {
    const result = await HttpClient.post(`/preferred-cleaner/appointments/${appointmentId}/accept`, {}, { token });

    if (result.success === false) {
      return { success: false, error: result.error || "Failed to accept appointment" };
    }

    return result;
  }

  /**
   * Decline an appointment from a client
   */
  static async declineClientAppointment(token, appointmentId) {
    const result = await HttpClient.post(`/preferred-cleaner/appointments/${appointmentId}/decline`, {}, { token });

    if (result.success === false) {
      return { success: false, error: result.error || "Failed to decline appointment" };
    }

    return result;
  }

  // =====================
  // HOMEOWNER ENDPOINTS (for responding to declined appointments)
  // =====================

  /**
   * Get appointments where the preferred cleaner declined and needs client response
   */
  static async getPendingResponses(token) {
    const result = await HttpClient.get("/preferred-cleaner/pending-responses", { token });

    if (result.success === false) {
      if (__DEV__) console.warn("[CleanerClient] getPendingResponses failed:", result.error);
      return { appointments: [] };
    }

    return result;
  }

  /**
   * Respond to a declined appointment
   */
  static async respondToDecline(token, appointmentId, action) {
    const result = await HttpClient.post(`/preferred-cleaner/appointments/${appointmentId}/respond`, { action }, { token });

    if (result.success === false) {
      return { success: false, error: result.error || "Failed to respond" };
    }

    return result;
  }

  /**
   * Cancel a pending booking request that was sent to a client
   */
  static async cancelBookingRequest(token, appointmentId) {
    const result = await HttpClient.delete(`/cleaner-clients/pending-client-responses/${appointmentId}`, { token });

    if (result.success === false) {
      return { success: false, error: result.error || "Failed to cancel booking request" };
    }

    return result;
  }

  /**
   * Get platform price for a client's home
   */
  static async getPlatformPrice(token, cleanerClientId) {
    const result = await HttpClient.get(`/cleaner-clients/${cleanerClientId}/platform-price`, { token });

    if (result.success === false) {
      return { error: result.error || "Failed to fetch platform price" };
    }

    return result;
  }

  /**
   * Update the default price for a client
   */
  static async updateDefaultPrice(token, cleanerClientId, price) {
    const result = await HttpClient.patch(`/cleaner-clients/${cleanerClientId}/default-price`, { price }, { token });

    if (result.success === false) {
      return { success: false, error: result.error || "Failed to update price" };
    }

    return result;
  }
}

export default CleanerClientService;
