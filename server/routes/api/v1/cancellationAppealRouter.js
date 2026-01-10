/**
 * Cancellation Appeal Router
 *
 * Handles all appeal-related endpoints for users and HR/Owners.
 */

const express = require("express");
const router = express.Router();
const { requireAuth, requireHrOrOwner } = require("../../../middleware/authMiddleware");
const AppealService = require("../../../services/AppealService");
const CancellationAuditService = require("../../../services/CancellationAuditService");
const NotificationService = require("../../../services/NotificationService");
const Email = require("../../../services/sendNotifications/EmailClass");
const PushNotification = require("../../../services/sendNotifications/PushNotificationClass");

// ====================
// USER ENDPOINTS
// ====================

// NOTE: Specific routes MUST come before parameterized routes (/:id)
// Otherwise Express will match "my-appeals" as an id value

/**
 * Get user's appeal history
 * GET /api/v1/appeals/my-appeals
 */
router.get("/my-appeals", requireAuth, async (req, res) => {
	try {
		const { CancellationAppeal, UserAppointments } = require("../../../models");

		const appeals = await CancellationAppeal.findAll({
			where: { appealerId: req.user.id },
			include: [
				{
					model: UserAppointments,
					as: "appointment",
					attributes: ["id", "date"],
				},
			],
			order: [["submittedAt", "DESC"]],
		});

		res.json({
			success: true,
			appeals: appeals.map(appeal => ({
				id: appeal.id,
				appointmentId: appeal.appointmentId,
				appointmentDate: appeal.appointment?.date?.toISOString() || null,
				category: appeal.category,
				status: appeal.status,
				priority: appeal.priority,
				submittedAt: appeal.submittedAt?.toISOString() || null,
				closedAt: appeal.closedAt?.toISOString() || null,
				resolution: appeal.isClosed() ? appeal.resolution : null,
			})),
			total: appeals.length,
		});

	} catch (error) {
		console.error("[Appeal] My appeals error:", error);
		res.status(500).json({
			success: false,
			error: "Failed to retrieve appeals",
		});
	}
});

/**
 * Submit a new appeal
 * POST /api/v1/appeals
 */
router.post("/", requireAuth, async (req, res) => {
	try {
		const {
			appointmentId,
			category,
			severity,
			description,
			contestingItems,
			requestedRelief,
		} = req.body;

		if (!appointmentId || !category || !description) {
			return res.status(400).json({
				success: false,
				error: "Missing required fields: appointmentId, category, description",
			});
		}

		const validCategories = [
			"medical_emergency",
			"family_emergency",
			"natural_disaster",
			"property_issue",
			"transportation",
			"scheduling_error",
			"other",
		];

		if (!validCategories.includes(category)) {
			return res.status(400).json({
				success: false,
				error: `Invalid category. Must be one of: ${validCategories.join(", ")}`,
			});
		}

		const result = await AppealService.submitAppeal({
			appointmentId,
			appealerId: req.user.id,
			appealerType: req.user.type === "cleaner" ? "cleaner" : "homeowner",
			category,
			severity,
			description,
			contestingItems,
			requestedRelief,
			req,
		});

		// Send confirmation notification
		await NotificationService.createNotification(
			req.user.id,
			`Your cancellation appeal has been submitted and is under review. Reference: Appeal #${result.appeal.id}`
		);

		// Send email confirmation
		try {
			await Email.sendAppealSubmittedConfirmation(req.user, result.appeal);
		} catch (emailErr) {
			console.error("[Appeal] Email notification failed:", emailErr);
		}

		res.status(201).json({
			success: true,
			appeal: {
				id: result.appeal.id,
				status: result.appeal.status,
				priority: result.appeal.priority,
				slaDeadline: result.slaDeadline?.toISOString() || null,
				submittedAt: result.appeal.submittedAt?.toISOString() || null,
			},
			message: "Appeal submitted successfully. You will be notified of the decision within 48 hours.",
		});

	} catch (error) {
		console.error("[Appeal] Submit error:", error);
		res.status(400).json({
			success: false,
			error: error.message,
		});
	}
});

// ====================
// HR/OWNER ENDPOINTS (specific routes must come before /:id)
// ====================

/**
 * Get appeals queue
 * GET /api/v1/appeals/queue
 */
