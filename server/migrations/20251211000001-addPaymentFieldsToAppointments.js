"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
	up: async (queryInterface, Sequelize) => {
		await queryInterface.addColumn("UserAppointments", "paymentIntentId", {
			type: Sequelize.STRING,
			allowNull: true,
		});
		await queryInterface.addColumn("UserAppointments", "paymentStatus", {
			type: Sequelize.STRING,
			allowNull: true,
			defaultValue: "pending",
		});
		await queryInterface.addColumn("UserAppointments", "amountPaid", {
			type: Sequelize.INTEGER,
			allowNull: true,
		});
	},

	down: async (queryInterface, Sequelize) => {
		await queryInterface.removeColumn("UserAppointments", "paymentIntentId");
		await queryInterface.removeColumn("UserAppointments", "paymentStatus");
		await queryInterface.removeColumn("UserAppointments", "amountPaid");
	},
};
