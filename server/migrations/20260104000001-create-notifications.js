"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("Notifications", {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER,
      },

      // === Relationships ===
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
      relatedAppointmentId: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          model: "UserAppointments",
          key: "id",
        },
        onUpdate: "CASCADE",
        onDelete: "SET NULL",
      },
      relatedCleanerClientId: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          model: "CleanerClients",
          key: "id",
        },
        onUpdate: "CASCADE",
        onDelete: "SET NULL",
      },

      // === Notification content ===
      type: {
        type: Sequelize.STRING(50),
        allowNull: false,
        // Types: 'pending_booking', 'booking_accepted', 'booking_declined',
        // 'booking_expired', 'booking_rescheduled', 'general'
      },
      title: {
        type: Sequelize.STRING(255),
        allowNull: false,
      },
      body: {
        type: Sequelize.TEXT,
        allowNull: false,
      },
      data: {
        type: Sequelize.JSONB,
        allowNull: true,
        // Store additional context: appointmentId, cleanerClientId, suggestedDates, etc.
      },

      // === Status flags ===
      isRead: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      actionRequired: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },

      // === Expiration ===
      expiresAt: {
        type: Sequelize.DATE,
        allowNull: true,
        // For time-sensitive notifications like pending booking requests
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

    // Indexes for efficient querying
    await queryInterface.addIndex("Notifications", ["userId"], {
      name: "notifications_user_id_idx",
    });
    await queryInterface.addIndex("Notifications", ["userId", "isRead"], {
      name: "notifications_user_unread_idx",
      where: { isRead: false },
    });
    await queryInterface.addIndex("Notifications", ["userId", "actionRequired"], {
      name: "notifications_user_action_required_idx",
      where: { actionRequired: true },
    });
    await queryInterface.addIndex("Notifications", ["type"], {
      name: "notifications_type_idx",
    });
    await queryInterface.addIndex("Notifications", ["expiresAt"], {
      name: "notifications_expires_at_idx",
      where: { expiresAt: { [Sequelize.Op.ne]: null } },
    });
    await queryInterface.addIndex("Notifications", ["relatedAppointmentId"], {
      name: "notifications_appointment_idx",
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable("Notifications");
  },
};
