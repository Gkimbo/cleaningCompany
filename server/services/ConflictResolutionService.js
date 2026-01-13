/**
 * ConflictResolutionService
 *
 * Unified service for handling conflict resolution across both
 * HomeSizeAdjustment disputes and CancellationAppeals.
 * Provides comprehensive case management with full appointment context.
 */

const moment = require("moment");
const CancellationAuditService = require("./CancellationAuditService");
const JobLedgerService = require("./JobLedgerService");
const AnalyticsService = require("./AnalyticsService");
const Stripe = require("stripe");

class ConflictResolutionService {
	/**
	 * Get unified conflict queue combining appeals and adjustment disputes
	 */
	static async getConflictQueue(options = {}) {
		const {
			CancellationAppeal,
			HomeSizeAdjustmentRequest,
			UserAppointments,
			User,
		} = require("../models");

		const {
			caseType,
			status,
			priority,
			assignedTo,
			search,
			limit = 50,
			offset = 0,
		} = options;

		const results = [];

		// Get appeals if not filtered to adjustments only
		if (!caseType || caseType === "appeal") {
			const appealWhere = {};
			if (status) {
				appealWhere.status = status;
			} else {
				appealWhere.status = ["submitted", "under_review", "awaiting_documents", "escalated"];
			}
			if (priority) appealWhere.priority = priority;
			if (assignedTo) appealWhere.assignedTo = assignedTo;

			const appeals = await CancellationAppeal.findAll({
				where: appealWhere,
				include: [
					{
						model: UserAppointments,
						as: "appointment",
						attributes: ["id", "date", "userId", "price"],
						include: [
							{ model: User, as: "cleaner", attributes: ["id", "firstName", "lastName", "email", "phone"] },
						],
					},
					{ model: User, as: "appealer", attributes: ["id", "firstName", "lastName", "email", "phone", "type", "appealScrutinyLevel"] },
					{ model: User, as: "assignee", attributes: ["id", "firstName", "lastName"] },
				],
				order: [
					["priority", "DESC"],
					["slaDeadline", "ASC"],
					["submittedAt", "ASC"],
				],
			});

			appeals.forEach(appeal => {
				results.push({
					id: appeal.id,
					caseType: "appeal",
					caseNumber: `APL-${appeal.id.toString().padStart(6, "0")}`,
					appointmentId: appeal.appointmentId,
					appointmentDate: appeal.appointment?.date?.toISOString() || null,
					status: appeal.status,
					priority: appeal.priority,
					category: appeal.category,
					severity: appeal.severity,
					description: appeal.description,
					submittedAt: appeal.submittedAt?.toISOString() || null,
					slaDeadline: appeal.slaDeadline?.toISOString() || null,
					isPastSLA: appeal.isPastSLA?.() || false,
					timeUntilSLA: appeal.getTimeUntilSLA?.() || null,
					homeowner: appeal.appealer?.type === "homeowner" ? {
						id: appeal.appealer.id,
						name: `${appeal.appealer.firstName} ${appeal.appealer.lastName}`,
						email: appeal.appealer.email,
						phone: appeal.appealer.phone,
						scrutinyLevel: appeal.appealer.appealScrutinyLevel,
					} : null,
					cleaner: appeal.appealer?.type === "cleaner" ? {
						id: appeal.appealer.id,
						name: `${appeal.appealer.firstName} ${appeal.appealer.lastName}`,
						email: appeal.appealer.email,
						phone: appeal.appealer.phone,
					} : (appeal.appointment?.cleaner ? {
						id: appeal.appointment.cleaner.id,
						name: `${appeal.appointment.cleaner.firstName} ${appeal.appointment.cleaner.lastName}`,
						email: appeal.appointment.cleaner.email,
						phone: appeal.appointment.cleaner.phone,
					} : null),
					assignedTo: appeal.assignee ? {
						id: appeal.assignee.id,
						name: `${appeal.assignee.firstName} ${appeal.assignee.lastName}`,
					} : null,
					financialImpact: {
						penaltyAmount: appeal.originalPenaltyAmount,
						refundWithheld: appeal.originalRefundWithheld,
					},
				});
			});
		}

		// Get adjustment disputes if not filtered to appeals only
		if (!caseType || caseType === "adjustment") {
			const adjustmentWhere = {};
			if (status) {
				// Map generic statuses to adjustment-specific ones
				const statusMap = {
					pending: ["pending_homeowner", "pending_owner"],
					approved: ["approved", "owner_approved"],
					denied: ["denied", "owner_denied"],
				};
				adjustmentWhere.status = statusMap[status] || status;
			} else {
				adjustmentWhere.status = ["pending_homeowner", "pending_owner"];
			}

			const adjustments = await HomeSizeAdjustmentRequest.findAll({
				where: adjustmentWhere,
				include: [
					{
						model: UserAppointments,
						as: "appointment",
						attributes: ["id", "date", "userId", "price"],
					},
					{ model: User, as: "cleaner", attributes: ["id", "firstName", "lastName", "email", "phone"] },
					{ model: User, as: "homeowner", attributes: ["id", "firstName", "lastName", "email", "phone"] },
					{ model: User, as: "owner", attributes: ["id", "firstName", "lastName"] },
				],
				order: [
					["expiresAt", "ASC"],
					["createdAt", "ASC"],
				],
			});

			adjustments.forEach(adj => {
				const isPastExpiry = adj.expiresAt && new Date() > new Date(adj.expiresAt);
				results.push({
					id: adj.id,
					caseType: "adjustment",
					caseNumber: `ADJ-${adj.id.toString().padStart(6, "0")}`,
					appointmentId: adj.appointmentId,
					appointmentDate: adj.appointment?.date?.toISOString() || null,
					status: adj.status,
					priority: isPastExpiry ? "urgent" : "normal",
					category: "home_size_adjustment",
					severity: "medium",
					description: adj.cleanerNote || "Home size discrepancy reported",
					submittedAt: adj.createdAt?.toISOString() || null,
					slaDeadline: adj.expiresAt?.toISOString() || null,
					isPastSLA: isPastExpiry,
					timeUntilSLA: adj.expiresAt ? Math.max(0, Math.floor((new Date(adj.expiresAt).getTime() - Date.now()) / 1000)) : null,
					homeowner: adj.homeowner ? {
						id: adj.homeowner.id,
						name: `${adj.homeowner.firstName} ${adj.homeowner.lastName}`,
						email: adj.homeowner.email,
						phone: adj.homeowner.phone,
					} : null,
					cleaner: adj.cleaner ? {
						id: adj.cleaner.id,
						name: `${adj.cleaner.firstName} ${adj.cleaner.lastName}`,
						email: adj.cleaner.email,
						phone: adj.cleaner.phone,
					} : null,
					assignedTo: adj.owner ? {
						id: adj.owner.id,
						name: `${adj.owner.firstName} ${adj.owner.lastName}`,
					} : null,
					financialImpact: {
						originalPrice: parseFloat(adj.originalPrice) * 100,
						newPrice: parseFloat(adj.calculatedNewPrice) * 100,
						priceDifference: parseFloat(adj.priceDifference) * 100,
					},
				});
			});
		}

		// Sort combined results by priority and SLA
		results.sort((a, b) => {
			const priorityOrder = { urgent: 0, high: 1, normal: 2 };
			if (priorityOrder[a.priority] !== priorityOrder[b.priority]) {
				return priorityOrder[a.priority] - priorityOrder[b.priority];
			}
			if (a.isPastSLA !== b.isPastSLA) {
				return a.isPastSLA ? -1 : 1;
			}
			return new Date(a.slaDeadline || 0) - new Date(b.slaDeadline || 0);
		});

		// Apply search filter
		let filtered = results;
		if (search) {
			const searchLower = search.toLowerCase();
			filtered = results.filter(r =>
				r.caseNumber.toLowerCase().includes(searchLower) ||
				r.homeowner?.name?.toLowerCase().includes(searchLower) ||
				r.cleaner?.name?.toLowerCase().includes(searchLower) ||
				r.description?.toLowerCase().includes(searchLower)
			);
		}

		// Apply pagination
		const total = filtered.length;
		const paginated = filtered.slice(offset, offset + limit);

		return {
			cases: paginated,
			total,
			limit,
			offset,
		};
	}

