const express = require("express");
const { User, ITDispute } = require("../../../models");
const NotificationService = require("../../../services/NotificationService");
const Email = require("../../../services/sendNotifications/EmailClass");
const PushNotification = require("../../../services/sendNotifications/PushNotificationClass");
const authenticateToken = require("../../../middleware/authenticatedToken");

const itDisputeRouter = express.Router();

// Helper to safely decrypt a field with error handling
const safeDecrypt = (value) => {
  if (!value) return null;
  try {
    const EncryptionService = require("../../../services/EncryptionService");
    return EncryptionService.decrypt(value);
  } catch (error) {
    console.error("Decryption failed:", error.message);
    return "[encrypted]";
  }
};

// All authenticated users can submit IT disputes
itDisputeRouter.use(authenticateToken);

// Simple in-memory rate limiter for dispute submission
const rateLimitStore = new Map();
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute
const RATE_LIMIT_MAX_REQUESTS = 3; // max 3 dispute submissions per minute per user

const rateLimitDisputeSubmission = (req, res, next) => {
  const userId = req.userId;
  const key = `dispute-submit:${userId}`;
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
      error: "Too many dispute submissions. Please wait before trying again.",
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

// Valid IT dispute categories
const VALID_CATEGORIES = [
  // Technical
  "app_crash",
  "login_problem",
  "system_outage",
  "performance_issue",
  // Profile
  "profile_change",
  "account_access",
  "password_reset",
  "data_correction",
  // Billing/Payment
  "billing_error",
  "payment_system_error",
  // Security
  "security_issue",
  "suspicious_activity",
  // Data
  "data_request",
];

// Category labels for display
const CATEGORY_LABELS = {
  app_crash: "App Crash",
  login_problem: "Login Problem",
  system_outage: "System Outage",
  performance_issue: "Performance Issue",
  profile_change: "Profile Change Request",
  account_access: "Account Access Issue",
  password_reset: "Password Reset Help",
  data_correction: "Data Correction",
  billing_error: "Billing Error",
  payment_system_error: "Payment System Error",
  security_issue: "Security Concern",
  suspicious_activity: "Suspicious Activity",
  data_request: "Data Export/Deletion Request",
};

/**
 * POST /api/v1/it-disputes/submit
 * Submit a new IT dispute (accessible by all authenticated users)
 */
itDisputeRouter.post("/submit", rateLimitDisputeSubmission, async (req, res) => {
  try {
    const {
      category,
      description,
      priority,
      deviceInfo,
      appVersion,
      platform,
      attachments,
    } = req.body;

    // Get the reporter (current user)
    const reporter = await User.findByPk(req.userId);
    if (!reporter) {
      return res.status(404).json({ error: "User not found" });
    }

    // Validate category
    if (!category || !VALID_CATEGORIES.includes(category)) {
      return res.status(400).json({
        error: "Invalid category",
        validCategories: VALID_CATEGORIES,
      });
    }

    // Validate description
    if (!description || description.trim().length < 10) {
      return res.status(400).json({ error: "Description must be at least 10 characters" });
    }

    // Validate priority if provided
    const validPriorities = ["low", "normal", "high", "critical"];
    const disputePriority = priority && validPriorities.includes(priority) ? priority : "normal";

    // Auto-elevate priority for security issues
    let finalPriority = disputePriority;
    if (["security_issue", "suspicious_activity", "system_outage"].includes(category)) {
      finalPriority = disputePriority === "low" ? "normal" : disputePriority === "normal" ? "high" : disputePriority;
    }

    // Create the dispute
    const dispute = await ITDispute.create({
      reporterId: reporter.id,
      category,
      description: description.trim(),
      priority: finalPriority,
      deviceInfo: deviceInfo || {},
      appVersion: appVersion || null,
      platform: platform || null,
      attachments: attachments || [],
    });

    // Get reporter's name for notifications
    const reporterFirstName = safeDecrypt(reporter.firstName) || reporter.username;
    const reporterLastName = safeDecrypt(reporter.lastName) || "";
    const reporterName = `${reporterFirstName} ${reporterLastName}`.trim();

    // Notify all IT staff
    const itStaff = await User.findAll({ where: { type: "it" } });

    for (const staff of itStaff) {
      // In-app notification
      await NotificationService.notifyUser({
        userId: staff.id,
        type: "it_dispute_submitted",
        title: finalPriority === "critical" ? "CRITICAL: New IT Issue" : "New IT Issue Reported",
        body: `${reporterName} reported: ${CATEGORY_LABELS[category] || category}`,
        data: {
          disputeId: dispute.id,
          caseNumber: dispute.caseNumber,
          category,
          priority: finalPriority,
        },
        actionRequired: true,
        sendPush: true,
        sendEmail: finalPriority === "critical" || finalPriority === "high",
      });

      // Send email for high/critical priority
      if ((finalPriority === "critical" || finalPriority === "high") && staff.notifications?.includes("email")) {
        const staffEmail = safeDecrypt(staff.email);
        const staffFirstName = safeDecrypt(staff.firstName) || staff.username;
        if (staffEmail) {
          try {
            await Email.sendITDisputeNotification(
              staffEmail,
              staffFirstName,
              reporterName,
              dispute.caseNumber,
              CATEGORY_LABELS[category] || category,
              finalPriority,
              description.substring(0, 200)
            );
          } catch (emailError) {
            console.error("Error sending IT dispute email:", emailError);
          }
        }
      }

      // Send push notification
      if (staff.expoPushToken && staff.notifications?.includes("phone")) {
        try {
          await PushNotification.sendPushITDispute(
            staff.expoPushToken,
            reporterName,
            CATEGORY_LABELS[category] || category,
            dispute.caseNumber,
            finalPriority
          );
        } catch (pushError) {
          console.error("Error sending IT dispute push:", pushError);
        }
      }
    }

    console.log(`✅ IT dispute ${dispute.caseNumber} submitted by user ${reporter.id}`);

    return res.status(201).json({
      success: true,
      dispute: {
        id: dispute.id,
        caseNumber: dispute.caseNumber,
        category: dispute.category,
        status: dispute.status,
        priority: dispute.priority,
        submittedAt: dispute.submittedAt,
        slaDeadline: dispute.slaDeadline,
      },
    });
  } catch (error) {
    console.error("Error submitting IT dispute:", error);
    return res.status(500).json({ error: "Failed to submit IT dispute" });
  }
});

/**
 * GET /api/v1/it-disputes/my-disputes
 * Get current user's submitted IT disputes
 */
itDisputeRouter.get("/my-disputes", async (req, res) => {
  try {
    const disputes = await ITDispute.findAll({
      where: { reporterId: req.userId },
      attributes: [
        "id",
        "caseNumber",
        "category",
        "description",
        "status",
        "priority",
        "submittedAt",
        "resolvedAt",
        "resolutionNotes",
      ],
      order: [["submittedAt", "DESC"]],
    });

    return res.status(200).json({ disputes });
  } catch (error) {
    console.error("Error fetching user's IT disputes:", error);
    return res.status(500).json({ error: "Failed to fetch disputes" });
  }
});

/**
 * GET /api/v1/it-disputes/categories/list
 * Get available IT dispute categories
 * NOTE: This must come BEFORE /:id to avoid route conflict
 */
itDisputeRouter.get("/categories/list", async (req, res) => {
  try {
    const categories = VALID_CATEGORIES.map((cat) => ({
      value: cat,
      label: CATEGORY_LABELS[cat] || cat,
      group: getCategoryGroup(cat),
    }));

    return res.status(200).json({ categories });
  } catch (error) {
    console.error("Error fetching categories:", error);
    return res.status(500).json({ error: "Failed to fetch categories" });
  }
});

// Helper function to get category group
function getCategoryGroup(category) {
  const technicalCategories = ["app_crash", "login_problem", "system_outage", "performance_issue"];
  const profileCategories = ["profile_change", "account_access", "password_reset", "data_correction"];
  const billingCategories = ["billing_error", "payment_system_error"];
  const securityCategories = ["security_issue", "suspicious_activity"];
  const dataCategories = ["data_request"];

  if (technicalCategories.includes(category)) return "technical";
  if (profileCategories.includes(category)) return "profile";
  if (billingCategories.includes(category)) return "billing";
  if (securityCategories.includes(category)) return "security";
  if (dataCategories.includes(category)) return "data";
  return "other";
}

/**
 * GET /api/v1/it-disputes/:id
 * Get specific dispute status (for reporter)
 * NOTE: This catch-all route must come AFTER all specific routes
 */
itDisputeRouter.get("/:id", async (req, res) => {
  try {
    const dispute = await ITDispute.findOne({
      where: {
        id: req.params.id,
        reporterId: req.userId,
      },
      attributes: [
        "id",
        "caseNumber",
        "category",
        "description",
        "status",
        "priority",
        "submittedAt",
        "resolvedAt",
        "resolutionNotes",
        "deviceInfo",
        "appVersion",
        "platform",
      ],
    });

    if (!dispute) {
      return res.status(404).json({ error: "Dispute not found" });
    }

    return res.status(200).json({ dispute });
  } catch (error) {
    console.error("Error fetching IT dispute:", error);
    return res.status(500).json({ error: "Failed to fetch dispute" });
  }
});

/**
 * POST /api/v1/it-disputes/:id/add-info
 * Add additional information to an open dispute
 */
itDisputeRouter.post("/:id/add-info", async (req, res) => {
  try {
    const { additionalInfo, attachments } = req.body;

    const dispute = await ITDispute.findOne({
      where: {
        id: req.params.id,
        reporterId: req.userId,
      },
    });

    if (!dispute) {
      return res.status(404).json({ error: "Dispute not found" });
    }

    if (["resolved", "closed"].includes(dispute.status)) {
      return res.status(400).json({ error: "Cannot add info to a closed dispute" });
    }

    // Append to description
    const updatedDescription = `${dispute.description}\n\n--- Additional Info (${new Date().toISOString()}) ---\n${additionalInfo}`;

    // Merge attachments
    const existingAttachments = dispute.attachments || [];
    const newAttachments = attachments || [];
    const mergedAttachments = [...existingAttachments, ...newAttachments];

    await dispute.update({
      description: updatedDescription,
      attachments: mergedAttachments,
      status: dispute.status === "awaiting_info" ? "in_progress" : dispute.status,
    });

    console.log(`✅ Additional info added to IT dispute ${dispute.caseNumber}`);

    return res.status(200).json({
      message: "Information added successfully",
      dispute: {
        id: dispute.id,
        caseNumber: dispute.caseNumber,
        status: dispute.status,
      },
    });
  } catch (error) {
    console.error("Error adding info to IT dispute:", error);
    return res.status(500).json({ error: "Failed to add information" });
  }
});

module.exports = itDisputeRouter;
