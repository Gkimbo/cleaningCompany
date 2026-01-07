/**
 * BusinessVolumeService
 *
 * Handles volume tracking and large business fee eligibility checks for business owners.
 * Business owners who complete a high volume of cleanings per month qualify for reduced platform fees.
 */

const { BusinessVolumeStats, PricingConfig } = require("../models");

class BusinessVolumeService {
	/**
	 * Increment volume stats after a job completion
	 * @param {number} businessOwnerId - Business owner user ID
	 * @param {number} revenueInCents - Revenue from the completed job in cents
	 * @returns {Promise<Object>} Updated stats
	 */
	static async incrementVolumeStats(businessOwnerId, revenueInCents) {
		const now = new Date();
		const month = now.getMonth() + 1;
		const year = now.getFullYear();

		try {
			// Try to find existing record
			let stats = await BusinessVolumeStats.findOne({
				where: { businessOwnerId, month, year },
			});

			if (stats) {
				// Update existing record
				await stats.update({
					completedCleanings: stats.completedCleanings + 1,
					totalRevenue: stats.totalRevenue + revenueInCents,
					lastUpdatedAt: now,
				});
			} else {
				// Create new record
				stats = await BusinessVolumeStats.create({
					businessOwnerId,
					month,
					year,
					completedCleanings: 1,
					totalRevenue: revenueInCents,
					lastUpdatedAt: now,
				});
			}

			return {
				businessOwnerId,
				month,
				year,
				completedCleanings: stats.completedCleanings,
				totalRevenue: stats.totalRevenue,
			};
		} catch (error) {
			console.error("[BusinessVolumeService] Error incrementing volume stats:", error);
			// Don't throw - volume tracking should not block payout processing
			return null;
		}
	}

	/**
	 * Check if a business owner qualifies for the large business fee
	 * @param {number} businessOwnerId - Business owner user ID
	 * @returns {Promise<Object>} Qualification result with details
	 */
	static async qualifiesForLargeBusinessFee(businessOwnerId) {
		try {
			const config = await PricingConfig.getActive();
			const threshold = config?.largeBusinessMonthlyThreshold || 50;
			const lookbackMonths = config?.largeBusinessLookbackMonths || 1;

			// Get total cleanings over the lookback period
			const totalCleanings = await BusinessVolumeStats.getTotalCleanings(
				businessOwnerId,
				lookbackMonths
			);

			const qualifies = totalCleanings >= threshold;

			return {
				qualifies,
				totalCleanings,
				threshold,
				lookbackMonths,
				cleaningsNeeded: qualifies ? 0 : threshold - totalCleanings,
			};
		} catch (error) {
			console.error("[BusinessVolumeService] Error checking qualification:", error);
			// Default to not qualified if there's an error
			return {
				qualifies: false,
				totalCleanings: 0,
				threshold: 50,
				lookbackMonths: 1,
				cleaningsNeeded: 50,
				error: error.message,
			};
		}
	}

	/**
	 * Get the appropriate platform fee percentage for a business owner
	 * @param {number} businessOwnerId - Business owner user ID
	 * @returns {Promise<Object>} Fee details
	 */
	static async getBusinessFee(businessOwnerId) {
		const config = await PricingConfig.getActive();
		const qualification = await this.qualifiesForLargeBusinessFee(businessOwnerId);

		const regularBusinessFee = config?.businessOwnerFeePercent || 0.10;
		const largeBusinessFee = config?.largeBusinessFeePercent || 0.07;

		if (qualification.qualifies) {
			return {
				feePercent: largeBusinessFee,
				feeTier: "large_business",
				...qualification,
			};
		}

		return {
			feePercent: regularBusinessFee,
			feeTier: "business_owner",
			...qualification,
		};
	}