	/**
	 * Get full case details with all context
	 */
	static async getConflictCase(caseId, caseType) {
		if (caseType === "appeal") {
			return this.getAppealCase(caseId);
		} else if (caseType === "adjustment") {
			return this.getAdjustmentCase(caseId);
		}
		throw new Error("Invalid case type");
	}

	/**
	 * Get appeal case details
	 */
	static async getAppealCase(appealId) {
		const {
			CancellationAppeal,
			UserAppointments,
			User,
			UserHomes,
		} = require("../models");

		const appeal = await CancellationAppeal.findByPk(appealId, {
			include: [
				{
					model: UserAppointments,
					as: "appointment",
					include: [
						{ model: User, as: "cleaner", attributes: ["id", "firstName", "lastName", "email", "phone", "profileImage", "stripeAccountId"] },
						{ model: User, as: "user", attributes: ["id", "firstName", "lastName", "email", "phone", "profileImage", "stripeCustomerId"] },
						{ model: UserHomes, as: "home", attributes: ["id", "address", "numBeds", "numBaths", "homeSize"] },
					],
				},
				{ model: User, as: "appealer", attributes: ["id", "firstName", "lastName", "email", "phone", "type", "appealScrutinyLevel", "appealScrutinyReason", "appealStats", "appealPatterns"] },
				{ model: User, as: "assignee", attributes: ["id", "firstName", "lastName", "email"] },
				{ model: User, as: "reviewer", attributes: ["id", "firstName", "lastName"] },
			],
		});

		if (!appeal) {
			throw new Error("Appeal not found");
		}

		const appointment = appeal.appointment;
		const isHomeownerAppeal = appeal.appealerType === "homeowner";

		return {
			id: appeal.id,
			caseType: "appeal",
			caseNumber: `APL-${appeal.id.toString().padStart(6, "0")}`,

			// Status & Priority
			status: appeal.status,
			priority: appeal.priority,
			slaDeadline: appeal.slaDeadline?.toISOString() || null,
			isPastSLA: appeal.isPastSLA?.() || false,
			timeUntilSLA: appeal.getTimeUntilSLA?.() || null,

			// Appeal Details
			category: appeal.category,
			severity: appeal.severity,
			description: appeal.description,
			supportingDocuments: appeal.supportingDocuments || [],
			contestingItems: appeal.contestingItems || {},
			requestedRelief: appeal.requestedRelief,

			// Financial Impact
			financialImpact: {
				originalPenaltyAmount: appeal.originalPenaltyAmount,
				originalRefundWithheld: appeal.originalRefundWithheld,
			},

			// Resolution (if resolved)
			resolution: appeal.resolution || null,
			resolutionNotes: appeal.resolutionNotes,
			reviewDecision: appeal.reviewDecision,

			// Timestamps
			submittedAt: appeal.submittedAt?.toISOString() || null,
			assignedAt: appeal.assignedAt?.toISOString() || null,
			reviewedAt: appeal.reviewedAt?.toISOString() || null,
			closedAt: appeal.closedAt?.toISOString() || null,
			lastActivityAt: appeal.lastActivityAt?.toISOString() || null,
			escalatedAt: appeal.escalatedAt?.toISOString() || null,
			escalationReason: appeal.escalationReason,

			// Parties
			appellant: {
				id: appeal.appealer?.id,
				name: appeal.appealer ? `${appeal.appealer.firstName} ${appeal.appealer.lastName}` : null,
				email: appeal.appealer?.email,
				phone: appeal.appealer?.phone,
				type: appeal.appealerType,
				scrutinyLevel: appeal.appealer?.appealScrutinyLevel,
				scrutinyReason: appeal.appealer?.appealScrutinyReason,
				appealStats: appeal.appealer?.appealStats,
				appealPatterns: appeal.appealer?.appealPatterns,
			},
			homeowner: {
				id: appointment?.user?.id,
				name: appointment?.user ? `${appointment.user.firstName} ${appointment.user.lastName}` : null,
				email: appointment?.user?.email,
				phone: appointment?.user?.phone,
				profileImage: appointment?.user?.profileImage,
				stripeCustomerId: appointment?.user?.stripeCustomerId,
			},
			cleaner: {
				id: appointment?.cleaner?.id,
				name: appointment?.cleaner ? `${appointment.cleaner.firstName} ${appointment.cleaner.lastName}` : null,
				email: appointment?.cleaner?.email,
				phone: appointment?.cleaner?.phone,
				profileImage: appointment?.cleaner?.profileImage,
				stripeAccountId: appointment?.cleaner?.stripeAccountId,
			},
			assignedTo: appeal.assignee ? {
				id: appeal.assignee.id,
				name: `${appeal.assignee.firstName} ${appeal.assignee.lastName}`,
				email: appeal.assignee.email,
			} : null,
			reviewedBy: appeal.reviewer ? {
				id: appeal.reviewer.id,
				name: `${appeal.reviewer.firstName} ${appeal.reviewer.lastName}`,
			} : null,

			// Appointment Context
			appointment: appointment ? {
				id: appointment.id,
				date: appointment.date?.toISOString() || null,
				price: appointment.price,
				paymentIntentId: appointment.paymentIntentId,
				paymentStatus: appointment.paymentStatus,
				wasCancelled: appointment.wasCancelled,
				cancellationReason: appointment.cancellationReason,
				cancellationFeeCharged: appointment.cancellationFeeCharged,
				refundAmount: appointment.refundAmount,
				completionChecklistData: appointment.completionChecklistData,
				completionNotes: appointment.completionNotes,
				home: appointment.home ? {
					id: appointment.home.id,
					address: appointment.home.address,
					numBeds: appointment.home.numBeds,
					numBaths: appointment.home.numBaths,
					homeSize: appointment.home.homeSize,
				} : null,
			} : null,
		};
	}

