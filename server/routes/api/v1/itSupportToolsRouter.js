/**
 * IT Support Tools Router
 *
 * Comprehensive tools for IT staff to help users with all types of issues:
 *
 * ACCOUNT TOOLS:
 * - User search (by email, username)
 * - View account status (login history, lock status, etc.)
 * - Send password reset email
 * - Unlock account (clear failed login attempts)
 * - Force logout (clear sessions)
 *
 * PROFILE TOOLS:
 * - View full profile details
 * - Update contact info (email, phone)
 *
 * BILLING TOOLS:
 * - View billing history
 * - View payment methods
 * - View Stripe customer info
 *
 * SECURITY TOOLS:
 * - View login/security info
 * - Force logout all devices
 * - Temporarily suspend account
 *
 * DATA TOOLS:
 * - Export user data summary
 */

const express = require("express");
const bcrypt = require("bcrypt");
const crypto = require("crypto");
const { User, UserBills, UserAppointments, UserReviews } = require("../../../models");
const { Op } = require("sequelize");
const verifyITOrOwner = require("../../../middleware/verifyITOrOwner");
const EncryptionService = require("../../../services/EncryptionService");
const Email = require("../../../services/sendNotifications/EmailClass");
const PushNotification = require("../../../services/sendNotifications/PushNotificationClass");

const itSupportToolsRouter = express.Router();

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

// Simple in-memory rate limiter for sensitive actions
const rateLimitStore = new Map();
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute
const RATE_LIMIT_MAX_REQUESTS = 5; // max 5 requests per minute per action per user

