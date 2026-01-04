/**
 * AppointmentJobFlowSerializer
 * Serializes AppointmentJobFlow models for API responses
 */

class AppointmentJobFlowSerializer {
  /**
   * Serialize a single AppointmentJobFlow
   * @param {Object} jobFlow - AppointmentJobFlow instance or plain object
   * @param {Object} options - Serialization options
   * @param {boolean} options.includeChecklist - Include full checklist data
   * @param {boolean} options.includeCustomFlow - Include parent custom flow details
   * @param {boolean} options.includeAppointment - Include appointment details
   * @returns {Object} Serialized job flow
   */
  static serializeOne(jobFlow, options = {}) {
    if (!jobFlow) return null;

    const {
      includeChecklist = true,
      includeCustomFlow = false,
      includeAppointment = false,
    } = options;

    const data = jobFlow.dataValues || jobFlow;

    const serialized = {
      id: data.id,
      appointmentId: data.appointmentId,
      customJobFlowId: data.customJobFlowId,
      usesPlatformFlow: data.usesPlatformFlow,
      isMarketplaceFlow: data.usesPlatformFlow || data.photoRequirement === "platform_required",
      photoRequirement: data.photoRequirement,
      beforePhotoCount: data.beforePhotoCount,
      afterPhotoCount: data.afterPhotoCount,
      photosCompleted: data.photosCompleted,
      checklistCompleted: data.checklistCompleted,
      employeeNotes: data.employeeNotes,
      createdAt: data.createdAt,
      updatedAt: data.updatedAt,
    };

    // Include checklist data if requested
    if (includeChecklist) {
      serialized.hasChecklist = data.checklistSnapshotData != null;
      serialized.checklistSnapshotData = data.checklistSnapshotData;
      serialized.checklistProgress = data.checklistProgress;
      serialized.itemCount = this.getItemCount(data.checklistSnapshotData);
      serialized.completedCount = this.getCompletedCount(data.checklistProgress);
      serialized.naCount = this.getNACount(data.checklistProgress);
      serialized.completionPercentage = this.getCompletionPercentage(
        data.checklistSnapshotData,
        data.checklistProgress
      );
    }

    // Include custom flow if present and requested
    if (includeCustomFlow && data.customFlow) {
      const CustomJobFlowSerializer = require("./CustomJobFlowSerializer");
      serialized.customFlow = CustomJobFlowSerializer.serializeOne(data.customFlow);
    }

    // Include appointment if present and requested
    if (includeAppointment && data.appointment) {
      serialized.appointment = this.serializeAppointment(data.appointment);
    }

    return serialized;
  }

  /**
   * Serialize an array of AppointmentJobFlows
   * @param {Array} jobFlows - Array of AppointmentJobFlow instances
   * @param {Object} options - Serialization options
   * @returns {Array} Serialized job flows
   */
  static serializeArray(jobFlows, options = {}) {
    if (!jobFlows || !Array.isArray(jobFlows)) return [];
    return jobFlows.map((jf) => this.serializeOne(jf, options));
  }

  /**
   * Serialize for employee view (minimal, focused on progress)
   * @param {Object} jobFlow - AppointmentJobFlow instance
   * @returns {Object} Serialized for employee
   */
  static serializeForEmployee(jobFlow) {
    if (!jobFlow) return null;

    const data = jobFlow.dataValues || jobFlow;

    return {
      id: data.id,
      appointmentId: data.appointmentId,
      isMarketplaceFlow: data.usesPlatformFlow || data.photoRequirement === "platform_required",
      photoRequirement: data.photoRequirement,
      requiresPhotos: data.photoRequirement === "required" || data.photoRequirement === "platform_required",
      photosHidden: data.photoRequirement === "hidden",
      beforePhotoCount: data.beforePhotoCount,
      afterPhotoCount: data.afterPhotoCount,
      photosCompleted: data.photosCompleted,
      hasChecklist: data.checklistSnapshotData != null,
      checklistSnapshotData: data.checklistSnapshotData,
      checklistProgress: data.checklistProgress,
      checklistCompleted: data.checklistCompleted,
      completionPercentage: this.getCompletionPercentage(
        data.checklistSnapshotData,
        data.checklistProgress
      ),
      jobNotes: data.customFlow?.jobNotes || null,
      employeeNotes: data.employeeNotes,
      canComplete: this.validateCompletion(data).isValid,
      missingRequirements: this.validateCompletion(data).errors,
    };
  }

