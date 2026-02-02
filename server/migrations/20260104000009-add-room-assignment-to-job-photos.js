"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn("JobPhotos", "roomAssignmentId", {
      type: Sequelize.INTEGER,
      allowNull: true,
      references: {
        model: "CleanerRoomAssignments",
        key: "id",
      },
      onDelete: "SET NULL",
      comment: "Links photo to specific room for multi-cleaner jobs",
    });

    await queryInterface.addIndex("JobPhotos", ["roomAssignmentId"]);
  },

  down: async (queryInterface, Sequelize) => {
    const tableDescription = await queryInterface.describeTable("JobPhotos");
    if (tableDescription.roomAssignmentId) {
      await queryInterface.removeIndex("JobPhotos", ["roomAssignmentId"]).catch(() => {});
      await queryInterface.removeColumn("JobPhotos", "roomAssignmentId");
    }
  },
};
