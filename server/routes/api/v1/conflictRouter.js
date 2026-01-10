/**
 * Conflict Resolution Router
 *
 * API endpoints for the unified Conflict Resolution Center.
 * Handles both CancellationAppeals and HomeSizeAdjustment disputes.
 */

const express = require("express");
const router = express.Router();
const ConflictResolutionService = require("../../../services/ConflictResolutionService");
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
		const stats = await ConflictResolutionService.getQueueStats();

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

/**
 * GET /conflicts/:type/:id
 * Get full case details
 */
router.get("/:type/:id", async (req, res) => {
	try {
		const { type, id } = req.params;

		if (!["appeal", "adjustment"].includes(type)) {
			return res.status(400).json({
				success: false,
				error: "Invalid case type. Must be 'appeal' or 'adjustment'.",
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
 * POST /conflicts/:type/:id/refund
 * Process refund to homeowner
 */
router.post("/:type/:id/refund", async (req, res) => {
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
