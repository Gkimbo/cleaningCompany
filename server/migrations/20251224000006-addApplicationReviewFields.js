"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    // Add userId - links approved application to created user account
    await queryInterface.addColumn("UserApplications", "userId", {
      type: Sequelize.INTEGER,
      allowNull: true,
      references: {
        model: "Users",
        key: "id",
      },
      onUpdate: "CASCADE",
      onDelete: "SET NULL",
    });

    // Add reviewedBy - tracks who (owner or HR) reviewed the application
    await queryInterface.addColumn("UserApplications", "reviewedBy", {
      type: Sequelize.INTEGER,
      allowNull: true,
      references: {
        model: "Users",
        key: "id",
      },
      onUpdate: "CASCADE",
      onDelete: "SET NULL",
    });

    // Add reviewedAt - when the application was approved/rejected
    await queryInterface.addColumn("UserApplications", "reviewedAt", {
      type: Sequelize.DATE,
      allowNull: true,
    });

    // Add rejectionReason - optional reason for rejection
    await queryInterface.addColumn("UserApplications", "rejectionReason", {
      type: Sequelize.TEXT,
      allowNull: true,
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn("UserApplications", "rejectionReason");
    await queryInterface.removeColumn("UserApplications", "reviewedAt");
    await queryInterface.removeColumn("UserApplications", "reviewedBy");
    await queryInterface.removeColumn("UserApplications", "userId");
  },
};
