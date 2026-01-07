/**
 * AppointmentJobFlowService
 * Handles per-appointment job flow lifecycle, checklist progress, and photo tracking
 */

const {
  AppointmentJobFlow,
  CustomJobFlow,
  CustomJobFlowChecklist,
  EmployeeJobAssignment,
  JobPhoto,
  UserAppointments,
  ChecklistVersion,
  sequelize,
} = require("../models");

class AppointmentJobFlowService {
  /**
   * Create a job flow for an appointment
   * @param {number} appointmentId - The appointment ID
   * @param {Object} flowResolution - Result from CustomJobFlowService.resolveFlowForAppointment
   * @returns {Object} Created AppointmentJobFlow
   */
  static async createJobFlowForAppointment(appointmentId, flowResolution) {
    // Check if one already exists
    const existing = await AppointmentJobFlow.findOne({
      where: { appointmentId },
    });

    if (existing) {
      throw new Error("Job flow already exists for this appointment");
    }

    let checklistSnapshotData = null;
    let checklistProgress = null;

    // Get checklist data based on source
    if (flowResolution.usesPlatformFlow) {
      // Platform flow - use published checklist
      const platformChecklist = await ChecklistVersion.findOne({
        where: { isActive: true },
        order: [["version", "DESC"]],
      });

      if (platformChecklist) {
        checklistSnapshotData = platformChecklist.snapshotData;
        checklistProgress = this.initializeProgress(checklistSnapshotData);
      }
    } else if (flowResolution.customJobFlowId) {
      // Custom flow - use the flow's checklist
      const flowChecklist = await CustomJobFlowChecklist.findOne({
        where: { customJobFlowId: flowResolution.customJobFlowId },
      });

      if (flowChecklist) {
        checklistSnapshotData = flowChecklist.snapshotData;
        checklistProgress = this.initializeProgress(checklistSnapshotData);
      }
    }

    const jobFlow = await AppointmentJobFlow.create({
      appointmentId,
      customJobFlowId: flowResolution.customJobFlowId,
      usesPlatformFlow: flowResolution.usesPlatformFlow,
      checklistSnapshotData,
      checklistProgress,
      checklistCompleted: false,
      photoRequirement: flowResolution.photoRequirement,
      beforePhotoCount: 0,
      afterPhotoCount: 0,
      photosCompleted: false,
      employeeNotes: null,
    });

    return jobFlow;
  }

  /**
   * Get job flow for an appointment
   * @param {number} appointmentId - The appointment ID
   * @returns {Object} AppointmentJobFlow or null
   */
  static async getJobFlowByAppointmentId(appointmentId) {
    return AppointmentJobFlow.findOne({
      where: { appointmentId },
      include: [{ model: CustomJobFlow, as: "customFlow" }],
    });
  }

  /**
   * Get job flow for an employee assignment
   * @param {number} assignmentId - The EmployeeJobAssignment ID
   * @returns {Object} AppointmentJobFlow or null
   */
  static async getJobFlowForAssignment(assignmentId) {
    const assignment = await EmployeeJobAssignment.findByPk(assignmentId, {
      include: [{ model: AppointmentJobFlow, as: "jobFlow" }],
    });

    if (!assignment) {
      throw new Error("Assignment not found");
    }

    return assignment.jobFlow;
  }

  /**
   * Get or create job flow for an appointment
   * @param {number} appointmentId - The appointment ID
   * @param {Object} flowResolution - Result from CustomJobFlowService.resolveFlowForAppointment
   * @returns {Object} AppointmentJobFlow
   */
  static async getOrCreateJobFlow(appointmentId, flowResolution) {
    let jobFlow = await this.getJobFlowByAppointmentId(appointmentId);

    if (!jobFlow) {
      jobFlow = await this.createJobFlowForAppointment(appointmentId, flowResolution);
    }

    return jobFlow;
  }

  // ========== Checklist Operations ==========

  /**
   * Initialize progress object from checklist snapshot
   * @param {Object} snapshotData - The checklist snapshot data
   * @returns {Object} Progress object with completed and na arrays
   */
  static initializeProgress(snapshotData) {
    if (!snapshotData?.sections) return {};

    const progress = {};
    for (const section of snapshotData.sections) {
      const itemIds = section.items ? section.items.map((item) => item.id) : [];
      progress[section.id] = {
        total: itemIds,
        completed: [],
        na: [],
      };
    }
    return progress;
  }

