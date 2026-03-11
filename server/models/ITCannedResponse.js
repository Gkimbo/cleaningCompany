module.exports = (sequelize, DataTypes) => {
  const ITCannedResponse = sequelize.define("ITCannedResponse", {
    id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      autoIncrement: true,
      primaryKey: true,
    },
    title: {
      type: DataTypes.STRING(100),
      allowNull: false,
    },
    category: {
      type: DataTypes.STRING(50),
      allowNull: true,
      comment: "IT dispute category this response is for (optional)",
    },
    template: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    shortcut: {
      type: DataTypes.STRING(20),
      allowNull: true,
      unique: true,
      comment: "Quick shortcut code like #locked, #reset",
    },
    isGlobal: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
      comment: "If true, visible to all IT staff. If false, only visible to creator.",
    },
    createdBy: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: "Users", key: "id" },
      onUpdate: "CASCADE",
      onDelete: "CASCADE",
    },
    updatedBy: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: { model: "Users", key: "id" },
      onUpdate: "CASCADE",
      onDelete: "SET NULL",
    },
    usageCount: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      comment: "How many times this response has been used",
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },
    tags: {
      type: DataTypes.JSONB,
      allowNull: true,
      defaultValue: [],
      comment: "Tags for organizing responses",
    },
  });

  ITCannedResponse.associate = (models) => {
    ITCannedResponse.belongsTo(models.User, {
      foreignKey: "createdBy",
      as: "creator",
    });
    ITCannedResponse.belongsTo(models.User, {
      foreignKey: "updatedBy",
      as: "updater",
    });
  };

  return ITCannedResponse;
};
