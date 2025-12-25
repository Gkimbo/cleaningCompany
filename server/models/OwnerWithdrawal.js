/**
 * OwnerWithdrawal Model
 *
 * Tracks withdrawals of platform fees from the Stripe account to the owner's bank account.
 * This is used for:
 * - Recording all owner payout requests
 * - Tracking withdrawal history
 * - Reconciliation with Stripe payouts
 */
module.exports = (sequelize, DataTypes) => {
  const OwnerWithdrawal = sequelize.define("OwnerWithdrawal", {
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

    // Stripe payout reference
    stripePayoutId: {
      type: DataTypes.STRING,
      allowNull: true,
      comment: "Stripe Payout ID (po_xxx)",
    },

    // Financial amounts (all in cents)
    amount: {
      type: DataTypes.INTEGER,
      allowNull: false,
      comment: "Withdrawal amount in cents",
    },

    // Status
    status: {
      type: DataTypes.ENUM("pending", "processing", "completed", "failed", "canceled"),
      allowNull: false,
      defaultValue: "pending",
      comment: "Withdrawal status",
    },

    // Bank account info (masked for security)
    bankAccountLast4: {
      type: DataTypes.STRING(4),
      allowNull: true,
      comment: "Last 4 digits of bank account",
    },
    bankName: {
      type: DataTypes.STRING,
      allowNull: true,
      comment: "Bank name",
    },

    // Timestamps
    requestedAt: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
      comment: "When withdrawal was requested",
    },
    processedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: "When withdrawal was processed by Stripe",
    },
    completedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: "When withdrawal arrived at bank (estimated)",
    },

    // Stripe timing
    estimatedArrival: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: "Estimated arrival date from Stripe",
    },

    // Error handling
    failureReason: {
      type: DataTypes.STRING,
      allowNull: true,
      comment: "Reason for failure if applicable",
    },

    // Metadata
    description: {
      type: DataTypes.STRING,
      allowNull: true,
      comment: "Description of the withdrawal",
    },
    metadata: {
      type: DataTypes.JSON,
      allowNull: true,
      comment: "Additional metadata",
    },
  });

  // Generate unique transaction ID
  OwnerWithdrawal.generateTransactionId = () => {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 8);
    return `ow_${timestamp}_${random}`;
  };

  // Get withdrawal history with pagination
  OwnerWithdrawal.getHistory = async (options = {}) => {
    const { limit = 20, offset = 0, status } = options;

    const where = {};
    if (status) {
      where.status = status;
    }

    const withdrawals = await OwnerWithdrawal.findAndCountAll({
      where,
      order: [["requestedAt", "DESC"]],
      limit,
      offset,
    });

    return {
      withdrawals: withdrawals.rows,
      total: withdrawals.count,
      limit,
      offset,
    };
  };

  // Get total withdrawn amount
  OwnerWithdrawal.getTotalWithdrawn = async (options = {}) => {
    const { taxYear } = options;

    const where = { status: "completed" };
    if (taxYear) {
      where.requestedAt = {
        [sequelize.Sequelize.Op.gte]: new Date(`${taxYear}-01-01`),
        [sequelize.Sequelize.Op.lt]: new Date(`${taxYear + 1}-01-01`),
      };
    }

    const result = await OwnerWithdrawal.findOne({
      where,
      attributes: [
        [sequelize.fn("SUM", sequelize.col("amount")), "totalWithdrawn"],
        [sequelize.fn("COUNT", sequelize.col("id")), "withdrawalCount"],
      ],
      raw: true,
    });

    return {
      totalWithdrawnCents: parseInt(result.totalWithdrawn) || 0,
      totalWithdrawnDollars: ((parseInt(result.totalWithdrawn) || 0) / 100).toFixed(2),
      withdrawalCount: parseInt(result.withdrawalCount) || 0,
    };
  };

  return OwnerWithdrawal;
};