	/**
	 * Get adjustment case details
	 */
	static async getAdjustmentCase(adjustmentId) {
		const {
			HomeSizeAdjustmentRequest,
			HomeSizeAdjustmentPhoto,
			UserAppointments,
			User,
			UserHomes,
		} = require("../models");

		const adjustment = await HomeSizeAdjustmentRequest.findByPk(adjustmentId, {
			include: [
				{
					model: UserAppointments,
					as: "appointment",
					include: [
						{ model: User, as: "cleaner", attributes: ["id", "firstName", "lastName", "email", "phone", "profileImage", "stripeAccountId"] },
						{ model: User, as: "user", attributes: ["id", "firstName", "lastName", "email", "phone", "profileImage", "stripeCustomerId"] },
						{ model: UserHomes, as: "home", attributes: ["id", "address", "numBeds", "numBaths", "homeSize"] },
					],
				},
				{ model: User, as: "cleaner", attributes: ["id", "firstName", "lastName", "email", "phone", "profileImage"] },
				{ model: User, as: "homeowner", attributes: ["id", "firstName", "lastName", "email", "phone", "profileImage", "stripeCustomerId"] },
				{ model: User, as: "owner", attributes: ["id", "firstName", "lastName", "email"] },
				{ model: HomeSizeAdjustmentPhoto, as: "photos" },
			],
		});

		if (!adjustment) {
			throw new Error("Adjustment request not found");
		}

		const appointment = adjustment.appointment;
		const isPastExpiry = adjustment.expiresAt && new Date() > new Date(adjustment.expiresAt);

		return {
			id: adjustment.id,
			caseType: "adjustment",
			caseNumber: `ADJ-${adjustment.id.toString().padStart(6, "0")}`,

			// Status & Priority
			status: adjustment.status,
			priority: isPastExpiry ? "urgent" : "normal",
			slaDeadline: adjustment.expiresAt?.toISOString() || null,
			isPastSLA: isPastExpiry,
			timeUntilSLA: adjustment.expiresAt ? Math.max(0, Math.floor((new Date(adjustment.expiresAt).getTime() - Date.now()) / 1000)) : null,

			// Adjustment Details
			category: "home_size_adjustment",
			severity: "medium",
			description: adjustment.cleanerNote || "Home size discrepancy reported",
			originalSize: {
				numBeds: adjustment.originalNumBeds,
				numBaths: adjustment.originalNumBaths,
			},
			reportedSize: {
				numBeds: adjustment.reportedNumBeds,
				numBaths: adjustment.reportedNumBaths,
			},

			// Financial Impact
			financialImpact: {
				originalPrice: parseFloat(adjustment.originalPrice) * 100,
				calculatedNewPrice: parseFloat(adjustment.calculatedNewPrice) * 100,
				priceDifference: parseFloat(adjustment.priceDifference) * 100,
				chargeStatus: adjustment.chargeStatus,
				chargePaymentIntentId: adjustment.chargePaymentIntentId,
			},

			// Responses
			cleanerNote: adjustment.cleanerNote,
			homeownerResponse: adjustment.homeownerResponse,
			ownerNote: adjustment.ownerNote,

			// Evidence photos
			evidencePhotos: adjustment.photos?.map(p => ({
				id: p.id,
				photoData: p.photoData,
				caption: p.caption,
				createdAt: p.createdAt?.toISOString() || null,
			})) || [],

			// Timestamps
			submittedAt: adjustment.createdAt?.toISOString() || null,
			homeownerRespondedAt: adjustment.homeownerRespondedAt?.toISOString() || null,
			ownerResolvedAt: adjustment.ownerResolvedAt?.toISOString() || null,
			expiresAt: adjustment.expiresAt?.toISOString() || null,

			// Parties
			homeowner: {
				id: adjustment.homeowner?.id,
				name: adjustment.homeowner ? `${adjustment.homeowner.firstName} ${adjustment.homeowner.lastName}` : null,
				email: adjustment.homeowner?.email,
				phone: adjustment.homeowner?.phone,
				profileImage: adjustment.homeowner?.profileImage,
				stripeCustomerId: adjustment.homeowner?.stripeCustomerId,
			},
			cleaner: {
				id: adjustment.cleaner?.id,
				name: adjustment.cleaner ? `${adjustment.cleaner.firstName} ${adjustment.cleaner.lastName}` : null,
				email: adjustment.cleaner?.email,
				phone: adjustment.cleaner?.phone,
				profileImage: adjustment.cleaner?.profileImage,
			},
			assignedTo: adjustment.owner ? {
				id: adjustment.owner.id,
				name: `${adjustment.owner.firstName} ${adjustment.owner.lastName}`,
				email: adjustment.owner.email,
			} : null,

			// Appointment Context
			appointment: appointment ? {
				id: appointment.id,
				date: appointment.date?.toISOString() || null,
				price: appointment.price,
				paymentIntentId: appointment.paymentIntentId,
				paymentStatus: appointment.paymentStatus,
				completionChecklistData: appointment.completionChecklistData,
				completionNotes: appointment.completionNotes,
				home: appointment.home ? {
					id: appointment.home.id,
					address: appointment.home.address,
					numBeds: appointment.home.numBeds,
					numBaths: appointment.home.numBaths,
					homeSize: appointment.home.homeSize,
				} : null,
			} : null,
		};
	}

