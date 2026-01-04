/**
 * CustomJobFlowService
 * Handles CRUD operations for custom job flows and flow assignment to clients/homes
 */

const {
  CustomJobFlow,
  CustomJobFlowChecklist,
  ClientJobFlowAssignment,
  CleanerClient,
  UserHomes,
  ChecklistVersion,
  sequelize,
} = require("../models");
const { Op } = require("sequelize");

class CustomJobFlowService {
  /**
   * Create a new custom job flow
   * @param {number} businessOwnerId - The business owner's user ID
   * @param {Object} flowData - Flow data (name, description, photoRequirement, jobNotes, isDefault)
   * @returns {Object} Created flow
   */
  static async createFlow(businessOwnerId, flowData) {
    const { name, description, photoRequirement, jobNotes, isDefault } = flowData;

    // If setting as default, unset any existing default
    if (isDefault) {
      await CustomJobFlow.update(
        { isDefault: false },
        { where: { businessOwnerId, isDefault: true } }
      );
    }

    const flow = await CustomJobFlow.create({
      businessOwnerId,
      name,
      description: description || null,
      photoRequirement: photoRequirement || "optional",
      jobNotes: jobNotes || null,
      isDefault: isDefault || false,
      status: "active",
    });

    return flow;
  }

  /**
   * Get a flow by ID with authorization check
   * @param {number} flowId - The flow ID
   * @param {number} businessOwnerId - The business owner's user ID
   * @returns {Object} Flow with checklist
   */
  static async getFlowById(flowId, businessOwnerId) {
    const flow = await CustomJobFlow.findOne({
      where: { id: flowId, businessOwnerId },
      include: [
        { model: CustomJobFlowChecklist, as: "checklist" },
      ],
    });

    if (!flow) {
      throw new Error("Flow not found or access denied");
    }

    return flow;
  }

  /**
   * Get all flows for a business owner
   * @param {number} businessOwnerId - The business owner's user ID
   * @param {Object} filters - Optional filters (status)
   * @returns {Array} List of flows
   */
  static async getFlowsByBusinessOwner(businessOwnerId, filters = {}) {
    const where = { businessOwnerId };

    if (filters.status) {
      where.status = filters.status;
    } else {
      // Default to showing active flows
      where.status = "active";
    }

    const flows = await CustomJobFlow.findAll({
      where,
      include: [
        { model: CustomJobFlowChecklist, as: "checklist" },
      ],
      order: [
        ["isDefault", "DESC"],
        ["name", "ASC"],
      ],
    });

    return flows;
  }

  /**
   * Update a flow
   * @param {number} flowId - The flow ID
   * @param {number} businessOwnerId - The business owner's user ID
   * @param {Object} updates - Fields to update
   * @returns {Object} Updated flow
   */
  static async updateFlow(flowId, businessOwnerId, updates) {
    const flow = await this.getFlowById(flowId, businessOwnerId);

    const allowedUpdates = ["name", "description", "photoRequirement", "jobNotes"];
    const filteredUpdates = {};

    for (const key of allowedUpdates) {
      if (updates[key] !== undefined) {
        filteredUpdates[key] = updates[key];
      }
    }

    await flow.update(filteredUpdates);

    return flow;
  }

  /**
   * Archive a flow (soft delete)
   * @param {number} flowId - The flow ID
   * @param {number} businessOwnerId - The business owner's user ID
   * @returns {Object} Archived flow
   */
  static async archiveFlow(flowId, businessOwnerId) {
    const flow = await this.getFlowById(flowId, businessOwnerId);

    // Remove default status if archiving the default flow
    await flow.update({
      status: "archived",
      isDefault: false,
    });

    return flow;
  }

  /**
   * Permanently delete a flow (only if no appointments are using it)
   * @param {number} flowId - The flow ID
   * @param {number} businessOwnerId - The business owner's user ID
   */
  static async deleteFlow(flowId, businessOwnerId) {
    const flow = await this.getFlowById(flowId, businessOwnerId);

    // Check if any appointments are using this flow
    const { AppointmentJobFlow } = require("../models");
    const inUseCount = await AppointmentJobFlow.count({
      where: { customJobFlowId: flowId },
    });

    if (inUseCount > 0) {
      throw new Error(
        `Cannot delete flow: ${inUseCount} appointment(s) are using this flow. Archive it instead.`
      );
    }

    // Delete related records first
    await ClientJobFlowAssignment.destroy({ where: { customJobFlowId: flowId } });
    await CustomJobFlowChecklist.destroy({ where: { customJobFlowId: flowId } });
    await flow.destroy();
  }

