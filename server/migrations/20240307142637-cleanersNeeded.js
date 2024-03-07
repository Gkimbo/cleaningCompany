"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
	up: async (queryInterface, Sequelize) => {
		// Add the cleanerAppointmentId column to the Users table
		await queryInterface.addColumn("UserHomes", "cleanersNeeded", {
			type: Sequelize.INTEGER,
			allowNull: true,
		});
	},

	down: async (queryInterface, Sequelize) => {
		await queryInterface.removeColumn("UserHomes", "cleanersNeeded");
	},
};
