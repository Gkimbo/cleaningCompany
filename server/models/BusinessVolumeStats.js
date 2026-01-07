/**
 * BusinessVolumeStats Model
 *
 * Tracks monthly cleaning volume per business owner for large business fee eligibility.
 * Updated after each completed job.
 */
module.exports = (sequelize, DataTypes) => {
	const BusinessVolumeStats = sequelize.define(
		"BusinessVolumeStats",
		{
			id: {
				type: DataTypes.INTEGER,
				allowNull: false,
				autoIncrement: true,
				primaryKey: true,
			},
			businessOwnerId: {
				type: DataTypes.INTEGER,
				allowNull: false,
				comment: "The business owner user ID",
			},
			month: {
				type: DataTypes.INTEGER,
				allowNull: false,
				validate: {
					min: 1,
					max: 12,
				},
				comment: "Month (1-12)",
			},
			year: {
				type: DataTypes.INTEGER,
				allowNull: false,
				comment: "Year (e.g., 2026)",
			},
			completedCleanings: {
				type: DataTypes.INTEGER,
				allowNull: false,
				defaultValue: 0,
				comment: "Number of completed cleanings this month",
			},
			totalRevenue: {
				type: DataTypes.INTEGER,
				allowNull: false,
				defaultValue: 0,
				comment: "Total revenue in cents for this month",
			},
			lastUpdatedAt: {
				type: DataTypes.DATE,
				allowNull: false,
				defaultValue: DataTypes.NOW,
			},
		},
		{
			tableName: "BusinessVolumeStats",
			indexes: [
				{
					unique: true,
					fields: ["businessOwnerId", "month", "year"],
					name: "business_volume_stats_owner_month_year_unique",
				},
				{
					fields: ["businessOwnerId"],
					name: "business_volume_stats_owner_idx",
				},
			],
		}
	);

	BusinessVolumeStats.associate = (models) => {
		BusinessVolumeStats.belongsTo(models.User, {
			foreignKey: "businessOwnerId",
			as: "businessOwner",
		});
	};

	/**
	 * Get or create stats record for a business owner for the current month
	 * @param {number} businessOwnerId - Business owner user ID
	 * @returns {Promise<BusinessVolumeStats>} Stats record
	 */
	BusinessVolumeStats.getOrCreateCurrentMonth = async (businessOwnerId) => {
		const now = new Date();
		const month = now.getMonth() + 1;
		const year = now.getFullYear();

		const [stats] = await BusinessVolumeStats.findOrCreate({
			where: { businessOwnerId, month, year },
			defaults: {
				businessOwnerId,
				month,
				year,
				completedCleanings: 0,
				totalRevenue: 0,
				lastUpdatedAt: now,
			},
		});

		return stats;
	};

	/**
	 * Get total cleanings for a business owner over a lookback period
	 * @param {number} businessOwnerId - Business owner user ID
	 * @param {number} lookbackMonths - Number of months to look back (default: 1)
	 * @returns {Promise<number>} Total completed cleanings
	 */
	BusinessVolumeStats.getTotalCleanings = async (businessOwnerId, lookbackMonths = 1) => {
		const { Op } = require("sequelize");
		const now = new Date();

		// Build array of month/year combinations to check
		const monthYearConditions = [];
		for (let i = 0; i < lookbackMonths; i++) {
			const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
			monthYearConditions.push({
				month: d.getMonth() + 1,
				year: d.getFullYear(),
			});
		}

		const stats = await BusinessVolumeStats.findAll({
			where: {
				businessOwnerId,
				[Op.or]: monthYearConditions,
			},
		});

		return stats.reduce((sum, s) => sum + s.completedCleanings, 0);
	};

	/**
	 * Get volume stats for display (last N months)
	 * @param {number} businessOwnerId - Business owner user ID
	 * @param {number} months - Number of months to retrieve (default: 3)
	 * @returns {Promise<Array>} Array of stats records
	 */
	BusinessVolumeStats.getRecentStats = async (businessOwnerId, months = 3) => {
		const { Op } = require("sequelize");
		const now = new Date();

		const monthYearConditions = [];
		for (let i = 0; i < months; i++) {
			const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
			monthYearConditions.push({
				month: d.getMonth() + 1,
				year: d.getFullYear(),
			});
		}

		return BusinessVolumeStats.findAll({
			where: {
				businessOwnerId,
				[Op.or]: monthYearConditions,
			},
			order: [
				["year", "DESC"],
				["month", "DESC"],
			],
		});
	};

	return BusinessVolumeStats;
};
