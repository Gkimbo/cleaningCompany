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

  // Defensive toJSON method to exclude sensitive Stripe IDs
  // This is a safety net - always use StripeConnectAccountSerializer for API responses
  if (StripeConnectAccount.prototype) {
    StripeConnectAccount.prototype.toJSON = function () {
      const values = { ...this.get() };

      // Exclude the actual Stripe account ID - only expose status flags
      delete values.stripeAccountId;

      return values;
    };
  }

  return StripeConnectAccount;
};
