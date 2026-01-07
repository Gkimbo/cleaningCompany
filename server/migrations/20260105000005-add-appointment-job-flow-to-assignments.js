"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    // Add appointmentJobFlowId to EmployeeJobAssignments
    await queryInterface.addColumn("EmployeeJobAssignments", "appointmentJobFlowId", {
      type: Sequelize.INTEGER,
      allowNull: true,
      references: {
        model: "AppointmentJobFlows",
        key: "id",
      },
      onUpdate: "CASCADE",
      onDelete: "SET NULL",
      comment: "Link to the job flow for this assignment",
    });

    // Add index for the new column
    await queryInterface.addIndex("EmployeeJobAssignments", ["appointmentJobFlowId"], {
      name: "idx_employee_job_assignments_job_flow",
    });
  },

  async down(queryInterface) {
    await queryInterface.removeIndex(
      "EmployeeJobAssignments",
      "idx_employee_job_assignments_job_flow"
    );
    await queryInterface.removeColumn("EmployeeJobAssignments", "appointmentJobFlowId");
  },
};
