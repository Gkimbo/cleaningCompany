"use strict";

module.exports = {
	up: async (queryInterface, Sequelize) => {
		// Add large business fee fields to PricingConfigs
		await queryInterface.addColumn("PricingConfigs", "largeBusinessFeePercent", {
			type: Sequelize.DECIMAL(3, 2),
			allowNull: false,
			defaultValue: 0.07,
			comment: "Platform fee for large volume business owners (0.07 = 7%)",
		});

		await queryInterface.addColumn("PricingConfigs", "largeBusinessMonthlyThreshold", {
			type: Sequelize.INTEGER,
			allowNull: false,
			defaultValue: 50,
			comment: "Minimum completed cleanings per month to qualify for large business fee",
		});

		await queryInterface.addColumn("PricingConfigs", "largeBusinessLookbackMonths", {
			type: Sequelize.INTEGER,
			allowNull: false,
			defaultValue: 1,
			comment: "Number of months to look back for volume calculation",
		});
	},

	down: async (queryInterface, Sequelize) => {
		await queryInterface.removeColumn("PricingConfigs", "largeBusinessFeePercent");
		await queryInterface.removeColumn("PricingConfigs", "largeBusinessMonthlyThreshold");
		await queryInterface.removeColumn("PricingConfigs", "largeBusinessLookbackMonths");
	},
};
