module.exports = (sequelize, DataTypes) => {
  const Notification = sequelize.define("Notification", {
    id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      autoIncrement: true,
      primaryKey: true,
    },

    // === Relationships ===
    userId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    relatedAppointmentId: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    relatedCleanerClientId: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },

    // === Notification content ===
    type: {
      type: DataTypes.STRING(50),
      allowNull: false,
      validate: {
        isIn: [
          [
            "pending_booking",
            "booking_accepted",
            "booking_declined",
            "booking_expired",
            "booking_rescheduled",
            "general",
            "guest_not_left",
            "guest_not_left_escalation",
            "guest_not_left_expired",
            "last_minute_urgent",
            // Cleaner approval notifications
            "cleaner_join_request",
            "join_request_approved",
            "join_request_declined",
            "join_request_auto_approved",
            "cleaner_auto_approved",
            // Business owner client notifications
            "client_booked",
            "business_owner_declined",
            "client_opened_to_marketplace",
            "client_cancelled_after_decline",
            // Home size adjustment notifications
            "adjustment_expired",
            "adjustment_expired_review",
            "adjustment_disputed",
            // Multi-cleaner job notifications
            "multi_cleaner_offer",
            "multi_cleaner_slot_filled",
            "multi_cleaner_urgent",
            "multi_cleaner_final_warning",
            "cleaner_dropout",
            "solo_completion_offer",
            "partial_completion",
            "edge_case_decision_required",
            "edge_case_auto_proceeded",
            "edge_case_cleaner_confirmed",
            "edge_case_second_cleaner_joined",
            "proceed_confirmed",
            // Business employee notifications
            "employee_job_assigned",
            "employee_job_reassigned",
            "employee_pay_changed",
            "employee_accepted_invite",
            "employee_started_job",
            "employee_completed_job",
            // Client notifications
            "client_booked_appointment",
            "price_change",
            "payment_captured",
            // Business owner reminders
            "unassigned_reminder_bo",
            // New home request notifications (client adds home, BO accepts/declines)
            "new_home_request",
            "new_home_accepted",
            "new_home_declined",
            // IT dispute notifications
            "it_dispute_submitted",
            "it_dispute_assigned",
            "it_dispute_updated",
            "it_dispute_resolved",
            // Unassigned appointment expiration
            "appointment_expired_unassigned",
            // Expired appointments (never cleaned)
            "multi_cleaner_expired_no_show",
            "appointment_expired_no_show",
            // Payment failure notifications
            "payment_failed",
            "payment_retry_failed",
            "payment_retry_success",
            "appointment_cancelled_payment",
          ],
        ],
      },
    },
    title: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    body: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    data: {
      type: DataTypes.JSONB,
      allowNull: true,
    },

    // === Status flags ===
    isRead: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    actionRequired: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },

    // === Expiration ===
    expiresAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
  });

  // Instance method to check if notification is expired
  Notification.prototype.isExpired = function () {
    if (!this.expiresAt) return false;
    return new Date() > new Date(this.expiresAt);
  };

  // Class method to get unread count for a user (excludes expired notifications)
  Notification.getUnreadCount = async function (userId) {
    const { Op } = require("sequelize");
    return await this.count({
      where: {
        userId,
        isRead: false,
        [Op.or]: [
          { expiresAt: null },
          { expiresAt: { [Op.gt]: new Date() } },
        ],
      },
    });
  };

  // Class method to get action-required count for a user (excludes expired notifications)
  // Note: Counts ALL action-required notifications regardless of read status
  // Badge persists until the action is resolved (e.g., appointment assigned)
  Notification.getActionRequiredCount = async function (userId) {
    const { Op } = require("sequelize");
    return await this.count({
      where: {
        userId,
        actionRequired: true,
        [Op.or]: [
          { expiresAt: null },
          { expiresAt: { [Op.gt]: new Date() } },
        ],
      },
    });
  };

  // Class method to mark all as read for a user
  Notification.markAllAsRead = async function (userId) {
    return await this.update(
      { isRead: true },
      {
        where: {
          userId,
          isRead: false,
        },
      }
    );
  };

  // Define associations
  Notification.associate = (models) => {
    Notification.belongsTo(models.User, {
      foreignKey: "userId",
      as: "user",
    });
    Notification.belongsTo(models.UserAppointments, {
      foreignKey: "relatedAppointmentId",
      as: "appointment",
    });
    Notification.belongsTo(models.CleanerClient, {
      foreignKey: "relatedCleanerClientId",
      as: "cleanerClient",
    });
  };

  return Notification;
};