	/**
	 * Get all photos for an appointment
	 */
	static async getAppointmentPhotos(appointmentId) {
		const { JobPhoto, User } = require("../models");

		const photos = await JobPhoto.findAll({
			where: { appointmentId },
			include: [
				{ model: User, as: "cleaner", attributes: ["id", "firstName", "lastName"] },
			],
			order: [
				["photoType", "ASC"],
				["room", "ASC"],
				["takenAt", "ASC"],
			],
		});

		const grouped = {
			before: [],
			after: [],
			passes: [],
		};

		photos.forEach(photo => {
			const photoData = {
				id: photo.id,
				photoType: photo.photoType,
				photoData: photo.photoData,
				room: photo.room,
				notes: photo.notes,
				takenAt: photo.takenAt?.toISOString() || null,
				isNotApplicable: photo.isNotApplicable,
				cleaner: photo.cleaner ? {
					id: photo.cleaner.id,
					name: `${photo.cleaner.firstName} ${photo.cleaner.lastName}`,
				} : null,
			};

			if (grouped[photo.photoType]) {
				grouped[photo.photoType].push(photoData);
			}
		});

		return {
			total: photos.length,
			...grouped,
		};
	}

	/**
	 * Get completion checklist for an appointment
	 */
	static async getAppointmentChecklist(appointmentId) {
		const { UserAppointments } = require("../models");

		const appointment = await UserAppointments.findByPk(appointmentId, {
			attributes: ["id", "completionChecklistData", "completionNotes"],
		});

		if (!appointment) {
			throw new Error("Appointment not found");
		}

		return {
			checklistData: appointment.completionChecklistData || {},
			completionNotes: appointment.completionNotes,
		};
	}

