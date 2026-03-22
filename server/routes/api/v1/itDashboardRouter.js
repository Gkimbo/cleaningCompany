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

// ==================== SLA BREACH ALERTS ====================
// NOTE: These specific routes MUST be defined BEFORE /disputes/:id to avoid route conflicts

/**
 * GET /api/v1/it-dashboard/disputes/sla-breached
 * Get all disputes that have breached their SLA
 */
itDashboardRouter.get("/disputes/sla-breached", async (req, res) => {
  try {
    const now = new Date();

    const breachedDisputes = await ITDispute.findAll({
      where: {
        status: { [Op.in]: ["submitted", "in_progress", "awaiting_info"] },
        slaDeadline: { [Op.lt]: now },
      },
      include: [
        { model: User, as: "reporter", attributes: ["id", "firstName", "lastName", "username"] },
        { model: User, as: "assignee", attributes: ["id", "firstName", "lastName", "username"] },
      ],
      order: [["slaDeadline", "ASC"]], // Most overdue first
    });

    // Decrypt and add breach duration
    const serializedDisputes = breachedDisputes.map((d) => {
      const data = d.toJSON();
      if (data.reporter) {
        data.reporter.firstName = safeDecrypt(data.reporter.firstName);
        data.reporter.lastName = safeDecrypt(data.reporter.lastName);
      }
      if (data.assignee) {
        data.assignee.firstName = safeDecrypt(data.assignee.firstName);
        data.assignee.lastName = safeDecrypt(data.assignee.lastName);
      }
      // Calculate how long past SLA
      const hoursOverdue = Math.round((now - new Date(d.slaDeadline)) / (1000 * 60 * 60));
      data.hoursOverdue = hoursOverdue;
      return data;
    });

    return res.status(200).json({
      count: serializedDisputes.length,
      disputes: serializedDisputes,
    });
  } catch (error) {
    console.error("Error fetching SLA breached disputes:", error);
    return res.status(500).json({ error: "Failed to fetch SLA breached disputes" });
  }
});

// ==================== EXPORT DISPUTES ====================

/**
 * GET /api/v1/it-dashboard/disputes/export
 * Export disputes as JSON (can be used for CSV generation on frontend)
 */
itDashboardRouter.get("/disputes/export", async (req, res) => {
  try {
    const { status, startDate, endDate, priority, category } = req.query;

    const where = {};

    if (status) {
      if (status === "open") {
        where.status = { [Op.in]: ["submitted", "in_progress", "awaiting_info"] };
      } else if (status === "closed") {
        where.status = { [Op.in]: ["resolved", "closed"] };
      } else {
        where.status = status;
      }
    }

    if (priority) {
      where.priority = priority;
    }

    if (category) {
      where.category = category;
    }

    if (startDate || endDate) {
      where.submittedAt = {};
      if (startDate) where.submittedAt[Op.gte] = new Date(startDate);
      if (endDate) where.submittedAt[Op.lte] = new Date(endDate);
    }

    const disputes = await ITDispute.findAll({
      where,
      include: [
        { model: User, as: "reporter", attributes: ["id", "username"] },
        { model: User, as: "assignee", attributes: ["id", "username"] },
        { model: User, as: "resolver", attributes: ["id", "username"] },
      ],
      order: [["submittedAt", "DESC"]],
    });

    const exportData = disputes.map(d => ({
      caseNumber: d.caseNumber,
      category: d.category,
      status: d.status,
      priority: d.priority,
      reporterUsername: d.reporter?.username,
      assigneeUsername: d.assignee?.username,
      resolverUsername: d.resolver?.username,
      submittedAt: d.submittedAt,
      resolvedAt: d.resolvedAt,
      closedAt: d.closedAt,
      slaDeadline: d.slaDeadline,
      slaBreach: d.slaDeadline && new Date() > new Date(d.slaDeadline) && ["submitted", "in_progress", "awaiting_info"].includes(d.status),
      platform: d.platform,
      appVersion: d.appVersion,
    }));

    return res.status(200).json({
      exportedAt: new Date().toISOString(),
      count: exportData.length,
      disputes: exportData,
    });
  } catch (error) {
    console.error("Error exporting disputes:", error);
    return res.status(500).json({ error: "Failed to export disputes" });
  }
});

/**
 * GET /api/v1/it-dashboard/disputes/escalated
 * Get all escalated disputes
 * NOTE: Must be before /disputes/:id to avoid route conflict
 */
