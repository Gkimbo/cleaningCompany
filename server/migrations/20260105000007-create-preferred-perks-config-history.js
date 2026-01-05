"use strict";

module.exports = {
	up: async (queryInterface, Sequelize) => {
		await queryInterface.createTable("PreferredPerksConfigHistories", {
			id: {
				type: Sequelize.INTEGER,
				allowNull: false,
				autoIncrement: true,
				primaryKey: true,
			},
			configId: {
				type: Sequelize.INTEGER,
				allowNull: false,
				references: {
					model: "PreferredPerksConfigs",
					key: "id",
				},
				onUpdate: "CASCADE",
				onDelete: "CASCADE",
			},
			changedBy: {
				type: Sequelize.INTEGER,
				allowNull: true,
				references: {
					model: "Users",
					key: "id",
				},
				onUpdate: "CASCADE",
				onDelete: "SET NULL",
			},
			changeType: {
				type: Sequelize.ENUM("create", "update"),
				allowNull: false,
				defaultValue: "update",
			},
			changes: {
				type: Sequelize.JSONB,
				allowNull: false,
				defaultValue: {},
			},
			previousValues: {
				type: Sequelize.JSONB,
				allowNull: true,
			},
			newValues: {
				type: Sequelize.JSONB,
				allowNull: false,
			},
			createdAt: {
				type: Sequelize.DATE,
				allowNull: false,
				defaultValue: Sequelize.literal("CURRENT_TIMESTAMP"),
			},
		});

		// Add index for faster lookups by configId
		await queryInterface.addIndex("PreferredPerksConfigHistories", ["configId"]);
		await queryInterface.addIndex("PreferredPerksConfigHistories", ["changedBy"]);
		await queryInterface.addIndex("PreferredPerksConfigHistories", ["createdAt"]);
	},

	down: async (queryInterface, Sequelize) => {
		await queryInterface.dropTable("PreferredPerksConfigHistories");
	},
};
