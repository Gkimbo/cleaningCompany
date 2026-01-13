/**
 * AnalyticsEvent Model
 *
 * Stores internal analytics events for tracking:
 * - Flow abandonment (where users drop off in multi-step flows)
 * - Job duration (how long cleanings take)
 * - Offline mode usage (how often cleaners work offline)
 * - Dispute frequency (how often disputes trigger)
 * - Pay override frequency (how often pay is manually adjusted)
 */

module.exports = (sequelize, DataTypes) => {
	const AnalyticsEvent = sequelize.define("AnalyticsEvent", {
		id: {
			type: DataTypes.INTEGER,
			autoIncrement: true,
			primaryKey: true,
		},

		// Event classification
		eventType: {
			type: DataTypes.ENUM(
				// Flow abandonment events
				"flow_started",
				"flow_step_completed",
				"flow_abandoned",
				"flow_completed",
				// Job tracking events
				"job_started",
				"job_completed",
				// Offline mode events
				"offline_session_started",
				"offline_session_synced",
				// Dispute events
				"dispute_created",
				"dispute_resolved",
				// Pay override events
				"pay_override_applied"
			),
			allowNull: false,
		},

		eventCategory: {
			type: DataTypes.ENUM(
				"flow_abandonment",
				"job_duration",
				"offline_usage",
				"disputes",
				"pay_override"
			),
			allowNull: false,
		},

		// Who triggered the event (nullable for anonymous/pre-login events)
		userId: {
			type: DataTypes.INTEGER,
			allowNull: true,
			references: {
				model: "Users",
				key: "id",
			},
		},

		// Session identifier for grouping flow events
		sessionId: {
			type: DataTypes.STRING(64),
			allowNull: true,
			comment: "Groups related flow events together",
		},

		// Flexible metadata storage
		metadata: {
			type: DataTypes.JSONB,
			allowNull: false,
			defaultValue: {},
			comment: "Event-specific data (flowName, stepName, duration, amounts, etc.)",
		},

		// Aggregation helper fields (indexed for fast queries)
		dateOnly: {
			type: DataTypes.DATEONLY,
			allowNull: false,
			comment: "Date portion for daily aggregations",
		},

		hourOfDay: {
			type: DataTypes.INTEGER,
			allowNull: false,
			validate: {
				min: 0,
				max: 23,
			},
			comment: "Hour (0-23) for time-of-day analysis",
		},
	}, {
		tableName: "AnalyticsEvents",
		timestamps: true,
		updatedAt: false, // Events are immutable, no updates
		indexes: [
			// Primary query indexes
			{ fields: ["eventType"] },
			{ fields: ["eventCategory"] },
			{ fields: ["dateOnly"] },
			{ fields: ["userId"] },
			{ fields: ["sessionId"] },
			// Compound indexes for common queries
			{ fields: ["eventCategory", "dateOnly"] },
			{ fields: ["eventType", "dateOnly"] },
			// For flow analysis
			{
				fields: ["sessionId", "eventType"],
				where: { eventCategory: "flow_abandonment" },
			},
		],
		hooks: {
			beforeCreate: (event) => {
				// Auto-populate date aggregation fields
				const now = new Date();
				if (!event.dateOnly) {
					event.dateOnly = now.toISOString().split("T")[0];
				}
				if (event.hourOfDay === undefined) {
					event.hourOfDay = now.getHours();
				}
			},
		},
	});

	// Class methods for common queries
	AnalyticsEvent.getEventsByCategory = async function(category, startDate, endDate) {
		return this.findAll({
			where: {
				eventCategory: category,
				dateOnly: {
					[sequelize.Sequelize.Op.between]: [startDate, endDate],
				},
			},
			order: [["createdAt", "ASC"]],
		});
	};

	AnalyticsEvent.getFlowEvents = async function(sessionId) {
		return this.findAll({
			where: {
				sessionId,
				eventCategory: "flow_abandonment",
			},
			order: [["createdAt", "ASC"]],
		});
	};

	AnalyticsEvent.getDailyCount = async function(eventType, date) {
		return this.count({
			where: {
				eventType,
				dateOnly: date,
			},
		});
	};

	return AnalyticsEvent;
};
