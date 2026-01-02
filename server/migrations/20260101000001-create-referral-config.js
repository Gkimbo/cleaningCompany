"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("ReferralConfigs", {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER,
      },

      // === Client -> Client Program ("Give $25, Get $25") ===
      clientToClientEnabled: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      clientToClientReferrerReward: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 2500, // cents ($25)
      },
      clientToClientReferredReward: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 2500, // cents ($25)
      },
      clientToClientCleaningsRequired: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 1,
      },
      clientToClientRewardType: {
        type: Sequelize.ENUM("credit", "discount_percent", "flat_discount"),
        allowNull: false,
        defaultValue: "credit",
      },
      clientToClientMaxPerMonth: {
        type: Sequelize.INTEGER,
        allowNull: true, // null = unlimited
        defaultValue: null,
      },

      // === Client -> Cleaner Program ===
      clientToCleanerEnabled: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      clientToCleanerReferrerReward: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 5000, // cents ($50)
      },
      clientToCleanerCleaningsRequired: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 3,
      },
      clientToCleanerRewardType: {
        type: Sequelize.ENUM("credit", "discount_percent", "flat_discount"),
        allowNull: false,
        defaultValue: "credit",
      },
      clientToCleanerMaxPerMonth: {
        type: Sequelize.INTEGER,
        allowNull: true,
        defaultValue: null,
      },

      // === Cleaner -> Cleaner Program ===
      cleanerToCleanerEnabled: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      cleanerToCleanerReferrerReward: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 5000, // cents ($50)
      },
      cleanerToCleanerCleaningsRequired: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 1,
      },
      cleanerToCleanerRewardType: {
        type: Sequelize.ENUM("bonus", "fee_reduction"),
        allowNull: false,
        defaultValue: "bonus",
      },
      cleanerToCleanerMaxPerMonth: {
        type: Sequelize.INTEGER,
        allowNull: true,
        defaultValue: null,
      },

      // === Cleaner -> Client Program (bulk discount) ===
      cleanerToClientEnabled: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      cleanerToClientDiscountPercent: {
        type: Sequelize.DECIMAL(5, 2),
        allowNull: false,
        defaultValue: 10.00, // 10%
      },
      cleanerToClientMinReferrals: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 3, // bulk threshold
      },
      cleanerToClientRewardType: {
        type: Sequelize.ENUM("discount_percent", "flat_discount", "bonus"),
        allowNull: false,
        defaultValue: "discount_percent",
      },
      cleanerToClientMaxPerMonth: {
        type: Sequelize.INTEGER,
        allowNull: true,
        defaultValue: null,
      },

      // === Audit fields ===
      isActive: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: true,
      },
      updatedBy: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          model: "Users",
          key: "id",
        },
        onUpdate: "CASCADE",
        onDelete: "SET NULL",
      },
      changeNote: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      createdAt: {
        allowNull: false,
        type: Sequelize.DATE,
      },
      updatedAt: {
        allowNull: false,
        type: Sequelize.DATE,
      },
    });

    // Add index for quick lookup of active config
    await queryInterface.addIndex("ReferralConfigs", ["isActive"], {
      name: "referral_config_active_idx",
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable("ReferralConfigs");
  },
};
