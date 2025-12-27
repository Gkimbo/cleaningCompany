"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    // Add deletedAt to Messages table for soft delete
    await queryInterface.addColumn("Messages", "deletedAt", {
      type: Sequelize.DATE,
      allowNull: true,
    });

    // Create MessageReactions table
    await queryInterface.createTable("MessageReactions", {
      id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
      },
      messageId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: "Messages",
          key: "id",
        },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
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
      emoji: {
        type: Sequelize.STRING(10),
        allowNull: false,
      },
      createdAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal("CURRENT_TIMESTAMP"),
      },
      updatedAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal("CURRENT_TIMESTAMP"),
      },
    });

    // Add unique constraint: one reaction per user per message per emoji
    await queryInterface.addIndex("MessageReactions", ["messageId", "userId", "emoji"], {
      unique: true,
      name: "unique_user_message_emoji",
    });

    // Create MessageReadReceipts table
    await queryInterface.createTable("MessageReadReceipts", {
      id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
      },
      messageId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: "Messages",
          key: "id",
        },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
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
      readAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal("CURRENT_TIMESTAMP"),
      },
      createdAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal("CURRENT_TIMESTAMP"),
      },
      updatedAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal("CURRENT_TIMESTAMP"),
      },
    });

    // Add unique constraint: one read receipt per user per message
    await queryInterface.addIndex("MessageReadReceipts", ["messageId", "userId"], {
      unique: true,
      name: "unique_user_message_read",
    });

    // Add index for faster lookups
    await queryInterface.addIndex("MessageReactions", ["messageId"]);
    await queryInterface.addIndex("MessageReadReceipts", ["messageId"]);
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable("MessageReadReceipts");
    await queryInterface.dropTable("MessageReactions");
    await queryInterface.removeColumn("Messages", "deletedAt");
  },
};
