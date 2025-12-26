module.exports = (sequelize, DataTypes) => {
  const ChecklistItem = sequelize.define("ChecklistItem", {
    sectionId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    parentId: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    content: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    displayOrder: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    indentLevel: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    formatting: {
      type: DataTypes.JSON,
      allowNull: true,
      defaultValue: {
        bold: false,
        italic: false,
        bulletStyle: "disc",
      },
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },
  });

  ChecklistItem.associate = (models) => {
    ChecklistItem.belongsTo(models.ChecklistSection, {
      foreignKey: "sectionId",
      as: "section",
    });

    ChecklistItem.belongsTo(models.ChecklistItem, {
      foreignKey: "parentId",
      as: "parent",
    });

    ChecklistItem.hasMany(models.ChecklistItem, {
      foreignKey: "parentId",
      as: "children",
    });
  };

  return ChecklistItem;
};