  /**
   * Set a flow as the default for new jobs
   * @param {number} businessOwnerId - The business owner's user ID
   * @param {number} flowId - The flow ID to set as default
   * @returns {Object} Updated flow
   */
  static async setDefaultFlow(businessOwnerId, flowId) {
    // Unset any existing default
    await CustomJobFlow.update(
      { isDefault: false },
      { where: { businessOwnerId, isDefault: true } }
    );

    if (flowId) {
      const flow = await this.getFlowById(flowId, businessOwnerId);
      await flow.update({ isDefault: true });
      return flow;
    }

    return null;
  }

  /**
   * Clear the default flow (no default)
   * @param {number} businessOwnerId - The business owner's user ID
   */
  static async clearDefaultFlow(businessOwnerId) {
    await CustomJobFlow.update(
      { isDefault: false },
      { where: { businessOwnerId, isDefault: true } }
    );
  }

  // ========== Checklist Management ==========

  /**
   * Create a checklist from scratch
   * @param {number} flowId - The flow ID
   * @param {number} businessOwnerId - The business owner's user ID
   * @param {Object} data - Checklist data { sections: [...] }
   * @returns {Object} Created checklist
   */
  static async createChecklistFromScratch(flowId, businessOwnerId, data) {
    await this.getFlowById(flowId, businessOwnerId); // Authorization check

    // Check if checklist already exists
    const existing = await CustomJobFlowChecklist.findOne({
      where: { customJobFlowId: flowId },
    });

    if (existing) {
      throw new Error("Checklist already exists for this flow. Use update instead.");
    }

    const checklist = await CustomJobFlowChecklist.create({
      customJobFlowId: flowId,
      forkedFromPlatformVersion: null,
      snapshotData: data,
    });

    return checklist;
  }

  /**
   * Fork the platform checklist for customization
   * @param {number} flowId - The flow ID
   * @param {number} businessOwnerId - The business owner's user ID
   * @param {number} versionId - Optional specific version ID (defaults to latest)
   * @returns {Object} Created checklist
   */
  static async forkPlatformChecklist(flowId, businessOwnerId, versionId = null) {
    await this.getFlowById(flowId, businessOwnerId); // Authorization check

    // Check if checklist already exists
    const existing = await CustomJobFlowChecklist.findOne({
      where: { customJobFlowId: flowId },
    });

    if (existing) {
      throw new Error("Checklist already exists for this flow. Delete it first to fork again.");
    }

    // Get the platform checklist
    let platformChecklist;
    if (versionId) {
      platformChecklist = await ChecklistVersion.findByPk(versionId);
    } else {
      platformChecklist = await ChecklistVersion.findOne({
        where: { isActive: true },
        order: [["version", "DESC"]],
      });
    }

    if (!platformChecklist) {
      throw new Error("No platform checklist found to fork");
    }

    const checklist = await CustomJobFlowChecklist.create({
      customJobFlowId: flowId,
      forkedFromPlatformVersion: platformChecklist.version,
      snapshotData: platformChecklist.snapshotData,
    });

    return checklist;
  }

  /**
   * Update a flow's checklist
   * @param {number} flowId - The flow ID
   * @param {number} businessOwnerId - The business owner's user ID
   * @param {Object} data - Updated checklist data { sections: [...] }
   * @returns {Object} Updated checklist
   */
  static async updateChecklist(flowId, businessOwnerId, data) {
    await this.getFlowById(flowId, businessOwnerId); // Authorization check

    const checklist = await CustomJobFlowChecklist.findOne({
      where: { customJobFlowId: flowId },
    });

    if (!checklist) {
      throw new Error("No checklist exists for this flow. Create one first.");
    }

    await checklist.update({ snapshotData: data });

    return checklist;
  }

