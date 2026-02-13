import { API_BASE } from "../config";

/**
 * JobFlowService - Client-side service for business owner job flow management
 */
class JobFlowService {
  // =====================================
  // Job Flow CRUD
  // =====================================

  /**
   * Get all job flows for the business owner
   * @param {string} token - Auth token
   * @param {Object} options - Query options
   * @param {string} options.status - Filter by status (active, archived)
   * @returns {Object} { flows: [...] }
   */
  static async getFlows(token, options = {}) {
    try {
      const params = new URLSearchParams();
      if (options.status) params.append("status", options.status);

      const queryString = params.toString();
      const url = `${API_BASE}/business-owner/job-flows${queryString ? `?${queryString}` : ""}`;

      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        const error = await response.json();
        return { flows: [], error: error.error || "Failed to fetch job flows" };
      }

      return await response.json();
    } catch (error) {
      console.error("Error fetching job flows:", error);
      return { flows: [], error: "Failed to fetch job flows" };
    }
  }

  /**
   * Get a specific job flow with full details
   * @param {string} token - Auth token
   * @param {number} flowId - Flow ID
   * @returns {Object} { flow: {...} }
   */
  static async getFlow(token, flowId) {
    try {
      const response = await fetch(
        `${API_BASE}/business-owner/job-flows/${flowId}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!response.ok) {
        const error = await response.json();
        return { flow: null, error: error.error || "Failed to fetch job flow" };
      }

      return await response.json();
    } catch (error) {
      console.error("Error fetching job flow:", error);
      return { flow: null, error: "Failed to fetch job flow" };
    }
  }

  /**
   * Create a new job flow
   * @param {string} token - Auth token
   * @param {Object} flowData - Flow data
   * @param {string} flowData.name - Flow name (required)
   * @param {string} flowData.description - Flow description
   * @param {string} flowData.photoRequirement - 'required', 'optional', or 'hidden'
   * @param {string} flowData.jobNotes - Notes for employees
   * @param {boolean} flowData.isDefault - Set as default flow
   * @returns {Object} { success, flow, message, error }
   */
  static async createFlow(token, flowData) {
    try {
      const response = await fetch(`${API_BASE}/business-owner/job-flows`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(flowData),
      });

      const result = await response.json();

      if (!response.ok) {
        return { success: false, error: result.error || "Failed to create job flow" };
      }

      return { success: true, ...result };
    } catch (error) {
      console.error("Error creating job flow:", error);
      return { success: false, error: "Failed to create job flow" };
    }
  }

  /**
   * Update a job flow
   * @param {string} token - Auth token
   * @param {number} flowId - Flow ID
   * @param {Object} updates - Fields to update
   * @returns {Object} { success, flow, message, error }
   */
  static async updateFlow(token, flowId, updates) {
    try {
      const response = await fetch(
        `${API_BASE}/business-owner/job-flows/${flowId}`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(updates),
        }
      );

      const result = await response.json();

      if (!response.ok) {
        return { success: false, error: result.error || "Failed to update job flow" };
      }

      return { success: true, ...result };
    } catch (error) {
      console.error("Error updating job flow:", error);
      return { success: false, error: "Failed to update job flow" };
    }
  }

  /**
   * Delete/archive a job flow
   * @param {string} token - Auth token
   * @param {number} flowId - Flow ID
   * @param {boolean} permanent - If true, permanently delete; if false, archive
   * @returns {Object} { success, message, error }
   */
  static async deleteFlow(token, flowId, permanent = false) {
    try {
      const url = `${API_BASE}/business-owner/job-flows/${flowId}${permanent ? "?permanent=true" : ""}`;

      const response = await fetch(url, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const result = await response.json();

      if (!response.ok) {
        return { success: false, error: result.error || "Failed to delete job flow" };
      }

      return { success: true, ...result };
    } catch (error) {
      console.error("Error deleting job flow:", error);
      return { success: false, error: "Failed to delete job flow" };
    }
  }

  /**
   * Set a flow as the default for new clients
   * @param {string} token - Auth token
   * @param {number} flowId - Flow ID
   * @returns {Object} { success, flow, message, error }
   */
  static async setDefaultFlow(token, flowId) {
    try {
      const response = await fetch(
        `${API_BASE}/business-owner/job-flows/${flowId}/set-default`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const result = await response.json();

      if (!response.ok) {
        return { success: false, error: result.error || "Failed to set default flow" };
      }

      return { success: true, ...result };
    } catch (error) {
      console.error("Error setting default flow:", error);
      return { success: false, error: "Failed to set default flow" };
    }
  }

  /**
   * Clear the default flow (no default)
   * @param {string} token - Auth token
   * @returns {Object} { success, message, error }
   */
  static async clearDefaultFlow(token) {
    try {
      const response = await fetch(
        `${API_BASE}/business-owner/job-flows/clear-default`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const result = await response.json();

      if (!response.ok) {
        return { success: false, error: result.error || "Failed to clear default flow" };
      }

      return { success: true, ...result };
    } catch (error) {
      console.error("Error clearing default flow:", error);
      return { success: false, error: "Failed to clear default flow" };
    }
  }

  // =====================================
  // Checklist Management
  // =====================================

  /**
   * Get the checklist for a flow
   * @param {string} token - Auth token
   * @param {number} flowId - Flow ID
   * @returns {Object} { checklist: {...} | null }
   */
  static async getChecklist(token, flowId) {
    try {
      const response = await fetch(
        `${API_BASE}/business-owner/job-flows/${flowId}/checklist`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!response.ok) {
        const error = await response.json();
        return { checklist: null, error: error.error || "Failed to fetch checklist" };
      }

      return await response.json();
    } catch (error) {
      console.error("Error fetching checklist:", error);
      return { checklist: null, error: "Failed to fetch checklist" };
    }
  }

  /**
   * Create a checklist from scratch
   * @param {string} token - Auth token
   * @param {number} flowId - Flow ID
   * @param {Array} sections - Checklist sections with items
   * @returns {Object} { success, checklist, message, error }
   */
  static async createChecklist(token, flowId, sections) {
    try {
      const response = await fetch(
        `${API_BASE}/business-owner/job-flows/${flowId}/checklist`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ sections }),
        }
      );

      const result = await response.json();

      if (!response.ok) {
        return { success: false, error: result.error || "Failed to create checklist" };
      }

      return { success: true, ...result };
    } catch (error) {
      console.error("Error creating checklist:", error);
      return { success: false, error: "Failed to create checklist" };
    }
  }

  /**
   * Update the checklist sections
   * @param {string} token - Auth token
   * @param {number} flowId - Flow ID
   * @param {Array} sections - Updated checklist sections with items
   * @returns {Object} { success, checklist, message, error }
   */
  static async updateChecklist(token, flowId, sections) {
    try {
      const response = await fetch(
        `${API_BASE}/business-owner/job-flows/${flowId}/checklist`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ sections }),
        }
      );

      const result = await response.json();

      if (!response.ok) {
        return { success: false, error: result.error || "Failed to update checklist" };
      }

      return { success: true, ...result };
    } catch (error) {
      console.error("Error updating checklist:", error);
      return { success: false, error: "Failed to update checklist" };
    }
  }

  /**
   * Delete the checklist for a flow
   * @param {string} token - Auth token
   * @param {number} flowId - Flow ID
   * @returns {Object} { success, message, error }
   */
  static async deleteChecklist(token, flowId) {
    try {
      const response = await fetch(
        `${API_BASE}/business-owner/job-flows/${flowId}/checklist`,
        {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const result = await response.json();

      if (!response.ok) {
        return { success: false, error: result.error || "Failed to delete checklist" };
      }

      return { success: true, ...result };
    } catch (error) {
      console.error("Error deleting checklist:", error);
      return { success: false, error: "Failed to delete checklist" };
    }
  }

  /**
   * Fork the platform's standard checklist
   * @param {string} token - Auth token
   * @param {number} flowId - Flow ID
   * @param {number} versionId - Optional specific version ID to fork
   * @returns {Object} { success, checklist, message, error }
   */
  static async forkPlatformChecklist(token, flowId, versionId = null) {
    try {
      const response = await fetch(
        `${API_BASE}/business-owner/job-flows/${flowId}/checklist/fork-platform`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ versionId }),
        }
      );

      const result = await response.json();

      if (!response.ok) {
        return { success: false, error: result.error || "Failed to fork platform checklist" };
      }

      return { success: true, ...result };
    } catch (error) {
      console.error("Error forking platform checklist:", error);
      return { success: false, error: "Failed to fork platform checklist" };
    }
  }

  /**
   * Add notes to a specific checklist item
   * @param {string} token - Auth token
   * @param {number} flowId - Flow ID
   * @param {string} itemId - Item ID within the checklist
   * @param {string} notes - Notes to add
   * @returns {Object} { success, checklist, message, error }
   */
  static async updateItemNotes(token, flowId, itemId, notes) {
    try {
      const response = await fetch(
        `${API_BASE}/business-owner/job-flows/${flowId}/checklist/items/${itemId}/notes`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ notes }),
        }
      );

      const result = await response.json();

      if (!response.ok) {
        return { success: false, error: result.error || "Failed to update item notes" };
      }

      return { success: true, ...result };
    } catch (error) {
      console.error("Error updating item notes:", error);
      return { success: false, error: "Failed to update item notes" };
    }
  }

  // =====================================
  // Flow Assignments
  // =====================================

  /**
   * Get all flow assignments for the business owner
   * @param {string} token - Auth token
   * @returns {Object} { assignments: [...] }
   */
  static async getAssignments(token) {
    try {
      const response = await fetch(
        `${API_BASE}/business-owner/job-flows/assignments`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!response.ok) {
        const error = await response.json();
        return { assignments: [], error: error.error || "Failed to fetch assignments" };
      }

      return await response.json();
    } catch (error) {
      console.error("Error fetching flow assignments:", error);
      return { assignments: [], error: "Failed to fetch assignments" };
    }
  }

  /**
   * Assign a flow to a client (applies to all their homes)
   * @param {string} token - Auth token
   * @param {number} clientId - Client user ID
   * @param {number} flowId - Flow ID to assign
   * @returns {Object} { success, assignment, message, error }
   */
  static async assignFlowToClient(token, clientId, flowId) {
    try {
      const response = await fetch(
        `${API_BASE}/business-owner/job-flows/assignments/client/${clientId}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ flowId }),
        }
      );

      const result = await response.json();

      if (!response.ok) {
        return { success: false, error: result.error || "Failed to assign flow to client" };
      }

      return { success: true, ...result };
    } catch (error) {
      console.error("Error assigning flow to client:", error);
      return { success: false, error: "Failed to assign flow to client" };
    }
  }

  /**
   * Assign a flow to a specific home (overrides client assignment)
   * @param {string} token - Auth token
   * @param {number} homeId - Home ID
   * @param {number} flowId - Flow ID to assign
   * @returns {Object} { success, assignment, message, error }
   */
  static async assignFlowToHome(token, homeId, flowId) {
    try {
      const response = await fetch(
        `${API_BASE}/business-owner/job-flows/assignments/home/${homeId}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ flowId }),
        }
      );

      const result = await response.json();

      if (!response.ok) {
        return { success: false, error: result.error || "Failed to assign flow to home" };
      }

      return { success: true, ...result };
    } catch (error) {
      console.error("Error assigning flow to home:", error);
      return { success: false, error: "Failed to assign flow to home" };
    }
  }

  /**
   * Remove a flow assignment
   * @param {string} token - Auth token
   * @param {number} assignmentId - Assignment ID to remove
   * @returns {Object} { success, message, error }
   */
  static async removeAssignment(token, assignmentId) {
    try {
      const response = await fetch(
        `${API_BASE}/business-owner/job-flows/assignments/${assignmentId}`,
        {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const result = await response.json();

      if (!response.ok) {
        return { success: false, error: result.error || "Failed to remove assignment" };
      }

      return { success: true, ...result };
    } catch (error) {
      console.error("Error removing flow assignment:", error);
      return { success: false, error: "Failed to remove assignment" };
    }
  }
}

export default JobFlowService;
