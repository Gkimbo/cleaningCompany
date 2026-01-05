"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    // Create GuestNotLeftReports table
    await queryInterface.createTable("GuestNotLeftReports", {
      id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
      },
      employeeJobAssignmentId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: "EmployeeJobAssignments",
          key: "id",
        },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      },
      appointmentId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: "UserAppointments",
          key: "id",
        },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      },
      reportedBy: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: "Users",
          key: "id",
        },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
        comment: "The cleaner who reported guest not left",
      },
      reportedAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal("CURRENT_TIMESTAMP"),
      },
      cleanerLatitude: {
        type: Sequelize.DECIMAL(10, 8),
        allowNull: true,
        comment: "GPS latitude at time of report (if available)",
      },
      cleanerLongitude: {
        type: Sequelize.DECIMAL(11, 8),
        allowNull: true,
        comment: "GPS longitude at time of report (if available)",
      },
      distanceFromHome: {
        type: Sequelize.INTEGER,
        allowNull: true,
        comment: "Distance in meters from property at time of report",
      },
      notes: {
        type: Sequelize.TEXT,
        allowNull: true,
        comment: "Optional notes from cleaner",
      },
      resolved: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      resolvedAt: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      resolvedBy: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          model: "Users",
          key: "id",
        },
        onUpdate: "CASCADE",
        onDelete: "SET NULL",
      },
      resolution: {
        type: Sequelize.STRING(50),
        allowNull: true,
        comment: "job_completed, cancelled, expired, manually_resolved",
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

    // Add indexes for GuestNotLeftReports
    await queryInterface.addIndex("GuestNotLeftReports", ["employeeJobAssignmentId"], {
      name: "idx_guest_not_left_assignment",
    });
    await queryInterface.addIndex("GuestNotLeftReports", ["appointmentId"], {
      name: "idx_guest_not_left_appointment",
    });
    await queryInterface.addIndex("GuestNotLeftReports", ["reportedBy"], {
      name: "idx_guest_not_left_reporter",
    });
    await queryInterface.addIndex("GuestNotLeftReports", ["resolved"], {
      name: "idx_guest_not_left_resolved",
    });

    // Add new fields to EmployeeJobAssignments
    await queryInterface.addColumn("EmployeeJobAssignments", "guestNotLeftReported", {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      comment: "True if guest-not-left was most recently reported (cleared on successful start)",
    });

    await queryInterface.addColumn("EmployeeJobAssignments", "guestNotLeftReportCount", {
      type: Sequelize.INTEGER,
      allowNull: false,
      defaultValue: 0,
      comment: "Total number of guest-not-left reports for this assignment",
    });

    await queryInterface.addColumn("EmployeeJobAssignments", "lastGuestNotLeftAt", {
      type: Sequelize.DATE,
      allowNull: true,
      comment: "Timestamp of most recent guest-not-left report",
    });

    await queryInterface.addColumn("EmployeeJobAssignments", "startLocationVerified", {
      type: Sequelize.BOOLEAN,
      allowNull: true,
      comment: "True if GPS was verified at job start, false if failed/skipped, null if not checked",
    });

    await queryInterface.addColumn("EmployeeJobAssignments", "startLatitude", {
      type: Sequelize.DECIMAL(10, 8),
      allowNull: true,
      comment: "GPS latitude when job started (if available)",
    });

    await queryInterface.addColumn("EmployeeJobAssignments", "startLongitude", {
      type: Sequelize.DECIMAL(11, 8),
      allowNull: true,
      comment: "GPS longitude when job started (if available)",
    });

    await queryInterface.addColumn("EmployeeJobAssignments", "startDistanceFromHome", {
      type: Sequelize.INTEGER,
      allowNull: true,
      comment: "Distance in meters from home at job start",
    });

    // Add index for finding assignments with guest not left issues
    await queryInterface.addIndex("EmployeeJobAssignments", ["guestNotLeftReported"], {
      name: "idx_employee_assignments_guest_not_left",
    });
  },

  async down(queryInterface) {
    // Remove indexes and columns from EmployeeJobAssignments
    await queryInterface.removeIndex("EmployeeJobAssignments", "idx_employee_assignments_guest_not_left");
    await queryInterface.removeColumn("EmployeeJobAssignments", "startDistanceFromHome");
    await queryInterface.removeColumn("EmployeeJobAssignments", "startLongitude");
    await queryInterface.removeColumn("EmployeeJobAssignments", "startLatitude");
    await queryInterface.removeColumn("EmployeeJobAssignments", "startLocationVerified");
    await queryInterface.removeColumn("EmployeeJobAssignments", "lastGuestNotLeftAt");
    await queryInterface.removeColumn("EmployeeJobAssignments", "guestNotLeftReportCount");
    await queryInterface.removeColumn("EmployeeJobAssignments", "guestNotLeftReported");

    // Remove indexes and drop GuestNotLeftReports table
    await queryInterface.removeIndex("GuestNotLeftReports", "idx_guest_not_left_resolved");
    await queryInterface.removeIndex("GuestNotLeftReports", "idx_guest_not_left_reporter");
    await queryInterface.removeIndex("GuestNotLeftReports", "idx_guest_not_left_appointment");
    await queryInterface.removeIndex("GuestNotLeftReports", "idx_guest_not_left_assignment");
    await queryInterface.dropTable("GuestNotLeftReports");
  },
};
