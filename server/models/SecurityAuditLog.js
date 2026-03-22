const EncryptionService = require("../services/EncryptionService");

// Fields that contain PII and should be encrypted
const PII_FIELDS = ["ipAddress", "emailHash"];

module.exports = (sequelize, DataTypes) => {
	const SecurityAuditLog = sequelize.define("SecurityAuditLog", {
		id: {
			type: DataTypes.INTEGER,
			autoIncrement: true,
			primaryKey: true,
		},

		// Event classification
		eventType: {
			type: DataTypes.ENUM(
				// Authentication events
				"LOGIN_SUCCESS",
				"LOGIN_FAILED",
				"LOGOUT",
				"SESSION_EXPIRED",
				// Password events
				"PASSWORD_RESET_REQUESTED",
				"PASSWORD_RESET_COMPLETED",
				"PASSWORD_CHANGED",
				"EXPIRED_TEMP_PASSWORD_LOGIN",
				// Username recovery
				"USERNAME_RECOVERY_REQUESTED",
				"USERNAME_RECOVERY_SENT",
				// Account security
				"ACCOUNT_LOCKED",
				"ACCOUNT_UNLOCKED",
				"ACCOUNT_FROZEN",
				"ACCOUNT_UNFROZEN",
				// Rate limiting
				"RATE_LIMIT_EXCEEDED",
				// Admin actions
				"ADMIN_PASSWORD_RESET",
				"ADMIN_ACCOUNT_UPDATE",
				// Other security events
				"SUSPICIOUS_ACTIVITY",
				"TOKEN_INVALID",
				"UNAUTHORIZED_ACCESS"
			),
			allowNull: false,
		},

		// Who did it (can be null for failed attempts)
		userId: {
			type: DataTypes.INTEGER,
			allowNull: true,
		},
		username: {
			type: DataTypes.STRING,
			allowNull: true,
		},

		// Target user (for admin actions)
		targetUserId: {
			type: DataTypes.INTEGER,
			allowNull: true,
		},

		// Request context
		ipAddress: {
			type: DataTypes.TEXT, // TEXT to accommodate encrypted data
			allowNull: true,
		},
		userAgent: {
			type: DataTypes.STRING(500),
			allowNull: true,
		},
		emailHash: {
			type: DataTypes.TEXT, // Partial hash for searching without revealing email
			allowNull: true,
		},

		// Event details
		eventData: {
			type: DataTypes.JSONB,
			allowNull: false,
			defaultValue: {},
			comment: "Additional event-specific data",
		},

		// Severity level
		severity: {
			type: DataTypes.ENUM("info", "warning", "critical"),
			allowNull: false,
			defaultValue: "info",
		},

		// Success/failure indicator
		success: {
			type: DataTypes.BOOLEAN,
			allowNull: false,
			defaultValue: true,
		},

		// Error details if failed
		errorMessage: {
			type: DataTypes.STRING(500),
			allowNull: true,
		},

		// Immutable timestamp
		occurredAt: {
			type: DataTypes.DATE,
			allowNull: false,
			defaultValue: DataTypes.NOW,
		},
	}, {
		tableName: "SecurityAuditLogs",
		timestamps: true,
		updatedAt: false, // Audit logs should not be updated
		indexes: [
			{ fields: ["eventType"] },
			{ fields: ["userId"] },
			{ fields: ["occurredAt"] },
			{ fields: ["severity"] },
			{ fields: ["success"] },
		],
	});

	// Define associations
	SecurityAuditLog.associate = (models) => {
		SecurityAuditLog.belongsTo(models.User, {
			foreignKey: "userId",
			as: "user",
		});
		SecurityAuditLog.belongsTo(models.User, {
			foreignKey: "targetUserId",
			as: "targetUser",
		});
	};

	// ==================== Class Methods ====================

	/**
	 * Log a security event
	 */
	SecurityAuditLog.logEvent = async function(eventType, data = {}) {
		const {
			userId = null,
			username = null,
			targetUserId = null,
			ipAddress = null,
			userAgent = null,
			emailHash = null,
			eventData = {},
			severity = "info",
			success = true,
			errorMessage = null,
		} = data;

		try {
			const log = await this.create({
				eventType,
				userId,
				username,
				targetUserId,
				ipAddress,
				userAgent,
				emailHash,
				eventData,
				severity,
				success,
				errorMessage,
				occurredAt: new Date(),
			});

			// Also log to console for real-time monitoring
			const logLevel = severity === "critical" ? "error" : severity === "warning" ? "warn" : "log";
			console[logLevel](`[SECURITY] ${new Date().toISOString()} | ${eventType} | ${JSON.stringify({
				userId,
				username,
				success,
				...eventData,
			})}`);

			return log;
		} catch (error) {
			// If database logging fails, at least log to console
			console.error(`[SECURITY] Failed to log event to database: ${error.message}`);
			console.error(`[SECURITY] ${new Date().toISOString()} | ${eventType} | ${JSON.stringify(data)}`);
			return null;
		}
	};

	/**
	 * Get audit logs for a user
	 */
	SecurityAuditLog.getByUser = function(userId, options = {}) {
		const { startDate, endDate, eventTypes, limit = 100 } = options;
		const where = { userId };

		if (startDate || endDate) {
			where.occurredAt = {};
			if (startDate) where.occurredAt[sequelize.Sequelize.Op.gte] = startDate;
			if (endDate) where.occurredAt[sequelize.Sequelize.Op.lte] = endDate;
		}

		if (eventTypes && eventTypes.length > 0) {
			where.eventType = { [sequelize.Sequelize.Op.in]: eventTypes };
		}

		return this.findAll({
			where,
			order: [["occurredAt", "DESC"]],
			limit,
		});
	};

	/**
	 * Get recent security events (for admin dashboard)
	 */
	SecurityAuditLog.getRecent = function(options = {}) {
		const {
			limit = 50,
			severity = null,
			eventType = null,
			success = null,
			startDate = null,
			endDate = null,
		} = options;

		const where = {};

		if (severity) where.severity = severity;
		if (eventType) where.eventType = eventType;
		if (success !== null) where.success = success;

		if (startDate || endDate) {
			where.occurredAt = {};
			if (startDate) where.occurredAt[sequelize.Sequelize.Op.gte] = startDate;
			if (endDate) where.occurredAt[sequelize.Sequelize.Op.lte] = endDate;
		}

		return this.findAll({
			where,
			order: [["occurredAt", "DESC"]],
			limit,
			include: [{
				model: sequelize.models.User,
				as: "user",
				attributes: ["id", "firstName", "lastName", "username", "type"],
				required: false,
			}],
		});
	};

	/**
	 * Get failed login attempts for an IP or user
	 */
	SecurityAuditLog.getFailedAttempts = function(options = {}) {
		const { ipAddress, userId, since } = options;
		const where = {
			eventType: "LOGIN_FAILED",
			success: false,
		};

		if (ipAddress) where.ipAddress = ipAddress;
		if (userId) where.userId = userId;
		if (since) {
			where.occurredAt = { [sequelize.Sequelize.Op.gte]: since };
		}

		return this.count({ where });
	};

	/**
	 * Get security summary statistics
	 */
	SecurityAuditLog.getSummary = async function(startDate, endDate) {
		const where = {};
		if (startDate || endDate) {
			where.occurredAt = {};
			if (startDate) where.occurredAt[sequelize.Sequelize.Op.gte] = startDate;
			if (endDate) where.occurredAt[sequelize.Sequelize.Op.lte] = endDate;
		}

		const [eventCounts, severityCounts, successRate] = await Promise.all([
			this.findAll({
				attributes: [
					"eventType",
					[sequelize.fn("COUNT", sequelize.col("id")), "count"],
				],
				where,
				group: ["eventType"],
				raw: true,
			}),
			this.findAll({
				attributes: [
					"severity",
					[sequelize.fn("COUNT", sequelize.col("id")), "count"],
				],
				where,
				group: ["severity"],
				raw: true,
			}),
			this.findAll({
				attributes: [
					"success",
					[sequelize.fn("COUNT", sequelize.col("id")), "count"],
				],
				where,
				group: ["success"],
				raw: true,
			}),
		]);

		return {
			byEventType: eventCounts.reduce((acc, row) => {
				acc[row.eventType] = parseInt(row.count, 10);
				return acc;
			}, {}),
			bySeverity: severityCounts.reduce((acc, row) => {
				acc[row.severity] = parseInt(row.count, 10);
				return acc;
			}, {}),
			bySuccess: successRate.reduce((acc, row) => {
				acc[row.success ? "success" : "failed"] = parseInt(row.count, 10);
				return acc;
			}, {}),
		};
	};

	/**
	 * Cleanup old logs (retention policy)
	 */
	SecurityAuditLog.cleanup = async function(retentionDays = 90) {
		const cutoffDate = new Date();
		cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

		// Keep critical events longer
		const deleted = await this.destroy({
			where: {
				occurredAt: { [sequelize.Sequelize.Op.lt]: cutoffDate },
				severity: { [sequelize.Sequelize.Op.ne]: "critical" },
			},
		});

		console.log(`[SECURITY] Cleaned up ${deleted} audit logs older than ${retentionDays} days`);
		return deleted;
	};

	// ==================== PII Encryption Hooks ====================

	/**
	 * Encrypt PII fields before saving to database
	 */
	const encryptPIIFields = (record) => {
		if (!EncryptionService.isEnabled()) return;

		PII_FIELDS.forEach(field => {
			if (record[field] && typeof record[field] === "string") {
				// Don't re-encrypt already encrypted data
				if (!record[field].includes(":")) {
					record[field] = EncryptionService.encrypt(record[field]);
				}
			}
		});
	};

	/**
	 * Decrypt PII fields after reading from database
	 */
	const decryptPIIFields = (record) => {
		if (!record) return;

		PII_FIELDS.forEach(field => {
			if (record[field]) {
				try {
					record[field] = EncryptionService.decrypt(record[field]);
				} catch (e) {
					// Field might not be encrypted (older records)
				}
			}
		});
	};

	// Encrypt before create
	SecurityAuditLog.beforeCreate((record) => {
		encryptPIIFields(record);
	});

	// Decrypt after find
	SecurityAuditLog.afterFind((result) => {
		if (!result) return;

		if (Array.isArray(result)) {
			result.forEach((record) => decryptPIIFields(record));
		} else {
			decryptPIIFields(result);
		}
	});

	return SecurityAuditLog;
};
