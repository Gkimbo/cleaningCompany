/**
 * Guest Not Left Router (Tenant Present Workflow)
 *
 * Handles endpoints for when cleaners arrive and find tenants still present.
 * Manages the communication flow between cleaner and homeowner.
 */

const express = require("express");
const router = express.Router();
const authenticateToken = require("../../../middleware/authenticatedToken");
const GuestNotLeftService = require("../../../services/GuestNotLeftService");
const { User } = require("../../../models");

// ====================
// CLEANER ENDPOINTS
// ====================

/**
 * Report tenant still present
 * POST /api/v1/guest-not-left/report
 */
router.post("/report", authenticateToken, async (req, res) => {
	try {
		const { appointmentId, latitude, longitude, notes } = req.body;

		if (!appointmentId) {
			return res.status(400).json({
				success: false,
				error: "appointmentId is required",
			});
		}

		// Only cleaners can report
		const user = await User.findByPk(req.userId, { attributes: ["id", "type"] });
		if (!user || user.type !== "cleaner") {
			return res.status(403).json({
				success: false,
				error: "Only cleaners can report tenant present",
			});
		}

		const gpsData = latitude && longitude ? { latitude, longitude } : {};
		const io = req.app.get("io");

		const result = await GuestNotLeftService.reportTenantPresent(
			appointmentId,
			req.userId,
			gpsData,
			notes,
			io
		);

		res.status(201).json({
			success: true,
			...result,
		});
	} catch (error) {
		console.error("[GuestNotLeft] Report error:", error);
		res.status(400).json({
			success: false,
			error: error.message,
		});
	}
});

/**
 * Cleaner will wait on-site
 * POST /api/v1/guest-not-left/:id/wait
 */
router.post("/:id/wait", authenticateToken, async (req, res) => {
	try {
		const user = await User.findByPk(req.userId, { attributes: ["id", "type"] });
		if (!user || user.type !== "cleaner") {
			return res.status(403).json({
				success: false,
				error: "Only cleaners can perform this action",
			});
		}

		const result = await GuestNotLeftService.cleanerWillWait(
			parseInt(req.params.id),
			req.userId
		);

		res.json({
			success: true,
			...result,
		});
	} catch (error) {
		console.error("[GuestNotLeft] Wait error:", error);
		res.status(400).json({
			success: false,
			error: error.message,
		});
	}
});

/**
 * Cleaner will return later
 * POST /api/v1/guest-not-left/:id/will-return
 */
router.post("/:id/will-return", authenticateToken, async (req, res) => {
	try {
		const user = await User.findByPk(req.userId, { attributes: ["id", "type"] });
		if (!user || user.type !== "cleaner") {
			return res.status(403).json({
				success: false,
				error: "Only cleaners can perform this action",
			});
		}

		const { estimatedReturnTime } = req.body;
		const returnTime = estimatedReturnTime ? new Date(estimatedReturnTime) : null;

		const result = await GuestNotLeftService.cleanerWillReturn(
			parseInt(req.params.id),
			req.userId,
			returnTime
		);

		res.json({
			success: true,
			...result,
		});
	} catch (error) {
		console.error("[GuestNotLeft] Will-return error:", error);
		res.status(400).json({
			success: false,
			error: error.message,
		});
	}
});

/**
 * Cleaner cancelling (no penalty)
 * POST /api/v1/guest-not-left/:id/cancel
 */
router.post("/:id/cancel", authenticateToken, async (req, res) => {
	try {
		const user = await User.findByPk(req.userId, { attributes: ["id", "type"] });
		if (!user || user.type !== "cleaner") {
			return res.status(403).json({
				success: false,
				error: "Only cleaners can perform this action",
			});
		}

		const io = req.app.get("io");

		const result = await GuestNotLeftService.cleanerCancelling(
			parseInt(req.params.id),
			req.userId,
			io
		);

		res.json({
			success: true,
			...result,
			message: "Appointment cancelled with no penalty to either party.",
		});
	} catch (error) {
		console.error("[GuestNotLeft] Cancel error:", error);
		res.status(400).json({
			success: false,
			error: error.message,
		});
	}
});

/**
 * Cleaner has returned to property
 * POST /api/v1/guest-not-left/:id/returned
 */
router.post("/:id/returned", authenticateToken, async (req, res) => {
	try {
		const user = await User.findByPk(req.userId, { attributes: ["id", "type"] });
		if (!user || user.type !== "cleaner") {
			return res.status(403).json({
				success: false,
				error: "Only cleaners can perform this action",
			});
		}

		const { latitude, longitude } = req.body;
		const gpsData = latitude && longitude ? { latitude, longitude } : {};

		const result = await GuestNotLeftService.cleanerReturned(
			parseInt(req.params.id),
			req.userId,
			gpsData
		);

		res.json({
			success: true,
			...result,
		});
	} catch (error) {
		console.error("[GuestNotLeft] Returned error:", error);
		res.status(400).json({
			success: false,
			error: error.message,
		});
	}
});

