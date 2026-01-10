/**
 * JobLedgerService
 *
 * Provides accounting ledger functionality for job financials.
 * Implements double-entry accounting principles with Stripe reconciliation.
 */

const moment = require("moment");
const Stripe = require("stripe");

class JobLedgerService {
	/**
	 * Record a single ledger entry
	 */
	static async record(options) {
		const { JobLedger } = require("../models");

		const {
			appointmentId,
			entryType,
			amount,
			direction,
			accountType,
			partyType,
			partyUserId,
			description,
			stripeObjectType,
			stripeObjectId,
			paymentRecordId,
			payoutRecordId,
			appealId,
			metadata = {},
			taxReportable = false,
			memo,
			createdBy,
			transaction,
		} = options;

		const effectiveDate = options.effectiveDate || new Date();
		const taxYear = effectiveDate.getFullYear();
		const taxQuarter = Math.ceil((effectiveDate.getMonth() + 1) / 3);

		return JobLedger.create({
			appointmentId,
			entryType,
			amount: Math.abs(amount),
			direction,
			accountType,
			partyType,
			partyUserId,
			stripeObjectType,
			stripeObjectId,
			paymentRecordId,
			payoutRecordId,
			appealId,
			description,
			memo,
			metadata,
			taxYear,
			taxQuarter,
			taxReportable,
			taxCategory: this.getTaxCategory(entryType),
			form1099Eligible: partyType === "cleaner" && amount >= 60000, // $600+
			effectiveDate,
			postedAt: new Date(),
			createdBy,
		}, { transaction });
	}

	/**
	 * Record booking revenue with all line items
	 */
	static async recordBooking(appointmentId, details, transaction = null) {
		const { sequelize } = require("../models");

		const entries = [];
		const t = transaction || await sequelize.transaction();

		try {
			const { homeownerId, basePrice, addOns, totalAmount, stripePaymentIntentId, paymentRecordId } = details;

			// Base revenue
			entries.push(await this.record({
				appointmentId,
				entryType: "booking_revenue",
				amount: basePrice,
				direction: "credit",
				accountType: "revenue",
				partyType: "homeowner",
				partyUserId: homeownerId,
				stripeObjectType: "payment_intent",
				stripeObjectId: stripePaymentIntentId,
				paymentRecordId,
				description: "Booking revenue - base cleaning",
				taxReportable: true,
				transaction: t,
			}));

			// Add-on entries
			for (const addon of (addOns || [])) {
				const entryType = this.getAddonEntryType(addon.type);
				entries.push(await this.record({
					appointmentId,
					entryType,
					amount: addon.amount,
					direction: "credit",
					accountType: "revenue",
					partyType: "homeowner",
					partyUserId: homeownerId,
					stripeObjectType: "payment_intent",
					stripeObjectId: stripePaymentIntentId,
					paymentRecordId,
					description: `Add-on: ${addon.label}`,
					taxReportable: true,
					transaction: t,
				}));
			}

			if (!transaction) await t.commit();
			return entries;

		} catch (error) {
			if (!transaction) await t.rollback();
			throw error;
		}
	}

