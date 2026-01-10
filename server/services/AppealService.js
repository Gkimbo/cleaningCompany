/**
 * AppealService
 *
 * Handles the cancellation appeal workflow including submission,
 * assignment, review, and resolution with scrutiny tracking.
 */

const moment = require("moment");
const CancellationAuditService = require("./CancellationAuditService");
const JobLedgerService = require("./JobLedgerService");

// SLA Constants
const SLA_HOURS = 48;
const APPEAL_WINDOW_HOURS = 72;

class AppealService {
	/**
	 * Submit a new appeal
	 */
	static async submitAppeal(options) {
		const { CancellationAppeal, UserAppointments, User, sequelize } = require("../models");

		const {
			appointmentId,
			appealerId,
			appealerType,
			category,
			severity,
			description,
			contestingItems,
			requestedRelief,
			req,
		} = options;

		const transaction = await sequelize.transaction();

		try {
			// Verify appointment exists and is cancelled
			const appointment = await UserAppointments.findByPk(appointmentId, { transaction });
			if (!appointment) {
				throw new Error("Appointment not found");
			}
			if (!appointment.wasCancelled) {
				throw new Error("Appointment was not cancelled");
			}

			// Check appeal window
			if (appointment.appealWindowExpiresAt && new Date() > new Date(appointment.appealWindowExpiresAt)) {
				throw new Error("Appeal window has expired");
			}

			// Check for existing open appeal
			const existingAppeal = await CancellationAppeal.findOne({
				where: {
					appointmentId,
					status: ["submitted", "under_review", "awaiting_documents", "escalated"],
				},
				transaction,
			});
			if (existingAppeal) {
				throw new Error("An appeal is already pending for this appointment");
			}

			// Get user's scrutiny level
			const appealer = await User.findByPk(appealerId, { transaction });
			const scrutinyLevel = appealer?.appealScrutinyLevel || "none";

			// Set priority based on scrutiny and severity
			const priority = this.determinePriority(scrutinyLevel, severity);

			// Create appeal
			const appeal = await CancellationAppeal.create({
				appointmentId,
				appealerId,
				appealerType,
				category,
				severity: severity || "medium",
				description,
				contestingItems: contestingItems || {},
				originalPenaltyAmount: appointment.cancellationFeeCharged,
				originalRefundWithheld: appointment.refundWithheld,
				requestedRelief,
				status: "submitted",
				priority,
				slaDeadline: moment().add(SLA_HOURS, "hours").toDate(),
				submittedAt: new Date(),
				lastActivityAt: new Date(),
			}, { transaction });

			// Update appointment
			await appointment.update({
				hasActiveAppeal: true,
				appealId: appeal.id,
			}, { transaction });

			// Update user appeal stats
			await this.updateUserAppealStats(appealerId, "submitted", transaction);

			// Auto-assign if workload allows
			const assignee = await this.autoAssign(appeal.id, transaction);

			await transaction.commit();

			// Log audit event (async, don't wait)
			CancellationAuditService.logAppealSubmitted(
				appointmentId,
				appeal.id,
				appealerId,
				{ appealerType, category, severity, contestingItems },
				req
			);

			return {
				success: true,
				appeal,
				assignedTo: assignee?.id,
				slaDeadline: appeal.slaDeadline,
				scrutinyLevel,
			};

		} catch (error) {
			await transaction.rollback();
			throw error;
		}
	}

	/**
	 * Assign appeal to a reviewer
	 */
	static async assignAppeal(appealId, assigneeId, assignerId, req) {
		const { CancellationAppeal, User } = require("../models");

		const appeal = await CancellationAppeal.findByPk(appealId);
		if (!appeal) {
			throw new Error("Appeal not found");
		}

		if (appeal.isClosed()) {
			throw new Error("Cannot assign a closed appeal");
		}

		const assignee = await User.findByPk(assigneeId);
		if (!assignee || !["hr", "owner"].includes(assignee.type)) {
			throw new Error("Invalid assignee - must be HR or Owner");
		}

		await appeal.update({
			assignedTo: assigneeId,
			assignedAt: new Date(),
			lastActivityAt: new Date(),
			status: appeal.status === "submitted" ? "under_review" : appeal.status,
		});

		// Log audit event
		CancellationAuditService.logAppealAssigned(
			appeal.appointmentId,
			appealId,
			assigneeId,
			assignerId,
			req
		);

		return appeal;
	}