	/**
	 * Get messages for an appointment
	 */
	static async getAppointmentMessages(appointmentId) {
		const { Conversation, Message, User } = require("../models");

		const conversation = await Conversation.findOne({
			where: { appointmentId },
			include: [
				{
					model: Message,
					as: "messages",
					where: { deletedAt: null },
					required: false,
					include: [
						{ model: User, as: "sender", attributes: ["id", "firstName", "lastName", "type", "profileImage"] },
					],
					order: [["createdAt", "ASC"]],
				},
			],
		});

		if (!conversation) {
			return {
				conversationId: null,
				messages: [],
				total: 0,
			};
		}

		return {
			conversationId: conversation.id,
			messages: conversation.messages?.map(m => ({
				id: m.id,
				content: m.content,
				messageType: m.messageType,
				createdAt: m.createdAt?.toISOString() || null,
				sender: m.sender ? {
					id: m.sender.id,
					name: `${m.sender.firstName} ${m.sender.lastName}`,
					type: m.sender.type,
					profileImage: m.sender.profileImage,
				} : null,
				hasSuspiciousContent: m.hasSuspiciousContent,
			})) || [],
			total: conversation.messages?.length || 0,
		};
	}

	/**
	 * Get audit trail for a case
	 */
	static async getAuditTrail(caseId, caseType, appointmentId) {
		const { CancellationAuditLog, User } = require("../models");
		const { Op } = require("sequelize");

		const where = {};

		if (caseType === "appeal") {
			where[Op.or] = [
				{ appealId: caseId },
				{ appointmentId },
			];
		} else {
			where.appointmentId = appointmentId;
		}

		const logs = await CancellationAuditLog.findAll({
			where,
			include: [
				{ model: User, as: "actor", attributes: ["id", "firstName", "lastName", "type"] },
			],
			order: [["occurredAt", "ASC"]],
			limit: 200,
		});

		return logs.map(log => ({
			id: log.id,
			eventType: log.eventType,
			occurredAt: log.occurredAt?.toISOString() || null,
			actor: log.actor ? {
				id: log.actor.id,
				name: `${log.actor.firstName} ${log.actor.lastName}`,
				type: log.actor.type,
			} : null,
			actorType: log.actorType,
			eventData: log.eventData,
			previousState: log.previousState,
			newState: log.newState,
			isSystemGenerated: log.isSystemGenerated,
		}));
	}

