"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    // Add marketplace tracking fields to EmployeeJobAssignments
    await queryInterface.addColumn("EmployeeJobAssignments", "isMarketplacePickup", {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      comment: "True if this job was picked up from marketplace (not business owner's own client)",
    });

    await queryInterface.addColumn("EmployeeJobAssignments", "checklistProgress", {
      type: Sequelize.JSONB,
      allowNull: true,
      comment: "Tracks checklist completion progress for this assignment",
    });

    await queryInterface.addColumn("EmployeeJobAssignments", "checklistCompleted", {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      comment: "True when checklist is fully completed",
    });

    await queryInterface.addColumn("EmployeeJobAssignments", "beforePhotoCount", {
      type: Sequelize.INTEGER,
      allowNull: false,
      defaultValue: 0,
      comment: "Number of before photos uploaded",
    });

    await queryInterface.addColumn("EmployeeJobAssignments", "afterPhotoCount", {
      type: Sequelize.INTEGER,
      allowNull: false,
      defaultValue: 0,
      comment: "Number of after photos uploaded",
    });

    await queryInterface.addColumn("EmployeeJobAssignments", "photosCompleted", {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      comment: "True when both before and after photos have been uploaded",
    });

    // Add index for marketplace job queries
    await queryInterface.addIndex("EmployeeJobAssignments", ["isMarketplacePickup"], {
      name: "idx_employee_job_assignments_marketplace",
    });
  },

  async down(queryInterface) {
    await queryInterface.removeIndex(
      "EmployeeJobAssignments",
      "idx_employee_job_assignments_marketplace"
    );
    await queryInterface.removeColumn("EmployeeJobAssignments", "photosCompleted");
    await queryInterface.removeColumn("EmployeeJobAssignments", "afterPhotoCount");
    await queryInterface.removeColumn("EmployeeJobAssignments", "beforePhotoCount");
    await queryInterface.removeColumn("EmployeeJobAssignments", "checklistCompleted");
    await queryInterface.removeColumn("EmployeeJobAssignments", "checklistProgress");
    await queryInterface.removeColumn("EmployeeJobAssignments", "isMarketplacePickup");
  },
};
