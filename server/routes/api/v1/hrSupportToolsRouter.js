/**
 * HR Support Tools Router
 * Provides conflict resolution tools for HR staff
 * Tools for home size disputes, cancellation appeals, and user management
 */

const express = require("express");
const { Op } = require("sequelize");
const {
  User,
  UserHomes,
  UserAppointments,
  HomeSizeAdjustmentRequest,
  CancellationAppeal,
  JobLedger,
  UserReviews,
  Notification,
  HRAuditLog,
} = require("../../../models");
const verifyHROrOwner = require("../../../middleware/verifyHROrOwner");
const EncryptionService = require("../../../services/EncryptionService");

const hrSupportToolsRouter = express.Router();

// Helper to safely decrypt a field with error handling
const safeDecrypt = (value) => {
  if (!value) return null;
  try {
    return EncryptionService.decrypt(value);
  } catch (error) {
    console.error("Decryption failed:", error.message);
    return "[encrypted]";
  }
};

// Simple in-memory rate limiter for sensitive HR actions
const rateLimitStore = new Map();
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute
const RATE_LIMIT_MAX_REQUESTS = 10; // max 10 requests per minute per action per user

const rateLimitSensitiveAction = (actionType) => (req, res, next) => {
  const userId = req.user?.id;
  const key = `hr:${actionType}:${userId}`;
  const now = Date.now();

  // Clean up old entries
  const entry = rateLimitStore.get(key);
  if (entry && now - entry.windowStart > RATE_LIMIT_WINDOW_MS) {
    rateLimitStore.delete(key);
  }

  const current = rateLimitStore.get(key) || { count: 0, windowStart: now };

  if (current.count >= RATE_LIMIT_MAX_REQUESTS) {
    const retryAfter = Math.ceil((RATE_LIMIT_WINDOW_MS - (now - current.windowStart)) / 1000);
    return res.status(429).json({
      error: "Too many requests. Please wait before trying again.",
      retryAfter,
    });
  }

  current.count += 1;
  if (!rateLimitStore.has(key)) {
    current.windowStart = now;
  }
  rateLimitStore.set(key, current);
  next();
};

// Maximum credit amount that can be issued (in dollars)
const MAX_CREDIT_AMOUNT = 500;

// Helper to log HR audit actions
const logHRAuditAction = async (userId, action, targetUserId, details) => {
  try {
    // Try to create audit log if table exists
    if (HRAuditLog) {
      await HRAuditLog.create({
        hrUserId: userId,
        action,
        targetUserId,
        details,
        timestamp: new Date(),
      });
    }
  } catch (e) {
    // Table may not exist, just log to console
    console.log(`[HR AUDIT] User ${userId} performed ${action} on target ${targetUserId}: ${JSON.stringify(details)}`);
  }
};

// Apply middleware to all routes
hrSupportToolsRouter.use(verifyHROrOwner);

// ============================================================================
// USER SEARCH & PROFILE TOOLS
// ============================================================================

/**
 * GET /search
 * Search for users by name, email, or username
 */
hrSupportToolsRouter.get("/search", async (req, res) => {
  try {
    const { query, type } = req.query;

    if (!query || query.length < 2) {
      return res.status(400).json({ error: "Search query must be at least 2 characters" });
    }

    let users = [];

    // First, search by username (always do this)
    const usernameWhere = {
      username: { [Op.iLike]: `%${query}%` },
    };
    if (type) usernameWhere.type = type;

    const usernameMatches = await User.findAll({
      where: usernameWhere,
      attributes: ["id", "username", "firstName", "lastName", "email", "type", "createdAt"],
      limit: 10,
      order: [["createdAt", "DESC"]],
    });
    users = [...usernameMatches];

    // Also search by email hash if query looks like an email
    if (query.includes("@")) {
      const emailHash = EncryptionService.hash(query.toLowerCase());
      const emailWhere = { emailHash };
      if (type) emailWhere.type = type;

      const emailMatches = await User.findAll({
        where: emailWhere,
        attributes: ["id", "username", "firstName", "lastName", "email", "type", "createdAt"],
        limit: 10,
      });

      // Avoid duplicates
      const existingIds = new Set(users.map(u => u.id));
      users = [...users, ...emailMatches.filter(u => !existingIds.has(u.id))];
    }

    // Decrypt and serialize
    const results = users.map((u) => ({
      id: u.id,
      username: u.username,
      firstName: safeDecrypt(u.firstName),
      lastName: safeDecrypt(u.lastName),
      email: safeDecrypt(u.email),
      type: u.type,
      createdAt: u.createdAt,
    }));

    return res.status(200).json({ users: results });
  } catch (error) {
    console.error("Error searching users:", error);
    return res.status(500).json({ error: "Failed to search users" });
  }
});

