/**
 * CleanerJobOffer Model
 *
 * Tracks job offers sent to cleaners and their responses.
 * Used for multi-cleaner job slot management.
 */
module.exports = (sequelize, DataTypes) => {
  const CleanerJobOffer = sequelize.define("CleanerJobOffer", {
    id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      autoIncrement: true,
      primaryKey: true,
    },
    multiCleanerJobId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    cleanerId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    appointmentId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    offerType: {
      type: DataTypes.ENUM("primary_invite", "market_open", "urgent_fill"),
      allowNull: false,
      defaultValue: "market_open",
    },
    status: {
      type: DataTypes.ENUM("pending", "accepted", "declined", "expired", "withdrawn"),
      allowNull: false,
      defaultValue: "pending",
    },
    earningsOffered: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    roomsOffered: {
      type: DataTypes.JSONB,
      allowNull: true,
    },
    offeredAt: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
    respondedAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    expiresAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    declineReason: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
  });

  CleanerJobOffer.associate = (models) => {
    CleanerJobOffer.belongsTo(models.MultiCleanerJob, {
      foreignKey: "multiCleanerJobId",
      as: "multiCleanerJob",
    });

    CleanerJobOffer.belongsTo(models.User, {
      foreignKey: "cleanerId",
      as: "cleaner",
    });

    CleanerJobOffer.belongsTo(models.UserAppointments, {
      foreignKey: "appointmentId",
      as: "appointment",
    });
  };

  /**
   * Check if offer is expired
   */
  CleanerJobOffer.prototype.isExpired = function () {
    if (!this.expiresAt) return false;
    return new Date() > new Date(this.expiresAt);
  };

  /**
   * Accept the offer
   */
  CleanerJobOffer.prototype.accept = async function () {
    this.status = "accepted";
    this.respondedAt = new Date();
    await this.save();
    return this;
  };

  /**
   * Decline the offer
   */
  CleanerJobOffer.prototype.decline = async function (reason = null) {
    this.status = "declined";
    this.respondedAt = new Date();
    this.declineReason = reason;
    await this.save();
    return this;
  };

  /**
   * Mark offer as expired
   */
  CleanerJobOffer.prototype.markExpired = async function () {
    this.status = "expired";
    await this.save();
    return this;
  };

  /**
   * Find pending offers that have expired
   */
  CleanerJobOffer.findExpiredOffers = async function () {
    const { Op } = require("sequelize");
    return CleanerJobOffer.findAll({
      where: {
        status: "pending",
        expiresAt: {
          [Op.lt]: new Date(),
        },
      },
    });
  };

  return CleanerJobOffer;
};
