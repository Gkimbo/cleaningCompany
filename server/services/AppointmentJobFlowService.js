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
   * @param {Object} transaction - Optional Sequelize transaction
   * @returns {Object} Created AppointmentJobFlow
   */
  static async createJobFlowForAppointment(appointmentId, flowResolution, transaction = null) {
    const queryOptions = transaction ? { transaction } : {};

    // Check if one already exists
    const existing = await AppointmentJobFlow.findOne({
      where: { appointmentId },
      ...queryOptions,
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
        ...queryOptions,
      });

      if (platformChecklist) {
        checklistSnapshotData = platformChecklist.snapshotData;
        checklistProgress = this.initializeProgress(checklistSnapshotData);
      }
    } else if (flowResolution.customJobFlowId) {
      // Custom flow - use the flow's checklist
      const flowChecklist = await CustomJobFlowChecklist.findOne({
        where: { customJobFlowId: flowResolution.customJobFlowId },
        ...queryOptions,
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
    }, queryOptions);

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

    // Validate sectionId and itemId exist in the checklist snapshot
    const snapshotData = jobFlow.checklistSnapshotData;
    if (snapshotData?.sections) {
      const validSection = snapshotData.sections.find((s) => s.id === sectionId);
      if (!validSection) {
        throw new Error(`Invalid section ID: ${sectionId}`);
      }
      const validItem = validSection.items?.find((i) => i.id === itemId);
      if (!validItem) {
        throw new Error(`Invalid item ID: ${itemId} in section ${sectionId}`);
      }
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

    // Build a map of valid sections and items from the snapshot
    const snapshotData = jobFlow.checklistSnapshotData;
    const validSections = new Map();
    if (snapshotData?.sections) {
      for (const section of snapshotData.sections) {
        const validItems = new Set(section.items?.map((i) => i.id) || []);
        validSections.set(section.id, validItems);
      }
    }

    // Validate all section and item IDs before processing
    for (const [sectionId, items] of Object.entries(updates)) {
      if (!validSections.has(sectionId)) {
        throw new Error(`Invalid section ID: ${sectionId}`);
      }
      const validItems = validSections.get(sectionId);
      for (const item of items) {
        if (!validItems.has(item.itemId)) {
          throw new Error(`Invalid item ID: ${item.itemId} in section ${sectionId}`);
        }
      }
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

        // Add to appropriate array (with duplicate check)
        if (status === "completed") {
          if (!progress[sectionId].completed.includes(itemId)) {
            progress[sectionId].completed.push(itemId);
          }
        } else if (status === "na") {
          if (!progress[sectionId].na.includes(itemId)) {
            progress[sectionId].na.push(itemId);
          }
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
      // Validate section structure - total and completed must be arrays
      if (!Array.isArray(section?.total) || !Array.isArray(section?.completed)) {
        return false;
      }

      const completedCount = section.completed.length;
      const naCount = Array.isArray(section.na) ? section.na.length : 0;
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

    // Count all photos for this job (including N/A for display purposes)
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

    // Count real photos (excluding N/A) for determining completion
    const realBeforeCount = await JobPhoto.count({
      where: {
        appointmentId: jobFlow.appointmentId,
        cleanerId: employeeUserId,
        photoType: "before",
        isNotApplicable: false,
      },
    });

    const realAfterCount = await JobPhoto.count({
      where: {
        appointmentId: jobFlow.appointmentId,
        cleanerId: employeeUserId,
        photoType: "after",
        isNotApplicable: false,
      },
    });

    // Photos are only considered "completed" if there are real photos (not N/A)
    const photosCompleted = realBeforeCount > 0 && realAfterCount > 0;

    await jobFlow.update({
      beforePhotoCount: beforeCount,
      afterPhotoCount: afterCount,
      photosCompleted,
    });

    return {
      beforePhotoCount: beforeCount,
      afterPhotoCount: afterCount,
      realBeforePhotoCount: realBeforeCount,
      realAfterPhotoCount: realAfterCount,
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
   * Validate completion requirements with fresh photo counts
   * @param {number} appointmentJobFlowId - The AppointmentJobFlow ID
   * @param {number} cleanerId - Optional cleaner ID for photo count filtering
   * @throws {Error} If requirements are not met
   */
  static async validateCompletionRequirements(appointmentJobFlowId, cleanerId = null) {
    const jobFlow = await AppointmentJobFlow.findByPk(appointmentJobFlowId);

    if (!jobFlow) {
      throw new Error("Job flow not found");
    }

    const errors = [];

    // Do fresh photo counts instead of relying on cached values
    if (jobFlow.requiresPhotos()) {
      const photoWhereBase = {
        appointmentId: jobFlow.appointmentId,
        isNotApplicable: false, // Only count real photos
      };
      if (cleanerId) {
        photoWhereBase.cleanerId = cleanerId;
      }

      const realBeforeCount = await JobPhoto.count({
        where: { ...photoWhereBase, photoType: "before" },
      });
      const realAfterCount = await JobPhoto.count({
        where: { ...photoWhereBase, photoType: "after" },
      });

      if (realBeforeCount === 0) {
        errors.push("Before photos are required");
      }
      if (realAfterCount === 0) {
        errors.push("After photos are required");
      }
    }

    // Check checklist completion
    if (jobFlow.hasChecklist() && !jobFlow.checklistCompleted) {
      const percentage = jobFlow.getChecklistCompletionPercentage();
      if (percentage < 100) {
        errors.push(`Checklist is ${percentage}% complete`);
      }
    }

    if (errors.length > 0) {
      throw new Error(`Cannot complete job: ${errors.join(", ")}`);
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
   * Get flow details for an appointment (for marketplace cleaners/business owners)
   * @param {number} appointmentId - The appointment ID
   * @returns {Object|null} Flow information or null if no custom flow
   */
  static async getFlowDetailsForAppointment(appointmentId) {
    const jobFlow = await this.getJobFlowByAppointmentId(appointmentId);

    if (!jobFlow) {
      return null;
    }

    // Load the custom flow if present
    if (jobFlow.customJobFlowId) {
      await jobFlow.reload({
        include: [{ model: CustomJobFlow, as: "customFlow" }],
      });
    }

    return {
      hasJobFlow: true,
      appointmentJobFlowId: jobFlow.id,
      isMarketplaceFlow: jobFlow.isMarketplaceFlow(),
      photoRequirement: jobFlow.photoRequirement === "platform_required" ? "required" : jobFlow.photoRequirement,
      requiresPhotos: jobFlow.requiresPhotos(),
      photosHidden: jobFlow.photosHidden(),
      hasChecklist: jobFlow.hasChecklist(),
      checklist: jobFlow.checklistSnapshotData,
      jobNotes: jobFlow.customFlow?.jobNotes || null,
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

        // Preserve existing progress if possible
        let newProgress;
        if (platformChecklist?.snapshotData) {
          const freshProgress = this.initializeProgress(platformChecklist.snapshotData);
          // Migrate existing progress to new checklist structure
          newProgress = this.migrateProgress(
            jobFlow.checklistProgress,
            freshProgress
          );
        } else {
          newProgress = null;
        }

        await jobFlow.update({
          usesPlatformFlow: true,
          customJobFlowId: null,
          photoRequirement: "platform_required",
          checklistSnapshotData: platformChecklist?.snapshotData || null,
          checklistProgress: newProgress,
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

  /**
   * Migrate progress from one checklist structure to another
   * Preserves completed/na status for items that exist in the new structure
   * @param {Object} oldProgress - Existing progress object
   * @param {Object} newProgress - Fresh progress object from new checklist
   * @returns {Object} Merged progress
   */
  static migrateProgress(oldProgress, newProgress) {
    if (!oldProgress || !newProgress) {
      return newProgress || {};
    }

    const merged = JSON.parse(JSON.stringify(newProgress));

    for (const [sectionId, sectionProgress] of Object.entries(oldProgress)) {
      if (!merged[sectionId]) {
        continue; // Section doesn't exist in new checklist
      }

      const validItems = new Set(merged[sectionId].total || []);

      // Copy over completed items that exist in the new checklist
      if (sectionProgress.completed) {
        for (const itemId of sectionProgress.completed) {
          if (validItems.has(itemId) && !merged[sectionId].completed.includes(itemId)) {
            merged[sectionId].completed.push(itemId);
          }
        }
      }

      // Copy over N/A items that exist in the new checklist
      if (sectionProgress.na) {
        for (const itemId of sectionProgress.na) {
          if (validItems.has(itemId) && !merged[sectionId].na.includes(itemId)) {
            merged[sectionId].na.push(itemId);
          }
        }
      }
    }

    return merged;
  }
}

module.exports = AppointmentJobFlowService;
