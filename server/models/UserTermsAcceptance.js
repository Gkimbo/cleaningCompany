module.exports = (sequelize, DataTypes) => {
  const UserTermsAcceptance = sequelize.define("UserTermsAcceptance", {
    userId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    termsId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    acceptedAt: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
    ipAddress: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    termsContentSnapshot: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    pdfSnapshotPath: {
      type: DataTypes.STRING,
      allowNull: true,
    },
  });

  UserTermsAcceptance.associate = (models) => {
    UserTermsAcceptance.belongsTo(models.User, {
      foreignKey: "userId",
      as: "user",
    });

    UserTermsAcceptance.belongsTo(models.TermsAndConditions, {
      foreignKey: "termsId",
      as: "terms",
    });
  };

  return UserTermsAcceptance;
};
