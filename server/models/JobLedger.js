module.exports = (sequelize, DataTypes) => {
	const JobLedger = sequelize.define("JobLedger", {
		id: {
			type: DataTypes.INTEGER,
			autoIncrement: true,
			primaryKey: true,
		},

		// References
		appointmentId: {
			type: DataTypes.INTEGER,
			allowNull: false,
		},
		relatedLedgerId: {
			type: DataTypes.INTEGER,
		},

		// Transaction classification
		entryType: {
			type: DataTypes.ENUM(
				"booking_revenue",
				"addon_linens",
				"addon_time_window",
				"addon_high_volume",
				"addon_last_minute",
				"cancellation_fee_revenue",
				"cancellation_refund",
				"cancellation_partial_refund",
				"cleaner_payout_job",
				"cleaner_payout_cancellation",
				"cleaner_bonus",
				"platform_fee_standard",
				"platform_fee_business",
				"platform_fee_large_business",
				"appeal_refund",
				"appeal_fee_reversal",
				"manual_adjustment",
				"stripe_fee",
				"dispute_chargeback",
				"dispute_reversal",
				"conflict_refund",
				"conflict_payout"
			),
			allowNull: false,
		},

		// Accounting
		amount: {
			type: DataTypes.INTEGER,
			allowNull: false,
		},
		direction: {
			type: DataTypes.ENUM("debit", "credit"),
			allowNull: false,
		},

		accountType: {
			type: DataTypes.ENUM(
				"accounts_receivable",
				"revenue",
				"refunds_payable",
				"payouts_payable",
				"platform_revenue",
				"stripe_fees"
			),
			allowNull: false,
		},

		// Parties
		partyType: {
			type: DataTypes.ENUM("homeowner", "cleaner", "platform", "stripe"),
			allowNull: false,
		},
		partyUserId: {
			type: DataTypes.INTEGER,
		},

		// External references
		stripeObjectType: {
			type: DataTypes.STRING,
		},
		stripeObjectId: {
			type: DataTypes.STRING,
		},
		paymentRecordId: {
			type: DataTypes.INTEGER,
		},
		payoutRecordId: {
			type: DataTypes.INTEGER,
		},
		appealId: {
			type: DataTypes.INTEGER,
		},

		// Metadata
		description: {
			type: DataTypes.STRING,
			allowNull: false,
		},
		memo: {
			type: DataTypes.TEXT,
		},
		metadata: {
			type: DataTypes.JSONB,
			defaultValue: {},
		},

		// Tax
		taxYear: {
			type: DataTypes.INTEGER,
		},
		taxQuarter: {
			type: DataTypes.INTEGER,
		},
		taxReportable: {
			type: DataTypes.BOOLEAN,
			defaultValue: false,
		},
		taxCategory: {
			type: DataTypes.STRING,
		},
		form1099Eligible: {
			type: DataTypes.BOOLEAN,
			defaultValue: false,
		},

		// Reconciliation
		reconciled: {
			type: DataTypes.BOOLEAN,
			defaultValue: false,
		},
		reconciledAt: {
			type: DataTypes.DATE,
		},
		reconciledBy: {
			type: DataTypes.INTEGER,
		},
		reconciliationBatch: {
			type: DataTypes.STRING,
		},
		discrepancyAmount: {
			type: DataTypes.INTEGER,
		},
		discrepancyNotes: {
			type: DataTypes.TEXT,
		},

		// Timestamps
		effectiveDate: {
			type: DataTypes.DATE,
			allowNull: false,
		},
		postedAt: {
			type: DataTypes.DATE,
			defaultValue: DataTypes.NOW,
		},
		createdBy: {
			type: DataTypes.INTEGER,
		},
	}, {
		tableName: "JobLedgers",
		timestamps: true,
	});

	// Define associations
	JobLedger.associate = (models) => {
		JobLedger.belongsTo(models.UserAppointments, {
			foreignKey: "appointmentId",
			as: "appointment",
		});
		JobLedger.belongsTo(models.JobLedger, {
			foreignKey: "relatedLedgerId",
			as: "relatedEntry",
		});
		JobLedger.belongsTo(models.User, {
			foreignKey: "partyUserId",
			as: "party",
		});
		JobLedger.belongsTo(models.User, {
			foreignKey: "createdBy",
			as: "creator",
		});
		JobLedger.belongsTo(models.User, {
			foreignKey: "reconciledBy",
			as: "reconciler",
		});
		JobLedger.belongsTo(models.CancellationAppeal, {
			foreignKey: "appealId",
			as: "appeal",
		});
		JobLedger.belongsTo(models.Payment, {
			foreignKey: "paymentRecordId",
			as: "paymentRecord",
		});
		JobLedger.belongsTo(models.Payout, {
			foreignKey: "payoutRecordId",
			as: "payoutRecord",
		});
	};

	// Instance methods
	JobLedger.prototype.isDebit = function() {
		return this.direction === "debit";
	};

	JobLedger.prototype.isCredit = function() {
		return this.direction === "credit";
	};

	JobLedger.prototype.getSignedAmount = function() {
		return this.direction === "debit" ? -this.amount : this.amount;
	};

	// Class methods

	/**
	 * Get complete ledger for an appointment
	 */
	JobLedger.getJobLedger = function(appointmentId) {
		return this.findAll({
			where: { appointmentId },
			order: [["effectiveDate", "ASC"], ["postedAt", "ASC"]],
		});
	};

	/**
	 * Get ledger entries for a user
	 */
	JobLedger.getUserLedger = function(userId, options = {}) {
		const { partyType, startDate, endDate, limit = 100 } = options;
		const where = { partyUserId: userId };

		if (partyType) where.partyType = partyType;
		if (startDate || endDate) {
			where.effectiveDate = {};
			if (startDate) where.effectiveDate[sequelize.Sequelize.Op.gte] = startDate;
			if (endDate) where.effectiveDate[sequelize.Sequelize.Op.lte] = endDate;
		}

		return this.findAll({
			where,
			order: [["effectiveDate", "DESC"]],
			limit,
		});
	};

	/**
	 * Calculate summary totals for an appointment
	 */
	JobLedger.calculateSummary = async function(appointmentId) {
		const entries = await this.findAll({ where: { appointmentId } });

		const byType = {};
		entries.forEach(e => {
			if (!byType[e.entryType]) {
				byType[e.entryType] = { count: 0, total: 0 };
			}
			byType[e.entryType].count++;
			byType[e.entryType].total += e.amount;
		});

		return {
			totalRevenue: entries
				.filter(e => e.direction === "credit" && e.accountType.includes("revenue"))
				.reduce((sum, e) => sum + e.amount, 0),

			totalRefunds: entries
				.filter(e => e.entryType.includes("refund"))
				.reduce((sum, e) => sum + e.amount, 0),

			totalPayouts: entries
				.filter(e => e.partyType === "cleaner")
				.reduce((sum, e) => sum + e.amount, 0),

			netPlatformRevenue: entries
				.filter(e => e.accountType === "platform_revenue")
				.reduce((sum, e) => sum + e.amount, 0),

			byEntryType: byType,
		};
	};

	/**
	 * Get unreconciled entries
	 */
	JobLedger.getUnreconciled = function(limit = 100) {
		return this.findAll({
			where: {
				reconciled: false,
				stripeObjectId: { [sequelize.Sequelize.Op.ne]: null },
			},
			order: [["effectiveDate", "ASC"]],
			limit,
		});
	};

	/**
	 * Get entries by tax period
	 */
	JobLedger.getByTaxPeriod = function(taxYear, taxQuarter = null) {
		const where = { taxYear };
		if (taxQuarter) where.taxQuarter = taxQuarter;

		return this.findAll({
			where,
			order: [["effectiveDate", "ASC"]],
		});
	};

	/**
	 * Generate tax report
	 */
	JobLedger.generateTaxReport = async function(options = {}) {
		const { taxYear, taxQuarter, groupBy = "entryType" } = options;

		const where = {};
		if (taxYear) where.taxYear = taxYear;
		if (taxQuarter) where.taxQuarter = taxQuarter;

		const entries = await this.findAll({
			where,
			order: [["effectiveDate", "ASC"]],
		});

		const grouped = {};
		entries.forEach(e => {
			const key = e[groupBy];
			if (!grouped[key]) {
				grouped[key] = { count: 0, debits: 0, credits: 0 };
			}
			grouped[key].count++;
			if (e.direction === "debit") grouped[key].debits += e.amount;
			else grouped[key].credits += e.amount;
		});

		return {
			taxPeriod: { taxYear, taxQuarter },
			totalEntries: entries.length,
			totals: {
				debits: entries.filter(e => e.direction === "debit").reduce((s, e) => s + e.amount, 0),
				credits: entries.filter(e => e.direction === "credit").reduce((s, e) => s + e.amount, 0),
			},
			grouped,
			generatedAt: new Date(),
		};
	};

	/**
	 * Get 1099-eligible entries for a cleaner
	 */
	JobLedger.get1099Eligible = function(cleanerId, taxYear) {
		return this.findAll({
			where: {
				partyUserId: cleanerId,
				partyType: "cleaner",
				taxYear,
				form1099Eligible: true,
			},
			order: [["effectiveDate", "ASC"]],
		});
	};

	return JobLedger;
};
