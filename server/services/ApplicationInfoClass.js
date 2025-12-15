const { UserApplications } = require("../models");

class ApplicationInfoClass {
  static async addApplicationToDB({
    // Basic Information
    firstName,
    lastName,
    email,
    phone,
    dateOfBirth,
    // Address
    streetAddress,
    city,
    state,
    zipCode,
    // Identity Verification
    ssnLast4,
    driversLicenseNumber,
    driversLicenseState,
    idPhoto,
    // Work Eligibility
    isAuthorizedToWork,
    hasValidDriversLicense,
    hasReliableTransportation,
    // Experience
    experience,
    // Previous Employment
    previousEmployer,
    previousEmployerPhone,
    previousEmploymentDuration,
    reasonForLeaving,
    // References
    references,
    // Criminal History
    hasCriminalHistory,
    criminalHistoryExplanation,
    // Emergency Contact
    emergencyContactName,
    emergencyContactPhone,
    emergencyContactRelation,
    // Availability
    availableStartDate,
    availableDays,
    // Personal Statement
    message,
    // Consents
    backgroundConsent,
    drugTestConsent,
    referenceCheckConsent,
  }) {
    // Create a new record in the database
    const application = await UserApplications.create({
      firstName,
      lastName,
      email,
      phone,
      dateOfBirth,
      streetAddress,
      city,
      state,
      zipCode,
      ssnLast4,
      driversLicenseNumber,
      driversLicenseState,
      idPhoto,
      isAuthorizedToWork,
      hasValidDriversLicense,
      hasReliableTransportation,
      experience,
      previousEmployer,
      previousEmployerPhone,
      previousEmploymentDuration,
      reasonForLeaving,
      references,
      hasCriminalHistory,
      criminalHistoryExplanation,
      emergencyContactName,
      emergencyContactPhone,
      emergencyContactRelation,
      availableStartDate,
      availableDays,
      message,
      backgroundConsent,
      drugTestConsent,
      referenceCheckConsent,
    });

    return application;
  }
}

module.exports = ApplicationInfoClass;
