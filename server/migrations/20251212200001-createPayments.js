"use strict";

/**
 * Migration: Create Payments Table
 *
 * Comprehensive payment transaction tracking table.
 * Stores all money movement in the platform for auditing and tax purposes.
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("Payments", {
      id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
      },

      // Transaction identification
      transactionId: {
        type: Sequelize.STRING,
        allowNull: false,
        unique: true,
      },
      stripePaymentIntentId: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      stripeTransferId: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      stripeRefundId: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      stripeChargeId: {
        type: Sequelize.STRING,
        allowNull: true,
      },

      // Transaction type and status
      type: {
        type: Sequelize.ENUM(
          "authorization",
          "capture",
          "refund",
          "payout",
          "platform_fee"
        ),
        allowNull: false,
      },
      status: {
        type: Sequelize.ENUM(
          "pending",
          "processing",
          "succeeded",
          "failed",
          "canceled",
          "refunded"
        ),
        allowNull: false,
        defaultValue: "pending",
      },

      // Relationships
      userId: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          model: "Users",
          key: "id",
        },
        onUpdate: "CASCADE",
        onDelete: "SET NULL",
      },
      cleanerId: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          model: "Users",
          key: "id",
        },
        onUpdate: "CASCADE",
        onDelete: "SET NULL",
      },
      appointmentId: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          model: "UserAppointments",
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

      // Financial amounts (all in cents)
      amount: {
        type: Sequelize.INTEGER,
        allowNull: false,
      },
      currency: {
        type: Sequelize.STRING(3),
        allowNull: false,
        defaultValue: "usd",
      },
      platformFeeAmount: {
        type: Sequelize.INTEGER,
        allowNull: true,
      },
      netAmount: {
        type: Sequelize.INTEGER,
        allowNull: true,
      },

      // Tax reporting fields
      taxYear: {
        type: Sequelize.INTEGER,
        allowNull: true,
      },
      reportable: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      reported: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },

      // Additional metadata
      description: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      metadata: {
        type: Sequelize.JSON,
        allowNull: true,
      },
      failureReason: {
        type: Sequelize.TEXT,
        allowNull: true,
      },

      // Timestamps
      processedAt: {
        type: Sequelize.DATE,
        allowNull: true,
      },
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

    // Add indexes for common queries
    await queryInterface.addIndex("Payments", ["transactionId"], {
      unique: true,
      name: "payments_transaction_id_unique",
    });
    await queryInterface.addIndex("Payments", ["stripePaymentIntentId"], {
      name: "payments_stripe_payment_intent_id",
    });
    await queryInterface.addIndex("Payments", ["stripeTransferId"], {
      name: "payments_stripe_transfer_id",
    });
    await queryInterface.addIndex("Payments", ["userId"], {
      name: "payments_user_id",
    });
    await queryInterface.addIndex("Payments", ["cleanerId"], {
      name: "payments_cleaner_id",
    });
    await queryInterface.addIndex("Payments", ["appointmentId"], {
      name: "payments_appointment_id",
    });
    await queryInterface.addIndex("Payments", ["type", "status"], {
      name: "payments_type_status",
    });
    await queryInterface.addIndex("Payments", ["cleanerId", "taxYear", "reportable"], {
      name: "payments_cleaner_tax_year_reportable",
    });
    await queryInterface.addIndex("Payments", ["taxYear", "type", "status"], {
      name: "payments_tax_year_type_status",
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable("Payments");
  },
};
