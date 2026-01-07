module.exports = (sequelize, DataTypes) => {
  const EmployeePayChangeLog = sequelize.define("EmployeePayChangeLog", {
    id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      autoIncrement: true,
      primaryKey: true,
    },
    employeeJobAssignmentId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    businessOwnerId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    previousPayAmount: {
      type: DataTypes.INTEGER,
      allowNull: false,
      comment: "Previous pay amount in cents",
    },
    newPayAmount: {
      type: DataTypes.INTEGER,
      allowNull: false,
      comment: "New pay amount in cents",
    },
    reason: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    changedAt: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
    changedBy: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
  });

  // Instance methods
  EmployeePayChangeLog.prototype.getChangeAmount = function () {
    return this.newPayAmount - this.previousPayAmount;
  };

  EmployeePayChangeLog.prototype.getFormattedChange = function () {
    const change = this.getChangeAmount();
    const sign = change >= 0 ? "+" : "";
    return `${sign}$${(change / 100).toFixed(2)}`;
  };

  EmployeePayChangeLog.associate = (models) => {
    EmployeePayChangeLog.belongsTo(models.EmployeeJobAssignment, {
      foreignKey: "employeeJobAssignmentId",
      as: "assignment",
    });
    EmployeePayChangeLog.belongsTo(models.User, {
      foreignKey: "businessOwnerId",
      as: "businessOwner",
    });
    EmployeePayChangeLog.belongsTo(models.User, {
      foreignKey: "changedBy",
      as: "changedByUser",
    });
  };

  return EmployeePayChangeLog;
};
