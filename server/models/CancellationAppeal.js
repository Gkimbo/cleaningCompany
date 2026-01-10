module.exports = (sequelize, DataTypes) => {
	const CancellationAppeal = sequelize.define("CancellationAppeal", {
		id: {
			type: DataTypes.INTEGER,
			autoIncrement: true,
			primaryKey: true,
		},
		appointmentId: {
			type: DataTypes.INTEGER,
			allowNull: false,
		},

		// Appellant info
		appealerId: {
			type: DataTypes.INTEGER,
			allowNull: false,
		},
		appealerType: {
			type: DataTypes.ENUM("homeowner", "cleaner"),
			allowNull: false,
		},

		// Appeal classification
		category: {
			type: DataTypes.ENUM(
				"medical_emergency",
				"family_emergency",
				"natural_disaster",
				"property_issue",
				"transportation",
				"scheduling_error",
				"other"
			),
			allowNull: false,
		},
		severity: {
			type: DataTypes.ENUM("low", "medium", "high", "critical"),
			defaultValue: "medium",
		},

		// Details
		description: {
			type: DataTypes.TEXT,
			allowNull: false,
		},
		supportingDocuments: {
			type: DataTypes.JSONB,
			defaultValue: [],
		},

		// What's being contested
		contestingItems: {
			type: DataTypes.JSONB,
			defaultValue: {},
		},

		// Financial impact
		originalPenaltyAmount: {
			type: DataTypes.INTEGER,
		},
		originalRefundWithheld: {
			type: DataTypes.INTEGER,
		},
		requestedRelief: {
			type: DataTypes.TEXT,
		},

		// Status workflow
		status: {
			type: DataTypes.ENUM(
				"submitted",
				"under_review",
				"awaiting_documents",
				"approved",
				"partially_approved",
				"denied",
				"escalated"
			),
			defaultValue: "submitted",
		},
		priority: {
			type: DataTypes.ENUM("normal", "high", "urgent"),
			defaultValue: "normal",
		},

		// Assignment & review
		assignedTo: {
			type: DataTypes.INTEGER,
		},
		assignedAt: {
			type: DataTypes.DATE,
		},

		reviewedBy: {
			type: DataTypes.INTEGER,
		},
		reviewedAt: {
			type: DataTypes.DATE,
		},
		reviewDecision: {
			type: DataTypes.TEXT,
		},

		// Resolution
		resolution: {
			type: DataTypes.JSONB,
			defaultValue: {},
		},
		resolutionNotes: {
			type: DataTypes.TEXT,
		},

		// SLA tracking
		slaDeadline: {
			type: DataTypes.DATE,
		},
		escalatedAt: {
			type: DataTypes.DATE,
		},
		escalationReason: {
			type: DataTypes.TEXT,
		},

		// Timestamps
		submittedAt: {
			type: DataTypes.DATE,
			defaultValue: DataTypes.NOW,
		},
		lastActivityAt: {
			type: DataTypes.DATE,
		},
		closedAt: {
			type: DataTypes.DATE,
		},
	}, {
		tableName: "CancellationAppeals",
		timestamps: true,
	});

	// Define associations
	CancellationAppeal.associate = (models) => {
		CancellationAppeal.belongsTo(models.UserAppointments, {
			foreignKey: "appointmentId",
			as: "appointment",
		});
		CancellationAppeal.belongsTo(models.User, {
			foreignKey: "appealerId",
			as: "appealer",
		});
		CancellationAppeal.belongsTo(models.User, {
			foreignKey: "assignedTo",
			as: "assignee",
		});
		CancellationAppeal.belongsTo(models.User, {
			foreignKey: "reviewedBy",
			as: "reviewer",
		});
		CancellationAppeal.hasMany(models.CancellationAuditLog, {
			foreignKey: "appealId",
			as: "auditLogs",
		});
		CancellationAppeal.hasMany(models.JobLedger, {
			foreignKey: "appealId",
			as: "ledgerEntries",
		});
	};

	// Instance methods
	CancellationAppeal.prototype.isOpen = function() {
		return ["submitted", "under_review", "awaiting_documents", "escalated"].includes(this.status);
	};

	CancellationAppeal.prototype.isClosed = function() {
		return ["approved", "partially_approved", "denied"].includes(this.status);
	};

	CancellationAppeal.prototype.isPastSLA = function() {
		return this.slaDeadline && new Date() > new Date(this.slaDeadline) && this.isOpen();
	};

	CancellationAppeal.prototype.getTimeUntilSLA = function() {
		if (!this.slaDeadline || this.isClosed()) return null;
		const remaining = new Date(this.slaDeadline).getTime() - Date.now();
		return Math.max(0, Math.floor(remaining / 1000));
	};

	// Class methods
	CancellationAppeal.findOpenByAppointment = function(appointmentId) {
		return this.findOne({
			where: {
				appointmentId,
				status: {
					[sequelize.Sequelize.Op.in]: ["submitted", "under_review", "awaiting_documents", "escalated"],
				},
			},
		});
	};

	CancellationAppeal.findPendingByUser = function(userId) {
		return this.findAll({
			where: {
				appealerId: userId,
				status: {
					[sequelize.Sequelize.Op.in]: ["submitted", "under_review", "awaiting_documents", "escalated"],
				},
			},
			order: [["submittedAt", "DESC"]],
		});
	};

	CancellationAppeal.getQueueForReviewer = function(reviewerId, options = {}) {
		const { status, priority, limit = 50 } = options;
		const where = {};

		if (reviewerId) {
			where.assignedTo = reviewerId;
		}
		if (status) {
			where.status = status;
		} else {
			where.status = {
				[sequelize.Sequelize.Op.in]: ["submitted", "under_review", "awaiting_documents", "escalated"],
			};
		}
		if (priority) {
			where.priority = priority;
		}

		return this.findAll({
			where,
			order: [
				["priority", "DESC"],
				["slaDeadline", "ASC"],
				["submittedAt", "ASC"],
			],
			limit,
		});
	};

	CancellationAppeal.getSLABreaches = function() {
		return this.findAll({
			where: {
				status: {
					[sequelize.Sequelize.Op.in]: ["submitted", "under_review", "awaiting_documents"],
				},
				slaDeadline: {
					[sequelize.Sequelize.Op.lt]: new Date(),
				},
			},
			order: [["slaDeadline", "ASC"]],
		});
	};

	return CancellationAppeal;
};
