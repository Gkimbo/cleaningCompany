const bcrypt = require("bcrypt");

module.exports = (sequelize, DataTypes) => {
	// Define the User model
	const User = sequelize.define("User", {
		firstName: {
			type: DataTypes.STRING,
			allowNull: false,
		},
		lastName: {
			type: DataTypes.STRING,
			allowNull: false,
		},
		username: {
			type: DataTypes.STRING,
			allowNull: false,
			unique: true,
		},
		password: {
			type: DataTypes.STRING,
			allowNull: false,
		},
		email: {
			type: DataTypes.STRING,
			allowNull: false,
		},
		notificationEmail: {
			type: DataTypes.STRING,
			allowNull: true,
			comment: "Separate email for receiving notifications (falls back to main email if null)",
		},
		lastLogin: {
			type: DataTypes.DATE,
			allowNull: true,
		},
		type: {
			type: DataTypes.STRING,
			allowNull: true,
		},
		daysWorking: {
			type: DataTypes.ARRAY(DataTypes.STRING),
			allowNull: true,
		},
		notifications: {
			type:  DataTypes.ARRAY(DataTypes.TEXT),
			allowNull: true,
		},
		stripeCustomerId: {
			type: DataTypes.STRING,
			allowNull: true,
		},
		hasPaymentMethod: {
			type: DataTypes.BOOLEAN,
			allowNull: false,
			defaultValue: false,
		},
		accountFrozen: {
			type: DataTypes.BOOLEAN,
			allowNull: false,
			defaultValue: false,
		},
		accountFrozenAt: {
			type: DataTypes.DATE,
			allowNull: true,
		},
		accountFrozenReason: {
			type: DataTypes.STRING,
			allowNull: true,
		},
		termsAcceptedVersion: {
			type: DataTypes.INTEGER,
			allowNull: true,
		},
		lastDeviceType: {
			type: DataTypes.STRING,
			allowNull: true,
		},
		loginCount: {
			type: DataTypes.INTEGER,
			allowNull: false,
			defaultValue: 0,
		},
		expoPushToken: {
			type: DataTypes.STRING,
			allowNull: true,
		},
		phone: {
			type: DataTypes.STRING,
			allowNull: true,
		},
		ownerPrivateNotes: {
			type: DataTypes.TEXT,
			allowNull: true,
		},
		falseHomeSizeCount: {
			type: DataTypes.INTEGER,
			allowNull: false,
			defaultValue: 0,
		},
		falseClaimCount: {
			type: DataTypes.INTEGER,
			allowNull: false,
			defaultValue: 0,
		},
		failedLoginAttempts: {
			type: DataTypes.INTEGER,
			allowNull: false,
			defaultValue: 0,
		},
		lockedUntil: {
			type: DataTypes.DATE,
			allowNull: true,
		},
		supplyReminderSnoozedUntil: {
			type: DataTypes.DATE,
			allowNull: true,
			comment: "If set, supply reminders are silenced until this date",
		},
	});

	// Hash the password before saving the user
	User.beforeCreate(async (user) => {
		try {
			const salt = await bcrypt.genSalt(10);
			const hashedPassword = await bcrypt.hash(user.password, salt);
			user.password = hashedPassword;
		} catch (error) {
			throw new Error(error);
		}
	});

	// Method to validate the password
	User.prototype.validPassword = async function (password) {
		try {
			return await bcrypt.compare(password, this.password);
		} catch (error) {
			throw new Error(error);
		}
	};

	// Method to get email for notifications (uses notificationEmail if set, otherwise main email)
	User.prototype.getNotificationEmail = function () {
		return this.notificationEmail || this.email;
	};

	// Define the one-to-many relationship with UserInformation
	User.associate = (models) => {
		User.hasMany(models.UserAppointments, {
		  foreignKey: "userId",
		  as: "appointments",
		});
		User.hasMany(models.UserHomes, {
		  foreignKey: "userId",
		  as: "homes",
		});
		User.hasMany(models.UserBills, {
		  foreignKey: "userId",
		  as: "bills",
		});
		User.hasMany(models.UserCleanerAppointments, {
		  foreignKey: "employeeId",
		  as: "cleanerAppointments",
		});

		User.hasMany(models.UserReviews, {
		  foreignKey: "userId",
		  as: "reviews",
		});

		User.hasMany(models.UserReviews, {
		  foreignKey: "reviewerId",
		  as: "writtenReviews",
		});

		// Stripe Connect account for cleaners
		User.hasOne(models.StripeConnectAccount, {
		  foreignKey: "userId",
		  as: "stripeConnectAccount",
		});

		// Payouts received by cleaner
		User.hasMany(models.Payout, {
		  foreignKey: "cleanerId",
		  as: "payouts",
		});

		// Terms acceptances
		User.hasMany(models.UserTermsAcceptance, {
		  foreignKey: "userId",
		  as: "termsAcceptances",
		});
	  };
	  

	return User;
};