/**
 * Cleaner proceeding with job (tenant left)
 * POST /api/v1/guest-not-left/:id/proceed
 */
router.post("/:id/proceed", authenticateToken, async (req, res) => {
	try {
		const user = await User.findByPk(req.userId, { attributes: ["id", "type"] });
		if (!user || user.type !== "cleaner") {
			return res.status(403).json({
				success: false,
				error: "Only cleaners can perform this action",
			});
		}

		const result = await GuestNotLeftService.cleanerProceeding(
			parseInt(req.params.id),
			req.userId
		);

		res.json({
			success: true,
			...result,
			message: "Report resolved. You can start the job.",
		});
	} catch (error) {
		console.error("[GuestNotLeft] Proceed error:", error);
		res.status(400).json({
			success: false,
			error: error.message,
		});
	}
});

// ====================
// HOMEOWNER ENDPOINTS
// ====================

/**
 * Homeowner: tenant is leaving (resolved)
 * POST /api/v1/guest-not-left/:id/resolved
 */
router.post("/:id/resolved", authenticateToken, async (req, res) => {
	try {
		const user = await User.findByPk(req.userId, { attributes: ["id", "type"] });
		if (!user || user.type !== "client") {
			return res.status(403).json({
				success: false,
				error: "Only homeowners can perform this action",
			});
		}

		const { note } = req.body;
		const io = req.app.get("io");

		const result = await GuestNotLeftService.homeownerResolved(
			parseInt(req.params.id),
			req.userId,
			note,
			io
		);

		res.json({
			success: true,
			...result,
			message: "Cleaner has been notified that the tenant is leaving.",
		});
	} catch (error) {
		console.error("[GuestNotLeft] Resolved error:", error);
		res.status(400).json({
			success: false,
			error: error.message,
		});
	}
});

/**
 * Homeowner: need more time
 * POST /api/v1/guest-not-left/:id/need-time
 */
router.post("/:id/need-time", authenticateToken, async (req, res) => {
	try {
		const user = await User.findByPk(req.userId, { attributes: ["id", "type"] });
		if (!user || user.type !== "client") {
			return res.status(403).json({
				success: false,
				error: "Only homeowners can perform this action",
			});
		}

		const { additionalMinutes, note } = req.body;

		if (!additionalMinutes || additionalMinutes < 1) {
			return res.status(400).json({
				success: false,
				error: "additionalMinutes is required (1-60)",
			});
		}

		const io = req.app.get("io");

		const result = await GuestNotLeftService.homeownerNeedsTime(
			parseInt(req.params.id),
			req.userId,
			Math.min(parseInt(additionalMinutes), 60),
			note,
			io
		);

		res.json({
			success: true,
			...result,
			message: "Cleaner has been notified about the additional time needed.",
		});
	} catch (error) {
		console.error("[GuestNotLeft] Need-time error:", error);
		res.status(400).json({
			success: false,
			error: error.message,
		});
	}
});

/**
 * Homeowner: cannot resolve today
 * POST /api/v1/guest-not-left/:id/cannot-resolve
 */
router.post("/:id/cannot-resolve", authenticateToken, async (req, res) => {
	try {
		const user = await User.findByPk(req.userId, { attributes: ["id", "type"] });
		if (!user || user.type !== "client") {
			return res.status(403).json({
				success: false,
				error: "Only homeowners can perform this action",
			});
		}

		const io = req.app.get("io");

		const result = await GuestNotLeftService.homeownerCannotResolve(
			parseInt(req.params.id),
			req.userId,
			io
		);

		res.json({
			success: true,
			...result,
			message: "Appointment cancelled. No charges have been applied.",
		});
	} catch (error) {
		console.error("[GuestNotLeft] Cannot-resolve error:", error);
		res.status(400).json({
			success: false,
			error: error.message,
		});
	}
});

// ====================
// QUERY ENDPOINTS
// ====================

/**
 * Get active report for an appointment
 * GET /api/v1/guest-not-left/active/:appointmentId
 */
router.get("/active/:appointmentId", authenticateToken, async (req, res) => {
	try {
		const report = await GuestNotLeftService.getActiveReportForAppointment(
			parseInt(req.params.appointmentId)
		);

		if (!report) {
			return res.json({
				success: true,
				report: null,
				message: "No active tenant present report for this appointment",
			});
		}

		res.json({
			success: true,
			report,
		});
	} catch (error) {
		console.error("[GuestNotLeft] Active report error:", error);
		res.status(500).json({
			success: false,
			error: "Failed to retrieve report",
		});
	}
});

