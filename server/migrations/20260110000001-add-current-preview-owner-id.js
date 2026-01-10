"use strict";

module.exports = {
	async up(queryInterface, Sequelize) {
		await queryInterface.addColumn("Users", "currentPreviewOwnerId", {
			type: Sequelize.INTEGER,
			allowNull: true,
			comment: "For demo accounts: ID of owner currently previewing as this account (for email redirection)",
		});
	},

	async down(queryInterface, Sequelize) {
		await queryInterface.removeColumn("Users", "currentPreviewOwnerId");
	},
};
