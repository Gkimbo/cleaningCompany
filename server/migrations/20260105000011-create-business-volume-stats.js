"use strict";

module.exports = {
	up: async (queryInterface, Sequelize) => {
		await queryInterface.createTable("BusinessVolumeStats", {
			id: {
				type: Sequelize.INTEGER,
				allowNull: false,
				autoIncrement: true,
				primaryKey: true,
			},
			businessOwnerId: {
				type: Sequelize.INTEGER,
				allowNull: false,
				references: {
					model: "Users",
					key: "id",
				},
				onUpdate: "CASCADE",
				onDelete: "CASCADE",
			},
			month: {
				type: Sequelize.INTEGER,
				allowNull: false,
				comment: "Month (1-12)",
			},
			year: {
				type: Sequelize.INTEGER,
				allowNull: false,
				comment: "Year (e.g., 2026)",
			},
			completedCleanings: {
				type: Sequelize.INTEGER,
				allowNull: false,
				defaultValue: 0,
				comment: "Number of completed cleanings this month",
			},
			totalRevenue: {
				type: Sequelize.INTEGER,
				allowNull: false,
				defaultValue: 0,
				comment: "Total revenue in cents for this month",
			},
			lastUpdatedAt: {
				type: Sequelize.DATE,
				allowNull: false,
				defaultValue: Sequelize.literal("CURRENT_TIMESTAMP"),
			},
			createdAt: {
				type: Sequelize.DATE,
				allowNull: false,
				defaultValue: Sequelize.literal("CURRENT_TIMESTAMP"),
			},
			updatedAt: {
				type: Sequelize.DATE,
				allowNull: false,
				defaultValue: Sequelize.literal("CURRENT_TIMESTAMP"),
			},
		});

		// Unique index for business owner + month + year
		await queryInterface.addIndex("BusinessVolumeStats", ["businessOwnerId", "month", "year"], {
			unique: true,
			name: "business_volume_stats_owner_month_year_unique",
		});

		// Index for faster lookups by business owner
		await queryInterface.addIndex("BusinessVolumeStats", ["businessOwnerId"], {
			name: "business_volume_stats_owner_idx",
		});
	},

	down: async (queryInterface, Sequelize) => {
		await queryInterface.dropTable("BusinessVolumeStats");
	},
};
