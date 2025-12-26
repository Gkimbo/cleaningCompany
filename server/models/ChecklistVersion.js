module.exports = (sequelize, DataTypes) => {
  const ChecklistVersion = sequelize.define("ChecklistVersion", {
    version: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    snapshotData: {
      type: DataTypes.JSON,
      allowNull: false,
    },
    publishedBy: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    publishedAt: {
      type: DataTypes.DATE,
      allowNull: false,
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
  });

  ChecklistVersion.associate = (models) => {
    ChecklistVersion.belongsTo(models.User, {
      foreignKey: "publishedBy",
      as: "publisher",
    });
  };

  return ChecklistVersion;
};