	/**
	 * Get volume stats for a business owner (for dashboard display)
	 * @param {number} businessOwnerId - Business owner user ID
	 * @param {number} months - Number of months to retrieve (default: 6)
	 * @returns {Promise<Object>} Volume stats and fee tier info
	 */
	static async getVolumeStats(businessOwnerId, months = 6) {
		const config = await PricingConfig.getActive();
		const stats = await BusinessVolumeStats.getRecentStats(businessOwnerId, months);
		const qualification = await this.qualifiesForLargeBusinessFee(businessOwnerId);

		const regularBusinessFee = config?.businessOwnerFeePercent || 0.10;
		const largeBusinessFee = config?.largeBusinessFeePercent || 0.07;

		return {
			businessOwnerId,
			monthlyStats: stats.map((s) => ({
				month: s.month,
				year: s.year,
				completedCleanings: s.completedCleanings,
				totalRevenue: s.totalRevenue,
				totalRevenueFormatted: `$${(s.totalRevenue / 100).toFixed(2)}`,
			})),
			currentTier: {
				tier: qualification.qualifies ? "large_business" : "business_owner",
				feePercent: qualification.qualifies ? largeBusinessFee : regularBusinessFee,
				feePercentFormatted: `${(qualification.qualifies ? largeBusinessFee : regularBusinessFee) * 100}%`,
			},
			qualification: {
				qualifies: qualification.qualifies,
				totalCleanings: qualification.totalCleanings,
				threshold: qualification.threshold,
				lookbackMonths: qualification.lookbackMonths,
				cleaningsNeeded: qualification.cleaningsNeeded,
			},
			tiers: {
				businessOwner: {
					feePercent: regularBusinessFee,
					feePercentFormatted: `${regularBusinessFee * 100}%`,
				},
				largeBusiness: {
					feePercent: largeBusinessFee,
					feePercentFormatted: `${largeBusinessFee * 100}%`,
					threshold: config?.largeBusinessMonthlyThreshold || 50,
				},
			},
		};
	}

	/**
	 * Recalculate volume stats from EmployeeJobAssignment records
	 * Useful for backfilling or correcting stats
	 * @param {number} businessOwnerId - Business owner user ID
	 * @param {number} months - Number of months to recalculate (default: 3)
	 * @returns {Promise<Object>} Recalculation result
	 */
	static async recalculateVolumeStats(businessOwnerId, months = 3) {
		const { EmployeeJobAssignment, UserAppointments, sequelize } = require("../models");
		const { Op } = require("sequelize");

		const now = new Date();
		const results = [];

		for (let i = 0; i < months; i++) {
			const targetDate = new Date(now.getFullYear(), now.getMonth() - i, 1);
			const month = targetDate.getMonth() + 1;
			const year = targetDate.getFullYear();

			// Calculate start and end of month
			const startDate = new Date(year, month - 1, 1);
			const endDate = new Date(year, month, 0); // Last day of month

			const startDateStr = startDate.toISOString().split("T")[0];
			const endDateStr = endDate.toISOString().split("T")[0];

			// Count completed assignments for this month
			const assignments = await EmployeeJobAssignment.findAll({
				where: {
					businessOwnerId,
					status: "completed",
				},
				include: [
					{
						model: UserAppointments,
						as: "appointment",
						where: {
							date: {
								[Op.gte]: startDateStr,
								[Op.lte]: endDateStr,
							},
						},
						attributes: ["price"],
					},
				],
			});

			const completedCleanings = assignments.length;
			const totalRevenue = assignments.reduce((sum, a) => {
				const price = parseFloat(a.appointment.price) * 100;
				return sum + Math.round(price);
			}, 0);

			// Upsert the stats record
			await BusinessVolumeStats.upsert({
				businessOwnerId,
				month,
				year,
				completedCleanings,
				totalRevenue,
				lastUpdatedAt: new Date(),
			});

			results.push({
				month,
				year,
				completedCleanings,
				totalRevenue,
			});
		}

		return {
			businessOwnerId,
			monthsRecalculated: months,
			results,
		};
	}
}

module.exports = BusinessVolumeService;