/**
 * GET /user/:userId/profile
 * Get comprehensive user profile for HR review
 */
hrSupportToolsRouter.get("/user/:userId/profile", async (req, res) => {
  try {
    const { userId } = req.params;

    const user = await User.findByPk(userId, {
      attributes: [
        "id", "username", "firstName", "lastName", "email", "phone", "type",
        "createdAt", "falseClaimCount", "falseHomeSizeCount", "ownerPrivateNotes",
        "cancellationCount", "lateCancellationCount", "noShowCount",
      ],
    });

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    // Get user's homes if homeowner
    let homes = [];
    if (user.type === "homeowner") {
      homes = await UserHomes.findAll({
        where: { userId: user.id },
        attributes: ["id", "address", "city", "state", "zipcode", "numBeds", "numBaths", "numHalfBaths", "nickName"],
      });
    }

    // Get recent appointments
    const appointments = await UserAppointments.findAll({
      where: { userId: user.id },
      attributes: ["id", "date", "price", "status", "cancellationStatus"],
      order: [["date", "DESC"]],
      limit: 10,
    });

    // Get dispute/appeal counts
    let homeSizeDisputes = 0;
    let cancellationAppeals = 0;

    if (user.type === "cleaner") {
      homeSizeDisputes = await HomeSizeAdjustmentRequest.count({
        where: { cleanerId: user.id },
      });
    } else if (user.type === "homeowner") {
      homeSizeDisputes = await HomeSizeAdjustmentRequest.count({
        where: { homeownerId: user.id },
      });
    }

    try {
      cancellationAppeals = await CancellationAppeal.count({
        where: { appealerId: user.id },
      });
    } catch (e) {
      // Table may not exist
    }

    // Get review stats
    const reviewsReceived = await UserReviews.count({
      where: { userId: user.id },
    });

    const profile = {
      id: user.id,
      username: user.username,
      firstName: safeDecrypt(user.firstName),
      lastName: safeDecrypt(user.lastName),
      email: safeDecrypt(user.email),
      phone: safeDecrypt(user.phone),
      type: user.type,
      createdAt: user.createdAt,
      ownerPrivateNotes: user.ownerPrivateNotes,
      stats: {
        falseClaimCount: user.falseClaimCount || 0,
        falseHomeSizeCount: user.falseHomeSizeCount || 0,
        cancellationCount: user.cancellationCount || 0,
        lateCancellationCount: user.lateCancellationCount || 0,
        noShowCount: user.noShowCount || 0,
        homeSizeDisputes,
        cancellationAppeals,
        reviewsReceived,
      },
      homes,
      recentAppointments: appointments,
    };

    return res.status(200).json({ profile });
  } catch (error) {
    console.error("Error fetching user profile:", error);
    return res.status(500).json({ error: "Failed to fetch user profile" });
  }
});

/**
 * PATCH /user/:userId/notes
 * Update HR/owner private notes on a user
 */
hrSupportToolsRouter.patch("/user/:userId/notes", async (req, res) => {
  try {
    const { userId } = req.params;
    const { notes } = req.body;

    const user = await User.findByPk(userId);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    await user.update({ ownerPrivateNotes: notes });

    console.log(`✅ HR notes updated for user ${userId} by ${req.user.id}`);

    return res.status(200).json({
      message: "Notes updated successfully",
      ownerPrivateNotes: user.ownerPrivateNotes,
    });
  } catch (error) {
    console.error("Error updating user notes:", error);
    return res.status(500).json({ error: "Failed to update notes" });
  }
});

