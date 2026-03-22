"use strict";

module.exports = {
	async up(queryInterface, Sequelize) {
		await queryInterface.addColumn("UserHomes", "timezone", {
			type: Sequelize.STRING(50),
			allowNull: true,
			defaultValue: null,
			comment: "IANA timezone identifier (e.g., America/New_York)",
		});

		// Add index for efficient queries by timezone
		await queryInterface.addIndex("UserHomes", ["timezone"], {
			name: "idx_homes_timezone",
		});
	},

	async down(queryInterface, Sequelize) {
		await queryInterface.removeIndex("UserHomes", "idx_homes_timezone");
		await queryInterface.removeColumn("UserHomes", "timezone");
	},
};
