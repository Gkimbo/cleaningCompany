"use strict";

// Helper to safely add column (skip if exists)
async function safeAddColumn(queryInterface, table, column, options) {
  try {
    await queryInterface.addColumn(table, column, options);
  } catch (e) {
    if (!e.message.includes("already exists")) throw e;
    console.log(`Column ${column} already exists in ${table}, skipping`);
  }
}

// Helper to safely add index (skip if exists)
async function safeAddIndex(queryInterface, table, columns, options) {
  try {
    await queryInterface.addIndex(table, columns, options);
  } catch (e) {
    if (!e.message.includes("already exists")) throw e;
    console.log(`Index ${options.name} already exists, skipping`);
  }
}

module.exports = {
  async up(queryInterface, Sequelize) {
    // Add client response tracking fields
    await safeAddColumn(queryInterface, "UserAppointments", "clientRespondedAt", {
      type: Sequelize.DATE,
      allowNull: true,
    });

    await safeAddColumn(queryInterface, "UserAppointments", "clientResponse", {
      type: Sequelize.STRING(20),
      allowNull: true,
    });

    await safeAddColumn(queryInterface, "UserAppointments", "declineReason", {
      type: Sequelize.TEXT,
      allowNull: true,
    });

    await safeAddColumn(queryInterface, "UserAppointments", "suggestedDates", {
      type: Sequelize.JSONB,
      allowNull: true,
    });

    await safeAddColumn(queryInterface, "UserAppointments", "expiresAt", {
      type: Sequelize.DATE,
      allowNull: true,
    });

    await safeAddColumn(queryInterface, "UserAppointments", "originalBookingId", {
      type: Sequelize.INTEGER,
      allowNull: true,
      references: {
        model: "UserAppointments",
        key: "id",
      },
      onUpdate: "CASCADE",
      onDelete: "SET NULL",
    });

    await safeAddColumn(queryInterface, "UserAppointments", "rebookingAttempts", {
      type: Sequelize.INTEGER,
      allowNull: false,
      defaultValue: 0,
    });

    // Add indexes for efficient querying
    await safeAddIndex(queryInterface, "UserAppointments", ["clientResponsePending"], {
      name: "appointments_client_response_pending_idx",
      where: { clientResponsePending: true },
    });

    await safeAddIndex(queryInterface, "UserAppointments", ["expiresAt"], {
      name: "appointments_expires_at_idx",
      where: { expiresAt: { [Sequelize.Op.ne]: null } },
    });

    await safeAddIndex(queryInterface, "UserAppointments", ["bookedByCleanerId"], {
      name: "appointments_booked_by_cleaner_idx",
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeIndex(
      "UserAppointments",
      "appointments_booked_by_cleaner_idx"
    );
    await queryInterface.removeIndex(
      "UserAppointments",
      "appointments_expires_at_idx"
    );
    await queryInterface.removeIndex(
      "UserAppointments",
      "appointments_client_response_pending_idx"
    );

    await queryInterface.removeColumn("UserAppointments", "rebookingAttempts");
    await queryInterface.removeColumn("UserAppointments", "originalBookingId");
    await queryInterface.removeColumn("UserAppointments", "expiresAt");
    await queryInterface.removeColumn("UserAppointments", "suggestedDates");
    await queryInterface.removeColumn("UserAppointments", "declineReason");
    await queryInterface.removeColumn("UserAppointments", "clientResponse");
    await queryInterface.removeColumn("UserAppointments", "clientRespondedAt");
  },
};
