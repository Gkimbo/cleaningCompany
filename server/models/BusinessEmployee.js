const EncryptionService = require("../services/EncryptionService");

// Fields that contain PII and should be encrypted
const PII_FIELDS = ["firstName", "lastName", "email", "phone"];

module.exports = (sequelize, DataTypes) => {
  const BusinessEmployee = sequelize.define("BusinessEmployee", {
    id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      autoIncrement: true,
      primaryKey: true,
    },
    businessOwnerId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      comment: "The business owner who employs this person",
    },
    userId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      comment: "Linked user account (null until invite accepted)",
    },
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
      allowNull: true,
    },
    status: {
      type: DataTypes.STRING(20),
      allowNull: false,
      defaultValue: "pending_invite",
      comment: "pending_invite, active, inactive, terminated",
    },
    inviteToken: {
      type: DataTypes.STRING,
      allowNull: true,
      unique: true,
    },
    inviteExpiresAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    invitedAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    acceptedAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    terminatedAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    terminationReason: {
      type: DataTypes.TEXT,
      allowNull: true,
    },

    // Pay Configuration
    payType: {
      type: DataTypes.STRING(20),
      allowNull: false,
      defaultValue: "hourly",
      validate: {
        isIn: [["hourly", "per_job", "percentage"]],
      },
      comment: "Type of pay: hourly, per_job (flat rate), or percentage",
    },
    defaultHourlyRate: {
      type: DataTypes.INTEGER,
      allowNull: true,
      comment: "Default hourly rate in cents (used when payType is hourly)",
    },
    defaultJobRate: {
      type: DataTypes.INTEGER,
      allowNull: true,
      comment: "Default flat rate per job in cents (used when payType is per_job)",
    },
    payRate: {
      type: DataTypes.DECIMAL(5, 2),
      allowNull: true,
      comment: "Percentage of job price (used when payType is percentage)",
    },
    paymentMethod: {
      type: DataTypes.STRING(20),
      allowNull: false,
      defaultValue: "direct_payment",
      comment: "stripe_connect or direct_payment",
    },
    stripeConnectAccountId: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    stripeConnectOnboarded: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },

    // Permissions
    canViewClientDetails: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },
    canViewJobEarnings: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    canMessageClients: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },

    // Metadata
    notes: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: "Private notes from business owner about employee",
    },

    // Availability Scheduling
    availableSchedule: {
      type: DataTypes.JSON,
      allowNull: true,
      defaultValue: null,
      comment: "JSON object with per-day availability (day -> {available, start, end})",
    },
    defaultJobTypes: {
      type: DataTypes.JSON,
      allowNull: true,
      defaultValue: null,
      comment: "JSON array of job types employee can be assigned to",
    },
    maxJobsPerDay: {
      type: DataTypes.INTEGER,
      allowNull: true,
      defaultValue: null,
      comment: "Maximum number of jobs this employee can have per day",
    },
  });

  // Helper function to encrypt PII fields
  const encryptPIIFields = (employee) => {
    PII_FIELDS.forEach((field) => {
      if (employee[field] !== undefined && employee[field] !== null) {
        const value = String(employee[field]);
        // Only encrypt if not already encrypted
        if (!value.includes(":") || value.split(":").length !== 2) {
          employee[field] = EncryptionService.encrypt(value);
        }
      }
    });

    // Generate email hash for searching
    if (employee.email && employee.changed && employee.changed("email")) {
      const originalEmail = employee._previousDataValues?.email
        ? EncryptionService.decrypt(employee._previousDataValues.email)
        : employee.email;
      const emailToHash = originalEmail.includes(":")
        ? EncryptionService.decrypt(originalEmail)
        : originalEmail;
      employee.emailHash = EncryptionService.hash(emailToHash);
    } else if (employee.email && !employee.emailHash) {
      const emailToHash = employee.email.includes(":")
        ? EncryptionService.decrypt(employee.email)
        : employee.email;
      employee.emailHash = EncryptionService.hash(emailToHash);
    }
  };

  // Helper function to decrypt PII fields
  const decryptPIIFields = (employee) => {
    if (!employee) return;

    PII_FIELDS.forEach((field) => {
      if (employee.dataValues && employee.dataValues[field]) {
        employee.dataValues[field] = EncryptionService.decrypt(
          employee.dataValues[field]
        );
      }
    });
  };

  // Encrypt PII before create
  BusinessEmployee.beforeCreate((employee) => {
    encryptPIIFields(employee);
  });

  // Encrypt PII before update
  BusinessEmployee.beforeUpdate((employee) => {
    encryptPIIFields(employee);
  });

  // Decrypt after finding
  BusinessEmployee.afterFind((result) => {
    if (!result) return;

    if (Array.isArray(result)) {
      result.forEach((employee) => decryptPIIFields(employee));
    } else {
      decryptPIIFields(result);
    }
  });

  // Instance methods
  BusinessEmployee.prototype.isActive = function () {
    return this.status === "active";
  };

  BusinessEmployee.prototype.canAcceptJobs = function () {
    return this.status === "active" && this.userId !== null;
  };

  BusinessEmployee.prototype.getFullName = function () {
    return `${this.firstName} ${this.lastName}`;
  };

  // Check if employee is available on a specific day and time
  BusinessEmployee.prototype.isAvailableOn = function (dayOfWeek, startTime) {
    if (!this.availableSchedule) return true; // No restrictions set

    const daySchedule = this.availableSchedule[dayOfWeek.toLowerCase()];
    if (!daySchedule) return true; // Day not in schedule, assume available
    if (!daySchedule.available) return false;

    if (startTime && daySchedule.start && daySchedule.end) {
      // Check if job time falls within available hours
      const jobTime = startTime.split(":").map(Number);
      const schedStart = daySchedule.start.split(":").map(Number);
      const schedEnd = daySchedule.end.split(":").map(Number);

      const jobMinutes = jobTime[0] * 60 + (jobTime[1] || 0);
      const startMinutes = schedStart[0] * 60 + (schedStart[1] || 0);
      const endMinutes = schedEnd[0] * 60 + (schedEnd[1] || 0);

      return jobMinutes >= startMinutes && jobMinutes <= endMinutes;
    }
    return daySchedule.available;
  };

  // Check if employee can handle a specific job type
  BusinessEmployee.prototype.canHandleJobType = function (jobType) {
    if (!this.defaultJobTypes || this.defaultJobTypes.length === 0) return true;
    return this.defaultJobTypes.includes(jobType);
  };

  BusinessEmployee.associate = (models) => {
    BusinessEmployee.belongsTo(models.User, {
      foreignKey: "businessOwnerId",
      as: "businessOwner",
    });
    BusinessEmployee.belongsTo(models.User, {
      foreignKey: "userId",
      as: "user",
    });
    BusinessEmployee.hasMany(models.EmployeeJobAssignment, {
      foreignKey: "businessEmployeeId",
      as: "jobAssignments",
    });
  };

  return BusinessEmployee;
};
