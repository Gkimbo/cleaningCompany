const express = require("express");
const { Op } = require("sequelize");
const { sequelize, User, ITDispute } = require("../../../models");
const verifyITOrOwner = require("../../../middleware/verifyITOrOwner");

const itDashboardRouter = express.Router();

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

// Apply middleware to all routes
itDashboardRouter.use(verifyITOrOwner);

// Category groupings for display
const CATEGORY_GROUPS = {
  technical: ["app_crash", "login_problem", "system_outage", "performance_issue"],
  profile: ["profile_change", "account_access", "password_reset", "data_correction"],
  billing: ["billing_error", "payment_system_error"],
  security: ["security_issue", "suspicious_activity"],
  data: ["data_request"],
};

/**
 * GET /api/v1/it-dashboard/quick-stats
 * Get IT dashboard quick stats
 */
itDashboardRouter.get("/quick-stats", async (req, res) => {
  try {
    const now = new Date();
    const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    // Open disputes (not resolved or closed)
    const openDisputes = await ITDispute.count({
      where: {
        status: { [Op.in]: ["submitted", "in_progress", "awaiting_info"] },
      },
    });

    // Critical/High priority open disputes
    const criticalHighPriority = await ITDispute.count({
      where: {
        status: { [Op.in]: ["submitted", "in_progress", "awaiting_info"] },
        priority: { [Op.in]: ["critical", "high"] },
      },
    });

    // Resolved this week
    const resolvedThisWeek = await ITDispute.count({
      where: {
        status: { [Op.in]: ["resolved", "closed"] },
        resolvedAt: { [Op.gte]: oneWeekAgo },
      },
    });

    // SLA breaches (open disputes past deadline)
    const slaBreaches = await ITDispute.count({
      where: {
        status: { [Op.in]: ["submitted", "in_progress", "awaiting_info"] },
        slaDeadline: { [Op.lt]: now },
      },
    });

    // Disputes by category group
    const disputesByGroup = {};
    for (const [group, categories] of Object.entries(CATEGORY_GROUPS)) {
      disputesByGroup[group] = await ITDispute.count({
        where: {
          status: { [Op.in]: ["submitted", "in_progress", "awaiting_info"] },
          category: { [Op.in]: categories },
        },
      });
    }

    // My assigned (for current user)
    const myAssigned = await ITDispute.count({
      where: {
        assignedTo: req.user.id,
        status: { [Op.in]: ["submitted", "in_progress", "awaiting_info"] },
      },
    });

    return res.status(200).json({
      openDisputes,
      criticalHighPriority,
      resolvedThisWeek,
      slaBreaches,
      disputesByGroup,
      myAssigned,
    });
  } catch (error) {
    console.error("Error fetching IT dashboard stats:", error);
    return res.status(500).json({ error: "Failed to fetch dashboard stats" });
  }
});

/**
 * GET /api/v1/it-dashboard/disputes
 * Get IT disputes queue with filtering
 */
itDashboardRouter.get("/disputes", async (req, res) => {
  try {
    const {
      category,
      categoryGroup,
      status,
      priority,
      assignedTo,
      limit = 50,
      offset = 0,
    } = req.query;

    const where = {};

    // Filter by category or category group
    if (category) {
      where.category = category;
    } else if (categoryGroup && CATEGORY_GROUPS[categoryGroup]) {
      where.category = { [Op.in]: CATEGORY_GROUPS[categoryGroup] };
    }

    // Filter by status
    if (status) {
      if (status === "open") {
        where.status = { [Op.in]: ["submitted", "in_progress", "awaiting_info"] };
      } else {
        where.status = status;
      }
    }

    // Filter by priority
    if (priority) {
      where.priority = priority;
    }

    // Filter by assigned
    if (assignedTo) {
      if (assignedTo === "me") {
        where.assignedTo = req.user.id;
      } else if (assignedTo === "unassigned") {
        where.assignedTo = null;
      } else {
        where.assignedTo = parseInt(assignedTo);
      }
    }

    const disputes = await ITDispute.findAll({
      where,
      include: [
        { model: User, as: "reporter", attributes: ["id", "firstName", "lastName", "username", "email"] },
        { model: User, as: "assignee", attributes: ["id", "firstName", "lastName", "username"] },
      ],
      order: [
        // Use CASE to ensure proper priority order: critical > high > normal > low
        [sequelize.literal(`CASE
          WHEN priority = 'critical' THEN 1
          WHEN priority = 'high' THEN 2
          WHEN priority = 'normal' THEN 3
          WHEN priority = 'low' THEN 4
          ELSE 5 END`), "ASC"],
        ["submittedAt", "ASC"], // oldest first
      ],
      limit: parseInt(limit),
      offset: parseInt(offset),
    });

    const total = await ITDispute.count({ where });

    // Decrypt reporter info
    const serializedDisputes = disputes.map((d) => {
      const data = d.toJSON();
      if (data.reporter) {
        data.reporter.firstName = safeDecrypt(data.reporter.firstName);
        data.reporter.lastName = safeDecrypt(data.reporter.lastName);
        data.reporter.email = safeDecrypt(data.reporter.email);
      }
      if (data.assignee) {
        data.assignee.firstName = safeDecrypt(data.assignee.firstName);
        data.assignee.lastName = safeDecrypt(data.assignee.lastName);
      }
      return data;
    });

    return res.status(200).json({
      disputes: serializedDisputes,
      total,
      limit: parseInt(limit),
      offset: parseInt(offset),
    });
  } catch (error) {
    console.error("Error fetching IT disputes:", error);
    return res.status(500).json({ error: "Failed to fetch disputes" });
  }
});