  /**
   * Delete a flow's checklist
   * @param {number} flowId - The flow ID
   * @param {number} businessOwnerId - The business owner's user ID
   */
  static async deleteChecklist(flowId, businessOwnerId) {
    await this.getFlowById(flowId, businessOwnerId); // Authorization check

    await CustomJobFlowChecklist.destroy({
      where: { customJobFlowId: flowId },
    });
  }

  /**
   * Add or update notes for a specific checklist item
   * @param {number} flowId - The flow ID
   * @param {number} businessOwnerId - The business owner's user ID
   * @param {string} itemId - The item ID within the checklist
   * @param {string} notes - The notes to add
   * @returns {Object} Updated checklist
   */
  static async addItemNotes(flowId, businessOwnerId, itemId, notes) {
    await this.getFlowById(flowId, businessOwnerId); // Authorization check

    const checklist = await CustomJobFlowChecklist.findOne({
      where: { customJobFlowId: flowId },
    });

    if (!checklist || !checklist.snapshotData) {
      throw new Error("No checklist exists for this flow");
    }

    const data = { ...checklist.snapshotData };
    let found = false;

    // Find the item and update its notes
    for (const section of data.sections || []) {
      for (const item of section.items || []) {
        if (item.id === itemId) {
          item.notes = notes;
          found = true;
          break;
        }
      }
      if (found) break;
    }

    if (!found) {
      throw new Error("Item not found in checklist");
    }

    await checklist.update({ snapshotData: data });

    return checklist;
  }

  // ========== Flow Assignment ==========

  /**
   * Assign a flow to a client (all their jobs)
   * @param {number} businessOwnerId - The business owner's user ID
   * @param {number} cleanerClientId - The CleanerClient ID
   * @param {number} flowId - The flow ID
   * @returns {Object} Created assignment
   */
  static async assignFlowToClient(businessOwnerId, cleanerClientId, flowId) {
    // Verify the flow belongs to this business owner
    await this.getFlowById(flowId, businessOwnerId);

    // Verify the client relationship
    const clientRelation = await CleanerClient.findOne({
      where: { id: cleanerClientId, cleanerId: businessOwnerId, status: "active" },
    });

    if (!clientRelation) {
      throw new Error("Client not found or not your client");
    }

    // Check for existing client-level assignment
    const existing = await ClientJobFlowAssignment.findOne({
      where: {
        businessOwnerId,
        cleanerClientId,
        homeId: null,
      },
    });

    if (existing) {
      // Update existing assignment
      await existing.update({ customJobFlowId: flowId });
      return existing;
    }

    const assignment = await ClientJobFlowAssignment.create({
      businessOwnerId,
      cleanerClientId,
      homeId: null,
      customJobFlowId: flowId,
    });

    return assignment;
  }

  /**
   * Assign a flow to a specific home
   * @param {number} businessOwnerId - The business owner's user ID
   * @param {number} homeId - The UserHomes ID
   * @param {number} flowId - The flow ID
   * @returns {Object} Created assignment
   */
  static async assignFlowToHome(businessOwnerId, homeId, flowId) {
    // Verify the flow belongs to this business owner
    await this.getFlowById(flowId, businessOwnerId);

    // Verify the home exists and belongs to one of the business owner's clients
    const home = await UserHomes.findByPk(homeId);
    if (!home) {
      throw new Error("Home not found");
    }

    const clientRelation = await CleanerClient.findOne({
      where: { cleanerId: businessOwnerId, clientId: home.userId, status: "active" },
    });

    if (!clientRelation) {
      throw new Error("Home does not belong to one of your clients");
    }

    // Check for existing home-level assignment
    const existing = await ClientJobFlowAssignment.findOne({
      where: { businessOwnerId, homeId },
    });

    if (existing) {
      // Update existing assignment
      await existing.update({ customJobFlowId: flowId });
      return existing;
    }

    const assignment = await ClientJobFlowAssignment.create({
      businessOwnerId,
      cleanerClientId: clientRelation.id,
      homeId,
      customJobFlowId: flowId,
    });

    return assignment;
  }

  /**
   * Remove a flow assignment
   * @param {number} assignmentId - The ClientJobFlowAssignment ID
   * @param {number} businessOwnerId - The business owner's user ID
   */
  static async removeFlowAssignment(assignmentId, businessOwnerId) {
    const assignment = await ClientJobFlowAssignment.findOne({
      where: { id: assignmentId, businessOwnerId },
    });

    if (!assignment) {
      throw new Error("Assignment not found or access denied");
    }

    await assignment.destroy();
  }

