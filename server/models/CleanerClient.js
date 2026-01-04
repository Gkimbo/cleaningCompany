const EncryptionService = require("../services/EncryptionService");

// Fields that contain PII and should be encrypted
const PII_FIELDS = ["invitedEmail", "invitedName", "invitedPhone", "invitedAddress"];

module.exports = (sequelize, DataTypes) => {
  const CleanerClient = sequelize.define("CleanerClient", {
    id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      autoIncrement: true,
      primaryKey: true,
    },

    // === Relationships ===
    cleanerId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    clientId: {
      type: DataTypes.INTEGER,
      allowNull: true, // null until client accepts invitation
    },
    homeId: {
      type: DataTypes.INTEGER,
      allowNull: true, // null until client accepts and home is created
    },

    // === Invitation data (encrypted) ===
    inviteToken: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
    },
    invitedEmail: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    invitedName: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    invitedPhone: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    invitedAddress: {
      type: DataTypes.TEXT, // JSON stored as encrypted text
      allowNull: true,
    },
    invitedBeds: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    invitedBaths: {
      type: DataTypes.DECIMAL(3, 1),
      allowNull: true,
    },
    invitedNotes: {
      type: DataTypes.TEXT,
      allowNull: true,
    },

    // === Relationship status ===
    status: {
      type: DataTypes.ENUM("pending_invite", "active", "inactive", "declined", "cancelled"),
      allowNull: false,
      defaultValue: "pending_invite",
    },
    invitedAt: {
      type: DataTypes.DATE,
      allowNull: false,
    },
    acceptedAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    lastInviteReminderAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },

    // === Scheduling preferences ===
    defaultFrequency: {
      type: DataTypes.ENUM("weekly", "biweekly", "monthly", "on_demand"),
      allowNull: true,
    },
    defaultPrice: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true,
    },
    defaultDayOfWeek: {
      type: DataTypes.INTEGER, // 0-6, 0=Sunday
      allowNull: true,
    },
    defaultTimeWindow: {
      type: DataTypes.STRING,
      allowNull: true,
    },

    // === Settings ===
    autoPayEnabled: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },
    autoScheduleEnabled: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },
  });

  // Helper function to encrypt PII fields
  const encryptPIIFields = (record) => {
    PII_FIELDS.forEach((field) => {
      if (record[field] !== undefined && record[field] !== null) {
        let value = record[field];
        // Handle objects (like invitedAddress) by stringifying
        if (typeof value === "object") {
          value = JSON.stringify(value);
        } else {
          value = String(value);
        }
        // Only encrypt if not already encrypted
        if (!value.includes(":") || value.split(":").length !== 2) {
          record[field] = EncryptionService.encrypt(value);
        }
      }
    });
  };

  // Helper function to decrypt PII fields
  const decryptPIIFields = (record) => {
    if (!record) return;

    PII_FIELDS.forEach((field) => {
      if (record.dataValues && record.dataValues[field]) {
        let decrypted = EncryptionService.decrypt(record.dataValues[field]);
        // Try to parse JSON for invitedAddress
        if (field === "invitedAddress" && decrypted) {
          try {
            decrypted = JSON.parse(decrypted);
          } catch (e) {
            // Not JSON, keep as string
          }
        }
        record.dataValues[field] = decrypted;
      }
    });
  };

  // Encrypt before creating
  CleanerClient.beforeCreate((record) => {
    encryptPIIFields(record);
  });

  // Encrypt before updating
  CleanerClient.beforeUpdate((record) => {
    encryptPIIFields(record);
  });

  // Decrypt after finding
  CleanerClient.afterFind((result) => {
    if (!result) return;

    if (Array.isArray(result)) {
      result.forEach((record) => decryptPIIFields(record));
    } else {
      decryptPIIFields(result);
    }
  });

  // Define associations
  CleanerClient.associate = (models) => {
    CleanerClient.belongsTo(models.User, {
      foreignKey: "cleanerId",
      as: "cleaner",
    });
    CleanerClient.belongsTo(models.User, {
      foreignKey: "clientId",
      as: "client",
    });
    CleanerClient.belongsTo(models.UserHomes, {
      foreignKey: "homeId",
      as: "home",
    });
    CleanerClient.hasMany(models.RecurringSchedule, {
      foreignKey: "cleanerClientId",
      as: "recurringSchedules",
    });
  };

  return CleanerClient;
};
