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
			type: DataTypes.STRING,
			allowNull: false,
		},
		price: {
			type: DataTypes.STRING,
			allowNull: false,
		},
		paid: {
			type: DataTypes.BOOLEAN,
			allowNull: false,
		},
		bringTowels: {
			type: DataTypes.STRING,
			allowNull: false,
		},
		bringSheets: {
			type: DataTypes.STRING,
			allowNull: false,
		},
		keyPadCode: {
			type: DataTypes.STRING,
			allowNull: true,
		},
		keyLocation: {
			type: DataTypes.STRING,
			allowNull: true,
		},
		completed: {
			type: DataTypes.BOOLEAN,
			allowNull: false,
		},
		hasBeenAssigned: {
			type: DataTypes.BOOLEAN,
			allowNull: false,
		},
		employeesAssigned: {
			type:  DataTypes.ARRAY(DataTypes.STRING),
			allowNull: true,
		},
		empoyeesNeeded: {
			type: DataTypes.INTEGER,
			allowNull: false,
		},
		timeToBeCompleted: {
			type: DataTypes.STRING,
			allowNull: false,
		},
		paymentIntentId: {
			type: DataTypes.STRING,
			allowNull: true,
		},
		paymentStatus: {
			type: DataTypes.STRING,
			allowNull: true,
			defaultValue: "pending",
		},
		amountPaid: {
			type: DataTypes.INTEGER,
			allowNull: true,
		},
		// Per-appointment sheet/towel configurations (overrides home defaults)
		// sheetConfigurations: [{ bedNumber: 1, size: "queen", needsSheets: true }, ...]
		sheetConfigurations: {
			type: DataTypes.JSON,
			allowNull: true,
		},
		// towelConfigurations: [{ bathroomNumber: 1, towels: 2, faceCloths: 2 }, ...]
		towelConfigurations: {
			type: DataTypes.JSON,
			allowNull: true,
		},
		// Track if unassigned warning notification has been sent
		unassignedWarningSent: {
			type: DataTypes.BOOLEAN,
			allowNull: false,
			defaultValue: false,
		},
		// Track if payment capture has failed (needs manual retry)
		paymentCaptureFailed: {
			type: DataTypes.BOOLEAN,
			allowNull: false,
			defaultValue: false,
		},
		// Track if customer manually pre-paid (vs auto-captured by cron)
		manuallyPaid: {
			type: DataTypes.BOOLEAN,
			allowNull: false,
			defaultValue: false,
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
		UserAppointments.hasMany(models.UserCleanerAppointments, {
			foreignKey: "appointmentId",
			as: "appointments",
		});
	};

	return UserAppointments;
};
