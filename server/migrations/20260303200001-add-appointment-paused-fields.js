"use strict";

module.exports = {
	async up(queryInterface, Sequelize) {
		await queryInterface.addColumn("UserAppointments", "isPaused", {
			type: Sequelize.BOOLEAN,
			allowNull: false,
			defaultValue: false,
			comment: "True if appointment is paused due to homeowner account freeze",
		});

		await queryInterface.addColumn("UserAppointments", "pausedAt", {
			type: Sequelize.DATE,
			allowNull: true,
			comment: "When the appointment was paused",
		});

		await queryInterface.addColumn("UserAppointments", "pauseReason", {
			type: Sequelize.STRING(100),
			allowNull: true,
			comment: "Reason for pausing (e.g., homeowner_account_frozen)",
		});
	},

	async down(queryInterface) {
		await queryInterface.removeColumn("UserAppointments", "isPaused");
		await queryInterface.removeColumn("UserAppointments", "pausedAt");
		await queryInterface.removeColumn("UserAppointments", "pauseReason");
	},
};
