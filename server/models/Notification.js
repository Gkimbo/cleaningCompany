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

  // Class method to get unread count for a user
  Notification.getUnreadCount = async function (userId) {
    return await this.count({
      where: {
        userId,
        isRead: false,
      },
    });
  };

  // Class method to get action-required count for a user
  Notification.getActionRequiredCount = async function (userId) {
    return await this.count({
      where: {
        userId,
        actionRequired: true,
        isRead: false,
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
