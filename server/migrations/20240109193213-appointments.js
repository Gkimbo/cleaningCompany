"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
	up: async (queryInterface, Sequelize) => {
		await queryInterface.createTable("UserAppointments", {
			id: {
				type: Sequelize.INTEGER,
				allowNull: false,
				autoIncrement: true,
				primaryKey: true,
			},
			userId: {
				type: Sequelize.INTEGER,
				allowNull: false,
				references: {
					model: "Users",
					key: "id",
					onDelete: "CASCADE",
				},
			},
			homeId: {
				type: Sequelize.INTEGER,
				allowNull: false,
				references: {
					model: "UserHomes",
					key: "id",
				},
			},
			date: {
				type: Sequelize.STRING,
				allowNull: false,
			},
			price: {
				type: Sequelize.STRING,
				allowNull: false,
			},
			paid: {
				type: Sequelize.BOOLEAN,
				allowNull: false,
			},
			bringTowels: {
				type: Sequelize.STRING,
				allowNull: false,
			},
			bringSheets: {
				type: Sequelize.STRING,
				allowNull: false,
			},
			createdAt: {
				type: Sequelize.DATE,
				allowNull: false,
				defaultValue: Sequelize.literal("CURRENT_TIMESTAMP"),
			},
			updatedAt: {
				type: Sequelize.DATE,
				allowNull: false,
				defaultValue: Sequelize.literal("CURRENT_TIMESTAMP"),
			},
		});
	},

	down: async (queryInterface, Sequelize) => {
		await queryInterface.dropTable("UserAppointments");
	},
};
