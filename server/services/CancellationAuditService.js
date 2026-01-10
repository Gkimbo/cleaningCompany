/**
 * CancellationAuditService
 *
 * Provides comprehensive audit logging for the cancellation system.
 * Logs are immutable and never block the main operation flow.
 */

const { v4: uuidv4 } = require("uuid");

class CancellationAuditService {
	/**
	 * Core logging method - always async, never blocks main flow
	 */
	static async log(options) {
		const {
			CancellationAuditLog,
		} = require("../models");

		const {
			appointmentId,
			appealId,
			eventType,
			actorId,
			actorType,
			eventData,
			previousState,
			newState,
			req,
		} = options;

		try {
			await CancellationAuditLog.create({
				appointmentId,
				appealId,
				eventType,
				actorId,
				actorType: actorType || "system",
				eventData: eventData || {},
				previousState,
				newState,
				requestId: req?.id || uuidv4(),
				ipAddress: this.getClientIp(req),
				userAgent: req?.headers?.["user-agent"],
				deviceInfo: this.parseDeviceInfo(req),
				isSystemGenerated: !actorId,
				searchText: this.buildSearchText(eventType, eventData),
				occurredAt: new Date(),
			});
		} catch (error) {
			// Log to error tracking but don't fail the main operation
			console.error("[CancellationAudit] Failed to log event:", error);
		}
	}

	/**
	 * Get complete audit trail for an appointment
	 */
	static async getAuditTrail(appointmentId, options = {}) {
		const { CancellationAuditLog, User } = require("../models");
		const { Op } = require("sequelize");

		const { startDate, endDate, eventTypes, limit = 100 } = options;

		const where = { appointmentId };
		if (startDate) where.occurredAt = { [Op.gte]: startDate };
		if (endDate) where.occurredAt = { ...where.occurredAt, [Op.lte]: endDate };
		if (eventTypes) where.eventType = { [Op.in]: eventTypes };

		return CancellationAuditLog.findAll({
			where,
			order: [["occurredAt", "ASC"]],
			limit,
			include: [{
				model: User,
				as: "actor",
				attributes: ["id", "firstName", "lastName", "type"],
			}],
		});
	}

	/**
	 * Search across all audit logs
	 */
	static async search(query, filters = {}) {
		const { CancellationAuditLog, sequelize } = require("../models");
		const { Op } = require("sequelize");

		const { appointmentId, actorId, eventType, startDate, endDate, limit = 50 } = filters;

		const where = {};
		if (appointmentId) where.appointmentId = appointmentId;
		if (actorId) where.actorId = actorId;
		if (eventType) where.eventType = eventType;
		if (startDate || endDate) {
			where.occurredAt = {};
			if (startDate) where.occurredAt[Op.gte] = startDate;
			if (endDate) where.occurredAt[Op.lte] = endDate;
		}

		if (query) {
			where[Op.or] = [
				{ searchText: { [Op.iLike]: `%${query}%` } },
				sequelize.literal(`"eventData"::text ILIKE '%${query.replace(/'/g, "''")}%'`),
			];
		}

		return CancellationAuditLog.findAll({
			where,
			order: [["occurredAt", "DESC"]],
			limit,
		});
	}

	/**
	 * Export for compliance/legal
	 */
	static async exportAuditTrail(appointmentId, format = "json") {
		const trail = await this.getAuditTrail(appointmentId, { limit: 10000 });

		if (format === "csv") {
			return this.convertToCsv(trail);
		}
		return trail;
	}

	/**
	 * Build searchable text summary
	 */
	static buildSearchText(eventType, eventData) {
		const parts = [eventType.replace(/_/g, " ")];
		if (eventData?.amount) parts.push(`$${(eventData.amount / 100).toFixed(2)}`);
		if (eventData?.reason) parts.push(eventData.reason);
		if (eventData?.stripeId) parts.push(eventData.stripeId);
		if (eventData?.confirmationId) parts.push(eventData.confirmationId);
		return parts.join(" ");
	}

	/**
	 * Get client IP from request
	 */
	static getClientIp(req) {
		if (!req) return null;
		return req.headers?.["x-forwarded-for"]?.split(",")[0]?.trim() ||
			req.headers?.["x-real-ip"] ||
			req.connection?.remoteAddress ||
			req.ip;
	}

	/**
	 * Parse device info from request
	 */
	static parseDeviceInfo(req) {
		if (!req) return null;
		const ua = req.headers?.["user-agent"] || "";
		const appVersion = req.headers?.["x-app-version"];
		const platform = req.headers?.["x-platform"];

		return {
			platform: platform || (ua.includes("Android") ? "android" : ua.includes("iPhone") ? "ios" : "web"),
			appVersion,
			userAgent: ua.substring(0, 200),
		};
	}

	/**
	 * Convert audit trail to CSV
	 */
	static convertToCsv(trail) {
		const headers = [
			"ID",
			"Timestamp",
			"Event Type",
			"Actor ID",
			"Actor Type",
			"Event Data",
			"Request ID",
			"IP Address",
		];

		const rows = trail.map(entry => [
			entry.id,
			entry.occurredAt.toISOString(),
			entry.eventType,
			entry.actorId || "system",
			entry.actorType,
			JSON.stringify(entry.eventData),
			entry.requestId || "",
			entry.ipAddress || "",
		]);

		const csvContent = [
			headers.join(","),
			...rows.map(row => row.map(cell =>
				typeof cell === "string" ? `"${cell.replace(/"/g, '""')}"` : cell
			).join(",")),
		].join("\n");

		return csvContent;
	}