router.get("/queue", requireHrOrOwner, async (req, res) => {
	try {
		const { status, priority, assignedTo, limit, offset } = req.query;

		const result = await AppealService.getQueue({
			status,
			priority,
			assignedTo: assignedTo ? parseInt(assignedTo) : undefined,
			limit: limit ? parseInt(limit) : 50,
			offset: offset ? parseInt(offset) : 0,
		});

		res.json({
			success: true,
			appeals: result.rows.map(appeal => ({
				id: appeal.id,
				appointmentId: appeal.appointmentId,
				appointmentDate: appeal.appointment?.date?.toISOString() || null,
				appealer: appeal.appealer ? {
					id: appeal.appealer.id,
					name: `${appeal.appealer.firstName} ${appeal.appealer.lastName}`,
					email: appeal.appealer.email,
					scrutinyLevel: appeal.appealer.appealScrutinyLevel,
				} : null,
				assignee: appeal.assignee ? {
					id: appeal.assignee.id,
					name: `${appeal.assignee.firstName} ${appeal.assignee.lastName}`,
				} : null,
				category: appeal.category,
				severity: appeal.severity,
				status: appeal.status,
				priority: appeal.priority,
				slaDeadline: appeal.slaDeadline?.toISOString() || null,
				isPastSLA: appeal.isPastSLA(),
				submittedAt: appeal.submittedAt?.toISOString() || null,
			})),
			total: result.count,
			limit: parseInt(limit) || 50,
			offset: parseInt(offset) || 0,
		});

	} catch (error) {
		console.error("[Appeal] Queue error:", error);
		res.status(500).json({
			success: false,
			error: "Failed to retrieve appeals queue",
		});
	}
});

/**
 * Get dashboard stats
 * GET /api/v1/appeals/stats
 */
router.get("/stats", requireHrOrOwner, async (req, res) => {
	try {
		const stats = await AppealService.getStats();

		res.json({
			success: true,
			stats,
		});

	} catch (error) {
		console.error("[Appeal] Stats error:", error);
		res.status(500).json({
			success: false,
			error: "Failed to retrieve stats",
		});
	}
});

/**
 * Get SLA breaches
 * GET /api/v1/appeals/sla-breaches
 */
router.get("/sla-breaches", requireHrOrOwner, async (req, res) => {
	try {
		const breaches = await AppealService.getSLABreaches();

		res.json({
			success: true,
			breaches: breaches.map(appeal => ({
				id: appeal.id,
				appointmentId: appeal.appointmentId,
				appealer: appeal.appealer ? {
					id: appeal.appealer.id,
					name: `${appeal.appealer.firstName} ${appeal.appealer.lastName}`,
					email: appeal.appealer.email,
				} : null,
				assignee: appeal.assignee ? {
					id: appeal.assignee.id,
					name: `${appeal.assignee.firstName} ${appeal.assignee.lastName}`,
				} : null,
				category: appeal.category,
				status: appeal.status,
				priority: appeal.priority,
				slaDeadline: appeal.slaDeadline?.toISOString() || null,
				hoursOverdue: appeal.slaDeadline ? Math.round((Date.now() - new Date(appeal.slaDeadline).getTime()) / (1000 * 60 * 60)) : 0,
				submittedAt: appeal.submittedAt?.toISOString() || null,
			})),
			total: breaches.length,
		});

	} catch (error) {
		console.error("[Appeal] SLA breaches error:", error);
		res.status(500).json({
			success: false,
			error: "Failed to retrieve SLA breaches",
		});
	}
});

/**
 * Get user's complete appeal history (for HR/Owner view)
 * GET /api/v1/appeals/user/:userId
 */
router.get("/user/:userId", requireHrOrOwner, async (req, res) => {
	try {
		const history = await AppealService.getUserAppealHistory(parseInt(req.params.userId));

		res.json({
			success: true,
			...history,
		});

	} catch (error) {
		console.error("[Appeal] User history error:", error);
		res.status(400).json({
			success: false,
			error: error.message,
		});
	}
});

// ====================
// PARAMETERIZED ROUTES (must come after specific routes)
// ====================

/**
 * Get appeal details
 * GET /api/v1/appeals/:id
 */
router.get("/:id", requireAuth, async (req, res) => {
	try {
		const { CancellationAppeal, UserAppointments, User } = require("../../../models");

		const appeal = await CancellationAppeal.findByPk(req.params.id, {
			include: [
				{
					model: UserAppointments,
					as: "appointment",
					attributes: ["id", "date", "userId"],
				},
				{
					model: User,
					as: "assignee",
					attributes: ["id", "firstName", "lastName"],
				},
			],
		});

		if (!appeal) {
			return res.status(404).json({
				success: false,
				error: "Appeal not found",
			});
		}

		// Users can only view their own appeals
		const isOwnerOrHr = ["hr", "owner"].includes(req.user.type);
		if (!isOwnerOrHr && appeal.appealerId !== req.user.id) {
			return res.status(403).json({
				success: false,
				error: "Not authorized to view this appeal",
			});
		}

		res.json({
			success: true,
			appeal: {
				id: appeal.id,
				appointmentId: appeal.appointmentId,
				category: appeal.category,
				severity: appeal.severity,
				description: appeal.description,
				contestingItems: appeal.contestingItems,
				requestedRelief: appeal.requestedRelief,
				status: appeal.status,
				priority: appeal.priority,
				assignedTo: appeal.assignee ? {
					id: appeal.assignee.id,
					name: `${appeal.assignee.firstName} ${appeal.assignee.lastName}`,
				} : null,
				slaDeadline: appeal.slaDeadline?.toISOString() || null,
				timeUntilSLA: appeal.getTimeUntilSLA(),
				isPastSLA: appeal.isPastSLA(),
				resolution: appeal.resolution,
				resolutionNotes: appeal.resolutionNotes,
				reviewDecision: appeal.reviewDecision,
				submittedAt: appeal.submittedAt?.toISOString() || null,
				closedAt: appeal.closedAt?.toISOString() || null,
				supportingDocuments: appeal.supportingDocuments,
			},
		});

	} catch (error) {
		console.error("[Appeal] Get error:", error);
		res.status(500).json({
			success: false,
			error: "Failed to retrieve appeal",
		});
	}
});

