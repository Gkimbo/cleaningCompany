module.exports = (sequelize, DataTypes) => {
  const AppointmentJobFlow = sequelize.define("AppointmentJobFlow", {
    id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      autoIncrement: true,
      primaryKey: true,
    },
    appointmentId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      unique: true,
    },
    customJobFlowId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      comment: "NULL for marketplace jobs using platform flow",
    },
    usesPlatformFlow: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      comment: "True for marketplace jobs with mandatory requirements",
    },
    checklistSnapshotData: {
      type: DataTypes.JSONB,
      allowNull: true,
      comment: "Frozen copy of checklist at assignment time",
    },
    checklistProgress: {
      type: DataTypes.JSONB,
      allowNull: true,
      comment: "Tracks section/item completion state",
    },
    checklistCompleted: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    photoRequirement: {
      type: DataTypes.STRING(20),
      allowNull: false,
      defaultValue: "optional",
      comment: "required, optional, hidden, platform_required",
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
    photosCompleted: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    employeeNotes: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: "Notes added by the employee during the job",
    },
  });

  // Instance methods
  AppointmentJobFlow.prototype.isMarketplaceFlow = function () {
    return this.usesPlatformFlow || this.photoRequirement === "platform_required";
  };

  AppointmentJobFlow.prototype.requiresPhotos = function () {
    return this.photoRequirement === "required" || this.photoRequirement === "platform_required";
  };

  AppointmentJobFlow.prototype.photosHidden = function () {
    return this.photoRequirement === "hidden";
  };

  AppointmentJobFlow.prototype.hasChecklist = function () {
    return this.checklistSnapshotData !== null;
  };

  AppointmentJobFlow.prototype.getSections = function () {
    return this.checklistSnapshotData?.sections || [];
  };

  AppointmentJobFlow.prototype.getItemCount = function () {
    if (!this.checklistSnapshotData?.sections) return 0;
    return this.checklistSnapshotData.sections.reduce((count, section) => {
      return count + (section.items?.length || 0);
    }, 0);
  };

  AppointmentJobFlow.prototype.getCompletedItemCount = function () {
    if (!this.checklistProgress) return 0;
    let completed = 0;
    for (const sectionId in this.checklistProgress) {
      completed += this.checklistProgress[sectionId]?.completed?.length || 0;
    }
    return completed;
  };

  AppointmentJobFlow.prototype.getChecklistCompletionPercentage = function () {
    const total = this.getItemCount();
    if (total === 0) return 100;
    return Math.round((this.getCompletedItemCount() / total) * 100);
  };

  AppointmentJobFlow.prototype.validateCompletion = function () {
    const errors = [];

    // Check photos
    if (this.requiresPhotos()) {
      if (this.beforePhotoCount === 0) {
        errors.push("Before photos are required");
      }
      if (this.afterPhotoCount === 0) {
        errors.push("After photos are required");
      }
    }

    // Check checklist
    if (this.hasChecklist() && !this.checklistCompleted) {
      const percentage = this.getChecklistCompletionPercentage();
      if (percentage < 100) {
        errors.push(`Checklist is ${percentage}% complete`);
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  };

  AppointmentJobFlow.associate = (models) => {
    AppointmentJobFlow.belongsTo(models.UserAppointments, {
      foreignKey: "appointmentId",
      as: "appointment",
    });

    AppointmentJobFlow.belongsTo(models.CustomJobFlow, {
      foreignKey: "customJobFlowId",
      as: "customFlow",
    });

    AppointmentJobFlow.hasMany(models.EmployeeJobAssignment, {
      foreignKey: "appointmentJobFlowId",
      as: "employeeAssignments",
    });
  };

  return AppointmentJobFlow;
};
