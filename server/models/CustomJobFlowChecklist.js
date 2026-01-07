module.exports = (sequelize, DataTypes) => {
  const CustomJobFlowChecklist = sequelize.define("CustomJobFlowChecklist", {
    id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      autoIncrement: true,
      primaryKey: true,
    },
    customJobFlowId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    forkedFromPlatformVersion: {
      type: DataTypes.INTEGER,
      allowNull: true,
      comment: "ChecklistVersion.version if forked from platform, NULL if created from scratch",
    },
    snapshotData: {
      type: DataTypes.JSONB,
      allowNull: true,
      comment: "Full checklist structure with sections, items, and per-item notes",
    },
  });

  // Instance methods
  CustomJobFlowChecklist.prototype.isForkedFromPlatform = function () {
    return this.forkedFromPlatformVersion !== null;
  };

  CustomJobFlowChecklist.prototype.getSections = function () {
    return this.snapshotData?.sections || [];
  };

  CustomJobFlowChecklist.prototype.getItemCount = function () {
    if (!this.snapshotData?.sections) return 0;
    return this.snapshotData.sections.reduce((count, section) => {
      return count + (section.items?.length || 0);
    }, 0);
  };

  CustomJobFlowChecklist.prototype.initializeProgress = function () {
    if (!this.snapshotData?.sections) return {};

    const progress = {};
    for (const section of this.snapshotData.sections) {
      const itemIds = section.items ? section.items.map((item) => item.id) : [];
      progress[section.id] = {
        total: itemIds,
        completed: [],
      };
    }
    return progress;
  };

  CustomJobFlowChecklist.associate = (models) => {
    CustomJobFlowChecklist.belongsTo(models.CustomJobFlow, {
      foreignKey: "customJobFlowId",
      as: "flow",
    });
  };

  return CustomJobFlowChecklist;
};