// ============================================================================
// HOME SIZE DISPUTE TOOLS
// ============================================================================

/**
 * GET /home/:homeId/details
 * Get home details with history
 */
hrSupportToolsRouter.get("/home/:homeId/details", async (req, res) => {
  try {
    const { homeId } = req.params;

    const home = await UserHomes.findByPk(homeId, {
      include: [
        {
          model: User,
          as: "user",
          attributes: ["id", "username", "firstName", "lastName"],
        },
      ],
    });

    if (!home) {
      return res.status(404).json({ error: "Home not found" });
    }

    // Get home size dispute history
    const disputes = await HomeSizeAdjustmentRequest.findAll({
      where: { homeId },
      attributes: ["id", "caseNumber", "status", "originalNumBeds", "originalNumBaths", "reportedNumBeds", "reportedNumBaths", "createdAt", "ownerResolvedAt"],
      include: [
        { model: User, as: "cleaner", attributes: ["id", "firstName", "lastName"] },
      ],
      order: [["createdAt", "DESC"]],
      limit: 10,
    });

    // Serialize disputes
    const disputeHistory = disputes.map((d) => ({
      id: d.id,
      caseNumber: d.caseNumber,
      status: d.status,
      originalSize: `${d.originalNumBeds}bd/${d.originalNumBaths}ba`,
      reportedSize: `${d.reportedNumBeds}bd/${d.reportedNumBaths}ba`,
      cleaner: d.cleaner ? `${safeDecrypt(d.cleaner.firstName)} ${safeDecrypt(d.cleaner.lastName)}` : "Unknown",
      createdAt: d.createdAt,
      resolvedAt: d.ownerResolvedAt,
    }));

    // Get appointment history for this home
    const appointments = await UserAppointments.findAll({
      where: { homeId },
      attributes: ["id", "date", "price", "status"],
      order: [["date", "DESC"]],
      limit: 10,
    });

    const homeData = {
      id: home.id,
      address: home.address,
      city: home.city,
      state: home.state,
      zipcode: home.zipcode,
      numBeds: home.numBeds,
      numBaths: home.numBaths,
      numHalfBaths: home.numHalfBaths,
      nickName: home.nickName,
      owner: home.user ? {
        id: home.user.id,
        username: home.user.username,
        name: `${safeDecrypt(home.user.firstName)} ${safeDecrypt(home.user.lastName)}`,
      } : null,
      disputeHistory,
      appointmentHistory: appointments,
    };

    return res.status(200).json({ home: homeData });
  } catch (error) {
    console.error("Error fetching home details:", error);
    return res.status(500).json({ error: "Failed to fetch home details" });
  }
});

/**
 * PATCH /home/:homeId/size
 * Update home size (for resolving disputes)
 */
hrSupportToolsRouter.patch("/home/:homeId/size", async (req, res) => {
  try {
    const { homeId } = req.params;
    const { numBeds, numBaths, numHalfBaths, reason } = req.body;

    // Validate home size values are positive integers
    if (numBeds !== undefined) {
      const beds = parseInt(numBeds);
      if (isNaN(beds) || beds < 0 || beds > 20) {
        return res.status(400).json({ error: "Number of beds must be between 0 and 20" });
      }
    }
    if (numBaths !== undefined) {
      const baths = parseFloat(numBaths);
      if (isNaN(baths) || baths < 0 || baths > 15) {
        return res.status(400).json({ error: "Number of baths must be between 0 and 15" });
      }
    }
    if (numHalfBaths !== undefined) {
      const halfBaths = parseInt(numHalfBaths);
      if (isNaN(halfBaths) || halfBaths < 0 || halfBaths > 10) {
        return res.status(400).json({ error: "Number of half baths must be between 0 and 10" });
      }
    }

    const home = await UserHomes.findByPk(homeId);
    if (!home) {
      return res.status(404).json({ error: "Home not found" });
    }

    const oldSize = `${home.numBeds}bd/${home.numBaths}ba`;

    await home.update({
      numBeds: numBeds !== undefined ? parseInt(numBeds) : home.numBeds,
      numBaths: numBaths !== undefined ? parseFloat(numBaths) : home.numBaths,
      numHalfBaths: numHalfBaths !== undefined ? parseInt(numHalfBaths) : home.numHalfBaths,
    });

    const newSize = `${home.numBeds}bd/${home.numBaths}ba`;

    console.log(`✅ Home ${homeId} size updated from ${oldSize} to ${newSize} by HR user ${req.user.id}. Reason: ${reason}`);

    return res.status(200).json({
      message: "Home size updated successfully",
      home: {
        id: home.id,
        numBeds: home.numBeds,
        numBaths: home.numBaths,
        numHalfBaths: home.numHalfBaths,
      },
    });
  } catch (error) {
    console.error("Error updating home size:", error);
    return res.status(500).json({ error: "Failed to update home size" });
  }
});