	/**
	 * Auto-assign appeal based on workload
	 */
	static async autoAssign(appealId, transaction = null) {
		const { CancellationAppeal, User, sequelize } = require("../models");

		// Get HR users with their current workload
		const hrUsers = await User.findAll({
			where: { type: "hr", isActive: true },
			attributes: ["id", "firstName", "lastName"],
			transaction,
		});

		if (hrUsers.length === 0) return null;

		// Get workload for each HR user
		const workloads = await Promise.all(hrUsers.map(async (hr) => {
			const count = await CancellationAppeal.count({
				where: {
					assignedTo: hr.id,
					status: ["under_review", "awaiting_documents"],
				},
				transaction,
			});
			return { user: hr, count };
		}));

		// Assign to user with lowest workload
		workloads.sort((a, b) => a.count - b.count);
		const assignee = workloads[0]?.user;

		if (assignee) {
			await CancellationAppeal.update(
				{
					assignedTo: assignee.id,
					assignedAt: new Date(),
					status: "under_review",
				},
				{
					where: { id: appealId },
					transaction,
				}
			);
		}

		return assignee;
	}

	/**
	 * Update appeal status
	 */
	static async updateStatus(appealId, newStatus, reviewerId, notes, req) {
		const { CancellationAppeal } = require("../models");

		const appeal = await CancellationAppeal.findByPk(appealId);
		if (!appeal) {
			throw new Error("Appeal not found");
		}

		const previousStatus = appeal.status;

		// Validate status transition
		if (!this.isValidStatusTransition(previousStatus, newStatus)) {
			throw new Error(`Invalid status transition from ${previousStatus} to ${newStatus}`);
		}

		const updateData = {
			status: newStatus,
			lastActivityAt: new Date(),
		};

		if (newStatus === "escalated") {
			updateData.escalatedAt = new Date();
			updateData.escalationReason = notes;
		}

		await appeal.update(updateData);

		// Log audit event
		CancellationAuditService.logAppealStatusChanged(
			appeal.appointmentId,
			appealId,
			reviewerId,
			previousStatus,
			newStatus,
			notes,
			req
		);

		return appeal;
	}

	/**
	 * Resolve appeal with decision
	 */
	static async resolveAppeal(appealId, decision, resolution, reviewerId, req) {
		const { CancellationAppeal, UserAppointments, User, sequelize } = require("../models");

		const transaction = await sequelize.transaction();

		try {
			const appeal = await CancellationAppeal.findByPk(appealId, {
				include: [{ model: UserAppointments, as: "appointment" }],
				transaction,
			});

			if (!appeal) {
				throw new Error("Appeal not found");
			}

			if (appeal.isClosed()) {
				throw new Error("Appeal is already closed");
			}

			// Determine final status
			const status = decision === "approve" ? "approved" :
				decision === "partial" ? "partially_approved" : "denied";

			// Update appeal
			await appeal.update({
				status,
				reviewedBy: reviewerId,
				reviewedAt: new Date(),
				reviewDecision: resolution.notes,
				resolution: resolution.actions || {},
				resolutionNotes: resolution.notes,
				closedAt: new Date(),
				lastActivityAt: new Date(),
			}, { transaction });

			// Update appointment
			await UserAppointments.update(
				{ hasActiveAppeal: false },
				{ where: { id: appeal.appointmentId }, transaction }
			);

			// Update user appeal stats
			await this.updateUserAppealStats(appeal.appealerId, status, transaction);

			// Process resolution actions
			if (status === "approved" || status === "partially_approved") {
				await this.processResolutionActions(appeal, resolution.actions, transaction);
			}

			// Update scrutiny level based on outcome
			await this.updateScrutinyLevel(appeal.appealerId, transaction);

			await transaction.commit();

			// Log audit event
			CancellationAuditService.logAppealResolved(
				appeal.appointmentId,
				appealId,
				reviewerId,
				decision,
				resolution,
				req
			);

			return appeal;

		} catch (error) {
			await transaction.rollback();
			throw error;
		}
	}

