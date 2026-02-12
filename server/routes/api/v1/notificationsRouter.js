const express = require("express");
const { Op } = require("sequelize");
const { Notification, UserAppointments, CleanerClient, User } = require("../../../models");
const authenticateToken = require("../../../middleware/authenticatedToken");

const notificationsRouter = express.Router();

// GET: Get all notifications for the authenticated user (paginated)
notificationsRouter.get("/", authenticateToken, async (req, res) => {
  try {
    const userId = req.userId;
    const { page = 1, limit = 20, unreadOnly = false } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    const whereClause = { userId };
    if (unreadOnly === "true") {
      whereClause.isRead = false;
    }

    const { count, rows: notifications } = await Notification.findAndCountAll({
      where: whereClause,
      order: [["createdAt", "DESC"]],
      limit: parseInt(limit),
      offset,
      include: [
        {
          model: UserAppointments,
          as: "appointment",
          attributes: ["id", "date", "price", "homeId", "clientResponse", "expiresAt"],
          required: false,
        },
      ],
    });

    // Filter out expired notifications for pending bookings
    const activeNotifications = notifications.filter((n) => {
      if (n.type === "pending_booking" && n.expiresAt) {
        return new Date(n.expiresAt) > new Date();
      }
      return true;
    });

    return res.status(200).json({
      notifications: activeNotifications,
      pagination: {
        total: count,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(count / parseInt(limit)),
      },
    });
  } catch (error) {
    console.error("[Notifications] Error fetching notifications:", error);
    return res.status(500).json({ error: "Failed to fetch notifications" });
  }
});

// GET: Get unread count for badge
notificationsRouter.get("/unread-count", authenticateToken, async (req, res) => {
  try {
    const userId = req.userId;

    const [unreadCount, actionRequiredCount] = await Promise.all([
      Notification.getUnreadCount(userId),
      Notification.getActionRequiredCount(userId),
    ]);

    return res.status(200).json({
      unreadCount,
      actionRequiredCount,
    });
  } catch (error) {
    console.error("[Notifications] Error getting unread count:", error);
    return res.status(500).json({ error: "Failed to get notification count" });
  }
});

// GET: Get a single notification by ID
notificationsRouter.get("/:id", authenticateToken, async (req, res) => {
  try {
    const userId = req.userId;
    const { id } = req.params;

    // Skip if id is a route keyword
    if (id === "unread-count" || id === "action-required") {
      return res.status(400).json({ error: "Invalid notification ID" });
    }

    const notification = await Notification.findOne({
      where: { id, userId },
      include: [
        {
          model: UserAppointments,
          as: "appointment",
          attributes: ["id", "date", "price", "homeId", "clientResponse", "expiresAt"],
          required: false,
        },
      ],
    });

    if (!notification) {
      return res.status(404).json({ error: "Notification not found" });
    }

    return res.status(200).json({ notification });
  } catch (error) {
    console.error("[Notifications] Error fetching notification:", error);
    return res.status(500).json({ error: "Failed to fetch notification" });
  }
});

// GET: Get action-required notifications (pending bookings, etc.)
notificationsRouter.get("/action-required", authenticateToken, async (req, res) => {
  try {
    const userId = req.userId;

    const notifications = await Notification.findAll({
      where: {
        userId,
        actionRequired: true,
        isRead: false,
        [Op.or]: [
          { expiresAt: null },
          { expiresAt: { [Op.gt]: new Date() } },
        ],
      },
      order: [["createdAt", "DESC"]],
      include: [
        {
          model: UserAppointments,
          as: "appointment",
          attributes: ["id", "date", "price", "homeId", "expiresAt", "bookedByCleanerId"],
          required: false,
          include: [
            {
              model: User,
              as: "bookedByCleaner",
              attributes: ["id", "firstName", "lastName"],
            },
          ],
        },
        {
          model: CleanerClient,
          as: "cleanerClient",
          attributes: ["id", "cleanerId", "defaultPrice"],
          required: false,
        },
      ],
    });

    return res.status(200).json({ notifications });
  } catch (error) {
    console.error("[Notifications] Error fetching action-required notifications:", error);
    return res.status(500).json({ error: "Failed to fetch notifications" });
  }
});

// PATCH: Mark a notification as read
notificationsRouter.patch("/:id/read", authenticateToken, async (req, res) => {
  try {
    const userId = req.userId;
    const { id } = req.params;

    const notification = await Notification.findOne({
      where: { id, userId },
    });

    if (!notification) {
      return res.status(404).json({ error: "Notification not found" });
    }

    await notification.update({ isRead: true });

    return res.status(200).json({
      message: "Notification marked as read",
      notification,
    });
  } catch (error) {
    console.error("[Notifications] Error marking notification as read:", error);
    return res.status(500).json({ error: "Failed to update notification" });
  }
});

// POST: Mark all notifications as read
notificationsRouter.post("/mark-all-read", authenticateToken, async (req, res) => {
  try {
    const userId = req.userId;

    const [updatedCount] = await Notification.markAllAsRead(userId);

    return res.status(200).json({
      message: "All notifications marked as read",
      updatedCount,
    });
  } catch (error) {
    console.error("[Notifications] Error marking all as read:", error);
    return res.status(500).json({ error: "Failed to update notifications" });
  }
});

// DELETE: Delete a notification
notificationsRouter.delete("/:id", authenticateToken, async (req, res) => {
  try {
    const userId = req.userId;
    const { id } = req.params;

    const notification = await Notification.findOne({
      where: { id, userId },
    });

    if (!notification) {
      return res.status(404).json({ error: "Notification not found" });
    }

    await notification.destroy();

    return res.status(200).json({
      message: "Notification deleted",
    });
  } catch (error) {
    console.error("[Notifications] Error deleting notification:", error);
    return res.status(500).json({ error: "Failed to delete notification" });
  }
});

// POST: Clear all notifications (optional - for settings)
notificationsRouter.post("/clear-all", authenticateToken, async (req, res) => {
  try {
    const userId = req.userId;

    await Notification.destroy({
      where: { userId },
    });

    return res.status(200).json({
      message: "All notifications cleared",
    });
  } catch (error) {
    console.error("[Notifications] Error clearing notifications:", error);
    return res.status(500).json({ error: "Failed to clear notifications" });
  }
});

module.exports = notificationsRouter;