/**
 * GET /cleaner/:cleanerId/claim-history
 * Get cleaner's home size claim history
 */
hrSupportToolsRouter.get("/cleaner/:cleanerId/claim-history", async (req, res) => {
  try {
    const { cleanerId } = req.params;

    const cleaner = await User.findByPk(cleanerId, {
      attributes: ["id", "firstName", "lastName", "falseClaimCount"],
    });

    if (!cleaner) {
      return res.status(404).json({ error: "Cleaner not found" });
    }

    const claims = await HomeSizeAdjustmentRequest.findAll({
      where: { cleanerId },
      include: [
        { model: UserHomes, as: "home", attributes: ["id", "address", "city"] },
        { model: User, as: "homeowner", attributes: ["id", "firstName", "lastName"] },
      ],
      order: [["createdAt", "DESC"]],
      limit: 20,
    });

    // Calculate stats
    const totalClaims = claims.length;
    const approvedClaims = claims.filter((c) => ["approved", "owner_approved"].includes(c.status)).length;
    const deniedClaims = claims.filter((c) => ["denied", "owner_denied"].includes(c.status)).length;
    const pendingClaims = claims.filter((c) => ["pending_homeowner", "pending_owner"].includes(c.status)).length;

    const claimHistory = claims.map((c) => ({
      id: c.id,
      caseNumber: c.caseNumber,
      status: c.status,
      originalSize: `${c.originalNumBeds}bd/${c.originalNumBaths}ba`,
      reportedSize: `${c.reportedNumBeds}bd/${c.reportedNumBaths}ba`,
      priceDifference: c.priceDifference,
      home: c.home ? `${c.home.address}, ${c.home.city}` : "Unknown",
      homeowner: c.homeowner ? `${safeDecrypt(c.homeowner.firstName)} ${safeDecrypt(c.homeowner.lastName)}` : "Unknown",
      createdAt: c.createdAt,
    }));

    return res.status(200).json({
      cleaner: {
        id: cleaner.id,
        name: `${safeDecrypt(cleaner.firstName)} ${safeDecrypt(cleaner.lastName)}`,
        falseClaimCount: cleaner.falseClaimCount || 0,
      },
      stats: {
        totalClaims,
        approvedClaims,
        deniedClaims,
        pendingClaims,
        approvalRate: totalClaims > 0 ? Math.round((approvedClaims / totalClaims) * 100) : 0,
      },
      claims: claimHistory,
    });
  } catch (error) {
    console.error("Error fetching cleaner claim history:", error);
    return res.status(500).json({ error: "Failed to fetch claim history" });
  }
});

/**
 * POST /user/:userId/mark-false-claim
 * Increment false claim count for user
 */