	/**
	 * Record cancellation with all related entries
	 */
	static async recordCancellation(appointmentId, details, transaction = null) {
		const { sequelize } = require("../models");

		const entries = [];
		const t = transaction || await sequelize.transaction();

		try {
			const {
				homeownerId,
				refundAmount,
				refundPercentage,
				cancellationFee,
				cleanerPayouts,
				stripeDetails,
				originalAmount,
			} = details;

			// Refund to homeowner
			if (refundAmount > 0) {
				entries.push(await this.record({
					appointmentId,
					entryType: refundAmount === originalAmount ? "cancellation_refund" : "cancellation_partial_refund",
					amount: refundAmount,
					direction: "debit",
					accountType: "refunds_payable",
					partyType: "homeowner",
					partyUserId: homeownerId,
					stripeObjectType: "refund",
					stripeObjectId: stripeDetails?.refundId,
					description: `Cancellation refund - ${refundPercentage || 100}%`,
					taxCategory: "refund",
					transaction: t,
				}));
			}

			// Cancellation fee revenue
			if (cancellationFee > 0) {
				entries.push(await this.record({
					appointmentId,
					entryType: "cancellation_fee_revenue",
					amount: cancellationFee,
					direction: "credit",
					accountType: "platform_revenue",
					partyType: "homeowner",
					partyUserId: homeownerId,
					stripeObjectType: stripeDetails?.feeChargeId ? "charge" : null,
					stripeObjectId: stripeDetails?.feeChargeId,
					description: "Cancellation fee",
					taxReportable: true,
					taxCategory: "income",
					transaction: t,
				}));
			}

			// Cleaner payouts (may be multiple for multi-cleaner jobs)
			for (const payout of (cleanerPayouts || [])) {
				if (payout.netAmount > 0) {
					// Cleaner receives
					entries.push(await this.record({
						appointmentId,
						entryType: "cleaner_payout_cancellation",
						amount: payout.netAmount,
						direction: "debit",
						accountType: "payouts_payable",
						partyType: "cleaner",
						partyUserId: payout.cleanerId,
						payoutRecordId: payout.payoutRecordId,
						description: "Cancellation compensation payout",
						taxReportable: true,
						taxCategory: "payout",
						transaction: t,
					}));

					// Platform fee from payout
					if (payout.platformFee > 0) {
						entries.push(await this.record({
							appointmentId,
							entryType: "platform_fee_standard",
							amount: payout.platformFee,
							direction: "credit",
							accountType: "platform_revenue",
							partyType: "platform",
							description: "Platform fee from cancellation payout",
							taxReportable: true,
							taxCategory: "income",
							transaction: t,
						}));
					}
				}
			}

			// Stripe fees
			if (stripeDetails?.stripeFees > 0) {
				entries.push(await this.record({
					appointmentId,
					entryType: "stripe_fee",
					amount: stripeDetails.stripeFees,
					direction: "debit",
					accountType: "stripe_fees",
					partyType: "stripe",
					description: "Payment processing fees",
					taxReportable: true,
					taxCategory: "expense",
					transaction: t,
				}));
			}

			if (!transaction) await t.commit();
			return entries;

		} catch (error) {
			if (!transaction) await t.rollback();
			throw error;
		}
	}

	/**
	 * Record appeal resolution entries
	 */
	static async recordAppealResolution(appointmentId, appealId, resolution, transaction = null) {
		const { sequelize } = require("../models");

		const entries = [];
		const t = transaction || await sequelize.transaction();

		try {
			const { homeownerId, refundAmount, feeReversal, stripeDetails } = resolution;

			// Refund from appeal
			if (refundAmount > 0) {
				entries.push(await this.record({
					appointmentId,
					entryType: "appeal_refund",
					amount: refundAmount,
					direction: "debit",
					accountType: "refunds_payable",
					partyType: "homeowner",
					partyUserId: homeownerId,
					appealId,
					stripeObjectType: "refund",
					stripeObjectId: stripeDetails?.refundId,
					description: "Appeal resolution refund",
					transaction: t,
				}));
			}

			// Fee reversal
			if (feeReversal > 0) {
				entries.push(await this.record({
					appointmentId,
					entryType: "appeal_fee_reversal",
					amount: feeReversal,
					direction: "debit",
					accountType: "platform_revenue",
					partyType: "homeowner",
					partyUserId: homeownerId,
					appealId,
					stripeObjectType: "refund",
					stripeObjectId: stripeDetails?.feeRefundId,
					description: "Appeal - cancellation fee reversal",
					transaction: t,
				}));
			}

			if (!transaction) await t.commit();
			return entries;

		} catch (error) {
			if (!transaction) await t.rollback();
			throw error;
		}
	}

	/**
	 * Get complete ledger for a job
	 */
	static async getJobLedger(appointmentId) {
		const { JobLedger } = require("../models");

		const entries = await JobLedger.findAll({
			where: { appointmentId },
			order: [["effectiveDate", "ASC"], ["postedAt", "ASC"]],
		});

		return {
			appointmentId,
			entries: entries.map(e => ({
				id: e.id,
				type: e.entryType,
				amount: e.amount,
				direction: e.direction,
				account: e.accountType,
				party: e.partyType,
				description: e.description,
				stripeId: e.stripeObjectId,
				effectiveDate: e.effectiveDate,
				reconciled: e.reconciled,
			})),
			summary: this.calculateSummary(entries),
			balance: this.calculateBalance(entries),
		};
	}

