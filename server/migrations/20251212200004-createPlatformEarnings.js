"use strict";

/**
 * Migration: Create PlatformEarnings Table
 *
 * Tracks the company's 10% platform fee from each cleaning for tax purposes.
 * Used for quarterly estimated taxes and annual tax form generation.
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("PlatformEarnings", {
      id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
      },
      transactionId: {
        type: Sequelize.STRING,
        allowNull: false,
        unique: true,
      },

      // Related records
      appointmentId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: "UserAppointments",
          key: "id",
        },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      },
      paymentId: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          model: "Payments",
          key: "id",
        },
        onUpdate: "CASCADE",
        onDelete: "SET NULL",
      },
      payoutId: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          model: "Payouts",
          key: "id",
        },
        onUpdate: "CASCADE",
        onDelete: "SET NULL",
      },

      // Customer and cleaner
      customerId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: "Users",
          key: "id",
        },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      },
      cleanerId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: "Users",
          key: "id",
        },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      },

      // Financial amounts (in cents)
      grossServiceAmount: {
        type: Sequelize.INTEGER,
        allowNull: false,
      },
      platformFeeAmount: {
        type: Sequelize.INTEGER,
        allowNull: false,
      },
      platformFeePercentage: {
        type: Sequelize.DECIMAL(5, 4),
        allowNull: false,
        defaultValue: 0.10,
      },
      stripeFeeAmount: {
        type: Sequelize.INTEGER,
        allowNull: true,
        defaultValue: 0,
      },
      netPlatformEarnings: {
        type: Sequelize.INTEGER,
        allowNull: false,
      },

      // Tax categorization
      taxYear: {
        type: Sequelize.INTEGER,
        allowNull: false,
      },
      taxQuarter: {
        type: Sequelize.INTEGER,
        allowNull: false,
      },
      taxMonth: {
        type: Sequelize.INTEGER,
        allowNull: false,
      },

      // Status
      status: {
        type: Sequelize.ENUM("pending", "collected", "refunded"),
        allowNull: false,
        defaultValue: "pending",
      },

      // Income categorization
      incomeCategory: {
        type: Sequelize.ENUM("service_fee", "platform_commission", "other"),
        allowNull: false,
        defaultValue: "platform_commission",
      },

      // Timestamps
      earnedAt: {
        type: Sequelize.DATE,
        allowNull: false,
      },
      collectedAt: {
        type: Sequelize.DATE,
        allowNull: true,
      },

      // Metadata
      description: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      metadata: {
        type: Sequelize.JSON,
        allowNull: true,
      },

      // Standard timestamps
      createdAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal("CURRENT_TIMESTAMP"),
      },
      updatedAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal("CURRENT_TIMESTAMP"),
      },
    });

    // Add indexes
    await queryInterface.addIndex("PlatformEarnings", ["transactionId"], {
      unique: true,
      name: "platform_earnings_transaction_id_unique",
    });
    await queryInterface.addIndex("PlatformEarnings", ["appointmentId"], {
      name: "platform_earnings_appointment_id",
    });
    await queryInterface.addIndex("PlatformEarnings", ["taxYear"], {
      name: "platform_earnings_tax_year",
    });
    await queryInterface.addIndex("PlatformEarnings", ["taxYear", "taxQuarter"], {
      name: "platform_earnings_year_quarter",
    });
    await queryInterface.addIndex("PlatformEarnings", ["taxYear", "taxMonth"], {
      name: "platform_earnings_year_month",
    });
    await queryInterface.addIndex("PlatformEarnings", ["status"], {
      name: "platform_earnings_status",
    });
    await queryInterface.addIndex("PlatformEarnings", ["earnedAt"], {
      name: "platform_earnings_earned_at",
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable("PlatformEarnings");
  },
};
