/**
 * EmployeePendingPayout Model
 *
 * Tracks employee earnings waiting for the bi-weekly payout cycle.
 * Business owners are paid immediately when jobs complete;
 * employee payouts are batched and paid every other Friday.
 */

module.exports = (sequelize, DataTypes) => {
  const EmployeePendingPayout = sequelize.define("EmployeePendingPayout", {
    id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      autoIncrement: true,
      primaryKey: true,
    },

    // Who gets paid
    businessEmployeeId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    businessOwnerId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },

    // Source of earning
    employeeJobAssignmentId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      unique: true,
    },
    appointmentId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },

    // Payment details
    amount: {
      type: DataTypes.INTEGER,
      allowNull: false,
      comment: "Amount in cents",
    },
    payType: {
      type: DataTypes.STRING(20),
      allowNull: true,
      comment: "hourly, per_job, percentage",
    },
    hoursWorked: {
      type: DataTypes.DECIMAL(5, 2),
      allowNull: true,
      comment: "Hours worked for hourly employees",
    },

    // Status tracking
    status: {
      type: DataTypes.STRING(20),
      allowNull: false,
      defaultValue: "pending",
      comment: "pending, processing, completed, failed, cancelled",
    },

    // Timing
    earnedAt: {
      type: DataTypes.DATE,
      allowNull: false,
      comment: "When the job was completed",
    },
    scheduledPayoutDate: {
      type: DataTypes.DATEONLY,
      allowNull: false,
      comment: "When this will be paid (bi-weekly Friday)",
    },
    paidAt: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: "When actually paid",
    },

    // Stripe tracking
    stripeTransferId: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    failureReason: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    retryCount: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
  });

  // Instance methods
  EmployeePendingPayout.prototype.isPending = function () {
    return this.status === "pending";
  };

  EmployeePendingPayout.prototype.isCompleted = function () {
    return this.status === "completed";
  };

  EmployeePendingPayout.prototype.canRetry = function () {
    return this.status === "failed" && this.retryCount < 3;
  };

  EmployeePendingPayout.prototype.getFormattedAmount = function () {
    return `$${(this.amount / 100).toFixed(2)}`;
  };

  // Associations
  EmployeePendingPayout.associate = (models) => {
    EmployeePendingPayout.belongsTo(models.BusinessEmployee, {
      foreignKey: "businessEmployeeId",
      as: "employee",
    });
    EmployeePendingPayout.belongsTo(models.User, {
      foreignKey: "businessOwnerId",
      as: "businessOwner",
    });
    EmployeePendingPayout.belongsTo(models.EmployeeJobAssignment, {
      foreignKey: "employeeJobAssignmentId",
      as: "assignment",
    });
    EmployeePendingPayout.belongsTo(models.UserAppointments, {
      foreignKey: "appointmentId",
      as: "appointment",
    });
  };

  return EmployeePendingPayout;
};
