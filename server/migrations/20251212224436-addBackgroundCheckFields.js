'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Add address fields for background check verification
    await queryInterface.addColumn("UserApplications", "streetAddress", {
      type: Sequelize.STRING,
      allowNull: true,
    });

    await queryInterface.addColumn("UserApplications", "city", {
      type: Sequelize.STRING,
      allowNull: true,
    });

    await queryInterface.addColumn("UserApplications", "state", {
      type: Sequelize.STRING,
      allowNull: true,
    });

    await queryInterface.addColumn("UserApplications", "zipCode", {
      type: Sequelize.STRING,
      allowNull: true,
    });

    // Date of birth for identity verification
    await queryInterface.addColumn("UserApplications", "dateOfBirth", {
      type: Sequelize.DATEONLY,
      allowNull: true,
    });

    // Social Security Number (last 4 digits for verification)
    await queryInterface.addColumn("UserApplications", "ssnLast4", {
      type: Sequelize.STRING(4),
      allowNull: true,
    });

    // Driver's license info
    await queryInterface.addColumn("UserApplications", "driversLicenseNumber", {
      type: Sequelize.STRING,
      allowNull: true,
    });

    await queryInterface.addColumn("UserApplications", "driversLicenseState", {
      type: Sequelize.STRING,
      allowNull: true,
    });

    // Transportation
    await queryInterface.addColumn("UserApplications", "hasReliableTransportation", {
      type: Sequelize.BOOLEAN,
      allowNull: true,
      defaultValue: false,
    });

    await queryInterface.addColumn("UserApplications", "hasValidDriversLicense", {
      type: Sequelize.BOOLEAN,
      allowNull: true,
      defaultValue: false,
    });

    // Work authorization
    await queryInterface.addColumn("UserApplications", "isAuthorizedToWork", {
      type: Sequelize.BOOLEAN,
      allowNull: true,
      defaultValue: false,
    });

    // Criminal history disclosure
    await queryInterface.addColumn("UserApplications", "hasCriminalHistory", {
      type: Sequelize.BOOLEAN,
      allowNull: true,
      defaultValue: false,
    });

    await queryInterface.addColumn("UserApplications", "criminalHistoryExplanation", {
      type: Sequelize.TEXT,
      allowNull: true,
    });

    // Professional References (stored as JSON)
    await queryInterface.addColumn("UserApplications", "references", {
      type: Sequelize.TEXT, // JSON string containing array of references
      allowNull: true,
    });

    // Emergency contact
    await queryInterface.addColumn("UserApplications", "emergencyContactName", {
      type: Sequelize.STRING,
      allowNull: true,
    });

    await queryInterface.addColumn("UserApplications", "emergencyContactPhone", {
      type: Sequelize.STRING,
      allowNull: true,
    });

    await queryInterface.addColumn("UserApplications", "emergencyContactRelation", {
      type: Sequelize.STRING,
      allowNull: true,
    });

    // Previous employment
    await queryInterface.addColumn("UserApplications", "previousEmployer", {
      type: Sequelize.STRING,
      allowNull: true,
    });

    await queryInterface.addColumn("UserApplications", "previousEmployerPhone", {
      type: Sequelize.STRING,
      allowNull: true,
    });

    await queryInterface.addColumn("UserApplications", "previousEmploymentDuration", {
      type: Sequelize.STRING,
      allowNull: true,
    });

    await queryInterface.addColumn("UserApplications", "reasonForLeaving", {
      type: Sequelize.TEXT,
      allowNull: true,
    });

    // Availability
    await queryInterface.addColumn("UserApplications", "availableStartDate", {
      type: Sequelize.DATEONLY,
      allowNull: true,
    });

    await queryInterface.addColumn("UserApplications", "availableDays", {
      type: Sequelize.STRING, // JSON string of available days
      allowNull: true,
    });

    // Additional consents
    await queryInterface.addColumn("UserApplications", "drugTestConsent", {
      type: Sequelize.BOOLEAN,
      allowNull: true,
      defaultValue: false,
    });

    await queryInterface.addColumn("UserApplications", "referenceCheckConsent", {
      type: Sequelize.BOOLEAN,
      allowNull: true,
      defaultValue: false,
    });

    // Application status for admin tracking
    await queryInterface.addColumn("UserApplications", "status", {
      type: Sequelize.ENUM('pending', 'under_review', 'background_check', 'approved', 'rejected'),
      allowNull: true,
      defaultValue: 'pending',
    });

    await queryInterface.addColumn("UserApplications", "adminNotes", {
      type: Sequelize.TEXT,
      allowNull: true,
    });

    await queryInterface.addColumn("UserApplications", "backgroundCheckStatus", {
      type: Sequelize.ENUM('not_started', 'in_progress', 'passed', 'failed'),
      allowNull: true,
      defaultValue: 'not_started',
    });

    await queryInterface.addColumn("UserApplications", "backgroundCheckDate", {
      type: Sequelize.DATE,
      allowNull: true,
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn("UserApplications", "streetAddress");
    await queryInterface.removeColumn("UserApplications", "city");
    await queryInterface.removeColumn("UserApplications", "state");
    await queryInterface.removeColumn("UserApplications", "zipCode");
    await queryInterface.removeColumn("UserApplications", "dateOfBirth");
    await queryInterface.removeColumn("UserApplications", "ssnLast4");
    await queryInterface.removeColumn("UserApplications", "driversLicenseNumber");
    await queryInterface.removeColumn("UserApplications", "driversLicenseState");
    await queryInterface.removeColumn("UserApplications", "hasReliableTransportation");
    await queryInterface.removeColumn("UserApplications", "hasValidDriversLicense");
    await queryInterface.removeColumn("UserApplications", "isAuthorizedToWork");
    await queryInterface.removeColumn("UserApplications", "hasCriminalHistory");
    await queryInterface.removeColumn("UserApplications", "criminalHistoryExplanation");
    await queryInterface.removeColumn("UserApplications", "references");
    await queryInterface.removeColumn("UserApplications", "emergencyContactName");
    await queryInterface.removeColumn("UserApplications", "emergencyContactPhone");
    await queryInterface.removeColumn("UserApplications", "emergencyContactRelation");
    await queryInterface.removeColumn("UserApplications", "previousEmployer");
    await queryInterface.removeColumn("UserApplications", "previousEmployerPhone");
    await queryInterface.removeColumn("UserApplications", "previousEmploymentDuration");
    await queryInterface.removeColumn("UserApplications", "reasonForLeaving");
    await queryInterface.removeColumn("UserApplications", "availableStartDate");
    await queryInterface.removeColumn("UserApplications", "availableDays");
    await queryInterface.removeColumn("UserApplications", "drugTestConsent");
    await queryInterface.removeColumn("UserApplications", "referenceCheckConsent");
    await queryInterface.removeColumn("UserApplications", "status");
    await queryInterface.removeColumn("UserApplications", "adminNotes");
    await queryInterface.removeColumn("UserApplications", "backgroundCheckStatus");
    await queryInterface.removeColumn("UserApplications", "backgroundCheckDate");
  },
};