itDashboardRouter.get("/disputes/escalated", async (req, res) => {
  try {
    const { escalatedTo } = req.query;

    const where = {
      escalatedTo: { [Op.ne]: null },
      status: { [Op.in]: ["submitted", "in_progress", "awaiting_info"] },
    };

    if (escalatedTo) {
      where.escalatedTo = escalatedTo;
    }

    const disputes = await ITDispute.findAll({
      where,
      include: [
        { model: User, as: "reporter", attributes: ["id", "firstName", "lastName", "username"] },
        { model: User, as: "assignee", attributes: ["id", "firstName", "lastName", "username"] },
      ],
      order: [["escalatedAt", "ASC"]],
    });

    const serializedDisputes = disputes.map(d => {
      const data = d.toJSON();
      if (data.reporter) {
        data.reporter.firstName = safeDecrypt(data.reporter.firstName);
        data.reporter.lastName = safeDecrypt(data.reporter.lastName);
      }
      if (data.assignee) {
        data.assignee.firstName = safeDecrypt(data.assignee.firstName);
        data.assignee.lastName = safeDecrypt(data.assignee.lastName);
      }
      return data;
    });

    // Group by escalation target
    const byTarget = {
      hr: serializedDisputes.filter(d => d.escalatedTo === "hr"),
      owner: serializedDisputes.filter(d => d.escalatedTo === "owner"),
      external: serializedDisputes.filter(d => d.escalatedTo === "external"),
    };

    return res.status(200).json({
      total: serializedDisputes.length,
      byTarget,
      disputes: serializedDisputes,
    });
  } catch (error) {
    console.error("Error fetching escalated disputes:", error);
    return res.status(500).json({ error: "Failed to fetch escalated disputes" });
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

    // Filter by reporter
    if (req.query.reporterId) {
      where.reporterId = parseInt(req.query.reporterId);
    }

    // Filter by search term (case number or description)
    if (req.query.search) {
      const searchTerm = req.query.search.trim();
      where[Op.or] = [
        { caseNumber: { [Op.iLike]: `%${searchTerm}%` } },
        { description: { [Op.iLike]: `%${searchTerm}%` } },
      ];
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
 * Assign IT dispute to IT staff (with history tracking)
 */
itDashboardRouter.post("/disputes/:id/assign", async (req, res) => {
  try {
    const { assigneeId } = req.body;

    const dispute = await ITDispute.findByPk(req.params.id);
    if (!dispute) {
      return res.status(404).json({ error: "Dispute not found" });
    }

    // Verify assignee is IT staff or owner and is active
    let assigneeName = null;
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
      assigneeName = assignee.username;
    }

    // Track assignment history
    const now = new Date();
    const existingHistory = dispute.assignmentHistory || [];

    // If there was a previous assignee, mark them as unassigned
    if (dispute.assignedTo && dispute.assignedTo !== assigneeId) {
      const lastEntry = existingHistory[existingHistory.length - 1];
      if (lastEntry && !lastEntry.unassignedAt) {
        lastEntry.unassignedAt = now.toISOString();
      }
    }

    // Add new assignment to history (if assigning to someone)
    if (assigneeId) {
      existingHistory.push({
        assignedTo: assigneeId,
        assignedToUsername: assigneeName,
        assignedBy: req.user.id,
        assignedByUsername: req.user.username,
        assignedAt: now.toISOString(),
        unassignedAt: null,
      });
    }

    await dispute.update({
      assignedTo: assigneeId || null,
      assignedAt: assigneeId ? now : null,
      status: assigneeId && dispute.status === "submitted" ? "in_progress" : dispute.status,
      assignmentHistory: existingHistory,
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
      // NOTE: Don't sort by firstName in DB - encrypted values won't sort correctly
    });

    // Decrypt first, then sort alphabetically by decrypted firstName
    const serializedStaff = itStaff.map((s) => ({
      id: s.id,
      firstName: safeDecrypt(s.firstName),
      lastName: safeDecrypt(s.lastName),
      username: s.username,
    })).sort((a, b) => {
      const nameA = (a.firstName || "").toLowerCase();
      const nameB = (b.firstName || "").toLowerCase();
      return nameA.localeCompare(nameB);
    });

    return res.status(200).json({ itStaff: serializedStaff });
  } catch (error) {
    console.error("Error fetching IT staff:", error);
    return res.status(500).json({ error: "Failed to fetch IT staff" });
  }
});

// ==================== REOPEN CLOSED DISPUTE ====================

/**
 * POST /api/v1/it-dashboard/disputes/:id/reopen
 * Reopen a resolved or closed dispute
 */
itDashboardRouter.post("/disputes/:id/reopen", async (req, res) => {
  try {
    const { reason } = req.body;

    const dispute = await ITDispute.findByPk(req.params.id);
    if (!dispute) {
      return res.status(404).json({ error: "Dispute not found" });
    }

    if (!["resolved", "closed"].includes(dispute.status)) {
      return res.status(400).json({ error: "Can only reopen resolved or closed disputes" });
    }

    // Append reopen note to description
    const reopenNote = `\n\n--- REOPENED (${new Date().toISOString()}) ---\nBy: ${req.user.username}\nReason: ${reason || "No reason provided"}`;

    await dispute.update({
      status: "in_progress",
      resolvedAt: null,
      resolvedBy: null,
      closedAt: null,
      description: dispute.description + reopenNote,
      // Reset SLA based on priority
      slaDeadline: new Date(Date.now() + (
        dispute.priority === "critical" ? 4 :
        dispute.priority === "high" ? 24 :
        dispute.priority === "normal" ? 48 : 72
      ) * 60 * 60 * 1000),
    });

    console.log(`✅ IT dispute ${dispute.caseNumber} reopened by ${req.user.id}`);

    return res.status(200).json({
      success: true,
      message: "Dispute reopened",
      dispute: {
        id: dispute.id,
        caseNumber: dispute.caseNumber,
        status: dispute.status,
        slaDeadline: dispute.slaDeadline,
      },
    });
  } catch (error) {
    console.error("Error reopening dispute:", error);
    return res.status(500).json({ error: "Failed to reopen dispute" });
  }
});

// ==================== CHANGE PRIORITY ====================

/**
 * POST /api/v1/it-dashboard/disputes/:id/priority
 * Change dispute priority
 */
itDashboardRouter.post("/disputes/:id/priority", async (req, res) => {
  try {
    const { priority, reason } = req.body;
    const validPriorities = ["low", "normal", "high", "critical"];

    if (!priority || !validPriorities.includes(priority)) {
      return res.status(400).json({
        error: "Invalid priority",
        validPriorities,
      });
    }

    const dispute = await ITDispute.findByPk(req.params.id);
    if (!dispute) {
      return res.status(404).json({ error: "Dispute not found" });
    }

    if (["resolved", "closed"].includes(dispute.status)) {
      return res.status(400).json({ error: "Cannot change priority of resolved or closed disputes" });
    }

    const oldPriority = dispute.priority;

    // Update priority and recalculate SLA
    const slaHours = { low: 72, normal: 48, high: 24, critical: 4 };
    const newSlaDeadline = new Date(Date.now() + slaHours[priority] * 60 * 60 * 1000);

    // Append note to description
    const priorityNote = `\n\n--- PRIORITY CHANGED (${new Date().toISOString()}) ---\nBy: ${req.user.username}\nFrom: ${oldPriority} → ${priority}${reason ? `\nReason: ${reason}` : ""}`;

    await dispute.update({
      priority,
      slaDeadline: newSlaDeadline,
      description: dispute.description + priorityNote,
    });

    console.log(`✅ IT dispute ${dispute.caseNumber} priority changed from ${oldPriority} to ${priority} by ${req.user.id}`);

    return res.status(200).json({
      success: true,
      message: `Priority changed from ${oldPriority} to ${priority}`,
      dispute: {
        id: dispute.id,
        caseNumber: dispute.caseNumber,
        priority: dispute.priority,
        slaDeadline: dispute.slaDeadline,
      },
    });
  } catch (error) {
    console.error("Error changing dispute priority:", error);
    return res.status(500).json({ error: "Failed to change priority" });
  }
});

// ==================== INTERNAL NOTES ON DISPUTE ====================

/**
 * POST /api/v1/it-dashboard/disputes/:id/notes
 * Add internal IT note to dispute
 */
itDashboardRouter.post("/disputes/:id/notes", async (req, res) => {
  try {
    const { note } = req.body;

    if (!note || note.trim().length < 1) {
      return res.status(400).json({ error: "Note is required" });
    }

    const dispute = await ITDispute.findByPk(req.params.id);
    if (!dispute) {
      return res.status(404).json({ error: "Dispute not found" });
    }

    // Append to resolution field (using it for internal notes before resolution)
    const existingNotes = dispute.resolution?.internalNotes || [];
    const newNote = {
      author: req.user.username,
      authorId: req.user.id,
      note: note.trim(),
      timestamp: new Date().toISOString(),
    };

    await dispute.update({
      resolution: {
        ...dispute.resolution,
        internalNotes: [...existingNotes, newNote],
      },
    });

    console.log(`✅ IT note added to dispute ${dispute.caseNumber} by ${req.user.id}`);

    return res.status(200).json({
      success: true,
      message: "Note added",
      note: newNote,
    });
  } catch (error) {
    console.error("Error adding dispute note:", error);
    return res.status(500).json({ error: "Failed to add note" });
  }
});

/**
 * GET /api/v1/it-dashboard/disputes/:id/notes
 * Get internal IT notes for a dispute
 */
itDashboardRouter.get("/disputes/:id/notes", async (req, res) => {
  try {
    const dispute = await ITDispute.findByPk(req.params.id, {
      attributes: ["id", "caseNumber", "resolution"],
    });

    if (!dispute) {
      return res.status(404).json({ error: "Dispute not found" });
    }

    const notes = dispute.resolution?.internalNotes || [];

    return res.status(200).json({
      disputeId: dispute.id,
      caseNumber: dispute.caseNumber,
      notes,
    });
  } catch (error) {
    console.error("Error fetching dispute notes:", error);
    return res.status(500).json({ error: "Failed to fetch notes" });
  }
});

// ==================== SYSTEM HEALTH DASHBOARD ====================

/**
 * GET /api/v1/it-dashboard/system-health
 * Get system health information
 */
itDashboardRouter.get("/system-health", async (req, res) => {
  try {
    const healthChecks = {
      timestamp: new Date().toISOString(),
      services: {},
    };

    // Database connectivity check
    try {
      await sequelize.authenticate();
      healthChecks.services.database = { status: "healthy", latencyMs: null };
      const startTime = Date.now();
      await User.count();
      healthChecks.services.database.latencyMs = Date.now() - startTime;
    } catch (dbError) {
      healthChecks.services.database = { status: "unhealthy", error: dbError.message };
    }

    // Get recent error rate from security logs
    try {
      const { SecurityAuditLog } = require("../../../models");
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

      const [totalEvents, failedEvents] = await Promise.all([
        SecurityAuditLog.count({ where: { occurredAt: { [Op.gte]: oneHourAgo } } }),
        SecurityAuditLog.count({
          where: {
            occurredAt: { [Op.gte]: oneHourAgo },
            success: false,
          },
        }),
      ]);

      healthChecks.services.authEvents = {
        status: "healthy",
        lastHour: {
          total: totalEvents,
          failed: failedEvents,
          failureRate: totalEvents > 0 ? ((failedEvents / totalEvents) * 100).toFixed(1) + "%" : "0%",
        },
      };
    } catch (logError) {
      healthChecks.services.authEvents = { status: "unknown", error: logError.message };
    }

    // IT dispute queue health
    try {
      const [openDisputes, criticalOpen, slaBreached] = await Promise.all([
        ITDispute.count({ where: { status: { [Op.in]: ["submitted", "in_progress", "awaiting_info"] } } }),
        ITDispute.count({
          where: {
            status: { [Op.in]: ["submitted", "in_progress", "awaiting_info"] },
            priority: "critical",
          },
        }),
        ITDispute.count({
          where: {
            status: { [Op.in]: ["submitted", "in_progress", "awaiting_info"] },
            slaDeadline: { [Op.lt]: new Date() },
          },
        }),
      ]);

      healthChecks.services.itQueue = {
        status: slaBreached > 5 ? "warning" : "healthy",
        openDisputes,
        criticalOpen,
        slaBreached,
      };
    } catch (queueError) {
      healthChecks.services.itQueue = { status: "unknown", error: queueError.message };
    }

    // Memory usage
    const memUsage = process.memoryUsage();
    healthChecks.system = {
      uptime: process.uptime(),
      memory: {
        heapUsedMB: Math.round(memUsage.heapUsed / 1024 / 1024),
        heapTotalMB: Math.round(memUsage.heapTotal / 1024 / 1024),
        rssMB: Math.round(memUsage.rss / 1024 / 1024),
      },
      nodeVersion: process.version,
    };

    // Overall status
    const unhealthyServices = Object.values(healthChecks.services).filter(s => s.status === "unhealthy").length;
    healthChecks.overall = unhealthyServices > 0 ? "degraded" : "healthy";

    return res.status(200).json(healthChecks);
  } catch (error) {
    console.error("Error fetching system health:", error);
    return res.status(500).json({
      timestamp: new Date().toISOString(),
      overall: "unhealthy",
      error: error.message,
    });
  }
});

// ==================== CANNED RESPONSES ====================

// Pre-defined IT support responses
const CANNED_RESPONSES = {
  // Login Issues
  login_locked: {
    category: "login_problem",
    title: "Account Locked",
    template: "Your account has been locked due to multiple failed login attempts. I've unlocked it for you. Please try logging in again with your correct password. If you've forgotten your password, use the 'Forgot Password' option.",
  },
  login_password_reset: {
    category: "login_problem",
    title: "Password Reset Sent",
    template: "I've sent a password reset email to your registered email address. Please check your inbox (and spam folder) and follow the link to create a new password. The link expires in 1 hour.",
  },
  // App Issues
  app_clear_cache: {
    category: "app_crash",
    title: "Clear App Cache",
    template: "Please try clearing your app cache and data: Go to Settings > Apps > [App Name] > Storage > Clear Cache. If the issue persists, try uninstalling and reinstalling the app.",
  },
  app_update_required: {
    category: "app_crash",
    title: "Update Required",
    template: "Your app version appears to be outdated. Please update to the latest version from the App Store/Play Store. This should resolve the issue you're experiencing.",
  },
  // Billing
  billing_refund_processing: {
    category: "billing_error",
    title: "Refund Processing",
    template: "I've initiated a refund for this charge. Please allow 5-10 business days for the refund to appear on your statement, depending on your bank's processing time.",
  },
  billing_payment_failed: {
    category: "payment_system_error",
    title: "Payment Failed",
    template: "The payment failed due to [reason]. Please update your payment method in the app under Settings > Payment Methods, or try using a different card.",
  },
  // General
  general_escalated: {
    category: "data_request",
    title: "Escalated to Owner",
    template: "I've escalated this issue to our management team for further review. You should receive a response within 24-48 hours. We appreciate your patience.",
  },
  general_more_info: {
    category: "performance_issue",
    title: "Need More Information",
    template: "To better assist you, I need some additional information:\n- What device/OS are you using?\n- What app version do you have?\n- Can you describe the exact steps that led to this issue?\n- Do you have any screenshots that might help?",
  },
  // Security
  security_account_secured: {
    category: "security_issue",
    title: "Account Secured",
    template: "I've taken steps to secure your account: 1) Logged you out of all devices, 2) Reset your password (check email), 3) Reviewed recent account activity. Please review your account settings after logging back in.",
  },
};

/**
 * GET /api/v1/it-dashboard/canned-responses
 * Get all canned response templates
 */
itDashboardRouter.get("/canned-responses", async (req, res) => {
  try {
    const { category } = req.query;

    let responses = Object.entries(CANNED_RESPONSES).map(([key, value]) => ({
      id: key,
      ...value,
    }));

    if (category) {
      responses = responses.filter(r => r.category === category);
    }

    return res.status(200).json({
      responses,
      categories: [...new Set(Object.values(CANNED_RESPONSES).map(r => r.category))],
    });
  } catch (error) {
    console.error("Error fetching canned responses:", error);
    return res.status(500).json({ error: "Failed to fetch canned responses" });
  }
});

/**
 * GET /api/v1/it-dashboard/canned-responses/:id
 * Get specific canned response
 */
itDashboardRouter.get("/canned-responses/:id", async (req, res) => {
  try {
    const response = CANNED_RESPONSES[req.params.id];

    if (!response) {
      return res.status(404).json({ error: "Canned response not found" });
    }

    return res.status(200).json({
      id: req.params.id,
      ...response,
    });
  } catch (error) {
    console.error("Error fetching canned response:", error);
    return res.status(500).json({ error: "Failed to fetch canned response" });
  }
});

// ==================== ASSIGNMENT HISTORY ====================

/**
 * GET /api/v1/it-dashboard/disputes/:id/assignment-history
 * Get full assignment history for a dispute
 */
itDashboardRouter.get("/disputes/:id/assignment-history", async (req, res) => {
  try {
    const dispute = await ITDispute.findByPk(req.params.id, {
      attributes: ["id", "caseNumber", "assignedTo", "assignedAt", "assignmentHistory"],
    });

    if (!dispute) {
      return res.status(404).json({ error: "Dispute not found" });
    }

    const history = dispute.assignmentHistory || [];

    // Calculate time spent for each assignment
    const enrichedHistory = history.map((entry, index) => {
      let timeSpentMinutes = null;
      if (entry.assignedAt) {
        const start = new Date(entry.assignedAt);
        const end = entry.unassignedAt ? new Date(entry.unassignedAt) : new Date();
        timeSpentMinutes = Math.round((end - start) / (1000 * 60));
      }
      return {
        ...entry,
        timeSpentMinutes,
        timeSpentFormatted: timeSpentMinutes !== null
          ? timeSpentMinutes < 60
            ? `${timeSpentMinutes}m`
            : `${Math.floor(timeSpentMinutes / 60)}h ${timeSpentMinutes % 60}m`
          : null,
        isCurrent: index === history.length - 1 && !entry.unassignedAt,
      };
    });

    return res.status(200).json({
      disputeId: dispute.id,
      caseNumber: dispute.caseNumber,
      currentAssignee: dispute.assignedTo,
      totalAssignments: history.length,
      history: enrichedHistory,
    });
  } catch (error) {
    console.error("Error fetching assignment history:", error);
    return res.status(500).json({ error: "Failed to fetch assignment history" });
  }
});

// ==================== DISPUTE LINKING ====================

/**
 * POST /api/v1/it-dashboard/disputes/:id/link
 * Link two disputes together
 */
itDashboardRouter.post("/disputes/:id/link", async (req, res) => {
  try {
    const { targetDisputeId, relationship } = req.body;
    const sourceId = parseInt(req.params.id, 10);
    const targetId = parseInt(targetDisputeId, 10);

    if (!targetDisputeId || isNaN(targetId)) {
      return res.status(400).json({ error: "Target dispute ID is required" });
    }

    if (sourceId === targetId) {
      return res.status(400).json({ error: "Cannot link a dispute to itself" });
    }

    // Validate relationship type
    const validRelationships = ["related", "duplicate", "parent", "child", "blocks", "blocked_by"];
    const relationshipType = validRelationships.includes(relationship) ? relationship : "related";

    // Get both disputes
    const [sourceDispute, targetDispute] = await Promise.all([
      ITDispute.findByPk(sourceId),
      ITDispute.findByPk(targetId),
    ]);

    if (!sourceDispute) {
      return res.status(404).json({ error: "Source dispute not found" });
    }
    if (!targetDispute) {
      return res.status(404).json({ error: "Target dispute not found" });
    }

    // Add link to source dispute
    const sourceLinks = sourceDispute.linkedDisputes || [];
    const existingSourceLink = sourceLinks.find(l => l.disputeId === targetId);
    if (!existingSourceLink) {
      sourceLinks.push({
        disputeId: targetId,
        caseNumber: targetDispute.caseNumber,
        relationship: relationshipType,
        linkedAt: new Date().toISOString(),
        linkedBy: req.user.id,
        linkedByUsername: req.user.username,
      });
    }

    // Add reverse link to target dispute
    const targetLinks = targetDispute.linkedDisputes || [];
    const existingTargetLink = targetLinks.find(l => l.disputeId === sourceId);
    if (!existingTargetLink) {
      // Determine reverse relationship
      let reverseRelationship = relationshipType;
      if (relationshipType === "parent") reverseRelationship = "child";
      else if (relationshipType === "child") reverseRelationship = "parent";
      else if (relationshipType === "blocks") reverseRelationship = "blocked_by";
      else if (relationshipType === "blocked_by") reverseRelationship = "blocks";

      targetLinks.push({
        disputeId: sourceId,
        caseNumber: sourceDispute.caseNumber,
        relationship: reverseRelationship,
        linkedAt: new Date().toISOString(),
        linkedBy: req.user.id,
        linkedByUsername: req.user.username,
      });
    }

    // Update both disputes
    await Promise.all([
      sourceDispute.update({ linkedDisputes: sourceLinks }),
      targetDispute.update({ linkedDisputes: targetLinks }),
    ]);

    console.log(`✅ IT disputes ${sourceDispute.caseNumber} and ${targetDispute.caseNumber} linked by ${req.user.id}`);

    return res.status(200).json({
      success: true,
      message: `Linked ${sourceDispute.caseNumber} to ${targetDispute.caseNumber}`,
      link: {
        sourceDispute: { id: sourceId, caseNumber: sourceDispute.caseNumber },
        targetDispute: { id: targetId, caseNumber: targetDispute.caseNumber },
        relationship: relationshipType,
      },
    });
  } catch (error) {
    console.error("Error linking disputes:", error);
    return res.status(500).json({ error: "Failed to link disputes" });
  }
});

/**
 * DELETE /api/v1/it-dashboard/disputes/:id/link/:targetId
 * Unlink two disputes
 */
itDashboardRouter.delete("/disputes/:id/link/:targetId", async (req, res) => {
  try {
    const sourceId = parseInt(req.params.id, 10);
    const targetId = parseInt(req.params.targetId, 10);

    if (isNaN(sourceId) || isNaN(targetId)) {
      return res.status(400).json({ error: "Invalid dispute IDs" });
    }

    // Get both disputes
    const [sourceDispute, targetDispute] = await Promise.all([
      ITDispute.findByPk(sourceId),
      ITDispute.findByPk(targetId),
    ]);

    if (!sourceDispute) {
      return res.status(404).json({ error: "Source dispute not found" });
    }
    if (!targetDispute) {
      return res.status(404).json({ error: "Target dispute not found" });
    }

    // Remove link from source
    const sourceLinks = (sourceDispute.linkedDisputes || []).filter(l => l.disputeId !== targetId);

    // Remove link from target
    const targetLinks = (targetDispute.linkedDisputes || []).filter(l => l.disputeId !== sourceId);

    // Update both disputes
    await Promise.all([
      sourceDispute.update({ linkedDisputes: sourceLinks }),
      targetDispute.update({ linkedDisputes: targetLinks }),
    ]);

    console.log(`✅ IT disputes ${sourceDispute.caseNumber} and ${targetDispute.caseNumber} unlinked by ${req.user.id}`);

    return res.status(200).json({
      success: true,
      message: `Unlinked ${sourceDispute.caseNumber} from ${targetDispute.caseNumber}`,
    });
  } catch (error) {
    console.error("Error unlinking disputes:", error);
    return res.status(500).json({ error: "Failed to unlink disputes" });
  }
});

/**
 * GET /api/v1/it-dashboard/disputes/:id/linked
 * Get all disputes linked to a specific dispute
 */
itDashboardRouter.get("/disputes/:id/linked", async (req, res) => {
  try {
    const dispute = await ITDispute.findByPk(req.params.id, {
      attributes: ["id", "caseNumber", "linkedDisputes"],
    });

    if (!dispute) {
      return res.status(404).json({ error: "Dispute not found" });
    }

    const linkedIds = (dispute.linkedDisputes || []).map(l => l.disputeId);

    // Get details of linked disputes
    let linkedDisputes = [];
    if (linkedIds.length > 0) {
      const disputes = await ITDispute.findAll({
        where: { id: { [Op.in]: linkedIds } },
        attributes: ["id", "caseNumber", "category", "status", "priority", "submittedAt"],
      });

      // Merge with link metadata
      linkedDisputes = disputes.map(d => {
        const linkInfo = dispute.linkedDisputes.find(l => l.disputeId === d.id);
        return {
          ...d.toJSON(),
          relationship: linkInfo?.relationship || "related",
          linkedAt: linkInfo?.linkedAt,
          linkedByUsername: linkInfo?.linkedByUsername,
        };
      });
    }

    return res.status(200).json({
      disputeId: dispute.id,
      caseNumber: dispute.caseNumber,
      linkedCount: linkedDisputes.length,
      linkedDisputes,
    });
  } catch (error) {
    console.error("Error fetching linked disputes:", error);
    return res.status(500).json({ error: "Failed to fetch linked disputes" });
  }
});

// ==================== IT STAFF WORKLOAD VIEW ====================

/**
 * GET /api/v1/it-dashboard/workload
 * Get workload distribution across all IT staff
 */
itDashboardRouter.get("/workload", async (req, res) => {
  try {
    const now = new Date();
    const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    // Get all IT staff
    const itStaff = await User.findAll({
      where: { type: "it" },
      attributes: ["id", "firstName", "lastName", "username"],
    });

    // Get workload stats for each IT staff member
    const workloadPromises = itStaff.map(async (staff) => {
      // Open disputes assigned to this person
      const openDisputes = await ITDispute.findAll({
        where: {
          assignedTo: staff.id,
          status: { [Op.in]: ["submitted", "in_progress", "awaiting_info"] },
        },
        attributes: ["id", "priority", "slaDeadline", "submittedAt"],
      });

      // Count by priority
      const byPriority = {
        critical: openDisputes.filter(d => d.priority === "critical").length,
        high: openDisputes.filter(d => d.priority === "high").length,
        normal: openDisputes.filter(d => d.priority === "normal").length,
        low: openDisputes.filter(d => d.priority === "low").length,
      };

      // Count SLA breaches
      const slaBreached = openDisputes.filter(d =>
        d.slaDeadline && new Date(d.slaDeadline) < now
      ).length;

      // Resolved this week
      const resolvedThisWeek = await ITDispute.count({
        where: {
          resolvedBy: staff.id,
          resolvedAt: { [Op.gte]: oneWeekAgo },
        },
      });

      // Average resolution time this week (in hours)
      const resolvedDisputes = await ITDispute.findAll({
        where: {
          resolvedBy: staff.id,
          resolvedAt: { [Op.gte]: oneWeekAgo },
        },
        attributes: ["submittedAt", "resolvedAt"],
      });

      let avgResolutionHours = null;
      if (resolvedDisputes.length > 0) {
        const totalHours = resolvedDisputes.reduce((sum, d) => {
          if (d.submittedAt && d.resolvedAt) {
            return sum + (new Date(d.resolvedAt) - new Date(d.submittedAt)) / (1000 * 60 * 60);
          }
          return sum;
        }, 0);
        avgResolutionHours = Math.round(totalHours / resolvedDisputes.length);
      }

      return {
        id: staff.id,
        username: staff.username,
        firstName: safeDecrypt(staff.firstName),
        lastName: safeDecrypt(staff.lastName),
        workload: {
          totalOpen: openDisputes.length,
          byPriority,
          slaBreached,
          resolvedThisWeek,
          avgResolutionHours,
        },
      };
    });

    const staffWorkloads = await Promise.all(workloadPromises);

    // Sort by total open disputes (highest first)
    staffWorkloads.sort((a, b) => b.workload.totalOpen - a.workload.totalOpen);

    // Calculate team totals
    const teamTotals = {
      totalOpen: staffWorkloads.reduce((sum, s) => sum + s.workload.totalOpen, 0),
      totalSlaBreached: staffWorkloads.reduce((sum, s) => sum + s.workload.slaBreached, 0),
      totalResolvedThisWeek: staffWorkloads.reduce((sum, s) => sum + s.workload.resolvedThisWeek, 0),
      byPriority: {
        critical: staffWorkloads.reduce((sum, s) => sum + s.workload.byPriority.critical, 0),
        high: staffWorkloads.reduce((sum, s) => sum + s.workload.byPriority.high, 0),
        normal: staffWorkloads.reduce((sum, s) => sum + s.workload.byPriority.normal, 0),
        low: staffWorkloads.reduce((sum, s) => sum + s.workload.byPriority.low, 0),
      },
    };

    // Get unassigned disputes
    const unassignedDisputes = await ITDispute.count({
      where: {
        assignedTo: null,
        status: { [Op.in]: ["submitted", "in_progress", "awaiting_info"] },
      },
    });

    return res.status(200).json({
      timestamp: now.toISOString(),
      teamSize: staffWorkloads.length,
      teamTotals,
      unassignedDisputes,
      staffWorkloads,
    });
  } catch (error) {
    console.error("Error fetching workload data:", error);
    return res.status(500).json({ error: "Failed to fetch workload data" });
  }
});

/**
 * GET /api/v1/it-dashboard/workload/:staffId
 * Get detailed workload for a specific IT staff member
 */
itDashboardRouter.get("/workload/:staffId", async (req, res) => {
  try {
    const staffId = parseInt(req.params.staffId, 10);
    if (isNaN(staffId)) {
      return res.status(400).json({ error: "Invalid staff ID" });
    }

    const staff = await User.findByPk(staffId, {
      attributes: ["id", "firstName", "lastName", "username", "type"],
    });

    if (!staff) {
      return res.status(404).json({ error: "Staff member not found" });
    }

    if (staff.type !== "it" && staff.type !== "owner") {
      return res.status(400).json({ error: "User is not IT staff" });
    }

    const now = new Date();
    const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const oneMonthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    // Get all open disputes for this person
    const openDisputes = await ITDispute.findAll({
      where: {
        assignedTo: staffId,
        status: { [Op.in]: ["submitted", "in_progress", "awaiting_info"] },
      },
      include: [
        { model: User, as: "reporter", attributes: ["id", "firstName", "lastName", "username"] },
      ],
      order: [
        [sequelize.literal(`CASE
          WHEN priority = 'critical' THEN 1
          WHEN priority = 'high' THEN 2
          WHEN priority = 'normal' THEN 3
          WHEN priority = 'low' THEN 4
          ELSE 5 END`), "ASC"],
        ["slaDeadline", "ASC"],
      ],
    });

    // Serialize and enrich open disputes
    const serializedOpenDisputes = openDisputes.map(d => {
      const data = d.toJSON();
      if (data.reporter) {
        data.reporter.firstName = safeDecrypt(data.reporter.firstName);
        data.reporter.lastName = safeDecrypt(data.reporter.lastName);
      }
      // Add SLA status
      data.slaBreach = d.slaDeadline && new Date(d.slaDeadline) < now;
      if (d.slaDeadline) {
        const hoursUntilSla = Math.round((new Date(d.slaDeadline) - now) / (1000 * 60 * 60));
        data.hoursUntilSla = hoursUntilSla;
      }
      return data;
    });

    // Get resolution stats
    const [resolvedThisWeek, resolvedThisMonth] = await Promise.all([
      ITDispute.count({
        where: {
          resolvedBy: staffId,
          resolvedAt: { [Op.gte]: oneWeekAgo },
        },
      }),
      ITDispute.count({
        where: {
          resolvedBy: staffId,
          resolvedAt: { [Op.gte]: oneMonthAgo },
        },
      }),
    ]);

    // Get category distribution
    const categoryStats = {};
    for (const [group, categories] of Object.entries(CATEGORY_GROUPS)) {
      categoryStats[group] = openDisputes.filter(d => categories.includes(d.category)).length;
    }

    return res.status(200).json({
      staff: {
        id: staff.id,
        username: staff.username,
        firstName: safeDecrypt(staff.firstName),
        lastName: safeDecrypt(staff.lastName),
      },
      stats: {
        totalOpen: openDisputes.length,
        slaBreached: openDisputes.filter(d => d.slaDeadline && new Date(d.slaDeadline) < now).length,
        resolvedThisWeek,
        resolvedThisMonth,
        byPriority: {
          critical: openDisputes.filter(d => d.priority === "critical").length,
          high: openDisputes.filter(d => d.priority === "high").length,
          normal: openDisputes.filter(d => d.priority === "normal").length,
          low: openDisputes.filter(d => d.priority === "low").length,
        },
        byCategory: categoryStats,
      },
      openDisputes: serializedOpenDisputes,
    });
  } catch (error) {
    console.error("Error fetching staff workload:", error);
    return res.status(500).json({ error: "Failed to fetch staff workload" });
  }
});

// ==================== CUSTOM CANNED RESPONSES ====================

/**
 * GET /api/v1/it-dashboard/custom-responses
 * Get all custom canned responses (global + user's personal)
 */
itDashboardRouter.get("/custom-responses", async (req, res) => {
  try {
    const { ITCannedResponse } = require("../../../models");
    const { category, includeInactive } = req.query;

    const where = {
      [Op.or]: [
        { isGlobal: true },
        { createdBy: req.user.id },
      ],
    };

    if (!includeInactive) {
      where.isActive = true;
    }

    if (category) {
      where.category = category;
    }

    const responses = await ITCannedResponse.findAll({
      where,
      include: [
        { model: User, as: "creator", attributes: ["id", "username"] },
      ],
      order: [
        ["usageCount", "DESC"],
        ["title", "ASC"],
      ],
    });

    return res.status(200).json({
      responses,
      total: responses.length,
    });
  } catch (error) {
    console.error("Error fetching custom responses:", error);
    return res.status(500).json({ error: "Failed to fetch custom responses" });
  }
});

/**
 * POST /api/v1/it-dashboard/custom-responses
 * Create a new custom canned response
 */
itDashboardRouter.post("/custom-responses", async (req, res) => {
  try {
    const { ITCannedResponse } = require("../../../models");
    const { title, category, template, shortcut, isGlobal, tags } = req.body;

    if (!title || !template) {
      return res.status(400).json({ error: "Title and template are required" });
    }

    // Check shortcut uniqueness if provided
    if (shortcut) {
      const existing = await ITCannedResponse.findOne({ where: { shortcut } });
      if (existing) {
        return res.status(400).json({ error: "Shortcut already in use" });
      }
    }

    const response = await ITCannedResponse.create({
      title: title.trim(),
      category: category || null,
      template: template.trim(),
      shortcut: shortcut ? shortcut.toLowerCase().trim() : null,
      isGlobal: isGlobal !== false, // Default to global
      createdBy: req.user.id,
      tags: tags || [],
    });

    console.log(`✅ Custom canned response "${title}" created by ${req.user.id}`);

    return res.status(201).json({
      success: true,
      response,
    });
  } catch (error) {
    console.error("Error creating custom response:", error);
    return res.status(500).json({ error: "Failed to create custom response" });
  }
});

/**
 * PATCH /api/v1/it-dashboard/custom-responses/:id
 * Update a custom canned response
 */
itDashboardRouter.patch("/custom-responses/:id", async (req, res) => {
  try {
    const { ITCannedResponse } = require("../../../models");
    const { title, category, template, shortcut, isGlobal, isActive, tags } = req.body;

    const response = await ITCannedResponse.findByPk(req.params.id);
    if (!response) {
      return res.status(404).json({ error: "Response not found" });
    }

    // Only creator or owner can edit
    if (response.createdBy !== req.user.id && req.user.type !== "owner") {
      return res.status(403).json({ error: "Not authorized to edit this response" });
    }

    // Check shortcut uniqueness if changing
    if (shortcut && shortcut !== response.shortcut) {
      const existing = await ITCannedResponse.findOne({
        where: { shortcut, id: { [Op.ne]: response.id } }
      });
      if (existing) {
        return res.status(400).json({ error: "Shortcut already in use" });
      }
    }

    await response.update({
      title: title !== undefined ? title.trim() : response.title,
      category: category !== undefined ? category : response.category,
      template: template !== undefined ? template.trim() : response.template,
      shortcut: shortcut !== undefined ? (shortcut ? shortcut.toLowerCase().trim() : null) : response.shortcut,
      isGlobal: isGlobal !== undefined ? isGlobal : response.isGlobal,
      isActive: isActive !== undefined ? isActive : response.isActive,
      tags: tags !== undefined ? tags : response.tags,
      updatedBy: req.user.id,
    });

    console.log(`✅ Custom canned response ${response.id} updated by ${req.user.id}`);

    return res.status(200).json({
      success: true,
      response,
    });
  } catch (error) {
    console.error("Error updating custom response:", error);
    return res.status(500).json({ error: "Failed to update custom response" });
  }
});

/**
 * DELETE /api/v1/it-dashboard/custom-responses/:id
 * Delete a custom canned response
 */
itDashboardRouter.delete("/custom-responses/:id", async (req, res) => {
  try {
    const { ITCannedResponse } = require("../../../models");

    const response = await ITCannedResponse.findByPk(req.params.id);
    if (!response) {
      return res.status(404).json({ error: "Response not found" });
    }

    // Only creator or owner can delete
    if (response.createdBy !== req.user.id && req.user.type !== "owner") {
      return res.status(403).json({ error: "Not authorized to delete this response" });
    }

    await response.destroy();

    console.log(`✅ Custom canned response ${req.params.id} deleted by ${req.user.id}`);

    return res.status(200).json({
      success: true,
      message: "Response deleted",
    });
  } catch (error) {
    console.error("Error deleting custom response:", error);
    return res.status(500).json({ error: "Failed to delete custom response" });
  }
});

/**
 * POST /api/v1/it-dashboard/custom-responses/:id/use
 * Increment usage count for a canned response
 */
itDashboardRouter.post("/custom-responses/:id/use", async (req, res) => {
  try {
    const { ITCannedResponse } = require("../../../models");

    const response = await ITCannedResponse.findByPk(req.params.id);
    if (!response) {
      return res.status(404).json({ error: "Response not found" });
    }

    await response.increment("usageCount");

    return res.status(200).json({
      success: true,
      usageCount: response.usageCount + 1,
    });
  } catch (error) {
    console.error("Error incrementing usage count:", error);
    return res.status(500).json({ error: "Failed to increment usage count" });
  }
});

// ==================== DISPUTE TAGGING ====================

/**
 * GET /api/v1/it-dashboard/tags
 * Get all unique tags used across disputes
 */
itDashboardRouter.get("/tags", async (req, res) => {
  try {
    // Get all disputes with tags
    const disputesWithTags = await ITDispute.findAll({
      where: {
        tags: { [Op.ne]: null },
      },
      attributes: ["tags"],
    });

    // Extract unique tags with counts
    const tagCounts = {};
    disputesWithTags.forEach(d => {
      const tags = d.tags || [];
      tags.forEach(tag => {
        tagCounts[tag] = (tagCounts[tag] || 0) + 1;
      });
    });

    // Convert to array and sort by count
    const tags = Object.entries(tagCounts)
      .map(([tag, count]) => ({ tag, count }))
      .sort((a, b) => b.count - a.count);

    return res.status(200).json({
      tags,
      totalUniqueTags: tags.length,
    });
  } catch (error) {
    console.error("Error fetching tags:", error);
    return res.status(500).json({ error: "Failed to fetch tags" });
  }
});

/**
 * POST /api/v1/it-dashboard/disputes/:id/tags
 * Add tags to a dispute
 */
itDashboardRouter.post("/disputes/:id/tags", async (req, res) => {
  try {
    const { tags } = req.body;

    if (!tags || !Array.isArray(tags)) {
      return res.status(400).json({ error: "Tags array is required" });
    }

    const dispute = await ITDispute.findByPk(req.params.id);
    if (!dispute) {
      return res.status(404).json({ error: "Dispute not found" });
    }

    // Merge with existing tags (avoid duplicates)
    const existingTags = dispute.tags || [];
    const normalizedNewTags = tags.map(t => t.toLowerCase().trim());
    const mergedTags = [...new Set([...existingTags, ...normalizedNewTags])];

    await dispute.update({ tags: mergedTags });

    console.log(`✅ Tags added to dispute ${dispute.caseNumber} by ${req.user.id}`);

    return res.status(200).json({
      success: true,
      tags: mergedTags,
    });
  } catch (error) {
    console.error("Error adding tags:", error);
    return res.status(500).json({ error: "Failed to add tags" });
  }
});

/**
 * DELETE /api/v1/it-dashboard/disputes/:id/tags/:tag
 * Remove a tag from a dispute
 */
itDashboardRouter.delete("/disputes/:id/tags/:tag", async (req, res) => {
  try {
    const tagToRemove = req.params.tag.toLowerCase().trim();

    const dispute = await ITDispute.findByPk(req.params.id);
    if (!dispute) {
      return res.status(404).json({ error: "Dispute not found" });
    }

    const existingTags = dispute.tags || [];
    const updatedTags = existingTags.filter(t => t.toLowerCase() !== tagToRemove);

    await dispute.update({ tags: updatedTags });

    console.log(`✅ Tag "${tagToRemove}" removed from dispute ${dispute.caseNumber} by ${req.user.id}`);

    return res.status(200).json({
      success: true,
      tags: updatedTags,
    });
  } catch (error) {
    console.error("Error removing tag:", error);
    return res.status(500).json({ error: "Failed to remove tag" });
  }
});

/**
 * PUT /api/v1/it-dashboard/disputes/:id/tags
 * Replace all tags on a dispute
 */
itDashboardRouter.put("/disputes/:id/tags", async (req, res) => {
  try {
    const { tags } = req.body;

    if (!Array.isArray(tags)) {
      return res.status(400).json({ error: "Tags array is required" });
    }

    const dispute = await ITDispute.findByPk(req.params.id);
    if (!dispute) {
      return res.status(404).json({ error: "Dispute not found" });
    }

    const normalizedTags = tags.map(t => t.toLowerCase().trim()).filter(t => t.length > 0);
    const uniqueTags = [...new Set(normalizedTags)];

    await dispute.update({ tags: uniqueTags });

    console.log(`✅ Tags updated on dispute ${dispute.caseNumber} by ${req.user.id}`);

    return res.status(200).json({
      success: true,
      tags: uniqueTags,
    });
  } catch (error) {
    console.error("Error updating tags:", error);
    return res.status(500).json({ error: "Failed to update tags" });
  }
});

// ==================== AUTO-ASSIGNMENT RULES ====================

/**
 * GET /api/v1/it-dashboard/auto-assignment-rules
 * Get all auto-assignment rules
 */
itDashboardRouter.get("/auto-assignment-rules", async (req, res) => {
  try {
    const { ITAutoAssignmentRule } = require("../../../models");
    const { includeInactive } = req.query;

    const where = {};
    if (!includeInactive) {
      where.isActive = true;
    }

    const rules = await ITAutoAssignmentRule.findAll({
      where,
      include: [
        { model: User, as: "assignee", attributes: ["id", "username", "firstName", "lastName"] },
        { model: User, as: "creator", attributes: ["id", "username"] },
      ],
      order: [["priority", "ASC"]],
    });

    // Decrypt names
    const serializedRules = rules.map(r => {
      const data = r.toJSON();
      if (data.assignee) {
        data.assignee.firstName = safeDecrypt(data.assignee.firstName);
        data.assignee.lastName = safeDecrypt(data.assignee.lastName);
      }
      return data;
    });

    return res.status(200).json({
      rules: serializedRules,
      total: rules.length,
    });
  } catch (error) {
    console.error("Error fetching auto-assignment rules:", error);
    return res.status(500).json({ error: "Failed to fetch rules" });
  }
});

/**
 * POST /api/v1/it-dashboard/auto-assignment-rules
 * Create a new auto-assignment rule
 */
itDashboardRouter.post("/auto-assignment-rules", async (req, res) => {
  try {
    const { ITAutoAssignmentRule } = require("../../../models");
    const {
      name,
      description,
      conditions,
      assignToUserId,
      assignmentStrategy,
      assignmentPool,
      priority,
    } = req.body;

    if (!name) {
      return res.status(400).json({ error: "Rule name is required" });
    }

    if (!conditions || Object.keys(conditions).length === 0) {
      return res.status(400).json({ error: "At least one condition is required" });
    }

    // Validate strategy
    const validStrategies = ["specific_user", "round_robin", "least_loaded", "random"];
    const strategy = validStrategies.includes(assignmentStrategy) ? assignmentStrategy : "specific_user";

    // Validate specific user or pool based on strategy
    if (strategy === "specific_user" && !assignToUserId) {
      return res.status(400).json({ error: "assignToUserId is required for specific_user strategy" });
    }

    if (["round_robin", "least_loaded", "random"].includes(strategy)) {
      if (!assignmentPool || !Array.isArray(assignmentPool) || assignmentPool.length === 0) {
        return res.status(400).json({ error: "assignmentPool is required for this strategy" });
      }
    }

    const rule = await ITAutoAssignmentRule.create({
      name: name.trim(),
      description: description || null,
      conditions,
      assignToUserId: strategy === "specific_user" ? assignToUserId : null,
      assignmentStrategy: strategy,
      assignmentPool: assignmentPool || [],
      priority: priority || 100,
      createdBy: req.user.id,
    });

    console.log(`✅ Auto-assignment rule "${name}" created by ${req.user.id}`);

    return res.status(201).json({
      success: true,
      rule,
    });
  } catch (error) {
    console.error("Error creating auto-assignment rule:", error);
    return res.status(500).json({ error: "Failed to create rule" });
  }
});

/**
 * PATCH /api/v1/it-dashboard/auto-assignment-rules/:id
 * Update an auto-assignment rule
 */
itDashboardRouter.patch("/auto-assignment-rules/:id", async (req, res) => {
  try {
    const { ITAutoAssignmentRule } = require("../../../models");
    const {
      name,
      description,
      conditions,
      assignToUserId,
      assignmentStrategy,
      assignmentPool,
      priority,
      isActive,
    } = req.body;

    const rule = await ITAutoAssignmentRule.findByPk(req.params.id);
    if (!rule) {
      return res.status(404).json({ error: "Rule not found" });
    }

    const updates = { updatedBy: req.user.id };

    if (name !== undefined) updates.name = name.trim();
    if (description !== undefined) updates.description = description;
    if (conditions !== undefined) updates.conditions = conditions;
    if (assignToUserId !== undefined) updates.assignToUserId = assignToUserId;
    if (assignmentStrategy !== undefined) updates.assignmentStrategy = assignmentStrategy;
    if (assignmentPool !== undefined) updates.assignmentPool = assignmentPool;
    if (priority !== undefined) updates.priority = priority;
    if (isActive !== undefined) updates.isActive = isActive;

    await rule.update(updates);

    console.log(`✅ Auto-assignment rule ${rule.id} updated by ${req.user.id}`);

    return res.status(200).json({
      success: true,
      rule,
    });
  } catch (error) {
    console.error("Error updating auto-assignment rule:", error);
    return res.status(500).json({ error: "Failed to update rule" });
  }
});

/**
 * DELETE /api/v1/it-dashboard/auto-assignment-rules/:id
 * Delete an auto-assignment rule
 */
itDashboardRouter.delete("/auto-assignment-rules/:id", async (req, res) => {
  try {
    const { ITAutoAssignmentRule } = require("../../../models");

    const rule = await ITAutoAssignmentRule.findByPk(req.params.id);
    if (!rule) {
      return res.status(404).json({ error: "Rule not found" });
    }

    await rule.destroy();

    console.log(`✅ Auto-assignment rule ${req.params.id} deleted by ${req.user.id}`);

    return res.status(200).json({
      success: true,
      message: "Rule deleted",
    });
  } catch (error) {
    console.error("Error deleting auto-assignment rule:", error);
    return res.status(500).json({ error: "Failed to delete rule" });
  }
});

/**
 * POST /api/v1/it-dashboard/auto-assignment-rules/test
 * Test which rule would apply to a hypothetical dispute
 */
itDashboardRouter.post("/auto-assignment-rules/test", async (req, res) => {
  try {
    const { ITAutoAssignmentRule } = require("../../../models");
    const { category, priority, platform, tags, reporterType } = req.body;

    // Create a mock dispute object
    const mockDispute = {
      category,
      priority: priority || "normal",
      platform,
      tags: tags || [],
      reporter: reporterType ? { type: reporterType } : null,
    };

    // Get active rules in priority order
    const rules = await ITAutoAssignmentRule.findAll({
      where: { isActive: true },
      include: [
        { model: User, as: "assignee", attributes: ["id", "username", "firstName", "lastName"] },
      ],
      order: [["priority", "ASC"]],
    });

    // Find first matching rule
    let matchedRule = null;
    let assigneeId = null;

    for (const rule of rules) {
      if (rule.matchesDispute(mockDispute)) {
        matchedRule = rule;
        assigneeId = await rule.getNextAssignee(require("../../../models"));
        break;
      }
    }

    if (matchedRule) {
      const data = matchedRule.toJSON();
      if (data.assignee) {
        data.assignee.firstName = safeDecrypt(data.assignee.firstName);
        data.assignee.lastName = safeDecrypt(data.assignee.lastName);
      }

      return res.status(200).json({
        matched: true,
        rule: data,
        wouldAssignTo: assigneeId,
      });
    }

    return res.status(200).json({
      matched: false,
      message: "No rules match the given conditions",
    });
  } catch (error) {
    console.error("Error testing auto-assignment rules:", error);
    return res.status(500).json({ error: "Failed to test rules" });
  }
});

// ==================== ESCALATION WORKFLOW ====================

/**
 * POST /api/v1/it-dashboard/disputes/:id/escalate
 * Escalate a dispute to HR, Owner, or external
 */
itDashboardRouter.post("/disputes/:id/escalate", async (req, res) => {
  try {
    const { escalateTo, reason } = req.body;
    const validTargets = ["hr", "owner", "external"];

    if (!escalateTo || !validTargets.includes(escalateTo)) {
      return res.status(400).json({
        error: "Invalid escalation target",
        validTargets,
      });
    }

    if (!reason || reason.trim().length < 10) {
      return res.status(400).json({ error: "Escalation reason must be at least 10 characters" });
    }

    const dispute = await ITDispute.findByPk(req.params.id, {
      include: [
        { model: User, as: "reporter", attributes: ["id", "firstName", "lastName", "username"] },
      ],
    });

    if (!dispute) {
      return res.status(404).json({ error: "Dispute not found" });
    }

    if (["resolved", "closed"].includes(dispute.status)) {
      return res.status(400).json({ error: "Cannot escalate resolved or closed disputes" });
    }

    // Check if already escalated
    if (dispute.escalatedTo) {
      return res.status(400).json({
        error: `Dispute already escalated to ${dispute.escalatedTo}`,
        escalatedAt: dispute.escalatedAt,
      });
    }

    const now = new Date();

    // Create escalation note
    const escalationNotes = dispute.escalationNotes || [];
    escalationNotes.push({
      action: "escalated",
      from: "it",
      to: escalateTo,
      by: req.user.id,
      byUsername: req.user.username,
      reason: reason.trim(),
      timestamp: now.toISOString(),
    });

    await dispute.update({
      escalatedTo: escalateTo,
      escalatedAt: now,
      escalatedBy: req.user.id,
      escalationReason: reason.trim(),
      escalationNotes,
    });

    // Notify the escalation target
    const NotificationService = require("../../../services/NotificationService");

    if (escalateTo === "hr") {
      // Find HR users
      const hrUsers = await User.findAll({ where: { type: "humanResources" } });
      for (const hr of hrUsers) {
        await NotificationService.notifyUser({
          userId: hr.id,
          type: "it_dispute_escalated",
          title: "IT Dispute Escalated to HR",
          body: `IT dispute ${dispute.caseNumber} has been escalated. Reason: ${reason.substring(0, 100)}`,
          data: { disputeId: dispute.id, caseNumber: dispute.caseNumber },
          actionRequired: true,
        });
      }
    } else if (escalateTo === "owner") {
      // Find owner(s)
      const owners = await User.findAll({ where: { type: "owner" } });
      for (const owner of owners) {
        await NotificationService.notifyUser({
          userId: owner.id,
          type: "it_dispute_escalated",
          title: "IT Dispute Escalated",
          body: `IT dispute ${dispute.caseNumber} has been escalated to you. Reason: ${reason.substring(0, 100)}`,
          data: { disputeId: dispute.id, caseNumber: dispute.caseNumber },
          actionRequired: true,
        });
      }
    }

    console.log(`✅ IT dispute ${dispute.caseNumber} escalated to ${escalateTo} by ${req.user.id}`);

    return res.status(200).json({
      success: true,
      message: `Dispute escalated to ${escalateTo}`,
      dispute: {
        id: dispute.id,
        caseNumber: dispute.caseNumber,
        escalatedTo: dispute.escalatedTo,
        escalatedAt: dispute.escalatedAt,
      },
    });
  } catch (error) {
    console.error("Error escalating dispute:", error);
    return res.status(500).json({ error: "Failed to escalate dispute" });
  }
});

/**
 * POST /api/v1/it-dashboard/disputes/:id/escalation-note
 * Add a note to an escalated dispute
 */
itDashboardRouter.post("/disputes/:id/escalation-note", async (req, res) => {
  try {
    const { note } = req.body;

    if (!note || note.trim().length < 1) {
      return res.status(400).json({ error: "Note is required" });
    }

    const dispute = await ITDispute.findByPk(req.params.id);
    if (!dispute) {
      return res.status(404).json({ error: "Dispute not found" });
    }

    if (!dispute.escalatedTo) {
      return res.status(400).json({ error: "Dispute has not been escalated" });
    }

    const escalationNotes = dispute.escalationNotes || [];
    escalationNotes.push({
      action: "note_added",
      by: req.user.id,
      byUsername: req.user.username,
      note: note.trim(),
      timestamp: new Date().toISOString(),
    });

    await dispute.update({ escalationNotes });

    console.log(`✅ Escalation note added to dispute ${dispute.caseNumber} by ${req.user.id}`);

    return res.status(200).json({
      success: true,
      message: "Escalation note added",
      notes: escalationNotes,
    });
  } catch (error) {
    console.error("Error adding escalation note:", error);
    return res.status(500).json({ error: "Failed to add escalation note" });
  }
});

/**
 * POST /api/v1/it-dashboard/disputes/:id/de-escalate
 * De-escalate a dispute back to IT
 */
itDashboardRouter.post("/disputes/:id/de-escalate", async (req, res) => {
  try {
    const { reason } = req.body;

    const dispute = await ITDispute.findByPk(req.params.id);
    if (!dispute) {
      return res.status(404).json({ error: "Dispute not found" });
    }

    if (!dispute.escalatedTo) {
      return res.status(400).json({ error: "Dispute is not escalated" });
    }

    // Only owner, HR, or original escalator can de-escalate
    const canDeEscalate =
      req.user.type === "owner" ||
      req.user.type === "humanResources" ||
      dispute.escalatedBy === req.user.id;

    if (!canDeEscalate) {
      return res.status(403).json({ error: "Not authorized to de-escalate this dispute" });
    }

    const previousEscalation = dispute.escalatedTo;
    const escalationNotes = dispute.escalationNotes || [];
    escalationNotes.push({
      action: "de-escalated",
      from: previousEscalation,
      to: "it",
      by: req.user.id,
      byUsername: req.user.username,
      reason: reason || "Returned to IT",
      timestamp: new Date().toISOString(),
    });

    await dispute.update({
      escalatedTo: null,
      escalatedAt: null,
      escalatedBy: null,
      escalationReason: null,
      escalationNotes,
    });

    console.log(`✅ IT dispute ${dispute.caseNumber} de-escalated by ${req.user.id}`);

    return res.status(200).json({
      success: true,
      message: "Dispute de-escalated back to IT",
      dispute: {
        id: dispute.id,
        caseNumber: dispute.caseNumber,
        status: dispute.status,
      },
    });
  } catch (error) {
    console.error("Error de-escalating dispute:", error);
    return res.status(500).json({ error: "Failed to de-escalate dispute" });
  }
});

// ==================== MASS COMMUNICATION ====================

/**
 * GET /api/v1/it-dashboard/announcements
 * Get all announcements
 */
itDashboardRouter.get("/announcements", async (req, res) => {
  try {
    const { ITAnnouncement } = require("../../../models");
    const { status, limit = 50 } = req.query;

    const where = {};
    if (status) {
      where.status = status;
    }

    const announcements = await ITAnnouncement.findAll({
      where,
      include: [
        { model: User, as: "creator", attributes: ["id", "username"] },
      ],
      order: [["createdAt", "DESC"]],
      limit: parseInt(limit),
    });

    return res.status(200).json({
      announcements,
      total: announcements.length,
    });
  } catch (error) {
    console.error("Error fetching announcements:", error);
    return res.status(500).json({ error: "Failed to fetch announcements" });
  }
});

/**
 * POST /api/v1/it-dashboard/announcements
 * Create a new announcement
 */
itDashboardRouter.post("/announcements", async (req, res) => {
  try {
    const { ITAnnouncement } = require("../../../models");
    const {
      title,
      message,
      targetUserTypes,
      targetUserIds,
      channels,
      priority,
      scheduledFor,
      expiresAt,
    } = req.body;

    if (!title || !message) {
      return res.status(400).json({ error: "Title and message are required" });
    }

    if (!targetUserTypes && !targetUserIds) {
      return res.status(400).json({ error: "Must specify targetUserTypes or targetUserIds" });
    }

    const announcement = await ITAnnouncement.create({
      title: title.trim(),
      message: message.trim(),
      targetUserTypes: targetUserTypes || [],
      targetUserIds: targetUserIds || null,
      channels: channels || ["in_app"],
      priority: priority || "normal",
      scheduledFor: scheduledFor ? new Date(scheduledFor) : null,
      expiresAt: expiresAt ? new Date(expiresAt) : null,
      status: scheduledFor ? "scheduled" : "draft",
      createdBy: req.user.id,
    });

    console.log(`✅ Announcement "${title}" created by ${req.user.id}`);

    return res.status(201).json({
      success: true,
      announcement,
    });
  } catch (error) {
    console.error("Error creating announcement:", error);
    return res.status(500).json({ error: "Failed to create announcement" });
  }
});

/**
 * POST /api/v1/it-dashboard/announcements/:id/send
 * Send an announcement immediately
 */
itDashboardRouter.post("/announcements/:id/send", async (req, res) => {
  try {
    const { ITAnnouncement } = require("../../../models");
    const NotificationService = require("../../../services/NotificationService");

    const announcement = await ITAnnouncement.findByPk(req.params.id);
    if (!announcement) {
      return res.status(404).json({ error: "Announcement not found" });
    }

    if (announcement.status === "sent") {
      return res.status(400).json({ error: "Announcement already sent" });
    }

    // Build recipient list
    let recipients = [];
    if (announcement.targetUserIds && announcement.targetUserIds.length > 0) {
      recipients = await User.findAll({
        where: { id: { [Op.in]: announcement.targetUserIds } },
        attributes: ["id", "expoPushToken", "email", "firstName"],
      });
    } else if (announcement.targetUserTypes && announcement.targetUserTypes.length > 0) {
      recipients = await User.findAll({
        where: { type: { [Op.in]: announcement.targetUserTypes } },
        attributes: ["id", "expoPushToken", "email", "firstName"],
      });
    }

    await announcement.update({
      status: "sending",
      recipientCount: recipients.length,
    });

    let deliveredCount = 0;
    let failedCount = 0;

    // Send to each recipient
    for (const recipient of recipients) {
      try {
        // In-app notification
        if (announcement.channels.includes("in_app")) {
          await NotificationService.notifyUser({
            userId: recipient.id,
            type: "it_announcement",
            title: announcement.title,
            body: announcement.message.substring(0, 200),
            data: { announcementId: announcement.id, priority: announcement.priority },
            actionRequired: announcement.priority === "urgent",
            sendPush: announcement.channels.includes("push"),
            sendEmail: announcement.channels.includes("email"),
          });
        }
        deliveredCount++;
      } catch (sendError) {
        console.error(`Failed to send to user ${recipient.id}:`, sendError.message);
        failedCount++;
      }
    }

    await announcement.update({
      status: "sent",
      sentAt: new Date(),
      deliveredCount,
      failedCount,
    });

    console.log(`✅ Announcement ${announcement.id} sent to ${deliveredCount} recipients by ${req.user.id}`);

    return res.status(200).json({
      success: true,
      message: `Announcement sent to ${deliveredCount} recipients`,
      stats: {
        recipientCount: recipients.length,
        deliveredCount,
        failedCount,
      },
    });
  } catch (error) {
    console.error("Error sending announcement:", error);
    return res.status(500).json({ error: "Failed to send announcement" });
  }
});

/**
 * DELETE /api/v1/it-dashboard/announcements/:id
 * Cancel/delete an announcement
 */
itDashboardRouter.delete("/announcements/:id", async (req, res) => {
  try {
    const { ITAnnouncement } = require("../../../models");

    const announcement = await ITAnnouncement.findByPk(req.params.id);
    if (!announcement) {
      return res.status(404).json({ error: "Announcement not found" });
    }

    if (announcement.status === "sent") {
      return res.status(400).json({ error: "Cannot delete sent announcements" });
    }

    await announcement.update({ status: "cancelled" });

    console.log(`✅ Announcement ${req.params.id} cancelled by ${req.user.id}`);

    return res.status(200).json({
      success: true,
      message: "Announcement cancelled",
    });
  } catch (error) {
    console.error("Error cancelling announcement:", error);
    return res.status(500).json({ error: "Failed to cancel announcement" });
  }
});

// ==================== TIME TRACKING ====================

/**
 * POST /api/v1/it-dashboard/disputes/:id/time-entries
 * Log time spent on a dispute
 */
itDashboardRouter.post("/disputes/:id/time-entries", async (req, res) => {
  try {
    const { ITTimeEntry } = require("../../../models");
    const { startedAt, endedAt, activityType, description, durationMinutes } = req.body;

    const dispute = await ITDispute.findByPk(req.params.id);
    if (!dispute) {
      return res.status(404).json({ error: "Dispute not found" });
    }

    // Either provide start/end times or duration
    let start, end;
    if (durationMinutes) {
      // Manual entry with just duration
      end = new Date();
      start = new Date(end.getTime() - durationMinutes * 60 * 1000);
    } else if (startedAt) {
      start = new Date(startedAt);
      end = endedAt ? new Date(endedAt) : new Date();
    } else {
      return res.status(400).json({ error: "Must provide startedAt or durationMinutes" });
    }

    const entry = await ITTimeEntry.create({
      disputeId: dispute.id,
      staffId: req.user.id,
      startedAt: start,
      endedAt: end,
      activityType: activityType || "investigation",
      description: description || null,
      isManual: !!durationMinutes,
    });

    console.log(`✅ Time entry logged for dispute ${dispute.caseNumber} by ${req.user.id}`);

    return res.status(201).json({
      success: true,
      entry,
    });
  } catch (error) {
    console.error("Error logging time entry:", error);
    return res.status(500).json({ error: "Failed to log time entry" });
  }
});

/**
 * GET /api/v1/it-dashboard/disputes/:id/time-entries
 * Get time entries for a dispute
 */
itDashboardRouter.get("/disputes/:id/time-entries", async (req, res) => {
  try {
    const { ITTimeEntry } = require("../../../models");

    const dispute = await ITDispute.findByPk(req.params.id);
    if (!dispute) {
      return res.status(404).json({ error: "Dispute not found" });
    }

    const entries = await ITTimeEntry.findAll({
      where: { disputeId: dispute.id },
      include: [
        { model: User, as: "staff", attributes: ["id", "username", "firstName", "lastName"] },
      ],
      order: [["startedAt", "DESC"]],
    });

    // Decrypt staff names and calculate totals
    let totalMinutes = 0;
    const serializedEntries = entries.map(e => {
      const data = e.toJSON();
      if (data.staff) {
        data.staff.firstName = safeDecrypt(data.staff.firstName);
        data.staff.lastName = safeDecrypt(data.staff.lastName);
      }
      totalMinutes += data.durationMinutes || 0;
      return data;
    });

    return res.status(200).json({
      disputeId: dispute.id,
      caseNumber: dispute.caseNumber,
      entries: serializedEntries,
      totalMinutes,
      totalFormatted: `${Math.floor(totalMinutes / 60)}h ${totalMinutes % 60}m`,
    });
  } catch (error) {
    console.error("Error fetching time entries:", error);
    return res.status(500).json({ error: "Failed to fetch time entries" });
  }
});

/**
 * GET /api/v1/it-dashboard/time-report
 * Get time tracking report across all disputes
 */
itDashboardRouter.get("/time-report", async (req, res) => {
  try {
    const { ITTimeEntry } = require("../../../models");
    const { startDate, endDate, staffId } = req.query;

    const where = {};
    if (startDate || endDate) {
      where.startedAt = {};
      if (startDate) where.startedAt[Op.gte] = new Date(startDate);
      if (endDate) where.startedAt[Op.lte] = new Date(endDate);
    }
    if (staffId) {
      where.staffId = parseInt(staffId);
    }

    const entries = await ITTimeEntry.findAll({
      where,
      include: [
        { model: User, as: "staff", attributes: ["id", "username", "firstName", "lastName"] },
        { model: ITDispute, as: "dispute", attributes: ["id", "caseNumber", "category"] },
      ],
      order: [["startedAt", "DESC"]],
    });

    // Group by staff
    const byStaff = {};
    const byActivity = {};
    let totalMinutes = 0;

    entries.forEach(e => {
      const mins = e.durationMinutes || 0;
      totalMinutes += mins;

      // By staff
      if (!byStaff[e.staffId]) {
        const staffName = e.staff ? `${safeDecrypt(e.staff.firstName)} ${safeDecrypt(e.staff.lastName)}`.trim() : e.staff?.username;
        byStaff[e.staffId] = { staffId: e.staffId, name: staffName, totalMinutes: 0, entryCount: 0 };
      }
      byStaff[e.staffId].totalMinutes += mins;
      byStaff[e.staffId].entryCount++;

      // By activity
      if (!byActivity[e.activityType]) {
        byActivity[e.activityType] = { totalMinutes: 0, entryCount: 0 };
      }
      byActivity[e.activityType].totalMinutes += mins;
      byActivity[e.activityType].entryCount++;
    });

    return res.status(200).json({
      totalEntries: entries.length,
      totalMinutes,
      totalFormatted: `${Math.floor(totalMinutes / 60)}h ${totalMinutes % 60}m`,
      byStaff: Object.values(byStaff).sort((a, b) => b.totalMinutes - a.totalMinutes),
      byActivity,
    });
  } catch (error) {
    console.error("Error generating time report:", error);
    return res.status(500).json({ error: "Failed to generate time report" });
  }
});

// ==================== CUSTOMER SATISFACTION SURVEYS ====================

/**
 * POST /api/v1/it-dashboard/disputes/:id/send-survey
 * Send satisfaction survey to dispute reporter
 */
itDashboardRouter.post("/disputes/:id/send-survey", async (req, res) => {
  try {
    const { ITSatisfactionSurvey } = require("../../../models");
    const NotificationService = require("../../../services/NotificationService");

    const dispute = await ITDispute.findByPk(req.params.id, {
      include: [{ model: User, as: "reporter", attributes: ["id", "firstName", "email"] }],
    });

    if (!dispute) {
      return res.status(404).json({ error: "Dispute not found" });
    }

    if (!["resolved", "closed"].includes(dispute.status)) {
      return res.status(400).json({ error: "Can only send survey for resolved disputes" });
    }

    // Check if survey already sent
    const existingSurvey = await ITSatisfactionSurvey.findOne({
      where: { disputeId: dispute.id },
    });

    if (existingSurvey) {
      return res.status(400).json({ error: "Survey already sent for this dispute" });
    }

    const survey = await ITSatisfactionSurvey.create({
      disputeId: dispute.id,
      userId: dispute.reporterId,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
    });

    // Notify the user
    await NotificationService.notifyUser({
      userId: dispute.reporterId,
      type: "it_satisfaction_survey",
      title: "How did we do?",
      body: `Please take a moment to rate your experience with IT support for ${dispute.caseNumber}`,
      data: { surveyId: survey.id, disputeId: dispute.id },
      actionRequired: true,
      sendPush: true,
    });

    console.log(`✅ Satisfaction survey sent for dispute ${dispute.caseNumber}`);

    return res.status(201).json({
      success: true,
      survey: {
        id: survey.id,
        sentAt: survey.sentAt,
        expiresAt: survey.expiresAt,
      },
    });
  } catch (error) {
    console.error("Error sending satisfaction survey:", error);
    return res.status(500).json({ error: "Failed to send survey" });
  }
});

/**
 * GET /api/v1/it-dashboard/satisfaction-stats
 * Get satisfaction survey statistics
 */
itDashboardRouter.get("/satisfaction-stats", async (req, res) => {
  try {
    const { ITSatisfactionSurvey } = require("../../../models");
    const { startDate, endDate } = req.query;

    const where = { status: "completed" };
    if (startDate || endDate) {
      where.respondedAt = {};
      if (startDate) where.respondedAt[Op.gte] = new Date(startDate);
      if (endDate) where.respondedAt[Op.lte] = new Date(endDate);
    }

    const surveys = await ITSatisfactionSurvey.findAll({
      where,
      attributes: [
        "overallRating",
        "responseTimeRating",
        "resolutionQualityRating",
        "staffHelpfulnessRating",
        "wouldRecommend",
        "issueResolved",
      ],
    });

    if (surveys.length === 0) {
      return res.status(200).json({
        totalResponses: 0,
        message: "No survey responses in the specified period",
      });
    }

    // Calculate averages
    const calcAvg = (field) => {
      const values = surveys.map(s => s[field]).filter(v => v !== null);
      return values.length > 0 ? (values.reduce((a, b) => a + b, 0) / values.length).toFixed(2) : null;
    };

    const recommendYesCount = surveys.filter(s => s.wouldRecommend === true).length;
    const recommendNoCount = surveys.filter(s => s.wouldRecommend === false).length;
    const recommendAnswered = recommendYesCount + recommendNoCount;
    const issueResolvedCounts = {
      yes: surveys.filter(s => s.issueResolved === "yes").length,
      partially: surveys.filter(s => s.issueResolved === "partially").length,
      no: surveys.filter(s => s.issueResolved === "no").length,
    };

    return res.status(200).json({
      totalResponses: surveys.length,
      averages: {
        overall: calcAvg("overallRating"),
        responseTime: calcAvg("responseTimeRating"),
        resolutionQuality: calcAvg("resolutionQualityRating"),
        staffHelpfulness: calcAvg("staffHelpfulnessRating"),
      },
      wouldRecommend: {
        yes: recommendYesCount,
        no: recommendNoCount,
        notAnswered: surveys.length - recommendAnswered,
        percentage: recommendAnswered > 0 ? ((recommendYesCount / recommendAnswered) * 100).toFixed(1) : null,
      },
      issueResolved: issueResolvedCounts,
    });
  } catch (error) {
    console.error("Error fetching satisfaction stats:", error);
    return res.status(500).json({ error: "Failed to fetch satisfaction stats" });
  }
});

// ==================== SCHEDULED ACTIONS ====================

/**
 * GET /api/v1/it-dashboard/scheduled-actions
 * Get all scheduled actions
 */
itDashboardRouter.get("/scheduled-actions", async (req, res) => {
  try {
    const { ITScheduledAction } = require("../../../models");
    const { status, targetUserId } = req.query;

    const where = {};
    if (status) {
      where.status = status;
    } else {
      where.status = { [Op.in]: ["pending", "executing"] };
    }
    if (targetUserId) {
      where.targetUserId = parseInt(targetUserId);
    }

    const actions = await ITScheduledAction.findAll({
      where,
      include: [
        { model: User, as: "targetUser", attributes: ["id", "username", "firstName", "lastName"] },
        { model: User, as: "creator", attributes: ["id", "username"] },
      ],
      order: [["scheduledFor", "ASC"]],
    });

    const serializedActions = actions.map(a => {
      const data = a.toJSON();
      if (data.targetUser) {
        data.targetUser.firstName = safeDecrypt(data.targetUser.firstName);
        data.targetUser.lastName = safeDecrypt(data.targetUser.lastName);
      }
      return data;
    });

    return res.status(200).json({
      actions: serializedActions,
      total: actions.length,
    });
  } catch (error) {
    console.error("Error fetching scheduled actions:", error);
    return res.status(500).json({ error: "Failed to fetch scheduled actions" });
  }
});

/**
 * POST /api/v1/it-dashboard/scheduled-actions
 * Create a new scheduled action
 */
itDashboardRouter.post("/scheduled-actions", async (req, res) => {
  try {
    const { ITScheduledAction } = require("../../../models");
    const {
      targetUserId,
      actionType,
      actionParams,
      scheduledFor,
      reason,
      isRecurring,
      recurrencePattern,
      recurrenceEndDate,
    } = req.body;

    if (!targetUserId || !actionType || !scheduledFor) {
      return res.status(400).json({ error: "targetUserId, actionType, and scheduledFor are required" });
    }

    // Validate target user exists
    const targetUser = await User.findByPk(targetUserId);
    if (!targetUser) {
      return res.status(404).json({ error: "Target user not found" });
    }

    const scheduledDate = new Date(scheduledFor);
    if (scheduledDate <= new Date()) {
      return res.status(400).json({ error: "scheduledFor must be in the future" });
    }

    const action = await ITScheduledAction.create({
      targetUserId,
      actionType,
      actionParams: actionParams || {},
      scheduledFor: scheduledDate,
      reason: reason || null,
      isRecurring: isRecurring || false,
      recurrencePattern: recurrencePattern || null,
      recurrenceEndDate: recurrenceEndDate ? new Date(recurrenceEndDate) : null,
      createdBy: req.user.id,
    });

    console.log(`✅ Scheduled action "${actionType}" for user ${targetUserId} at ${scheduledDate} by ${req.user.id}`);

    return res.status(201).json({
      success: true,
      action,
    });
  } catch (error) {
    console.error("Error creating scheduled action:", error);
    return res.status(500).json({ error: "Failed to create scheduled action" });
  }
});

/**
 * DELETE /api/v1/it-dashboard/scheduled-actions/:id
 * Cancel a scheduled action
 */
itDashboardRouter.delete("/scheduled-actions/:id", async (req, res) => {
  try {
    const { ITScheduledAction } = require("../../../models");
    const { reason } = req.body;

    const action = await ITScheduledAction.findByPk(req.params.id);
    if (!action) {
      return res.status(404).json({ error: "Scheduled action not found" });
    }

    if (action.status !== "pending") {
      return res.status(400).json({ error: "Can only cancel pending actions" });
    }

    await action.update({
      status: "cancelled",
      cancelledAt: new Date(),
      cancelledBy: req.user.id,
      cancelReason: reason || null,
    });

    console.log(`✅ Scheduled action ${req.params.id} cancelled by ${req.user.id}`);

    return res.status(200).json({
      success: true,
      message: "Scheduled action cancelled",
    });
  } catch (error) {
    console.error("Error cancelling scheduled action:", error);
    return res.status(500).json({ error: "Failed to cancel scheduled action" });
  }
});

/**
 * POST /api/v1/it-dashboard/scheduled-actions/:id/execute
 * Manually execute a scheduled action now
 */
itDashboardRouter.post("/scheduled-actions/:id/execute", async (req, res) => {
  try {
    const { ITScheduledAction, SecurityAuditLog } = require("../../../models");

    const action = await ITScheduledAction.findByPk(req.params.id, {
      include: [{ model: User, as: "targetUser" }],
    });

    if (!action) {
      return res.status(404).json({ error: "Scheduled action not found" });
    }

    if (action.status !== "pending") {
      return res.status(400).json({ error: "Action is not pending" });
    }

    await action.update({ status: "executing" });

    let result = { success: false };

    try {
      switch (action.actionType) {
        case "unlock_account":
          await action.targetUser.update({
            failedLoginAttempts: 0,
            lockedUntil: null,
          });
          result = { success: true, action: "Account unlocked" };
          break;

        case "unfreeze_account":
          await action.targetUser.update({
            accountFrozen: false,
            accountFrozenAt: null,
            accountFrozenReason: null,
          });
          result = { success: true, action: "Account unfrozen" };
          break;

        case "lock_account":
          const lockHours = action.actionParams.hours || 24;
          await action.targetUser.update({
            lockedUntil: new Date(Date.now() + lockHours * 60 * 60 * 1000),
          });
          result = { success: true, action: `Account locked for ${lockHours} hours` };
          break;

        case "freeze_account":
          await action.targetUser.update({
            accountFrozen: true,
            accountFrozenAt: new Date(),
            accountFrozenReason: action.reason || "Scheduled freeze",
          });
          result = { success: true, action: "Account frozen" };
          break;

        case "force_logout":
          await action.targetUser.update({ expoPushToken: null });
          result = { success: true, action: "User logged out" };
          break;

        default:
          result = { success: false, error: "Unknown action type" };
      }

      await action.update({
        status: result.success ? "completed" : "failed",
        executedAt: new Date(),
        executionResult: result,
      });

      // Log to security audit
      await SecurityAuditLog.logEvent("SCHEDULED_ACTION_EXECUTED", {
        userId: req.user.id,
        targetUserId: action.targetUserId,
        eventData: {
          actionId: action.id,
          actionType: action.actionType,
          result,
        },
        severity: "warning",
      });

      console.log(`✅ Scheduled action ${action.id} executed: ${action.actionType}`);

      return res.status(200).json({
        success: true,
        result,
      });
    } catch (execError) {
      await action.update({
        status: "failed",
        executionResult: { error: execError.message },
        retryCount: action.retryCount + 1,
        lastRetryAt: new Date(),
      });
      throw execError;
    }
  } catch (error) {
    console.error("Error executing scheduled action:", error);
    return res.status(500).json({ error: "Failed to execute scheduled action" });
  }
});

// ==================== KNOWLEDGE BASE ====================

/**
 * GET /api/v1/it-dashboard/knowledge-base
 * Get knowledge base articles
 */
itDashboardRouter.get("/knowledge-base", async (req, res) => {
  try {
    const { ITKnowledgeBaseArticle } = require("../../../models");
    const { category, search, published } = req.query;

    const where = {};

    // By default, show published articles
    if (published !== "false") {
      where.isPublished = true;
    }

    if (category) {
      where.category = category;
    }

    if (search) {
      where[Op.or] = [
        { title: { [Op.iLike]: `%${search}%` } },
        { content: { [Op.iLike]: `%${search}%` } },
        { summary: { [Op.iLike]: `%${search}%` } },
      ];
    }

    const articles = await ITKnowledgeBaseArticle.findAll({
      where,
      include: [
        { model: User, as: "author", attributes: ["id", "username"] },
      ],
      attributes: ["id", "title", "slug", "summary", "category", "tags", "viewCount", "isPinned", "publishedAt", "createdAt"],
      order: [
        ["isPinned", "DESC"],
        ["viewCount", "DESC"],
      ],
    });

    // Get unique categories
    const categories = await ITKnowledgeBaseArticle.findAll({
      where: { isPublished: true },
      attributes: [[sequelize.fn("DISTINCT", sequelize.col("category")), "category"]],
      raw: true,
    });

    return res.status(200).json({
      articles,
      categories: categories.map(c => c.category),
      total: articles.length,
    });
  } catch (error) {
    console.error("Error fetching knowledge base:", error);
    return res.status(500).json({ error: "Failed to fetch knowledge base" });
  }
});

/**
 * GET /api/v1/it-dashboard/knowledge-base/:slug
 * Get a specific knowledge base article
 */
itDashboardRouter.get("/knowledge-base/:slug", async (req, res) => {
  try {
    const { ITKnowledgeBaseArticle } = require("../../../models");

    const article = await ITKnowledgeBaseArticle.findOne({
      where: { slug: req.params.slug },
      include: [
        { model: User, as: "author", attributes: ["id", "username"] },
        { model: User, as: "lastEditor", attributes: ["id", "username"] },
      ],
    });

    if (!article) {
      return res.status(404).json({ error: "Article not found" });
    }

    // Increment view count
    await article.increment("viewCount");

    return res.status(200).json({ article });
  } catch (error) {
    console.error("Error fetching knowledge base article:", error);
    return res.status(500).json({ error: "Failed to fetch article" });
  }
});

/**
 * POST /api/v1/it-dashboard/knowledge-base
 * Create a new knowledge base article
 */
itDashboardRouter.post("/knowledge-base", async (req, res) => {
  try {
    const { ITKnowledgeBaseArticle } = require("../../../models");
    const {
      title,
      slug,
      summary,
      content,
      category,
      tags,
      relatedCategories,
      isPublished,
      visibleToRoles,
      isPinned,
    } = req.body;

    if (!title || !content) {
      return res.status(400).json({ error: "Title and content are required" });
    }

    // Check slug uniqueness
    const existingSlug = slug || title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    const existing = await ITKnowledgeBaseArticle.findOne({ where: { slug: existingSlug } });
    if (existing) {
      return res.status(400).json({ error: "An article with this slug already exists" });
    }

    const article = await ITKnowledgeBaseArticle.create({
      title: title.trim(),
      slug: existingSlug,
      summary: summary || null,
      content,
      category: category || "general",
      tags: tags || [],
      relatedCategories: relatedCategories || [],
      isPublished: isPublished || false,
      publishedAt: isPublished ? new Date() : null,
      visibleToRoles: visibleToRoles || ["it", "owner"],
      isPinned: isPinned || false,
      createdBy: req.user.id,
    });

    console.log(`✅ Knowledge base article "${title}" created by ${req.user.id}`);

    return res.status(201).json({
      success: true,
      article,
    });
  } catch (error) {
    console.error("Error creating knowledge base article:", error);
    return res.status(500).json({ error: "Failed to create article" });
  }
});

/**
 * PATCH /api/v1/it-dashboard/knowledge-base/:id
 * Update a knowledge base article
 */
itDashboardRouter.patch("/knowledge-base/:id", async (req, res) => {
  try {
    const { ITKnowledgeBaseArticle } = require("../../../models");
    const updates = req.body;

    const article = await ITKnowledgeBaseArticle.findByPk(req.params.id);
    if (!article) {
      return res.status(404).json({ error: "Article not found" });
    }

    // Track publishing
    if (updates.isPublished === true && !article.isPublished) {
      updates.publishedAt = new Date();
    }

    // Increment version
    updates.version = article.version + 1;
    updates.lastUpdatedBy = req.user.id;

    await article.update(updates);

    console.log(`✅ Knowledge base article ${article.id} updated by ${req.user.id}`);

    return res.status(200).json({
      success: true,
      article,
    });
  } catch (error) {
    console.error("Error updating knowledge base article:", error);
    return res.status(500).json({ error: "Failed to update article" });
  }
});

/**
 * DELETE /api/v1/it-dashboard/knowledge-base/:id
 * Delete a knowledge base article
 */
itDashboardRouter.delete("/knowledge-base/:id", async (req, res) => {
  try {
    const { ITKnowledgeBaseArticle } = require("../../../models");

    const article = await ITKnowledgeBaseArticle.findByPk(req.params.id);
    if (!article) {
      return res.status(404).json({ error: "Article not found" });
    }

    await article.destroy();

    console.log(`✅ Knowledge base article ${req.params.id} deleted by ${req.user.id}`);

    return res.status(200).json({
      success: true,
      message: "Article deleted",
    });
  } catch (error) {
    console.error("Error deleting knowledge base article:", error);
    return res.status(500).json({ error: "Failed to delete article" });
  }
});

/**
 * POST /api/v1/it-dashboard/knowledge-base/:id/feedback
 * Submit feedback on an article (helpful/not helpful)
 */
itDashboardRouter.post("/knowledge-base/:id/feedback", async (req, res) => {
  try {
    const { ITKnowledgeBaseArticle } = require("../../../models");
    const { helpful } = req.body;

    const article = await ITKnowledgeBaseArticle.findByPk(req.params.id);
    if (!article) {
      return res.status(404).json({ error: "Article not found" });
    }

    if (helpful === true) {
      await article.increment("helpfulCount");
    } else if (helpful === false) {
      await article.increment("notHelpfulCount");
    }

    return res.status(200).json({
      success: true,
      helpfulCount: article.helpfulCount + (helpful === true ? 1 : 0),
      notHelpfulCount: article.notHelpfulCount + (helpful === false ? 1 : 0),
    });
  } catch (error) {
    console.error("Error submitting article feedback:", error);
    return res.status(500).json({ error: "Failed to submit feedback" });
  }
});

module.exports = itDashboardRouter;
