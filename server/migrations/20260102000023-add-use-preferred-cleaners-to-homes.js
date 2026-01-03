"use strict";

module.exports = {
	async up(queryInterface, Sequelize) {
		await queryInterface.addColumn("UserHomes", "usePreferredCleaners", {
			type: Sequelize.BOOLEAN,
			allowNull: false,
			defaultValue: true,
			comment:
				"When false, all cleaners can request jobs for this home (ignores preferred list)",
		});
	},

	async down(queryInterface) {
		await queryInterface.removeColumn("UserHomes", "usePreferredCleaners");
	},
};
