import HttpClient from "../HttpClient";

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
    const params = new URLSearchParams();
    if (options.status) params.append("status", options.status);

    const queryString = params.toString();
    const url = `/business-owner/job-flows${queryString ? `?${queryString}` : ""}`;

    const result = await HttpClient.get(url, { token });

    if (result.success === false) {
      __DEV__ && console.warn("[JobFlowService] getFlows failed:", result.error);
      return { flows: [], error: result.error };
    }

    return result;
  }

  /**
   * Get a specific job flow with full details
   * @param {string} token - Auth token
   * @param {number} flowId - Flow ID
   * @returns {Object} { flow: {...} }
   */
  static async getFlow(token, flowId) {
    const result = await HttpClient.get(
      `/business-owner/job-flows/${flowId}`,
      { token }
    );

    if (result.success === false) {
      __DEV__ && console.warn("[JobFlowService] getFlow failed:", result.error);
      return { flow: null, error: result.error };
    }

    return result;
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
    const result = await HttpClient.post(
      "/business-owner/job-flows",
      flowData,
      { token }
    );

    if (result.success === false) {
      __DEV__ && console.warn("[JobFlowService] createFlow failed:", result.error);
    }

    return result;
  }

  /**
   * Update a job flow
   * @param {string} token - Auth token
   * @param {number} flowId - Flow ID
   * @param {Object} updates - Fields to update
   * @returns {Object} { success, flow, message, error }
   */
  static async updateFlow(token, flowId, updates) {
    const result = await HttpClient.put(
      `/business-owner/job-flows/${flowId}`,
      updates,
      { token }
    );

    if (result.success === false) {
      __DEV__ && console.warn("[JobFlowService] updateFlow failed:", result.error);
    }

    return result;
  }

  /**
   * Delete/archive a job flow
   * @param {string} token - Auth token
   * @param {number} flowId - Flow ID
   * @param {boolean} permanent - If true, permanently delete; if false, archive
   * @returns {Object} { success, message, error }
   */
  static async deleteFlow(token, flowId, permanent = false) {
    const url = `/business-owner/job-flows/${flowId}${permanent ? "?permanent=true" : ""}`;

    const result = await HttpClient.delete(url, { token });

    if (result.success === false) {
      __DEV__ && console.warn("[JobFlowService] deleteFlow failed:", result.error);
    }

    return result;
  }

  /**
   * Set a flow as the default for new clients
   * @param {string} token - Auth token
   * @param {number} flowId - Flow ID
   * @returns {Object} { success, flow, message, error }
   */
  static async setDefaultFlow(token, flowId) {
    const result = await HttpClient.post(
      `/business-owner/job-flows/${flowId}/set-default`,
      {},
      { token }
    );

    if (result.success === false) {
      __DEV__ && console.warn("[JobFlowService] setDefaultFlow failed:", result.error);
    }

    return result;
  }

  /**
   * Clear the default flow (no default)
   * @param {string} token - Auth token
   * @returns {Object} { success, message, error }
   */
  static async clearDefaultFlow(token) {
    const result = await HttpClient.post(
      "/business-owner/job-flows/clear-default",
      {},
      { token }
    );

    if (result.success === false) {
      __DEV__ && console.warn("[JobFlowService] clearDefaultFlow failed:", result.error);
    }

    return result;
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
    const result = await HttpClient.get(
      `/business-owner/job-flows/${flowId}/checklist`,
      { token }
    );

    if (result.success === false) {
      __DEV__ && console.warn("[JobFlowService] getChecklist failed:", result.error);
      return { checklist: null, error: result.error };
    }

    return result;
  }

  /**
   * Create a checklist from scratch
   * @param {string} token - Auth token
   * @param {number} flowId - Flow ID
   * @param {Array} sections - Checklist sections with items
   * @returns {Object} { success, checklist, message, error }
   */
  static async createChecklist(token, flowId, sections) {
    const result = await HttpClient.post(
      `/business-owner/job-flows/${flowId}/checklist`,
      { sections },
      { token }
    );

    if (result.success === false) {
      __DEV__ && console.warn("[JobFlowService] createChecklist failed:", result.error);
    }

    return result;
  }

  /**
   * Update the checklist sections
   * @param {string} token - Auth token
   * @param {number} flowId - Flow ID
   * @param {Array} sections - Updated checklist sections with items
   * @returns {Object} { success, checklist, message, error }
   */
  static async updateChecklist(token, flowId, sections) {
    const result = await HttpClient.put(
      `/business-owner/job-flows/${flowId}/checklist`,
      { sections },
      { token }
    );

    if (result.success === false) {
      __DEV__ && console.warn("[JobFlowService] updateChecklist failed:", result.error);
    }

    return result;
  }

  /**
   * Delete the checklist for a flow
   * @param {string} token - Auth token
   * @param {number} flowId - Flow ID
   * @returns {Object} { success, message, error }
   */
  static async deleteChecklist(token, flowId) {
    const result = await HttpClient.delete(
      `/business-owner/job-flows/${flowId}/checklist`,
      { token }
    );

    if (result.success === false) {
      __DEV__ && console.warn("[JobFlowService] deleteChecklist failed:", result.error);
    }

    return result;
  }

  /**
   * Fork the platform's standard checklist
   * @param {string} token - Auth token
   * @param {number} flowId - Flow ID
   * @param {number} versionId - Optional specific version ID to fork
   * @returns {Object} { success, checklist, message, error }
   */
  static async forkPlatformChecklist(token, flowId, versionId = null) {
    const result = await HttpClient.post(
      `/business-owner/job-flows/${flowId}/checklist/fork-platform`,
      { versionId },
      { token }
    );

    if (result.success === false) {
      __DEV__ && console.warn("[JobFlowService] forkPlatformChecklist failed:", result.error);
    }

    return result;
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
    const result = await HttpClient.put(
      `/business-owner/job-flows/${flowId}/checklist/items/${itemId}/notes`,
      { notes },
      { token }
    );

    if (result.success === false) {
      __DEV__ && console.warn("[JobFlowService] updateItemNotes failed:", result.error);
    }

    return result;
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
    const result = await HttpClient.get(
      "/business-owner/job-flows/assignments",
      { token }
    );

    if (result.success === false) {
      __DEV__ && console.warn("[JobFlowService] getAssignments failed:", result.error);
      return { assignments: [], error: result.error };
    }

    return result;
  }

  /**
   * Assign a flow to a client (applies to all their homes)
   * @param {string} token - Auth token
   * @param {number} clientId - Client user ID
   * @param {number} flowId - Flow ID to assign
   * @returns {Object} { success, assignment, message, error }
   */
  static async assignFlowToClient(token, clientId, flowId) {
    const result = await HttpClient.post(
      `/business-owner/job-flows/assignments/client/${clientId}`,
      { flowId },
      { token }
    );

    if (result.success === false) {
      __DEV__ && console.warn("[JobFlowService] assignFlowToClient failed:", result.error);
    }

    return result;
  }

  /**
   * Assign a flow to a specific home (overrides client assignment)
   * @param {string} token - Auth token
   * @param {number} homeId - Home ID
   * @param {number} flowId - Flow ID to assign
   * @returns {Object} { success, assignment, message, error }
   */
  static async assignFlowToHome(token, homeId, flowId) {
    const result = await HttpClient.post(
      `/business-owner/job-flows/assignments/home/${homeId}`,
      { flowId },
      { token }
    );

    if (result.success === false) {
      __DEV__ && console.warn("[JobFlowService] assignFlowToHome failed:", result.error);
    }

    return result;
  }

  /**
   * Remove a flow assignment
   * @param {string} token - Auth token
   * @param {number} assignmentId - Assignment ID to remove
   * @returns {Object} { success, message, error }
   */
  static async removeAssignment(token, assignmentId) {
    const result = await HttpClient.delete(
      `/business-owner/job-flows/assignments/${assignmentId}`,
      { token }
    );

    if (result.success === false) {
      __DEV__ && console.warn("[JobFlowService] removeAssignment failed:", result.error);
    }

    return result;
  }
}

export default JobFlowService;
