/**
 * CleanerJobCompletion Model
 *
 * Tracks individual cleaner's completion status for multi-cleaner jobs.
 * One record per cleaner per appointment.
 */
module.exports = (sequelize, DataTypes) => {
  const CleanerJobCompletion = sequelize.define("CleanerJobCompletion", {
    id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      autoIncrement: true,
      primaryKey: true,
    },
    appointmentId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    cleanerId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    multiCleanerJobId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    checklistProgress: {
      type: DataTypes.JSONB,
      allowNull: true,
      defaultValue: {},
    },
    photosSubmitted: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    beforePhotoCount: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    afterPhotoCount: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    completedAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    payoutId: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    actualMinutesWorked: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    status: {
      type: DataTypes.ENUM(
        "assigned",
        "started",
        "completed",
        "dropped_out",
        "no_show"
      ),
      allowNull: false,
      defaultValue: "assigned",
    },
    // 2-Step Completion Confirmation fields (per-cleaner)
    completionStatus: {
      type: DataTypes.ENUM("in_progress", "submitted", "approved", "auto_approved"),
      allowNull: false,
      defaultValue: "in_progress",
      comment: "Per-cleaner 2-step completion status",
    },
    completionSubmittedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: "When this cleaner submitted their completion",
    },
    completionNotes: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: "Optional notes from this cleaner",
    },
    completionApprovedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: "When this cleaner's completion was approved",
    },
    completionApprovedBy: {
      type: DataTypes.INTEGER,
      allowNull: true,
      comment: "User ID who approved this cleaner, null if auto-approved",
    },
    autoApprovalExpiresAt: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: "When auto-approval will trigger for this cleaner",
    },
    homeownerFeedbackRequired: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      comment: "True if homeowner raised concerns about this cleaner's work",
    },
    // Auto-complete tracking fields (per-cleaner for multi-cleaner jobs)
    autoCompleteAt: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: "When auto-complete triggers for this cleaner",
    },
    autoCompleteRemindersSent: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      comment: "Number of auto-complete reminders sent to this cleaner",
    },
    lastReminderSentAt: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: "When the last reminder was sent to this cleaner",
    },
    autoCompletedBySystem: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      comment: "True if this cleaner's job was auto-completed",
    },
    jobStartedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: "When this cleaner uploaded their first before photo",
    },
  });

  CleanerJobCompletion.associate = (models) => {
    CleanerJobCompletion.belongsTo(models.UserAppointments, {
      foreignKey: "appointmentId",
      as: "appointment",
    });

    CleanerJobCompletion.belongsTo(models.User, {
      foreignKey: "cleanerId",
      as: "cleaner",
    });

    CleanerJobCompletion.belongsTo(models.MultiCleanerJob, {
      foreignKey: "multiCleanerJobId",
      as: "multiCleanerJob",
    });

    CleanerJobCompletion.belongsTo(models.Payout, {
      foreignKey: "payoutId",
      as: "payout",
    });
  };

  /**
   * Calculate completion percentage based on checklist progress
   */
  CleanerJobCompletion.prototype.getCompletionPercentage = function () {
    if (!this.checklistProgress) return 0;

    let totalItems = 0;
    let completedItems = 0;

    for (const section of Object.values(this.checklistProgress)) {
      if (section.total) totalItems += section.total.length;
      if (section.completed) completedItems += section.completed.length;
    }

    if (totalItems === 0) return 0;
    return Math.round((completedItems / totalItems) * 100);
  };

  /**
   * Mark as started
   */
  CleanerJobCompletion.prototype.markStarted = async function () {
    this.status = "started";
    await this.save();
    return this;
  };

  /**
   * Mark as completed
   */
  CleanerJobCompletion.prototype.markCompleted = async function () {
    this.status = "completed";
    this.completedAt = new Date();
    await this.save();
    return this;
  };

  /**
   * Mark as dropped out
   */
  CleanerJobCompletion.prototype.markDroppedOut = async function () {
    this.status = "dropped_out";
    await this.save();
    return this;
  };

  /**
   * Mark as no-show
   */
  CleanerJobCompletion.prototype.markNoShow = async function () {
    this.status = "no_show";
    await this.save();
    return this;
  };

  /**
   * Check if cleaner is still active (not dropped out or no-show)
   */
  CleanerJobCompletion.prototype.isActive = function () {
    return !["dropped_out", "no_show"].includes(this.status);
  };

  // =========================================================================
  // 2-Step Completion Confirmation Helper Methods
  // =========================================================================

  /**
   * Check if this cleaner's completion is awaiting homeowner approval
   */
  CleanerJobCompletion.prototype.isAwaitingApproval = function () {
    return this.completionStatus === "submitted";
  };

  /**
   * Check if auto-approval window has expired for this cleaner
   */
  CleanerJobCompletion.prototype.isAutoApprovalExpired = function () {
    return (
      this.completionStatus === "submitted" &&
      this.autoApprovalExpiresAt &&
      new Date() > new Date(this.autoApprovalExpiresAt)
    );
  };

  /**
   * Check if this cleaner's completion can be approved by homeowner
   */
  CleanerJobCompletion.prototype.canBeApproved = function () {
    return this.completionStatus === "submitted";
  };

  /**
   * Check if this cleaner's completion has been approved (manually or auto)
   */
  CleanerJobCompletion.prototype.isCompletionApproved = function () {
    return (
      this.completionStatus === "approved" ||
      this.completionStatus === "auto_approved"
    );
  };

  /**
   * Get time remaining until auto-approval (in seconds)
   */
  CleanerJobCompletion.prototype.getTimeUntilAutoApproval = function () {
    if (!this.autoApprovalExpiresAt || this.completionStatus !== "submitted") {
      return null;
    }
    const remaining = new Date(this.autoApprovalExpiresAt).getTime() - Date.now();
    return Math.max(0, Math.floor(remaining / 1000));
  };

  return CleanerJobCompletion;
};