hrSupportToolsRouter.post("/user/:userId/mark-false-claim", async (req, res) => {
  try {
    const { userId } = req.params;
    const { type, reason, disputeId } = req.body; // type: 'cleaner' or 'homeowner'

    const user = await User.findByPk(userId);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    if (type === "cleaner") {
      await user.increment("falseClaimCount");
      console.log(`✅ False claim count incremented for cleaner ${userId} by HR ${req.user.id}. Reason: ${reason}`);
    } else if (type === "homeowner") {
      await user.increment("falseHomeSizeCount");
      console.log(`✅ False home size count incremented for homeowner ${userId} by HR ${req.user.id}. Reason: ${reason}`);
    } else {
      return res.status(400).json({ error: "Invalid type. Must be 'cleaner' or 'homeowner'" });
    }

    // Reload to get updated count
    await user.reload();

    return res.status(200).json({
      message: "False claim marked successfully",
      user: {
        id: user.id,
        falseClaimCount: user.falseClaimCount,
        falseHomeSizeCount: user.falseHomeSizeCount,
      },
    });
  } catch (error) {
    console.error("Error marking false claim:", error);
    return res.status(500).json({ error: "Failed to mark false claim" });
  }
});

// ============================================================================
// CANCELLATION APPEAL TOOLS
// ============================================================================

/**
 * GET /user/:userId/cancellation-history
 * Get user's cancellation and appeal history
 */
hrSupportToolsRouter.get("/user/:userId/cancellation-history", async (req, res) => {
  try {
    const { userId } = req.params;

    const user = await User.findByPk(userId, {
      attributes: ["id", "firstName", "lastName", "cancellationCount", "lateCancellationCount", "noShowCount"],
    });

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    // Get cancelled appointments
    const cancelledAppointments = await UserAppointments.findAll({
      where: {
        userId,
        cancellationStatus: { [Op.ne]: null },
      },
      attributes: ["id", "date", "price", "cancellationStatus", "cancelledAt", "cancellationReason"],
      order: [["cancelledAt", "DESC"]],
      limit: 20,
    });

    // Get appeals
    let appeals = [];
    try {
      appeals = await CancellationAppeal.findAll({
        where: { appealerId: userId },
        attributes: ["id", "caseNumber", "category", "status", "priority", "submittedAt", "closedAt", "resolution"],
        order: [["submittedAt", "DESC"]],
        limit: 10,
      });
    } catch (e) {
      // Table may not exist
    }

    return res.status(200).json({
      user: {
        id: user.id,
        name: `${safeDecrypt(user.firstName)} ${safeDecrypt(user.lastName)}`,
        stats: {
          cancellationCount: user.cancellationCount || 0,
          lateCancellationCount: user.lateCancellationCount || 0,
          noShowCount: user.noShowCount || 0,
        },
      },
      cancelledAppointments,
      appeals,
    });
  } catch (error) {
    console.error("Error fetching cancellation history:", error);
    return res.status(500).json({ error: "Failed to fetch cancellation history" });
  }
});

/**
 * GET /appointment/:appointmentId/details
 * Get full appointment details for HR review
 */
hrSupportToolsRouter.get("/appointment/:appointmentId/details", async (req, res) => {
  try {
    const { appointmentId } = req.params;

    const appointment = await UserAppointments.findByPk(appointmentId, {
      include: [
        { model: User, as: "user", attributes: ["id", "firstName", "lastName", "username", "type"] },
        { model: UserHomes, as: "home", attributes: ["id", "address", "city", "state", "numBeds", "numBaths"] },
      ],
    });

    if (!appointment) {
      return res.status(404).json({ error: "Appointment not found" });
    }

    // Get related disputes
    const homeSizeDisputes = await HomeSizeAdjustmentRequest.findAll({
      where: { appointmentId },
      attributes: ["id", "caseNumber", "status", "priceDifference"],
    });

    // Get related appeals
    let appeals = [];
    try {
      appeals = await CancellationAppeal.findAll({
        where: { appointmentId },
        attributes: ["id", "caseNumber", "status", "category"],
      });
    } catch (e) {
      // Table may not exist
    }

    // Get ledger entries if available
    let ledgerEntries = [];
    try {
      ledgerEntries = await JobLedger.findAll({
        where: { appointmentId },
        attributes: ["id", "type", "amount", "description", "createdAt"],
        order: [["createdAt", "DESC"]],
      });
    } catch (e) {
      // Table may not exist
    }

    const appointmentData = {
      id: appointment.id,
      date: appointment.date,
      price: appointment.price,
      status: appointment.status,
      cancellationStatus: appointment.cancellationStatus,
      cancelledAt: appointment.cancelledAt,
      cancellationReason: appointment.cancellationReason,
      user: appointment.user ? {
        id: appointment.user.id,
        username: appointment.user.username,
        name: `${safeDecrypt(appointment.user.firstName)} ${safeDecrypt(appointment.user.lastName)}`,
        type: appointment.user.type,
      } : null,
      home: appointment.home,
      relatedDisputes: homeSizeDisputes,
      relatedAppeals: appeals,
      ledgerEntries,
    };

    return res.status(200).json({ appointment: appointmentData });
  } catch (error) {
    console.error("Error fetching appointment details:", error);
    return res.status(500).json({ error: "Failed to fetch appointment details" });
  }
});

