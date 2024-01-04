"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
	up: async (queryInterface, Sequelize) => {
		await queryInterface.createTable("UserHomes", {
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
					model: "Users", // name of the table
					key: "id", // column in the table
				},
			},
			address: {
				type: Sequelize.STRING,
				allowNull: false,
			},
			city: {
				type: Sequelize.STRING,
				allowNull: false,
			},
			zipcode: {
				type: Sequelize.STRING,
				allowNull: false,
			},
			numBeds: {
				type: Sequelize.STRING,
				allowNull: true,
			},
			numBaths: {
				type: Sequelize.STRING,
				allowNull: true,
			},
			sheetsProvided: {
				type: Sequelize.STRING,
				allowNull: true,
			},
			towelsProvided: {
				type: Sequelize.STRING,
				allowNull: true,
			},
			keyPadCode: {
				type: Sequelize.STRING,
				allowNull: true,
			},
			keyLocation: {
				type: Sequelize.STRING,
				allowNull: true,
			},
			recyclingLocation: {
				type: Sequelize.STRING,
				allowNull: true,
			},
			compostLocation: {
				type: Sequelize.STRING,
				allowNull: true,
			},
			trashLocation: {
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
		await queryInterface.dropTable("UserHomes");
	},
};
