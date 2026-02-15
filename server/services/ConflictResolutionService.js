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
const EncryptionService = require("./EncryptionService");
const Stripe = require("stripe");

// Helper to decrypt user PII fields
const decryptUserPII = (user) => {
	if (!user) return null;
	return {
		id: user.id,
		firstName: user.firstName ? EncryptionService.decrypt(user.firstName) : null,
		lastName: user.lastName ? EncryptionService.decrypt(user.lastName) : null,
		email: user.email ? EncryptionService.decrypt(user.email) : null,
		phone: user.phone ? EncryptionService.decrypt(user.phone) : null,
		type: user.type,
		scrutinyLevel: user.appealScrutinyLevel,
	};
};

// Helper to format user name from decrypted PII
const formatUserName = (user) => {
	if (!user) return null;
	const firstName = user.firstName ? EncryptionService.decrypt(user.firstName) : "";
	const lastName = user.lastName ? EncryptionService.decrypt(user.lastName) : "";
	return `${firstName} ${lastName}`.trim() || null;
};

class ConflictResolutionService {
	/**
	 * Get unified conflict queue combining appeals and adjustment disputes
	 */
	static async getConflictQueue(options = {}) {
		const { Op } = require("sequelize");
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
			includeDemoData = false,
			includeResolved = false,
		} = options;

		const results = [];

		// Get appeals if not filtered to adjustments only
		if (!caseType || caseType === "appeal") {
			const appealWhere = {};
			if (status) {
				appealWhere.status = status;
			} else if (includeResolved) {
				// Include all statuses when showing archive
				appealWhere.status = { [Op.in]: ["submitted", "under_review", "awaiting_documents", "escalated", "approved", "partially_approved", "denied"] };
			} else {
				appealWhere.status = { [Op.in]: ["submitted", "under_review", "awaiting_documents", "escalated"] };
			}
			if (priority) appealWhere.priority = priority;
			if (assignedTo) appealWhere.assignedTo = assignedTo;

			const appeals = await CancellationAppeal.findAll({
				where: appealWhere,
				include: [
					{
						model: UserAppointments,
						as: "appointment",
						attributes: ["id", "date", "userId", "price", "isDemoAppointment"],
						where: includeDemoData ? {} : { isDemoAppointment: { [require("sequelize").Op.ne]: true } },
						required: true,
						include: [
							{ model: User, as: "bookedByCleaner", attributes: ["id", "firstName", "lastName", "email", "phone"] },
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
					caseNumber: appeal.caseNumber || `APL-${appeal.id.toString().padStart(6, "0")}`,
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
						name: formatUserName(appeal.appealer),
						email: appeal.appealer.email ? EncryptionService.decrypt(appeal.appealer.email) : null,
						phone: appeal.appealer.phone ? EncryptionService.decrypt(appeal.appealer.phone) : null,
						scrutinyLevel: appeal.appealer.appealScrutinyLevel,
					} : null,
					cleaner: appeal.appealer?.type === "cleaner" ? {
						id: appeal.appealer.id,
						name: formatUserName(appeal.appealer),
						email: appeal.appealer.email ? EncryptionService.decrypt(appeal.appealer.email) : null,
						phone: appeal.appealer.phone ? EncryptionService.decrypt(appeal.appealer.phone) : null,
					} : (appeal.appointment?.bookedByCleaner ? {
						id: appeal.appointment.bookedByCleaner.id,
						name: formatUserName(appeal.appointment.bookedByCleaner),
						email: appeal.appointment.bookedByCleaner.email ? EncryptionService.decrypt(appeal.appointment.bookedByCleaner.email) : null,
						phone: appeal.appointment.bookedByCleaner.phone ? EncryptionService.decrypt(appeal.appointment.bookedByCleaner.phone) : null,
					} : null),
					assignedTo: appeal.assignee ? {
						id: appeal.assignee.id,
						name: formatUserName(appeal.assignee),
					} : null,
					financialImpact: {
						penaltyAmount: appeal.originalPenaltyAmount,
						refundWithheld: appeal.originalRefundWithheld,
					},
				});
			});
		}

		// Get payment disputes if not filtered to other types only
		if (!caseType || caseType === "payment") {
			const { PaymentDispute, Payout } = require("../models");

			const paymentWhere = {};
			if (status) {
				paymentWhere.status = status;
			} else if (includeResolved) {
				paymentWhere.status = { [Op.in]: ["submitted", "under_review", "resolved", "denied", "closed"] };
			} else {
				paymentWhere.status = { [Op.in]: ["submitted", "under_review"] };
			}
			if (priority) paymentWhere.priority = priority;
			if (assignedTo) paymentWhere.assignedTo = assignedTo;

			const paymentDisputes = await PaymentDispute.findAll({
				where: paymentWhere,
				include: [
					{
						model: UserAppointments,
						as: "appointment",
						attributes: ["id", "date", "userId", "price", "isDemoAppointment"],
						where: includeDemoData ? {} : { isDemoAppointment: { [require("sequelize").Op.ne]: true } },
						required: true,
						include: [
							{ model: User, as: "user", attributes: ["id", "firstName", "lastName", "email", "phone"] },
						],
					},
					{ model: User, as: "cleaner", attributes: ["id", "firstName", "lastName", "email", "phone"] },
					{ model: User, as: "assignee", attributes: ["id", "firstName", "lastName"] },
					{ model: Payout, as: "payout", attributes: ["id", "netAmount", "status"] },
				],
				order: [
					["priority", "DESC"],
					["slaDeadline", "ASC"],
					["submittedAt", "ASC"],
				],
			});

			paymentDisputes.forEach(dispute => {
				const isPastSLA = dispute.slaDeadline && new Date() > new Date(dispute.slaDeadline) && dispute.isOpen();
				results.push({
					id: dispute.id,
					caseType: "payment",
					caseNumber: dispute.caseNumber || `PD-${dispute.id.toString().padStart(6, "0")}`,
					appointmentId: dispute.appointmentId,
					appointmentDate: dispute.appointment?.date?.toISOString() || null,
					status: dispute.status,
					priority: dispute.priority,
					category: dispute.issueType,
					severity: dispute.priority === "urgent" ? "high" : "medium",
					description: dispute.description,
					submittedAt: dispute.submittedAt?.toISOString() || null,
					slaDeadline: dispute.slaDeadline?.toISOString() || null,
					isPastSLA,
					timeUntilSLA: dispute.slaDeadline ? Math.max(0, Math.floor((new Date(dispute.slaDeadline).getTime() - Date.now()) / 1000)) : null,
					homeowner: dispute.appointment?.user ? {
						id: dispute.appointment.user.id,
						name: formatUserName(dispute.appointment.user),
						email: dispute.appointment.user.email ? EncryptionService.decrypt(dispute.appointment.user.email) : null,
						phone: dispute.appointment.user.phone ? EncryptionService.decrypt(dispute.appointment.user.phone) : null,
					} : null,
					cleaner: dispute.cleaner ? {
						id: dispute.cleaner.id,
						name: formatUserName(dispute.cleaner),
						email: dispute.cleaner.email ? EncryptionService.decrypt(dispute.cleaner.email) : null,
						phone: dispute.cleaner.phone ? EncryptionService.decrypt(dispute.cleaner.phone) : null,
					} : null,
					assignedTo: dispute.assignee ? {
						id: dispute.assignee.id,
						name: formatUserName(dispute.assignee),
					} : null,
					financialImpact: {
						expectedAmount: dispute.expectedAmount,
						receivedAmount: dispute.receivedAmount,
						payoutAmount: dispute.payout?.netAmount || null,
					},
				});
			});
		}

