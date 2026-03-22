/**
 * IT Time Entry Model
 * For tracking time spent on IT disputes
 */
module.exports = (sequelize, DataTypes) => {
  const ITTimeEntry = sequelize.define("ITTimeEntry", {
    id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      autoIncrement: true,
      primaryKey: true,
    },
    disputeId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: "ITDisputes", key: "id" },
      onUpdate: "CASCADE",
      onDelete: "CASCADE",
    },
    staffId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: "Users", key: "id" },
      onUpdate: "CASCADE",
      onDelete: "CASCADE",
    },
    // Time tracking
    startedAt: {
      type: DataTypes.DATE,
      allowNull: false,
    },
    endedAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    durationMinutes: {
      type: DataTypes.INTEGER,
      allowNull: true,
      comment: "Calculated duration in minutes",
    },
    // Activity type
    activityType: {
      type: DataTypes.ENUM(
        "investigation",
        "communication",
        "resolution",
        "documentation",
        "escalation",
        "other"
      ),
      allowNull: false,
      defaultValue: "investigation",
    },
    // Notes
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    // For manual time entry
    isManual: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
  });

  ITTimeEntry.associate = (models) => {
    ITTimeEntry.belongsTo(models.ITDispute, {
      foreignKey: "disputeId",
      as: "dispute",
    });
    ITTimeEntry.belongsTo(models.User, {
      foreignKey: "staffId",
      as: "staff",
    });
  };

  // Calculate duration before save
  ITTimeEntry.beforeSave((entry) => {
    if (entry.startedAt && entry.endedAt) {
      const start = new Date(entry.startedAt);
      const end = new Date(entry.endedAt);
      entry.durationMinutes = Math.round((end - start) / (1000 * 60));
    }
  });

  return ITTimeEntry;
};
