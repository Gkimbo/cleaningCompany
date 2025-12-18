class ApplicationSerializer {
  static serializeArray(applicationArray) {
    const allowedAttributes = [
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

    const serializedApplications = applicationArray.map((application) => {
      const newApplication = {};
      for (const attribute of allowedAttributes) {
        newApplication[attribute] = application[attribute];
      }
      return newApplication;
    });

    return serializedApplications;
  }
}

module.exports = ApplicationSerializer;
  
