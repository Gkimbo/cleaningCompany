module.exports = (sequelize, DataTypes) => {
  const ChecklistDraft = sequelize.define("ChecklistDraft", {
    draftData: {
      type: DataTypes.JSON,
      allowNull: false,
    },
    createdBy: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
  });

  ChecklistDraft.associate = (models) => {
    ChecklistDraft.belongsTo(models.User, {
      foreignKey: "createdBy",
      as: "creator",
    });
  };

  return ChecklistDraft;
};
