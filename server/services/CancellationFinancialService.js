/**
 * CancellationFinancialService
 *
 * Provides detailed financial breakdowns for cancellations.
 * Generates itemized responses showing all charges, refunds, and payouts.
 */

const moment = require("moment");
const crypto = require("crypto");

class CancellationFinancialService {
	/**
	 * Build complete financial breakdown for a cancellation
	 */
	static async buildFullBreakdown(appointment, cancellationDetails) {
		const {
			daysUntilAppointment,
			isWithinPenaltyWindow,
			isWithinFeeWindow,
			refundAmount,
			refundPercentage,
			cancellationFee,
			cleanerPayout,
			stripeDetails,
			cancelledBy,
		} = cancellationDetails;

		const originalCharges = await this.buildOriginalCharges(appointment);
		const confirmationId = this.generateConfirmationId();

		return {
			confirmationId,

			appointment: {
				id: appointment.id,
				date: appointment.date,
				address: this.formatAddress(appointment.home),
				scheduledTime: appointment.time || appointment.timeWindow || "Scheduled time",
			},

			cancellation: {
				initiatedAt: new Date().toISOString(),
				confirmedAt: new Date().toISOString(),
				cancelledBy,
				daysBeforeAppointment: daysUntilAppointment,
				withinPenaltyWindow: isWithinPenaltyWindow,
				withinFeeWindow: isWithinFeeWindow,
			},

			financialBreakdown: {
				originalCharges,
				refund: this.buildRefundSection(appointment, refundAmount, refundPercentage, isWithinPenaltyWindow, stripeDetails),
				cancellationFee: this.buildFeeSection(cancellationFee, isWithinFeeWindow, stripeDetails),
				cleanerCompensation: this.buildCleanerSection(appointment, cleanerPayout),
				platformSummary: this.buildPlatformSummary(originalCharges.totalCharged, cancellationFee, cleanerPayout, stripeDetails),
				summary: this.buildUserSummary(originalCharges.totalCharged, refundAmount, cancellationFee),
			},

			appeal: this.buildAppealSection(daysUntilAppointment, isWithinPenaltyWindow || isWithinFeeWindow),

			taxInfo: {
				taxYear: new Date().getFullYear(),
				deductible: false,
				receiptAvailable: true,
				receiptUrl: `/api/v1/receipts/${confirmationId}`,
			},
		};
	}

	/**
	 * Build original charges breakdown
	 */
	static async buildOriginalCharges(appointment) {
		const basePrice = parseInt(appointment.price) * 100 || 0;
		const addOns = [];

		// Parse linens
		if (appointment.linens) {
			const linens = typeof appointment.linens === "string"
				? JSON.parse(appointment.linens)
				: appointment.linens;

			const linenFee = this.calculateLinenFee(linens, appointment);
			if (linenFee > 0) {
				addOns.push({
					type: "linens",
					label: this.formatLinenLabel(linens),
					amount: linenFee,
				});
			}
		}

		// Time window fee
		if (appointment.timeWindowFee && parseFloat(appointment.timeWindowFee) > 0) {
			addOns.push({
				type: "timeWindow",
				label: `${appointment.timeWindow || "Specific"} Time Window`,
				amount: Math.round(parseFloat(appointment.timeWindowFee) * 100),
			});
		}

		// High volume fee
		if (appointment.highVolumeFee && parseFloat(appointment.highVolumeFee) > 0) {
			addOns.push({
				type: "highVolume",
				label: "Peak Demand Period",
				amount: Math.round(parseFloat(appointment.highVolumeFee) * 100),
			});
		}

		// Last minute fee
		if (appointment.lastMinuteFee && parseFloat(appointment.lastMinuteFee) > 0) {
			addOns.push({
				type: "lastMinute",
				label: "Last-Minute Booking Fee",
				amount: Math.round(parseFloat(appointment.lastMinuteFee) * 100),
			});
		}

		const addOnsSubtotal = addOns.reduce((sum, a) => sum + a.amount, 0);

		// Calculate actual total charged if available
		const totalCharged = appointment.amountPaid
			? appointment.amountPaid
			: basePrice + addOnsSubtotal;

		return {
			baseCleaningPrice: basePrice,
			addOns,
			addOnsSubtotal,
			totalCharged,
		};
	}

