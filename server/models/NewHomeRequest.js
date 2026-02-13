/**
 * NewHomeRequest Model
 *
 * Tracks requests sent to business owners when their existing clients
 * add new homes. Business owners can accept (create new CleanerClient)
 * or decline (client can then list on marketplace or request again later).
 */
module.exports = (sequelize, DataTypes) => {
  const NewHomeRequest = sequelize.define("NewHomeRequest", {
    id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      autoIncrement: true,
      primaryKey: true,
    },
    homeId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    clientId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    businessOwnerId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    existingCleanerClientId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    status: {
      type: DataTypes.ENUM(
        "pending",
        "accepted",
        "declined",
        "expired",
        "cancelled"
      ),
      allowNull: false,
      defaultValue: "pending",
    },
    expiresAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    respondedAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    declineReason: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    calculatedPrice: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true,
    },
    numBeds: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    numBaths: {
      type: DataTypes.DECIMAL(3, 1),
      allowNull: true,
    },
    hourlyRate: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true,
    },
    lastRequestedAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    requestCount: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 1,
    },
  });

  NewHomeRequest.associate = (models) => {
    NewHomeRequest.belongsTo(models.UserHomes, {
      foreignKey: "homeId",
      as: "home",
    });

    NewHomeRequest.belongsTo(models.User, {
      foreignKey: "clientId",
      as: "client",
    });

    NewHomeRequest.belongsTo(models.User, {
      foreignKey: "businessOwnerId",
      as: "businessOwner",
    });

    NewHomeRequest.belongsTo(models.CleanerClient, {
      foreignKey: "existingCleanerClientId",
      as: "existingRelationship",
    });
  };

  /**
   * Check if request has expired
   */
  NewHomeRequest.prototype.isExpired = function () {
    if (!this.expiresAt) return false;
    return new Date() > new Date(this.expiresAt);
  };

  /**
   * Check if request is still pending
   */
  NewHomeRequest.prototype.isPending = function () {
    return this.status === "pending" && !this.isExpired();
  };

  /**
   * Check if request can be re-requested (30 day rate limit)
   */
  NewHomeRequest.prototype.canRequestAgain = function () {
    if (this.status !== "declined" && this.status !== "expired") return false;
    if (!this.lastRequestedAt) return true;

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    return new Date(this.lastRequestedAt) < thirtyDaysAgo;
  };

  /**
   * Get days until can request again
   */
  NewHomeRequest.prototype.daysUntilCanRequestAgain = function () {
    if (this.canRequestAgain()) return 0;
    if (!this.lastRequestedAt) return 0;

    const lastRequest = new Date(this.lastRequestedAt);
    const canRequestDate = new Date(lastRequest);
    canRequestDate.setDate(canRequestDate.getDate() + 30);

    const now = new Date();
    const diffTime = canRequestDate - now;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return Math.max(0, diffDays);
  };

  /**
   * Accept the request
   */
  NewHomeRequest.prototype.accept = async function () {
    this.status = "accepted";
    this.respondedAt = new Date();
    await this.save();
    return this;
  };

  /**
   * Decline the request
   */
  NewHomeRequest.prototype.decline = async function (reason = null) {
    this.status = "declined";
    this.respondedAt = new Date();
    this.declineReason = reason;
    await this.save();
    return this;
  };

  /**
   * Mark as expired
   */
  NewHomeRequest.prototype.expire = async function () {
    this.status = "expired";
    await this.save();
    return this;
  };

  /**
   * Cancel the request
   */
  NewHomeRequest.prototype.cancel = async function () {
    this.status = "cancelled";
    await this.save();
    return this;
  };

  /**
   * Re-request after decline (updates timestamps for rate limiting)
   */
  NewHomeRequest.prototype.requestAgain = async function () {
    this.status = "pending";
    this.lastRequestedAt = new Date();
    this.requestCount += 1;
    this.respondedAt = null;
    this.declineReason = null;
    // Reset expiration to 48 hours from now
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 48);
    this.expiresAt = expiresAt;
    await this.save();
    return this;
  };

  /**
   * Find pending requests for a specific business owner
   */
  NewHomeRequest.findPendingForBusinessOwner = async function (businessOwnerId) {
    const { Op } = require("sequelize");
    return NewHomeRequest.findAll({
      where: {
        businessOwnerId,
        status: "pending",
        [Op.or]: [
          { expiresAt: null },
          { expiresAt: { [Op.gt]: new Date() } },
        ],
      },
      include: [
        { model: sequelize.models.User, as: "client" },
        { model: sequelize.models.UserHomes, as: "home" },
        { model: sequelize.models.CleanerClient, as: "existingRelationship" },
      ],
      order: [["createdAt", "DESC"]],
    });
  };

  /**
   * Find all requests for a specific home
   */
  NewHomeRequest.findByHome = async function (homeId) {
    return NewHomeRequest.findAll({
      where: { homeId },
      include: [
        { model: sequelize.models.User, as: "client" },
        { model: sequelize.models.User, as: "businessOwner" },
      ],
      order: [["createdAt", "DESC"]],
    });
  };

  /**
   * Find expired pending requests that need processing
   */
  NewHomeRequest.findExpiredPendingRequests = async function () {
    const { Op } = require("sequelize");
    return NewHomeRequest.findAll({
      where: {
        status: "pending",
        expiresAt: {
          [Op.lt]: new Date(),
        },
      },
      include: [
        { model: sequelize.models.User, as: "client" },
        { model: sequelize.models.User, as: "businessOwner" },
        { model: sequelize.models.UserHomes, as: "home" },
      ],
    });
  };

  /**
   * Find existing request for a home + business owner combination
   */
  NewHomeRequest.findExisting = async function (homeId, businessOwnerId) {
    return NewHomeRequest.findOne({
      where: { homeId, businessOwnerId },
      include: [
        { model: sequelize.models.User, as: "client" },
        { model: sequelize.models.User, as: "businessOwner" },
        { model: sequelize.models.UserHomes, as: "home" },
      ],
    });
  };

  return NewHomeRequest;
};
