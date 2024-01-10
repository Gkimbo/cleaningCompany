module.exports = (sequelize, DataTypes) => {
	// Define the UserHomes model
	const UserAppointments = sequelize.define("UserAppointments", {
		id: {
			type: DataTypes.INTEGER,
			allowNull: false,
			autoIncrement: true,
			primaryKey: true,
		},
		userId: {
			type: DataTypes.INTEGER,
			allowNull: false,
		},
		homeId: {
			type: DataTypes.INTEGER,
			allowNull: false,
		},
		date: {
			type: DataTypes.INTEGER,
			allowNull: false,
		},
	});

	// Define the one-to-many relationship with User
	UserAppointments.associate = (models) => {
		UserAppointments.belongsTo(models.User, {
			foreignKey: "userId",
			as: "user",
		});
		UserAppointments.belongsTo(models.User, {
			foreignKey: "homeId",
			as: "home",
		});
	};

	return UserAppointments;
};
