"use strict";

/**
 * Migration: Add Last-Minute Booking Fields
 *
 * Adds fields to support last-minute appointment bookings:
 * - PricingConfigs: configurable fee, threshold, and notification radius
 * - Users: cleaner service area location for geographic matching
 * - UserAppointments: tracking fields for last-minute bookings
 */

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Add last-minute pricing config fields to PricingConfigs
    await queryInterface.addColumn("PricingConfigs", "lastMinuteFee", {
      type: Sequelize.INTEGER,
      allowNull: false,
      defaultValue: 50,
      comment: "Flat fee for bookings within threshold hours (in dollars)",
    });

    await queryInterface.addColumn("PricingConfigs", "lastMinuteThresholdHours", {
      type: Sequelize.INTEGER,
      allowNull: false,
      defaultValue: 48,
      comment: "Hours before appointment that triggers last-minute fee",
    });

    await queryInterface.addColumn(
      "PricingConfigs",
      "lastMinuteNotificationRadiusMiles",
      {
        type: Sequelize.DECIMAL(5, 2),
        allowNull: false,
        defaultValue: 25.0,
        comment: "Radius in miles to notify cleaners for last-minute bookings",
      }
    );

    // Add cleaner service area fields to Users
    await queryInterface.addColumn("Users", "serviceAreaLatitude", {
      type: Sequelize.TEXT,
      allowNull: true,
      comment: "Cleaner service area center latitude (encrypted)",
    });

    await queryInterface.addColumn("Users", "serviceAreaLongitude", {
      type: Sequelize.TEXT,
      allowNull: true,
      comment: "Cleaner service area center longitude (encrypted)",
    });

    await queryInterface.addColumn("Users", "serviceAreaAddress", {
      type: Sequelize.TEXT,
      allowNull: true,
      comment: "Cleaner service area address for display (encrypted)",
    });

    await queryInterface.addColumn("Users", "serviceAreaRadiusMiles", {
      type: Sequelize.DECIMAL(5, 2),
      allowNull: true,
      defaultValue: 30.0,
      comment: "How far cleaner is willing to travel (in miles)",
    });

    // Add last-minute tracking fields to UserAppointments
    await queryInterface.addColumn("UserAppointments", "isLastMinuteBooking", {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      comment: "True if booked within threshold hours of appointment",
    });

    await queryInterface.addColumn("UserAppointments", "lastMinuteFeeApplied", {
      type: Sequelize.INTEGER,
      allowNull: true,
      comment: "Last-minute fee amount in dollars (null if not applicable)",
    });

    await queryInterface.addColumn(
      "UserAppointments",
      "lastMinuteNotificationsSentAt",
      {
        type: Sequelize.DATE,
        allowNull: true,
        comment: "When urgent notifications were sent to nearby cleaners",
      }
    );
  },

  down: async (queryInterface, Sequelize) => {
    // Remove from PricingConfigs
    await queryInterface.removeColumn("PricingConfigs", "lastMinuteFee");
    await queryInterface.removeColumn(
      "PricingConfigs",
      "lastMinuteThresholdHours"
    );
    await queryInterface.removeColumn(
      "PricingConfigs",
      "lastMinuteNotificationRadiusMiles"
    );

    // Remove from Users
    await queryInterface.removeColumn("Users", "serviceAreaLatitude");
    await queryInterface.removeColumn("Users", "serviceAreaLongitude");
    await queryInterface.removeColumn("Users", "serviceAreaAddress");
    await queryInterface.removeColumn("Users", "serviceAreaRadiusMiles");

    // Remove from UserAppointments
    await queryInterface.removeColumn("UserAppointments", "isLastMinuteBooking");
    await queryInterface.removeColumn("UserAppointments", "lastMinuteFeeApplied");
    await queryInterface.removeColumn(
      "UserAppointments",
      "lastMinuteNotificationsSentAt"
    );
  },
};