	/**
	 * Build refund section
	 */
	static buildRefundSection(appointment, refundAmount, refundPercentage, isWithinPenaltyWindow, stripeDetails) {
		const totalCharged = appointment.amountPaid || parseInt(appointment.price) * 100;

		if (!refundAmount || refundAmount <= 0) {
			return {
				eligible: false,
				amount: 0,
				reason: "No refund applicable for this cancellation",
			};
		}

		let reason = isWithinPenaltyWindow
			? `Cancelled within penalty window (Policy: ${refundPercentage}% refund)`
			: "Full refund - cancelled outside penalty window";

		return {
			eligible: true,
			calculation: {
				basis: totalCharged,
				percentage: refundPercentage,
				reason,
			},
			amount: refundAmount,
			method: this.formatPaymentMethod(stripeDetails?.paymentMethod),
			estimatedArrival: "3-5 business days",
			stripeRefundId: stripeDetails?.refundId || null,
		};
	}

	/**
	 * Build cancellation fee section
	 */
	static buildFeeSection(cancellationFee, isWithinFeeWindow, stripeDetails) {
		if (!cancellationFee || cancellationFee <= 0) {
			return {
				applicable: false,
				amount: 0,
				reason: "No cancellation fee - cancelled outside fee window",
			};
		}

		return {
			applicable: true,
			amount: cancellationFee,
			reason: "Cancelled within cancellation window",
			status: stripeDetails?.feeChargeId ? "charged" :
				stripeDetails?.feeAddedToBill ? "added_to_bill" : "pending",
			paymentMethod: stripeDetails?.feeChargeId
				? this.formatPaymentMethod(stripeDetails?.paymentMethod)
				: "Added to next bill",
			stripeChargeId: stripeDetails?.feeChargeId || null,
		};
	}

	/**
	 * Build cleaner compensation section
	 */
	static buildCleanerSection(appointment, cleanerPayout) {
		if (!cleanerPayout || cleanerPayout.netAmount <= 0) {
			return {
				applicable: false,
				reason: "No cleaner compensation - cancellation policy",
			};
		}

		const cleanerCount = appointment.employeesAssigned?.length || 1;
		const platformFeePercent = cleanerPayout.platformFeePercent || 10;

		return {
			applicable: true,
			reason: "Cleaner held time slot - compensated per policy",
			calculation: {
				baseAmount: cleanerPayout.grossAmount || cleanerPayout.netAmount,
				platformFee: cleanerPayout.platformFee || 0,
				platformFeePercent,
			},
			netPayout: cleanerPayout.netAmount,
			cleanerCount,
			perCleanerAmount: cleanerCount > 1
				? Math.floor(cleanerPayout.netAmount / cleanerCount)
				: cleanerPayout.netAmount,
			payoutSchedule: "Next payout cycle (Fridays)",
			status: "pending",
		};
	}

	/**
	 * Build platform summary section
	 */
	static buildPlatformSummary(totalCharged, cancellationFee, cleanerPayout, stripeDetails) {
		const platformFee = cleanerPayout?.platformFee || 0;
		const stripeFees = stripeDetails?.stripeFees || Math.round(totalCharged * 0.029 + 30);

		return {
			cancellationFeeRetained: cancellationFee || 0,
			platformFeeFromPayout: platformFee,
			totalPlatformRevenue: (cancellationFee || 0) + platformFee,
			stripeFees,
			netPlatformRevenue: (cancellationFee || 0) + platformFee - stripeFees,
		};
	}

	/**
	 * Build user-facing summary section
	 */
	static buildUserSummary(totalCharged, refundAmount, cancellationFee) {
		const netCost = totalCharged - (refundAmount || 0) + (cancellationFee || 0);

		return {
			youOriginallyPaid: totalCharged,
			youWillReceive: refundAmount || 0,
			cancellationFeeCharged: cancellationFee || 0,
			yourNetCost: netCost,
		};
	}