/**
 * GET /api/v1/it-dashboard/disputes/:id
 * Get specific IT dispute details
 */
itDashboardRouter.get("/disputes/:id", async (req, res) => {
  try {
    const dispute = await ITDispute.findByPk(req.params.id, {
      include: [
        { model: User, as: "reporter", attributes: ["id", "firstName", "lastName", "username", "email", "phone"] },
        { model: User, as: "assignee", attributes: ["id", "firstName", "lastName", "username"] },
        { model: User, as: "resolver", attributes: ["id", "firstName", "lastName", "username"] },
      ],
    });

    if (!dispute) {
      return res.status(404).json({ error: "Dispute not found" });
    }

    // Decrypt reporter info
    const data = dispute.toJSON();
    if (data.reporter) {
      data.reporter.firstName = safeDecrypt(data.reporter.firstName);
      data.reporter.lastName = safeDecrypt(data.reporter.lastName);
      data.reporter.email = safeDecrypt(data.reporter.email);
      data.reporter.phone = safeDecrypt(data.reporter.phone);
    }
    if (data.assignee) {
      data.assignee.firstName = safeDecrypt(data.assignee.firstName);
      data.assignee.lastName = safeDecrypt(data.assignee.lastName);
    }
    if (data.resolver) {
      data.resolver.firstName = safeDecrypt(data.resolver.firstName);
      data.resolver.lastName = safeDecrypt(data.resolver.lastName);
    }

    return res.status(200).json({ dispute: data });
  } catch (error) {
    console.error("Error fetching IT dispute:", error);
    return res.status(500).json({ error: "Failed to fetch dispute" });
  }
});

/**
 * POST /api/v1/it-dashboard/disputes/:id/assign
 * Assign IT dispute to IT staff
 */
itDashboardRouter.post("/disputes/:id/assign", async (req, res) => {
  try {
    const { assigneeId } = req.body;

    const dispute = await ITDispute.findByPk(req.params.id);
    if (!dispute) {
      return res.status(404).json({ error: "Dispute not found" });
    }

    // Verify assignee is IT staff or owner and is active
    if (assigneeId) {
      const assignee = await User.findByPk(assigneeId);
      if (!assignee || (assignee.type !== "it" && assignee.type !== "owner")) {
        return res.status(400).json({ error: "Invalid assignee - must be IT staff or owner" });
      }
      // Check if assignee account is locked or frozen
      const isLocked = assignee.lockedUntil && new Date(assignee.lockedUntil) > new Date();
      if (isLocked || assignee.accountFrozen) {
        return res.status(400).json({ error: "Cannot assign to locked or frozen account" });
      }
    }

    await dispute.update({
      assignedTo: assigneeId || null,
      assignedAt: assigneeId ? new Date() : null,
      status: assigneeId && dispute.status === "submitted" ? "in_progress" : dispute.status,
    });

    console.log(`✅ IT dispute ${dispute.caseNumber} assigned to user ${assigneeId} by ${req.user.id}`);

    return res.status(200).json({
      message: "Dispute assigned successfully",
      dispute: {
        id: dispute.id,
        caseNumber: dispute.caseNumber,
        assignedTo: dispute.assignedTo,
        status: dispute.status,
      },
    });
  } catch (error) {
    console.error("Error assigning IT dispute:", error);
    return res.status(500).json({ error: "Failed to assign dispute" });
  }
});

/**
 * POST /api/v1/it-dashboard/disputes/:id/status
 * Update IT dispute status
 */
