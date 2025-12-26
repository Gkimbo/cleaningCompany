"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    // Create ChecklistSections table
    await queryInterface.createTable("ChecklistSections", {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER,
      },
      title: {
        type: Sequelize.STRING(255),
        allowNull: false,
      },
      icon: {
        type: Sequelize.STRING(10),
        allowNull: true,
      },
      displayOrder: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
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

    // Create ChecklistItems table
    await queryInterface.createTable("ChecklistItems", {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER,
      },
      sectionId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: "ChecklistSections",
          key: "id",
        },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      },
      parentId: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          model: "ChecklistItems",
          key: "id",
        },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      },
      content: {
        type: Sequelize.TEXT,
        allowNull: false,
      },
      displayOrder: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      indentLevel: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      formatting: {
        type: Sequelize.JSON,
        allowNull: true,
        defaultValue: {
          bold: false,
          italic: false,
          bulletStyle: "disc",
        },
      },
      isActive: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: true,
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

    // Create ChecklistDrafts table
    await queryInterface.createTable("ChecklistDrafts", {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER,
      },
      draftData: {
        type: Sequelize.JSON,
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

    // Create ChecklistVersions table
    await queryInterface.createTable("ChecklistVersions", {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER,
      },
      version: {
        type: Sequelize.INTEGER,
        allowNull: false,
      },
      snapshotData: {
        type: Sequelize.JSON,
        allowNull: false,
      },
      publishedBy: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          model: "Users",
          key: "id",
        },
        onUpdate: "CASCADE",
        onDelete: "SET NULL",
      },
      publishedAt: {
        type: Sequelize.DATE,
        allowNull: false,
      },
      isActive: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
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

    // Add indexes
    await queryInterface.addIndex("ChecklistItems", ["sectionId"]);
    await queryInterface.addIndex("ChecklistItems", ["parentId"]);
    await queryInterface.addIndex("ChecklistItems", ["displayOrder"]);
    await queryInterface.addIndex("ChecklistVersions", ["isActive"]);
    await queryInterface.addIndex("ChecklistVersions", ["version"], {
      unique: true,
      name: "checklist_version_unique",
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable("ChecklistVersions");
    await queryInterface.dropTable("ChecklistDrafts");
    await queryInterface.dropTable("ChecklistItems");
    await queryInterface.dropTable("ChecklistSections");
  },
};