	/**
	 * Process resolution actions (refunds, fee reversals, etc.)
	 */
	static async processResolutionActions(appeal, actions, transaction) {
		const { UserAppointments, User } = require("../models");
		const Stripe = require("stripe");
		const stripe = Stripe(process.env.STRIPE_SECRET_KEY);

		const stripeDetails = {};
		const appointment = appeal.appointment;
		const homeownerId = appointment.userId;

		// Process refund
		if (actions.refundAmount > 0 && appointment.paymentIntentId) {
			try {
				const refund = await stripe.refunds.create({
					payment_intent: appointment.paymentIntentId,
					amount: actions.refundAmount,
					reason: "requested_by_customer",
				});
				stripeDetails.refundId = refund.id;
			} catch (error) {
				console.error("[AppealService] Refund failed:", error);
			}
		}

		// Process fee reversal
		if (actions.feeRefunded && actions.feeAmount > 0) {
			// If fee was charged separately, refund it
			if (appointment.cancellationFeeChargeId) {
				try {
					const refund = await stripe.refunds.create({
						charge: appointment.cancellationFeeChargeId,
						amount: actions.feeAmount,
					});
					stripeDetails.feeRefundId = refund.id;
				} catch (error) {
					console.error("[AppealService] Fee refund failed:", error);
				}
			}
			// If fee was added to bill, remove it
			else {
				const user = await User.findByPk(homeownerId, { transaction });
				if (user && user.outstandingBalance) {
					const newBalance = Math.max(0, user.outstandingBalance - actions.feeAmount);
					await user.update({ outstandingBalance: newBalance }, { transaction });
				}
			}
		}

		// Remove penalty rating
		if (actions.ratingRemoved) {
			// Implementation depends on rating system
			// This would remove any penalty ratings applied due to cancellation
		}

		// Unfreeze account
		if (actions.accountUnfrozen) {
			const user = await User.findByPk(appeal.appealerId, { transaction });
			if (user && user.isFrozen) {
				await user.update({
					isFrozen: false,
					frozenReason: null,
					unfrozenAt: new Date(),
				}, { transaction });
			}
		}

		// Record in ledger
		if (actions.refundAmount > 0 || actions.feeAmount > 0) {
			await JobLedgerService.recordAppealResolution(
				appeal.appointmentId,
				appeal.id,
				{
					homeownerId,
					refundAmount: actions.refundAmount || 0,
					feeReversal: actions.feeAmount || 0,
					stripeDetails,
				},
				transaction
			);
		}
	}

	/**
	 * Update user appeal statistics
	 */
	static async updateUserAppealStats(userId, outcomeOrAction, transaction) {
		const { User, CancellationAppeal } = require("../models");
		const { Op } = require("sequelize");

		const user = await User.findByPk(userId, { transaction });
		if (!user) return;

		// Count appeals by status
		const [total, approved, denied, pending] = await Promise.all([
			CancellationAppeal.count({ where: { appealerId: userId }, transaction }),
			CancellationAppeal.count({ where: { appealerId: userId, status: ["approved", "partially_approved"] }, transaction }),
			CancellationAppeal.count({ where: { appealerId: userId, status: "denied" }, transaction }),
			CancellationAppeal.count({ where: { appealerId: userId, status: ["submitted", "under_review", "awaiting_documents", "escalated"] }, transaction }),
		]);

		const approvalRate = total > 0 ? Math.round((approved / total) * 100) : null;

		// Count by category
		const categoryResults = await CancellationAppeal.findAll({
			attributes: [
				"category",
				[require("../models").sequelize.fn("COUNT", require("../models").sequelize.col("id")), "count"],
			],
			where: { appealerId: userId },
			group: ["category"],
			transaction,
		});
		const categoryCounts = {};
		categoryResults.forEach(r => {
			categoryCounts[r.category] = parseInt(r.dataValues.count);
		});

		await user.update({
			appealStats: { total, approved, denied, pending },
			lastAppealDate: outcomeOrAction === "submitted" ? new Date() : user.lastAppealDate,
			appealPatterns: {
				categoryCounts,
				approvalRate,
				avgDaysBetweenAppeals: await this.calculateAvgDaysBetweenAppeals(userId, transaction),
			},
		}, { transaction });
	}

