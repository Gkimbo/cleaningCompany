"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  up: async (queryInterface, Sequelize) => {
    // =========================================================================
    // Add completion confirmation fields to UserAppointments (single-cleaner)
    // =========================================================================

    // Completion status enum
    await queryInterface.addColumn("UserAppointments", "completionStatus", {
      type: Sequelize.ENUM("in_progress", "submitted", "approved", "auto_approved"),
      allowNull: false,
      defaultValue: "in_progress",
      comment: "2-step completion status: in_progress -> submitted -> approved/auto_approved",
    });

    // When cleaner submitted completion (Step 1)
    await queryInterface.addColumn("UserAppointments", "completionSubmittedAt", {
      type: Sequelize.DATE,
      allowNull: true,
      comment: "When cleaner marked job complete and submitted checklist",
    });

    // Checklist data snapshot at submission
    await queryInterface.addColumn("UserAppointments", "completionChecklistData", {
      type: Sequelize.JSONB,
      allowNull: true,
      comment: "Checklist progress data submitted by cleaner",
    });

    // Optional notes from cleaner
    await queryInterface.addColumn("UserAppointments", "completionNotes", {
      type: Sequelize.TEXT,
      allowNull: true,
      comment: "Optional notes from cleaner about the cleaning",
    });

    // When approval happens (Step 2)
    await queryInterface.addColumn("UserAppointments", "completionApprovedAt", {
      type: Sequelize.DATE,
      allowNull: true,
      comment: "When completion was approved (manually or auto)",
    });

    // Who approved (null = auto-approved by system)
    await queryInterface.addColumn("UserAppointments", "completionApprovedBy", {
      type: Sequelize.INTEGER,
      allowNull: true,
      comment: "User ID who approved, null if auto-approved by system",
    });

    // Auto-approval deadline
    await queryInterface.addColumn("UserAppointments", "autoApprovalExpiresAt", {
      type: Sequelize.DATE,
      allowNull: true,
      comment: "When auto-approval will trigger if homeowner doesn't respond",
    });

    // Flag if homeowner raised concerns (triggers review prompt)
    await queryInterface.addColumn("UserAppointments", "homeownerFeedbackRequired", {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      comment: "True if homeowner selected 'doesn't look good' - review required",
    });

    // =========================================================================
    // Add completion confirmation fields to CleanerJobCompletions (multi-cleaner)
    // =========================================================================

    // Completion status enum for per-cleaner tracking
    await queryInterface.addColumn("CleanerJobCompletions", "completionStatus", {
      type: Sequelize.ENUM("in_progress", "submitted", "approved", "auto_approved"),
      allowNull: false,
      defaultValue: "in_progress",
      comment: "Per-cleaner 2-step completion status",
    });

    // When this cleaner submitted completion
    await queryInterface.addColumn("CleanerJobCompletions", "completionSubmittedAt", {
      type: Sequelize.DATE,
      allowNull: true,
      comment: "When this cleaner submitted their completion",
    });

    // Optional notes from this cleaner
    await queryInterface.addColumn("CleanerJobCompletions", "completionNotes", {
      type: Sequelize.TEXT,
      allowNull: true,
      comment: "Optional notes from this cleaner",
    });

    // When this cleaner's work was approved
    await queryInterface.addColumn("CleanerJobCompletions", "completionApprovedAt", {
      type: Sequelize.DATE,
      allowNull: true,
      comment: "When this cleaner's completion was approved",
    });

    // Who approved this cleaner's work
    await queryInterface.addColumn("CleanerJobCompletions", "completionApprovedBy", {
      type: Sequelize.INTEGER,
      allowNull: true,
      comment: "User ID who approved this cleaner, null if auto-approved",
    });

    // Auto-approval deadline for this cleaner
    await queryInterface.addColumn("CleanerJobCompletions", "autoApprovalExpiresAt", {
      type: Sequelize.DATE,
      allowNull: true,
      comment: "When auto-approval will trigger for this cleaner",
    });

    // Flag if homeowner raised concerns about this cleaner
    await queryInterface.addColumn("CleanerJobCompletions", "homeownerFeedbackRequired", {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      comment: "True if homeowner raised concerns about this cleaner's work",
    });

    // =========================================================================
    // Add owner settings to PricingConfig
    // =========================================================================

    await queryInterface.addColumn("PricingConfigs", "completionAutoApprovalHours", {
      type: Sequelize.INTEGER,
      allowNull: false,
      defaultValue: 4,
      comment: "Hours before auto-approval triggers (configurable by owners)",
    });

    await queryInterface.addColumn("PricingConfigs", "completionRequiresPhotos", {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      comment: "Whether photos are required for completion submission",
    });

    // =========================================================================
    // Add indexes for efficient queries
    // =========================================================================

    // Index for finding pending approvals (single-cleaner)
    await queryInterface.addIndex("UserAppointments", ["completionStatus"], {
      name: "idx_appointments_completion_status",
    });

    await queryInterface.addIndex("UserAppointments", ["autoApprovalExpiresAt"], {
      name: "idx_appointments_auto_approval_expires",
    });

    // Index for finding pending approvals (multi-cleaner)
    await queryInterface.addIndex("CleanerJobCompletions", ["completionStatus"], {
      name: "idx_cleaner_completions_completion_status",
    });

    await queryInterface.addIndex("CleanerJobCompletions", ["autoApprovalExpiresAt"], {
      name: "idx_cleaner_completions_auto_approval_expires",
    });
  },

  down: async (queryInterface, Sequelize) => {
    // Remove indexes
    await queryInterface.removeIndex("UserAppointments", "idx_appointments_completion_status");
    await queryInterface.removeIndex("UserAppointments", "idx_appointments_auto_approval_expires");
    await queryInterface.removeIndex("CleanerJobCompletions", "idx_cleaner_completions_completion_status");
    await queryInterface.removeIndex("CleanerJobCompletions", "idx_cleaner_completions_auto_approval_expires");

    // Remove PricingConfig columns
    await queryInterface.removeColumn("PricingConfigs", "completionRequiresPhotos");
    await queryInterface.removeColumn("PricingConfigs", "completionAutoApprovalHours");

    // Remove CleanerJobCompletions columns
    await queryInterface.removeColumn("CleanerJobCompletions", "homeownerFeedbackRequired");
    await queryInterface.removeColumn("CleanerJobCompletions", "autoApprovalExpiresAt");
    await queryInterface.removeColumn("CleanerJobCompletions", "completionApprovedBy");
    await queryInterface.removeColumn("CleanerJobCompletions", "completionApprovedAt");
    await queryInterface.removeColumn("CleanerJobCompletions", "completionNotes");
    await queryInterface.removeColumn("CleanerJobCompletions", "completionSubmittedAt");
    await queryInterface.removeColumn("CleanerJobCompletions", "completionStatus");

    // Remove UserAppointments columns
    await queryInterface.removeColumn("UserAppointments", "homeownerFeedbackRequired");
    await queryInterface.removeColumn("UserAppointments", "autoApprovalExpiresAt");
    await queryInterface.removeColumn("UserAppointments", "completionApprovedBy");
    await queryInterface.removeColumn("UserAppointments", "completionApprovedAt");
    await queryInterface.removeColumn("UserAppointments", "completionNotes");
    await queryInterface.removeColumn("UserAppointments", "completionChecklistData");
    await queryInterface.removeColumn("UserAppointments", "completionSubmittedAt");
    await queryInterface.removeColumn("UserAppointments", "completionStatus");

    // Remove ENUM types
    await queryInterface.sequelize.query(
      'DROP TYPE IF EXISTS "enum_UserAppointments_completionStatus";'
    );
    await queryInterface.sequelize.query(
      'DROP TYPE IF EXISTS "enum_CleanerJobCompletions_completionStatus";'
    );
  },
};
