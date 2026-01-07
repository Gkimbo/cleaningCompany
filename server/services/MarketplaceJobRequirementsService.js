/**
 * MarketplaceJobRequirementsService
 * Handles checklist and photo requirements for marketplace jobs picked up by business owners
 */

const {
  EmployeeJobAssignment,
  JobPhoto,
  UserAppointments,
  ChecklistVersion,
  sequelize,
} = require("../models");

class MarketplaceJobRequirementsService {
  /**
   * Check if an appointment is a marketplace job (not the business owner's own client)
   * @param {Object} appointment - The appointment to check
   * @param {number} businessOwnerId - The business owner's user ID
   * @returns {boolean}
   */
  static async isMarketplaceJob(appointment, businessOwnerId) {
    // A marketplace job is one where:
    // 1. The job was not booked by the business owner (not their client)
    // 2. The business owner picked it up from the unassigned pool

    // Check if this appointment was created by a CleanerClient relationship
    // where the business owner is the cleaner
    const { CleanerClient } = require("../models");

    const isOwnClient = await CleanerClient.findOne({
      where: {
        cleanerId: businessOwnerId,
        clientId: appointment.userId,
        status: "active",
      },
    });

    // Also check if the business owner booked this appointment themselves
    const bookedBySelf = appointment.bookedByCleanerId === businessOwnerId;

    // If it's their own client or they booked it, it's NOT a marketplace job
    return !isOwnClient && !bookedBySelf;
  }

  /**
   * Update photo counts for an employee assignment
   * Called after a photo is uploaded
   * @param {number} assignmentId - The EmployeeJobAssignment ID
   * @param {number} employeeUserId - The employee's user ID (for verification)
   * @returns {Object} Updated assignment data
   */
  static async updatePhotoCounts(assignmentId, employeeUserId) {
    const assignment = await EmployeeJobAssignment.findByPk(assignmentId, {
      include: [{ model: UserAppointments, as: "appointment" }],
    });

    if (!assignment) {
      throw new Error("Assignment not found");
    }

    // Count photos for this assignment
    // For employee assignments, photos are linked via appointmentId and the employee's user ID
    const beforeCount = await JobPhoto.count({
      where: {
        appointmentId: assignment.appointmentId,
        cleanerId: employeeUserId,
        photoType: "before",
      },
    });

    const afterCount = await JobPhoto.count({
      where: {
        appointmentId: assignment.appointmentId,
        cleanerId: employeeUserId,
        photoType: "after",
      },
    });

    const photosCompleted = beforeCount > 0 && afterCount > 0;

    await assignment.update({
      beforePhotoCount: beforeCount,
      afterPhotoCount: afterCount,
      photosCompleted,
    });

    return {
      beforePhotoCount: beforeCount,
      afterPhotoCount: afterCount,
      photosCompleted,
    };
  }

  /**
   * Update checklist progress for an employee assignment
   * @param {number} assignmentId - The EmployeeJobAssignment ID
   * @param {Object} progress - The checklist progress object
   * @returns {Object} Updated assignment data
   */
  static async updateChecklistProgress(assignmentId, progress) {
    const assignment = await EmployeeJobAssignment.findByPk(assignmentId);

    if (!assignment) {
      throw new Error("Assignment not found");
    }

    // Calculate if checklist is complete
    const checklistCompleted = this.isChecklistComplete(progress);

    await assignment.update({
      checklistProgress: progress,
      checklistCompleted,
    });

    return {
      checklistProgress: progress,
      checklistCompleted,
    };
  }

  /**
   * Check if a checklist progress object represents a completed checklist
   * @param {Object} progress - The checklist progress object
   * @returns {boolean}
   */
  static isChecklistComplete(progress) {
    if (!progress || typeof progress !== "object") {
      return false;
    }

    // Progress format: { sectionId: { total: [...], completed: [...] }, ... }
    for (const sectionId of Object.keys(progress)) {
      const section = progress[sectionId];
      if (!section.total || !section.completed) {
        return false;
      }
      // Check if all items are completed
      if (section.completed.length < section.total.length) {
        return false;
      }
    }

    return true;
  }

  /**
   * Get the current checklist for employees to fill out
   * @returns {Object} The published checklist
   */
  static async getPublishedChecklist() {
    const checklist = await ChecklistVersion.findOne({
      where: { isActive: true },
      order: [["version", "DESC"]],
    });

    if (!checklist) {
      return null;
    }

    return checklist.snapshotData;
  }

