/**
 * TaxDocument Model
 *
 * Tracks generated tax documents (1099-NEC forms) for record keeping
 * and compliance purposes.
 *
 * IRS Requirements:
 * - 1099-NEC must be filed for payments >= $600 to non-employees
 * - Copy A: IRS
 * - Copy B: Recipient
 * - Copy C: Payer's records
 * - Filing deadline: January 31st of the following year
 */
module.exports = (sequelize, DataTypes) => {
  const TaxDocument = sequelize.define("TaxDocument", {
    id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      autoIncrement: true,
      primaryKey: true,
    },
    documentId: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
      comment: "Unique document identifier",
    },
    userId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      comment: "Cleaner this document is for",
    },

    // Document details
    documentType: {
      type: DataTypes.ENUM("1099-NEC", "1099-K", "W-9"),
      allowNull: false,
      comment: "Type of tax document",
    },
    taxYear: {
      type: DataTypes.INTEGER,
      allowNull: false,
      comment: "Tax year this document is for",
    },

    // 1099-NEC specific fields
    box1NonemployeeCompensation: {
      type: DataTypes.INTEGER,
      allowNull: true,
      comment: "Box 1: Nonemployee compensation in cents",
    },
    box4FederalTaxWithheld: {
      type: DataTypes.INTEGER,
      allowNull: true,
      defaultValue: 0,
      comment: "Box 4: Federal income tax withheld in cents",
    },
    box5StateTaxWithheld: {
      type: DataTypes.INTEGER,
      allowNull: true,
      defaultValue: 0,
      comment: "Box 5: State tax withheld in cents",
    },
    box6StatePayersNo: {
      type: DataTypes.STRING,
      allowNull: true,
      comment: "Box 6: State/Payer's state no.",
    },
    box7StateIncome: {
      type: DataTypes.INTEGER,
      allowNull: true,
      comment: "Box 7: State income in cents",
    },

    // Payer information (platform)
    payerName: {
      type: DataTypes.STRING,
      allowNull: false,
      comment: "Platform/Company name",
    },
    payerTin: {
      type: DataTypes.STRING,
      allowNull: false,
      comment: "Platform EIN (encrypted)",
    },
    payerAddress: {
      type: DataTypes.TEXT,
      allowNull: false,
      comment: "Platform address",
    },

    // Recipient information (snapshot at time of generation)
    recipientName: {
      type: DataTypes.STRING,
      allowNull: false,
      comment: "Cleaner's legal name",
    },
    recipientTin: {
      type: DataTypes.STRING,
      allowNull: false,
      comment: "Cleaner's TIN (encrypted)",
    },
    recipientTinLast4: {
      type: DataTypes.STRING(4),
      allowNull: false,
      comment: "Last 4 of TIN for display",
    },
    recipientAddress: {
      type: DataTypes.TEXT,
      allowNull: false,
      comment: "Cleaner's address",
    },

    // Document status
    status: {
      type: DataTypes.ENUM(
        "draft",
        "generated",
        "sent_to_recipient",
        "filed_with_irs",
        "corrected",
        "voided"
      ),
      allowNull: false,
      defaultValue: "draft",
      comment: "Document status",
    },

    // Filing and delivery tracking
    generatedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: "When document was generated",
    },
    sentToRecipientAt: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: "When sent to cleaner",
    },
    sentToRecipientMethod: {
      type: DataTypes.ENUM("email", "mail", "portal"),
      allowNull: true,
      comment: "How document was delivered",
    },
    filedWithIrsAt: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: "When filed with IRS",
    },
    irsConfirmationNumber: {
      type: DataTypes.STRING,
      allowNull: true,
      comment: "IRS filing confirmation",
    },

    // Corrections
    isCorrection: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      comment: "Whether this is a corrected form",
    },
    originalDocumentId: {
      type: DataTypes.STRING,
      allowNull: true,
      comment: "Reference to original if this is a correction",
    },
    correctionReason: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: "Reason for correction",
    },

    // Storage
    pdfPath: {
      type: DataTypes.STRING,
      allowNull: true,
      comment: "Path to generated PDF",
    },
    pdfHash: {
      type: DataTypes.STRING,
      allowNull: true,
      comment: "SHA-256 hash of PDF for integrity",
    },

    // Metadata
    generatedBy: {
      type: DataTypes.STRING,
      allowNull: true,
      comment: "Admin who generated the document",
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: "Internal notes",
    },
  });

  TaxDocument.associate = (models) => {
    TaxDocument.belongsTo(models.User, {
      foreignKey: "userId",
      as: "recipient",
    });
    TaxDocument.belongsTo(models.TaxInfo, {
      foreignKey: "userId",
      targetKey: "userId",
      as: "taxInfo",
    });
  };

  // Generate unique document ID
  TaxDocument.generateDocumentId = (taxYear, type, userId) => {
    const timestamp = Date.now().toString(36);
    return `${type}-${taxYear}-${userId}-${timestamp}`.toUpperCase();
  };

  // Get all documents for a user
  TaxDocument.getForUser = async (userId) => {
    return TaxDocument.findAll({
      where: { userId },
      order: [["taxYear", "DESC"], ["createdAt", "DESC"]],
    });
  };

  // Get all documents for a tax year
  TaxDocument.getForTaxYear = async (taxYear) => {
    return TaxDocument.findAll({
      where: { taxYear, status: { [sequelize.Op.ne]: "voided" } },
      order: [["recipientName", "ASC"]],
    });
  };

  // Check if 1099 already generated for user and year
  TaxDocument.existsForUserYear = async (userId, taxYear) => {
    const doc = await TaxDocument.findOne({
      where: {
        userId,
        taxYear,
        documentType: "1099-NEC",
        status: { [sequelize.Op.notIn]: ["voided", "corrected"] },
      },
    });
    return !!doc;
  };

  return TaxDocument;
};
