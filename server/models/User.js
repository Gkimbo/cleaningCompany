const bcrypt = require("bcrypt");
const EncryptionService = require("../services/EncryptionService");
const { normalizePhone } = require("../utils/phoneUtils");

// Fields that contain PII and should be encrypted
const PII_FIELDS = [
	"firstName",
	"lastName",
	"email",
	"notificationEmail",
	"phone",
	"serviceAreaAddress",
];

module.exports = (sequelize, DataTypes) => {
	// Define the User model
	const User = sequelize.define("User", {
		firstName: {
			type: DataTypes.TEXT,
			allowNull: false,
		},
		lastName: {
			type: DataTypes.TEXT,
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
			type: DataTypes.TEXT,
			allowNull: false,
		},
		emailHash: {
			type: DataTypes.STRING,
			allowNull: true,
			comment: "Hash of email for searching (since email is encrypted)",
		},
		notificationEmail: {
			type: DataTypes.TEXT,
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
		warningCount: {
			type: DataTypes.INTEGER,
			allowNull: false,
			defaultValue: 0,
			comment: "Number of warnings issued to this user",
		},
		accountStatusUpdatedById: {
			type: DataTypes.INTEGER,
			allowNull: true,
			references: {
				model: "Users",
				key: "id",
			},
			comment: "The HR/Owner who last updated the account status",
		},
		termsAcceptedVersion: {
			type: DataTypes.INTEGER,
			allowNull: true,
		},
		privacyPolicyAcceptedVersion: {
			type: DataTypes.INTEGER,
			allowNull: true,
		},
		paymentTermsAcceptedVersion: {
			type: DataTypes.INTEGER,
			allowNull: true,
		},
		damageProtectionAcceptedVersion: {
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
			type: DataTypes.TEXT,
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
		// Tenant present tracking (for cleaners)
		tenantPresentReportCount: {
			type: DataTypes.INTEGER,
			allowNull: false,
			defaultValue: 0,
			comment: "Total tenant present reports by this cleaner",
		},
		tenantPresentNoCleanCount: {
			type: DataTypes.INTEGER,
			allowNull: false,
			defaultValue: 0,
			comment: "Tenant present reports that ended without cleaning",
		},
		lastTenantPresentReportAt: {
			type: DataTypes.DATE,
			allowNull: true,
			comment: "When cleaner last reported tenant present",
		},
		tenantReportScrutinyLevel: {
			type: DataTypes.ENUM("none", "watch", "high_risk"),
			allowNull: false,
			defaultValue: "none",
			comment: "Scrutiny level for tenant present reports",
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
		referralCode: {
			type: DataTypes.STRING,
			allowNull: true,
			unique: true,
			comment: "Unique referral code for this user (e.g., JOHN7X2K)",
		},
		referralCredits: {
			type: DataTypes.INTEGER,
			allowNull: false,
			defaultValue: 0,
			comment: "Available referral credits in cents",
		},
		isBusinessOwner: {
			type: DataTypes.BOOLEAN,
			allowNull: false,
			defaultValue: false,
			comment: "True if this cleaner owns their own cleaning business",
		},
		businessName: {
			type: DataTypes.STRING,
			allowNull: true,
			comment: "Name of the cleaning business (for business owners)",
		},
		yearsInBusiness: {
			type: DataTypes.INTEGER,
			allowNull: true,
			comment: "Years the business owner has been in business",
		},
		businessVerificationStatus: {
			type: DataTypes.ENUM("none", "pending", "verified"),
			allowNull: false,
			defaultValue: "none",
			comment: "Verification status for marketplace highlighting",
		},
		businessVerifiedAt: {
			type: DataTypes.DATE,
			allowNull: true,
			comment: "When the business was verified",
		},
		businessDescription: {
			type: DataTypes.TEXT,
			allowNull: true,
			comment: "Business description/specialties for marketplace profile",
		},
		businessHighlightOptIn: {
			type: DataTypes.BOOLEAN,
			allowNull: false,
			defaultValue: true,
			comment: "Whether business owner opts in to marketplace highlighting",
		},
		employeePayoutMethod: {
			type: DataTypes.STRING(30),
			allowNull: false,
			defaultValue: "all_to_owner",
			comment: "For business owners: all_to_owner (default) or direct_to_employees",
		},
		businessLogo: {
			type: DataTypes.TEXT,
			allowNull: true,
			comment: "Base64 encoded business logo image (for business owners)",
		},
		// Demo account field for owner preview mode
		isDemoAccount: {
			type: DataTypes.BOOLEAN,
			allowNull: false,
			defaultValue: false,
			comment: "True for demo accounts used in owner preview mode",
		},
		currentPreviewOwnerId: {
			type: DataTypes.INTEGER,
			allowNull: true,
			comment: "For demo accounts: ID of owner currently previewing as this account (for email redirection)",
		},
		// Business employee fields
		employeeOfBusinessId: {
			type: DataTypes.INTEGER,
			allowNull: true,
			comment: "If this user is an employee, the ID of the business owner",
		},
		isMarketplaceCleaner: {
			type: DataTypes.BOOLEAN,
			allowNull: false,
			defaultValue: true,
			comment: "False for business employees who cannot see marketplace jobs",
		},
		calendarSyncDisclaimerAcceptedAt: {
			type: DataTypes.DATE,
			allowNull: true,
			comment: "Timestamp when user accepted the calendar sync disclaimer",
		},
		// Cleaner service area fields for last-minute booking notifications
		serviceAreaLatitude: {
			type: DataTypes.TEXT,
			allowNull: true,
			comment: "Cleaner service area center latitude (encrypted)",
		},
		serviceAreaLongitude: {
			type: DataTypes.TEXT,
			allowNull: true,
			comment: "Cleaner service area center longitude (encrypted)",
		},
		serviceAreaAddress: {
			type: DataTypes.TEXT,
			allowNull: true,
			comment: "Cleaner service area address for display (encrypted)",
		},
		serviceAreaRadiusMiles: {
			type: DataTypes.DECIMAL(5, 2),
			allowNull: true,
			defaultValue: 30.0,
			comment: "How far cleaner is willing to travel (in miles)",
		},
		// Cancellation Appeal tracking fields
		appealStats: {
			type: DataTypes.JSONB,
			allowNull: true,
			defaultValue: {
				total: 0,
				approved: 0,
				denied: 0,
				pending: 0,
			},
			comment: "Statistics about user appeal history",
		},
		lastAppealDate: {
			type: DataTypes.DATE,
			allowNull: true,
			comment: "When the user last submitted an appeal",
		},
		appealScrutinyLevel: {
			type: DataTypes.ENUM("none", "watch", "high_risk"),
			allowNull: false,
			defaultValue: "none",
			comment: "Level of scrutiny for this user based on appeal patterns",
		},
		appealScrutinyReason: {
			type: DataTypes.TEXT,
			allowNull: true,
			comment: "Explanation for current scrutiny level",
		},
		appealScrutinySetAt: {
			type: DataTypes.DATE,
			allowNull: true,
			comment: "When scrutiny level was last updated",
		},
		appealPatterns: {
			type: DataTypes.JSONB,
			allowNull: true,
			defaultValue: {
				categoryCounts: {},
				approvalRate: null,
				avgDaysBetweenAppeals: null,
			},
			comment: "Pattern detection data for appeal abuse monitoring",
		},
	});

	// Helper function to encrypt PII fields
	const encryptPIIFields = (user) => {
		PII_FIELDS.forEach((field) => {
			if (user[field] !== undefined && user[field] !== null) {
				const value = String(user[field]);
				// Only encrypt if not already encrypted
				if (!value.includes(":") || value.split(":").length !== 2) {
					user[field] = EncryptionService.encrypt(value);
				}
			}
		});

		// Generate email hash for searching (if email is being set/updated)
		if (user.email && user.changed && user.changed("email")) {
			// Get the original unencrypted email value
			const originalEmail = user._previousDataValues?.email
				? EncryptionService.decrypt(user._previousDataValues.email)
				: user.email;
			// If the email looks encrypted, decrypt it first
			const emailToHash = originalEmail.includes(":")
				? EncryptionService.decrypt(originalEmail)
				: originalEmail;
			user.emailHash = EncryptionService.hash(emailToHash);
		} else if (user.email && !user.emailHash) {
			// For new users or if hash is missing
			const emailToHash = user.email.includes(":")
				? EncryptionService.decrypt(user.email)
				: user.email;
			user.emailHash = EncryptionService.hash(emailToHash);
		}
	};

	// Helper function to decrypt PII fields
	const decryptPIIFields = (user) => {
		if (!user) return;

		PII_FIELDS.forEach((field) => {
			if (user.dataValues && user.dataValues[field]) {
				user.dataValues[field] = EncryptionService.decrypt(user.dataValues[field]);
			}
		});
	};

	// Hash the password before saving the user
	User.beforeCreate(async (user) => {
		try {
			const salt = await bcrypt.genSalt(10);
			const hashedPassword = await bcrypt.hash(user.password, salt);
			user.password = hashedPassword;

			// Normalize phone number (store as digits only)
			if (user.phone) {
				user.phone = normalizePhone(user.phone);
			}

			// Encrypt PII fields
			encryptPIIFields(user);
		} catch (error) {
			throw new Error(error);
		}
	});

	// Encrypt PII fields before updating
	User.beforeUpdate((user) => {
		// Normalize phone number (store as digits only)
		if (user.changed("phone") && user.phone) {
			user.phone = normalizePhone(user.phone);
		}
		encryptPIIFields(user);
	});

	// Decrypt after finding
	User.afterFind((result) => {
		if (!result) return;

		if (Array.isArray(result)) {
			result.forEach((user) => decryptPIIFields(user));
		} else {
			decryptPIIFields(result);
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

	// Method to check if the user account is active (not frozen/suspended)
	User.prototype.isAccountActive = function () {
		return !this.accountFrozen;
	};

	// Method to get account status for display
	User.prototype.getAccountStatus = function () {
		if (this.accountFrozen) {
			return "suspended";
		}
		if (this.warningCount > 0) {
			return "warned";
		}
		return "active";
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

		// Referrals where this user is the referrer
		User.hasMany(models.Referral, {
		  foreignKey: "referrerId",
		  as: "referralsMade",
		});

		// Referrals where this user was referred
		User.hasMany(models.Referral, {
		  foreignKey: "referredId",
		  as: "referralsReceived",
		});

		// Business employee relationships
		User.belongsTo(models.User, {
		  foreignKey: "employeeOfBusinessId",
		  as: "employerBusinessOwner",
		});
		User.hasMany(models.User, {
		  foreignKey: "employeeOfBusinessId",
		  as: "businessEmployeeUsers",
		});
		User.hasMany(models.BusinessEmployee, {
		  foreignKey: "businessOwnerId",
		  as: "businessEmployees",
		});
		User.hasOne(models.BusinessEmployee, {
		  foreignKey: "userId",
		  as: "businessEmployeeRecord",
		});
	  };
	  

	return User;
};
