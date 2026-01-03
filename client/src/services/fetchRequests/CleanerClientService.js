/**
 * CleanerClientService - Client-side service for cleaner-client API calls
 */

import { API_BASE } from "../config";

class CleanerClientService {
  // =====================
  // CLEANER ENDPOINTS
  // =====================

  /**
   * Invite a new client
   * @param {string} token - Auth token
   * @param {Object} clientData - Client information
   * @returns {Object} { success, cleanerClient, error }
   */
  static async inviteClient(token, clientData) {
    try {
      const response = await fetch(`${API_BASE}/cleaner-clients/invite`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(clientData),
      });
      return await response.json();
    } catch (error) {
      console.error("Error inviting client:", error);
      return { success: false, error: "Failed to send invitation" };
    }
  }

  /**
   * Get all clients for the authenticated cleaner
   * @param {string} token - Auth token
   * @param {string} status - Optional status filter ('pending_invite', 'active', 'inactive')
   * @returns {Object} { clients }
   */
  static async getClients(token, status = null) {
    try {
      const url = status
        ? `${API_BASE}/cleaner-clients?status=${status}`
        : `${API_BASE}/cleaner-clients`;
      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      return await response.json();
    } catch (error) {
      console.error("Error fetching clients:", error);
      return { clients: [] };
    }
  }

  /**
   * Get a specific client relationship
   * @param {string} token - Auth token
   * @param {number} clientId - CleanerClient ID
   * @returns {Object} { cleanerClient }
   */
  static async getClient(token, clientId) {
    try {
      const response = await fetch(`${API_BASE}/cleaner-clients/${clientId}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      return await response.json();
    } catch (error) {
      console.error("Error fetching client:", error);
      return null;
    }
  }

  /**
   * Update a client relationship
   * @param {string} token - Auth token
   * @param {number} clientId - CleanerClient ID
   * @param {Object} updates - Fields to update
   * @returns {Object} { success, cleanerClient, error }
   */
  static async updateClient(token, clientId, updates) {
    try {
      const response = await fetch(`${API_BASE}/cleaner-clients/${clientId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(updates),
      });
      return await response.json();
    } catch (error) {
      console.error("Error updating client:", error);
      return { success: false, error: "Failed to update client" };
    }
  }

  /**
   * Deactivate a client relationship
   * @param {string} token - Auth token
   * @param {number} clientId - CleanerClient ID
   * @returns {Object} { success, error }
   */
  static async deactivateClient(token, clientId) {
    try {
      const response = await fetch(`${API_BASE}/cleaner-clients/${clientId}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      return await response.json();
    } catch (error) {
      console.error("Error deactivating client:", error);
      return { success: false, error: "Failed to deactivate client" };
    }
  }

  /**
   * Resend an invitation email
   * @param {string} token - Auth token
   * @param {number} clientId - CleanerClient ID
   * @returns {Object} { success, error }
   */
  static async resendInvite(token, clientId) {
    try {
      const response = await fetch(
        `${API_BASE}/cleaner-clients/${clientId}/resend-invite`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );
      return await response.json();
    } catch (error) {
      console.error("Error resending invitation:", error);
      return { success: false, error: "Failed to resend invitation" };
    }
  }

  /**
   * Book an appointment for a linked client (cleaner-initiated booking)
   * @param {string} token - Auth token
   * @param {number} clientId - CleanerClient ID
   * @param {Object} bookingData - { date, price?, timeWindow?, notes? }
   * @returns {Object} { success, appointment, error }
   */
  static async bookForClient(token, clientId, bookingData) {
    try {
      const response = await fetch(
        `${API_BASE}/cleaner-clients/${clientId}/book`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(bookingData),
        }
      );
      return await response.json();
    } catch (error) {
      console.error("Error booking for client:", error);
      return { success: false, error: "Failed to book appointment" };
    }
  }

  // =====================
  // PUBLIC ENDPOINTS (for invitation acceptance)
  // =====================

  /**
   * Validate an invitation token
   * @param {string} token - Invitation token
   * @returns {Object} { valid, invitation, error }
   */
  static async validateInvitation(inviteToken) {
    try {
      const response = await fetch(
        `${API_BASE}/cleaner-clients/invitations/${inviteToken}`
      );
      return await response.json();
    } catch (error) {
      console.error("Error validating invitation:", error);
      return { valid: false, error: "Failed to validate invitation" };
    }
  }

  /**
   * Accept an invitation and create account
   * @param {string} inviteToken - Invitation token
   * @param {Object} userData - User data (password, phone, addressCorrections)
   * @returns {Object} { success, user, token, home, error }
   */
  static async acceptInvitation(inviteToken, userData) {
    try {
      const response = await fetch(
        `${API_BASE}/cleaner-clients/invitations/${inviteToken}/accept`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(userData),
        }
      );
      return await response.json();
    } catch (error) {
      console.error("Error accepting invitation:", error);
      return { success: false, error: "Failed to accept invitation" };
    }
  }

  /**
   * Decline an invitation
   * @param {string} inviteToken - Invitation token
   * @returns {Object} { success, error }
   */
  static async declineInvitation(inviteToken) {
    try {
      const response = await fetch(
        `${API_BASE}/cleaner-clients/invitations/${inviteToken}/decline`,
        {
          method: "POST",
        }
      );
      return await response.json();
    } catch (error) {
      console.error("Error declining invitation:", error);
      return { success: false, error: "Failed to decline invitation" };
    }
  }

  // =====================
  // RECURRING SCHEDULES
  // =====================

  /**
   * Create a recurring schedule for a client
   * @param {string} token - Auth token
   * @param {Object} scheduleData - { cleanerClientId, frequency, dayOfWeek, timeWindow, price, startDate, endDate? }
   * @returns {Object} { success, schedule, appointmentsCreated, error }
   */
  static async createRecurringSchedule(token, scheduleData) {
    try {
      const response = await fetch(`${API_BASE}/recurring-schedules`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(scheduleData),
      });
      return await response.json();
    } catch (error) {
      console.error("Error creating recurring schedule:", error);
      return { success: false, error: "Failed to create recurring schedule" };
    }
  }

  /**
   * Get all recurring schedules for the cleaner
   * @param {string} token - Auth token
   * @param {number} cleanerClientId - Optional: filter by client
   * @returns {Object} { schedules }
   */
  static async getRecurringSchedules(token, cleanerClientId = null) {
    try {
      const url = cleanerClientId
        ? `${API_BASE}/recurring-schedules?cleanerClientId=${cleanerClientId}&activeOnly=true`
        : `${API_BASE}/recurring-schedules?activeOnly=true`;
      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      return await response.json();
    } catch (error) {
      console.error("Error fetching recurring schedules:", error);
      return { schedules: [] };
    }
  }

  /**
   * Get a specific recurring schedule
   * @param {string} token - Auth token
   * @param {number} scheduleId - Schedule ID
   * @returns {Object} { schedule }
   */
  static async getRecurringSchedule(token, scheduleId) {
    try {
      const response = await fetch(
        `${API_BASE}/recurring-schedules/${scheduleId}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );
      return await response.json();
    } catch (error) {
      console.error("Error fetching recurring schedule:", error);
      return null;
    }
  }

  /**
   * Update a recurring schedule
   * @param {string} token - Auth token
   * @param {number} scheduleId - Schedule ID
   * @param {Object} updates - Fields to update
   * @returns {Object} { success, schedule, error }
   */
  static async updateRecurringSchedule(token, scheduleId, updates) {
    try {
      const response = await fetch(
        `${API_BASE}/recurring-schedules/${scheduleId}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(updates),
        }
      );
      return await response.json();
    } catch (error) {
      console.error("Error updating recurring schedule:", error);
      return { success: false, error: "Failed to update recurring schedule" };
    }
  }

  /**
   * Delete (deactivate) a recurring schedule
   * @param {string} token - Auth token
   * @param {number} scheduleId - Schedule ID
   * @param {boolean} cancelFutureAppointments - Whether to cancel future appointments
   * @returns {Object} { success, error }
   */
  static async deleteRecurringSchedule(token, scheduleId, cancelFutureAppointments = false) {
    try {
      const url = cancelFutureAppointments
        ? `${API_BASE}/recurring-schedules/${scheduleId}?cancelFutureAppointments=true`
        : `${API_BASE}/recurring-schedules/${scheduleId}`;
      const response = await fetch(url, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      return await response.json();
    } catch (error) {
      console.error("Error deleting recurring schedule:", error);
      return { success: false, error: "Failed to delete recurring schedule" };
    }
  }

  /**
   * Pause a recurring schedule
   * @param {string} token - Auth token
   * @param {number} scheduleId - Schedule ID
   * @param {string} until - Optional date to pause until
   * @param {string} reason - Optional pause reason
   * @returns {Object} { success, schedule, error }
   */
  static async pauseRecurringSchedule(token, scheduleId, until = null, reason = null) {
    try {
      const response = await fetch(
        `${API_BASE}/recurring-schedules/${scheduleId}/pause`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ until, reason }),
        }
      );
      return await response.json();
    } catch (error) {
      console.error("Error pausing recurring schedule:", error);
      return { success: false, error: "Failed to pause recurring schedule" };
    }
  }

  /**
   * Resume a paused recurring schedule
   * @param {string} token - Auth token
   * @param {number} scheduleId - Schedule ID
   * @returns {Object} { success, schedule, appointmentsCreated, error }
   */
  static async resumeRecurringSchedule(token, scheduleId) {
    try {
      const response = await fetch(
        `${API_BASE}/recurring-schedules/${scheduleId}/resume`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );
      return await response.json();
    } catch (error) {
      console.error("Error resuming recurring schedule:", error);
      return { success: false, error: "Failed to resume recurring schedule" };
    }
  }

  // =====================
  // PREFERRED CLEANER ENDPOINTS
  // =====================

  /**
   * Get all client appointments for the business owner
   * Returns appointments grouped by: pending (need response), declined (awaiting client), upcoming (confirmed)
   * @param {string} token - Auth token
   * @returns {Object} { pending, declined, upcoming }
   */
  static async getClientAppointments(token) {
    try {
      const response = await fetch(`${API_BASE}/preferred-cleaner/my-client-appointments`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      return await response.json();
    } catch (error) {
      console.error("Error fetching client appointments:", error);
      return { pending: [], declined: [], upcoming: [] };
    }
  }

  /**
   * Accept an appointment from a client
   * @param {string} token - Auth token
   * @param {number} appointmentId - Appointment ID
   * @returns {Object} { success, appointment, error }
   */
  static async acceptClientAppointment(token, appointmentId) {
    try {
      const response = await fetch(
        `${API_BASE}/preferred-cleaner/appointments/${appointmentId}/accept`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );
      return await response.json();
    } catch (error) {
      console.error("Error accepting appointment:", error);
      return { success: false, error: "Failed to accept appointment" };
    }
  }

  /**
   * Decline an appointment from a client
   * @param {string} token - Auth token
   * @param {number} appointmentId - Appointment ID
   * @returns {Object} { success, appointment, error }
   */
  static async declineClientAppointment(token, appointmentId) {
    try {
      const response = await fetch(
        `${API_BASE}/preferred-cleaner/appointments/${appointmentId}/decline`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );
      return await response.json();
    } catch (error) {
      console.error("Error declining appointment:", error);
      return { success: false, error: "Failed to decline appointment" };
    }
  }

  // =====================
  // HOMEOWNER ENDPOINTS (for responding to declined appointments)
  // =====================

  /**
   * Get appointments where the preferred cleaner declined and needs client response
   * @param {string} token - Auth token
   * @returns {Object} { appointments }
   */
  static async getPendingResponses(token) {
    try {
      const response = await fetch(`${API_BASE}/preferred-cleaner/pending-responses`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      return await response.json();
    } catch (error) {
      console.error("Error fetching pending responses:", error);
      return { appointments: [] };
    }
  }

  /**
   * Respond to a declined appointment
   * @param {string} token - Auth token
   * @param {number} appointmentId - Appointment ID
   * @param {string} action - 'cancel' or 'open_to_market'
   * @returns {Object} { success, action, message, originalPrice?, newPrice?, error }
   */
  static async respondToDecline(token, appointmentId, action) {
    try {
      const response = await fetch(
        `${API_BASE}/preferred-cleaner/appointments/${appointmentId}/respond`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ action }),
        }
      );
      return await response.json();
    } catch (error) {
      console.error("Error responding to decline:", error);
      return { success: false, error: "Failed to respond" };
    }
  }
}

export default CleanerClientService;
