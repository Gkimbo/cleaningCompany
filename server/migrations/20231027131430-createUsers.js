"use strict";

/** @type {import('sequelize-cli').Migration} */

module.exports = {
	up: async (queryInterface, Sequelize) => {
		await queryInterface.createTable("Users", {
			id: {
				type: Sequelize.INTEGER,
				allowNull: false,
				autoIncrement: true,
				primaryKey: true,
			},
			username: {
				type: Sequelize.STRING,
				allowNull: false,
				unique: true,
			},
			email: {
				type: Sequelize.STRING,
				allowNull: false,
				unique: true,
			},
			password: {
				type: Sequelize.STRING,
				allowNull: false,
			},
			lastLogin: {
				type: Sequelize.DATE,
				allowNull: true,
			},
			type: {
				type: Sequelize.STRING,
				allowNull: true,
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
		await queryInterface.sequelize.query("SET CONSTRAINTS ALL DEFERRED");
		await queryInterface.dropTable("Users");
		await queryInterface.sequelize.query("SET CONSTRAINTS ALL IMMEDIATE");
	},
};