/**
 * POST /user/:userId/waive-penalty
 * Waive cancellation penalty for user
 */
hrSupportToolsRouter.post("/user/:userId/waive-penalty", async (req, res) => {
  try {
    const { userId } = req.params;
    const { penaltyType, reason, appointmentId } = req.body;

    const user = await User.findByPk(userId);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    // Decrement the appropriate count
    if (penaltyType === "cancellation" && user.cancellationCount > 0) {
      await user.decrement("cancellationCount");
    } else if (penaltyType === "lateCancellation" && user.lateCancellationCount > 0) {
      await user.decrement("lateCancellationCount");
    } else if (penaltyType === "noShow" && user.noShowCount > 0) {
      await user.decrement("noShowCount");
    } else {
      return res.status(400).json({ error: "Invalid penalty type or no penalty to waive" });
    }

    await user.reload();

    console.log(`✅ ${penaltyType} penalty waived for user ${userId} by HR ${req.user.id}. Reason: ${reason}`);

    return res.status(200).json({
      message: "Penalty waived successfully",
      user: {
        id: user.id,
        cancellationCount: user.cancellationCount,
        lateCancellationCount: user.lateCancellationCount,
        noShowCount: user.noShowCount,
      },
    });
  } catch (error) {
    console.error("Error waiving penalty:", error);
    return res.status(500).json({ error: "Failed to waive penalty" });
  }
});

/**
 * POST /user/:userId/reset-penalties
 * Reset all penalty counts for user
 */
hrSupportToolsRouter.post("/user/:userId/reset-penalties", rateLimitSensitiveAction("reset-penalties"), async (req, res) => {
  try {
    const { userId } = req.params;
    const { reason } = req.body;

    const user = await User.findByPk(userId);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const oldCounts = {
      cancellationCount: user.cancellationCount,
      lateCancellationCount: user.lateCancellationCount,
      noShowCount: user.noShowCount,
    };

    await user.update({
      cancellationCount: 0,
      lateCancellationCount: 0,
      noShowCount: 0,
    });

    console.log(`✅ All penalties reset for user ${userId} by HR ${req.user.id}. Previous: ${JSON.stringify(oldCounts)}. Reason: ${reason}`);

    return res.status(200).json({
      message: "All penalties reset successfully",
      previousCounts: oldCounts,
    });
  } catch (error) {
    console.error("Error resetting penalties:", error);
    return res.status(500).json({ error: "Failed to reset penalties" });
  }
});

// ============================================================================
// NOTIFICATION TOOLS
// ============================================================================

/**
 * POST /user/:userId/send-notification
 * Send notification to user
 */
hrSupportToolsRouter.post("/user/:userId/send-notification", async (req, res) => {
  try {
    const { userId } = req.params;
    const { title, body, type, sendPush, sendEmail } = req.body;

    const user = await User.findByPk(userId);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const NotificationService = require("../../../services/NotificationService");
    await NotificationService.notifyUser({
      userId,
      type: type || "hr_message",
      title: title || "Message from HR",
      body,
      data: { sentBy: req.user.id, sentAt: new Date() },
      actionRequired: false,
      sendPush: sendPush !== false,
      sendEmail: sendEmail !== false,
    });

    console.log(`✅ Notification sent to user ${userId} by HR ${req.user.id}`);

    return res.status(200).json({
      message: "Notification sent successfully",
    });
  } catch (error) {
    console.error("Error sending notification:", error);
    return res.status(500).json({ error: "Failed to send notification" });
  }
});

