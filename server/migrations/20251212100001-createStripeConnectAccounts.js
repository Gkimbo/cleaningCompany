"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("StripeConnectAccounts", {
      id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
      },
      userId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: "Users",
          key: "id",
        },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      },
      stripeAccountId: {
        type: Sequelize.STRING,
        allowNull: false,
        unique: true,
      },
      accountStatus: {
        type: Sequelize.STRING,
        allowNull: false,
        defaultValue: "pending",
        // pending, onboarding, active, restricted, disabled
      },
      payoutsEnabled: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      chargesEnabled: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      detailsSubmitted: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      onboardingComplete: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      createdAt: {
        type: Sequelize.DATE,
        allowNull: false,
      },
      updatedAt: {
        type: Sequelize.DATE,
        allowNull: false,
      },
    });

    // Add index for faster lookups
    await queryInterface.addIndex("StripeConnectAccounts", ["userId"]);
    await queryInterface.addIndex("StripeConnectAccounts", ["stripeAccountId"]);
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable("StripeConnectAccounts");
  },
};