  /**
   * Check if an assignment can be completed (all requirements met)
   * @param {number} assignmentId - The EmployeeJobAssignment ID
   * @returns {Object} Completion status with details
   */
  static async getCompletionStatus(assignmentId) {
    const assignment = await EmployeeJobAssignment.findByPk(assignmentId);

    if (!assignment) {
      throw new Error("Assignment not found");
    }

    const requirements = assignment.getCompletionRequirements();

    return {
      assignmentId,
      isMarketplacePickup: assignment.isMarketplacePickup,
      status: assignment.status,
      canComplete: assignment.canComplete(),
      requirements,
    };
  }

  /**
   * Validate that all requirements are met before completing a marketplace job
   * @param {number} assignmentId - The EmployeeJobAssignment ID
   * @throws {Error} If requirements are not met
   */
  static async validateCompletionRequirements(assignmentId) {
    const assignment = await EmployeeJobAssignment.findByPk(assignmentId);

    if (!assignment) {
      throw new Error("Assignment not found");
    }

    if (!assignment.isMarketplacePickup) {
      // Non-marketplace jobs don't have these requirements
      return true;
    }

    const requirements = assignment.getCompletionRequirements();

    if (requirements.missing.length > 0) {
      const missingItems = requirements.missing.map((item) => {
        switch (item) {
          case "checklist":
            return "complete the cleaning checklist";
          case "before_photos":
            return "upload before photos";
          case "after_photos":
            return "upload after photos";
          case "photos":
            return "complete photo documentation";
          default:
            return item;
        }
      });

      throw new Error(
        `Cannot complete job. You must: ${missingItems.join(", ")}`
      );
    }

    return true;
  }

  /**
   * Initialize checklist progress from the current published checklist
   * @returns {Object} Initial progress object with all sections and items
   */
  static async initializeChecklistProgress() {
    const checklist = await this.getPublishedChecklist();

    if (!checklist || !checklist.sections) {
      return {};
    }

    const progress = {};

    for (const section of checklist.sections) {
      const itemIds = section.items ? section.items.map((item) => item.id) : [];
      progress[section.id] = {
        total: itemIds,
        completed: [],
      };
    }

    return progress;
  }

  /**
   * Mark a checklist item as complete
   * @param {number} assignmentId - The EmployeeJobAssignment ID
   * @param {string} sectionId - The section ID
   * @param {string} itemId - The item ID
   * @returns {Object} Updated progress
   */
  static async markChecklistItemComplete(assignmentId, sectionId, itemId) {
    const assignment = await EmployeeJobAssignment.findByPk(assignmentId);

    if (!assignment) {
      throw new Error("Assignment not found");
    }

    let progress = assignment.checklistProgress || {};

    // Initialize section if not exists
    if (!progress[sectionId]) {
      progress[sectionId] = { total: [], completed: [] };
    }

    // Add item to completed if not already there
    if (!progress[sectionId].completed.includes(itemId)) {
      progress[sectionId].completed.push(itemId);
    }

    return this.updateChecklistProgress(assignmentId, progress);
  }

  /**
   * Mark a checklist item as incomplete
   * @param {number} assignmentId - The EmployeeJobAssignment ID
   * @param {string} sectionId - The section ID
   * @param {string} itemId - The item ID
   * @returns {Object} Updated progress
   */
  static async markChecklistItemIncomplete(assignmentId, sectionId, itemId) {
    const assignment = await EmployeeJobAssignment.findByPk(assignmentId);

    if (!assignment) {
      throw new Error("Assignment not found");
    }

    let progress = assignment.checklistProgress || {};

    if (progress[sectionId] && progress[sectionId].completed) {
      progress[sectionId].completed = progress[sectionId].completed.filter(
        (id) => id !== itemId
      );
    }

    return this.updateChecklistProgress(assignmentId, progress);
  }

  /**
   * Bulk update checklist progress (toggle multiple items)
   * @param {number} assignmentId - The EmployeeJobAssignment ID
   * @param {Object} updates - Object with sectionId keys and arrays of {itemId, completed} objects
   * @returns {Object} Updated progress
   */
  static async bulkUpdateChecklistProgress(assignmentId, updates) {
    const assignment = await EmployeeJobAssignment.findByPk(assignmentId);

    if (!assignment) {
      throw new Error("Assignment not found");
    }

    let progress = assignment.checklistProgress || {};

    for (const [sectionId, items] of Object.entries(updates)) {
      if (!progress[sectionId]) {
        progress[sectionId] = { total: [], completed: [] };
      }

      for (const { itemId, completed } of items) {
        if (completed) {
          if (!progress[sectionId].completed.includes(itemId)) {
            progress[sectionId].completed.push(itemId);
          }
        } else {
          progress[sectionId].completed = progress[sectionId].completed.filter(
            (id) => id !== itemId
          );
        }
      }
    }

    return this.updateChecklistProgress(assignmentId, progress);
  }
}

module.exports = MarketplaceJobRequirementsService;
