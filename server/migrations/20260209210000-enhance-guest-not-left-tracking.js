"use strict";

/**
 * Migration: Enhance Guest Not Left Tracking
 *
 * Adds fields to support the full tenant-present workflow:
 * - GuestNotLeftReport: homeowner response, cleaner actions, GPS verification
 * - User: tenant present report tracking for cleaners
 * - UserHomes: tenant present incident tracking per home
 */

module.exports = {
  async up(queryInterface, Sequelize) {
    // === GuestNotLeftReport enhancements ===
    await queryInterface.addColumn("GuestNotLeftReports", "homeownerNotifiedAt", {
      type: Sequelize.DATE,
      allowNull: true,
      comment: "When homeowner was notified of tenant present",
    });

    await queryInterface.addColumn("GuestNotLeftReports", "homeownerResponseAt", {
      type: Sequelize.DATE,
      allowNull: true,
      comment: "When homeowner responded",
    });

    await queryInterface.addColumn("GuestNotLeftReports", "homeownerResponse", {
      type: Sequelize.ENUM("resolved", "need_time", "cannot_resolve", "no_response"),
      allowNull: true,
      comment: "Homeowner's response to tenant present report",
    });

    await queryInterface.addColumn("GuestNotLeftReports", "homeownerResponseNote", {
      type: Sequelize.TEXT,
      allowNull: true,
      comment: "Optional note from homeowner",
    });

    await queryInterface.addColumn("GuestNotLeftReports", "additionalTimeRequested", {
      type: Sequelize.INTEGER,
      allowNull: true,
      comment: "Minutes of additional time requested by homeowner",
    });

    await queryInterface.addColumn("GuestNotLeftReports", "cleanerAction", {
      type: Sequelize.ENUM("waiting", "will_return", "cancelled", "proceeded"),
      allowNull: true,
      comment: "Cleaner's chosen action after report",
    });

    await queryInterface.addColumn("GuestNotLeftReports", "cleanerActionAt", {
      type: Sequelize.DATE,
      allowNull: true,
      comment: "When cleaner chose their action",
    });

    await queryInterface.addColumn("GuestNotLeftReports", "scheduledReturnTime", {
      type: Sequelize.DATE,
      allowNull: true,
      comment: "When cleaner plans to return (if will_return)",
    });

    await queryInterface.addColumn("GuestNotLeftReports", "actualReturnTime", {
      type: Sequelize.DATE,
      allowNull: true,
      comment: "When cleaner actually returned",
    });

    await queryInterface.addColumn("GuestNotLeftReports", "cleanerReturnedGpsLat", {
      type: Sequelize.DECIMAL(10, 8),
      allowNull: true,
      comment: "GPS latitude when cleaner returned",
    });

    await queryInterface.addColumn("GuestNotLeftReports", "cleanerReturnedGpsLng", {
      type: Sequelize.DECIMAL(11, 8),
      allowNull: true,
      comment: "GPS longitude when cleaner returned",
    });

    await queryInterface.addColumn("GuestNotLeftReports", "responseDeadline", {
      type: Sequelize.DATE,
      allowNull: true,
      comment: "Deadline for homeowner response (30 min from report)",
    });

    await queryInterface.addColumn("GuestNotLeftReports", "timeWindowEnd", {
      type: Sequelize.DATE,
      allowNull: true,
      comment: "End of appointment time window",
    });

    await queryInterface.addColumn("GuestNotLeftReports", "gpsVerifiedOnSite", {
      type: Sequelize.BOOLEAN,
      allowNull: true,
      defaultValue: null,
      comment: "Whether GPS verified cleaner was at property",
    });

    // Update resolution enum to include new values
    // First, we need to handle the existing enum
    await queryInterface.sequelize.query(`
      ALTER TABLE "GuestNotLeftReports"
      ALTER COLUMN "resolution" TYPE VARCHAR(50);
    `);

    // === User tracking fields for cleaners ===
    await queryInterface.addColumn("Users", "tenantPresentReportCount", {
      type: Sequelize.INTEGER,
      allowNull: false,
      defaultValue: 0,
      comment: "Total tenant present reports by this cleaner",
    });

    await queryInterface.addColumn("Users", "tenantPresentNoCleanCount", {
      type: Sequelize.INTEGER,
      allowNull: false,
      defaultValue: 0,
      comment: "Tenant present reports that ended without cleaning",
    });

    await queryInterface.addColumn("Users", "lastTenantPresentReportAt", {
      type: Sequelize.DATE,
      allowNull: true,
      comment: "When cleaner last reported tenant present",
    });

    await queryInterface.addColumn("Users", "tenantReportScrutinyLevel", {
      type: Sequelize.ENUM("none", "watch", "high_risk"),
      allowNull: false,
      defaultValue: "none",
      comment: "Scrutiny level for tenant present reports",
    });

    // === UserHomes tracking fields ===
    await queryInterface.addColumn("UserHomes", "tenantPresentIncidentCount", {
      type: Sequelize.INTEGER,
      allowNull: false,
      defaultValue: 0,
      comment: "Number of tenant present incidents at this home",
    });

    await queryInterface.addColumn("UserHomes", "lastTenantPresentIncidentAt", {
      type: Sequelize.DATE,
      allowNull: true,
      comment: "When last tenant present incident occurred",
    });

    // === UserAppointments - add reviewsBlocked and cancellationCategory fields ===
    await queryInterface.addColumn("UserAppointments", "reviewsBlocked", {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      comment: "Whether reviews are blocked (e.g., tenant present cancellation)",
    });

    await queryInterface.addColumn("UserAppointments", "cancellationCategory", {
      type: Sequelize.STRING(50),
      allowNull: true,
      comment: "Category: tenant_present, emergency, weather, etc.",
    });

    // Add indexes for common queries
    await queryInterface.addIndex("GuestNotLeftReports", ["homeownerResponse"], {
      name: "idx_guest_not_left_homeowner_response",
    });

    await queryInterface.addIndex("GuestNotLeftReports", ["cleanerAction"], {
      name: "idx_guest_not_left_cleaner_action",
    });

    await queryInterface.addIndex("GuestNotLeftReports", ["responseDeadline"], {
      name: "idx_guest_not_left_response_deadline",
    });

    await queryInterface.addIndex("Users", ["tenantReportScrutinyLevel"], {
      name: "idx_users_tenant_report_scrutiny",
    });
  },

  async down(queryInterface, Sequelize) {
    // Remove indexes
    await queryInterface.removeIndex("Users", "idx_users_tenant_report_scrutiny");
    await queryInterface.removeIndex("GuestNotLeftReports", "idx_guest_not_left_response_deadline");
    await queryInterface.removeIndex("GuestNotLeftReports", "idx_guest_not_left_cleaner_action");
    await queryInterface.removeIndex("GuestNotLeftReports", "idx_guest_not_left_homeowner_response");

    // Remove UserAppointments columns
    await queryInterface.removeColumn("UserAppointments", "cancellationCategory");
    await queryInterface.removeColumn("UserAppointments", "reviewsBlocked");

    // Remove UserHomes columns
    await queryInterface.removeColumn("UserHomes", "lastTenantPresentIncidentAt");
    await queryInterface.removeColumn("UserHomes", "tenantPresentIncidentCount");

    // Remove User columns
    await queryInterface.removeColumn("Users", "tenantReportScrutinyLevel");
    await queryInterface.removeColumn("Users", "lastTenantPresentReportAt");
    await queryInterface.removeColumn("Users", "tenantPresentNoCleanCount");
    await queryInterface.removeColumn("Users", "tenantPresentReportCount");

    // Remove GuestNotLeftReports columns
    await queryInterface.removeColumn("GuestNotLeftReports", "gpsVerifiedOnSite");
    await queryInterface.removeColumn("GuestNotLeftReports", "timeWindowEnd");
    await queryInterface.removeColumn("GuestNotLeftReports", "responseDeadline");
    await queryInterface.removeColumn("GuestNotLeftReports", "cleanerReturnedGpsLng");
    await queryInterface.removeColumn("GuestNotLeftReports", "cleanerReturnedGpsLat");
    await queryInterface.removeColumn("GuestNotLeftReports", "actualReturnTime");
    await queryInterface.removeColumn("GuestNotLeftReports", "scheduledReturnTime");
    await queryInterface.removeColumn("GuestNotLeftReports", "cleanerActionAt");
    await queryInterface.removeColumn("GuestNotLeftReports", "cleanerAction");
    await queryInterface.removeColumn("GuestNotLeftReports", "additionalTimeRequested");
    await queryInterface.removeColumn("GuestNotLeftReports", "homeownerResponseNote");
    await queryInterface.removeColumn("GuestNotLeftReports", "homeownerResponse");
    await queryInterface.removeColumn("GuestNotLeftReports", "homeownerResponseAt");
    await queryInterface.removeColumn("GuestNotLeftReports", "homeownerNotifiedAt");

    // Remove enums
    await queryInterface.sequelize.query(`
      DROP TYPE IF EXISTS "enum_Users_tenantReportScrutinyLevel";
    `);
    await queryInterface.sequelize.query(`
      DROP TYPE IF EXISTS "enum_GuestNotLeftReports_cleanerAction";
    `);
    await queryInterface.sequelize.query(`
      DROP TYPE IF EXISTS "enum_GuestNotLeftReports_homeownerResponse";
    `);
  },
};