  /**
   * Get checklist with current progress
   * @param {number} appointmentJobFlowId - The AppointmentJobFlow ID
   * @returns {Object} Checklist with progress info
   */
  static async getChecklist(appointmentJobFlowId) {
    const jobFlow = await AppointmentJobFlow.findByPk(appointmentJobFlowId, {
      include: [{ model: CustomJobFlow, as: "customFlow" }],
    });

    if (!jobFlow) {
      throw new Error("Job flow not found");
    }

    return {
      snapshotData: jobFlow.checklistSnapshotData,
      progress: jobFlow.checklistProgress,
      completed: jobFlow.checklistCompleted,
      jobNotes: jobFlow.customFlow?.jobNotes || null,
      hasChecklist: jobFlow.hasChecklist(),
      itemCount: jobFlow.getItemCount(),
      completedCount: jobFlow.getCompletedItemCount(),
      completionPercentage: jobFlow.getChecklistCompletionPercentage(),
    };
  }

  /**
   * Update checklist progress for a single item
   * @param {number} appointmentJobFlowId - The AppointmentJobFlow ID
   * @param {string} sectionId - The section ID
   * @param {string} itemId - The item ID
   * @param {string|boolean|null} status - "completed", "na", null, or boolean for backwards compatibility
   * @returns {Object} Updated progress info
   */
  static async updateChecklistProgress(appointmentJobFlowId, sectionId, itemId, status) {
    const jobFlow = await AppointmentJobFlow.findByPk(appointmentJobFlowId);

    if (!jobFlow) {
      throw new Error("Job flow not found");
    }

    if (!jobFlow.hasChecklist()) {
      throw new Error("No checklist for this job flow");
    }

    let progress = jobFlow.checklistProgress || {};

    // Initialize section if not exists
    if (!progress[sectionId]) {
      progress[sectionId] = { total: [], completed: [], na: [] };
    }

    // Ensure na array exists for backwards compatibility
    if (!progress[sectionId].na) {
      progress[sectionId].na = [];
    }

    // Handle backwards compatibility: boolean true -> "completed", false -> null
    let normalizedStatus = status;
    if (status === true) {
      normalizedStatus = "completed";
    } else if (status === false) {
      normalizedStatus = null;
    }

    // Remove item from both arrays first
    progress[sectionId].completed = progress[sectionId].completed.filter(
      (id) => id !== itemId
    );
    progress[sectionId].na = progress[sectionId].na.filter(
      (id) => id !== itemId
    );

    // Add to appropriate array based on status
    if (normalizedStatus === "completed") {
      progress[sectionId].completed.push(itemId);
    } else if (normalizedStatus === "na") {
      progress[sectionId].na.push(itemId);
    }
    // If null, item remains unchecked (not in either array)

    // Calculate if checklist is complete
    const checklistCompleted = this.isChecklistComplete(progress);

    await jobFlow.update({
      checklistProgress: progress,
      checklistCompleted,
    });

    return {
      checklistProgress: progress,
      checklistCompleted,
      completionPercentage: jobFlow.getChecklistCompletionPercentage(),
    };
  }

  /**
   * Bulk update checklist progress
   * @param {number} appointmentJobFlowId - The AppointmentJobFlow ID
   * @param {Object} updates - Object with sectionId keys and arrays of {itemId, status} or {itemId, completed} for backwards compatibility
   * @returns {Object} Updated progress info
   */
  static async bulkUpdateChecklistProgress(appointmentJobFlowId, updates) {
    const jobFlow = await AppointmentJobFlow.findByPk(appointmentJobFlowId);

    if (!jobFlow) {
      throw new Error("Job flow not found");
    }

    if (!jobFlow.hasChecklist()) {
      throw new Error("No checklist for this job flow");
    }

    let progress = jobFlow.checklistProgress || {};

    for (const [sectionId, items] of Object.entries(updates)) {
      if (!progress[sectionId]) {
        progress[sectionId] = { total: [], completed: [], na: [] };
      }

      // Ensure na array exists for backwards compatibility
      if (!progress[sectionId].na) {
        progress[sectionId].na = [];
      }

      for (const item of items) {
        const { itemId } = item;
        // Support both 'status' and 'completed' for backwards compatibility
        let status = item.status;
        if (status === undefined && item.completed !== undefined) {
          status = item.completed ? "completed" : null;
        }

        // Remove from both arrays first
        progress[sectionId].completed = progress[sectionId].completed.filter(
          (id) => id !== itemId
        );
        progress[sectionId].na = progress[sectionId].na.filter(
          (id) => id !== itemId
        );

        // Add to appropriate array
        if (status === "completed") {
          progress[sectionId].completed.push(itemId);
        } else if (status === "na") {
          progress[sectionId].na.push(itemId);
        }
      }
    }

    const checklistCompleted = this.isChecklistComplete(progress);

    await jobFlow.update({
      checklistProgress: progress,
      checklistCompleted,
    });

    return {
      checklistProgress: progress,
      checklistCompleted,
      completionPercentage: jobFlow.getChecklistCompletionPercentage(),
    };
  }