	/**
	 * Build appeal section
	 */
	static buildAppealSection(daysUntilAppointment, hasFinancialImpact) {
		const deadline = moment().add(72, "hours");

		return {
			available: hasFinancialImpact,
			deadline: deadline.toISOString(),
			deadlineFormatted: deadline.format("MMMM D, YYYY [at] h:mm A"),
			reasons: [
				"Medical emergency",
				"Family emergency",
				"Natural disaster",
				"Property issue",
				"Other valid reason",
			],
			message: hasFinancialImpact
				? "If this cancellation was due to circumstances beyond your control, you may submit an appeal for review within 72 hours."
				: "No fees were charged for this cancellation.",
			documentsRecommended: true,
		};
	}

	/**
	 * Generate unique confirmation ID
	 */
	static generateConfirmationId() {
		const date = moment().format("YYYY-MMDD");
		const random = crypto.randomBytes(3).toString("hex").toUpperCase();
		return `CXL-${date}-${random}`;
	}

	/**
	 * Format address for display
	 */
	static formatAddress(home) {
		if (!home) return "Address unavailable";
		const parts = [home.address];
		if (home.city) parts.push(home.city);
		if (home.state) parts.push(home.state);
		return parts.join(", ");
	}

	/**
	 * Format payment method for display
	 */
	static formatPaymentMethod(paymentMethod) {
		if (!paymentMethod) return "Original payment method";
		if (typeof paymentMethod === "string") return paymentMethod;
		const brand = paymentMethod.brand || "Card";
		const last4 = paymentMethod.last4 || "****";
		return `${brand.charAt(0).toUpperCase() + brand.slice(1)} •••• ${last4}`;
	}

	/**
	 * Calculate linen fee
	 */
	static calculateLinenFee(linens, appointment) {
		if (!linens) return 0;

		// If already calculated, use that
		if (appointment.linensCharge) {
			return Math.round(parseFloat(appointment.linensCharge) * 100);
		}

		// Simple estimate based on linen count
		let fee = 0;
		if (linens.sheets) fee += linens.sheets * 500; // $5 per sheet set
		if (linens.towels) fee += linens.towels * 200; // $2 per towel set
		return fee;
	}

	/**
	 * Format linen label for display
	 */
	static formatLinenLabel(linens) {
		if (!linens) return "Linen Service";
		const parts = [];
		if (linens.sheets) parts.push(`${linens.sheets} sheet set${linens.sheets > 1 ? "s" : ""}`);
		if (linens.towels) parts.push(`${linens.towels} towel set${linens.towels > 1 ? "s" : ""}`);
		return parts.length > 0 ? `Linen Service (${parts.join(", ")})` : "Linen Service";
	}

	/**
	 * Format amount in cents to dollars
	 */
	static formatCurrency(cents) {
		return `$${(cents / 100).toFixed(2)}`;
	}

	/**
	 * Generate receipt data for PDF/email
	 */
	static generateReceiptData(breakdown) {
		return {
			confirmationId: breakdown.confirmationId,
			date: moment().format("MMMM D, YYYY"),
			time: moment().format("h:mm A"),

			appointment: breakdown.appointment,

			lineItems: [
				{
					description: "Original Cleaning Service",
					amount: breakdown.financialBreakdown.originalCharges.baseCleaningPrice,
				},
				...breakdown.financialBreakdown.originalCharges.addOns.map(addon => ({
					description: addon.label,
					amount: addon.amount,
				})),
			],

			subtotal: breakdown.financialBreakdown.originalCharges.totalCharged,

			adjustments: [
				breakdown.financialBreakdown.refund.eligible && {
					description: `Refund (${breakdown.financialBreakdown.refund.calculation.percentage}%)`,
					amount: -breakdown.financialBreakdown.refund.amount,
				},
				breakdown.financialBreakdown.cancellationFee.applicable && {
					description: "Cancellation Fee",
					amount: breakdown.financialBreakdown.cancellationFee.amount,
				},
			].filter(Boolean),

			total: breakdown.financialBreakdown.summary.yourNetCost,

			appealInfo: breakdown.appeal.available ? {
				deadline: breakdown.appeal.deadlineFormatted,
				message: breakdown.appeal.message,
			} : null,
		};
	}
}

module.exports = CancellationFinancialService;
