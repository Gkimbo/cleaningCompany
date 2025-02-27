'use strict';

module.exports = (sequelize, DataTypes) => {
  // Define the PendingRequests model
  const UserPendingRequests = sequelize.define("UserPendingRequests", {
    id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      autoIncrement: true,
      primaryKey: true,
    },
    employeeId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: "Users",
        key: "id",
      },
      onUpdate: "CASCADE",
      onDelete: "CASCADE",
    },
    appointmentId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: "UserAppointments",
        key: "id",
      },
      onUpdate: "CASCADE",
      onDelete: "CASCADE",
    },
    status: {
      type: DataTypes.ENUM("pending", "approved", "denied"),
      allowNull: false,
      defaultValue: "pending",
    },
  });

  // Define the associations
  UserPendingRequests.associate = (models) => {
    UserPendingRequests.belongsTo(models.User, {
      foreignKey: "employeeId",
      as: "employee",
    });
    UserPendingRequests.belongsTo(models.UserAppointments, {
      foreignKey: "appointmentId",
      as: "appointment",
    });
  };

  return UserPendingRequests;
};
