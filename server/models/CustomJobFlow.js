module.exports = (sequelize, DataTypes) => {
  const CustomJobFlow = sequelize.define("CustomJobFlow", {
    id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      autoIncrement: true,
      primaryKey: true,
    },
    businessOwnerId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    name: {
      type: DataTypes.STRING(100),
      allowNull: false,
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    isDefault: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      comment: "If true, auto-assigned to new own-client jobs",
    },
    status: {
      type: DataTypes.STRING(20),
      allowNull: false,
      defaultValue: "active",
      comment: "active, archived",
    },
    photoRequirement: {
      type: DataTypes.STRING(20),
      allowNull: false,
      defaultValue: "optional",
      comment: "required, optional, hidden",
    },
    jobNotes: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: "Job-level notes/instructions for employees",
    },
  });

  // Instance methods
  CustomJobFlow.prototype.isActive = function () {
    return this.status === "active";
  };

  CustomJobFlow.prototype.requiresPhotos = function () {
    return this.photoRequirement === "required";
  };

  CustomJobFlow.prototype.photosHidden = function () {
    return this.photoRequirement === "hidden";
  };

  CustomJobFlow.associate = (models) => {
    CustomJobFlow.belongsTo(models.User, {
      foreignKey: "businessOwnerId",
      as: "businessOwner",
    });

    CustomJobFlow.hasOne(models.CustomJobFlowChecklist, {
      foreignKey: "customJobFlowId",
      as: "checklist",
    });

    CustomJobFlow.hasMany(models.ClientJobFlowAssignment, {
      foreignKey: "customJobFlowId",
      as: "clientAssignments",
    });

    CustomJobFlow.hasMany(models.AppointmentJobFlow, {
      foreignKey: "customJobFlowId",
      as: "appointmentFlows",
    });
  };

  return CustomJobFlow;
};