/**
 * Upload supporting documents
 * POST /api/v1/appeals/:id/documents
 */
router.post("/:id/documents", requireAuth, async (req, res) => {
	try {
		const { CancellationAppeal } = require("../../../models");

		const appeal = await CancellationAppeal.findByPk(req.params.id);

		if (!appeal) {
			return res.status(404).json({
				success: false,
				error: "Appeal not found",
			});
		}

		if (appeal.appealerId !== req.user.id) {
			return res.status(403).json({
				success: false,
				error: "Not authorized to update this appeal",
			});
		}

		if (appeal.isClosed()) {
			return res.status(400).json({
				success: false,
				error: "Cannot add documents to a closed appeal",
			});
		}

		const { documents } = req.body;

		if (!documents || !Array.isArray(documents)) {
			return res.status(400).json({
				success: false,
				error: "Documents must be an array of {url, type} objects",
			});
		}

		const existingDocs = appeal.supportingDocuments || [];
		const newDocs = documents.map(doc => ({
			url: doc.url,
			type: doc.type,
			uploadedAt: new Date().toISOString(),
		}));

		await appeal.update({
			supportingDocuments: [...existingDocs, ...newDocs],
			lastActivityAt: new Date(),
		});

		// Log audit event
		CancellationAuditService.log({
			appointmentId: appeal.appointmentId,
			appealId: appeal.id,
			eventType: "appeal_documents_uploaded",
			actorId: req.user.id,
			actorType: req.user.type,
			eventData: { documentCount: newDocs.length },
			req,
		});

		res.json({
			success: true,
			message: "Documents uploaded successfully",
			totalDocuments: existingDocs.length + newDocs.length,
		});

	} catch (error) {
		console.error("[Appeal] Document upload error:", error);
		res.status(500).json({
			success: false,
			error: "Failed to upload documents",
		});
	}
});

/**
 * Withdraw appeal
 * DELETE /api/v1/appeals/:id
 */
router.delete("/:id", requireAuth, async (req, res) => {
	try {
		const { CancellationAppeal, UserAppointments } = require("../../../models");

		const appeal = await CancellationAppeal.findByPk(req.params.id);

		if (!appeal) {
			return res.status(404).json({
				success: false,
				error: "Appeal not found",
			});
		}

		if (appeal.appealerId !== req.user.id) {
			return res.status(403).json({
				success: false,
				error: "Not authorized to withdraw this appeal",
			});
		}

		if (!["submitted", "awaiting_documents"].includes(appeal.status)) {
			return res.status(400).json({
				success: false,
				error: "Can only withdraw appeals that are still pending review",
			});
		}

		// Update appeal status
		await appeal.update({
			status: "denied",
			resolutionNotes: "Withdrawn by appellant",
			closedAt: new Date(),
		});

		// Update appointment
		await UserAppointments.update(
			{ hasActiveAppeal: false },
			{ where: { id: appeal.appointmentId } }
		);

		res.json({
			success: true,
			message: "Appeal withdrawn successfully",
		});

	} catch (error) {
		console.error("[Appeal] Withdraw error:", error);
		res.status(500).json({
			success: false,
			error: "Failed to withdraw appeal",
		});
	}
});

/**
 * Assign appeal to reviewer
 * PUT /api/v1/appeals/:id/assign
 */
router.put("/:id/assign", requireHrOrOwner, async (req, res) => {
	try {
		const { assigneeId } = req.body;

		if (!assigneeId) {
			return res.status(400).json({
				success: false,
				error: "assigneeId is required",
			});
		}

		const appeal = await AppealService.assignAppeal(
			parseInt(req.params.id),
			parseInt(assigneeId),
			req.user.id,
			req
		);

		res.json({
			success: true,
			appeal: {
				id: appeal.id,
				status: appeal.status,
				assignedTo: appeal.assignedTo,
				assignedAt: appeal.assignedAt?.toISOString() || null,
			},
		});

	} catch (error) {
		console.error("[Appeal] Assign error:", error);
		res.status(400).json({
			success: false,
			error: error.message,
		});
	}
});