	/**
	 * Calculate summary totals
	 */
	static calculateSummary(entries) {
		const byType = {};

		entries.forEach(e => {
			if (!byType[e.entryType]) {
				byType[e.entryType] = { count: 0, total: 0 };
			}
			byType[e.entryType].count++;
			byType[e.entryType].total += e.amount;
		});

		return {
			totalRevenue: entries
				.filter(e => e.direction === "credit" && e.accountType.includes("revenue"))
				.reduce((sum, e) => sum + e.amount, 0),

			totalRefunds: entries
				.filter(e => e.entryType.includes("refund"))
				.reduce((sum, e) => sum + e.amount, 0),

			totalPayouts: entries
				.filter(e => e.partyType === "cleaner")
				.reduce((sum, e) => sum + e.amount, 0),

			netPlatformRevenue: entries
				.filter(e => e.accountType === "platform_revenue")
				.reduce((sum, e) => e.direction === "credit" ? sum + e.amount : sum - e.amount, 0),

			byEntryType: byType,
		};
	}

	/**
	 * Calculate running balance
	 */
	static calculateBalance(entries) {
		let balance = 0;
		entries.forEach(e => {
			if (e.direction === "credit") {
				balance += e.amount;
			} else {
				balance -= e.amount;
			}
		});
		return balance;
	}

	/**
	 * Generate accounting report
	 */
	static async generateReport(options = {}) {
		const { JobLedger } = require("../models");
		const { Op } = require("sequelize");

		const { startDate, endDate, groupBy = "entryType", taxYear, taxQuarter } = options;

		const where = {};
		if (startDate && endDate) {
			where.effectiveDate = { [Op.between]: [startDate, endDate] };
		}
		if (taxYear) where.taxYear = taxYear;
		if (taxQuarter) where.taxQuarter = taxQuarter;

		const entries = await JobLedger.findAll({
			where,
			order: [["effectiveDate", "ASC"]],
		});

		// Group and aggregate
		const grouped = {};
		entries.forEach(e => {
			const key = e[groupBy];
			if (!grouped[key]) {
				grouped[key] = { count: 0, debits: 0, credits: 0 };
			}
			grouped[key].count++;
			if (e.direction === "debit") grouped[key].debits += e.amount;
			else grouped[key].credits += e.amount;
		});

		return {
			dateRange: { startDate, endDate },
			taxPeriod: { taxYear, taxQuarter },
			totalEntries: entries.length,
			totals: {
				debits: entries.filter(e => e.direction === "debit").reduce((s, e) => s + e.amount, 0),
				credits: entries.filter(e => e.direction === "credit").reduce((s, e) => s + e.amount, 0),
			},
			grouped,
			generatedAt: new Date(),
		};
	}

	/**
	 * Reconciliation with Stripe
	 */
	static async reconcile(batchId = null) {
		const { JobLedger } = require("../models");
		const { Op } = require("sequelize");

		const batch = batchId || `RECON-${moment().format("YYYYMMDD-HHmmss")}`;

		const unreconciledEntries = await JobLedger.findAll({
			where: {
				reconciled: false,
				stripeObjectId: { [Op.ne]: null },
			},
			limit: 100,
		});

		const results = { matched: 0, mismatched: 0, errors: 0, batch };

		for (const entry of unreconciledEntries) {
			try {
				const stripeObject = await this.fetchStripeObject(entry.stripeObjectType, entry.stripeObjectId);
				const matches = this.compareAmounts(entry, stripeObject);

				await entry.update({
					reconciled: matches,
					reconciledAt: new Date(),
					reconciliationBatch: batch,
					discrepancyAmount: matches ? 0 : Math.abs(entry.amount - (stripeObject?.amount || 0)),
					discrepancyNotes: matches ? null : `Stripe amount: ${stripeObject?.amount || "not found"}`,
				});

				if (matches) results.matched++;
				else results.mismatched++;

			} catch (error) {
				results.errors++;
				await entry.update({
					reconciliationBatch: batch,
					discrepancyNotes: `Error: ${error.message}`,
				});
			}
		}

		return results;
	}

