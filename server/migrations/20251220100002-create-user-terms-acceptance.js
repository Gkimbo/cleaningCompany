"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("UserTermsAcceptances", {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER,
      },
      userId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: "Users",
          key: "id",
        },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      },
      termsId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: "TermsAndConditions",
          key: "id",
        },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      },
      acceptedAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.NOW,
      },
      ipAddress: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      termsContentSnapshot: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      pdfSnapshotPath: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      createdAt: {
        allowNull: false,
        type: Sequelize.DATE,
      },
      updatedAt: {
        allowNull: false,
        type: Sequelize.DATE,
      },
    });

    // Add indexes for quick lookups
    await queryInterface.addIndex("UserTermsAcceptances", ["userId"]);
    await queryInterface.addIndex("UserTermsAcceptances", ["termsId"]);
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable("UserTermsAcceptances");
  },
};
