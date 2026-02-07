"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Add 'passes' to the photoType ENUM
    await queryInterface.sequelize.query(`
      ALTER TYPE "enum_JobPhotos_photoType" ADD VALUE IF NOT EXISTS 'passes';
    `);

    const tableDescription = await queryInterface.describeTable("JobPhotos");

    // Add isNotApplicable column for passes that don't exist at the property
    if (!tableDescription.isNotApplicable) {
      await queryInterface.addColumn("JobPhotos", "isNotApplicable", {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      });
    }

    // roomAssignmentId is added by 20260104000009-add-room-assignment-to-job-photos

    // Change photoData to allow null (for N/A passes)
    await queryInterface.changeColumn("JobPhotos", "photoData", {
      type: Sequelize.TEXT("long"),
      allowNull: true,
    });
  },

  down: async (queryInterface, Sequelize) => {
    // roomAssignmentId is removed by 20260104000009-add-room-assignment-to-job-photos

    // Change photoData back to not null (note: this may fail if there are null values)
    await queryInterface.changeColumn("JobPhotos", "photoData", {
      type: Sequelize.TEXT("long"),
      allowNull: false,
    });

    const tableDescription = await queryInterface.describeTable("JobPhotos");
    if (tableDescription.isNotApplicable) {
      await queryInterface.removeColumn("JobPhotos", "isNotApplicable");
    }

    // Note: Removing ENUM values in PostgreSQL is complex and not easily reversible
    // The 'passes' value will remain in the enum
  },
};
