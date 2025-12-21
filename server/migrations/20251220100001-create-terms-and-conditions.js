"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("TermsAndConditions", {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER,
      },
      type: {
        type: Sequelize.ENUM("homeowner", "cleaner"),
        allowNull: false,
      },
      version: {
        type: Sequelize.INTEGER,
        allowNull: false,
      },
      title: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      content: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      contentType: {
        type: Sequelize.ENUM("text", "pdf"),
        allowNull: false,
        defaultValue: "text",
      },
      pdfFileName: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      pdfFilePath: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      pdfFileSize: {
        type: Sequelize.INTEGER,
        allowNull: true,
      },
      effectiveDate: {
        type: Sequelize.DATEONLY,
        allowNull: false,
      },
      createdBy: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          model: "Users",
          key: "id",
        },
        onUpdate: "CASCADE",
        onDelete: "SET NULL",
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

    // Add index for quick lookups by type and version
    await queryInterface.addIndex("TermsAndConditions", ["type", "version"], {
      unique: true,
      name: "terms_type_version_unique",
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable("TermsAndConditions");
  },
};