	/**
	 * Process Stripe refund to homeowner
	 */
	static async processRefund(options) {
		const { caseId, caseType, amount, reason, reviewerId, req } = options;
		const { UserAppointments, User } = require("../models");

		const stripe = Stripe(process.env.STRIPE_SECRET_KEY);

		// Get case and appointment
		const caseData = await this.getConflictCase(caseId, caseType);
		if (!caseData.appointment?.paymentIntentId) {
			throw new Error("No payment intent found for this appointment");
		}

		const appointmentId = caseData.appointment.id;
		const paymentIntentId = caseData.appointment.paymentIntentId;

		try {
			// Create Stripe refund
			const refund = await stripe.refunds.create({
				payment_intent: paymentIntentId,
				amount: amount,
				reason: "requested_by_customer",
				metadata: {
					caseId: caseId.toString(),
					caseType,
					reason,
					reviewerId: reviewerId?.toString(),
				},
			});

			// Update appointment
			await UserAppointments.update(
				{
					refundAmount: (caseData.appointment.refundAmount || 0) + amount,
					lastRefundAt: new Date(),
				},
				{ where: { id: appointmentId } }
			);

			// Log audit event
			await CancellationAuditService.log({
				appointmentId,
				appealId: caseType === "appeal" ? caseId : null,
				eventType: "refund_completed",
				actorId: reviewerId,
				actorType: "hr",
				eventData: {
					amount,
					reason,
					stripeRefundId: refund.id,
					caseType,
					caseId,
				},
				req,
			});

			// Record in ledger
			await JobLedgerService.recordConflictRefund(
				appointmentId,
				caseId,
				caseType,
				{
					amount,
					reason,
					stripeRefundId: refund.id,
					reviewerId,
				}
			);

			return {
				success: true,
				refundId: refund.id,
				amount,
				status: refund.status,
			};

		} catch (error) {
			// Log failed attempt
			await CancellationAuditService.log({
				appointmentId,
				appealId: caseType === "appeal" ? caseId : null,
				eventType: "refund_failed",
				actorId: reviewerId,
				actorType: "hr",
				eventData: {
					amount,
					reason,
					error: error.message,
				},
				req,
			});

			throw error;
		}
	}

