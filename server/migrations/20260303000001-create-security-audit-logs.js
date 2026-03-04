"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
	async up(queryInterface, Sequelize) {
		// Create the SecurityAuditLogs table using Sequelize.ENUM which auto-creates the types
		await queryInterface.createTable("SecurityAuditLogs", {
			id: {
				type: Sequelize.INTEGER,
				autoIncrement: true,
				primaryKey: true,
			},
			eventType: {
				type: Sequelize.ENUM(
					"LOGIN_SUCCESS",
					"LOGIN_FAILED",
					"LOGOUT",
					"SESSION_EXPIRED",
					"PASSWORD_RESET_REQUESTED",
					"PASSWORD_RESET_COMPLETED",
					"PASSWORD_CHANGED",
					"EXPIRED_TEMP_PASSWORD_LOGIN",
					"USERNAME_RECOVERY_REQUESTED",
					"USERNAME_RECOVERY_SENT",
					"ACCOUNT_LOCKED",
					"ACCOUNT_UNLOCKED",
					"ACCOUNT_FROZEN",
					"ACCOUNT_UNFROZEN",
					"RATE_LIMIT_EXCEEDED",
					"ADMIN_PASSWORD_RESET",
					"ADMIN_ACCOUNT_UPDATE",
					"SUSPICIOUS_ACTIVITY",
					"TOKEN_INVALID",
					"UNAUTHORIZED_ACCESS"
				),
				allowNull: false,
			},
			userId: {
				type: Sequelize.INTEGER,
				allowNull: true,
				references: {
					model: "Users",
					key: "id",
				},
				onUpdate: "CASCADE",
				onDelete: "SET NULL",
			},
			username: {
				type: Sequelize.STRING,
				allowNull: true,
			},
			targetUserId: {
				type: Sequelize.INTEGER,
				allowNull: true,
				references: {
					model: "Users",
					key: "id",
				},
				onUpdate: "CASCADE",
				onDelete: "SET NULL",
			},
			ipAddress: {
				type: Sequelize.TEXT,
				allowNull: true,
			},
			userAgent: {
				type: Sequelize.STRING(500),
				allowNull: true,
			},
			emailHash: {
				type: Sequelize.TEXT,
				allowNull: true,
			},
			eventData: {
				type: Sequelize.JSONB,
				allowNull: false,
				defaultValue: {},
			},
			severity: {
				type: Sequelize.ENUM("info", "warning", "critical"),
				allowNull: false,
				defaultValue: "info",
			},
			success: {
				type: Sequelize.BOOLEAN,
				allowNull: false,
				defaultValue: true,
			},
			errorMessage: {
				type: Sequelize.STRING(500),
				allowNull: true,
			},
			occurredAt: {
				type: Sequelize.DATE,
				allowNull: false,
				defaultValue: Sequelize.literal("CURRENT_TIMESTAMP"),
			},
			createdAt: {
				type: Sequelize.DATE,
				allowNull: false,
				defaultValue: Sequelize.literal("CURRENT_TIMESTAMP"),
			},
		});

		// Create indexes
		await queryInterface.addIndex("SecurityAuditLogs", ["eventType"], {
			name: "security_audit_logs_event_type",
		});
		await queryInterface.addIndex("SecurityAuditLogs", ["userId"], {
			name: "security_audit_logs_user_id",
		});
		await queryInterface.addIndex("SecurityAuditLogs", ["occurredAt"], {
			name: "security_audit_logs_occurred_at",
		});
		await queryInterface.addIndex("SecurityAuditLogs", ["severity"], {
			name: "security_audit_logs_severity",
		});
		await queryInterface.addIndex("SecurityAuditLogs", ["success"], {
			name: "security_audit_logs_success",
		});
	},

	async down(queryInterface) {
		// Drop the table
		await queryInterface.dropTable("SecurityAuditLogs");

		// Drop the ENUM types
		await queryInterface.sequelize.query(`
			DROP TYPE IF EXISTS "enum_SecurityAuditLogs_eventType";
		`);
		await queryInterface.sequelize.query(`
			DROP TYPE IF EXISTS "enum_SecurityAuditLogs_severity";
		`);
	},
};