	/**
	 * Calculate average days between appeals
	 */
	static async calculateAvgDaysBetweenAppeals(userId, transaction) {
		const { CancellationAppeal } = require("../models");

		const appeals = await CancellationAppeal.findAll({
			where: { appealerId: userId },
			attributes: ["submittedAt"],
			order: [["submittedAt", "ASC"]],
			transaction,
		});

		if (appeals.length < 2) return null;

		let totalDays = 0;
		for (let i = 1; i < appeals.length; i++) {
			const days = moment(appeals[i].submittedAt).diff(moment(appeals[i - 1].submittedAt), "days");
			totalDays += days;
		}

		return Math.round(totalDays / (appeals.length - 1));
	}

	/**
	 * Update user's scrutiny level based on appeal patterns
	 */
	static async updateScrutinyLevel(userId, transaction) {
		const { User, CancellationAppeal } = require("../models");
		const { Op } = require("sequelize");

		const user = await User.findByPk(userId, { transaction });
		if (!user) return;

		const sixMonthsAgo = moment().subtract(6, "months").toDate();

		const [recentAppeals, deniedAppeals] = await Promise.all([
			CancellationAppeal.count({
				where: { appealerId: userId, submittedAt: { [Op.gte]: sixMonthsAgo } },
				transaction,
			}),
			CancellationAppeal.count({
				where: { appealerId: userId, status: "denied", submittedAt: { [Op.gte]: sixMonthsAgo } },
				transaction,
			}),
		]);

		let scrutinyLevel = "none";
		let reason = null;

		if (recentAppeals >= 5 || deniedAppeals >= 3) {
			scrutinyLevel = "high_risk";
			reason = `${recentAppeals} appeals in 6 months, ${deniedAppeals} denied`;
		} else if (recentAppeals >= 3 || deniedAppeals >= 2) {
			scrutinyLevel = "watch";
			reason = `${recentAppeals} appeals in 6 months`;
		}

		await user.update({
			appealScrutinyLevel: scrutinyLevel,
			appealScrutinyReason: reason,
			appealScrutinySetAt: scrutinyLevel !== "none" ? new Date() : null,
		}, { transaction });
	}

	/**
	 * Determine priority based on scrutiny level and severity
	 */
	static determinePriority(scrutinyLevel, severity) {
		if (scrutinyLevel === "high_risk") return "high";
		if (severity === "critical") return "urgent";
		if (severity === "high" || scrutinyLevel === "watch") return "high";
		return "normal";
	}

	/**
	 * Validate status transition
	 */
	static isValidStatusTransition(from, to) {
		const validTransitions = {
			submitted: ["under_review", "awaiting_documents", "escalated", "denied"],
			under_review: ["awaiting_documents", "escalated", "approved", "partially_approved", "denied"],
			awaiting_documents: ["under_review", "escalated", "approved", "partially_approved", "denied"],
			escalated: ["under_review", "approved", "partially_approved", "denied"],
		};

		return validTransitions[from]?.includes(to) || false;
	}

	/**
	 * Get appeal queue for HR/Owner dashboard
	 */
	static async getQueue(options = {}) {
		const { CancellationAppeal, UserAppointments, User } = require("../models");

		const { status, priority, assignedTo, limit = 50, offset = 0 } = options;
		const where = {};

		if (status) {
			where.status = status;
		} else {
			where.status = ["submitted", "under_review", "awaiting_documents", "escalated"];
		}
		if (priority) where.priority = priority;
		if (assignedTo) where.assignedTo = assignedTo;

		return CancellationAppeal.findAndCountAll({
			where,
			include: [
				{ model: UserAppointments, as: "appointment", attributes: ["id", "date", "userId"] },
				{ model: User, as: "appealer", attributes: ["id", "firstName", "lastName", "email", "appealScrutinyLevel"] },
				{ model: User, as: "assignee", attributes: ["id", "firstName", "lastName"] },
			],
			order: [
				["priority", "DESC"],
				["slaDeadline", "ASC"],
				["submittedAt", "ASC"],
			],
			limit,
			offset,
		});
	}

	/**
	 * Get SLA breach alerts
	 */
	static async getSLABreaches() {
		const { CancellationAppeal, User } = require("../models");
		const { Op } = require("sequelize");

		return CancellationAppeal.findAll({
			where: {
				status: ["submitted", "under_review", "awaiting_documents"],
				slaDeadline: { [Op.lt]: new Date() },
			},
			include: [
				{ model: User, as: "appealer", attributes: ["id", "firstName", "lastName", "email"] },
				{ model: User, as: "assignee", attributes: ["id", "firstName", "lastName"] },
			],
			order: [["slaDeadline", "ASC"]],
		});
	}

