"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Add fields to UserAppointments for preferred cleaner decline flow
    await queryInterface.addColumn("UserAppointments", "preferredCleanerDeclined", {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    });

    await queryInterface.addColumn("UserAppointments", "declinedAt", {
      type: Sequelize.DATE,
      allowNull: true,
    });

    await queryInterface.addColumn("UserAppointments", "clientResponsePending", {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    });

    await queryInterface.addColumn("UserAppointments", "openToMarket", {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    });

    await queryInterface.addColumn("UserAppointments", "openedToMarketAt", {
      type: Sequelize.DATE,
      allowNull: true,
    });

    await queryInterface.addColumn("UserAppointments", "businessOwnerPrice", {
      type: Sequelize.DECIMAL(10, 2),
      allowNull: true,
    });

    // Add index for finding appointments awaiting client response
    await queryInterface.addIndex("UserAppointments", ["clientResponsePending"], {
      name: "idx_appointments_client_response_pending",
    });

    // Add index for finding open market appointments
    await queryInterface.addIndex("UserAppointments", ["openToMarket", "hasBeenAssigned"], {
      name: "idx_appointments_open_to_market",
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeIndex("UserAppointments", "idx_appointments_open_to_market");
    await queryInterface.removeIndex("UserAppointments", "idx_appointments_client_response_pending");

    await queryInterface.removeColumn("UserAppointments", "businessOwnerPrice");
    await queryInterface.removeColumn("UserAppointments", "openedToMarketAt");
    await queryInterface.removeColumn("UserAppointments", "openToMarket");
    await queryInterface.removeColumn("UserAppointments", "clientResponsePending");
    await queryInterface.removeColumn("UserAppointments", "declinedAt");
    await queryInterface.removeColumn("UserAppointments", "preferredCleanerDeclined");
  },
};
