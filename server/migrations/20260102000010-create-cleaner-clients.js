"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("CleanerClients", {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER,
      },

      // === Relationships ===
      cleanerId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: "Users",
          key: "id",
        },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      },
      clientId: {
        type: Sequelize.INTEGER,
        allowNull: true, // null until client accepts invitation
        references: {
          model: "Users",
          key: "id",
        },
        onUpdate: "CASCADE",
        onDelete: "SET NULL",
      },
      homeId: {
        type: Sequelize.INTEGER,
        allowNull: true, // null until client accepts and home is created
        references: {
          model: "UserHomes",
          key: "id",
        },
        onUpdate: "CASCADE",
        onDelete: "SET NULL",
      },

      // === Invitation data (used before client signs up) ===
      inviteToken: {
        type: Sequelize.STRING,
        allowNull: false,
        unique: true,
      },
      invitedEmail: {
        type: Sequelize.TEXT, // encrypted
        allowNull: false,
      },
      invitedName: {
        type: Sequelize.TEXT, // encrypted
        allowNull: false,
      },
      invitedPhone: {
        type: Sequelize.TEXT, // encrypted
        allowNull: true,
      },
      invitedAddress: {
        type: Sequelize.TEXT, // encrypted JSON
        allowNull: true,
      },
      invitedBeds: {
        type: Sequelize.INTEGER,
        allowNull: true,
      },
      invitedBaths: {
        type: Sequelize.DECIMAL(3, 1),
        allowNull: true,
      },
      invitedNotes: {
        type: Sequelize.TEXT,
        allowNull: true,
      },

      // === Relationship status ===
      status: {
        type: Sequelize.ENUM(
          "pending_invite",
          "active",
          "inactive",
          "declined"
        ),
        allowNull: false,
        defaultValue: "pending_invite",
      },
      invitedAt: {
        type: Sequelize.DATE,
        allowNull: false,
      },
      acceptedAt: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      lastInviteReminderAt: {
        type: Sequelize.DATE,
        allowNull: true,
      },

      // === Scheduling preferences ===
      defaultFrequency: {
        type: Sequelize.ENUM("weekly", "biweekly", "monthly", "on_demand"),
        allowNull: true,
      },
      defaultPrice: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: true,
      },
      defaultDayOfWeek: {
        type: Sequelize.INTEGER, // 0-6, 0=Sunday
        allowNull: true,
      },
      defaultTimeWindow: {
        type: Sequelize.STRING,
        allowNull: true,
      },

      // === Settings ===
      autoPayEnabled: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: true,
      },
      autoScheduleEnabled: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: true,
      },

      // === Timestamps ===
      createdAt: {
        allowNull: false,
        type: Sequelize.DATE,
      },
      updatedAt: {
        allowNull: false,
        type: Sequelize.DATE,
      },
    });

    // Indexes for common queries
    await queryInterface.addIndex("CleanerClients", ["cleanerId"], {
      name: "cleaner_clients_cleaner_idx",
    });
    await queryInterface.addIndex("CleanerClients", ["clientId"], {
      name: "cleaner_clients_client_idx",
    });
    await queryInterface.addIndex("CleanerClients", ["inviteToken"], {
      name: "cleaner_clients_invite_token_idx",
    });
    await queryInterface.addIndex("CleanerClients", ["status"], {
      name: "cleaner_clients_status_idx",
    });
    await queryInterface.addIndex("CleanerClients", ["cleanerId", "status"], {
      name: "cleaner_clients_cleaner_status_idx",
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable("CleanerClients");
  },
};
