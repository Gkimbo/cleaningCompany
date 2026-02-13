const EncryptionService = require("../services/EncryptionService");

// Fields that contain PII and should be encrypted
const PII_FIELDS = ["ipAddress"];

module.exports = (sequelize, DataTypes) => {
	const CancellationAuditLog = sequelize.define("CancellationAuditLog", {
		id: {
			type: DataTypes.INTEGER,
			autoIncrement: true,
			primaryKey: true,
		},

		// Reference
		appointmentId: {
			type: DataTypes.INTEGER,
			allowNull: false,
		},
		appealId: {
			type: DataTypes.INTEGER,
		},

		// Event classification
		eventType: {
			type: DataTypes.ENUM(
				"cancellation_info_requested",
				"cancellation_initiated",
				"cancellation_confirmed",
				"cancellation_reversed",
				"fee_charge_attempted",
				"fee_charge_succeeded",
				"fee_charge_failed",
				"fee_added_to_bill",
				"refund_initiated",
				"refund_completed",
				"refund_failed",
				"payout_created",
				"payout_completed",
				"penalty_rating_applied",
				"penalty_rating_removed",
				"account_freeze_triggered",
				"account_freeze_lifted",
				"appeal_submitted",
				"appeal_assigned",
				"appeal_status_changed",
				"appeal_documents_uploaded",
				"appeal_resolved",
				"notification_sent_email",
				"notification_sent_push",
				"notification_sent_sms"
			),
			allowNull: false,
		},

		// Who did it
		actorId: {
			type: DataTypes.INTEGER,
		},
		actorType: {
			type: DataTypes.ENUM(
				"homeowner",
				"cleaner",
				"system",
				"hr",
				"owner",
				"support"
			),
			defaultValue: "system",
		},

		// Detailed payload
		eventData: {
			type: DataTypes.JSONB,
			allowNull: false,
			defaultValue: {},
		},
		previousState: {
			type: DataTypes.JSONB,
		},
		newState: {
			type: DataTypes.JSONB,
		},

		// Request context
		requestId: {
			type: DataTypes.STRING,
		},
		ipAddress: {
			type: DataTypes.TEXT, // TEXT to accommodate encrypted data
		},
		userAgent: {
			type: DataTypes.STRING,
		},
		deviceInfo: {
			type: DataTypes.JSONB,
		},

		// Flags
		isSystemGenerated: {
			type: DataTypes.BOOLEAN,
			defaultValue: false,
		},
		isSensitive: {
			type: DataTypes.BOOLEAN,
			defaultValue: false,
		},

		// Immutable timestamp
		occurredAt: {
			type: DataTypes.DATE,
			allowNull: false,
			defaultValue: DataTypes.NOW,
		},

		// For searching
		searchText: {
			type: DataTypes.STRING(500),
		},
	}, {
		tableName: "CancellationAuditLogs",
		timestamps: true,
	});

	// Define associations
	CancellationAuditLog.associate = (models) => {
		CancellationAuditLog.belongsTo(models.UserAppointments, {
			foreignKey: "appointmentId",
			as: "appointment",
		});
		CancellationAuditLog.belongsTo(models.CancellationAppeal, {
			foreignKey: "appealId",
			as: "appeal",
		});
		CancellationAuditLog.belongsTo(models.User, {
			foreignKey: "actorId",
			as: "actor",
		});
	};

	// Class methods

	/**
	 * Get audit trail for an appointment
	 */
	CancellationAuditLog.getAuditTrail = function(appointmentId, options = {}) {
		const { startDate, endDate, eventTypes, limit = 100 } = options;
		const where = { appointmentId };

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
			order: [["occurredAt", "ASC"]],
			limit,
			include: [{
				model: sequelize.models.User,
				as: "actor",
				attributes: ["id", "firstName", "lastName", "type"],
			}],
		});
	};

	/**
	 * Get audit logs for an appeal
	 */
	CancellationAuditLog.getAppealLogs = function(appealId) {
		return this.findAll({
			where: { appealId },
			order: [["occurredAt", "ASC"]],
		});
	};

	/**
	 * Search audit logs
	 */
	CancellationAuditLog.search = function(query, filters = {}) {
		const { appointmentId, actorId, eventType, startDate, endDate, limit = 50 } = filters;
		const where = {};

		if (appointmentId) where.appointmentId = appointmentId;
		if (actorId) where.actorId = actorId;
		if (eventType) where.eventType = eventType;

		if (startDate || endDate) {
			where.occurredAt = {};
			if (startDate) where.occurredAt[sequelize.Sequelize.Op.gte] = startDate;
			if (endDate) where.occurredAt[sequelize.Sequelize.Op.lte] = endDate;
		}

		if (query) {
			// Sanitize query length to prevent DoS
			const sanitizedQuery = String(query).slice(0, 500);
			where[sequelize.Sequelize.Op.or] = [
				{ searchText: { [sequelize.Sequelize.Op.iLike]: `%${sanitizedQuery}%` } },
				// Use Sequelize's where/cast for safe parameterized JSONB text search
				sequelize.where(
					sequelize.cast(sequelize.col("eventData"), "TEXT"),
					{ [sequelize.Sequelize.Op.iLike]: `%${sanitizedQuery}%` }
				),
			];
		}

		return this.findAll({
			where,
			order: [["occurredAt", "DESC"]],
			limit,
		});
	};

	/**
	 * Get summary of events for an appointment
	 */
	CancellationAuditLog.getSummary = function(appointmentId) {
		return this.findAll({
			attributes: [
				"eventType",
				[sequelize.fn("COUNT", sequelize.col("id")), "count"],
				[sequelize.fn("MIN", sequelize.col("occurredAt")), "firstOccurred"],
				[sequelize.fn("MAX", sequelize.col("occurredAt")), "lastOccurred"],
			],
			where: { appointmentId },
			group: ["eventType"],
		});
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
				record[field] = EncryptionService.decrypt(record[field]);
			}
		});
	};

	// Encrypt before create
	CancellationAuditLog.beforeCreate((record) => {
		encryptPIIFields(record);
	});

	// Encrypt before update
	CancellationAuditLog.beforeUpdate((record) => {
		encryptPIIFields(record);
	});

	// Decrypt after find
	CancellationAuditLog.afterFind((result) => {
		if (!result) return;

		if (Array.isArray(result)) {
			result.forEach((record) => decryptPIIFields(record));
		} else {
			decryptPIIFields(result);
		}
	});

	return CancellationAuditLog;
};
