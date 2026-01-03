const EncryptionService = require("../services/EncryptionService");

class ApplicationSerializer {
  static allowedAttributes = [
    // Basic Information
    "id",
    "firstName",
    "lastName",
    "email",
    "phone",
    "dateOfBirth",
    // Address
    "streetAddress",
    "city",
    "state",
    "zipCode",
    // Identity Verification
    "ssnLast4",
    "driversLicenseNumber",
    "driversLicenseState",
    "idPhoto",
    // Work Eligibility
    "isAuthorizedToWork",
    "hasValidDriversLicense",
    "hasReliableTransportation",
    // Experience
    "experience",
    // Previous Employment
    "previousEmployer",
    "previousEmployerPhone",
    "previousEmploymentDuration",
    "reasonForLeaving",
    // References
    "references",
    // Criminal History
    "hasCriminalHistory",
    "criminalHistoryExplanation",
    // Emergency Contact
    "emergencyContactName",
    "emergencyContactPhone",
    "emergencyContactRelation",
    // Availability
    "availableStartDate",
    "availableDays",
    // Personal Statement
    "message",
    // Consents
    "backgroundConsent",
    "drugTestConsent",
    "referenceCheckConsent",
    // Admin fields
    "status",
    "adminNotes",
    "backgroundCheckStatus",
    "backgroundCheckDate",
    // Review tracking
    "userId",
    "reviewedBy",
    "reviewedAt",
    "rejectionReason",
    // Referral
    "referralCode",
    // Timestamps
    "createdAt",
    "updatedAt",
  ];

  // Fields that are encrypted in the database
  static encryptedFields = [
    "firstName",
    "lastName",
    "email",
    "phone",
    "streetAddress",
    "city",
    "state",
    "zipCode",
    "ssnLast4",
    "driversLicenseNumber",
    "driversLicenseState",
    "idPhoto",
    "previousEmployer",
    "previousEmployerPhone",
    "emergencyContactName",
    "emergencyContactPhone",
  ];

  static getValue(application, attribute) {
    const value = application[attribute];
    // EncryptionService.decrypt() safely handles both encrypted and unencrypted data
    if (this.encryptedFields.includes(attribute) && value) {
      return EncryptionService.decrypt(value);
    }
    return value;
  }

  static serializeOne(application) {
    const serialized = {};
    for (const attribute of this.allowedAttributes) {
      serialized[attribute] = this.getValue(application, attribute);
    }
    return serialized;
  }

  static serializeArray(applicationArray) {
    return applicationArray.map((application) => this.serializeOne(application));
  }
}

module.exports = ApplicationSerializer;
  
