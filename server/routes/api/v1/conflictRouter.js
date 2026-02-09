/**
 * Conflict Resolution Router
 *
 * API endpoints for the unified Conflict Resolution Center.
 * Handles both CancellationAppeals and HomeSizeAdjustment disputes.
 */

const express = require("express");
const router = express.Router();
const ConflictResolutionService = require("../../../services/ConflictResolutionService");
const AnalyticsService = require("../../../services/AnalyticsService");
const verifyHROrOwner = require("../../../middleware/verifyHROrOwner");

// All routes require authentication and HR/Owner role
router.use(verifyHROrOwner);

/**
 * GET /conflicts/queue
 * Get unified conflict queue
 */
router.get("/queue", async (req, res) => {
	try {
		const {
			caseType,
			status,
			priority,
			assignedTo,
			search,
			limit,
			offset,
		} = req.query;

		const result = await ConflictResolutionService.getConflictQueue({
			caseType,
			status,
			priority,
			assignedTo: assignedTo ? parseInt(assignedTo) : undefined,
			search,
			limit: limit ? parseInt(limit) : 50,
			offset: offset ? parseInt(offset) : 0,
			includeDemoData: req.user?.isDemoAccount === true,
		});

		res.json({
			success: true,
			...result,
		});

	} catch (error) {
		console.error("[ConflictRouter] Error getting queue:", error);
		res.status(500).json({
			success: false,
			error: error.message,
		});
	}
});

/**
 * GET /conflicts/stats
 * Get queue statistics
 */
router.get("/stats", async (req, res) => {
	try {
		const stats = await ConflictResolutionService.getQueueStats({
			includeDemoData: req.user?.isDemoAccount === true,
		});

		res.json({
			success: true,
			...stats,
		});

	} catch (error) {
		console.error("[ConflictRouter] Error getting stats:", error);
		res.status(500).json({
			success: false,
			error: error.message,
		});
	}
});

// ==================
// Support Ticket Routes (must be before /:type/:id to avoid interception)
// ==================

/**
 * POST /conflicts/support/create
 * Create a new support ticket
 */
router.post("/support/create", async (req, res) => {
	try {
		const {
			conversationId,
			subjectUserId,
			subjectType,
			category,
			description,
			priority,
		} = req.body;

		// Validate required fields
		if (!category || !description) {
			return res.status(400).json({
				success: false,
				error: "Category and description are required",
			});
		}

		// Validate category
		const validCategories = [
			"account_issue",
			"behavior_concern",
			"service_complaint",
			"billing_question",
			"technical_issue",
			"policy_violation",
			"other",
		];
		if (!validCategories.includes(category)) {
			return res.status(400).json({
				success: false,
				error: `Invalid category. Must be one of: ${validCategories.join(", ")}`,
			});
		}

		const SupportTicketService = require("../../../services/SupportTicketService");

		let ticket;
		if (conversationId) {
			// Create from conversation
			ticket = await SupportTicketService.createFromConversation(
				parseInt(conversationId),
				{
					subjectUserId: subjectUserId ? parseInt(subjectUserId) : null,
					subjectType: subjectType || null,
					category,
					description,
					priority: priority || "normal",
				},
				req.user.id
			);
		} else {
			// Create directly
			ticket = await SupportTicketService.createDirect(
				{
					subjectUserId: subjectUserId ? parseInt(subjectUserId) : null,
					subjectType: subjectType || null,
					category,
					description,
					priority: priority || "normal",
				},
				req.user.id
			);
		}

		res.status(201).json({
			success: true,
			ticket: {
				id: ticket.id,
				caseNumber: ticket.caseNumber,
				status: ticket.status,
				priority: ticket.priority,
				slaDeadline: ticket.slaDeadline,
			},
		});

	} catch (error) {
		console.error("[ConflictRouter] Error creating support ticket:", error);
		res.status(500).json({
			success: false,
			error: error.message,
		});
	}
});

/**
 * GET /conflicts/support/:id/conversation
 * Get linked conversation messages for a support ticket
 */
router.get("/support/:id/conversation", async (req, res) => {
	try {
		const { id } = req.params;

		const SupportTicketService = require("../../../services/SupportTicketService");
		const result = await SupportTicketService.getLinkedMessages(parseInt(id));

		res.json({
			success: true,
			...result,
		});

	} catch (error) {
		console.error("[ConflictRouter] Error getting linked conversation:", error);
		res.status(500).json({
			success: false,
			error: error.message,
		});
	}
});

