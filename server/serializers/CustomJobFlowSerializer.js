/**
 * CustomJobFlowSerializer
 * Serializes CustomJobFlow models for API responses
 */

class CustomJobFlowSerializer {
  /**
   * Serialize a single CustomJobFlow
   * @param {Object} flow - CustomJobFlow instance or plain object
   * @param {Object} options - Serialization options
   * @param {boolean} options.includeChecklist - Include checklist details
   * @param {boolean} options.includeAssignments - Include client/home assignments
   * @returns {Object} Serialized flow
   */
  static serializeOne(flow, options = {}) {
    if (!flow) return null;

    const { includeChecklist = false, includeAssignments = false } = options;

    const data = flow.dataValues || flow;

    const serialized = {
      id: data.id,
      businessOwnerId: data.businessOwnerId,
      name: data.name,
      description: data.description,
      isDefault: data.isDefault,
      status: data.status,
      photoRequirement: data.photoRequirement,
      jobNotes: data.jobNotes,
      createdAt: data.createdAt,
      updatedAt: data.updatedAt,
    };

    // Include checklist if present and requested
    if (includeChecklist && data.checklist) {
      const CustomJobFlowChecklistSerializer = require("./CustomJobFlowChecklistSerializer");
      serialized.checklist = CustomJobFlowChecklistSerializer.serializeOne(data.checklist);
    }

    // Include assignments if present and requested
    if (includeAssignments && data.clientAssignments) {
      const ClientJobFlowAssignmentSerializer = require("./ClientJobFlowAssignmentSerializer");
      serialized.clientAssignments = ClientJobFlowAssignmentSerializer.serializeArray(
        data.clientAssignments
      );
    }

    return serialized;
  }

  /**
   * Serialize an array of CustomJobFlows
   * @param {Array} flows - Array of CustomJobFlow instances
   * @param {Object} options - Serialization options
   * @returns {Array} Serialized flows
   */
  static serializeArray(flows, options = {}) {
    if (!flows || !Array.isArray(flows)) return [];
    return flows.map((flow) => this.serializeOne(flow, options));
  }

  /**
   * Serialize for list view (minimal data)
   * @param {Object} flow - CustomJobFlow instance
   * @returns {Object} Serialized flow for list
   */
  static serializeForList(flow) {
    if (!flow) return null;

    const data = flow.dataValues || flow;

    return {
      id: data.id,
      name: data.name,
      description: data.description,
      isDefault: data.isDefault,
      status: data.status,
      photoRequirement: data.photoRequirement,
      hasChecklist: data.checklist != null,
      assignmentCount: data.clientAssignments?.length || 0,
    };
  }

  /**
   * Serialize array for list view
   * @param {Array} flows - Array of CustomJobFlow instances
   * @returns {Array} Serialized flows for list
   */
  static serializeArrayForList(flows) {
    if (!flows || !Array.isArray(flows)) return [];
    return flows.map((flow) => this.serializeForList(flow));
  }

  /**
   * Serialize for dropdown/selection (minimal data)
   * @param {Object} flow - CustomJobFlow instance
   * @returns {Object} Serialized flow for selection
   */
  static serializeForSelect(flow) {
    if (!flow) return null;

    const data = flow.dataValues || flow;

    return {
      id: data.id,
      name: data.name,
      isDefault: data.isDefault,
      photoRequirement: data.photoRequirement,
    };
  }

  /**
   * Serialize array for dropdown/selection
   * @param {Array} flows - Array of CustomJobFlow instances
   * @returns {Array} Serialized flows for selection
   */
  static serializeArrayForSelect(flows) {
    if (!flows || !Array.isArray(flows)) return [];
    return flows.map((flow) => this.serializeForSelect(flow));
  }
}

module.exports = CustomJobFlowSerializer;
