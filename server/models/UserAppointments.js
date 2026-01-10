const EncryptionService = require("../services/EncryptionService");

// PII fields that need to be encrypted
const PII_FIELDS = ["keyPadCode", "keyLocation", "contact"];

module.exports = (sequelize, DataTypes) => {
	// Define the UserAppointments model
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
		// Backup cleaner notification fields
		backupCleanersNotified: {
			type: DataTypes.BOOLEAN,
			allowNull: false,
			defaultValue: false,
			comment: "Whether backup preferred cleaners have been notified",
		},
		backupNotificationSentAt: {
			type: DataTypes.DATE,
			allowNull: true,
			comment: "When backup cleaners were notified",
		},
		backupNotificationExpiresAt: {
			type: DataTypes.DATE,
			allowNull: true,
			comment: "When backup notification window expires",
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
		// Business employee assignment tracking
		assignedToBusinessEmployee: {
			type: DataTypes.BOOLEAN,
			allowNull: false,
			defaultValue: false,
		},
		businessEmployeeAssignmentId: {
			type: DataTypes.INTEGER,
			allowNull: true,
		},
		// Last-minute booking fields
		isLastMinuteBooking: {
			type: DataTypes.BOOLEAN,
			allowNull: false,
			defaultValue: false,
			comment: "True if booked within threshold hours of appointment",
		},
		lastMinuteFeeApplied: {
			type: DataTypes.INTEGER,
			allowNull: true,
			comment: "Last-minute fee amount in dollars (null if not applicable)",
		},
		lastMinuteNotificationsSentAt: {
			type: DataTypes.DATE,
			allowNull: true,
			comment: "When urgent notifications were sent to nearby cleaners",
		},
		// 2-Step Completion Confirmation fields
		completionStatus: {
			type: DataTypes.ENUM("in_progress", "submitted", "approved", "auto_approved"),
			allowNull: false,
			defaultValue: "in_progress",
			comment: "2-step completion status: in_progress -> submitted -> approved/auto_approved",
		},
		completionSubmittedAt: {
			type: DataTypes.DATE,
			allowNull: true,
			comment: "When cleaner marked job complete and submitted checklist",
		},
		completionChecklistData: {
			type: DataTypes.JSONB,
			allowNull: true,
			comment: "Checklist progress data submitted by cleaner",
		},
		completionNotes: {
			type: DataTypes.TEXT,
			allowNull: true,
			comment: "Optional notes from cleaner about the cleaning",
		},
		completionApprovedAt: {
			type: DataTypes.DATE,
			allowNull: true,
			comment: "When completion was approved (manually or auto)",
		},
		completionApprovedBy: {
			type: DataTypes.INTEGER,
			allowNull: true,
			comment: "User ID who approved, null if auto-approved by system",
		},
		autoApprovalExpiresAt: {
			type: DataTypes.DATE,
			allowNull: true,
			comment: "When auto-approval will trigger if homeowner doesn't respond",
		},
		homeownerFeedbackRequired: {
			type: DataTypes.BOOLEAN,
			allowNull: false,
			defaultValue: false,
			comment: "True if homeowner selected 'doesn't look good' - review required",
		},
		// Cancellation tracking fields
		cancellationInitiatedAt: {
			type: DataTypes.DATE,
			allowNull: true,
			comment: "When cancellation was initiated",
		},
		cancellationInitiatedBy: {
			type: DataTypes.INTEGER,
			allowNull: true,
			comment: "User ID who initiated the cancellation",
		},
		cancellationConfirmedAt: {
			type: DataTypes.DATE,
			allowNull: true,
			comment: "When cancellation was confirmed/processed",
		},
		cancellationReason: {
			type: DataTypes.TEXT,
			allowNull: true,
			comment: "Reason provided for cancellation",
		},
		cancellationMethod: {
			type: DataTypes.ENUM("app", "web", "support", "system"),
			allowNull: true,
			comment: "How the cancellation was submitted",
		},
		wasCancelled: {
			type: DataTypes.BOOLEAN,
			allowNull: false,
			defaultValue: false,
			comment: "Whether this appointment was cancelled",
		},
		cancellationType: {
			type: DataTypes.ENUM("homeowner", "cleaner", "system", "weather"),
			allowNull: true,
			comment: "Who/what initiated the cancellation",
		},
		hasActiveAppeal: {
			type: DataTypes.BOOLEAN,
			allowNull: false,
			defaultValue: false,
			comment: "Whether there is an active appeal for this cancellation",
		},
		appealId: {
			type: DataTypes.INTEGER,
			allowNull: true,
			comment: "Reference to the active appeal if any",
		},
		cancellationConfirmationId: {
			type: DataTypes.STRING,
			allowNull: true,
			comment: "Human-readable confirmation ID (e.g., CXL-2026-0109-A7B3C9)",
		},
		appealWindowExpiresAt: {
			type: DataTypes.DATE,
			allowNull: true,
			comment: "Deadline for submitting an appeal (72 hours from cancellation)",
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
		UserAppointments.belongsTo(models.EmployeeJobAssignment, {
			foreignKey: "businessEmployeeAssignmentId",
			as: "businessEmployeeAssignment",
		});
		UserAppointments.hasMany(models.EmployeeJobAssignment, {
			foreignKey: "appointmentId",
			as: "employeeJobAssignments",
		});
	};

	// Encryption hooks
	const encryptPIIFields = (record) => {
		PII_FIELDS.forEach((field) => {
			if (record[field] !== undefined && record[field] !== null) {
				const value = String(record[field]);
				// Only encrypt if not already encrypted (check for colon format)
				if (!value.includes(":") || value.split(":").length !== 2) {
					record[field] = EncryptionService.encrypt(value);
				}
			}
		});
	};

	const decryptPIIFields = (record) => {
		if (!record) return;
		PII_FIELDS.forEach((field) => {
			if (record.dataValues && record.dataValues[field]) {
				record.dataValues[field] = EncryptionService.decrypt(record.dataValues[field]);
			}
		});
	};

	UserAppointments.beforeCreate((record) => {
		encryptPIIFields(record);
	});

	UserAppointments.beforeUpdate((record) => {
		encryptPIIFields(record);
	});

	UserAppointments.afterFind((result) => {
		if (!result) return;
		if (Array.isArray(result)) {
			result.forEach((record) => decryptPIIFields(record));
		} else {
			decryptPIIFields(result);
		}
	});

	// =========================================================================
	// 2-Step Completion Confirmation Helper Methods
	// =========================================================================

	/**
	 * Check if appointment is awaiting homeowner approval
	 */
	UserAppointments.prototype.isAwaitingApproval = function () {
		return this.completionStatus === "submitted";
	};

	/**
	 * Check if auto-approval window has expired
	 */
	UserAppointments.prototype.isAutoApprovalExpired = function () {
		return (
			this.completionStatus === "submitted" &&
			this.autoApprovalExpiresAt &&
			new Date() > new Date(this.autoApprovalExpiresAt)
		);
	};

	/**
	 * Check if appointment can be approved by homeowner
	 */
	UserAppointments.prototype.canBeApproved = function () {
		return this.completionStatus === "submitted" && !this.completed;
	};

	/**
	 * Check if completion has been approved (manually or auto)
	 */
	UserAppointments.prototype.isCompletionApproved = function () {
		return (
			this.completionStatus === "approved" ||
			this.completionStatus === "auto_approved"
		);
	};

	/**
	 * Get time remaining until auto-approval (in seconds)
	 */
	UserAppointments.prototype.getTimeUntilAutoApproval = function () {
		if (!this.autoApprovalExpiresAt || this.completionStatus !== "submitted") {
			return null;
		}
		const remaining = new Date(this.autoApprovalExpiresAt).getTime() - Date.now();
		return Math.max(0, Math.floor(remaining / 1000));
	};

	return UserAppointments;
};
