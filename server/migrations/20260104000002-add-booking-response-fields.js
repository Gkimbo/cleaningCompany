"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    // Add client response tracking fields
    await queryInterface.addColumn("UserAppointments", "clientRespondedAt", {
      type: Sequelize.DATE,
      allowNull: true,
    });

    await queryInterface.addColumn("UserAppointments", "clientResponse", {
      type: Sequelize.STRING(20),
      allowNull: true,
      // 'accepted', 'declined', 'expired'
    });

    await queryInterface.addColumn("UserAppointments", "declineReason", {
      type: Sequelize.TEXT,
      allowNull: true,
    });

    await queryInterface.addColumn("UserAppointments", "suggestedDates", {
      type: Sequelize.JSONB,
      allowNull: true,
      // Array of dates suggested by client when declining
      // e.g., ["2026-01-10", "2026-01-15", "2026-01-20"]
    });

    await queryInterface.addColumn("UserAppointments", "expiresAt", {
      type: Sequelize.DATE,
      allowNull: true,
      // Set to 48 hours from creation for pending approval bookings
    });

    await queryInterface.addColumn("UserAppointments", "originalBookingId", {
      type: Sequelize.INTEGER,
      allowNull: true,
      references: {
        model: "UserAppointments",
        key: "id",
      },
      onUpdate: "CASCADE",
      onDelete: "SET NULL",
      // For tracking rebooking attempts after decline
    });

    await queryInterface.addColumn("UserAppointments", "rebookingAttempts", {
      type: Sequelize.INTEGER,
      allowNull: false,
      defaultValue: 0,
    });

    // Add indexes for efficient querying
    await queryInterface.addIndex(
      "UserAppointments",
      ["clientResponsePending"],
      {
        name: "appointments_client_response_pending_idx",
        where: { clientResponsePending: true },
      }
    );

    await queryInterface.addIndex("UserAppointments", ["expiresAt"], {
      name: "appointments_expires_at_idx",
      where: { expiresAt: { [Sequelize.Op.ne]: null } },
    });

    await queryInterface.addIndex("UserAppointments", ["bookedByCleanerId"], {
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
