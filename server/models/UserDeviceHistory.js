/**
 * User Device History Model
 * For tracking all devices a user has logged in from
 */
module.exports = (sequelize, DataTypes) => {
  const UserDeviceHistory = sequelize.define("UserDeviceHistory", {
    id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      autoIncrement: true,
      primaryKey: true,
    },
    userId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: "Users", key: "id" },
      onUpdate: "CASCADE",
      onDelete: "CASCADE",
    },
    // Device identification
    deviceId: {
      type: DataTypes.STRING(255),
      allowNull: true,
      comment: "Unique device identifier if available",
    },
    deviceType: {
      type: DataTypes.STRING(50),
      allowNull: true,
      comment: "ios, android, web, etc.",
    },
    deviceModel: {
      type: DataTypes.STRING(100),
      allowNull: true,
      comment: "iPhone 14, Pixel 7, etc.",
    },
    osVersion: {
      type: DataTypes.STRING(50),
      allowNull: true,
    },
    appVersion: {
      type: DataTypes.STRING(20),
      allowNull: true,
    },
    // Browser info (for web)
    browserName: {
      type: DataTypes.STRING(50),
      allowNull: true,
    },
    browserVersion: {
      type: DataTypes.STRING(20),
      allowNull: true,
    },
    // Location/network info
    ipAddress: {
      type: DataTypes.STRING(45),
      allowNull: true,
      comment: "IPv4 or IPv6",
    },
    // Push token for this device
    pushToken: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    // Activity tracking
    firstSeenAt: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
    lastSeenAt: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
    loginCount: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 1,
    },
    // Status
    isActive: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },
    isTrusted: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      comment: "User has marked this device as trusted",
    },
    // Security flags
    suspiciousActivity: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    suspiciousReason: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    // Revocation
    revokedAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    revokedBy: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: { model: "Users", key: "id" },
      onUpdate: "CASCADE",
      onDelete: "SET NULL",
    },
    revokeReason: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
  });

  UserDeviceHistory.associate = (models) => {
    UserDeviceHistory.belongsTo(models.User, {
      foreignKey: "userId",
      as: "user",
    });
    UserDeviceHistory.belongsTo(models.User, {
      foreignKey: "revokedBy",
      as: "revoker",
    });
  };

  return UserDeviceHistory;
};
