"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("RecurringSchedules", {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER,
      },

      // === Relationships ===
      cleanerClientId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: "CleanerClients",
          key: "id",
        },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      },
      homeId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: "UserHomes",
          key: "id",
        },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      },
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
        allowNull: false,
        references: {
          model: "Users",
          key: "id",
        },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      },

      // === Schedule configuration ===
      frequency: {
        type: Sequelize.ENUM("weekly", "biweekly", "monthly"),
        allowNull: false,
      },
      dayOfWeek: {
        type: Sequelize.INTEGER, // 0-6, 0=Sunday
        allowNull: false,
      },
      timeWindow: {
        type: Sequelize.STRING,
        allowNull: false,
        defaultValue: "anytime",
      },
      price: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: false,
      },

      // === Date range ===
      startDate: {
        type: Sequelize.DATEONLY,
        allowNull: false,
      },
      endDate: {
        type: Sequelize.DATEONLY,
        allowNull: true, // null = ongoing indefinitely
      },
      nextScheduledDate: {
        type: Sequelize.DATEONLY,
        allowNull: true,
      },
      lastGeneratedDate: {
        type: Sequelize.DATEONLY,
        allowNull: true,
      },

      // === Status ===
      isActive: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: true,
      },
      isPaused: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      pausedUntil: {
        type: Sequelize.DATEONLY,
        allowNull: true,
      },
      pauseReason: {
        type: Sequelize.STRING,
        allowNull: true,
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
    await queryInterface.addIndex("RecurringSchedules", ["cleanerClientId"], {
      name: "recurring_schedules_cleaner_client_idx",
    });
    await queryInterface.addIndex("RecurringSchedules", ["cleanerId"], {
      name: "recurring_schedules_cleaner_idx",
    });
    await queryInterface.addIndex("RecurringSchedules", ["clientId"], {
      name: "recurring_schedules_client_idx",
    });
    await queryInterface.addIndex("RecurringSchedules", ["homeId"], {
      name: "recurring_schedules_home_idx",
    });
    await queryInterface.addIndex("RecurringSchedules", ["isActive"], {
      name: "recurring_schedules_active_idx",
    });
    await queryInterface.addIndex("RecurringSchedules", ["nextScheduledDate"], {
      name: "recurring_schedules_next_date_idx",
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable("RecurringSchedules");
  },
};
