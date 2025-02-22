"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
	up: async (queryInterface, Sequelize) => {
		// Add the cleanerAppointmentId column to the Users table
		await queryInterface.addColumn("Users", "notifications", {
			type: Sequelize.ARRAY(Sequelize.STRING),
				allowNull: true,
		});
	},

	down: async (queryInterface, Sequelize) => {
		await queryInterface.removeColumn("Users", "notifications");
	},
};

