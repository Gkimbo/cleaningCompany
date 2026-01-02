const { UserApplications } = require("../models");

// Helper to convert date strings to ISO format (YYYY-MM-DD) for DATEONLY fields
const parseToISODate = (dateString) => {
  if (!dateString) return null;

  // If already in ISO format (YYYY-MM-DD), return as-is
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
    return dateString;
  }

  // Handle MM/DD/YYYY format
  const match = dateString.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (match) {
    const [, month, day, year] = match;
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  }

  // Fallback: try to parse with Date and extract ISO date
  const parsed = new Date(dateString);
  if (!isNaN(parsed.getTime())) {
    return parsed.toISOString().split('T')[0];
  }

  return null;
};

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
    // Referral
    referralCode,
  }) {
    // Create a new record in the database
    const application = await UserApplications.create({
      firstName,
      lastName,
      email,
      phone,
      dateOfBirth: parseToISODate(dateOfBirth),
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
      availableStartDate: parseToISODate(availableStartDate),
      availableDays,
      message,
      backgroundConsent,
      drugTestConsent,
      referenceCheckConsent,
      referralCode,
    });

    return application;
  }
}

module.exports = ApplicationInfoClass;
