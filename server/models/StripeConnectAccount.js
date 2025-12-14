module.exports = (sequelize, DataTypes) => {
  const StripeConnectAccount = sequelize.define("StripeConnectAccount", {
    id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      autoIncrement: true,
      primaryKey: true,
    },
    userId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    stripeAccountId: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
    },
    accountStatus: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: "pending",
      // pending, onboarding, active, restricted, disabled
    },
    payoutsEnabled: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    chargesEnabled: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    detailsSubmitted: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    onboardingComplete: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
  });

  StripeConnectAccount.associate = (models) => {
    StripeConnectAccount.belongsTo(models.User, {
      foreignKey: "userId",
      as: "user",
    });
  };

  return StripeConnectAccount;
};
