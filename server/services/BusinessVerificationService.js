/**
 * BusinessVerificationService
 *
 * Handles verification of business owners for marketplace highlighting.
 * Verified businesses get priority placement in search results and
 * "Verified Business" badges.
 *
 * Qualification criteria:
 * - Active business owner status
 * - Minimum 10 exclusive clients (CleanerClient with status='active')
 * - Good standing (no account freezes)
 * - Average rating above threshold (4.0)
 */

const { Op, fn, col } = require("sequelize");

// Configuration
const VERIFICATION_CONFIG = {
	minActiveClients: 10,
	minAverageRating: 4.0,
	minCompletedJobs: 20,
	ratingLookbackMonths: 12,
};

class BusinessVerificationService {
	/**
	 * Check if a business owner is eligible for verification
	 * @param {number} userId - Business owner user ID
	 * @returns {Promise<Object>} Eligibility status and details
	 */
	static async checkVerificationEligibility(userId) {
		const {
			User,
			CleanerClient,
			UserReviews,
			EmployeeJobAssignment,
			UserAppointments,
		} = require("../models");

		try {
			// Get user and check business owner status
			const user = await User.findByPk(userId, {
				attributes: [
					"id",
					"firstName",
					"lastName",
					"isBusinessOwner",
					"businessName",
					"yearsInBusiness",
					"accountFrozen",
					"businessVerificationStatus",
					"businessVerifiedAt",
				],
			});

			if (!user) {
				return {
					eligible: false,
					reason: "User not found",
					criteria: null,
				};
			}

			if (!user.isBusinessOwner) {
				return {
					eligible: false,
					reason: "User is not a business owner",
					criteria: null,
				};
			}

			if (user.accountFrozen) {
				return {
					eligible: false,
					reason: "Account is frozen",
					criteria: null,
				};
			}

			// If already verified, still return criteria for display
			const isAlreadyVerified = user.businessVerificationStatus === "verified";

			// Count active clients
			const activeClientCount = await CleanerClient.count({
				where: {
					cleanerId: userId,
					status: "active",
				},
			});

			// Get average rating from reviews
			const ratingLookback = new Date();
			ratingLookback.setMonth(ratingLookback.getMonth() - VERIFICATION_CONFIG.ratingLookbackMonths);

			const ratingResult = await UserReviews.findOne({
				attributes: [
					[fn("AVG", col("review")), "avgRating"],
					[fn("COUNT", col("id")), "reviewCount"],
				],
				where: {
					userId,
					reviewType: "homeowner_to_cleaner",
					createdAt: { [Op.gte]: ratingLookback },
				},
				raw: true,
			});

			const avgRating = ratingResult?.avgRating ? parseFloat(ratingResult.avgRating) : null;
			const reviewCount = parseInt(ratingResult?.reviewCount) || 0;

			// Count completed jobs
			const completedJobsCount = await EmployeeJobAssignment.count({
				where: {
					businessOwnerId: userId,
					status: "completed",
				},
			});

			// Build criteria object
			const criteria = {
				activeClients: {
					current: activeClientCount,
					required: VERIFICATION_CONFIG.minActiveClients,
					met: activeClientCount >= VERIFICATION_CONFIG.minActiveClients,
				},
				averageRating: {
					current: avgRating,
					required: VERIFICATION_CONFIG.minAverageRating,
					met: avgRating !== null && avgRating >= VERIFICATION_CONFIG.minAverageRating,
					reviewCount,
				},
				accountStanding: {
					frozen: user.accountFrozen,
					met: !user.accountFrozen,
				},
				completedJobs: {
					current: completedJobsCount,
					required: VERIFICATION_CONFIG.minCompletedJobs,
					met: completedJobsCount >= VERIFICATION_CONFIG.minCompletedJobs,
				},
			};

			// Check if all criteria are met
			const allCriteriaMet =
				criteria.activeClients.met &&
				criteria.averageRating.met &&
				criteria.accountStanding.met &&
				criteria.completedJobs.met;

			// Determine reason if not eligible
			let reason = null;
			if (!allCriteriaMet) {
				const failedCriteria = [];
				if (!criteria.activeClients.met) {
					failedCriteria.push(`Need ${VERIFICATION_CONFIG.minActiveClients - activeClientCount} more active clients`);
				}
				if (!criteria.averageRating.met) {
					if (avgRating === null) {
						failedCriteria.push("Not enough reviews for rating calculation");
					} else {
						failedCriteria.push(`Rating ${avgRating.toFixed(1)} below ${VERIFICATION_CONFIG.minAverageRating} threshold`);
					}
				}
				if (!criteria.completedJobs.met) {
					failedCriteria.push(`Need ${VERIFICATION_CONFIG.minCompletedJobs - completedJobsCount} more completed jobs`);
				}
				reason = failedCriteria.join("; ");
			}

			return {
				eligible: allCriteriaMet,
				alreadyVerified: isAlreadyVerified,
				reason,
				criteria,
				businessName: user.businessName,
				yearsInBusiness: user.yearsInBusiness,
			};
		} catch (error) {
			console.error("[BusinessVerificationService] Eligibility check error:", error);
			throw error;
		}
	}

