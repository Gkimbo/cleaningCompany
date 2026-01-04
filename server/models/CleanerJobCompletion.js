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

  return CleanerJobCompletion;
};
