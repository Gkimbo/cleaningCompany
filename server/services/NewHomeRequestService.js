const {
  NewHomeRequest,
  CleanerClient,
  UserHomes,
  User,
  PricingConfig,
  Notification,
} = require("../models");
const { Op } = require("sequelize");
const NotificationService = require("./NotificationService");
const EncryptionService = require("./EncryptionService");
const crypto = require("crypto");

/**
 * NewHomeRequestService
 *
 * Handles the workflow when a business client adds a new home:
 * 1. Detect existing business owner relationships
 * 2. Create requests for each business owner
 * 3. Handle accept (create CleanerClient) / decline
 * 4. Handle re-requests (rate limited to 30 days)
 * 5. Toggle marketplace visibility for declined homes
 */
class NewHomeRequestService {
  /**
   * Find all active business owner relationships for a client
   * Returns unique business owners (deduplicated by cleanerId)
   * @param {number} clientId - The homeowner's user ID
   * @returns {Array<CleanerClient>} Active cleaner-client relationships (one per business owner)
   */
  static async findExistingBusinessOwnerRelationships(clientId) {
    const allRelationships = await CleanerClient.findAll({
      where: {
        clientId,
        status: "active",
      },
      include: [
        {
          model: User,
          as: "cleaner",
          where: {
            isBusinessOwner: true, // Only include business owners
          },
          attributes: ["id", "firstName", "lastName", "email", "isBusinessOwner"],
        },
      ],
      order: [["createdAt", "ASC"]], // Use oldest relationship for consistency
    });

    // Deduplicate by cleanerId - keep only one record per business owner
    const seenCleanerIds = new Set();
    const uniqueRelationships = [];

    for (const relationship of allRelationships) {
      if (!seenCleanerIds.has(relationship.cleanerId)) {
        seenCleanerIds.add(relationship.cleanerId);
        uniqueRelationships.push(relationship);
      }
    }

    return uniqueRelationships;
  }

  /**
   * Calculate price for a home based on platform pricing
   * Formula: basePrice + (extraBeds × extraBedBathFee) + (extraBaths × extraBedBathFee)
   * @param {number} numBeds - Number of bedrooms
   * @param {number} numBaths - Number of bathrooms
   * @returns {Promise<number>} Price in dollars
   */
  static async calculateHomePrice(numBeds, numBaths) {
    const config = await PricingConfig.getActive();
    if (!config) {
      // Fallback to defaults if no config
      const basePrice = 150;
      const extraBedBathFee = 50;
      const extraBeds = Math.max(0, numBeds - 1);
      const extraBaths = Math.max(0, numBaths - 1);
      return basePrice + (extraBeds * extraBedBathFee) + (extraBaths * extraBedBathFee);
    }

    const extraBeds = Math.max(0, numBeds - 1);
    const extraBaths = Math.max(0, Math.floor(numBaths) - 1);
    const halfBaths = numBaths % 1 >= 0.5 ? 1 : 0;

    return (
      config.basePrice +
      extraBeds * config.extraBedBathFee +
      extraBaths * config.extraBedBathFee +
      halfBaths * (config.halfBathFee || 25)
    );
  }

  /**
   * Create a new home request for a business owner
   * @param {Object} params
   * @param {number} params.homeId - The new home's ID
   * @param {number} params.clientId - The client's user ID
   * @param {number} params.businessOwnerId - The business owner's user ID
   * @param {number} params.existingCleanerClientId - The existing relationship ID
   * @param {Object} params.io - Socket.io instance (optional)
   * @returns {Promise<NewHomeRequest>}
   */
  static async createRequest({ homeId, clientId, businessOwnerId, existingCleanerClientId, io = null }) {
    // Check if request already exists for this home + business owner
    const existingRequest = await NewHomeRequest.findExisting(homeId, businessOwnerId);
    if (existingRequest) {
      // If pending, return existing
      if (existingRequest.status === "pending") {
        return existingRequest;
      }
      // If declined and can request again, will be handled by requestAgain
      return existingRequest;
    }

    // Get home details for price calculation
    const home = await UserHomes.findByPk(homeId);
    if (!home) {
      throw new Error("Home not found");
    }

    // Get client details for notification
    const client = await User.findByPk(clientId, {
      attributes: ["id", "firstName", "lastName"],
    });
    if (!client) {
      throw new Error("Client not found");
    }

    // Calculate price
    const numBeds = parseInt(home.numBeds) || 1;
    const numBaths = parseFloat(home.numBaths) || 1;
    const calculatedPrice = await this.calculateHomePrice(numBeds, numBaths);

    // Set expiration to 48 hours from now
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 48);