  /**
   * Check if checklist is complete
   * Items can be completed OR marked N/A to count toward completion
   * @param {Object} progress - Progress object
   * @returns {boolean}
   */
  static isChecklistComplete(progress) {
    if (!progress || typeof progress !== "object") {
      return false;
    }

    for (const sectionId of Object.keys(progress)) {
      const section = progress[sectionId];
      if (!section.total || !section.completed) {
        return false;
      }

      const completedCount = section.completed?.length || 0;
      const naCount = section.na?.length || 0;
      const doneCount = completedCount + naCount;

      if (doneCount < section.total.length) {
        return false;
      }
    }

    return true;
  }

  // ========== Photo Operations ==========

  /**
   * Update photo counts for a job flow
   * @param {number} appointmentJobFlowId - The AppointmentJobFlow ID
   * @param {number} employeeUserId - The employee's user ID
   * @returns {Object} Updated photo info
   */
  static async updatePhotoCounts(appointmentJobFlowId, employeeUserId) {
    const jobFlow = await AppointmentJobFlow.findByPk(appointmentJobFlowId, {
      include: [{ model: UserAppointments, as: "appointment" }],
    });

    if (!jobFlow) {
      throw new Error("Job flow not found");
    }

    // Count photos for this job
    const beforeCount = await JobPhoto.count({
      where: {
        appointmentId: jobFlow.appointmentId,
        cleanerId: employeeUserId,
        photoType: "before",
      },
    });

    const afterCount = await JobPhoto.count({
      where: {
        appointmentId: jobFlow.appointmentId,
        cleanerId: employeeUserId,
        photoType: "after",
      },
    });

    const photosCompleted = beforeCount > 0 && afterCount > 0;

    await jobFlow.update({
      beforePhotoCount: beforeCount,
      afterPhotoCount: afterCount,
      photosCompleted,
    });

    return {
      beforePhotoCount: beforeCount,
      afterPhotoCount: afterCount,
      photosCompleted,
      photoRequirement: jobFlow.photoRequirement,
    };
  }

  /**
   * Check if photos can be skipped
   * @param {number} appointmentJobFlowId - The AppointmentJobFlow ID
   * @returns {boolean}
   */
  static async canSkipPhotos(appointmentJobFlowId) {
    const jobFlow = await AppointmentJobFlow.findByPk(appointmentJobFlowId);

    if (!jobFlow) {
      throw new Error("Job flow not found");
    }

    // Can skip if photos are optional or hidden
    return !jobFlow.requiresPhotos();
  }

  // ========== Employee Notes ==========

  /**
   * Add or update employee notes
   * @param {number} appointmentJobFlowId - The AppointmentJobFlow ID
   * @param {string} notes - The notes text
   * @returns {Object} Updated job flow
   */
  static async updateEmployeeNotes(appointmentJobFlowId, notes) {
    const jobFlow = await AppointmentJobFlow.findByPk(appointmentJobFlowId);

    if (!jobFlow) {
      throw new Error("Job flow not found");
    }

    await jobFlow.update({ employeeNotes: notes });

    return jobFlow;
  }

  // ========== Completion ==========

  /**
   * Validate completion requirements
   * @param {number} appointmentJobFlowId - The AppointmentJobFlow ID
   * @throws {Error} If requirements are not met
   */
  static async validateCompletionRequirements(appointmentJobFlowId) {
    const jobFlow = await AppointmentJobFlow.findByPk(appointmentJobFlowId);

    if (!jobFlow) {
      throw new Error("Job flow not found");
    }

    const validation = jobFlow.validateCompletion();

    if (!validation.isValid) {
      throw new Error(`Cannot complete job: ${validation.errors.join(", ")}`);
    }

    return true;
  }