const rateLimitSensitiveAction = (actionType) => (req, res, next) => {
  const userId = req.user?.id;
  const key = `${actionType}:${userId}`;
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

// All routes require IT or Owner access
itSupportToolsRouter.use(verifyITOrOwner);

/**
 * GET /api/v1/it-support/search
 * Search for users by email, username, or name
 */
itSupportToolsRouter.get("/search", async (req, res) => {
  try {
    const { query, type } = req.query;

    if (!query || query.length < 2) {
      return res.status(400).json({ error: "Search query must be at least 2 characters" });
    }

    let users = [];

    // Search by email (need to hash to match)
    if (!type || type === "email") {
      const emailHash = EncryptionService.hash(query.toLowerCase());
      const emailMatches = await User.findAll({
        where: { emailHash },
        attributes: ["id", "username", "firstName", "lastName", "email", "type", "lastLogin", "failedLoginAttempts", "lockedUntil", "accountFrozen", "createdAt"],
        limit: 10,
      });
      users = [...users, ...emailMatches];
    }

    // Search by username (case insensitive)
    if (!type || type === "username") {
      const usernameMatches = await User.findAll({
        where: {
          username: { [Op.iLike]: `%${query}%` },
        },
        attributes: ["id", "username", "firstName", "lastName", "email", "type", "lastLogin", "failedLoginAttempts", "lockedUntil", "accountFrozen", "createdAt"],
        limit: 10,
      });
      // Avoid duplicates
      const existingIds = new Set(users.map(u => u.id));
      users = [...users, ...usernameMatches.filter(u => !existingIds.has(u.id))];
    }

    // Decrypt and serialize users
    const serializedUsers = users.map((u) => ({
      id: u.id,
      username: u.username,
      firstName: safeDecrypt(u.firstName),
      lastName: safeDecrypt(u.lastName),
      email: safeDecrypt(u.email),
      type: u.type,
      lastLogin: u.lastLogin,
      failedLoginAttempts: u.failedLoginAttempts,
      isLocked: u.lockedUntil && new Date(u.lockedUntil) > new Date(),
      lockedUntil: u.lockedUntil,
      accountFrozen: u.accountFrozen,
      createdAt: u.createdAt,
    }));

    return res.status(200).json({ users: serializedUsers });
  } catch (error) {
    console.error("Error searching users:", error);
    return res.status(500).json({ error: "Failed to search users" });
  }
});

/**
 * GET /api/v1/it-support/user/:id
 * Get detailed user account information for IT support
 */
itSupportToolsRouter.get("/user/:id", async (req, res) => {
  try {
    const user = await User.findByPk(req.params.id, {
      attributes: [
        "id", "username", "firstName", "lastName", "email", "phone", "type",
        "lastLogin", "loginCount", "lastDeviceType", "failedLoginAttempts",
        "lockedUntil", "accountFrozen", "accountFrozenAt", "accountFrozenReason",
        "warningCount", "createdAt", "expoPushToken",
      ],
    });

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const userData = {
      id: user.id,
      username: user.username,
      firstName: safeDecrypt(user.firstName),
      lastName: safeDecrypt(user.lastName),
      email: safeDecrypt(user.email),
      phone: safeDecrypt(user.phone),
      type: user.type,
      // Login info
      lastLogin: user.lastLogin,
      loginCount: user.loginCount,
      lastDeviceType: user.lastDeviceType,
      hasPushToken: !!user.expoPushToken,
      // Security status
      failedLoginAttempts: user.failedLoginAttempts,
      isLocked: user.lockedUntil && new Date(user.lockedUntil) > new Date(),
      lockedUntil: user.lockedUntil,
      // Account status
      accountFrozen: user.accountFrozen,
      accountFrozenAt: user.accountFrozenAt,
      accountFrozenReason: user.accountFrozenReason,
      warningCount: user.warningCount,
      createdAt: user.createdAt,
    };

    return res.status(200).json({ user: userData });
  } catch (error) {
    console.error("Error fetching user details:", error);
    return res.status(500).json({ error: "Failed to fetch user details" });
  }
});

/**
 * POST /api/v1/it-support/user/:id/send-password-reset
 * Send password reset email to user (triggered by IT staff)
 */
itSupportToolsRouter.post("/user/:id/send-password-reset", rateLimitSensitiveAction("password-reset"), async (req, res) => {
  try {
    const user = await User.findByPk(req.params.id);

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    // Generate a temporary password
    const temporaryPassword = crypto.randomBytes(6).toString("hex");

    // Hash the temporary password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(temporaryPassword, salt);

    // Update user's password
    await user.update({ password: hashedPassword });

    // Decrypt email to send
    const userEmail = safeDecrypt(user.email);

    // Send password reset email
    await Email.sendPasswordReset(userEmail, user.username, temporaryPassword);
    console.log(`✅ IT triggered password reset for ${user.username} (requested by user ${req.user.id})`);

    // Send push notification if user has a stored token
    if (user.expoPushToken) {
      await PushNotification.sendPushPasswordReset(user.expoPushToken, user.username);
    }

    return res.status(200).json({
      success: true,
      message: `Password reset email sent to ${userEmail}`,
    });
  } catch (error) {
    console.error("Error sending password reset:", error);
    return res.status(500).json({ error: "Failed to send password reset" });
  }
});

/**
 * POST /api/v1/it-support/user/:id/unlock
 * Unlock a user account (clear failed login attempts and lock)
 */
itSupportToolsRouter.post("/user/:id/unlock", rateLimitSensitiveAction("unlock"), async (req, res) => {
  try {
    const user = await User.findByPk(req.params.id);

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const wasLocked = user.lockedUntil && new Date(user.lockedUntil) > new Date();
    const previousAttempts = user.failedLoginAttempts;

    // Clear lock and failed attempts
    await user.update({
      failedLoginAttempts: 0,
      lockedUntil: null,
    });

    console.log(`✅ IT unlocked account for ${user.username} (requested by user ${req.user.id})`);

    return res.status(200).json({
      success: true,
      message: wasLocked
        ? `Account unlocked. Cleared ${previousAttempts} failed login attempts.`
        : `Account was not locked. Cleared ${previousAttempts} failed login attempts.`,
    });
  } catch (error) {
    console.error("Error unlocking account:", error);
    return res.status(500).json({ error: "Failed to unlock account" });
  }
});

/**
 * GET /api/v1/it-support/account-types
 * Get readable account type labels
 */
itSupportToolsRouter.get("/account-types", async (req, res) => {
  return res.status(200).json({
    types: {
      cleaner: "Cleaner",
      homeowner: "Homeowner",
      owner: "Business Owner",
      employee: "Employee",
      humanResources: "HR Manager",
      it: "IT Support",
      businessClient: "Business Client",
    },
  });
});

// ==================== PROFILE TOOLS ====================

/**
 * GET /api/v1/it-support/user/:id/profile
 * Get full user profile for IT support
 */
itSupportToolsRouter.get("/user/:id/profile", async (req, res) => {
  try {
    const user = await User.findByPk(req.params.id, {
      attributes: [
        "id", "username", "firstName", "lastName", "email", "phone", "type",
        "isBusinessOwner", "businessName", "businessDescription",
        "createdAt", "termsAcceptedVersion", "privacyPolicyAcceptedVersion",
      ],
    });

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const profile = {
      id: user.id,
      username: user.username,
      firstName: safeDecrypt(user.firstName),
      lastName: safeDecrypt(user.lastName),
      email: safeDecrypt(user.email),
      phone: safeDecrypt(user.phone),
      type: user.type,
      isBusinessOwner: user.isBusinessOwner,
      businessName: user.businessName,
      businessDescription: user.businessDescription,
      createdAt: user.createdAt,
      termsAcceptedVersion: user.termsAcceptedVersion,
      privacyPolicyAcceptedVersion: user.privacyPolicyAcceptedVersion,
    };

    return res.status(200).json({ profile });
  } catch (error) {
    console.error("Error fetching user profile:", error);
    return res.status(500).json({ error: "Failed to fetch profile" });
  }
});

/**
 * PATCH /api/v1/it-support/user/:id/contact
 * Update user contact info (email or phone)
 */
itSupportToolsRouter.patch("/user/:id/contact", async (req, res) => {
  try {
    const { email, phone } = req.body;
    const user = await User.findByPk(req.params.id);

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const updates = {};
    const changes = [];

    if (email) {
      // Check for duplicate email
      const emailHash = EncryptionService.hash(email.toLowerCase());
      const existingUser = await User.findOne({
        where: { emailHash, id: { [Op.ne]: user.id } }
      });
      if (existingUser) {
        return res.status(400).json({ error: "Email already in use by another account" });
      }
      updates.email = EncryptionService.encrypt(email.toLowerCase());
      updates.emailHash = emailHash;
      changes.push("email");
    }

    if (phone !== undefined) {
      updates.phone = phone ? EncryptionService.encrypt(phone) : null;
      changes.push("phone");
    }

    if (changes.length === 0) {
      return res.status(400).json({ error: "No changes provided" });
    }

    await user.update(updates);
    console.log(`✅ IT updated contact info for ${user.username}: ${changes.join(", ")} (by user ${req.user.id})`);

    return res.status(200).json({
      success: true,
      message: `Updated: ${changes.join(", ")}`,
    });
  } catch (error) {
    console.error("Error updating contact info:", error);
    return res.status(500).json({ error: "Failed to update contact info" });
  }
});

// ==================== BILLING TOOLS ====================

/**
 * GET /api/v1/it-support/user/:id/billing
 * Get user billing summary
 */
itSupportToolsRouter.get("/user/:id/billing", async (req, res) => {
  try {
    const user = await User.findByPk(req.params.id, {
      attributes: ["id", "username", "type", "stripeCustomerId", "hasPaymentMethod"],
    });

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    // Get recent bills
    const recentBills = await UserBills.findAll({
      where: { userId: user.id },
      order: [["id", "DESC"]],
      limit: 10,
      attributes: ["id", "appointmentDue", "cancellationFee", "totalDue"],
    });

    // Get billing stats
    const totalBills = await UserBills.count({ where: { userId: user.id } });

    // Calculate total amount billed
    const totalAmount = recentBills.reduce((sum, b) => sum + (b.totalDue || 0), 0);

    return res.status(200).json({
      billing: {
        hasStripeCustomer: !!user.stripeCustomerId,
        stripeCustomerId: user.stripeCustomerId,
        hasPaymentMethod: user.hasPaymentMethod,
        stats: {
          totalBills,
          totalAmount: totalAmount / 100, // Convert cents to dollars
        },
        recentBills: recentBills.map(b => ({
          id: b.id,
          amount: b.totalDue / 100, // Convert cents to dollars
          appointmentDue: b.appointmentDue / 100,
          cancellationFee: b.cancellationFee / 100,
        })),
      },
    });
  } catch (error) {
    console.error("Error fetching billing info:", error);
    return res.status(500).json({ error: "Failed to fetch billing info" });
  }
});

// ==================== SECURITY TOOLS ====================

/**
 * POST /api/v1/it-support/user/:id/force-logout
 * Force user to logout from all devices (clear push token)
 */
itSupportToolsRouter.post("/user/:id/force-logout", rateLimitSensitiveAction("force-logout"), async (req, res) => {
  try {
    const user = await User.findByPk(req.params.id);

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const hadPushToken = !!user.expoPushToken;

    // Clear push token and any session-related data
    await user.update({
      expoPushToken: null,
    });

    console.log(`✅ IT forced logout for ${user.username} (by user ${req.user.id})`);

    return res.status(200).json({
      success: true,
      message: hadPushToken
        ? "User will be logged out on next app open"
        : "User session cleared (no active push token found)",
    });
  } catch (error) {
    console.error("Error forcing logout:", error);
    return res.status(500).json({ error: "Failed to force logout" });
  }
});

/**
 * POST /api/v1/it-support/user/:id/suspend
 * Temporarily suspend a user account
 */
itSupportToolsRouter.post("/user/:id/suspend", rateLimitSensitiveAction("suspend"), async (req, res) => {
  try {
    const { reason, hours = 24 } = req.body;
    const user = await User.findByPk(req.params.id);

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    // Don't allow suspending owners or IT
    if (user.type === "owner" || user.type === "it") {
      return res.status(403).json({ error: "Cannot suspend owner or IT accounts" });
    }

    const lockedUntil = new Date(Date.now() + hours * 60 * 60 * 1000);

    await user.update({
      lockedUntil,
      expoPushToken: null, // Force logout too
    });

    console.log(`✅ IT suspended ${user.username} for ${hours}h: ${reason} (by user ${req.user.id})`);

    return res.status(200).json({
      success: true,
      message: `Account suspended until ${lockedUntil.toLocaleString()}`,
      lockedUntil,
    });
  } catch (error) {
    console.error("Error suspending account:", error);
    return res.status(500).json({ error: "Failed to suspend account" });
  }
});

/**
 * GET /api/v1/it-support/user/:id/security
 * Get user security information
 */
itSupportToolsRouter.get("/user/:id/security", async (req, res) => {
  try {
    const user = await User.findByPk(req.params.id, {
      attributes: [
        "id", "username", "type", "lastLogin", "loginCount", "lastDeviceType",
        "failedLoginAttempts", "lockedUntil", "accountFrozen", "accountFrozenAt",
        "accountFrozenReason", "warningCount", "expoPushToken", "createdAt",
      ],
    });

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    return res.status(200).json({
      security: {
        // Login info
        lastLogin: user.lastLogin,
        loginCount: user.loginCount,
        lastDeviceType: user.lastDeviceType,
        hasActivePushToken: !!user.expoPushToken,
        // Lock status
        failedLoginAttempts: user.failedLoginAttempts,
        isLocked: user.lockedUntil && new Date(user.lockedUntil) > new Date(),
        lockedUntil: user.lockedUntil,
        // Freeze status
        accountFrozen: user.accountFrozen,
        accountFrozenAt: user.accountFrozenAt,
        accountFrozenReason: user.accountFrozenReason,
        // Warnings
        warningCount: user.warningCount,
        // Account age
        accountCreated: user.createdAt,
      },
    });
  } catch (error) {
    console.error("Error fetching security info:", error);
    return res.status(500).json({ error: "Failed to fetch security info" });
  }
});

// ==================== DATA TOOLS ====================

/**
 * GET /api/v1/it-support/user/:id/data-summary
 * Get summary of user data for data requests
 */
itSupportToolsRouter.get("/user/:id/data-summary", async (req, res) => {
  try {
    const user = await User.findByPk(req.params.id, {
      attributes: ["id", "username", "type", "createdAt"],
    });

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    // Count appointments
    const appointmentCount = await UserAppointments.count({
      where: { userId: user.id }
    });

    // Count reviews given/received
    const reviewsGiven = await UserReviews.count({ where: { reviewerId: user.id } });
    const reviewsReceived = await UserReviews.count({ where: { userId: user.id } });

    // Count bills
    const billCount = await UserBills.count({ where: { userId: user.id } });

    return res.status(200).json({
      dataSummary: {
        userId: user.id,
        username: user.username,
        accountType: user.type,
        accountCreated: user.createdAt,
        data: {
          appointments: appointmentCount,
          reviewsGiven,
          reviewsReceived,
          bills: billCount,
        },
        note: "For full data export, please contact system administrator",
      },
    });
  } catch (error) {
    console.error("Error fetching data summary:", error);
    return res.status(500).json({ error: "Failed to fetch data summary" });
  }
});

// ==================== APP/TECHNICAL TOOLS ====================

/**
 * POST /api/v1/it-support/user/:id/clear-app-state
 * Clear user's app state (force fresh start)
 */
itSupportToolsRouter.post("/user/:id/clear-app-state", async (req, res) => {
  try {
    const user = await User.findByPk(req.params.id);

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    // Clear app-related state
    await user.update({
      expoPushToken: null,
      lastDeviceType: null,
    });

    console.log(`✅ IT cleared app state for ${user.username} (by user ${req.user.id})`);

    return res.status(200).json({
      success: true,
      message: "App state cleared. User will need to re-login and re-enable notifications.",
    });
  } catch (error) {
    console.error("Error clearing app state:", error);
    return res.status(500).json({ error: "Failed to clear app state" });
  }
});

/**
 * GET /api/v1/it-support/user/:id/app-info
 * Get user's app/device information
 */
itSupportToolsRouter.get("/user/:id/app-info", async (req, res) => {
  try {
    const user = await User.findByPk(req.params.id, {
      attributes: [
        "id", "username", "lastLogin", "lastDeviceType", "loginCount",
        "expoPushToken", "termsAcceptedVersion", "privacyPolicyAcceptedVersion",
      ],
    });

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    return res.status(200).json({
      appInfo: {
        lastLogin: user.lastLogin,
        lastDeviceType: user.lastDeviceType,
        loginCount: user.loginCount,
        hasPushNotifications: !!user.expoPushToken,
        termsVersion: user.termsAcceptedVersion,
        privacyVersion: user.privacyPolicyAcceptedVersion,
      },
    });
  } catch (error) {
    console.error("Error fetching app info:", error);
    return res.status(500).json({ error: "Failed to fetch app info" });
  }
});

module.exports = itSupportToolsRouter;