    // Create the request
    const request = await NewHomeRequest.create({
      homeId,
      clientId,
      businessOwnerId,
      existingCleanerClientId,
      status: "pending",
      expiresAt,
      calculatedPrice,
      numBeds,
      numBaths,
      lastRequestedAt: new Date(),
      requestCount: 1,
    });

    // Send notification to business owner
    const clientName = `${client.firstName} ${client.lastName}`.trim();
    const homeAddress = `${home.address}, ${home.city}`;

    await NotificationService.notifyNewHomeRequest({
      businessOwnerId,
      clientId,
      clientName,
      homeId,
      homeAddress,
      calculatedPrice,
      numBeds,
      numBaths,
      requestId: request.id,
      io,
    });

    return request;
  }

  /**
   * Create requests for all business owners when a client adds a new home
   * @param {number} homeId - The new home's ID
   * @param {number} clientId - The client's user ID
   * @param {Object} io - Socket.io instance (optional)
   * @returns {Promise<Array<NewHomeRequest>>} Created requests
   */
  static async createRequestsForNewHome(homeId, clientId, io = null) {
    const relationships = await this.findExistingBusinessOwnerRelationships(clientId);

    if (relationships.length === 0) {
      return [];
    }

    const requests = [];
    for (const relationship of relationships) {
      try {
        const request = await this.createRequest({
          homeId,
          clientId,
          businessOwnerId: relationship.cleanerId,
          existingCleanerClientId: relationship.id,
          io,
        });
        requests.push(request);
      } catch (error) {
        console.error(
          `[NewHomeRequestService] Error creating request for BO ${relationship.cleanerId}:`,
          error.message
        );
      }
    }

    return requests;
  }

  /**
   * Business owner accepts the request - create new CleanerClient
   * @param {number} requestId - The request ID
   * @param {number} businessOwnerId - The business owner's user ID
   * @param {Object} io - Socket.io instance (optional)
   * @returns {Promise<{request: NewHomeRequest, cleanerClient: CleanerClient}>}
   */
  static async acceptRequest(requestId, businessOwnerId, io = null) {
    const request = await NewHomeRequest.findByPk(requestId, {
      include: [
        { model: User, as: "client" },
        { model: UserHomes, as: "home" },
        { model: User, as: "businessOwner" },
      ],
    });

    if (!request) {
      throw new Error("Request not found");
    }

    if (request.businessOwnerId !== businessOwnerId) {
      throw new Error("Not authorized to accept this request");
    }

    if (request.status !== "pending") {
      throw new Error(`Request is already ${request.status}`);
    }

    if (request.isExpired()) {
      throw new Error("Request has expired");
    }

    // Check if CleanerClient already exists for this home + cleaner
    const existingCleanerClient = await CleanerClient.findOne({
      where: {
        cleanerId: businessOwnerId,
        homeId: request.homeId,
      },
    });

    if (existingCleanerClient) {
      // If already exists and active, just accept the request
      if (existingCleanerClient.status === "active") {
        await request.accept();
        return { request, cleanerClient: existingCleanerClient };
      }
      // If exists but inactive, reactivate it
      existingCleanerClient.status = "active";
      existingCleanerClient.acceptedAt = new Date();
      existingCleanerClient.defaultPrice = request.calculatedPrice;
      await existingCleanerClient.save();
      await request.accept();

      // Notify client - decrypt fields for notification display
      // Access raw dataValues and decrypt to ensure we get plain text
      const boFirstNameRaw = request.businessOwner.dataValues?.firstName || request.businessOwner.firstName;
      const boLastNameRaw = request.businessOwner.dataValues?.lastName || request.businessOwner.lastName;
      const boFirstName = EncryptionService.decrypt(boFirstNameRaw) || boFirstNameRaw;
      const boLastName = EncryptionService.decrypt(boLastNameRaw) || boLastNameRaw;
      const businessOwnerName = `${boFirstName} ${boLastName}`.trim();

      const homeAddrRaw = request.home.dataValues?.address || request.home.address;
      const homeCityRaw = request.home.dataValues?.city || request.home.city;
      const homeAddr = EncryptionService.decrypt(homeAddrRaw) || homeAddrRaw;
      const homeCity = EncryptionService.decrypt(homeCityRaw) || homeCityRaw;
      const homeAddress = `${homeAddr}, ${homeCity}`;

      await NotificationService.notifyNewHomeAccepted({
        clientId: request.clientId,
        businessOwnerId,
        businessOwnerName,
        homeId: request.homeId,
        homeAddress,
        price: request.calculatedPrice,
        io,
      });

      // Clear the action-required flag on the original notification
      await Notification.update(
        { actionRequired: false, isRead: true },
        {
          where: {
            userId: businessOwnerId,
            type: "new_home_request",
            "data.requestId": requestId,
          },
        }
      );

      // Emit socket event to update badge count in real-time
      if (io) {
        const [unreadCount, actionRequiredCount] = await Promise.all([
          Notification.getUnreadCount(businessOwnerId),
          Notification.getActionRequiredCount(businessOwnerId),
        ]);
        io.to(`user_${businessOwnerId}`).emit("notification_count_update", {
          unreadCount,
          actionRequiredCount,
        });
      }

      return { request, cleanerClient: existingCleanerClient };
    }

    // Accept the request
    await request.accept();

    // Generate invite token for the new CleanerClient
    const inviteToken = crypto.randomBytes(32).toString("hex");

    // Create new CleanerClient linking business owner to this home
    const cleanerClient = await CleanerClient.create({
      cleanerId: businessOwnerId,
      clientId: request.clientId,
      homeId: request.homeId,
      inviteToken,
      invitedEmail: request.client.email || "",
      invitedName: `${request.client.firstName} ${request.client.lastName}`.trim(),
      status: "active",
      invitedAt: new Date(),
      acceptedAt: new Date(),
      defaultPrice: request.calculatedPrice,
    });

    // Notify client - decrypt fields for notification display
    // Access raw dataValues and decrypt to ensure we get plain text
    const boFirstNameRaw2 = request.businessOwner.dataValues?.firstName || request.businessOwner.firstName;
    const boLastNameRaw2 = request.businessOwner.dataValues?.lastName || request.businessOwner.lastName;
    const boFirstName2 = EncryptionService.decrypt(boFirstNameRaw2) || boFirstNameRaw2;
    const boLastName2 = EncryptionService.decrypt(boLastNameRaw2) || boLastNameRaw2;
    const businessOwnerName = `${boFirstName2} ${boLastName2}`.trim();

    const homeAddrRaw2 = request.home.dataValues?.address || request.home.address;
    const homeCityRaw2 = request.home.dataValues?.city || request.home.city;
    const homeAddr2 = EncryptionService.decrypt(homeAddrRaw2) || homeAddrRaw2;
    const homeCity2 = EncryptionService.decrypt(homeCityRaw2) || homeCityRaw2;
    const homeAddress = `${homeAddr2}, ${homeCity2}`;

    await NotificationService.notifyNewHomeAccepted({
      clientId: request.clientId,
      businessOwnerId,
      businessOwnerName,
      homeId: request.homeId,
      homeAddress,
      price: request.calculatedPrice,
      io,
    });

    // Clear the action-required flag on the original notification
    await Notification.update(
      { actionRequired: false, isRead: true },
      {
        where: {
          userId: businessOwnerId,
          type: "new_home_request",
          "data.requestId": requestId,
        },
      }
    );

    // Emit socket event to update badge count in real-time
    if (io) {
      const [unreadCount, actionRequiredCount] = await Promise.all([
        Notification.getUnreadCount(businessOwnerId),
        Notification.getActionRequiredCount(businessOwnerId),
      ]);
      io.to(`user_${businessOwnerId}`).emit("notification_count_update", {
        unreadCount,
        actionRequiredCount,
      });
    }

    return { request, cleanerClient };
  }

  /**
   * Business owner declines the request
   * @param {number} requestId - The request ID
   * @param {number} businessOwnerId - The business owner's user ID
   * @param {string} reason - Optional decline reason
   * @param {Object} io - Socket.io instance (optional)
   * @returns {Promise<NewHomeRequest>}
   */
  static async declineRequest(requestId, businessOwnerId, reason = null, io = null) {
    const request = await NewHomeRequest.findByPk(requestId, {
      include: [
        { model: User, as: "client" },
        { model: UserHomes, as: "home" },
        { model: User, as: "businessOwner" },
      ],
    });

    if (!request) {
      throw new Error("Request not found");
    }

    if (request.businessOwnerId !== businessOwnerId) {
      throw new Error("Not authorized to decline this request");
    }

    if (request.status !== "pending") {
      throw new Error(`Request is already ${request.status}`);
    }

    // Decline the request
    await request.decline(reason);

    // Notify client - decrypt fields for notification display
    // Access raw dataValues and decrypt to ensure we get plain text
    const boFirstNameRawD = request.businessOwner.dataValues?.firstName || request.businessOwner.firstName;
    const boLastNameRawD = request.businessOwner.dataValues?.lastName || request.businessOwner.lastName;
    const boFirstNameD = EncryptionService.decrypt(boFirstNameRawD) || boFirstNameRawD;
    const boLastNameD = EncryptionService.decrypt(boLastNameRawD) || boLastNameRawD;
    const businessOwnerName = `${boFirstNameD} ${boLastNameD}`.trim();

    const homeAddrRawD = request.home.dataValues?.address || request.home.address;
    const homeCityRawD = request.home.dataValues?.city || request.home.city;
    const homeAddrD = EncryptionService.decrypt(homeAddrRawD) || homeAddrRawD;
    const homeCityD = EncryptionService.decrypt(homeCityRawD) || homeCityRawD;
    const homeAddress = `${homeAddrD}, ${homeCityD}`;

    await NotificationService.notifyNewHomeDeclined({
      clientId: request.clientId,
      businessOwnerId,
      businessOwnerName,
      homeId: request.homeId,
      homeAddress,
      reason,
      io,
    });

    // Clear the action-required flag on the original notification
    await Notification.update(
      { actionRequired: false, isRead: true },
      {
        where: {
          userId: businessOwnerId,
          type: "new_home_request",
          "data.requestId": requestId,
        },
      }
    );

    // Emit socket event to update badge count in real-time
    if (io) {
      const [unreadCount, actionRequiredCount] = await Promise.all([
        Notification.getUnreadCount(businessOwnerId),
        Notification.getActionRequiredCount(businessOwnerId),
      ]);
      io.to(`user_${businessOwnerId}`).emit("notification_count_update", {
        unreadCount,
        actionRequiredCount,
      });
    }

    return request;
  }

  /**
   * Client re-requests cleaning after decline (30-day rate limit)
   * @param {number} requestId - The request ID
   * @param {number} clientId - The client's user ID
   * @param {Object} io - Socket.io instance (optional)
   * @returns {Promise<NewHomeRequest>}
   */
  static async requestAgain(requestId, clientId, io = null) {
    const request = await NewHomeRequest.findByPk(requestId, {
      include: [
        { model: User, as: "client" },
        { model: UserHomes, as: "home" },
        { model: User, as: "businessOwner" },
      ],
    });

    if (!request) {
      throw new Error("Request not found");
    }

    if (request.clientId !== clientId) {
      throw new Error("Not authorized to re-request");
    }

    if (request.status !== "declined" && request.status !== "expired") {
      throw new Error("Can only re-request declined or expired requests");
    }

    if (!request.canRequestAgain()) {
      const daysRemaining = request.daysUntilCanRequestAgain();
      throw new Error(`Can only request again after 30 days. ${daysRemaining} days remaining.`);
    }

    // Re-request
    await request.requestAgain();

    // Send notification to business owner
    const clientName = `${request.client.firstName} ${request.client.lastName}`.trim();
    const homeAddress = `${request.home.address}, ${request.home.city}`;

    await NotificationService.notifyNewHomeRequest({
      businessOwnerId: request.businessOwnerId,
      clientId,
      clientName,
      homeId: request.homeId,
      homeAddress,
      calculatedPrice: request.calculatedPrice,
      numBeds: request.numBeds,
      numBaths: request.numBaths,
      requestId: request.id,
      isReRequest: true,
      io,
    });

    return request;
  }

  /**
   * Toggle marketplace visibility for a home
   * @param {number} homeId - The home's ID
   * @param {number} clientId - The client's user ID (for authorization)
   * @param {boolean} enabled - Whether to enable marketplace
   * @returns {Promise<UserHomes>}
   */
  static async toggleHomeMarketplace(homeId, clientId, enabled) {
    const home = await UserHomes.findByPk(homeId);

    if (!home) {
      throw new Error("Home not found");
    }

    if (home.userId !== clientId) {
      throw new Error("Not authorized to modify this home");
    }

    home.isMarketplaceEnabled = enabled;
    await home.save();

    return home;
  }

  /**
   * Get all requests for a client's homes
   * @param {number} clientId - The client's user ID
   * @returns {Promise<Array<NewHomeRequest>>}
   */
  static async getRequestsForClient(clientId) {
    return NewHomeRequest.findAll({
      where: { clientId },
      include: [
        { model: UserHomes, as: "home" },
        {
          model: User,
          as: "businessOwner",
          attributes: ["id", "firstName", "lastName"],
        },
      ],
      order: [["createdAt", "DESC"]],
    });
  }

  /**
   * Get request status for a specific home
   * @param {number} homeId - The home's ID
   * @param {number} clientId - The client's user ID (for authorization)
   * @returns {Promise<Array<NewHomeRequest>>}
   */
  static async getRequestStatusForHome(homeId, clientId) {
    const home = await UserHomes.findByPk(homeId);
    if (!home || home.userId !== clientId) {
      throw new Error("Home not found or not authorized");
    }

    return NewHomeRequest.findAll({
      where: { homeId },
      include: [
        {
          model: User,
          as: "businessOwner",
          attributes: ["id", "firstName", "lastName"],
        },
      ],
      order: [["createdAt", "DESC"]],
    });
  }

  /**
   * Get pending requests for a business owner
   * @param {number} businessOwnerId - The business owner's user ID
   * @returns {Promise<Array<NewHomeRequest>>}
   */
  static async getPendingForBusinessOwner(businessOwnerId) {
    return NewHomeRequest.findPendingForBusinessOwner(businessOwnerId);
  }

  /**
   * Process expired requests (for cron job)
   * @param {Object} io - Socket.io instance (optional)
   */
  static async processExpiredRequests(io = null) {
    const expiredRequests = await NewHomeRequest.findExpiredPendingRequests();

    for (const request of expiredRequests) {
      try {
        await request.expire();
        console.log(`[NewHomeRequestService] Expired request ${request.id}`);

        // Optionally notify both parties about expiration
        // For now, just mark as expired
      } catch (error) {
        console.error(
          `[NewHomeRequestService] Error expiring request ${request.id}:`,
          error.message
        );
      }
    }

    return expiredRequests.length;
  }
}

module.exports = NewHomeRequestService;
