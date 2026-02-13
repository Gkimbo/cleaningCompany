const express = require("express");
const router = express.Router();
const authenticateToken = require("../../../middleware/authenticatedToken");
const NewHomeRequestService = require("../../../services/NewHomeRequestService");
const { NewHomeRequest, UserHomes } = require("../../../models");

/**
 * New Home Request Router
 *
 * Handles requests when business clients add new homes:
 * - Business owners can accept/decline
 * - Clients can toggle marketplace, request again
 */

// All routes require authentication
router.use(authenticateToken);

// =====================================
// BUSINESS OWNER ENDPOINTS (must come before :param routes)
// =====================================

/**
 * GET /new-home-requests/pending
 * Get pending requests for business owner
 */
router.get("/pending", async (req, res) => {
  try {
    const requests = await NewHomeRequestService.getPendingForBusinessOwner(req.userId);

    const formattedRequests = requests.map((request) => ({
      id: request.id,
      homeId: request.homeId,
      clientId: request.clientId,
      status: request.status,
      calculatedPrice: request.calculatedPrice,
      numBeds: request.numBeds,
      numBaths: request.numBaths,
      expiresAt: request.expiresAt,
      requestCount: request.requestCount,
      createdAt: request.createdAt,
      home: request.home
        ? {
            id: request.home.id,
            nickName: request.home.nickName,
            address: request.home.address,
            city: request.home.city,
            state: request.home.state,
          }
        : null,
      client: request.client
        ? {
            id: request.client.id,
            name: `${request.client.firstName} ${request.client.lastName}`.trim(),
            profileImage: request.client.profileImage,
          }
        : null,
    }));

    res.json({ success: true, requests: formattedRequests });
  } catch (error) {
    console.error("[newHomeRequestRouter] GET /pending error:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// =====================================
// CLIENT ENDPOINTS
// =====================================

/**
 * GET /new-home-requests
 * Get all new home requests for the current client
 */
router.get("/", async (req, res) => {
  try {
    const requests = await NewHomeRequestService.getRequestsForClient(req.userId);

    // Add computed fields
    const formattedRequests = requests.map((request) => ({
      id: request.id,
      homeId: request.homeId,
      businessOwnerId: request.businessOwnerId,
      status: request.status,
      calculatedPrice: request.calculatedPrice,
      numBeds: request.numBeds,
      numBaths: request.numBaths,
      declineReason: request.declineReason,
      requestCount: request.requestCount,
      canRequestAgain: request.canRequestAgain(),
      daysUntilCanRequestAgain: request.daysUntilCanRequestAgain(),
      createdAt: request.createdAt,
      respondedAt: request.respondedAt,
      home: request.home
        ? {
            id: request.home.id,
            nickName: request.home.nickName,
            address: request.home.address,
            city: request.home.city,
            isMarketplaceEnabled: request.home.isMarketplaceEnabled,
          }
        : null,
      businessOwner: request.businessOwner
        ? {
            id: request.businessOwner.id,
            name: `${request.businessOwner.firstName} ${request.businessOwner.lastName}`.trim(),
          }
        : null,
    }));

    res.json({ success: true, requests: formattedRequests });
  } catch (error) {
    console.error("[newHomeRequestRouter] GET / error:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /new-home-requests/:homeId/status
 * Get request status for a specific home
 */
router.get("/:homeId/status", async (req, res) => {
  try {
    const { homeId } = req.params;
    const requests = await NewHomeRequestService.getRequestStatusForHome(
      parseInt(homeId),
      req.userId
    );

    const formattedRequests = requests.map((request) => ({
      id: request.id,
      businessOwnerId: request.businessOwnerId,
      status: request.status,
      calculatedPrice: request.calculatedPrice,
      declineReason: request.declineReason,
      requestCount: request.requestCount,
      canRequestAgain: request.canRequestAgain(),
      daysUntilCanRequestAgain: request.daysUntilCanRequestAgain(),
      createdAt: request.createdAt,
      respondedAt: request.respondedAt,
      businessOwner: request.businessOwner
        ? {
            id: request.businessOwner.id,
            name: `${request.businessOwner.firstName} ${request.businessOwner.lastName}`.trim(),
          }
        : null,
    }));

    // Also get home's marketplace status
    const home = await UserHomes.findByPk(homeId);

    res.json({
      success: true,
      requests: formattedRequests,
      isMarketplaceEnabled: home?.isMarketplaceEnabled || false,
    });
  } catch (error) {
    console.error("[newHomeRequestRouter] GET /:homeId/status error:", error);
    res.status(400).json({ success: false, error: error.message });
  }
});

/**
 * POST /new-home-requests/:requestId/request-again
 * Re-request cleaning after decline (30-day rate limit)
 */
router.post("/:requestId/request-again", async (req, res) => {
  try {
    const { requestId } = req.params;
    const io = req.app.get("io");

    const request = await NewHomeRequestService.requestAgain(
      parseInt(requestId),
      req.userId,
      io
    );

    res.json({
      success: true,
      message: "Request sent again successfully",
      request: {
        id: request.id,
        status: request.status,
        requestCount: request.requestCount,
        lastRequestedAt: request.lastRequestedAt,
      },
    });
  } catch (error) {
    console.error("[newHomeRequestRouter] POST /:requestId/request-again error:", error);
    res.status(400).json({ success: false, error: error.message });
  }
});

/**
 * PATCH /new-home-requests/:homeId/marketplace
 * Toggle marketplace visibility for a home
 */
router.patch("/:homeId/marketplace", async (req, res) => {
  try {
    const { homeId } = req.params;
    const { enabled } = req.body;

    if (typeof enabled !== "boolean") {
      return res.status(400).json({
        success: false,
        error: "enabled must be a boolean",
      });
    }

    const home = await NewHomeRequestService.toggleHomeMarketplace(
      parseInt(homeId),
      req.userId,
      enabled
    );

    res.json({
      success: true,
      message: enabled
        ? "Home is now visible on the marketplace"
        : "Home is no longer on the marketplace",
      isMarketplaceEnabled: home.isMarketplaceEnabled,
    });
  } catch (error) {
    console.error("[newHomeRequestRouter] PATCH /:homeId/marketplace error:", error);
    res.status(400).json({ success: false, error: error.message });
  }
});

// =====================================
// BUSINESS OWNER ACCEPT/DECLINE ENDPOINTS
// =====================================

/**
 * POST /new-home-requests/:requestId/accept
 * Accept a new home request
 */
router.post("/:requestId/accept", async (req, res) => {
  try {
    const { requestId } = req.params;
    const io = req.app.get("io");

    const { request, cleanerClient } = await NewHomeRequestService.acceptRequest(
      parseInt(requestId),
      req.userId,
      io
    );

    res.json({
      success: true,
      message: "Home accepted! A new client relationship has been created.",
      request: {
        id: request.id,
        status: request.status,
        respondedAt: request.respondedAt,
      },
      cleanerClient: {
        id: cleanerClient.id,
        homeId: cleanerClient.homeId,
        defaultPrice: cleanerClient.defaultPrice,
      },
    });
  } catch (error) {
    console.error("[newHomeRequestRouter] POST /:requestId/accept error:", error);
    res.status(400).json({ success: false, error: error.message });
  }
});

/**
 * POST /new-home-requests/:requestId/decline
 * Decline a new home request
 */
router.post("/:requestId/decline", async (req, res) => {
  try {
    const { requestId } = req.params;
    const { reason } = req.body;
    const io = req.app.get("io");

    const request = await NewHomeRequestService.declineRequest(
      parseInt(requestId),
      req.userId,
      reason || null,
      io
    );

    res.json({
      success: true,
      message: "Request declined. The client has been notified.",
      request: {
        id: request.id,
        status: request.status,
        respondedAt: request.respondedAt,
        declineReason: request.declineReason,
      },
    });
  } catch (error) {
    console.error("[newHomeRequestRouter] POST /:requestId/decline error:", error);
    res.status(400).json({ success: false, error: error.message });
  }
});

module.exports = router;
