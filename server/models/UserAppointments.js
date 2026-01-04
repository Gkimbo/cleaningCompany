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
		// Per-appointment contact phone (overrides home default if set)
		contact: {
			type: DataTypes.STRING,
			allowNull: true,
		},
		// Incentive/discount tracking
		discountApplied: {
			type: DataTypes.BOOLEAN,
			allowNull: false,
			defaultValue: false,
		},
		discountPercent: {
			type: DataTypes.DECIMAL(3, 2),
			allowNull: true,
		},
		originalPrice: {
			type: DataTypes.STRING,
			allowNull: true,
		},
		// Cleaner-initiated booking fields
		bookedByCleanerId: {
			type: DataTypes.INTEGER,
			allowNull: true,
		},
		recurringScheduleId: {
			type: DataTypes.INTEGER,
			allowNull: true,
		},
		autoPayEnabled: {
			type: DataTypes.BOOLEAN,
			allowNull: false,
			defaultValue: true,
		},
		// Preferred cleaner decline flow fields
		preferredCleanerDeclined: {
			type: DataTypes.BOOLEAN,
			allowNull: false,
			defaultValue: false,
		},
		declinedAt: {
			type: DataTypes.DATE,
			allowNull: true,
		},
		clientResponsePending: {
			type: DataTypes.BOOLEAN,
			allowNull: false,
			defaultValue: false,
		},
		openToMarket: {
			type: DataTypes.BOOLEAN,
			allowNull: false,
			defaultValue: false,
		},
		openedToMarketAt: {
			type: DataTypes.DATE,
			allowNull: true,
		},
		businessOwnerPrice: {
			type: DataTypes.DECIMAL(10, 2),
			allowNull: true,
		},
		// Client response fields for business owner bookings
		clientRespondedAt: {
			type: DataTypes.DATE,
			allowNull: true,
		},
		clientResponse: {
			type: DataTypes.STRING(20),
			allowNull: true,
			// 'accepted', 'declined', 'expired'
		},
		declineReason: {
			type: DataTypes.TEXT,
			allowNull: true,
		},
		suggestedDates: {
			type: DataTypes.JSONB,
			allowNull: true,
			// Array of dates suggested by client when declining
		},
		expiresAt: {
			type: DataTypes.DATE,
			allowNull: true,
			// Set to 48 hours from creation for pending approval bookings
		},
		originalBookingId: {
			type: DataTypes.INTEGER,
			allowNull: true,
			// For tracking rebooking attempts after decline
		},
		rebookingAttempts: {
			type: DataTypes.INTEGER,
			allowNull: false,
			defaultValue: 0,
		},
		// Multi-cleaner job fields
		isMultiCleanerJob: {
			type: DataTypes.BOOLEAN,
			allowNull: false,
			defaultValue: false,
		},
		multiCleanerJobId: {
			type: DataTypes.INTEGER,
			allowNull: true,
		},
		cleanerSlotsRemaining: {
			type: DataTypes.INTEGER,
			allowNull: true,
		},
		soloCleanerConsent: {
			type: DataTypes.BOOLEAN,
			allowNull: false,
			defaultValue: false,
		},
		homeownerSoloWarningAcknowledged: {
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
		UserAppointments.belongsTo(models.UserHomes, {
			foreignKey: "homeId",
			as: "home",
		});
		UserAppointments.belongsTo(models.User, {
			foreignKey: "bookedByCleanerId",
			as: "bookedByCleaner",
		});
		UserAppointments.belongsTo(models.RecurringSchedule, {
			foreignKey: "recurringScheduleId",
			as: "recurringSchedule",
		});
		UserAppointments.hasMany(models.UserCleanerAppointments, {
			foreignKey: "appointmentId",
			as: "appointments",
		});
		UserAppointments.belongsTo(models.UserAppointments, {
			foreignKey: "originalBookingId",
			as: "originalBooking",
		});
		UserAppointments.hasMany(models.UserAppointments, {
			foreignKey: "originalBookingId",
			as: "rebookings",
		});
		UserAppointments.hasMany(models.Notification, {
			foreignKey: "relatedAppointmentId",
			as: "notifications",
		});
		UserAppointments.belongsTo(models.MultiCleanerJob, {
			foreignKey: "multiCleanerJobId",
			as: "multiCleanerJob",
		});
		UserAppointments.hasMany(models.CleanerRoomAssignment, {
			foreignKey: "appointmentId",
			as: "roomAssignments",
		});
		UserAppointments.hasMany(models.CleanerJobCompletion, {
			foreignKey: "appointmentId",
			as: "cleanerCompletions",
		});
	};

	return UserAppointments;
};
