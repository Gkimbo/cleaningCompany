const EncryptionService = require("../services/EncryptionService");

// PII fields that need to be encrypted
const PII_FIELDS = [
  "legalName",
  "businessName",
  "addressLine1",
  "addressLine2",
  "city",
  "state",
  "zipCode",
  "tinEncrypted",
  "certificationSignature"
];

/**
 * TaxInfo Model
 *
 * Stores W-9 tax information for cleaners (independent contractors).
 * This data is required for 1099-NEC generation at year end.
 *
 * Important: This model stores sensitive PII that should be encrypted at rest.
 * Fields like SSN/EIN are stored encrypted and should only be decrypted when needed.
 *
 * IRS Form W-9 Requirements:
 * - Legal name
 * - Business name (if different)
 * - Federal tax classification
 * - Address
 * - TIN (SSN or EIN)
 * - Certification signature and date
 */
module.exports = (sequelize, DataTypes) => {
  const TaxInfo = sequelize.define("TaxInfo", {
    id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      autoIncrement: true,
      primaryKey: true,
    },
    userId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      unique: true,
      comment: "User (cleaner) this tax info belongs to",
    },

    // W-9 Line 1: Name
    legalName: {
      type: DataTypes.STRING,
      allowNull: false,
      comment: "Legal name as shown on tax return",
    },

    // W-9 Line 2: Business name (optional)
    businessName: {
      type: DataTypes.STRING,
      allowNull: true,
      comment: "Business name/DBA if different from legal name",
    },

    // W-9 Line 3: Federal tax classification
    taxClassification: {
      type: DataTypes.ENUM(
        "individual",
        "sole_proprietor",
        "single_member_llc",
        "c_corporation",
        "s_corporation",
        "partnership",
        "trust_estate",
        "llc_c",
        "llc_s",
        "llc_p",
        "other"
      ),
      allowNull: false,
      defaultValue: "individual",
      comment: "Federal tax classification",
    },

    // W-9 Line 4: Exemptions (rare for cleaning contractors)
    exemptPayeeCode: {
      type: DataTypes.STRING(2),
      allowNull: true,
      comment: "Exempt payee code if applicable",
    },
    fatcaExemptionCode: {
      type: DataTypes.STRING(2),
      allowNull: true,
      comment: "FATCA exemption code if applicable",
    },

    // W-9 Lines 5-6: Address
    addressLine1: {
      type: DataTypes.STRING,
      allowNull: false,
      comment: "Street address",
    },
    addressLine2: {
      type: DataTypes.STRING,
      allowNull: true,
      comment: "Apt, suite, unit, etc.",
    },
    city: {
      type: DataTypes.STRING,
      allowNull: false,
      comment: "City",
    },
    state: {
      type: DataTypes.STRING(2),
      allowNull: false,
      comment: "State abbreviation",
    },
    zipCode: {
      type: DataTypes.STRING(10),
      allowNull: false,
      comment: "ZIP code",
    },

    // W-9 Line 7: Account numbers (optional, not stored)

    // W-9 Part I: Taxpayer Identification Number (TIN)
    tinType: {
      type: DataTypes.ENUM("ssn", "ein"),
      allowNull: false,
      defaultValue: "ssn",
      comment: "Type of TIN: SSN or EIN",
    },
    tinEncrypted: {
      type: DataTypes.STRING,
      allowNull: false,
      comment: "Encrypted TIN (SSN or EIN) - format XXX-XX-XXXX or XX-XXXXXXX",
    },
    tinLast4: {
      type: DataTypes.STRING(4),
      allowNull: false,
      comment: "Last 4 digits of TIN for display purposes",
    },

    // W-9 Part II: Certification
    certificationDate: {
      type: DataTypes.DATE,
      allowNull: false,
      comment: "Date W-9 was signed/certified",
    },
    certificationSignature: {
      type: DataTypes.STRING,
      allowNull: false,
      comment: "Electronic signature (typed name)",
    },
    certificationIpAddress: {
      type: DataTypes.STRING,
      allowNull: true,
      comment: "IP address at time of certification",
    },

    // Status and verification
    status: {
      type: DataTypes.ENUM(
        "pending",
        "verified",
        "needs_update",
        "invalid"
      ),
      allowNull: false,
      defaultValue: "pending",
      comment: "Verification status of tax info",
    },
    tinVerified: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      comment: "Whether TIN has been verified with IRS",
    },
    tinVerifiedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: "When TIN was verified",
    },

    // 1099 tracking
    form1099Required: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      comment: "Whether 1099 is required (>$600 in payments)",
    },

    // Backup withholding (rare, but required if TIN invalid)
    backupWithholdingRequired: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      comment: "Whether backup withholding is required",
    },
    backupWithholdingRate: {
      type: DataTypes.DECIMAL(5, 4),
      allowNull: true,
      defaultValue: 0.24,
      comment: "Backup withholding rate (currently 24%)",
    },

    // Metadata
    lastUpdatedBy: {
      type: DataTypes.STRING,
      allowNull: true,
      comment: "Who last updated this record (user or admin)",
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: "Internal notes",
    },
  });

  TaxInfo.associate = (models) => {
    TaxInfo.belongsTo(models.User, {
      foreignKey: "userId",
      as: "user",
    });
  };

  // Valid US states for address validation
  TaxInfo.VALID_STATES = [
    "AL", "AK", "AZ", "AR", "CA", "CO", "CT", "DE", "FL", "GA",
    "HI", "ID", "IL", "IN", "IA", "KS", "KY", "LA", "ME", "MD",
    "MA", "MI", "MN", "MS", "MO", "MT", "NE", "NV", "NH", "NJ",
    "NM", "NY", "NC", "ND", "OH", "OK", "OR", "PA", "RI", "SC",
    "SD", "TN", "TX", "UT", "VT", "VA", "WA", "WV", "WI", "WY",
    "DC", "PR", "VI", "GU", "AS", "MP",
  ];

  // Format TIN for display (masked)
  TaxInfo.formatTinMasked = (tinType, tinLast4) => {
    if (tinType === "ssn") {
      return `XXX-XX-${tinLast4}`;
    }
    return `XX-XXX${tinLast4}`;
  };

  // Validate SSN format
  TaxInfo.validateSSN = (ssn) => {
    const cleaned = ssn.replace(/\D/g, "");
    if (cleaned.length !== 9) return false;
    // Basic validation - no all zeros in any group
    const area = cleaned.substring(0, 3);
    const group = cleaned.substring(3, 5);
    const serial = cleaned.substring(5, 9);
    if (area === "000" || group === "00" || serial === "0000") return false;
    // No 666 or 900-999 area numbers
    if (area === "666" || parseInt(area) >= 900) return false;
    return true;
  };

  // Validate EIN format
  TaxInfo.validateEIN = (ein) => {
    const cleaned = ein.replace(/\D/g, "");
    if (cleaned.length !== 9) return false;
    // First two digits must be valid prefix
    const validPrefixes = [
      "10", "12", "20", "27", "30", "32", "35", "36", "37", "38", "39",
      "40", "41", "42", "43", "44", "45", "46", "47", "48", "50", "51",
      "52", "53", "54", "55", "56", "57", "58", "59", "60", "61", "62",
      "63", "64", "65", "66", "67", "68", "71", "72", "73", "74", "75",
      "76", "77", "80", "81", "82", "83", "84", "85", "86", "87", "88",
      "90", "91", "92", "93", "94", "95", "98", "99",
    ];
    const prefix = cleaned.substring(0, 2);
    return validPrefixes.includes(prefix);
  };

  // Check if cleaner needs 1099 based on payments
  TaxInfo.checkForm1099Required = async (userId, taxYear, Payment) => {
    const total = await Payment.getTotalReportableAmount(userId, taxYear);
    // IRS threshold is $600 for 1099-NEC
    return total.totalAmountCents >= 60000;
  };

  // Encryption hooks
  const encryptPIIFields = (record) => {
    PII_FIELDS.forEach((field) => {
      if (record[field] !== undefined && record[field] !== null) {
        const value = String(record[field]);
        // Only encrypt if not already encrypted (check for colon format)
        if (!value.includes(":") || value.split(":").length !== 2) {
          record[field] = EncryptionService.encrypt(value);
        }
      }
    });
  };

  const decryptPIIFields = (record) => {
    if (!record) return;
    PII_FIELDS.forEach((field) => {
      if (record.dataValues && record.dataValues[field]) {
        record.dataValues[field] = EncryptionService.decrypt(record.dataValues[field]);
      }
    });
  };

  TaxInfo.beforeCreate((record) => {
    encryptPIIFields(record);
  });

  TaxInfo.beforeUpdate((record) => {
    encryptPIIFields(record);
  });

  TaxInfo.afterFind((result) => {
    if (!result) return;
    if (Array.isArray(result)) {
      result.forEach((record) => decryptPIIFields(record));
    } else {
      decryptPIIFields(result);
    }
  });

  return TaxInfo;
};
