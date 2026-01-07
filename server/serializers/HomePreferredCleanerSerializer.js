/**
 * HomePreferredCleanerSerializer
 * Serializes preferred cleaner records for homes
 */

const EncryptionService = require("../services/EncryptionService");

class HomePreferredCleanerSerializer {
	/**
	 * Decrypt user field if encrypted
	 * @param {string} value - Potentially encrypted value
	 * @returns {string|null} Decrypted value
	 */
	static decryptField(value) {
		if (!value) return null;
		return EncryptionService.decrypt(value);
	}

	/**
	 * Serialize a single preferred cleaner record
	 * @param {Object} record - HomePreferredCleaner model instance
	 * @returns {Object} Serialized record
	 */
	static serializeOne(record) {
		if (!record) return null;

		const data = record.dataValues || record;

		const serialized = {
			id: data.id,
			homeId: data.homeId,
			cleanerId: data.cleanerId,
			preferenceLevel: data.preferenceLevel || "preferred",
			priority: data.priority || 0,
			setAt: data.setAt,
			setBy: data.setBy,
			createdAt: data.createdAt,
			updatedAt: data.updatedAt,
		};

		// Include cleaner info if available
		if (record.cleaner) {
			serialized.cleaner = this.serializeCleaner(record.cleaner);
		}

		// Include home info if available
		if (record.home) {
			serialized.home = this.serializeHome(record.home);
		}

		return serialized;
	}

	/**
	 * Serialize cleaner user info
	 * @param {Object} cleaner - User model instance
	 * @returns {Object} Serialized cleaner info
	 */
	static serializeCleaner(cleaner) {
		if (!cleaner) return null;

		const data = cleaner.dataValues || cleaner;

		return {
			id: data.id,
			firstName: this.decryptField(data.firstName),
			lastName: this.decryptField(data.lastName),
			email: this.decryptField(data.email),
			phone: this.decryptField(data.phone),
		};
	}

	/**
	 * Serialize home info
	 * @param {Object} home - UserHomes model instance
	 * @returns {Object} Serialized home info
	 */
	static serializeHome(home) {
		if (!home) return null;

		const data = home.dataValues || home;

		return {
			id: data.id,
			nickName: data.nickName,
			address: this.decryptField(data.address),
			city: this.decryptField(data.city),
			state: this.decryptField(data.state),
		};
	}

	/**
	 * Serialize an array of preferred cleaner records
	 * @param {Array} records - Array of HomePreferredCleaner instances
	 * @returns {Array} Serialized array
	 */
	static serializeArray(records) {
		return records.map((record) => this.serializeOne(record));
	}

	/**
	 * Serialize for cleaner's preferred homes list
	 * Shows homes where cleaner has preferred status
	 * @param {Object} record - HomePreferredCleaner with home included
	 * @returns {Object} Serialized for cleaner view
	 */
	static serializeForCleanerView(record) {
		if (!record) return null;

		const data = record.dataValues || record;

		const serialized = {
			homeId: data.homeId,
			preferenceLevel: data.preferenceLevel || "preferred",
			priority: data.priority || 0,
			setAt: data.setAt,
			setBy: data.setBy,
		};

		// Include home details
		if (record.home) {
			const homeData = record.home.dataValues || record.home;
			serialized.home = {
				id: homeData.id,
				nickName: homeData.nickName,
				address: this.decryptField(homeData.address),
				city: this.decryptField(homeData.city),
				state: this.decryptField(homeData.state),
				numBeds: homeData.numBeds,
				numBaths: homeData.numBaths,
			};

			// Include homeowner info if available
			if (record.home.owner || record.home.user) {
				const owner = record.home.owner || record.home.user;
				const ownerData = owner.dataValues || owner;
				serialized.home.owner = {
					id: ownerData.id,
					firstName: this.decryptField(ownerData.firstName),
					lastName: this.decryptField(ownerData.lastName),
				};
			}
		}

		return serialized;
	}