// ==================
// Lookup & Search Routes (must be before /:type/:id to avoid interception)
// ==================

/**
 * GET /conflicts/lookup/:caseNumber
 * Quick lookup by case number (for support calls)
 */
router.get("/lookup/:caseNumber", async (req, res) => {
	try {
		const { caseNumber } = req.params;
		const upperCaseNumber = caseNumber.toUpperCase().trim();

		const result = await ConflictResolutionService.lookupByCaseNumber(upperCaseNumber, {
			includeDemoData: req.user?.isDemoAccount === true,
		});

		if (!result) {
			return res.status(404).json({
				success: false,
				error: "Case not found",
				searchedFor: upperCaseNumber,
			});
		}

		res.json({
			success: true,
			case: result,
		});

	} catch (error) {
		console.error("[ConflictRouter] Error looking up case:", error);
		res.status(500).json({
			success: false,
			error: error.message,
		});
	}
});

/**
 * GET /conflicts/user/search
 * Search for user by email, phone, or ID and get their cases
 */
router.get("/user/search", async (req, res) => {
	try {
		const { email, phone, query } = req.query;

		if (!email && !phone && !query) {
			return res.status(400).json({
				success: false,
				error: "Please provide email, phone, or query parameter",
			});
		}

		const result = await ConflictResolutionService.searchUserAndCases({
			email,
			phone,
			query,
			includeDemoData: req.user?.isDemoAccount === true,
		});

		res.json({
			success: true,
			...result,
		});

	} catch (error) {
		console.error("[ConflictRouter] Error searching user:", error);
		res.status(500).json({
			success: false,
			error: error.message,
		});
	}
});

/**
 * GET /conflicts/user/:userId/cases
 * Get all cases for a specific user
 */
router.get("/user/:userId/cases", async (req, res) => {
	try {
		const { userId } = req.params;
		const { includeResolved } = req.query;

		const cases = await ConflictResolutionService.getCasesForUser(
			parseInt(userId),
			{
				includeResolved: includeResolved === "true",
				includeDemoData: req.user?.isDemoAccount === true,
			}
		);

		res.json({
			success: true,
			userId: parseInt(userId),
			cases,
			total: cases.length,
		});

	} catch (error) {
		console.error("[ConflictRouter] Error getting user cases:", error);
		res.status(500).json({
			success: false,
			error: error.message,
		});
	}
});

// ==================
// Dynamic Case Routes (/:type/:id pattern)
// ==================

/**
 * GET /conflicts/:type/:id
 * Get full case details
 */
router.get("/:type/:id", async (req, res) => {
	try {
		const { type, id } = req.params;

		if (!["appeal", "adjustment", "payment", "support"].includes(type)) {
			return res.status(400).json({
				success: false,
				error: "Invalid case type. Must be 'appeal', 'adjustment', 'payment', or 'support'.",
			});
		}

		const caseData = await ConflictResolutionService.getConflictCase(
			parseInt(id),
			type
		);

		res.json({
			success: true,
			case: caseData,
		});

	} catch (error) {
		console.error("[ConflictRouter] Error getting case:", error);
		res.status(error.message.includes("not found") ? 404 : 500).json({
			success: false,
			error: error.message,
		});
	}
});

/**
 * GET /conflicts/:type/:id/photos
 * Get all photos for the appointment
 */
router.get("/:type/:id/photos", async (req, res) => {
	try {
		const { type, id } = req.params;

		// Get case to find appointment ID
		const caseData = await ConflictResolutionService.getConflictCase(
			parseInt(id),
			type
		);

		if (!caseData.appointment?.id) {
			return res.status(404).json({
				success: false,
				error: "No appointment associated with this case",
			});
		}

		const photos = await ConflictResolutionService.getAppointmentPhotos(
			caseData.appointment.id
		);

		res.json({
			success: true,
			appointmentId: caseData.appointment.id,
			...photos,
		});

	} catch (error) {
		console.error("[ConflictRouter] Error getting photos:", error);
		res.status(500).json({
			success: false,
			error: error.message,
		});
	}
});

/**
 * GET /conflicts/:type/:id/checklist
 * Get appointment checklist data
 */
