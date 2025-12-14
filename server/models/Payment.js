/**
 * Payment Model
 *
 * Tracks all payment transactions in the system.
 * This provides a complete audit trail of all money movement.
 *
 * Transaction Types:
 * - authorization: Initial payment authorization (hold on card)
 * - capture: Payment captured from customer
 * - refund: Full or partial refund to customer
 * - payout: Transfer to cleaner's connected account
 * - platform_fee: Platform's portion of the transaction
 */
module.exports = (sequelize, DataTypes) => {
  const Payment = sequelize.define("Payment", {
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
      comment: "Unique transaction ID (UUID)",
    },
    stripePaymentIntentId: {
      type: DataTypes.STRING,
      allowNull: true,
      comment: "Stripe Payment Intent ID (pi_...)",
    },
    stripeTransferId: {
      type: DataTypes.STRING,
      allowNull: true,
      comment: "Stripe Transfer ID for payouts (tr_...)",
    },
    stripeRefundId: {
      type: DataTypes.STRING,
      allowNull: true,
      comment: "Stripe Refund ID (re_...)",
    },
    stripeChargeId: {
      type: DataTypes.STRING,
      allowNull: true,
      comment: "Stripe Charge ID (ch_...)",
    },

    // Transaction type and status
    type: {
      type: DataTypes.ENUM(
        "authorization",
        "capture",
        "refund",
        "payout",
        "platform_fee"
      ),
      allowNull: false,
      comment: "Type of transaction",
    },
    status: {
      type: DataTypes.ENUM(
        "pending",
        "processing",
        "succeeded",
        "failed",
        "canceled",
        "refunded"
      ),
      allowNull: false,
      defaultValue: "pending",
      comment: "Current status of the transaction",
    },

    // Relationships
    userId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      comment: "Customer who made the payment (null for platform fees)",
    },
    cleanerId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      comment: "Cleaner receiving payout (null for customer payments)",
    },
    appointmentId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      comment: "Related appointment",
    },
    payoutId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      comment: "Related payout record (for payout transactions)",
    },

    // Financial amounts (all in cents)
    amount: {
      type: DataTypes.INTEGER,
      allowNull: false,
      comment: "Transaction amount in cents",
    },
    currency: {
      type: DataTypes.STRING(3),
      allowNull: false,
      defaultValue: "usd",
      comment: "ISO 4217 currency code",
    },
    platformFeeAmount: {
      type: DataTypes.INTEGER,
      allowNull: true,
      comment: "Platform fee amount in cents (for captures/payouts)",
    },
    netAmount: {
      type: DataTypes.INTEGER,
      allowNull: true,
      comment: "Net amount after fees in cents",
    },

    // Tax reporting fields
    taxYear: {
      type: DataTypes.INTEGER,
      allowNull: true,
      comment: "Tax year for reporting (e.g., 2025)",
    },
    reportable: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      comment: "Whether this transaction is reportable for 1099",
    },
    reported: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      comment: "Whether this transaction has been included in a 1099",
    },

    // Additional metadata
    description: {
      type: DataTypes.STRING,
      allowNull: true,
      comment: "Human-readable description of transaction",
    },
    metadata: {
      type: DataTypes.JSON,
      allowNull: true,
      comment: "Additional transaction metadata",
    },
    failureReason: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: "Reason for failure if status is failed",
    },

    // Timestamps for tracking
    processedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: "When the transaction was processed",
    },
  });

  Payment.associate = (models) => {
    Payment.belongsTo(models.User, {
      foreignKey: "userId",
      as: "customer",
    });
    Payment.belongsTo(models.User, {
      foreignKey: "cleanerId",
      as: "cleaner",
    });
    Payment.belongsTo(models.UserAppointments, {
      foreignKey: "appointmentId",
      as: "appointment",
    });
    Payment.belongsTo(models.Payout, {
      foreignKey: "payoutId",
      as: "payout",
    });
  };

  // Helper to generate unique transaction ID
  Payment.generateTransactionId = () => {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 10);
    return `txn_${timestamp}_${random}`;
  };

  // Get all reportable payments for a cleaner in a tax year
  Payment.getReportableForCleaner = async (cleanerId, taxYear) => {
    return Payment.findAll({
      where: {
        cleanerId,
        taxYear,
        type: "payout",
        status: "succeeded",
        reportable: true,
      },
      order: [["processedAt", "ASC"]],
    });
  };

  // Get total reportable amount for a cleaner in a tax year
  Payment.getTotalReportableAmount = async (cleanerId, taxYear) => {
    const result = await Payment.findOne({
      where: {
        cleanerId,
        taxYear,
        type: "payout",
        status: "succeeded",
        reportable: true,
      },
      attributes: [
        [sequelize.fn("SUM", sequelize.col("amount")), "totalAmount"],
        [sequelize.fn("COUNT", sequelize.col("id")), "transactionCount"],
      ],
      raw: true,
    });
    return {
      totalAmountCents: parseInt(result.totalAmount) || 0,
      totalAmountDollars: ((parseInt(result.totalAmount) || 0) / 100).toFixed(2),
      transactionCount: parseInt(result.transactionCount) || 0,
    };
  };

  return Payment;
};
