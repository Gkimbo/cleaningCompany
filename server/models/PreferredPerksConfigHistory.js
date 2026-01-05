module.exports = (sequelize, DataTypes) => {
	const PreferredPerksConfigHistory = sequelize.define(
		"PreferredPerksConfigHistory",
		{
			id: {
				type: DataTypes.INTEGER,
				allowNull: false,
				autoIncrement: true,
				primaryKey: true,
			},
			configId: {
				type: DataTypes.INTEGER,
				allowNull: false,
				comment: "The config record that was changed",
			},
			changedBy: {
				type: DataTypes.INTEGER,
				allowNull: true,
				comment: "User who made the change",
			},
			changeType: {
				type: DataTypes.ENUM("create", "update"),
				allowNull: false,
				defaultValue: "update",
			},
			changes: {
				type: DataTypes.JSONB,
				allowNull: false,
				defaultValue: {},
				comment: "Object containing field changes: { field: { old: X, new: Y } }",
			},
			previousValues: {
				type: DataTypes.JSONB,
				allowNull: true,
				comment: "Full snapshot of previous values",
			},
			newValues: {
				type: DataTypes.JSONB,
				allowNull: false,
				comment: "Full snapshot of new values",
			},
		},
		{
			tableName: "PreferredPerksConfigHistories",
			timestamps: true,
			updatedAt: false, // History entries are immutable
		}
	);

	PreferredPerksConfigHistory.associate = (models) => {
		PreferredPerksConfigHistory.belongsTo(models.User, {
			foreignKey: "changedBy",
			as: "changer",
		});
		PreferredPerksConfigHistory.belongsTo(models.PreferredPerksConfig, {
			foreignKey: "configId",
			as: "config",
		});
	};

	return PreferredPerksConfigHistory;
};