	/**
	 * Get dashboard stats
	 */
	static async getStats() {
		const { CancellationAppeal } = require("../models");
		const { Op } = require("sequelize");

		const [total, pending, pastSLA, byStatus, byPriority] = await Promise.all([
			CancellationAppeal.count(),
			CancellationAppeal.count({
				where: { status: ["submitted", "under_review", "awaiting_documents", "escalated"] },
			}),
			CancellationAppeal.count({
				where: {
					status: ["submitted", "under_review", "awaiting_documents"],
					slaDeadline: { [Op.lt]: new Date() },
				},
			}),
			CancellationAppeal.findAll({
				attributes: [
					"status",
					[require("../models").sequelize.fn("COUNT", require("../models").sequelize.col("id")), "count"],
				],
				group: ["status"],
			}),
			CancellationAppeal.findAll({
				attributes: [
					"priority",
					[require("../models").sequelize.fn("COUNT", require("../models").sequelize.col("id")), "count"],
				],
				where: { status: ["submitted", "under_review", "awaiting_documents", "escalated"] },
				group: ["priority"],
			}),
		]);

		return {
			total,
			pending,
			pastSLA,
			byStatus: byStatus.reduce((acc, r) => ({ ...acc, [r.status]: parseInt(r.dataValues.count) }), {}),
			byPriority: byPriority.reduce((acc, r) => ({ ...acc, [r.priority]: parseInt(r.dataValues.count) }), {}),
		};
	}

	/**
	 * Get user's appeal history (for HR/Owner view)
	 */
	static async getUserAppealHistory(userId) {
		const { CancellationAppeal, UserAppointments, User } = require("../models");

		const user = await User.findByPk(userId, {
			attributes: ["id", "firstName", "lastName", "email", "type", "appealStats", "appealScrutinyLevel", "appealScrutinyReason", "appealPatterns"],
		});

		if (!user) {
			throw new Error("User not found");
		}

		const appeals = await CancellationAppeal.findAll({
			where: { appealerId: userId },
			include: [
				{ model: UserAppointments, as: "appointment", attributes: ["id", "date"] },
				{ model: User, as: "reviewer", attributes: ["id", "firstName", "lastName"] },
			],
			order: [["submittedAt", "DESC"]],
		});

		return {
			user: {
				id: user.id,
				name: `${user.firstName} ${user.lastName}`,
				email: user.email,
				type: user.type,
				appealStats: user.appealStats,
				scrutinyLevel: user.appealScrutinyLevel,
				scrutinyReason: user.appealScrutinyReason,
				patterns: user.appealPatterns,
			},
			appeals: appeals.map(appeal => ({
				id: appeal.id,
				appointmentId: appeal.appointmentId,
				category: appeal.category,
				severity: appeal.severity,
				status: appeal.status,
				priority: appeal.priority,
				description: appeal.description,
				contestingItems: appeal.contestingItems,
				requestedRelief: appeal.requestedRelief,
				resolution: appeal.resolution,
				resolutionNotes: appeal.resolutionNotes,
				originalPenaltyAmount: appeal.originalPenaltyAmount,
				originalRefundWithheld: appeal.originalRefundWithheld,
				submittedAt: appeal.submittedAt?.toISOString() || null,
				slaDeadline: appeal.slaDeadline?.toISOString() || null,
				reviewedAt: appeal.reviewedAt?.toISOString() || null,
				closedAt: appeal.closedAt?.toISOString() || null,
				appointment: appeal.appointment ? {
					id: appeal.appointment.id,
					date: appeal.appointment.date?.toISOString() || null,
				} : null,
				reviewer: appeal.reviewer ? {
					id: appeal.reviewer.id,
					name: `${appeal.reviewer.firstName} ${appeal.reviewer.lastName}`,
				} : null,
			})),
			summary: {
				totalAppeals: appeals.length,
				approved: appeals.filter(a => ["approved", "partially_approved"].includes(a.status)).length,
				denied: appeals.filter(a => a.status === "denied").length,
				pending: appeals.filter(a => a.isOpen()).length,
			},
		};
	}
}

module.exports = AppealService;