		// Get support tickets if not filtered to other types only
		if (!caseType || caseType === "support") {
			const { SupportTicket, Conversation } = require("../models");

			const supportWhere = {};
			if (status) {
				supportWhere.status = status;
			} else if (includeResolved) {
				supportWhere.status = { [Op.in]: ["submitted", "under_review", "pending_info", "resolved", "closed"] };
			} else {
				supportWhere.status = { [Op.in]: ["submitted", "under_review", "pending_info"] };
			}
			if (priority) supportWhere.priority = priority;
			if (assignedTo) supportWhere.assignedTo = assignedTo;

			const supportTickets = await SupportTicket.findAll({
				where: supportWhere,
				include: [
					{
						model: User,
						as: "reporter",
						attributes: ["id", "firstName", "lastName", "isDemoAccount"],
						where: includeDemoData ? {} : { isDemoAccount: { [require("sequelize").Op.ne]: true } },
						required: true,
					},
					{ model: User, as: "subject", attributes: ["id", "firstName", "lastName", "email", "phone", "type"] },
					{ model: User, as: "assignee", attributes: ["id", "firstName", "lastName"] },
					{ model: Conversation, as: "conversation", attributes: ["id", "title"] },
				],
				order: [
					["priority", "DESC"],
					["slaDeadline", "ASC"],
					["submittedAt", "ASC"],
				],
			});

			supportTickets.forEach(ticket => {
				const isPastSLA = ticket.slaDeadline && new Date() > new Date(ticket.slaDeadline) && ticket.isOpen();
				results.push({
					id: ticket.id,
					caseType: "support",
					caseNumber: ticket.caseNumber || `ST-${ticket.id.toString().padStart(6, "0")}`,
					appointmentId: null, // Support tickets may not have an appointment
					appointmentDate: null,
					status: ticket.status,
					priority: ticket.priority,
					category: ticket.category,
					severity: ticket.priority === "urgent" ? "high" : "medium",
					description: ticket.description,
					submittedAt: ticket.submittedAt?.toISOString() || null,
					slaDeadline: ticket.slaDeadline?.toISOString() || null,
					isPastSLA,
					timeUntilSLA: ticket.slaDeadline ? Math.max(0, Math.floor((new Date(ticket.slaDeadline).getTime() - Date.now()) / 1000)) : null,
					homeowner: ticket.subject?.type === "homeowner" ? {
						id: ticket.subject.id,
						name: `${ticket.subject.firstName} ${ticket.subject.lastName}`,
						email: ticket.subject.email,
						phone: ticket.subject.phone,
					} : null,
					cleaner: ticket.subject?.type === "cleaner" ? {
						id: ticket.subject.id,
						name: `${ticket.subject.firstName} ${ticket.subject.lastName}`,
						email: ticket.subject.email,
						phone: ticket.subject.phone,
					} : null,
					assignedTo: ticket.assignee ? {
						id: ticket.assignee.id,
						name: `${ticket.assignee.firstName} ${ticket.assignee.lastName}`,
					} : null,
					financialImpact: null, // Support tickets typically don't have direct financial impact
					hasLinkedConversation: !!ticket.conversationId,
					conversationTitle: ticket.conversation?.title || null,
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
				// Use Op.in if status maps to an array, otherwise use direct value
				adjustmentWhere.status = statusMap[status]
					? { [Op.in]: statusMap[status] }
					: status;
			} else if (includeResolved) {
				adjustmentWhere.status = { [Op.in]: ["pending_homeowner", "pending_owner", "approved", "owner_approved", "denied", "owner_denied", "expired"] };
			} else {
				adjustmentWhere.status = { [Op.in]: ["pending_homeowner", "pending_owner"] };
			}

			const adjustments = await HomeSizeAdjustmentRequest.findAll({
				where: adjustmentWhere,
				include: [
					{
						model: UserAppointments,
						as: "appointment",
						attributes: ["id", "date", "userId", "price", "isDemoAppointment"],
						where: includeDemoData ? {} : { isDemoAppointment: { [require("sequelize").Op.ne]: true } },
						required: true,
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
					caseNumber: adj.caseNumber || `ADJ-${adj.id.toString().padStart(6, "0")}`,
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

		// Apply search filter (enhanced with email, phone, user ID)
		let filtered = results;
		if (search) {
			const searchLower = search.toLowerCase();
			const searchDigits = search.replace(/\D/g, ""); // For phone search
			filtered = results.filter(r =>
				// Case number
				r.caseNumber?.toLowerCase().includes(searchLower) ||
				// Names
				r.homeowner?.name?.toLowerCase().includes(searchLower) ||
				r.cleaner?.name?.toLowerCase().includes(searchLower) ||
				// Description
				r.description?.toLowerCase().includes(searchLower) ||
				// Email search
				r.homeowner?.email?.toLowerCase().includes(searchLower) ||
				r.cleaner?.email?.toLowerCase().includes(searchLower) ||
				// Phone search (match digits)
				(searchDigits.length >= 4 && r.homeowner?.phone?.includes(searchDigits)) ||
				(searchDigits.length >= 4 && r.cleaner?.phone?.includes(searchDigits)) ||
				// User ID search
				r.homeowner?.id?.toString() === search ||
				r.cleaner?.id?.toString() === search
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
		} else if (caseType === "payment") {
			return this.getPaymentDisputeCase(caseId);
		} else if (caseType === "support") {
			return this.getSupportTicketCase(caseId);
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
						{ model: User, as: "bookedByCleaner", attributes: ["id", "firstName", "lastName", "email", "phone"] },
						{ model: User, as: "user", attributes: ["id", "firstName", "lastName", "email", "phone", "stripeCustomerId"] },
						{ model: UserHomes, as: "home", attributes: ["id", "address", "numBeds", "numBaths"] },
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
			caseNumber: appeal.caseNumber || `APL-${appeal.id.toString().padStart(6, "0")}`,

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
				stripeCustomerId: appointment?.user?.stripeCustomerId,
			},
			cleaner: {
				id: appointment?.bookedByCleaner?.id,
				name: appointment?.bookedByCleaner ? `${appointment.bookedByCleaner.firstName} ${appointment.bookedByCleaner.lastName}` : null,
				email: appointment?.bookedByCleaner?.email,
				phone: appointment?.bookedByCleaner?.phone,
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
				date: appointment.date ? (typeof appointment.date === 'string' ? appointment.date : appointment.date.toISOString()) : null,
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
						{ model: User, as: "cleaner", attributes: ["id", "firstName", "lastName", "email", "phone", "stripeAccountId"] },
						{ model: User, as: "user", attributes: ["id", "firstName", "lastName", "email", "phone", "stripeCustomerId"] },
						{ model: UserHomes, as: "home", attributes: ["id", "address", "numBeds", "numBaths"] },
					],
				},
				{ model: User, as: "cleaner", attributes: ["id", "firstName", "lastName", "email", "phone"] },
				{ model: User, as: "homeowner", attributes: ["id", "firstName", "lastName", "email", "phone", "stripeCustomerId"] },
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
			caseNumber: adjustment.caseNumber || `ADJ-${adjustment.id.toString().padStart(6, "0")}`,

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
				stripeCustomerId: adjustment.homeowner?.stripeCustomerId,
			},
			cleaner: {
				id: adjustment.cleaner?.id,
				name: adjustment.cleaner ? `${adjustment.cleaner.firstName} ${adjustment.cleaner.lastName}` : null,
				email: adjustment.cleaner?.email,
				phone: adjustment.cleaner?.phone,
			},
			assignedTo: adjustment.owner ? {
				id: adjustment.owner.id,
				name: `${adjustment.owner.firstName} ${adjustment.owner.lastName}`,
				email: adjustment.owner.email,
			} : null,

			// Appointment Context
			appointment: appointment ? {
				id: appointment.id,
				date: appointment.date ? (typeof appointment.date === 'string' ? appointment.date : appointment.date.toISOString()) : null,
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
	 * Get payment dispute case details
	 */
	static async getPaymentDisputeCase(disputeId) {
		const {
			PaymentDispute,
			Payout,
			UserAppointments,
			User,
			UserHomes,
		} = require("../models");

		const dispute = await PaymentDispute.findByPk(disputeId, {
			include: [
				{
					model: UserAppointments,
					as: "appointment",
					include: [
						{ model: User, as: "cleaner", attributes: ["id", "firstName", "lastName", "email", "phone", "stripeAccountId"] },
						{ model: User, as: "user", attributes: ["id", "firstName", "lastName", "email", "phone"] },
						{ model: UserHomes, as: "home", attributes: ["id", "address", "numBeds", "numBaths"] },
					],
				},
				{ model: User, as: "cleaner", attributes: ["id", "firstName", "lastName", "email", "phone", "stripeAccountId"] },
				{ model: User, as: "assignee", attributes: ["id", "firstName", "lastName", "email"] },
				{ model: User, as: "reviewer", attributes: ["id", "firstName", "lastName"] },
				{ model: Payout, as: "payout" },
			],
		});

		if (!dispute) {
			throw new Error("Payment dispute not found");
		}

		const appointment = dispute.appointment;
		const isPastSLA = dispute.slaDeadline && new Date() > new Date(dispute.slaDeadline) && dispute.isOpen();

		return {
			id: dispute.id,
			caseType: "payment",
			caseNumber: dispute.caseNumber || `PD-${dispute.id.toString().padStart(6, "0")}`,

			// Status & Priority
			status: dispute.status,
			priority: dispute.priority,
			slaDeadline: dispute.slaDeadline?.toISOString() || null,
			isPastSLA,
			timeUntilSLA: dispute.slaDeadline ? Math.max(0, Math.floor((new Date(dispute.slaDeadline).getTime() - Date.now()) / 1000)) : null,

			// Dispute Details
			category: dispute.issueType,
			severity: dispute.priority === "urgent" ? "high" : "medium",
			description: dispute.description,
			issueType: dispute.issueType,

			// Financial Impact
			financialImpact: {
				expectedAmount: dispute.expectedAmount,
				receivedAmount: dispute.receivedAmount,
				payoutAmount: dispute.payout?.netAmount || null,
				payoutStatus: dispute.payout?.status || null,
			},

			// Payout details
			payout: dispute.payout ? {
				id: dispute.payout.id,
				netAmount: dispute.payout.netAmount,
				grossAmount: dispute.payout.grossAmount,
				platformFee: dispute.payout.platformFee,
				status: dispute.payout.status,
				stripeTransferId: dispute.payout.stripeTransferId,
				completedAt: dispute.payout.completedAt?.toISOString() || null,
			} : null,

			// Resolution
			resolution: dispute.resolution || null,
			resolutionNotes: dispute.resolutionNotes,

			// Timestamps
			submittedAt: dispute.submittedAt?.toISOString() || null,
			assignedAt: dispute.assignedAt?.toISOString() || null,
			reviewedAt: dispute.reviewedAt?.toISOString() || null,
			closedAt: dispute.closedAt?.toISOString() || null,

			// Parties
			homeowner: appointment?.user ? {
				id: appointment.user.id,
				name: `${appointment.user.firstName} ${appointment.user.lastName}`,
				email: appointment.user.email,
				phone: appointment.user.phone,
			} : null,
			cleaner: dispute.cleaner ? {
				id: dispute.cleaner.id,
				name: `${dispute.cleaner.firstName} ${dispute.cleaner.lastName}`,
				email: dispute.cleaner.email,
				phone: dispute.cleaner.phone,
				stripeAccountId: dispute.cleaner.stripeAccountId,
			} : null,
			assignedTo: dispute.assignee ? {
				id: dispute.assignee.id,
				name: `${dispute.assignee.firstName} ${dispute.assignee.lastName}`,
				email: dispute.assignee.email,
			} : null,
			reviewedBy: dispute.reviewer ? {
				id: dispute.reviewer.id,
				name: `${dispute.reviewer.firstName} ${dispute.reviewer.lastName}`,
			} : null,

			// Appointment Context
			appointment: appointment ? {
				id: appointment.id,
				date: appointment.date ? (typeof appointment.date === 'string' ? appointment.date : appointment.date.toISOString()) : null,
				price: appointment.price,
				paymentIntentId: appointment.paymentIntentId,
				paymentStatus: appointment.paymentStatus,
				completed: appointment.completed,
				home: appointment.home ? {
					id: appointment.home.id,
					address: appointment.home.address,
					numBeds: appointment.home.numBeds,
					numBaths: appointment.home.numBaths,
				} : null,
			} : null,
		};
	}

	/**
	 * Get support ticket case details
	 */
	static async getSupportTicketCase(ticketId) {
		const {
			SupportTicket,
			Conversation,
			Message,
			User,
		} = require("../models");

		const ticket = await SupportTicket.findByPk(ticketId, {
			include: [
				{ model: User, as: "reporter", attributes: ["id", "firstName", "lastName", "email", "type"] },
				{ model: User, as: "subject", attributes: ["id", "firstName", "lastName", "email", "phone", "type"] },
				{ model: User, as: "assignee", attributes: ["id", "firstName", "lastName", "email"] },
				{ model: User, as: "reviewer", attributes: ["id", "firstName", "lastName"] },
				{ model: Conversation, as: "conversation", attributes: ["id", "title", "conversationType"] },
			],
		});

		if (!ticket) {
			throw new Error("Support ticket not found");
		}

		const isPastSLA = ticket.slaDeadline && new Date() > new Date(ticket.slaDeadline) && ticket.isOpen();

		// Get linked conversation messages if present
		let linkedMessages = [];
		if (ticket.conversationId) {
			const messages = await Message.findAll({
				where: { conversationId: ticket.conversationId },
				include: [
					{ model: User, as: "sender", attributes: ["id", "firstName", "lastName", "type"] },
				],
				order: [["createdAt", "ASC"]],
				limit: 50, // Limit for performance
			});

			linkedMessages = messages.map(m => ({
				id: m.id,
				content: m.content,
				messageType: m.messageType,
				createdAt: m.createdAt?.toISOString() || null,
				sender: m.sender ? {
					id: m.sender.id,
					name: formatUserName(m.sender),
					type: m.sender.type,
				} : null,
			}));
		}

		return {
			id: ticket.id,
			caseType: "support",
			caseNumber: ticket.caseNumber || `ST-${ticket.id.toString().padStart(6, "0")}`,

			// Status & Priority
			status: ticket.status,
			priority: ticket.priority,
			slaDeadline: ticket.slaDeadline?.toISOString() || null,
			isPastSLA,
			timeUntilSLA: ticket.slaDeadline ? Math.max(0, Math.floor((new Date(ticket.slaDeadline).getTime() - Date.now()) / 1000)) : null,

			// Ticket Details
			category: ticket.category,
			subjectType: ticket.subjectType,
			description: ticket.description,

			// Resolution
			resolution: ticket.resolution || null,
			resolutionNotes: ticket.resolutionNotes,

			// Timestamps
			submittedAt: ticket.submittedAt?.toISOString() || null,
			assignedAt: ticket.assignedAt?.toISOString() || null,
			reviewedAt: ticket.reviewedAt?.toISOString() || null,
			closedAt: ticket.closedAt?.toISOString() || null,

			// Reporter (HR/owner who created the ticket)
			reporter: ticket.reporter ? {
				id: ticket.reporter.id,
				name: formatUserName(ticket.reporter),
				email: ticket.reporter.email ? EncryptionService.decrypt(ticket.reporter.email) : null,
				type: ticket.reporter.type,
			} : null,

			// Subject (user the ticket is about)
			subject: ticket.subject ? {
				id: ticket.subject.id,
				name: formatUserName(ticket.subject),
				email: ticket.subject.email ? EncryptionService.decrypt(ticket.subject.email) : null,
				phone: ticket.subject.phone ? EncryptionService.decrypt(ticket.subject.phone) : null,
				type: ticket.subject.type,
			} : null,

			// For compatibility with existing UI
			homeowner: ticket.subject?.type === "homeowner" ? {
				id: ticket.subject.id,
				name: formatUserName(ticket.subject),
				email: ticket.subject.email ? EncryptionService.decrypt(ticket.subject.email) : null,
				phone: ticket.subject.phone ? EncryptionService.decrypt(ticket.subject.phone) : null,
			} : null,
			cleaner: ticket.subject?.type === "cleaner" ? {
				id: ticket.subject.id,
				name: formatUserName(ticket.subject),
				email: ticket.subject.email ? EncryptionService.decrypt(ticket.subject.email) : null,
				phone: ticket.subject.phone ? EncryptionService.decrypt(ticket.subject.phone) : null,
			} : null,

			assignedTo: ticket.assignee ? {
				id: ticket.assignee.id,
				name: formatUserName(ticket.assignee),
				email: ticket.assignee.email ? EncryptionService.decrypt(ticket.assignee.email) : null,
			} : null,
			reviewedBy: ticket.reviewer ? {
				id: ticket.reviewer.id,
				name: formatUserName(ticket.reviewer),
			} : null,

			// Linked conversation
			hasLinkedConversation: !!ticket.conversationId,
			conversationId: ticket.conversationId,
			conversationTitle: ticket.conversation?.title || null,
			linkedMessages,
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
						{ model: User, as: "sender", attributes: ["id", "firstName", "lastName", "type"] },
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

		// Support tickets don't have audit trails in CancellationAuditLog
		if (caseType === "support") {
			return [];
		}

		const where = {};

		if (caseType === "appeal") {
			where[Op.or] = [
				{ appealId: caseId },
				...(appointmentId ? [{ appointmentId }] : []),
			];
		} else if (appointmentId) {
			where.appointmentId = appointmentId;
		} else {
			// No valid query criteria, return empty
			return [];
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
		const { UserAppointments, User, sequelize } = require("../models");

		const stripe = Stripe(process.env.STRIPE_SECRET_KEY);

		// Initialize variables for error handling context
		let appointmentId = null;
		let caseData = null;

		// Get case and appointment
		caseData = await this.getConflictCase(caseId, caseType);
		if (!caseData.appointment?.paymentIntentId) {
			throw new Error("No payment intent found for this appointment");
		}

		appointmentId = caseData.appointment.id;
		const paymentIntentId = caseData.appointment.paymentIntentId;

		// Use transaction with row-level lock to prevent race conditions
		const transaction = await sequelize.transaction();

		try {
			// Lock the appointment row and get fresh data
			const appointment = await UserAppointments.findByPk(appointmentId, {
				lock: transaction.LOCK.UPDATE,
				transaction,
			});

			if (!appointment) {
				await transaction.rollback();
				throw new Error("Appointment not found");
			}

			// Validate refund amount against current state (with lock held)
			const originalAmount = (appointment.price || 0) * 100;
			const alreadyRefunded = appointment.refundAmount || 0;
			const maxRefundable = Math.max(0, originalAmount - alreadyRefunded);

			if (amount > maxRefundable) {
				await transaction.rollback();
				throw new Error(`Refund amount exceeds maximum refundable. Max: ${maxRefundable / 100}`);
			}

			// Create Stripe refund with idempotency key to prevent duplicates
			const idempotencyKey = `refund-${caseType}-${caseId}-${appointmentId}-${amount}-${reviewerId}`;
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
			}, {
				idempotencyKey,
			});

			// Update appointment within the same transaction
			await appointment.update(
				{
					refundAmount: alreadyRefunded + amount,
					lastRefundAt: new Date(),
				},
				{ transaction }
			);

			// Commit transaction
			await transaction.commit();

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
					caseNumber: caseData.caseNumber,
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
			// Rollback transaction if still active
			if (transaction && !transaction.finished) {
				await transaction.rollback();
			}

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
					caseType,
					caseId,
					caseNumber: caseData?.caseNumber,
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

		// Validate cleaner exists and has Stripe account
		if (!caseData.cleaner) {
			throw new Error("No cleaner found for this case");
		}

		const cleanerId = caseData.cleaner.id;
		const cleanerStripeAccountId = caseData.cleaner.stripeAccountId;

		if (!cleanerStripeAccountId) {
			throw new Error("Cleaner does not have a Stripe account connected");
		}

		const appointmentId = caseData.appointment?.id;

		try {
			// Create Stripe transfer with idempotency key to prevent duplicates
			const idempotencyKey = `payout-${caseType}-${caseId}-${cleanerId}-${amount}-${reviewerId}`;
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
					cleanerId: cleanerId?.toString(),
				},
			}, {
				idempotencyKey,
			});

			// Log audit event
			await CancellationAuditService.log({
				appointmentId,
				appealId: caseType === "appeal" ? caseId : null,
				eventType: "payout_completed",
				actorId: reviewerId,
				actorType: "hr",
				eventData: {
					cleanerId,
					amount,
					reason,
					stripeTransferId: transfer.id,
					caseType,
					caseId,
					caseNumber: caseData?.caseNumber,
				},
				req,
			});

			// Record in ledger
			await JobLedgerService.recordConflictPayout(
				appointmentId,
				caseId,
				caseType,
				{
					cleanerId,
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
					caseType,
					caseId,
					caseNumber: caseData.caseNumber,
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
		const { CancellationAppeal, HomeSizeAdjustmentRequest, PaymentDispute, SupportTicket } = require("../models");

		let appointmentId;
		let caseNumber;

		if (caseType === "appeal") {
			const appeal = await CancellationAppeal.findByPk(caseId);
			if (!appeal) throw new Error("Appeal not found");
			appointmentId = appeal.appointmentId;
			caseNumber = appeal.caseNumber;

			// Update last activity
			await appeal.update({ lastActivityAt: new Date() });

		} else if (caseType === "adjustment") {
			const adjustment = await HomeSizeAdjustmentRequest.findByPk(caseId);
			if (!adjustment) throw new Error("Adjustment not found");
			appointmentId = adjustment.appointmentId;
			caseNumber = adjustment.caseNumber;

			// Append to owner note
			const existingNote = adjustment.ownerNote || "";
			const timestamp = moment().format("YYYY-MM-DD HH:mm");
			const newNote = existingNote
				? `${existingNote}\n\n[${timestamp}] ${note}`
				: `[${timestamp}] ${note}`;
			await adjustment.update({ ownerNote: newNote });

		} else if (caseType === "payment") {
			const dispute = await PaymentDispute.findByPk(caseId);
			if (!dispute) throw new Error("Payment dispute not found");
			appointmentId = dispute.appointmentId;
			caseNumber = dispute.caseNumber;

			// Append to resolution notes
			const existingNote = dispute.resolutionNotes || "";
			const timestamp = moment().format("YYYY-MM-DD HH:mm");
			const newNote = existingNote
				? `${existingNote}\n\n[${timestamp}] ${note}`
				: `[${timestamp}] ${note}`;
			await dispute.update({ resolutionNotes: newNote });

		} else if (caseType === "support") {
			const ticket = await SupportTicket.findByPk(caseId);
			if (!ticket) throw new Error("Support ticket not found");
			appointmentId = null; // Support tickets don't have appointments
			caseNumber = ticket.caseNumber;

			// Append to resolution notes
			const existingNote = ticket.resolutionNotes || "";
			const timestamp = moment().format("YYYY-MM-DD HH:mm");
			const newNote = existingNote
				? `${existingNote}\n\n[${timestamp}] ${note}`
				: `[${timestamp}] ${note}`;
			await ticket.update({ resolutionNotes: newNote });
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
				caseNumber,
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
		} else if (caseType === "payment") {
			return this.resolvePaymentDispute(caseId, decision, resolution, notes, reviewerId, req);
		} else if (caseType === "support") {
			return this.resolveSupportTicket(caseId, decision, resolution, notes, reviewerId, req);
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
					caseNumber: adjustment.caseNumber,
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
				caseNumber: adjustment.caseNumber,
			};

		} catch (error) {
			await transaction.rollback();
			throw error;
		}
	}

	/**
	 * Resolve a payment dispute case
	 */
	static async resolvePaymentDispute(disputeId, decision, resolution, notes, reviewerId, req) {
		const { PaymentDispute, sequelize } = require("../models");

		const transaction = await sequelize.transaction();

		try {
			const dispute = await PaymentDispute.findByPk(disputeId, { transaction });

			if (!dispute) {
				throw new Error("Payment dispute not found");
			}

			// Determine new status based on decision
			const newStatus = decision === "approve" ? "resolved" : "denied";

			await dispute.update({
				status: newStatus,
				resolutionNotes: notes,
				resolution: resolution || {},
				reviewedBy: reviewerId,
				reviewedAt: new Date(),
				closedAt: new Date(),
			}, { transaction });

			await transaction.commit();

			// Log audit event
			await CancellationAuditService.log({
				appointmentId: dispute.appointmentId,
				eventType: "appeal_resolved",
				actorId: reviewerId,
				actorType: "hr",
				eventData: {
					caseType: "payment",
					caseId: disputeId,
					caseNumber: dispute.caseNumber,
					decision,
					resolution,
					notes,
				},
				previousState: { status: dispute.status },
				newState: { status: newStatus },
				req,
			});

			return {
				success: true,
				status: newStatus,
				caseNumber: dispute.caseNumber,
			};

		} catch (error) {
			await transaction.rollback();
			throw error;
		}
	}

	/**
	 * Resolve a support ticket case
	 */
	static async resolveSupportTicket(ticketId, decision, resolution, notes, reviewerId, req) {
		const { SupportTicket, sequelize } = require("../models");

		const transaction = await sequelize.transaction();

		try {
			const ticket = await SupportTicket.findByPk(ticketId, { transaction });

			if (!ticket) {
				throw new Error("Support ticket not found");
			}

			// Determine new status based on decision
			const newStatus = decision === "approve" || decision === "resolved" ? "resolved" : "closed";

			await ticket.update({
				status: newStatus,
				resolutionNotes: notes,
				resolution: resolution || {},
				reviewedBy: reviewerId,
				reviewedAt: new Date(),
				closedAt: new Date(),
			}, { transaction });

			await transaction.commit();

			// Log audit event
			await CancellationAuditService.log({
				appointmentId: null,
				eventType: "appeal_resolved",
				actorId: reviewerId,
				actorType: "hr",
				eventData: {
					caseType: "support",
					caseId: ticketId,
					caseNumber: ticket.caseNumber,
					decision,
					resolution,
					notes,
				},
				previousState: { status: ticket.status },
				newState: { status: newStatus },
				req,
			});

			return {
				success: true,
				status: newStatus,
				caseNumber: ticket.caseNumber,
			};

		} catch (error) {
			await transaction.rollback();
			throw error;
		}
	}

	/**
	 * Get queue statistics
	 */
	static async getQueueStats(options = {}) {
		const { CancellationAppeal, HomeSizeAdjustmentRequest, PaymentDispute, SupportTicket, UserAppointments, User } = require("../models");
		const { Op } = require("sequelize");
		const { includeDemoData = false } = options;

		const now = new Date();

		// Build appointment filter for non-demo data
		const appointmentInclude = includeDemoData ? [] : [{
			model: UserAppointments,
			as: "appointment",
			where: { isDemoAppointment: { [Op.ne]: true } },
			required: true,
			attributes: [],
		}];

		// Build reporter filter for support tickets (non-demo reporters)
		const reporterInclude = includeDemoData ? [] : [{
			model: User,
			as: "reporter",
			where: { isDemoAccount: { [Op.ne]: true } },
			required: true,
			attributes: [],
		}];

		const [
			appealsPending,
			appealsPastSLA,
			appealsUrgent,
			appealsResolvedThisWeek,
			adjustmentsPending,
			adjustmentsPastExpiry,
			paymentDisputesPending,
			paymentDisputesPastSLA,
			supportTicketsPending,
			supportTicketsPastSLA,
		] = await Promise.all([
			CancellationAppeal.count({
				where: { status: ["submitted", "under_review", "awaiting_documents", "escalated"] },
				include: appointmentInclude,
			}),
			CancellationAppeal.count({
				where: {
					status: ["submitted", "under_review", "awaiting_documents"],
					slaDeadline: { [Op.lt]: now },
				},
				include: appointmentInclude,
			}),
			CancellationAppeal.count({
				where: {
					status: ["submitted", "under_review", "awaiting_documents", "escalated"],
					priority: "urgent",
				},
				include: appointmentInclude,
			}),
			CancellationAppeal.count({
				where: {
					status: ["approved", "partially_approved", "denied"],
					closedAt: { [Op.gte]: moment().subtract(7, "days").toDate() },
				},
				include: appointmentInclude,
			}),
			HomeSizeAdjustmentRequest.count({
				where: { status: ["pending_homeowner", "pending_owner"] },
				include: appointmentInclude,
			}),
			HomeSizeAdjustmentRequest.count({
				where: {
					status: ["pending_homeowner", "pending_owner"],
					expiresAt: { [Op.lt]: now },
				},
				include: appointmentInclude,
			}),
			PaymentDispute.count({
				where: { status: ["submitted", "under_review"] },
				include: appointmentInclude,
			}),
			PaymentDispute.count({
				where: {
					status: ["submitted", "under_review"],
					slaDeadline: { [Op.lt]: now },
				},
				include: appointmentInclude,
			}),
			SupportTicket.count({
				where: { status: ["submitted", "under_review", "pending_info"] },
				include: reporterInclude,
			}),
			SupportTicket.count({
				where: {
					status: ["submitted", "under_review", "pending_info"],
					slaDeadline: { [Op.lt]: now },
				},
				include: reporterInclude,
			}),
		]);

		return {
			totalPending: appealsPending + adjustmentsPending + paymentDisputesPending + supportTicketsPending,
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
			paymentDisputes: {
				pending: paymentDisputesPending,
				pastSLA: paymentDisputesPastSLA,
			},
			supportTickets: {
				pending: supportTicketsPending,
				pastSLA: supportTicketsPastSLA,
			},
			slaBreachCount: appealsPastSLA + adjustmentsPastExpiry + paymentDisputesPastSLA + supportTicketsPastSLA,
		};
	}

	/**
	 * Assign a case to a reviewer
	 */
	static async assignCase(caseId, caseType, assigneeId, assignerId, req) {
		const { CancellationAppeal, HomeSizeAdjustmentRequest, PaymentDispute, SupportTicket, User } = require("../models");

		// Validate assignee
		const assignee = await User.findByPk(assigneeId);
		if (!assignee || !["hr", "owner"].includes(assignee.type)) {
			throw new Error("Invalid assignee - must be HR or Owner");
		}

		let appointmentId;
		let caseNumber;

		if (caseType === "appeal") {
			const appeal = await CancellationAppeal.findByPk(caseId);
			if (!appeal) throw new Error("Appeal not found");
			appointmentId = appeal.appointmentId;
			caseNumber = appeal.caseNumber;

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
			caseNumber = adjustment.caseNumber;

			await adjustment.update({
				ownerId: assigneeId,
			});

		} else if (caseType === "payment") {
			const dispute = await PaymentDispute.findByPk(caseId);
			if (!dispute) throw new Error("Payment dispute not found");
			appointmentId = dispute.appointmentId;
			caseNumber = dispute.caseNumber;

			await dispute.update({
				assignedTo: assigneeId,
				assignedAt: new Date(),
				status: dispute.status === "submitted" ? "under_review" : dispute.status,
			});

		} else if (caseType === "support") {
			const ticket = await SupportTicket.findByPk(caseId);
			if (!ticket) throw new Error("Support ticket not found");
			appointmentId = null; // Support tickets don't have appointments
			caseNumber = ticket.caseNumber;

			await ticket.update({
				assignedTo: assigneeId,
				assignedAt: new Date(),
				status: ticket.status === "submitted" ? "under_review" : ticket.status,
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
				caseNumber,
			},
			req,
		});

		return { success: true };
	}

	/**
	 * Lookup case by case number (exact match)
	 */
	static async lookupByCaseNumber(caseNumber, options = {}) {
		const { includeDemoData = false } = options;
		const {
			CancellationAppeal,
			HomeSizeAdjustmentRequest,
			PaymentDispute,
			SupportTicket,
			UserAppointments,
			User,
		} = require("../models");
		const { Op } = require("sequelize");

		// Determine type from prefix
		const prefix = caseNumber.split("-")[0].toUpperCase();
		const typeMap = {
			APL: { model: CancellationAppeal, type: "appeal" },
			ADJ: { model: HomeSizeAdjustmentRequest, type: "adjustment" },
			PD: { model: PaymentDispute, type: "payment" },
			ST: { model: SupportTicket, type: "support" },
		};

		const config = typeMap[prefix];

		// Build include for demo filtering
		const getAppointmentInclude = (type) => {
			if (includeDemoData || type === "support") return [];
			return [{
				model: UserAppointments,
				as: "appointment",
				where: { isDemoAppointment: { [Op.ne]: true } },
				required: true,
				attributes: [],
			}];
		};

		const getReporterInclude = () => {
			if (includeDemoData) return [];
			return [{
				model: User,
				as: "reporter",
				where: { isDemoAccount: { [Op.ne]: true } },
				required: true,
				attributes: [],
			}];
		};

		if (!config) {
			// Try all models if prefix not recognized
			for (const [, c] of Object.entries(typeMap)) {
				const include = c.type === "support" ? getReporterInclude() : getAppointmentInclude(c.type);
				const result = await c.model.findOne({ where: { caseNumber }, include });
				if (result) {
					return this.getConflictCase(result.id, c.type);
				}
			}
			return null;
		}

		const include = config.type === "support" ? getReporterInclude() : getAppointmentInclude(config.type);
		const result = await config.model.findOne({ where: { caseNumber }, include });
		if (!result) return null;

		return this.getConflictCase(result.id, config.type);
	}

	/**
	 * Get all cases for a specific user
	 */
	static async getCasesForUser(userId, options = {}) {
		const { includeResolved = false, includeDemoData = false } = options;
		const {
			CancellationAppeal,
			HomeSizeAdjustmentRequest,
			PaymentDispute,
			SupportTicket,
			UserAppointments,
			User,
		} = require("../models");
		const { Op } = require("sequelize");

		const cases = [];

		// Get user info
		const user = await User.findByPk(userId, {
			attributes: ["id", "firstName", "lastName", "email", "phone", "type", "isDemoAccount"],
		});

		if (!user) {
			throw new Error("User not found");
		}

		// If user is a demo account and we're not including demo data, return empty
		if (user.isDemoAccount && !includeDemoData) {
			return cases;
		}

		// Build appointment include for demo filtering
		const appointmentInclude = includeDemoData ? [] : [{
			model: UserAppointments,
			as: "appointment",
			where: { isDemoAppointment: { [Op.ne]: true } },
			required: true,
			attributes: [],
		}];

		// Appeals where user is appealer
		const appealWhere = {
			appealerId: userId,
			...(includeResolved
				? {}
				: { status: { [Op.in]: ["submitted", "under_review", "awaiting_documents", "escalated"] } }),
		};

		const appeals = await CancellationAppeal.findAll({
			where: appealWhere,
			include: appointmentInclude,
			order: [["submittedAt", "DESC"]],
		});

		appeals.forEach((a) => {
			cases.push({
				id: a.id,
				caseType: "appeal",
				caseNumber: a.caseNumber,
				status: a.status,
				priority: a.priority,
				submittedAt: a.submittedAt,
				description: a.description?.substring(0, 100) + (a.description?.length > 100 ? "..." : ""),
			});
		});

		// Get user's appointments for other case types (excluding demo if needed)
		const appointmentWhere = { [Op.or]: [{ userId }, { bookedByCleanerId: userId }] };
		if (!includeDemoData) {
			appointmentWhere.isDemoAppointment = { [Op.ne]: true };
		}
		const userAppointments = await UserAppointments.findAll({
			where: appointmentWhere,
			attributes: ["id"],
		});
		const appointmentIds = userAppointments.map((a) => a.id);

		// Adjustments
		if (appointmentIds.length > 0) {
			const adjustments = await HomeSizeAdjustmentRequest.findAll({
				where: {
					[Op.or]: [
						{ homeownerId: userId },
						{ cleanerId: userId },
						{ appointmentId: { [Op.in]: appointmentIds } },
					],
					...(includeResolved ? {} : { status: { [Op.in]: ["pending_homeowner", "pending_owner"] } }),
				},
				include: appointmentInclude,
				order: [["createdAt", "DESC"]],
			});

			adjustments.forEach((a) => {
				cases.push({
					id: a.id,
					caseType: "adjustment",
					caseNumber: a.caseNumber,
					status: a.status,
					priority: "normal",
					submittedAt: a.createdAt,
					description: a.cleanerNote?.substring(0, 100) || "Home size adjustment",
				});
			});
		}

		// Payment disputes (cleaner only)
		const disputes = await PaymentDispute.findAll({
			where: {
				cleanerId: userId,
				...(includeResolved ? {} : { status: { [Op.in]: ["submitted", "under_review"] } }),
			},
			include: appointmentInclude,
			order: [["submittedAt", "DESC"]],
		});

		disputes.forEach((d) => {
			cases.push({
				id: d.id,
				caseType: "payment",
				caseNumber: d.caseNumber,
				status: d.status,
				priority: d.priority,
				submittedAt: d.submittedAt,
				description: d.description?.substring(0, 100) + (d.description?.length > 100 ? "..." : ""),
			});
		});

		// Support tickets
		const tickets = await SupportTicket.findAll({
			where: {
				subjectUserId: userId,
				...(includeResolved ? {} : { status: { [Op.in]: ["submitted", "under_review", "pending_info"] } }),
			},
			order: [["submittedAt", "DESC"]],
		});

		tickets.forEach((t) => {
			cases.push({
				id: t.id,
				caseType: "support",
				caseNumber: t.caseNumber,
				status: t.status,
				priority: t.priority,
				submittedAt: t.submittedAt,
				description: t.description?.substring(0, 100) + (t.description?.length > 100 ? "..." : ""),
			});
		});

		// Sort by submittedAt descending
		cases.sort((a, b) => new Date(b.submittedAt) - new Date(a.submittedAt));

		return cases;
	}

	/**
	 * Search for user by email/phone and get their cases
	 */
	static async searchUserAndCases(options) {
		const { User } = require("../models");
		const { Op } = require("sequelize");

		const { email, phone, query, includeDemoData = false } = options;
		let users = [];

		// Filter to exclude demo accounts if not including demo data
		const demoFilter = includeDemoData ? {} : { isDemoAccount: { [Op.ne]: true } };

		if (email) {
			// Search by email (case-insensitive)
			users = await User.findAll({
				where: {
					email: { [Op.iLike]: email.toLowerCase().trim() },
					...demoFilter,
				},
				attributes: ["id", "firstName", "lastName", "email", "phone", "type"],
			});
		} else if (phone) {
			// Search by phone (normalize by removing non-digits)
			const normalizedPhone = phone.replace(/\D/g, "");
			if (normalizedPhone.length >= 7) {
				users = await User.findAll({
					where: {
						phone: { [Op.like]: `%${normalizedPhone.slice(-10)}%` },
						...demoFilter,
					},
					attributes: ["id", "firstName", "lastName", "email", "phone", "type"],
				});
			}
		} else if (query) {
			// Try to determine if it's an ID, email, or phone
			const trimmedQuery = query.trim();

			if (/^\d+$/.test(trimmedQuery)) {
				// Numeric - treat as user ID
				const user = await User.findOne({
					where: { id: parseInt(trimmedQuery), ...demoFilter },
					attributes: ["id", "firstName", "lastName", "email", "phone", "type"],
				});
				if (user) users = [user];
			} else if (trimmedQuery.includes("@")) {
				// Email
				users = await User.findAll({
					where: {
						email: { [Op.iLike]: trimmedQuery.toLowerCase() },
						...demoFilter,
					},
					attributes: ["id", "firstName", "lastName", "email", "phone", "type"],
				});
			} else {
				// Try as phone
				const normalizedPhone = trimmedQuery.replace(/\D/g, "");
				if (normalizedPhone.length >= 7) {
					users = await User.findAll({
						where: {
							phone: { [Op.like]: `%${normalizedPhone.slice(-10)}%` },
							...demoFilter,
						},
						attributes: ["id", "firstName", "lastName", "email", "phone", "type"],
					});
				}

				// If no results, try name search
				if (users.length === 0) {
					users = await User.findAll({
						where: {
							[Op.or]: [
								{ firstName: { [Op.iLike]: `%${trimmedQuery}%` } },
								{ lastName: { [Op.iLike]: `%${trimmedQuery}%` } },
							],
							...demoFilter,
						},
						attributes: ["id", "firstName", "lastName", "email", "phone", "type"],
						limit: 10,
					});
				}
			}
		}

		if (users.length === 0) {
			return { users: [], results: [], totalCases: 0 };
		}

		// Get cases for all found users
		const allResults = [];
		let totalCases = 0;

		for (const user of users) {
			const userCases = await this.getCasesForUser(user.id, { includeResolved: true, includeDemoData });
			totalCases += userCases.length;

			allResults.push({
				user: {
					id: user.id,
					firstName: user.firstName,
					lastName: user.lastName,
					email: user.email,
					phone: user.phone,
					type: user.type,
				},
				cases: userCases,
				caseCount: userCases.length,
			});
		}

		return {
			users: allResults.map((r) => r.user),
			results: allResults,
			totalCases,
		};
	}
}

module.exports = ConflictResolutionService;
