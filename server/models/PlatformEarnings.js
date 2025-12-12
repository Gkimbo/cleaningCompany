/**
 * PlatformEarnings Model
 *
 * Tracks the company's 10% platform fee earnings from each cleaning.
 * This data is used for:
 * - Company income tax reporting
 * - Revenue tracking and analytics
 * - Quarterly estimated tax calculations
 * - Annual tax form generation (Schedule C, Form 1120, etc.)
 */
module.exports = (sequelize, DataTypes) => {
  const PlatformEarnings = sequelize.define("PlatformEarnings", {
    id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      autoIncrement: true,
      primaryKey: true,
    },
    // Transaction identification
    transactionId: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
      comment: "Unique transaction ID",
    },

    // Related records
    appointmentId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      comment: "Related appointment",
    },
    paymentId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      comment: "Related Payment record",
    },
    payoutId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      comment: "Related Payout record",
    },

    // Customer and cleaner info for records
    customerId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      comment: "Customer who paid",
    },
    cleanerId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      comment: "Cleaner who performed the service",
    },

    // Financial amounts (all in cents)
    grossServiceAmount: {
      type: DataTypes.INTEGER,
      allowNull: false,
      comment: "Total service amount charged to customer (in cents)",
    },
    platformFeeAmount: {
      type: DataTypes.INTEGER,
      allowNull: false,
      comment: "Platform's 10% fee (in cents)",
    },
    platformFeePercentage: {
      type: DataTypes.DECIMAL(5, 4),
      allowNull: false,
      defaultValue: 0.10,
      comment: "Fee percentage (0.10 = 10%)",
    },

    // Stripe fees (if tracked)
    stripeFeeAmount: {
      type: DataTypes.INTEGER,
      allowNull: true,
      defaultValue: 0,
      comment: "Stripe processing fee (in cents)",
    },
    netPlatformEarnings: {
      type: DataTypes.INTEGER,
      allowNull: false,
      comment: "Platform fee minus Stripe fees (in cents)",
    },

    // Tax categorization
    taxYear: {
      type: DataTypes.INTEGER,
      allowNull: false,
      comment: "Tax year for reporting",
    },
    taxQuarter: {
      type: DataTypes.INTEGER,
      allowNull: false,
      comment: "Tax quarter (1-4)",
    },
    taxMonth: {
      type: DataTypes.INTEGER,
      allowNull: false,
      comment: "Month (1-12)",
    },

    // Status
    status: {
      type: DataTypes.ENUM("pending", "collected", "refunded"),
      allowNull: false,
      defaultValue: "pending",
      comment: "Collection status",
    },

    // Categorization for tax purposes
    incomeCategory: {
      type: DataTypes.ENUM(
        "service_fee",
        "platform_commission",
        "other"
      ),
      allowNull: false,
      defaultValue: "platform_commission",
      comment: "Income category for tax reporting",
    },

    // Timestamps
    earnedAt: {
      type: DataTypes.DATE,
      allowNull: false,
      comment: "When the fee was earned",
    },
    collectedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: "When the fee was actually collected",
    },

    // Metadata
    description: {
      type: DataTypes.STRING,
      allowNull: true,
      comment: "Description of the transaction",
    },
    metadata: {
      type: DataTypes.JSON,
      allowNull: true,
      comment: "Additional metadata",
    },
  });

  PlatformEarnings.associate = (models) => {
    PlatformEarnings.belongsTo(models.UserAppointments, {
      foreignKey: "appointmentId",
      as: "appointment",
    });
    PlatformEarnings.belongsTo(models.User, {
      foreignKey: "customerId",
      as: "customer",
    });
    PlatformEarnings.belongsTo(models.User, {
      foreignKey: "cleanerId",
      as: "cleaner",
    });
    PlatformEarnings.belongsTo(models.Payment, {
      foreignKey: "paymentId",
      as: "payment",
    });
    PlatformEarnings.belongsTo(models.Payout, {
      foreignKey: "payoutId",
      as: "payout",
    });
  };

  // Generate unique transaction ID
  PlatformEarnings.generateTransactionId = () => {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 8);
    return `pf_${timestamp}_${random}`;
  };

  // Get quarter from date
  PlatformEarnings.getQuarter = (date) => {
    const month = date.getMonth();
    return Math.floor(month / 3) + 1;
  };

  // Get earnings summary for a tax year
  PlatformEarnings.getYearlySummary = async (taxYear) => {
    const result = await PlatformEarnings.findOne({
      where: {
        taxYear,
        status: "collected",
      },
      attributes: [
        [sequelize.fn("SUM", sequelize.col("grossServiceAmount")), "totalGrossServices"],
        [sequelize.fn("SUM", sequelize.col("platformFeeAmount")), "totalPlatformFees"],
        [sequelize.fn("SUM", sequelize.col("stripeFeeAmount")), "totalStripeFees"],
        [sequelize.fn("SUM", sequelize.col("netPlatformEarnings")), "totalNetEarnings"],
        [sequelize.fn("COUNT", sequelize.col("id")), "transactionCount"],
      ],
      raw: true,
    });

    return {
      taxYear,
      totalGrossServicesCents: parseInt(result.totalGrossServices) || 0,
      totalGrossServicesDollars: ((parseInt(result.totalGrossServices) || 0) / 100).toFixed(2),
      totalPlatformFeesCents: parseInt(result.totalPlatformFees) || 0,
      totalPlatformFeesDollars: ((parseInt(result.totalPlatformFees) || 0) / 100).toFixed(2),
      totalStripeFeesCents: parseInt(result.totalStripeFees) || 0,
      totalStripeFeesDollars: ((parseInt(result.totalStripeFees) || 0) / 100).toFixed(2),
      totalNetEarningsCents: parseInt(result.totalNetEarnings) || 0,
      totalNetEarningsDollars: ((parseInt(result.totalNetEarnings) || 0) / 100).toFixed(2),
      transactionCount: parseInt(result.transactionCount) || 0,
    };
  };

  // Get quarterly summary
  PlatformEarnings.getQuarterlySummary = async (taxYear, quarter) => {
    const result = await PlatformEarnings.findOne({
      where: {
        taxYear,
        taxQuarter: quarter,
        status: "collected",
      },
      attributes: [
        [sequelize.fn("SUM", sequelize.col("grossServiceAmount")), "totalGrossServices"],
        [sequelize.fn("SUM", sequelize.col("platformFeeAmount")), "totalPlatformFees"],
        [sequelize.fn("SUM", sequelize.col("netPlatformEarnings")), "totalNetEarnings"],
        [sequelize.fn("COUNT", sequelize.col("id")), "transactionCount"],
      ],
      raw: true,
    });

    return {
      taxYear,
      quarter,
      totalGrossServicesCents: parseInt(result.totalGrossServices) || 0,
      totalPlatformFeesCents: parseInt(result.totalPlatformFees) || 0,
      totalNetEarningsCents: parseInt(result.totalNetEarnings) || 0,
      transactionCount: parseInt(result.transactionCount) || 0,
    };
  };

  // Get monthly breakdown
  PlatformEarnings.getMonthlyBreakdown = async (taxYear) => {
    const results = await PlatformEarnings.findAll({
      where: {
        taxYear,
        status: "collected",
      },
      attributes: [
        "taxMonth",
        [sequelize.fn("SUM", sequelize.col("platformFeeAmount")), "totalPlatformFees"],
        [sequelize.fn("SUM", sequelize.col("netPlatformEarnings")), "totalNetEarnings"],
        [sequelize.fn("COUNT", sequelize.col("id")), "transactionCount"],
      ],
      group: ["taxMonth"],
      order: [["taxMonth", "ASC"]],
      raw: true,
    });

    return results.map((r) => ({
      month: r.taxMonth,
      totalPlatformFeesCents: parseInt(r.totalPlatformFees) || 0,
      totalPlatformFeesDollars: ((parseInt(r.totalPlatformFees) || 0) / 100).toFixed(2),
      totalNetEarningsCents: parseInt(r.totalNetEarnings) || 0,
      totalNetEarningsDollars: ((parseInt(r.totalNetEarnings) || 0) / 100).toFixed(2),
      transactionCount: parseInt(r.transactionCount) || 0,
    }));
  };

  return PlatformEarnings;
};
