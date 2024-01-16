module.exports = (sequelize, DataTypes) => {
	// Define the UserHomes model
	const UserBills = sequelize.define("UserBills", {
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
		appointmentDue: {
			type: DataTypes.INTEGER,
			allowNull: false,
		},
		cancellationFee: {
			type: DataTypes.INTEGER,
			allowNull: false,
		},
		totalDue: {
			type: DataTypes.INTEGER,
			allowNull: false,
		},
	});

	// Define the one-to-many relationship with User
	UserBills.associate = (models) => {
		UserBills.belongsTo(models.User, {
			foreignKey: "userId",
			as: "user",
		});
	};

	return UserBills;
};