// ============================================================================
// CREDIT & REFUND TOOLS
// ============================================================================

/**
 * POST /user/:userId/issue-credit
 * Issue credit to user account (requires Stripe integration)
 */
hrSupportToolsRouter.post("/user/:userId/issue-credit", rateLimitSensitiveAction("issue-credit"), async (req, res) => {
  try {
    const { userId } = req.params;
    const { amount, reason, appointmentId } = req.body;

    if (!amount || amount <= 0) {
      return res.status(400).json({ error: "Amount must be a positive number" });
    }

    // Enforce maximum credit amount
    if (amount > MAX_CREDIT_AMOUNT) {
      return res.status(400).json({
        error: `Credit amount cannot exceed $${MAX_CREDIT_AMOUNT}. Contact system administrator for larger credits.`,
        maxAmount: MAX_CREDIT_AMOUNT,
      });
    }

    if (!reason || reason.trim().length < 10) {
      return res.status(400).json({ error: "A detailed reason (at least 10 characters) is required for credit issuance" });
    }

    const user = await User.findByPk(userId);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    // Log the credit issuance to audit trail
    await logHRAuditAction(req.user.id, "issue_credit", userId, {
      amount,
      reason,
      appointmentId: appointmentId || null,
    });
    console.log(`✅ Credit of $${amount} issued to user ${userId} by HR ${req.user.id}. Reason: ${reason}`);

    // Create a notification for the user
    const NotificationService = require("../../../services/NotificationService");
    await NotificationService.notifyUser({
      userId,
      type: "credit_issued",
      title: "Account Credit Issued",
      body: `A credit of $${amount.toFixed(2)} has been added to your account.`,
      data: { amount, reason, issuedBy: req.user.id },
      actionRequired: false,
      sendPush: true,
      sendEmail: true,
    });

    return res.status(200).json({
      message: "Credit issued successfully",
      credit: {
        amount,
        userId,
        reason,
        issuedBy: req.user.id,
        issuedAt: new Date(),
      },
    });
  } catch (error) {
    console.error("Error issuing credit:", error);
    return res.status(500).json({ error: "Failed to issue credit" });
  }
});

// ============================================================================
// HR STAFF TOOLS
// ============================================================================

/**
 * GET /hr-staff
 * Get list of HR staff for assignment
 */
hrSupportToolsRouter.get("/hr-staff", async (req, res) => {
  try {
    const hrStaff = await User.findAll({
      where: { type: { [Op.in]: ["humanResources", "owner"] } },
      attributes: ["id", "firstName", "lastName", "username", "type"],
      order: [["firstName", "ASC"]],
    });

    const staff = hrStaff.map((s) => ({
      id: s.id,
      firstName: safeDecrypt(s.firstName),
      lastName: safeDecrypt(s.lastName),
      username: s.username,
      type: s.type,
    }));

    return res.status(200).json({ hrStaff: staff });
  } catch (error) {
    console.error("Error fetching HR staff:", error);
    return res.status(500).json({ error: "Failed to fetch HR staff" });
  }
});

/**
 * POST /appeal/:appealId/assign
 * Assign appeal to HR staff
 */
