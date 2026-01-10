"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Add 'passes' to the photoType ENUM
    await queryInterface.sequelize.query(`
      ALTER TYPE "enum_JobPhotos_photoType" ADD VALUE IF NOT EXISTS 'passes';
    `);

    // Add isNotApplicable column for passes that don't exist at the property
    await queryInterface.addColumn("JobPhotos", "isNotApplicable", {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    });

    // Add roomAssignmentId for multi-cleaner job support
    await queryInterface.addColumn("JobPhotos", "roomAssignmentId", {
      type: Sequelize.INTEGER,
      allowNull: true,
      references: {
        model: "CleanerRoomAssignments",
        key: "id",
      },
      onDelete: "SET NULL",
    });

    // Change photoData to allow null (for N/A passes)
    await queryInterface.changeColumn("JobPhotos", "photoData", {
      type: Sequelize.TEXT("long"),
      allowNull: true,
    });

    // Add index for room assignment lookups
    await queryInterface.addIndex("JobPhotos", ["roomAssignmentId"]);
  },

  down: async (queryInterface, Sequelize) => {
    // Remove index
    await queryInterface.removeIndex("JobPhotos", ["roomAssignmentId"]);

    // Change photoData back to not null (note: this may fail if there are null values)
    await queryInterface.changeColumn("JobPhotos", "photoData", {
      type: Sequelize.TEXT("long"),
      allowNull: false,
    });

    // Remove roomAssignmentId column
    await queryInterface.removeColumn("JobPhotos", "roomAssignmentId");

    // Remove isNotApplicable column
    await queryInterface.removeColumn("JobPhotos", "isNotApplicable");

    // Note: Removing ENUM values in PostgreSQL is complex and not easily reversible
    // The 'passes' value will remain in the enum
  },
};
