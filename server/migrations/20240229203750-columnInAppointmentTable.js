"use strict";

module.exports = {
	up: async (queryInterface, Sequelize) => {
		// Add the cleanerAppointmentId column to the Users table
		await queryInterface.addColumn("UserAppointments", "appointmentCleanerId", {
			type: Sequelize.INTEGER,
			allowNull: true,
			references: {
				model: "UserCleanerAppointments",
				key: "id",
				onDelete: "CASCADE",
			},
		});
	},

	down: async (queryInterface, Sequelize) => {
		// Remove the cleanerAppointmentId column from the Users table
		await queryInterface.sequelize.query("SET CONSTRAINTS ALL DEFERRED");
		await queryInterface.removeColumn(
			"UserAppointments",
			"appointmentCleanerId"
		);
		await queryInterface.sequelize.query("SET CONSTRAINTS ALL IMMEDIATE");
	},
};