router.get("/:type/:id/checklist", async (req, res) => {
	try {
		const { type, id } = req.params;

		const caseData = await ConflictResolutionService.getConflictCase(
			parseInt(id),
			type
		);

		if (!caseData.appointment?.id) {
			return res.status(404).json({
				success: false,
				error: "No appointment associated with this case",
			});
		}

		const checklist = await ConflictResolutionService.getAppointmentChecklist(
			caseData.appointment.id
		);

		res.json({
			success: true,
			appointmentId: caseData.appointment.id,
			...checklist,
		});

	} catch (error) {
		console.error("[ConflictRouter] Error getting checklist:", error);
		res.status(500).json({
			success: false,
			error: error.message,
		});
	}
});

/**
 * GET /conflicts/:type/:id/messages
 * Get conversation messages for the appointment
 */
router.get("/:type/:id/messages", async (req, res) => {
	try {
		const { type, id } = req.params;

		const caseData = await ConflictResolutionService.getConflictCase(
			parseInt(id),
			type
		);

		if (!caseData.appointment?.id) {
			return res.status(404).json({
				success: false,
				error: "No appointment associated with this case",
			});
		}

		const messages = await ConflictResolutionService.getAppointmentMessages(
			caseData.appointment.id
		);

		res.json({
			success: true,
			appointmentId: caseData.appointment.id,
			...messages,
		});

	} catch (error) {
		console.error("[ConflictRouter] Error getting messages:", error);
		res.status(500).json({
			success: false,
			error: error.message,
		});
	}
});

/**
 * GET /conflicts/:type/:id/audit
 * Get audit trail for the case
 */
router.get("/:type/:id/audit", async (req, res) => {
	try {
		const { type, id } = req.params;

		const caseData = await ConflictResolutionService.getConflictCase(
			parseInt(id),
			type
		);

		const auditTrail = await ConflictResolutionService.getAuditTrail(
			parseInt(id),
			type,
			caseData.appointment?.id
		);

		res.json({
			success: true,
			caseId: parseInt(id),
			caseType: type,
			auditTrail,
		});

	} catch (error) {
		console.error("[ConflictRouter] Error getting audit trail:", error);
		res.status(500).json({
			success: false,
			error: error.message,
		});
	}
});

/**
 * GET /conflicts/:type/:id/refund-info
 * Get refund calculation info for quick actions
 */
router.get("/:type/:id/refund-info", async (req, res) => {
	try {
		const { type, id } = req.params;

		if (!["appeal", "adjustment", "payment", "support"].includes(type)) {
			return res.status(400).json({
				success: false,
				error: "Invalid case type",
			});
		}

		const caseData = await ConflictResolutionService.getConflictCase(parseInt(id), type);

		// Calculate amounts (price is in dollars, convert to cents)
		const originalAmount = caseData.appointment?.price
			? Math.round(caseData.appointment.price * 100)
			: 0;
		const alreadyRefunded = caseData.appointment?.refundAmount || 0;
		const maxRefundable = Math.max(0, originalAmount - alreadyRefunded);

		res.json({
			success: true,
			caseNumber: caseData.caseNumber,
			originalAmount,
			alreadyRefunded,
			maxRefundable,
			quickActions: {
				quarter: Math.floor(maxRefundable * 0.25),
				half: Math.floor(maxRefundable * 0.50),
				threeQuarter: Math.floor(maxRefundable * 0.75),
				full: maxRefundable,
			},
			hasPaymentIntent: !!caseData.appointment?.paymentIntentId,
		});

	} catch (error) {
		console.error("[ConflictRouter] Error getting refund info:", error);
		res.status(500).json({
			success: false,
			error: error.message,
		});
	}
});

/**
 * POST /conflicts/:type/:id/refund
 * Process refund to homeowner
 */