/**
 * Get pending reports requiring homeowner response
 * GET /api/v1/guest-not-left/pending
 */
router.get("/pending", authenticateToken, async (req, res) => {
	try {
		const user = await User.findByPk(req.userId, { attributes: ["id", "type"] });
		if (!user || user.type !== "client") {
			return res.status(403).json({
				success: false,
				error: "Only homeowners can view pending reports",
			});
		}

		const reports = await GuestNotLeftService.getPendingReportsForHomeowner(req.userId);

		res.json({
			success: true,
			reports,
			count: reports.length,
		});
	} catch (error) {
		console.error("[GuestNotLeft] Pending reports error:", error);
		res.status(500).json({
			success: false,
			error: "Failed to retrieve pending reports",
		});
	}
});

// ====================
// STATS ENDPOINTS (for anti-gaming review)
// ====================
// NOTE: These must come BEFORE /:id to avoid route conflict

/**
 * Get cleaner stats (HR/Owner only)
 * GET /api/v1/guest-not-left/stats/cleaner/:cleanerId
 */
router.get("/stats/cleaner/:cleanerId", authenticateToken, async (req, res) => {
	try {
		const user = await User.findByPk(req.userId, { attributes: ["id", "type"] });
		if (!user || !["owner", "hr"].includes(user.type)) {
			return res.status(403).json({
				success: false,
				error: "Only HR or Owner can view cleaner stats",
			});
		}

		const { months } = req.query;
		const stats = await GuestNotLeftService.getCleanerReportStats(
			parseInt(req.params.cleanerId),
			months ? parseInt(months) : 6
		);

		const { User } = require("../../../models");
		const cleaner = await User.findByPk(req.params.cleanerId, {
			attributes: ["id", "firstName", "lastName", "tenantReportScrutinyLevel"],
		});

		res.json({
			success: true,
			cleaner: cleaner ? {
				id: cleaner.id,
				name: `${cleaner.firstName} ${cleaner.lastName}`,
				scrutinyLevel: cleaner.tenantReportScrutinyLevel,
			} : null,
			stats,
		});
	} catch (error) {
		console.error("[GuestNotLeft] Cleaner stats error:", error);
		res.status(500).json({
			success: false,
			error: "Failed to retrieve cleaner stats",
		});
	}
});

/**
 * Get home incident stats (HR/Owner only)
 * GET /api/v1/guest-not-left/stats/home/:homeId
 */
router.get("/stats/home/:homeId", authenticateToken, async (req, res) => {
	try {
		const user = await User.findByPk(req.userId, { attributes: ["id", "type"] });
		if (!user || !["owner", "hr"].includes(user.type)) {
			return res.status(403).json({
				success: false,
				error: "Only HR or Owner can view home stats",
			});
		}

		const { months } = req.query;
		const stats = await GuestNotLeftService.getHomeIncidentStats(
			parseInt(req.params.homeId),
			months ? parseInt(months) : 12
		);

		res.json({
			success: true,
			homeId: parseInt(req.params.homeId),
			stats,
		});
	} catch (error) {
		console.error("[GuestNotLeft] Home stats error:", error);
		res.status(500).json({
			success: false,
			error: "Failed to retrieve home stats",
		});
	}
});

/**
 * Get report details by ID
 * GET /api/v1/guest-not-left/:id
 * NOTE: This catch-all route must come LAST after all specific routes
 */
router.get("/:id", authenticateToken, async (req, res) => {
	try {
		const { GuestNotLeftReport, UserAppointments, UserHomes, User } = require("../../../models");

		const report = await GuestNotLeftReport.findByPk(req.params.id, {
			include: [
				{
					model: User,
					as: "reporter",
					attributes: ["id", "firstName", "lastName"],
				},
			],
		});

		if (!report) {
			return res.status(404).json({
				success: false,
				error: "Report not found",
			});
		}

		// Check authorization
		const appointment = await UserAppointments.findByPk(report.appointmentId, {
			include: [{ model: UserHomes, as: "home" }],
		});

		const currentUser = await User.findByPk(req.userId, { attributes: ["id", "type"] });
		const isReporter = report.reportedBy === req.userId;
		const isHomeowner = appointment && appointment.userId === req.userId;
		const isOwnerOrHR = currentUser && ["owner", "hr"].includes(currentUser.type);

		if (!isReporter && !isHomeowner && !isOwnerOrHR) {
			return res.status(403).json({
				success: false,
				error: "Not authorized to view this report",
			});
		}

		const serialized = GuestNotLeftService.serializeTenantPresentReport(report, appointment);

		res.json({
			success: true,
			report: serialized,
		});
	} catch (error) {
		console.error("[GuestNotLeft] Get report error:", error);
		res.status(500).json({
			success: false,
			error: "Failed to retrieve report",
		});
	}
});

module.exports = router;