	/**
	 * Get current verification status for a business owner
	 * @param {number} userId - Business owner user ID
	 * @returns {Promise<Object>} Current status and profile
	 */
	static async getVerificationStatus(userId) {
		const { User, CleanerClient } = require("../models");

		try {
			const user = await User.findByPk(userId, {
				attributes: [
					"id",
					"firstName",
					"lastName",
					"isBusinessOwner",
					"businessName",
					"yearsInBusiness",
					"businessVerificationStatus",
					"businessVerifiedAt",
					"businessDescription",
					"businessHighlightOptIn",
				],
			});

			if (!user) {
				return { found: false };
			}

			// Get active client count
			const activeClientCount = await CleanerClient.count({
				where: {
					cleanerId: userId,
					status: "active",
				},
			});

			return {
				found: true,
				userId: user.id,
				isBusinessOwner: user.isBusinessOwner,
				businessName: user.businessName,
				yearsInBusiness: user.yearsInBusiness,
				verificationStatus: user.businessVerificationStatus || "none",
				verifiedAt: user.businessVerifiedAt?.toISOString() || null,
				businessDescription: user.businessDescription,
				highlightOptIn: user.businessHighlightOptIn || false,
				activeClientCount,
				isVerified: user.businessVerificationStatus === "verified",
			};
		} catch (error) {
			console.error("[BusinessVerificationService] Get status error:", error);
			throw error;
		}
	}

	/**
	 * Request verification (user-initiated)
	 * @param {number} userId - Business owner user ID
	 * @returns {Promise<Object>} Request result
	 */
	static async requestVerification(userId) {
		const { User } = require("../models");

		try {
			// Check eligibility first
			const eligibility = await this.checkVerificationEligibility(userId);

			if (eligibility.alreadyVerified) {
				return {
					success: false,
					error: "Business is already verified",
				};
			}

			if (!eligibility.eligible) {
				return {
					success: false,
					error: "Business does not meet verification criteria",
					criteria: eligibility.criteria,
					reason: eligibility.reason,
				};
			}

			// Update status to pending
			const user = await User.findByPk(userId);
			await user.update({
				businessVerificationStatus: "pending",
			});

			return {
				success: true,
				status: "pending",
				message: "Verification request submitted for review",
				criteria: eligibility.criteria,
			};
		} catch (error) {
			console.error("[BusinessVerificationService] Request verification error:", error);
			throw error;
		}
	}

	/**
	 * Update verification status (admin function)
	 * @param {number} userId - Business owner user ID
	 * @param {string} newStatus - 'verified' or 'none'
	 * @param {number} adminId - Admin performing the action
	 * @param {string} reason - Reason for the decision (optional)
	 * @returns {Promise<Object>} Update result
	 */
	static async updateVerificationStatus(userId, newStatus, adminId, reason = null) {
		const { User } = require("../models");

		if (!["verified", "none"].includes(newStatus)) {
			throw new Error("Invalid status. Must be 'verified' or 'none'");
		}

		try {
			const user = await User.findByPk(userId);
			if (!user) {
				throw new Error("User not found");
			}

			if (!user.isBusinessOwner) {
				throw new Error("User is not a business owner");
			}

			const updates = {
				businessVerificationStatus: newStatus,
			};

			if (newStatus === "verified") {
				updates.businessVerifiedAt = new Date();
			} else {
				updates.businessVerifiedAt = null;
			}

			await user.update(updates);

			// Log the action
			console.log(
				`[BusinessVerificationService] User ${userId} verification status updated to ${newStatus} by admin ${adminId}. Reason: ${reason || "N/A"}`
			);

			return {
				success: true,
				userId,
				newStatus,
				verifiedAt: updates.businessVerifiedAt?.toISOString() || null,
			};
		} catch (error) {
			console.error("[BusinessVerificationService] Update status error:", error);
			throw error;
		}
	}

