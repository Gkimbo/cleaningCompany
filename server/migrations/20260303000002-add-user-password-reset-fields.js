"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
	async up(queryInterface, Sequelize) {
		// Add passwordResetAt field
		await queryInterface.addColumn("Users", "passwordResetAt", {
			type: Sequelize.DATE,
			allowNull: true,
			comment: "Timestamp when password was last reset via forgot-password flow",
		});

		// Add requirePasswordChange field
		await queryInterface.addColumn("Users", "requirePasswordChange", {
			type: Sequelize.BOOLEAN,
			allowNull: false,
			defaultValue: false,
			comment: "If true, user must change password on next login",
		});
	},

	async down(queryInterface) {
		await queryInterface.removeColumn("Users", "passwordResetAt");
		await queryInterface.removeColumn("Users", "requirePasswordChange");
	},
};
