/**
 * CleanerJoinRequest Model
 *
 * Tracks homeowner approval requests when non-preferred cleaners
 * want to join multi-cleaner jobs. Preferred cleaners are auto-approved.
 */
module.exports = (sequelize, DataTypes) => {
  const CleanerJoinRequest = sequelize.define("CleanerJoinRequest", {
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
    appointmentId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    homeId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    cleanerId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    homeownerId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    status: {
      type: DataTypes.ENUM(
        "pending",
        "approved",
        "declined",
        "auto_approved",
        "expired",
        "cancelled"
      ),
      allowNull: false,
      defaultValue: "pending",
    },
    roomAssignmentIds: {
      type: DataTypes.JSONB,
      allowNull: true,
    },
    expiresAt: {
      type: DataTypes.DATE,
      allowNull: false,
    },
    respondedAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    declineReason: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
  });

  CleanerJoinRequest.associate = (models) => {
    CleanerJoinRequest.belongsTo(models.MultiCleanerJob, {
      foreignKey: "multiCleanerJobId",
      as: "multiCleanerJob",
    });

    CleanerJoinRequest.belongsTo(models.UserAppointments, {
      foreignKey: "appointmentId",
      as: "appointment",
    });

    CleanerJoinRequest.belongsTo(models.UserHomes, {
      foreignKey: "homeId",
      as: "home",
    });

    CleanerJoinRequest.belongsTo(models.User, {
      foreignKey: "cleanerId",
      as: "cleaner",
    });

    CleanerJoinRequest.belongsTo(models.User, {
      foreignKey: "homeownerId",
      as: "homeowner",
    });
  };

  /**
   * Check if request has expired
   */
  CleanerJoinRequest.prototype.isExpired = function () {
    return new Date() > new Date(this.expiresAt);
  };

  /**
   * Check if request is still pending
   */
  CleanerJoinRequest.prototype.isPending = function () {
    return this.status === "pending" && !this.isExpired();
  };

  /**
   * Approve the request
   */
  CleanerJoinRequest.prototype.approve = async function () {
    this.status = "approved";
    this.respondedAt = new Date();
    await this.save();
    return this;
  };

  /**
   * Decline the request
   */
  CleanerJoinRequest.prototype.decline = async function (reason = null) {
    this.status = "declined";
    this.respondedAt = new Date();
    this.declineReason = reason;
    await this.save();
    return this;
  };

  /**
   * Auto-approve the request (when homeowner doesn't respond in time)
   */
  CleanerJoinRequest.prototype.autoApprove = async function () {
    this.status = "auto_approved";
    this.respondedAt = new Date();
    await this.save();
    return this;
  };

  /**
   * Cancel the request (when cleaner cancels or job fills)
   */
  CleanerJoinRequest.prototype.cancel = async function () {
    this.status = "cancelled";
    await this.save();
    return this;
  };

  /**
   * Find pending requests that have expired and need auto-approval
   */
  CleanerJoinRequest.findExpiredPendingRequests = async function () {
    const { Op } = require("sequelize");
    return CleanerJoinRequest.findAll({
      where: {
        status: "pending",
        expiresAt: {
          [Op.lt]: new Date(),
        },
      },
      include: [
        { model: sequelize.models.User, as: "cleaner" },
        { model: sequelize.models.User, as: "homeowner" },
        { model: sequelize.models.MultiCleanerJob, as: "multiCleanerJob" },
      ],
    });
  };

  /**
   * Find pending requests for a specific homeowner
   */
  CleanerJoinRequest.findPendingForHomeowner = async function (homeownerId) {
    const { Op } = require("sequelize");
    return CleanerJoinRequest.findAll({
      where: {
        homeownerId,
        status: "pending",
        expiresAt: {
          [Op.gt]: new Date(),
        },
      },
      include: [
        { model: sequelize.models.User, as: "cleaner" },
        {
          model: sequelize.models.UserAppointments,
          as: "appointment",
          include: [{ model: sequelize.models.UserHomes, as: "home" }],
        },
      ],
      order: [["createdAt", "DESC"]],
    });
  };

  return CleanerJoinRequest;
};
