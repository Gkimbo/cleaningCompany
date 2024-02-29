module.exports = (sequelize, DataTypes) => {
	// Define the UserHomes model
	const UserCleanerAppointments = sequelize.define("UserCleanerAppointments", {
		id: {
			type: DataTypes.INTEGER,
			allowNull: false,
			autoIncrement: true,
			primaryKey: true,
		},
		appointmentId: {
			type: DataTypes.INTEGER,
			allowNull: false,
		},
		employeeId: {
			type: DataTypes.INTEGER,
			allowNull: false,
		},
	});

	// Define the one-to-many relationship with User
	UserCleanerAppointments.associate = (models) => {
		UserCleanerAppointments.belongsTo(models.User, {
			foreignKey: "employeeId",
			as: "employee",
		});
		UserCleanerAppointments.belongsTo(models.UserAppointments, {
			foreignKey: "appointmentId",
			as: "appointment",
		});
	};

	return UserCleanerAppointments;
};
