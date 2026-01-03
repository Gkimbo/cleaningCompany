module.exports = (sequelize, DataTypes) => {
	const HomePreferredCleaner = sequelize.define("HomePreferredCleaner", {
		id: {
			type: DataTypes.INTEGER,
			allowNull: false,
			autoIncrement: true,
			primaryKey: true,
		},
		homeId: {
			type: DataTypes.INTEGER,
			allowNull: false,
			references: {
				model: "UserHomes",
				key: "id",
			},
		},
		cleanerId: {
			type: DataTypes.INTEGER,
			allowNull: false,
			references: {
				model: "Users",
				key: "id",
			},
		},
		setAt: {
			type: DataTypes.DATE,
			allowNull: false,
			defaultValue: DataTypes.NOW,
		},
		setBy: {
			type: DataTypes.ENUM("review", "settings", "invitation"),
			allowNull: false,
			defaultValue: "review",
			comment: "How the cleaner was set as preferred (via review, settings page, or invitation)",
		},
	}, {
		indexes: [
			{
				unique: true,
				fields: ["homeId", "cleanerId"],
				name: "home_preferred_cleaner_unique",
			},
		],
	});

	HomePreferredCleaner.associate = (models) => {
		HomePreferredCleaner.belongsTo(models.UserHomes, {
			foreignKey: "homeId",
			as: "home",
		});
		HomePreferredCleaner.belongsTo(models.User, {
			foreignKey: "cleanerId",
			as: "cleaner",
		});
	};

	return HomePreferredCleaner;
};