itDashboardRouter.post("/disputes/:id/status", async (req, res) => {
  try {
    const { status } = req.body;
    // Only allow transitioning to open statuses - use /resolve endpoint for resolving
    const validStatuses = ["submitted", "in_progress", "awaiting_info"];

    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        error: "Invalid status. Use /resolve endpoint to resolve disputes.",
        validStatuses
      });
    }

    const dispute = await ITDispute.findByPk(req.params.id);
    if (!dispute) {
      return res.status(404).json({ error: "Dispute not found" });
    }

    // Prevent status changes on resolved/closed disputes
    if (["resolved", "closed"].includes(dispute.status)) {
      return res.status(400).json({
        error: "Cannot change status of resolved or closed disputes"
      });
    }

    await dispute.update({ status });

    console.log(`✅ IT dispute ${dispute.caseNumber} status updated to ${status} by ${req.user.id}`);

    return res.status(200).json({
      message: "Status updated successfully",
      dispute: {
        id: dispute.id,
        caseNumber: dispute.caseNumber,
        status: dispute.status,
      },
    });
  } catch (error) {
    console.error("Error updating IT dispute status:", error);
    return res.status(500).json({ error: "Failed to update status" });
  }
});

/**
 * POST /api/v1/it-dashboard/disputes/:id/resolve
 * Resolve IT dispute
 */
itDashboardRouter.post("/disputes/:id/resolve", async (req, res) => {
  try {
    const { resolutionNotes, resolution } = req.body;

    const dispute = await ITDispute.findByPk(req.params.id);
    if (!dispute) {
      return res.status(404).json({ error: "Dispute not found" });
    }

    // Prevent resolving already resolved/closed disputes
    if (["resolved", "closed"].includes(dispute.status)) {
      return res.status(400).json({ error: "Dispute is already resolved or closed" });
    }

    await dispute.update({
      status: "resolved",
      resolvedBy: req.user.id,
      resolvedAt: new Date(),
      resolutionNotes: resolutionNotes || null,
      resolution: resolution || {},
      closedAt: new Date(),
    });

    // Notify the reporter that their dispute has been resolved
    const NotificationService = require("../../../services/NotificationService");
    await NotificationService.notifyUser({
      userId: dispute.reporterId,
      type: "it_dispute_resolved",
      title: "IT Issue Resolved",
      body: `Your IT issue (${dispute.caseNumber}) has been resolved. Tap for details.`,
      data: { disputeId: dispute.id, caseNumber: dispute.caseNumber },
      actionRequired: false,
      sendPush: true,
      sendEmail: true,
    });

    console.log(`✅ IT dispute ${dispute.caseNumber} resolved by ${req.user.id}`);

    return res.status(200).json({
      message: "Dispute resolved successfully",
      dispute: {
        id: dispute.id,
        caseNumber: dispute.caseNumber,
        status: dispute.status,
        resolvedAt: dispute.resolvedAt,
      },
    });
  } catch (error) {
    console.error("Error resolving IT dispute:", error);
    return res.status(500).json({ error: "Failed to resolve dispute" });
  }
});

/**
 * GET /api/v1/it-dashboard/my-assigned
 * Get disputes assigned to current IT user
 */
itDashboardRouter.get("/my-assigned", async (req, res) => {
  try {
    const disputes = await ITDispute.findAll({
      where: {
        assignedTo: req.user.id,
        status: { [Op.in]: ["submitted", "in_progress", "awaiting_info"] },
      },
      include: [
        { model: User, as: "reporter", attributes: ["id", "firstName", "lastName", "username", "email"] },
      ],
      order: [
        // Use CASE to ensure proper priority order: critical > high > normal > low
        [sequelize.literal(`CASE
          WHEN priority = 'critical' THEN 1
          WHEN priority = 'high' THEN 2
          WHEN priority = 'normal' THEN 3
          WHEN priority = 'low' THEN 4
          ELSE 5 END`), "ASC"],
        ["submittedAt", "ASC"],
      ],
    });

    const serializedDisputes = disputes.map((d) => {
      const data = d.toJSON();
      if (data.reporter) {
        data.reporter.firstName = safeDecrypt(data.reporter.firstName);
        data.reporter.lastName = safeDecrypt(data.reporter.lastName);
        data.reporter.email = safeDecrypt(data.reporter.email);
      }
      return data;
    });

    return res.status(200).json({ disputes: serializedDisputes });
  } catch (error) {
    console.error("Error fetching assigned disputes:", error);
    return res.status(500).json({ error: "Failed to fetch assigned disputes" });
  }
});

/**
 * GET /api/v1/it-dashboard/it-staff
 * Get list of IT staff for assignment dropdown
 */
itDashboardRouter.get("/it-staff", async (req, res) => {
  try {
    const itStaff = await User.findAll({
      where: { type: "it" },
      attributes: ["id", "firstName", "lastName", "username"],
      order: [["firstName", "ASC"]],
    });

    const serializedStaff = itStaff.map((s) => ({
      id: s.id,
      firstName: safeDecrypt(s.firstName),
      lastName: safeDecrypt(s.lastName),
      username: s.username,
    }));

    return res.status(200).json({ itStaff: serializedStaff });
  } catch (error) {
    console.error("Error fetching IT staff:", error);
    return res.status(500).json({ error: "Failed to fetch IT staff" });
  }
});

module.exports = itDashboardRouter;