	/**
	 * Quick check if a user is a verified business
	 * @param {number} userId - User ID
	 * @returns {Promise<boolean>} True if verified
	 */
	static async isVerifiedBusiness(userId) {
		const { User } = require("../models");

		try {
			const user = await User.findByPk(userId, {
				attributes: ["businessVerificationStatus", "isBusinessOwner", "accountFrozen"],
			});

			return (
				user &&
				user.isBusinessOwner &&
				user.businessVerificationStatus === "verified" &&
				!user.accountFrozen
			);
		} catch (error) {
			console.error("[BusinessVerificationService] isVerifiedBusiness error:", error);
			return false;
		}
	}

	/**
	 * Get all verified businesses (for marketplace prioritization)
	 * @param {Object} options - Filter options
	 * @returns {Promise<Array>} List of verified businesses
	 */
	static async getVerifiedBusinesses(options = {}) {
		const { User, CleanerClient } = require("../models");

		const { highlightOptIn = true, limit = 50 } = options;

		try {
			const whereClause = {
				isBusinessOwner: true,
				businessVerificationStatus: "verified",
				accountFrozen: false,
			};

			if (highlightOptIn) {
				whereClause.businessHighlightOptIn = true;
			}

			const businesses = await User.findAll({
				where: whereClause,
				attributes: [
					"id",
					"firstName",
					"lastName",
					"businessName",
					"yearsInBusiness",
					"businessDescription",
					"businessVerifiedAt",
					"serviceAreaLatitude",
					"serviceAreaLongitude",
					"serviceAreaRadiusMiles",
				],
				limit,
				order: [["businessVerifiedAt", "DESC"]],
			});

			// Enrich with client counts
			const enrichedBusinesses = await Promise.all(
				businesses.map(async (business) => {
					const clientCount = await CleanerClient.count({
						where: {
							cleanerId: business.id,
							status: "active",
						},
					});

					return {
						userId: business.id,
						name: `${business.firstName} ${business.lastName}`,
						businessName: business.businessName,
						yearsInBusiness: business.yearsInBusiness,
						description: business.businessDescription,
						verifiedAt: business.businessVerifiedAt?.toISOString() || null,
						activeClientCount: clientCount,
						serviceArea: {
							latitude: business.serviceAreaLatitude,
							longitude: business.serviceAreaLongitude,
							radiusMiles: parseFloat(business.serviceAreaRadiusMiles) || 30,
						},
					};
				})
			);

			return enrichedBusinesses;
		} catch (error) {
			console.error("[BusinessVerificationService] Get verified businesses error:", error);
			throw error;
		}
	}

	/**
	 * Update business profile information
	 * @param {number} userId - Business owner user ID
	 * @param {Object} profileData - Profile updates
	 * @returns {Promise<Object>} Updated profile
	 */
	static async updateBusinessProfile(userId, profileData) {
		const { User } = require("../models");

		const { businessDescription, businessHighlightOptIn } = profileData;

		try {
			const user = await User.findByPk(userId);
			if (!user) {
				throw new Error("User not found");
			}

			if (!user.isBusinessOwner) {
				throw new Error("User is not a business owner");
			}

			const updates = {};
			if (businessDescription !== undefined) {
				updates.businessDescription = businessDescription;
			}
			if (businessHighlightOptIn !== undefined) {
				updates.businessHighlightOptIn = businessHighlightOptIn;
			}

			await user.update(updates);

			return {
				success: true,
				businessDescription: user.businessDescription,
				businessHighlightOptIn: user.businessHighlightOptIn,
			};
		} catch (error) {
			console.error("[BusinessVerificationService] Update profile error:", error);
			throw error;
		}
	}

	/**
	 * Get verification configuration (for displaying requirements)
	 * @returns {Object} Configuration values
	 */
	static getVerificationConfig() {
		return { ...VERIFICATION_CONFIG };
	}
}

module.exports = BusinessVerificationService;