  /**
   * Get completion status
   * @param {number} appointmentJobFlowId - The AppointmentJobFlow ID
   * @returns {Object} Completion status details
   */
  static async getCompletionStatus(appointmentJobFlowId) {
    const jobFlow = await AppointmentJobFlow.findByPk(appointmentJobFlowId, {
      include: [{ model: CustomJobFlow, as: "customFlow" }],
    });

    if (!jobFlow) {
      throw new Error("Job flow not found");
    }

    const validation = jobFlow.validateCompletion();

    return {
      appointmentJobFlowId,
      isMarketplaceFlow: jobFlow.isMarketplaceFlow(),
      photoRequirement: jobFlow.photoRequirement,
      beforePhotoCount: jobFlow.beforePhotoCount,
      afterPhotoCount: jobFlow.afterPhotoCount,
      photosCompleted: jobFlow.photosCompleted,
      hasChecklist: jobFlow.hasChecklist(),
      checklistCompleted: jobFlow.checklistCompleted,
      checklistCompletionPercentage: jobFlow.getChecklistCompletionPercentage(),
      canComplete: validation.isValid,
      missingRequirements: validation.errors,
      jobNotes: jobFlow.customFlow?.jobNotes || null,
      employeeNotes: jobFlow.employeeNotes,
    };
  }

  /**
   * Get full flow details for employee view
   * @param {number} assignmentId - The EmployeeJobAssignment ID
   * @returns {Object} Complete flow information
   */
  static async getFlowDetailsForEmployee(assignmentId) {
    const assignment = await EmployeeJobAssignment.findByPk(assignmentId, {
      include: [
        {
          model: AppointmentJobFlow,
          as: "jobFlow",
          include: [{ model: CustomJobFlow, as: "customFlow" }],
        },
      ],
    });

    if (!assignment) {
      throw new Error("Assignment not found");
    }

    const jobFlow = assignment.jobFlow;

    if (!jobFlow) {
      // No job flow - flexible own-client job
      return {
        hasJobFlow: false,
        isMarketplaceFlow: false,
        photoRequirement: "optional",
        requiresPhotos: false,
        photosHidden: false,
        hasChecklist: false,
        checklist: null,
        checklistProgress: null,
        jobNotes: null,
        canComplete: true,
        missingRequirements: [],
      };
    }

    const validation = jobFlow.validateCompletion();

    return {
      hasJobFlow: true,
      appointmentJobFlowId: jobFlow.id,
      isMarketplaceFlow: jobFlow.isMarketplaceFlow(),
      photoRequirement: jobFlow.photoRequirement,
      requiresPhotos: jobFlow.requiresPhotos(),
      photosHidden: jobFlow.photosHidden(),
      beforePhotoCount: jobFlow.beforePhotoCount,
      afterPhotoCount: jobFlow.afterPhotoCount,
      photosCompleted: jobFlow.photosCompleted,
      hasChecklist: jobFlow.hasChecklist(),
      checklist: jobFlow.checklistSnapshotData,
      checklistProgress: jobFlow.checklistProgress,
      checklistCompleted: jobFlow.checklistCompleted,
      checklistCompletionPercentage: jobFlow.getChecklistCompletionPercentage(),
      jobNotes: jobFlow.customFlow?.jobNotes || null,
      employeeNotes: jobFlow.employeeNotes,
      canComplete: validation.isValid,
      missingRequirements: validation.errors,
    };
  }

  /**
   * Enforce platform flow for a marketplace job
   * Called when a marketplace job is detected to ensure requirements
   * @param {number} appointmentId - The appointment ID
   * @returns {Object} AppointmentJobFlow
   */
  static async enforcePlatformFlow(appointmentId) {
    let jobFlow = await this.getJobFlowByAppointmentId(appointmentId);

    if (jobFlow) {
      // Update to platform flow if not already
      if (!jobFlow.usesPlatformFlow) {
        const platformChecklist = await ChecklistVersion.findOne({
          where: { isActive: true },
          order: [["version", "DESC"]],
        });

        await jobFlow.update({
          usesPlatformFlow: true,
          customJobFlowId: null,
          photoRequirement: "platform_required",
          checklistSnapshotData: platformChecklist?.snapshotData || null,
          checklistProgress: platformChecklist
            ? this.initializeProgress(platformChecklist.snapshotData)
            : null,
        });
      }
    } else {
      // Create with platform flow
      jobFlow = await this.createJobFlowForAppointment(appointmentId, {
        usesPlatformFlow: true,
        customJobFlowId: null,
        photoRequirement: "platform_required",
      });
    }

    return jobFlow;
  }
}

module.exports = AppointmentJobFlowService;