router.post("/:type/:id/refund", async (req, res) => {
	try {
		const { type, id } = req.params;
		const { amount, reason } = req.body;

		if (!["appeal", "adjustment", "payment", "support"].includes(type)) {
			return res.status(400).json({
				success: false,
				error: "Invalid case type",
			});
		}

		if (!amount || amount <= 0) {
			return res.status(400).json({
				success: false,
				error: "Amount must be greater than 0",
			});
		}

		if (!reason) {
			return res.status(400).json({
				success: false,
				error: "Reason is required",
			});
		}

		// Get case data to validate refund amount
		const caseData = await ConflictResolutionService.getConflictCase(parseInt(id), type);

		const originalAmount = caseData.appointment?.price
			? Math.round(caseData.appointment.price * 100)
			: 0;
		const alreadyRefunded = caseData.appointment?.refundAmount || 0;
		const maxRefundable = Math.max(0, originalAmount - alreadyRefunded);

		if (amount > maxRefundable) {
			return res.status(400).json({
				success: false,
				error: `Amount exceeds maximum refundable: $${(maxRefundable / 100).toFixed(2)}`,
				maxRefundable,
				alreadyRefunded,
				originalAmount,
			});
		}

		const result = await ConflictResolutionService.processRefund({
			caseId: parseInt(id),
			caseType: type,
			amount: parseInt(amount),
			reason,
			reviewerId: req.user.id,
			req,
		});

		res.json(result);

	} catch (error) {
		console.error("[ConflictRouter] Error processing refund:", error);
		res.status(500).json({
			success: false,
			error: error.message,
		});
	}
});

/**
 * POST /conflicts/:type/:id/payout
 * Process payout to cleaner
 */
router.post("/:type/:id/payout", async (req, res) => {
	try {
		const { type, id } = req.params;
		const { amount, reason } = req.body;

		if (!amount || amount <= 0) {
			return res.status(400).json({
				success: false,
				error: "Amount must be greater than 0",
			});
		}

		if (!reason) {
			return res.status(400).json({
				success: false,
				error: "Reason is required",
			});
		}

		const result = await ConflictResolutionService.processCleanerPayout({
			caseId: parseInt(id),
			caseType: type,
			amount: parseInt(amount),
			reason,
			reviewerId: req.user.id,
			req,
		});

		res.json(result);

	} catch (error) {
		console.error("[ConflictRouter] Error processing payout:", error);
		res.status(500).json({
			success: false,
			error: error.message,
		});
	}
});

/**
 * POST /conflicts/:type/:id/note
 * Add a reviewer note
 */
router.post("/:type/:id/note", async (req, res) => {
	try {
		const { type, id } = req.params;
		const { note } = req.body;

		if (!note || note.trim().length === 0) {
			return res.status(400).json({
				success: false,
				error: "Note cannot be empty",
			});
		}

		const result = await ConflictResolutionService.addNote({
			caseId: parseInt(id),
			caseType: type,
			note: note.trim(),
			reviewerId: req.user.id,
			req,
		});

		res.json(result);

	} catch (error) {
		console.error("[ConflictRouter] Error adding note:", error);
		res.status(500).json({
			success: false,
			error: error.message,
		});
	}
});

/**
 * POST /conflicts/:type/:id/resolve
 * Resolve the case
 */
router.post("/:type/:id/resolve", async (req, res) => {
	try {
		const { type, id } = req.params;
		const { decision, resolution, notes } = req.body;

		if (!decision || !["approve", "deny", "partial"].includes(decision)) {
			return res.status(400).json({
				success: false,
				error: "Invalid decision. Must be 'approve', 'deny', or 'partial'.",
			});
		}

		const result = await ConflictResolutionService.resolveCase({
			caseId: parseInt(id),
			caseType: type,
			decision,
			resolution: resolution || {},
			notes: notes || "",
			reviewerId: req.user.id,
			req,
		});

		// Track dispute resolution analytics
		await AnalyticsService.trackDisputeResolved(
			type, // disputeType: appeal or adjustment
			result.appointmentId || null,
			decision, // resolution: approve, deny, partial
			req.user.id
		);

		res.json({
			success: true,
			...result,
		});

	} catch (error) {
		console.error("[ConflictRouter] Error resolving case:", error);
		res.status(500).json({
			success: false,
			error: error.message,
		});
	}
});

/**
 * POST /conflicts/:type/:id/assign
 * Assign case to a reviewer
 */
router.post("/:type/:id/assign", async (req, res) => {
	try {
		const { type, id } = req.params;
		const { assigneeId } = req.body;

		if (!assigneeId) {
			return res.status(400).json({
				success: false,
				error: "Assignee ID is required",
			});
		}

		const result = await ConflictResolutionService.assignCase(
			parseInt(id),
			type,
			parseInt(assigneeId),
			req.user.id,
			req
		);

		res.json(result);

	} catch (error) {
		console.error("[ConflictRouter] Error assigning case:", error);
		res.status(500).json({
			success: false,
			error: error.message,
		});
	}
});

module.exports = router;