	/**
	 * Process Stripe payout to cleaner
	 */
	static async processCleanerPayout(options) {
		const { caseId, caseType, amount, reason, reviewerId, req } = options;
		const { User } = require("../models");

		const stripe = Stripe(process.env.STRIPE_SECRET_KEY);

		// Get case data
		const caseData = await this.getConflictCase(caseId, caseType);
		const cleanerStripeAccountId = caseData.cleaner?.stripeAccountId;

		if (!cleanerStripeAccountId) {
			throw new Error("Cleaner does not have a Stripe account connected");
		}

		const appointmentId = caseData.appointment?.id;

		try {
			// Create Stripe transfer to cleaner's connected account
			const transfer = await stripe.transfers.create({
				amount: amount,
				currency: "usd",
				destination: cleanerStripeAccountId,
				metadata: {
					caseId: caseId.toString(),
					caseType,
					reason,
					reviewerId: reviewerId?.toString(),
					appointmentId: appointmentId?.toString(),
				},
			});

			// Log audit event
			await CancellationAuditService.log({
				appointmentId,
				appealId: caseType === "appeal" ? caseId : null,
				eventType: "payout_completed",
				actorId: reviewerId,
				actorType: "hr",
				eventData: {
					cleanerId: caseData.cleaner.id,
					amount,
					reason,
					stripeTransferId: transfer.id,
					caseType,
					caseId,
				},
				req,
			});

			// Record in ledger
			await JobLedgerService.recordConflictPayout(
				appointmentId,
				caseId,
				caseType,
				{
					cleanerId: caseData.cleaner.id,
					amount,
					reason,
					stripeTransferId: transfer.id,
					reviewerId,
				}
			);

			return {
				success: true,
				transferId: transfer.id,
				amount,
				destination: cleanerStripeAccountId,
			};

		} catch (error) {
			// Log failed attempt
			await CancellationAuditService.log({
				appointmentId,
				appealId: caseType === "appeal" ? caseId : null,
				eventType: "payout_failed",
				actorId: reviewerId,
				actorType: "hr",
				eventData: {
					cleanerId: caseData.cleaner?.id,
					amount,
					reason,
					error: error.message,
				},
				req,
			});

			throw error;
		}
	}

	/**
	 * Add a reviewer note to a case
	 */
	static async addNote(options) {
		const { caseId, caseType, note, reviewerId, req } = options;
		const { CancellationAppeal, HomeSizeAdjustmentRequest } = require("../models");

		let appointmentId;

		if (caseType === "appeal") {
			const appeal = await CancellationAppeal.findByPk(caseId);
			if (!appeal) throw new Error("Appeal not found");
			appointmentId = appeal.appointmentId;

			// Update last activity
			await appeal.update({ lastActivityAt: new Date() });

		} else if (caseType === "adjustment") {
			const adjustment = await HomeSizeAdjustmentRequest.findByPk(caseId);
			if (!adjustment) throw new Error("Adjustment not found");
			appointmentId = adjustment.appointmentId;

			// Append to owner note
			const existingNote = adjustment.ownerNote || "";
			const timestamp = moment().format("YYYY-MM-DD HH:mm");
			const newNote = existingNote
				? `${existingNote}\n\n[${timestamp}] ${note}`
				: `[${timestamp}] ${note}`;
			await adjustment.update({ ownerNote: newNote });
		}

		// Log audit event
		await CancellationAuditService.log({
			appointmentId,
			appealId: caseType === "appeal" ? caseId : null,
			eventType: "appeal_status_changed",
			actorId: reviewerId,
			actorType: "hr",
			eventData: {
				action: "note_added",
				note,
				caseType,
			},
			req,
		});

		return { success: true };
	}

	/**
	 * Resolve a conflict case
	 */
	static async resolveCase(options) {
		const {
			caseId,
			caseType,
			decision,
			resolution,
			notes,
			reviewerId,
			req,
		} = options;

		if (caseType === "appeal") {
			return this.resolveAppeal(caseId, decision, resolution, notes, reviewerId, req);
		} else if (caseType === "adjustment") {
			return this.resolveAdjustment(caseId, decision, resolution, notes, reviewerId, req);
		}

		throw new Error("Invalid case type");
	}

	/**
	 * Resolve an appeal case
	 */
	static async resolveAppeal(appealId, decision, resolution, notes, reviewerId, req) {
		const AppealService = require("./AppealService");

		return AppealService.resolveAppeal(appealId, decision, {
			actions: resolution,
			notes,
		}, reviewerId, req);
	}

