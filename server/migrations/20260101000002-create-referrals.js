"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("Referrals", {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER,
      },

      // === Relationship ===
      referrerId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: "Users",
          key: "id",
        },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      },
      referredId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: "Users",
          key: "id",
        },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      },
      referralCode: {
        type: Sequelize.STRING,
        allowNull: false,
      },

      // === Program type ===
      programType: {
        type: Sequelize.ENUM(
          "client_to_client",
          "client_to_cleaner",
          "cleaner_to_cleaner",
          "cleaner_to_client"
        ),
        allowNull: false,
      },

      // === Status tracking ===
      status: {
        type: Sequelize.ENUM(
          "pending",      // referred user signed up, waiting for qualifying cleanings
          "qualified",    // required cleanings completed, ready for reward
          "rewarded",     // reward has been applied
          "expired",      // referral expired
          "cancelled"     // manually cancelled by owner
        ),
        allowNull: false,
        defaultValue: "pending",
      },

      // === Progress tracking ===
      cleaningsRequired: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 1,
      },
      cleaningsCompleted: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },

      // === Reward details (snapshot from config at time of referral) ===
      referrerRewardAmount: {
        type: Sequelize.INTEGER, // cents
        allowNull: false,
        defaultValue: 0,
      },
      referredRewardAmount: {
        type: Sequelize.INTEGER, // cents
        allowNull: true,
        defaultValue: 0,
      },
      referrerRewardType: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      referredRewardType: {
        type: Sequelize.STRING,
        allowNull: true,
      },

      // === Reward application tracking ===
      referrerRewardApplied: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      referrerRewardAppliedAt: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      referrerRewardAppointmentId: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          model: "UserAppointments",
          key: "id",
        },
        onUpdate: "CASCADE",
        onDelete: "SET NULL",
      },
      referredRewardApplied: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      referredRewardAppliedAt: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      referredRewardAppointmentId: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          model: "UserAppointments",
          key: "id",
        },
        onUpdate: "CASCADE",
        onDelete: "SET NULL",
      },

      // === Timestamps ===
      qualifiedAt: {
        type: Sequelize.DATE,
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

    // Indexes for common queries
    await queryInterface.addIndex("Referrals", ["referrerId"], {
      name: "referrals_referrer_idx",
    });
    await queryInterface.addIndex("Referrals", ["referredId"], {
      name: "referrals_referred_idx",
    });
    await queryInterface.addIndex("Referrals", ["referralCode"], {
      name: "referrals_code_idx",
    });
    await queryInterface.addIndex("Referrals", ["status"], {
      name: "referrals_status_idx",
    });
    await queryInterface.addIndex("Referrals", ["programType", "status"], {
      name: "referrals_program_status_idx",
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable("Referrals");
  },
};
