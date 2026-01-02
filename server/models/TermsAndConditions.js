module.exports = (sequelize, DataTypes) => {
  const TermsAndConditions = sequelize.define("TermsAndConditions", {
    type: {
      type: DataTypes.ENUM("homeowner", "cleaner", "privacy_policy"),
      allowNull: false,
    },
    version: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    title: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    content: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    contentType: {
      type: DataTypes.ENUM("text", "pdf"),
      allowNull: false,
      defaultValue: "text",
    },
    pdfFileName: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    pdfFilePath: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    pdfFileSize: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    effectiveDate: {
      type: DataTypes.DATEONLY,
      allowNull: false,
    },
    createdBy: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
  });

  TermsAndConditions.associate = (models) => {
    TermsAndConditions.belongsTo(models.User, {
      foreignKey: "createdBy",
      as: "creator",
    });

    TermsAndConditions.hasMany(models.UserTermsAcceptance, {
      foreignKey: "termsId",
      as: "acceptances",
    });
  };

  return TermsAndConditions;
};
