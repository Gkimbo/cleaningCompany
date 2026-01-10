"use strict";

module.exports = {
	async up(queryInterface, Sequelize) {
		// Add isDemoAccount flag to identify demo accounts for preview mode
		await queryInterface.addColumn("Users", "isDemoAccount", {
			type: Sequelize.BOOLEAN,
			allowNull: false,
			defaultValue: false,
			comment: "True for demo accounts used in owner preview mode",
		});

		// Add index for quick lookup of demo accounts
		await queryInterface.addIndex("Users", ["isDemoAccount"], {
			name: "idx_users_is_demo_account",
			where: {
				isDemoAccount: true,
			},
		}).catch(() => {}); // Partial index might not work on all DBs
	},

	async down(queryInterface, Sequelize) {
		await queryInterface.removeIndex("Users", "idx_users_is_demo_account").catch(() => {});
		await queryInterface.removeColumn("Users", "isDemoAccount");
	},
};