	/**
	 * Resolve an adjustment case
	 */
	static async resolveAdjustment(adjustmentId, decision, resolution, notes, reviewerId, req) {
		const { HomeSizeAdjustmentRequest, UserAppointments, sequelize } = require("../models");

		const transaction = await sequelize.transaction();

		try {
			const adjustment = await HomeSizeAdjustmentRequest.findByPk(adjustmentId, {
				include: [{ model: UserAppointments, as: "appointment" }],
				transaction,
			});

			if (!adjustment) {
				throw new Error("Adjustment not found");
			}

			// Determine new status
			const newStatus = decision === "approve" ? "owner_approved" : "owner_denied";

			await adjustment.update({
				status: newStatus,
				ownerNote: notes,
				ownerId: reviewerId,
				ownerResolvedAt: new Date(),
			}, { transaction });

			await transaction.commit();

			// Log audit event
			await CancellationAuditService.log({
				appointmentId: adjustment.appointmentId,
				eventType: "appeal_resolved",
				actorId: reviewerId,
				actorType: "hr",
				eventData: {
					caseType: "adjustment",
					caseId: adjustmentId,
					decision,
					resolution,
					notes,
				},
				previousState: { status: adjustment.status },
				newState: { status: newStatus },
				req,
			});

			return {
				success: true,
				status: newStatus,
			};

		} catch (error) {
			await transaction.rollback();
			throw error;
		}
	}

	/**
	 * Get queue statistics
	 */
	static async getQueueStats() {
		const { CancellationAppeal, HomeSizeAdjustmentRequest } = require("../models");
		const { Op } = require("sequelize");

		const now = new Date();

		const [
			appealsPending,
			appealsPastSLA,
			appealsUrgent,
			appealsResolvedThisWeek,
			adjustmentsPending,
			adjustmentsPastExpiry,
		] = await Promise.all([
			CancellationAppeal.count({
				where: { status: ["submitted", "under_review", "awaiting_documents", "escalated"] },
			}),
			CancellationAppeal.count({
				where: {
					status: ["submitted", "under_review", "awaiting_documents"],
					slaDeadline: { [Op.lt]: now },
				},
			}),
			CancellationAppeal.count({
				where: {
					status: ["submitted", "under_review", "awaiting_documents", "escalated"],
					priority: "urgent",
				},
			}),
			CancellationAppeal.count({
				where: {
					status: ["approved", "partially_approved", "denied"],
					closedAt: { [Op.gte]: moment().subtract(7, "days").toDate() },
				},
			}),
			HomeSizeAdjustmentRequest.count({
				where: { status: ["pending_homeowner", "pending_owner"] },
			}),
			HomeSizeAdjustmentRequest.count({
				where: {
					status: ["pending_homeowner", "pending_owner"],
					expiresAt: { [Op.lt]: now },
				},
			}),
		]);

		return {
			totalPending: appealsPending + adjustmentsPending,
			appeals: {
				pending: appealsPending,
				pastSLA: appealsPastSLA,
				urgent: appealsUrgent,
				resolvedThisWeek: appealsResolvedThisWeek,
			},
			adjustments: {
				pending: adjustmentsPending,
				pastExpiry: adjustmentsPastExpiry,
			},
			slaBreachCount: appealsPastSLA + adjustmentsPastExpiry,
		};
	}

	/**
	 * Assign a case to a reviewer
	 */
	static async assignCase(caseId, caseType, assigneeId, assignerId, req) {
		const { CancellationAppeal, HomeSizeAdjustmentRequest, User } = require("../models");

		// Validate assignee
		const assignee = await User.findByPk(assigneeId);
		if (!assignee || !["hr", "owner"].includes(assignee.type)) {
			throw new Error("Invalid assignee - must be HR or Owner");
		}

		let appointmentId;

		if (caseType === "appeal") {
			const appeal = await CancellationAppeal.findByPk(caseId);
			if (!appeal) throw new Error("Appeal not found");
			appointmentId = appeal.appointmentId;

			await appeal.update({
				assignedTo: assigneeId,
				assignedAt: new Date(),
				status: appeal.status === "submitted" ? "under_review" : appeal.status,
				lastActivityAt: new Date(),
			});

		} else if (caseType === "adjustment") {
			const adjustment = await HomeSizeAdjustmentRequest.findByPk(caseId);
			if (!adjustment) throw new Error("Adjustment not found");
			appointmentId = adjustment.appointmentId;

			await adjustment.update({
				ownerId: assigneeId,
			});
		}

		// Log audit event
		await CancellationAuditService.log({
			appointmentId,
			appealId: caseType === "appeal" ? caseId : null,
			eventType: "appeal_assigned",
			actorId: assignerId,
			actorType: "hr",
			eventData: {
				assigneeId,
				caseType,
				caseId,
			},
			req,
		});

		return { success: true };
	}
}

module.exports = ConflictResolutionService;