  /**
   * Serialize completion status
   * @param {Object} jobFlow - AppointmentJobFlow instance
   * @returns {Object} Completion status
   */
  static serializeCompletionStatus(jobFlow) {
    if (!jobFlow) return null;

    const data = jobFlow.dataValues || jobFlow;
    const validation = this.validateCompletion(data);

    return {
      id: data.id,
      appointmentId: data.appointmentId,
      isMarketplaceFlow: data.usesPlatformFlow || data.photoRequirement === "platform_required",
      photoRequirement: data.photoRequirement,
      beforePhotoCount: data.beforePhotoCount,
      afterPhotoCount: data.afterPhotoCount,
      photosCompleted: data.photosCompleted,
      hasChecklist: data.checklistSnapshotData != null,
      checklistCompleted: data.checklistCompleted,
      checklistCompletionPercentage: this.getCompletionPercentage(
        data.checklistSnapshotData,
        data.checklistProgress
      ),
      canComplete: validation.isValid,
      missingRequirements: validation.errors,
    };
  }

  /**
   * Serialize checklist progress summary
   * @param {Object} jobFlow - AppointmentJobFlow instance
   * @returns {Object} Progress summary
   */
  static serializeProgressSummary(jobFlow) {
    if (!jobFlow) return null;

    const data = jobFlow.dataValues || jobFlow;

    return {
      id: data.id,
      hasChecklist: data.checklistSnapshotData != null,
      checklistCompleted: data.checklistCompleted,
      itemCount: this.getItemCount(data.checklistSnapshotData),
      completedCount: this.getCompletedCount(data.checklistProgress),
      naCount: this.getNACount(data.checklistProgress),
      completionPercentage: this.getCompletionPercentage(
        data.checklistSnapshotData,
        data.checklistProgress
      ),
      beforePhotoCount: data.beforePhotoCount,
      afterPhotoCount: data.afterPhotoCount,
      photosCompleted: data.photosCompleted,
    };
  }

  /**
   * Serialize appointment (helper)
   * @param {Object} appointment - UserAppointments instance
   * @returns {Object} Serialized appointment
   */
  static serializeAppointment(appointment) {
    if (!appointment) return null;

    const data = appointment.dataValues || appointment;

    return {
      id: data.id,
      date: data.date,
      scheduledDate: data.scheduledDate,
      price: data.price,
      completed: data.completed,
    };
  }

  /**
   * Helper to get item count from snapshot data
   * @param {Object} snapshotData - The checklist snapshot data
   * @returns {number} Total item count
   */
  static getItemCount(snapshotData) {
    if (!snapshotData?.sections) return 0;
    return snapshotData.sections.reduce((count, section) => {
      return count + (section.items?.length || 0);
    }, 0);
  }

  /**
   * Helper to get completed count from progress
   * @param {Object} progress - The checklist progress
   * @returns {number} Completed item count
   */
  static getCompletedCount(progress) {
    if (!progress) return 0;
    let count = 0;
    for (const sectionId in progress) {
      count += progress[sectionId]?.completed?.length || 0;
    }
    return count;
  }

  /**
   * Helper to get N/A count from progress
   * @param {Object} progress - The checklist progress
   * @returns {number} N/A item count
   */
  static getNACount(progress) {
    if (!progress) return 0;
    let count = 0;
    for (const sectionId in progress) {
      count += progress[sectionId]?.na?.length || 0;
    }
    return count;
  }

  /**
   * Helper to get completion percentage
   * @param {Object} snapshotData - The checklist snapshot data
   * @param {Object} progress - The checklist progress
   * @returns {number} Completion percentage (0-100)
   */
  static getCompletionPercentage(snapshotData, progress) {
    const total = this.getItemCount(snapshotData);
    if (total === 0) return 100;
    const completed = this.getCompletedCount(progress);
    const na = this.getNACount(progress);
    return Math.round(((completed + na) / total) * 100);
  }

  /**
   * Helper to validate completion requirements
   * @param {Object} data - Job flow data
   * @returns {Object} { isValid: boolean, errors: string[] }
   */
  static validateCompletion(data) {
    const errors = [];

    // Check photos
    const requiresPhotos = data.photoRequirement === "required" ||
      data.photoRequirement === "platform_required";

    if (requiresPhotos) {
      if (data.beforePhotoCount === 0) {
        errors.push("Before photos are required");
      }
      if (data.afterPhotoCount === 0) {
        errors.push("After photos are required");
      }
    }

    // Check checklist
    const hasChecklist = data.checklistSnapshotData != null;
    if (hasChecklist && !data.checklistCompleted) {
      const percentage = this.getCompletionPercentage(
        data.checklistSnapshotData,
        data.checklistProgress
      );
      if (percentage < 100) {
        errors.push(`Checklist is ${percentage}% complete`);
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }
}

module.exports = AppointmentJobFlowSerializer;
