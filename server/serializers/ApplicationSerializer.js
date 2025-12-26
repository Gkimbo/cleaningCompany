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
    // Timestamps
    "createdAt",
    "updatedAt",
  ];

  static serializeOne(application) {
    const serialized = {};
    for (const attribute of this.allowedAttributes) {
      serialized[attribute] = application[attribute];
    }
    return serialized;
  }

  static serializeArray(applicationArray) {
    return applicationArray.map((application) => this.serializeOne(application));
  }
}

module.exports = ApplicationSerializer;
  
