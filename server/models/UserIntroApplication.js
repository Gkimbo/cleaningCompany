module.exports = (sequelize, DataTypes) => {
  const UserApplications = sequelize.define("UserApplications", {
    id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      autoIncrement: true,
      primaryKey: true,
    },

    // Basic Information
    firstName: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    lastName: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    email: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    phone: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    dateOfBirth: {
      type: DataTypes.DATEONLY,
      allowNull: true,
    },

    // Address for background check verification
    streetAddress: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    city: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    state: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    zipCode: {
      type: DataTypes.STRING,
      allowNull: true,
    },

    // Identity verification
    ssnLast4: {
      type: DataTypes.STRING(4),
      allowNull: true,
    },
    driversLicenseNumber: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    driversLicenseState: {
      type: DataTypes.STRING,
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

    // Previous Employment
    previousEmployer: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    previousEmployerPhone: {
      type: DataTypes.STRING,
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

    // Emergency Contact
    emergencyContactName: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    emergencyContactPhone: {
      type: DataTypes.STRING,
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
      type: DataTypes.ENUM('pending', 'under_review', 'background_check', 'approved', 'rejected'),
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
  });

  return UserApplications;
};