	/**
	 * Fetch Stripe object for reconciliation
	 */
	static async fetchStripeObject(objectType, objectId) {
		if (!objectType || !objectId) return null;

		const stripe = Stripe(process.env.STRIPE_SECRET_KEY);

		switch (objectType) {
		case "payment_intent":
			return stripe.paymentIntents.retrieve(objectId);
		case "charge":
			return stripe.charges.retrieve(objectId);
		case "refund":
			return stripe.refunds.retrieve(objectId);
		case "transfer":
			return stripe.transfers.retrieve(objectId);
		default:
			return null;
		}
	}

	/**
	 * Compare ledger entry amount with Stripe object
	 */
	static compareAmounts(entry, stripeObject) {
		if (!stripeObject) return false;
		return entry.amount === stripeObject.amount;
	}

	/**
	 * Get add-on entry type
	 */
	static getAddonEntryType(addonType) {
		const mapping = {
			linens: "addon_linens",
			timeWindow: "addon_time_window",
			highVolume: "addon_high_volume",
			lastMinute: "addon_last_minute",
		};
		return mapping[addonType] || "booking_revenue";
	}

	/**
	 * Get tax category for entry type
	 */
	static getTaxCategory(entryType) {
		if (entryType.includes("refund") || entryType.includes("reversal")) return "refund";
		if (entryType.includes("payout")) return "payout";
		if (entryType.includes("fee") && entryType !== "stripe_fee") return "income";
		if (entryType.includes("revenue")) return "income";
		if (entryType === "stripe_fee") return "expense";
		return "other";
	}

	/**
	 * Record conflict resolution refund
	 */
	static async recordConflictRefund(appointmentId, caseId, caseType, details, transaction = null) {
		const { amount, reason, stripeRefundId, reviewerId } = details;

		return this.record({
			appointmentId,
			entryType: "conflict_refund",
			amount,
			direction: "debit",
			accountType: "refunds_payable",
			partyType: "homeowner",
			stripeObjectType: "refund",
			stripeObjectId: stripeRefundId,
			description: `Conflict resolution refund - ${caseType} #${caseId}: ${reason}`,
			metadata: { caseId, caseType, reason, reviewerId },
			taxCategory: "refund",
			createdBy: reviewerId,
			transaction,
		});
	}

	/**
	 * Record conflict resolution payout to cleaner
	 */
	static async recordConflictPayout(appointmentId, caseId, caseType, details, transaction = null) {
		const { cleanerId, amount, reason, stripeTransferId, reviewerId } = details;

		return this.record({
			appointmentId,
			entryType: "conflict_payout",
			amount,
			direction: "debit",
			accountType: "payouts_payable",
			partyType: "cleaner",
			partyUserId: cleanerId,
			stripeObjectType: "transfer",
			stripeObjectId: stripeTransferId,
			description: `Conflict resolution payout - ${caseType} #${caseId}: ${reason}`,
			metadata: { caseId, caseType, reason, reviewerId },
			taxReportable: true,
			taxCategory: "payout",
			createdBy: reviewerId,
			transaction,
		});
	}

	/**
	 * Get 1099 report for a cleaner
	 */
	static async get1099Report(cleanerId, taxYear) {
		const { JobLedger } = require("../models");

		const entries = await JobLedger.findAll({
			where: {
				partyUserId: cleanerId,
				partyType: "cleaner",
				taxYear,
			},
			order: [["effectiveDate", "ASC"]],
		});

		const total = entries.reduce((sum, e) => sum + e.amount, 0);

		return {
			cleanerId,
			taxYear,
			totalPayments: total,
			totalPaymentsFormatted: `$${(total / 100).toFixed(2)}`,
			form1099Required: total >= 60000, // $600+
			entries: entries.map(e => ({
				date: e.effectiveDate,
				type: e.entryType,
				amount: e.amount,
				appointmentId: e.appointmentId,
			})),
		};
	}
}

module.exports = JobLedgerService;