hrSupportToolsRouter.post("/appeal/:appealId/assign", async (req, res) => {
  try {
    const { appealId } = req.params;
    const { assigneeId } = req.body;

    const appeal = await CancellationAppeal.findByPk(appealId);
    if (!appeal) {
      return res.status(404).json({ error: "Appeal not found" });
    }

    if (assigneeId) {
      const assignee = await User.findByPk(assigneeId);
      if (!assignee || !["humanResources", "owner"].includes(assignee.type)) {
        return res.status(400).json({ error: "Invalid assignee" });
      }
      // Check if assignee account is locked or frozen
      const isLocked = assignee.lockedUntil && new Date(assignee.lockedUntil) > new Date();
      if (isLocked || assignee.accountFrozen) {
        return res.status(400).json({ error: "Cannot assign to locked or frozen account" });
      }
    }

    await appeal.update({
      assignedTo: assigneeId || null,
      assignedAt: assigneeId ? new Date() : null,
      status: assigneeId && appeal.status === "submitted" ? "under_review" : appeal.status,
    });

    console.log(`✅ Appeal ${appeal.caseNumber} assigned to ${assigneeId} by HR ${req.user.id}`);

    return res.status(200).json({
      message: "Appeal assigned successfully",
      appeal: {
        id: appeal.id,
        caseNumber: appeal.caseNumber,
        assignedTo: appeal.assignedTo,
        status: appeal.status,
      },
    });
  } catch (error) {
    console.error("Error assigning appeal:", error);
    return res.status(500).json({ error: "Failed to assign appeal" });
  }
});

/**
 * POST /appeal/:appealId/resolve
 * Resolve a cancellation appeal
 */
hrSupportToolsRouter.post("/appeal/:appealId/resolve", async (req, res) => {
  try {
    const { appealId } = req.params;
    const { decision, resolutionNotes, refundAmount, waivePenalty } = req.body;

    const validDecisions = ["approved", "partially_approved", "denied"];
    if (!validDecisions.includes(decision)) {
      return res.status(400).json({ error: "Invalid decision" });
    }

    const appeal = await CancellationAppeal.findByPk(appealId);
    if (!appeal) {
      return res.status(404).json({ error: "Appeal not found" });
    }

    if (appeal.isClosed()) {
      return res.status(400).json({ error: "Appeal is already closed" });
    }

    await appeal.update({
      status: decision,
      resolution: {
        decision,
        refundAmount: refundAmount || 0,
        waivePenalty: waivePenalty || false,
      },
      resolutionNotes,
      refundAmount: refundAmount || null,
      reviewedBy: req.user.id,
      reviewedAt: new Date(),
      closedAt: new Date(),
    });

    // If waiving penalty, update user based on appeal category
    if (waivePenalty && appeal.appealerId) {
      const user = await User.findByPk(appeal.appealerId);
      if (user) {
        // Determine which penalty to waive based on appeal category
        const category = appeal.category;
        if (category === "late_cancellation" && user.lateCancellationCount > 0) {
          await user.decrement("lateCancellationCount");
          console.log(`✅ Late cancellation penalty waived for user ${user.id}`);
        } else if (category === "no_show" && user.noShowCount > 0) {
          await user.decrement("noShowCount");
          console.log(`✅ No-show penalty waived for user ${user.id}`);
        } else if (category === "cancellation" && user.cancellationCount > 0) {
          await user.decrement("cancellationCount");
          console.log(`✅ Cancellation penalty waived for user ${user.id}`);
        } else {
          // Fallback: try to waive any penalty that exists
          if (user.lateCancellationCount > 0) {
            await user.decrement("lateCancellationCount");
          } else if (user.noShowCount > 0) {
            await user.decrement("noShowCount");
          } else if (user.cancellationCount > 0) {
            await user.decrement("cancellationCount");
          }
        }
      }
    }

    // Notify the user
    const NotificationService = require("../../../services/NotificationService");
    await NotificationService.notifyUser({
      userId: appeal.appealerId,
      type: "appeal_resolved",
      title: "Appeal Resolved",
      body: `Your cancellation appeal (${appeal.caseNumber}) has been ${decision.replace("_", " ")}.`,
      data: { appealId: appeal.id, decision },
      actionRequired: false,
      sendPush: true,
      sendEmail: true,
    });

    console.log(`✅ Appeal ${appeal.caseNumber} resolved as ${decision} by HR ${req.user.id}`);

    return res.status(200).json({
      message: "Appeal resolved successfully",
      appeal: {
        id: appeal.id,
        caseNumber: appeal.caseNumber,
        status: appeal.status,
        resolution: appeal.resolution,
      },
    });
  } catch (error) {
    console.error("Error resolving appeal:", error);
    return res.status(500).json({ error: "Failed to resolve appeal" });
  }
});

module.exports = hrSupportToolsRouter;
