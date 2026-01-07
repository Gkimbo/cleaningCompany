/**
 * CleanerPreferredPerksSerializer
 * Serializes cleaner preferred perk status for API responses
 */

class CleanerPreferredPerksSerializer {
	/**
	 * Serialize a single perk record
	 * @param {Object} perks - CleanerPreferredPerks model instance
	 * @returns {Object} Serialized perk data
	 */
	static serializeOne(perks) {
		if (!perks) return null;

		const data = perks.dataValues || perks;

		return {
			id: data.id,
			cleanerId: data.cleanerId,
			tierLevel: data.tierLevel,
			preferredHomeCount: data.preferredHomeCount,
			bonusPercent: data.bonusPercent ? parseFloat(data.bonusPercent) : 0,
			fasterPayouts: data.fasterPayouts,
			payoutHours: data.payoutHours,
			earlyAccess: data.earlyAccess,
			lastCalculatedAt: data.lastCalculatedAt,
			createdAt: data.createdAt,
			updatedAt: data.updatedAt,
		};
	}

	/**
	 * Serialize an array of perk records
	 * @param {Array} perksArray - Array of CleanerPreferredPerks instances
	 * @returns {Array} Serialized array
	 */
	static serializeArray(perksArray) {
		return perksArray.map((perks) => this.serializeOne(perks));
	}

	/**
	 * Serialize perk status for cleaner dashboard display
	 * Includes next tier info and benefits
	 * @param {Object} perkStatus - Perk status from PreferredCleanerPerksService.getCleanerPerkStatus()
	 * @returns {Object} Serialized perk status for display
	 */
	static serializeForDashboard(perkStatus) {
		if (!perkStatus) {
			return {
				tier: "bronze",
				preferredHomeCount: 0,
				bonusPercent: 0,
				fasterPayouts: false,
				payoutHours: 48,
				earlyAccess: false,
				nextTier: "silver",
				homesNeededForNextTier: 3,
				tierBenefits: ["Build your reputation", "Become preferred at more homes to unlock perks"],
			};
		}

		return {
			cleanerId: perkStatus.cleanerId,
			tier: perkStatus.tier,
			tierDisplayName: this.getTierDisplayName(perkStatus.tier),
			preferredHomeCount: perkStatus.preferredHomeCount,
			bonusPercent: perkStatus.bonusPercent,
			fasterPayouts: perkStatus.fasterPayouts,
			payoutHours: perkStatus.payoutHours,
			earlyAccess: perkStatus.earlyAccess,
			nextTier: perkStatus.nextTier,
			nextTierDisplayName: perkStatus.nextTier ? this.getTierDisplayName(perkStatus.nextTier) : null,
			homesNeededForNextTier: perkStatus.homesNeededForNextTier,
			tierBenefits: perkStatus.tierBenefits,
			lastCalculatedAt: perkStatus.lastCalculatedAt,
		};
	}

	/**
	 * Get display name for tier
	 * @param {string} tier - Tier level
	 * @returns {string} Display name
	 */
	static getTierDisplayName(tier) {
		const displayNames = {
			bronze: "Bronze",
			silver: "Silver",
			gold: "Gold",
			platinum: "Platinum",
		};
		return displayNames[tier] || tier;
	}

	/**
	 * Serialize tier info for tier information display
	 * @param {Object} tierInfo - Tier info from API response
	 * @returns {Object} Serialized tier info
	 */
	static serializeTierInfo(tierInfo) {
		if (!tierInfo || !tierInfo.tiers) {
			return { tiers: [] };
		}

		return {
			tiers: tierInfo.tiers.map((tier) => ({
				name: tier.name,
				displayName: this.getTierDisplayName(tier.name),
				minHomes: tier.minHomes,
				maxHomes: tier.maxHomes,
				bonusPercent: tier.bonusPercent,
				fasterPayouts: tier.fasterPayouts || false,
				payoutHours: tier.payoutHours || 48,
				earlyAccess: tier.earlyAccess || false,
				benefits: tier.benefits,
			})),
		};
	}

	/**
	 * Serialize perk summary for admin/owner view
	 * @param {Object} perks - CleanerPreferredPerks model instance
	 * @param {Object} cleaner - User model instance (optional)
	 * @returns {Object} Serialized perk summary
	 */
	static serializeForAdminView(perks, cleaner = null) {
		const serialized = this.serializeOne(perks);

		if (cleaner) {
			const cleanerData = cleaner.dataValues || cleaner;
			serialized.cleaner = {
				id: cleanerData.id,
				firstName: cleanerData.firstName,
				lastName: cleanerData.lastName,
				email: cleanerData.email,
			};
		}

		// Add tier display info
		serialized.tierDisplayName = this.getTierDisplayName(serialized.tierLevel);

		return serialized;
	}

	/**
	 * Serialize perk badge info (minimal data for UI badges)
	 * @param {Object} perks - CleanerPreferredPerks model instance or perk status
	 * @returns {Object} Minimal perk badge data
	 */
	static serializeBadge(perks) {
		if (!perks) {
			return {
				tier: "bronze",
				displayName: "Bronze",
				bonusPercent: 0,
				preferredHomeCount: 0,
			};
		}

		const data = perks.dataValues || perks;

		return {
			tier: data.tierLevel || data.tier,
			displayName: this.getTierDisplayName(data.tierLevel || data.tier),
			bonusPercent: data.bonusPercent ? parseFloat(data.bonusPercent) : 0,
			preferredHomeCount: data.preferredHomeCount,
		};
	}
}

module.exports = CleanerPreferredPerksSerializer;
