const EncryptionService = require("../services/EncryptionService");

// Fields that contain PII and should be encrypted
const PII_FIELDS = [
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

module.exports = (sequelize, DataTypes) => {
  const UserApplications = sequelize.define("UserApplications", {
    id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      autoIncrement: true,
      primaryKey: true,
    },

    // Basic Information (encrypted)
    firstName: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    lastName: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    email: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    emailHash: {
      type: DataTypes.STRING,
      allowNull: true,
      comment: "Hash of email for searching (since email is encrypted)",
    },
    phone: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    dateOfBirth: {
      type: DataTypes.DATEONLY,
      allowNull: true,
    },

    // Address for background check verification (encrypted)
    streetAddress: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    city: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    state: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    zipCode: {
      type: DataTypes.TEXT,
      allowNull: true,
    },

    // Identity verification (encrypted)
    ssnLast4: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    driversLicenseNumber: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    driversLicenseState: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    idPhoto: {
      type: DataTypes.TEXT,
      allowNull: false,
    },

    // Work eligibility
    isAuthorizedToWork: {
      type: DataTypes.BOOLEAN,
      allowNull: true,
      defaultValue: false,
    },
    hasValidDriversLicense: {
      type: DataTypes.BOOLEAN,
      allowNull: true,
      defaultValue: false,
    },
    hasReliableTransportation: {
      type: DataTypes.BOOLEAN,
      allowNull: true,
      defaultValue: false,
    },

    // Experience
    experience: {
      type: DataTypes.STRING,
      allowNull: false,
    },

    // Previous Employment (encrypted)
    previousEmployer: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    previousEmployerPhone: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    previousEmploymentDuration: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    reasonForLeaving: {
      type: DataTypes.TEXT,
      allowNull: true,
    },

    // Professional References (JSON string array)
    // Format: [{ name, phone, relationship, company, yearsKnown }]
    references: {
      type: DataTypes.TEXT,
      allowNull: true,
      get() {
        const rawValue = this.getDataValue('references');
        return rawValue ? JSON.parse(rawValue) : [];
      },
      set(value) {
        this.setDataValue('references', JSON.stringify(value));
      },
    },

    // Criminal history disclosure
    hasCriminalHistory: {
      type: DataTypes.BOOLEAN,
      allowNull: true,
      defaultValue: false,
    },
    criminalHistoryExplanation: {
      type: DataTypes.TEXT,
      allowNull: true,
    },

    // Emergency Contact (encrypted)
    emergencyContactName: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    emergencyContactPhone: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    emergencyContactRelation: {
      type: DataTypes.STRING,
      allowNull: true,
    },

    // Availability
    availableStartDate: {
      type: DataTypes.DATEONLY,
      allowNull: true,
    },
    availableDays: {
      type: DataTypes.STRING,
      allowNull: true,
      get() {
        const rawValue = this.getDataValue('availableDays');
        return rawValue ? JSON.parse(rawValue) : [];
      },
      set(value) {
        this.setDataValue('availableDays', JSON.stringify(value));
      },
    },

    // Personal statement
    message: {
      type: DataTypes.TEXT,
      allowNull: false,
    },

    // Consents
    backgroundConsent: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    drugTestConsent: {
      type: DataTypes.BOOLEAN,
      allowNull: true,
      defaultValue: false,
    },
    referenceCheckConsent: {
      type: DataTypes.BOOLEAN,
      allowNull: true,
      defaultValue: false,
    },

    // Application Status (for admin)
    status: {
      type: DataTypes.ENUM('pending', 'under_review', 'background_check', 'approved', 'rejected', 'hired'),
      allowNull: true,
      defaultValue: 'pending',
    },
    adminNotes: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    backgroundCheckStatus: {
      type: DataTypes.ENUM('not_started', 'in_progress', 'passed', 'failed'),
      allowNull: true,
      defaultValue: 'not_started',
    },
    backgroundCheckDate: {
      type: DataTypes.DATE,
      allowNull: true,
    },

    // Review tracking - links to created user account on approval
    userId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: "Users",
        key: "id",
      },
    },

    // Who reviewed the application (owner or HR)
    reviewedBy: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: "Users",
        key: "id",
      },
    },

    // When the application was approved/rejected
    reviewedAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },

    // Reason for rejection (optional)
    rejectionReason: {
      type: DataTypes.TEXT,
      allowNull: true,
    },

    // Referral code used during application
    referralCode: {
      type: DataTypes.STRING,
      allowNull: true,
    },
  });

  // Helper function to encrypt PII fields
  const encryptPIIFields = (application) => {
    PII_FIELDS.forEach((field) => {
      if (application[field] !== undefined && application[field] !== null) {
        const value = String(application[field]);
        // Only encrypt if not already encrypted
        if (!value.includes(":") || value.split(":").length !== 2) {
          application[field] = EncryptionService.encrypt(value);
        }
      }
    });

    // Generate email hash for searching
    if (application.email && !application.emailHash) {
      const emailToHash = application.email.includes(":")
        ? EncryptionService.decrypt(application.email)
        : application.email;
      application.emailHash = EncryptionService.hash(emailToHash);
    }
  };

  // Helper function to decrypt PII fields
  const decryptPIIFields = (application) => {
    if (!application) return;

    PII_FIELDS.forEach((field) => {
      if (application.dataValues && application.dataValues[field]) {
        application.dataValues[field] = EncryptionService.decrypt(application.dataValues[field]);
      }
    });
  };

  // Encrypt before creating
  UserApplications.beforeCreate((application) => {
    encryptPIIFields(application);
  });

  // Encrypt before updating
  UserApplications.beforeUpdate((application) => {
    encryptPIIFields(application);
  });

  // Decrypt after finding
  UserApplications.afterFind((result) => {
    if (!result) return;

    if (Array.isArray(result)) {
      result.forEach((application) => decryptPIIFields(application));
    } else {
      decryptPIIFields(result);
    }
  });

  return UserApplications;
};