	// =====================
	// Convenience methods for specific events
	// =====================

	/**
	 * Log cancellation info requested
	 */
	static async logCancellationInfoRequested(appointmentId, userId, userType, req) {
		return this.log({
			appointmentId,
			eventType: "cancellation_info_requested",
			actorId: userId,
			actorType: userType,
			eventData: {},
			req,
		});
	}

	/**
	 * Log cancellation initiated
	 */
	static async logCancellationInitiated(appointmentId, userId, userType, details, req) {
		return this.log({
			appointmentId,
			eventType: "cancellation_initiated",
			actorId: userId,
			actorType: userType,
			eventData: {
				reason: details.reason,
				daysUntilAppointment: details.daysUntilAppointment,
				withinPenaltyWindow: details.withinPenaltyWindow,
				withinFeeWindow: details.withinFeeWindow,
			},
			req,
		});
	}

	/**
	 * Log cancellation confirmed
	 */
	static async logCancellationConfirmed(appointmentId, userId, userType, details, req) {
		return this.log({
			appointmentId,
			eventType: "cancellation_confirmed",
			actorId: userId,
			actorType: userType,
			eventData: {
				confirmationId: details.confirmationId,
				refundAmount: details.refundAmount,
				cancellationFee: details.cancellationFee,
				cleanerPayout: details.cleanerPayout,
			},
			previousState: details.previousState,
			newState: details.newState,
			req,
		});
	}

	/**
	 * Log fee charge attempt
	 */
	static async logFeeChargeAttempted(appointmentId, amount, stripePaymentMethod, req) {
		return this.log({
			appointmentId,
			eventType: "fee_charge_attempted",
			eventData: {
				amount,
				stripePaymentMethod,
			},
			req,
		});
	}

	/**
	 * Log fee charge success
	 */
	static async logFeeChargeSucceeded(appointmentId, amount, stripeChargeId, req) {
		return this.log({
			appointmentId,
			eventType: "fee_charge_succeeded",
			eventData: {
				amount,
				stripeId: stripeChargeId,
			},
			req,
		});
	}

	/**
	 * Log fee charge failure
	 */
	static async logFeeChargeFailed(appointmentId, amount, error, req) {
		return this.log({
			appointmentId,
			eventType: "fee_charge_failed",
			eventData: {
				amount,
				error: error.message || error,
			},
			req,
		});
	}

	/**
	 * Log fee added to bill
	 */
	static async logFeeAddedToBill(appointmentId, amount, req) {
		return this.log({
			appointmentId,
			eventType: "fee_added_to_bill",
			eventData: { amount },
			req,
		});
	}

	/**
	 * Log refund initiated
	 */
	static async logRefundInitiated(appointmentId, amount, stripeRefundId, req) {
		return this.log({
			appointmentId,
			eventType: "refund_initiated",
			eventData: {
				amount,
				stripeId: stripeRefundId,
			},
			req,
		});
	}

	/**
	 * Log refund completed
	 */
	static async logRefundCompleted(appointmentId, amount, stripeRefundId, req) {
		return this.log({
			appointmentId,
			eventType: "refund_completed",
			eventData: {
				amount,
				stripeId: stripeRefundId,
			},
			req,
		});
	}

	/**
	 * Log payout created
	 */
	static async logPayoutCreated(appointmentId, cleanerId, amount, req) {
		return this.log({
			appointmentId,
			eventType: "payout_created",
			eventData: {
				cleanerId,
				amount,
			},
			req,
		});
	}

	/**
	 * Log appeal submitted
	 */
	static async logAppealSubmitted(appointmentId, appealId, appealerId, details, req) {
		return this.log({
			appointmentId,
			appealId,
			eventType: "appeal_submitted",
			actorId: appealerId,
			actorType: details.appealerType,
			eventData: {
				category: details.category,
				severity: details.severity,
				contestingItems: details.contestingItems,
			},
			req,
		});
	}

	/**
	 * Log appeal assigned
	 */
	static async logAppealAssigned(appointmentId, appealId, assigneeId, assignerId, req) {
		return this.log({
			appointmentId,
			appealId,
			eventType: "appeal_assigned",
			actorId: assignerId,
			actorType: "hr",
			eventData: { assigneeId },
			req,
		});
	}

	/**
	 * Log appeal status changed
	 */
	static async logAppealStatusChanged(appointmentId, appealId, reviewerId, previousStatus, newStatus, notes, req) {
		return this.log({
			appointmentId,
			appealId,
			eventType: "appeal_status_changed",
			actorId: reviewerId,
			actorType: "hr",
			eventData: { notes },
			previousState: { status: previousStatus },
			newState: { status: newStatus },
			req,
		});
	}

	/**
	 * Log appeal resolved
	 */
	static async logAppealResolved(appointmentId, appealId, reviewerId, decision, resolution, req) {
		return this.log({
			appointmentId,
			appealId,
			eventType: "appeal_resolved",
			actorId: reviewerId,
			actorType: "hr",
			eventData: {
				decision,
				resolution,
			},
			req,
		});
	}

	/**
	 * Log notification sent
	 */
	static async logNotificationSent(appointmentId, notificationType, recipientId, success, req) {
		const eventType = notificationType === "email" ? "notification_sent_email" :
			notificationType === "push" ? "notification_sent_push" : "notification_sent_sms";

		return this.log({
			appointmentId,
			eventType,
			eventData: {
				recipientId,
				success,
			},
			req,
		});
	}
}

module.exports = CancellationAuditService;
