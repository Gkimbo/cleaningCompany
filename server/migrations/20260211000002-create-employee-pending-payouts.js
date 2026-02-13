"use strict";

/**
 * Migration: Create EmployeePendingPayouts table
 *
 * This table tracks employee earnings that are waiting for the bi-weekly payout cycle.
 * Business owners are paid immediately; employee payouts are batched every other Friday.
 */

module.exports = {
  async up(queryInterface, Sequelize) {
    // Create the EmployeePendingPayouts table
    await queryInterface.createTable("EmployeePendingPayouts", {
      id: {
        type: Sequelize.INTEGER,
        autoIncrement: true,
        primaryKey: true,
      },

      // Who gets paid
      businessEmployeeId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: "BusinessEmployees",
          key: "id",
        },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      },
      businessOwnerId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: "Users",
          key: "id",
        },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      },

      // Source of earning
      employeeJobAssignmentId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        unique: true,
        references: {
          model: "EmployeeJobAssignments",
          key: "id",
        },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      },
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

      // Payment details
      amount: {
        type: Sequelize.INTEGER,
        allowNull: false,
        comment: "Amount in cents",
      },
      payType: {
        type: Sequelize.STRING(20),
        allowNull: true,
        comment: "hourly, per_job, percentage",
      },
      hoursWorked: {
        type: Sequelize.DECIMAL(5, 2),
        allowNull: true,
        comment: "Hours worked for hourly employees",
      },

      // Status tracking
      status: {
        type: Sequelize.STRING(20),
        allowNull: false,
        defaultValue: "pending",
        comment: "pending, processing, completed, failed, cancelled",
      },

      // Timing
      earnedAt: {
        type: Sequelize.DATE,
        allowNull: false,
        comment: "When the job was completed",
      },
      scheduledPayoutDate: {
        type: Sequelize.DATEONLY,
        allowNull: false,
        comment: "When this will be paid (bi-weekly Friday)",
      },
      paidAt: {
        type: Sequelize.DATE,
        allowNull: true,
        comment: "When actually paid",
      },

      // Stripe tracking
      stripeTransferId: {
        type: Sequelize.STRING(255),
        allowNull: true,
      },
      failureReason: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      retryCount: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
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
    await queryInterface.addIndex("EmployeePendingPayouts", ["businessEmployeeId", "status"], {
      name: "idx_pending_employee_status",
    });
    await queryInterface.addIndex("EmployeePendingPayouts", ["scheduledPayoutDate", "status"], {
      name: "idx_pending_schedule_status",
    });
    await queryInterface.addIndex("EmployeePendingPayouts", ["businessOwnerId", "status"], {
      name: "idx_pending_owner_status",
    });

    // Add pendingPayoutId column to EmployeeJobAssignments
    await queryInterface.addColumn("EmployeeJobAssignments", "pendingPayoutId", {
      type: Sequelize.INTEGER,
      allowNull: true,
      references: {
        model: "EmployeePendingPayouts",
        key: "id",
      },
      onUpdate: "CASCADE",
      onDelete: "SET NULL",
    });
  },

  async down(queryInterface) {
    // Remove the pendingPayoutId column from EmployeeJobAssignments
    await queryInterface.removeColumn("EmployeeJobAssignments", "pendingPayoutId");

    // Drop the EmployeePendingPayouts table
    await queryInterface.dropTable("EmployeePendingPayouts");
  },
};
