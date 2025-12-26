module.exports = (sequelize, DataTypes) => {
  const ChecklistSection = sequelize.define("ChecklistSection", {
    title: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    icon: {
      type: DataTypes.STRING(10),
      allowNull: true,
    },
    displayOrder: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
  });

  ChecklistSection.associate = (models) => {
    ChecklistSection.hasMany(models.ChecklistItem, {
      foreignKey: "sectionId",
      as: "items",
    });
  };

  return ChecklistSection;
};
