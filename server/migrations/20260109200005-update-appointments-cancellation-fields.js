"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    // Create ENUM type for cancellation method
    await queryInterface.sequelize.query(`
      CREATE TYPE "enum_UserAppointments_cancellationMethod" AS ENUM (
        'app', 'web', 'support', 'system'
      );
    `).catch(() => {}); // Ignore if already exists

    // Create ENUM type for cancellation type
    await queryInterface.sequelize.query(`
      CREATE TYPE "enum_UserAppointments_cancellationType" AS ENUM (
        'homeowner', 'cleaner', 'system', 'weather'
      );
    `).catch(() => {});

    // Add cancellation tracking fields to UserAppointments
    await queryInterface.addColumn("UserAppointments", "cancellationInitiatedAt", {
      type: Sequelize.DATE,
      allowNull: true,
    });

    await queryInterface.addColumn("UserAppointments", "cancellationInitiatedBy", {
      type: Sequelize.INTEGER,
      references: {
        model: "Users",
        key: "id",
      },
      onUpdate: "CASCADE",
      onDelete: "SET NULL",
    });

    await queryInterface.addColumn("UserAppointments", "cancellationConfirmedAt", {
      type: Sequelize.DATE,
      allowNull: true,
    });

    await queryInterface.addColumn("UserAppointments", "cancellationReason", {
      type: Sequelize.TEXT,
      allowNull: true,
    });

    await queryInterface.addColumn("UserAppointments", "cancellationMethod", {
      type: Sequelize.ENUM("app", "web", "support", "system"),
      allowNull: true,
    });

    // Quick filtering fields
    await queryInterface.addColumn("UserAppointments", "wasCancelled", {
      type: Sequelize.BOOLEAN,
      defaultValue: false,
    });

    await queryInterface.addColumn("UserAppointments", "cancellationType", {
      type: Sequelize.ENUM("homeowner", "cleaner", "system", "weather"),
      allowNull: true,
    });

    // Appeal reference
    await queryInterface.addColumn("UserAppointments", "hasActiveAppeal", {
      type: Sequelize.BOOLEAN,
      defaultValue: false,
    });

    await queryInterface.addColumn("UserAppointments", "appealId", {
      type: Sequelize.INTEGER,
      references: {
        model: "CancellationAppeals",
        key: "id",
      },
      onUpdate: "CASCADE",
      onDelete: "SET NULL",
    });

    // Confirmation ID for reference
    await queryInterface.addColumn("UserAppointments", "cancellationConfirmationId", {
      type: Sequelize.STRING,
      allowNull: true,
      comment: "Human-readable confirmation ID like CXL-2026-0109-A7B3C9",
    });

    // Appeal window tracking
    await queryInterface.addColumn("UserAppointments", "appealWindowExpiresAt", {
      type: Sequelize.DATE,
      allowNull: true,
      comment: "72 hours from cancellation for appeal submission",
    });

    // Add indexes
    await queryInterface.addIndex("UserAppointments", ["wasCancelled"], {
      name: "idx_appointments_cancelled",
    });

    await queryInterface.addIndex("UserAppointments", ["cancellationType"], {
      name: "idx_appointments_cancel_type",
    });

    await queryInterface.addIndex("UserAppointments", ["hasActiveAppeal"], {
      name: "idx_appointments_active_appeal",
    });

    await queryInterface.addIndex("UserAppointments", ["cancellationConfirmationId"], {
      name: "idx_appointments_cancel_confirmation",
    });

    await queryInterface.addIndex("UserAppointments", ["appealWindowExpiresAt"], {
      name: "idx_appointments_appeal_window",
    });
  },

  async down(queryInterface, Sequelize) {
    // Remove indexes first
    await queryInterface.removeIndex("UserAppointments", "idx_appointments_cancelled").catch(() => {});
    await queryInterface.removeIndex("UserAppointments", "idx_appointments_cancel_type").catch(() => {});
    await queryInterface.removeIndex("UserAppointments", "idx_appointments_active_appeal").catch(() => {});
    await queryInterface.removeIndex("UserAppointments", "idx_appointments_cancel_confirmation").catch(() => {});
    await queryInterface.removeIndex("UserAppointments", "idx_appointments_appeal_window").catch(() => {});

    // Remove columns
    await queryInterface.removeColumn("UserAppointments", "cancellationInitiatedAt");
    await queryInterface.removeColumn("UserAppointments", "cancellationInitiatedBy");
    await queryInterface.removeColumn("UserAppointments", "cancellationConfirmedAt");
    await queryInterface.removeColumn("UserAppointments", "cancellationReason");
    await queryInterface.removeColumn("UserAppointments", "cancellationMethod");
    await queryInterface.removeColumn("UserAppointments", "wasCancelled");
    await queryInterface.removeColumn("UserAppointments", "cancellationType");
    await queryInterface.removeColumn("UserAppointments", "hasActiveAppeal");
    await queryInterface.removeColumn("UserAppointments", "appealId");
    await queryInterface.removeColumn("UserAppointments", "cancellationConfirmationId");
    await queryInterface.removeColumn("UserAppointments", "appealWindowExpiresAt");

    // Drop ENUMs
    await queryInterface.sequelize.query(`
      DROP TYPE IF EXISTS "enum_UserAppointments_cancellationMethod";
      DROP TYPE IF EXISTS "enum_UserAppointments_cancellationType";
    `);
  },
};