/**
 * Update appeal status
 * PUT /api/v1/appeals/:id/status
 */
router.put("/:id/status", requireHrOrOwner, async (req, res) => {
	try {
		const { status, notes } = req.body;

		if (!status) {
			return res.status(400).json({
				success: false,
				error: "status is required",
			});
		}

		const validStatuses = ["under_review", "awaiting_documents", "escalated"];
		if (!validStatuses.includes(status)) {
			return res.status(400).json({
				success: false,
				error: `Invalid status. Must be one of: ${validStatuses.join(", ")}`,
			});
		}

		const appeal = await AppealService.updateStatus(
			parseInt(req.params.id),
			status,
			req.user.id,
			notes,
			req
		);

		// Notify appellant of status change
		if (status === "awaiting_documents") {
			await NotificationService.createNotification(
				appeal.appealerId,
				`Your appeal requires additional documentation. Please submit supporting documents within 24 hours.`
			);
		}

		res.json({
			success: true,
			appeal: {
				id: appeal.id,
				status: appeal.status,
				lastActivityAt: appeal.lastActivityAt?.toISOString() || null,
			},
		});

	} catch (error) {
		console.error("[Appeal] Status update error:", error);
		res.status(400).json({
			success: false,
			error: error.message,
		});
	}
});

/**
 * Resolve appeal with decision
 * PUT /api/v1/appeals/:id/resolve
 */
router.put("/:id/resolve", requireHrOrOwner, async (req, res) => {
	try {
		const { decision, resolution } = req.body;

		if (!decision) {
			return res.status(400).json({
				success: false,
				error: "decision is required (approve, partial, deny)",
			});
		}

		const validDecisions = ["approve", "partial", "deny"];
		if (!validDecisions.includes(decision)) {
			return res.status(400).json({
				success: false,
				error: `Invalid decision. Must be one of: ${validDecisions.join(", ")}`,
			});
		}

		const appeal = await AppealService.resolveAppeal(
			parseInt(req.params.id),
			decision,
			resolution || {},
			req.user.id,
			req
		);

		// Send notification to appellant
		const { User } = require("../../../models");
		const appellant = await User.findByPk(appeal.appealerId);

		let message;
		if (decision === "approve") {
			message = `Your cancellation appeal has been approved. Any applicable fees have been waived or refunded.`;
		} else if (decision === "partial") {
			message = `Your cancellation appeal has been partially approved. Please review the resolution details.`;
		} else {
			message = `Your cancellation appeal has been reviewed and denied. ${resolution?.notes || ""}`;
		}

		await NotificationService.createNotification(appeal.appealerId, message);

		// Send email
		try {
			await Email.sendAppealResolved(appellant, appeal, decision);
		} catch (emailErr) {
			console.error("[Appeal] Email notification failed:", emailErr);
		}

		res.json({
			success: true,
			appeal: {
				id: appeal.id,
				status: appeal.status,
				resolution: appeal.resolution,
				resolutionNotes: appeal.resolutionNotes,
				reviewedBy: appeal.reviewedBy,
				reviewedAt: appeal.reviewedAt?.toISOString() || null,
				closedAt: appeal.closedAt?.toISOString() || null,
			},
		});

	} catch (error) {
		console.error("[Appeal] Resolve error:", error);
		res.status(400).json({
			success: false,
			error: error.message,
		});
	}
});

/**
 * Get audit trail for an appeal/appointment
 * GET /api/v1/appeals/:id/audit
 */
router.get("/:id/audit", requireHrOrOwner, async (req, res) => {
	try {
		const { CancellationAppeal } = require("../../../models");

		const appeal = await CancellationAppeal.findByPk(req.params.id);
		if (!appeal) {
			return res.status(404).json({
				success: false,
				error: "Appeal not found",
			});
		}

		const auditTrail = await CancellationAuditService.getAuditTrail(appeal.appointmentId);

		res.json({
			success: true,
			appointmentId: appeal.appointmentId,
			appealId: appeal.id,
			auditTrail: auditTrail.map(entry => ({
				id: entry.id,
				eventType: entry.eventType,
				actor: entry.actor ? {
					id: entry.actor.id,
					name: `${entry.actor.firstName} ${entry.actor.lastName}`,
					type: entry.actorType,
				} : { type: entry.actorType },
				eventData: entry.eventData,
				previousState: entry.previousState,
				newState: entry.newState,
				occurredAt: entry.occurredAt?.toISOString() || null,
			})),
		});

	} catch (error) {
		console.error("[Appeal] Audit trail error:", error);
		res.status(500).json({
			success: false,
			error: "Failed to retrieve audit trail",
		});
	}
});

module.exports = router;
