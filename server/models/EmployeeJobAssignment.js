module.exports = (sequelize, DataTypes) => {
  const EmployeeJobAssignment = sequelize.define("EmployeeJobAssignment", {
    id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      autoIncrement: true,
      primaryKey: true,
    },
    businessEmployeeId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      comment: "Null for self-assignments by business owner",
    },
    appointmentId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    businessOwnerId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },

    // Assignment Details
    assignedAt: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
    assignedBy: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    status: {
      type: DataTypes.STRING(20),
      allowNull: false,
      defaultValue: "assigned",
      comment: "assigned, started, completed, cancelled, no_show",
    },

    // Pay for this specific job
    payAmount: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      comment: "Amount to pay employee in cents",
    },
    payType: {
      type: DataTypes.STRING(20),
      allowNull: false,
      defaultValue: "flat_rate",
      comment: "flat_rate or hourly",
    },
    hoursWorked: {
      type: DataTypes.DECIMAL(5, 2),
      allowNull: true,
      comment: "Hours worked (for hourly pay type)",
    },
    payAdjustmentReason: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: "Reason for any pay adjustment",
    },

    // Self-assignment tracking
    isSelfAssignment: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      comment: "True if business owner assigned themselves",
    },

    // Marketplace job tracking
    isMarketplacePickup: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      comment: "True if this job was picked up from marketplace (not business owner's own client)",
    },

    // Checklist and photo completion tracking (required for marketplace jobs)
    checklistProgress: {
      type: DataTypes.JSONB,
      allowNull: true,
      comment: "Tracks checklist completion progress for this assignment",
    },
    checklistCompleted: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      comment: "True when checklist is fully completed",
    },
    beforePhotoCount: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      comment: "Number of before photos uploaded",
    },
    afterPhotoCount: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      comment: "Number of after photos uploaded",
    },
    photosCompleted: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      comment: "True when both before and after photos have been uploaded",
    },

    // Completion
    startedAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    completedAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },

    // Payout tracking
    payoutId: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    payoutStatus: {
      type: DataTypes.STRING(30),
      allowNull: false,
      defaultValue: "pending",
      comment: "pending, processing, paid, paid_outside_platform",
    },
    paidOutsidePlatformAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    paidOutsidePlatformNote: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
  });

  // Instance methods
  EmployeeJobAssignment.prototype.isPaid = function () {
    return (
      this.payoutStatus === "paid" ||
      this.payoutStatus === "paid_outside_platform"
    );
  };

  EmployeeJobAssignment.prototype.isCompleted = function () {
    return this.status === "completed";
  };

  EmployeeJobAssignment.prototype.canStart = function () {
    return this.status === "assigned";
  };

  EmployeeJobAssignment.prototype.canComplete = function () {
    if (this.status !== "started") {
      return false;
    }
    // For marketplace jobs, require checklist and photos
    if (this.isMarketplacePickup) {
      return this.checklistCompleted && this.photosCompleted;
    }
    return true;
  };

  // Check what's missing for completion (for marketplace jobs)
  EmployeeJobAssignment.prototype.getCompletionRequirements = function () {
    if (!this.isMarketplacePickup) {
      return { required: false, missing: [] };
    }

    const missing = [];
    if (!this.checklistCompleted) {
      missing.push("checklist");
    }
    if (this.beforePhotoCount === 0) {
      missing.push("before_photos");
    }
    if (this.afterPhotoCount === 0) {
      missing.push("after_photos");
    }
    if (!this.photosCompleted) {
      missing.push("photos");
    }

    return {
      required: true,
      missing,
      checklistCompleted: this.checklistCompleted,
      beforePhotoCount: this.beforePhotoCount,
      afterPhotoCount: this.afterPhotoCount,
      photosCompleted: this.photosCompleted,
    };
  };

  EmployeeJobAssignment.prototype.getPayDisplayAmount = function () {
    // Return formatted pay amount (e.g., "$50.00")
    return `$${(this.payAmount / 100).toFixed(2)}`;
  };

  EmployeeJobAssignment.associate = (models) => {
    EmployeeJobAssignment.belongsTo(models.BusinessEmployee, {
      foreignKey: "businessEmployeeId",
      as: "employee",
    });
    EmployeeJobAssignment.belongsTo(models.UserAppointments, {
      foreignKey: "appointmentId",
      as: "appointment",
    });
    EmployeeJobAssignment.belongsTo(models.User, {
      foreignKey: "businessOwnerId",
      as: "businessOwner",
    });
    EmployeeJobAssignment.belongsTo(models.User, {
      foreignKey: "assignedBy",
      as: "assignedByUser",
    });
    EmployeeJobAssignment.belongsTo(models.Payout, {
      foreignKey: "payoutId",
      as: "payout",
    });
    EmployeeJobAssignment.hasMany(models.EmployeePayChangeLog, {
      foreignKey: "employeeJobAssignmentId",
      as: "payChanges",
    });
  };

  return EmployeeJobAssignment;
};