	/**
	 * Serialize for homeowner's preferred cleaners list
	 * Shows cleaners who are preferred for a home
	 * @param {Object} record - HomePreferredCleaner with cleaner included
	 * @param {Object} stats - Optional stats from PreferredCleanerService
	 * @returns {Object} Serialized for homeowner view
	 */
	static serializeForHomeownerView(record, stats = null) {
		if (!record) return null;

		const data = record.dataValues || record;

		const serialized = {
			id: data.id,
			cleanerId: data.cleanerId,
			preferenceLevel: data.preferenceLevel || "preferred",
			preferenceLevelDisplay: this.getPreferenceLevelDisplay(data.preferenceLevel),
			priority: data.priority || 0,
			setAt: data.setAt,
			setBy: data.setBy,
			setByDisplay: this.getSetByDisplay(data.setBy),
		};

		// Include cleaner details
		if (record.cleaner) {
			serialized.cleaner = this.serializeCleaner(record.cleaner);
		}

		// Include stats if provided
		if (stats) {
			serialized.stats = {
				totalBookings: stats.totalBookings,
				avgDurationMinutes: stats.avgDurationMinutes,
				avgReviewScore: stats.avgReviewScore,
				lastCleaningDate: stats.lastCleaningDate,
				preferredSince: stats.preferredSince,
			};
		}

		return serialized;
	}

	/**
	 * Get display name for preference level
	 * @param {string} level - Preference level
	 * @returns {string} Display name
	 */
	static getPreferenceLevelDisplay(level) {
		const displays = {
			preferred: "Preferred",
			favorite: "Favorite",
		};
		return displays[level] || "Preferred";
	}

	/**
	 * Get display name for setBy source
	 * @param {string} setBy - Source of preference
	 * @returns {string} Display name
	 */
	static getSetByDisplay(setBy) {
		const displays = {
			review: "After Review",
			settings: "Manual Selection",
			invitation: "Via Invitation",
		};
		return displays[setBy] || setBy;
	}

	/**
	 * Serialize for admin/owner dashboard
	 * @param {Object} record - HomePreferredCleaner with cleaner and home
	 * @returns {Object} Serialized for admin view
	 */
	static serializeForAdminView(record) {
		if (!record) return null;

		const serialized = this.serializeOne(record);
		serialized.preferenceLevelDisplay = this.getPreferenceLevelDisplay(serialized.preferenceLevel);
		serialized.setByDisplay = this.getSetByDisplay(serialized.setBy);

		return serialized;
	}

	/**
	 * Serialize preferred cleaners grouped by preference level
	 * @param {Array} records - Array of HomePreferredCleaner instances
	 * @returns {Object} Records grouped by preference level
	 */
	static serializeGroupedByLevel(records) {
		const preferred = [];
		const favorite = [];

		records.forEach((record) => {
			const data = record.dataValues || record;
			const serialized = this.serializeForHomeownerView(record);

			if (data.preferenceLevel === "favorite") {
				favorite.push(serialized);
			} else {
				preferred.push(serialized);
			}
		});

		// Sort by priority within each group
		preferred.sort((a, b) => (a.priority || 0) - (b.priority || 0));
		favorite.sort((a, b) => (a.priority || 0) - (b.priority || 0));

		return {
			preferred,
			favorite,
			total: records.length,
			preferredCount: preferred.length,
			favoriteCount: favorite.length,
		};
	}

	/**
	 * Serialize summary for home
	 * @param {Array} records - Array of HomePreferredCleaner for a home
	 * @returns {Object} Summary info
	 */
	static serializeSummary(records) {
		if (!records || records.length === 0) {
			return {
				hasPreferredCleaners: false,
				totalCount: 0,
				preferredCount: 0,
				favoriteCount: 0,
				primaryCleanerId: null,
			};
		}

		const preferred = records.filter((r) => {
			const data = r.dataValues || r;
			return data.preferenceLevel !== "favorite";
		});

		const favorite = records.filter((r) => {
			const data = r.dataValues || r;
			return data.preferenceLevel === "favorite";
		});

		// Get primary cleaner (lowest priority preferred cleaner)
		const sortedPreferred = [...preferred].sort((a, b) => {
			const aData = a.dataValues || a;
			const bData = b.dataValues || b;
			return (aData.priority || 0) - (bData.priority || 0);
		});

		const primaryCleaner = sortedPreferred[0];
		const primaryData = primaryCleaner ? (primaryCleaner.dataValues || primaryCleaner) : null;

		return {
			hasPreferredCleaners: records.length > 0,
			totalCount: records.length,
			preferredCount: preferred.length,
			favoriteCount: favorite.length,
			primaryCleanerId: primaryData?.cleanerId || null,
		};
	}
}

module.exports = HomePreferredCleanerSerializer;