  /**
   * Get all flow assignments for a business owner
   * @param {number} businessOwnerId - The business owner's user ID
   * @returns {Array} List of assignments with flow details
   */
  static async getFlowAssignments(businessOwnerId) {
    const assignments = await ClientJobFlowAssignment.findAll({
      where: { businessOwnerId },
      include: [
        { model: CustomJobFlow, as: "flow" },
        { model: CleanerClient, as: "cleanerClient" },
        { model: UserHomes, as: "home" },
      ],
      order: [["createdAt", "DESC"]],
    });

    return assignments;
  }

  // ========== Flow Resolution ==========

  /**
   * Resolve which flow to use for an appointment
   * Hierarchy: marketplace > job override > home > client > default > none
   * @param {Object} appointment - The appointment object
   * @param {number} businessOwnerId - The business owner's user ID
   * @param {number} jobFlowOverride - Optional job-level flow override ID
   * @returns {Object} Resolved flow info { usesPlatformFlow, customJobFlowId, flow, photoRequirement }
   */
  static async resolveFlowForAppointment(appointment, businessOwnerId, jobFlowOverride = null) {
    const MarketplaceJobRequirementsService = require("./MarketplaceJobRequirementsService");

    // 1. Check if this is a marketplace job
    const isMarketplace = await MarketplaceJobRequirementsService.isMarketplaceJob(
      appointment,
      businessOwnerId
    );

    if (isMarketplace) {
      return {
        usesPlatformFlow: true,
        customJobFlowId: null,
        flow: null,
        photoRequirement: "platform_required",
        source: "marketplace",
      };
    }

    // 2. Check for job-level override
    if (jobFlowOverride) {
      try {
        const flow = await this.getFlowById(jobFlowOverride, businessOwnerId);
        return {
          usesPlatformFlow: false,
          customJobFlowId: flow.id,
          flow,
          photoRequirement: flow.photoRequirement,
          source: "job_override",
        };
      } catch (e) {
        // Invalid override, continue to next level
      }
    }

    // 3. Check for home-level assignment
    if (appointment.homeId) {
      const homeAssignment = await ClientJobFlowAssignment.findOne({
        where: { businessOwnerId, homeId: appointment.homeId },
        include: [{ model: CustomJobFlow, as: "flow" }],
      });

      if (homeAssignment && homeAssignment.flow?.isActive()) {
        return {
          usesPlatformFlow: false,
          customJobFlowId: homeAssignment.flow.id,
          flow: homeAssignment.flow,
          photoRequirement: homeAssignment.flow.photoRequirement,
          source: "home",
        };
      }
    }

    // 4. Check for client-level assignment
    const clientRelation = await CleanerClient.findOne({
      where: { cleanerId: businessOwnerId, clientId: appointment.userId, status: "active" },
    });

    if (clientRelation) {
      const clientAssignment = await ClientJobFlowAssignment.findOne({
        where: {
          businessOwnerId,
          cleanerClientId: clientRelation.id,
          homeId: null,
        },
        include: [{ model: CustomJobFlow, as: "flow" }],
      });

      if (clientAssignment && clientAssignment.flow?.isActive()) {
        return {
          usesPlatformFlow: false,
          customJobFlowId: clientAssignment.flow.id,
          flow: clientAssignment.flow,
          photoRequirement: clientAssignment.flow.photoRequirement,
          source: "client",
        };
      }
    }

    // 5. Check for business default
    const defaultFlow = await CustomJobFlow.findOne({
      where: { businessOwnerId, isDefault: true, status: "active" },
    });

    if (defaultFlow) {
      return {
        usesPlatformFlow: false,
        customJobFlowId: defaultFlow.id,
        flow: defaultFlow,
        photoRequirement: defaultFlow.photoRequirement,
        source: "default",
      };
    }

    // 6. No flow - flexible own-client job
    return {
      usesPlatformFlow: false,
      customJobFlowId: null,
      flow: null,
      photoRequirement: "optional",
      source: "none",
    };
  }
}

module.exports = CustomJobFlowService;
