"use strict";

/**
 * Migration: Add Common Room Fields to UserHomes
 *
 * Adds 8 nullable INTEGER fields to track common room counts for larger homes.
 * Also expands CleanerRoomAssignment roomType ENUM with 5 new room types.
 *
 * These fields enable accurate room assignment and effort balancing for multi-cleaner jobs.
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Add common room count fields to UserHomes
    await queryInterface.addColumn("UserHomes", "numKitchens", {
      type: Sequelize.INTEGER,
      allowNull: true,
      comment: "Number of kitchens (for large homes with 4+ beds)",
    });

    await queryInterface.addColumn("UserHomes", "numLivingRooms", {
      type: Sequelize.INTEGER,
      allowNull: true,
      comment: "Number of living rooms (for large homes with 4+ beds)",
    });

    await queryInterface.addColumn("UserHomes", "numDiningRooms", {
      type: Sequelize.INTEGER,
      allowNull: true,
      comment: "Number of dining rooms (for large homes with 4+ beds)",
    });

    await queryInterface.addColumn("UserHomes", "numFamilyRooms", {
      type: Sequelize.INTEGER,
      allowNull: true,
      comment: "Number of family rooms (for large homes with 4+ beds)",
    });

    await queryInterface.addColumn("UserHomes", "numOffices", {
      type: Sequelize.INTEGER,
      allowNull: true,
      comment: "Number of home offices (for large homes with 4+ beds)",
    });

    await queryInterface.addColumn("UserHomes", "numLaundryRooms", {
      type: Sequelize.INTEGER,
      allowNull: true,
      comment: "Number of laundry rooms (for large homes with 4+ beds)",
    });

    await queryInterface.addColumn("UserHomes", "numBonusRooms", {
      type: Sequelize.INTEGER,
      allowNull: true,
      comment: "Number of bonus rooms (for large homes with 4+ beds)",
    });

    await queryInterface.addColumn("UserHomes", "numBasements", {
      type: Sequelize.INTEGER,
      allowNull: true,
      comment: "Number of basements (for large homes with 4+ beds)",
    });

    // Expand CleanerRoomAssignment roomType ENUM with new room types
    // PostgreSQL requires ALTER TYPE ... ADD VALUE for each new enum value
    await queryInterface.sequelize.query(
      `ALTER TYPE "enum_CleanerRoomAssignments_roomType" ADD VALUE IF NOT EXISTS 'family_room'`
    );
    await queryInterface.sequelize.query(
      `ALTER TYPE "enum_CleanerRoomAssignments_roomType" ADD VALUE IF NOT EXISTS 'office'`
    );
    await queryInterface.sequelize.query(
      `ALTER TYPE "enum_CleanerRoomAssignments_roomType" ADD VALUE IF NOT EXISTS 'laundry_room'`
    );
    await queryInterface.sequelize.query(
      `ALTER TYPE "enum_CleanerRoomAssignments_roomType" ADD VALUE IF NOT EXISTS 'bonus_room'`
    );
    await queryInterface.sequelize.query(
      `ALTER TYPE "enum_CleanerRoomAssignments_roomType" ADD VALUE IF NOT EXISTS 'basement'`
    );
  },

  async down(queryInterface, Sequelize) {
    // Remove common room count fields from UserHomes
    await queryInterface.removeColumn("UserHomes", "numKitchens");
    await queryInterface.removeColumn("UserHomes", "numLivingRooms");
    await queryInterface.removeColumn("UserHomes", "numDiningRooms");
    await queryInterface.removeColumn("UserHomes", "numFamilyRooms");
    await queryInterface.removeColumn("UserHomes", "numOffices");
    await queryInterface.removeColumn("UserHomes", "numLaundryRooms");
    await queryInterface.removeColumn("UserHomes", "numBonusRooms");
    await queryInterface.removeColumn("UserHomes", "numBasements");

    // Note: PostgreSQL does not support removing values from an ENUM type.
    // The roomType ENUM values will remain but won't be used.
    // To fully remove them, a more complex migration would be needed
    // (create new type, migrate data, drop old type, rename new type).
  },
};
