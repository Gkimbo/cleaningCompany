const express = require("express");
const { User } = require("../../../models");
const authenticateToken = require("../../../middleware/authenticatedToken");
const PushNotification = require("../../../services/sendNotifications/PushNotificationClass");

const pushNotificationRouter = express.Router();

// POST: Register push notification token
pushNotificationRouter.post("/register-token", authenticateToken, async (req, res) => {
  try {
    const { expoPushToken } = req.body;
    const userId = req.userId;

    if (!expoPushToken) {
      return res.status(400).json({ error: "Push token is required" });
    }

    // Validate the token format
    if (!PushNotification.isValidExpoPushToken(expoPushToken)) {
      return res.status(400).json({ error: "Invalid Expo push token format" });
    }

    const user = await User.findByPk(userId);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    // Update the user's push token
    await user.update({ expoPushToken });

    console.log(`[Push] Token registered for user ${userId}`);
    return res.status(200).json({ message: "Push token registered successfully" });
  } catch (error) {
    console.error("[Push] Error registering token:", error);
    return res.status(500).json({ error: "Failed to register push token" });
  }
});

// DELETE: Remove push notification token (on logout)
pushNotificationRouter.delete("/remove-token", authenticateToken, async (req, res) => {
  try {
    const userId = req.userId;

    const user = await User.findByPk(userId);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    // Clear the user's push token
    await user.update({ expoPushToken: null });

    console.log(`[Push] Token removed for user ${userId}`);
    return res.status(200).json({ message: "Push token removed successfully" });
  } catch (error) {
    console.error("[Push] Error removing token:", error);
    return res.status(500).json({ error: "Failed to remove push token" });
  }
});

// GET: Get notification preferences
pushNotificationRouter.get("/preferences", authenticateToken, async (req, res) => {
  try {
    const userId = req.userId;

    const user = await User.findByPk(userId, {
      attributes: ["id", "notifications", "expoPushToken"],
    });

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    // notifications array contains preferences like ["email", "phone"]
    const preferences = user.notifications || [];

    return res.status(200).json({
      emailNotifications: preferences.includes("email"),
      pushNotifications: preferences.includes("phone"),
      hasPushToken: !!user.expoPushToken,
    });
  } catch (error) {
    console.error("[Push] Error getting preferences:", error);
    return res.status(500).json({ error: "Failed to get notification preferences" });
  }
});

// PATCH: Update notification preferences
pushNotificationRouter.patch("/preferences", authenticateToken, async (req, res) => {
  try {
    const userId = req.userId;
    const { emailNotifications, pushNotifications } = req.body;

    const user = await User.findByPk(userId);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    // Build the notifications array based on preferences
    const notifications = [];
    if (emailNotifications) {
      notifications.push("email");
    }
    if (pushNotifications) {
      notifications.push("phone");
    }

    await user.update({ notifications });

    return res.status(200).json({
      message: "Notification preferences updated",
      emailNotifications: notifications.includes("email"),
      pushNotifications: notifications.includes("phone"),
    });
  } catch (error) {
    console.error("[Push] Error updating preferences:", error);
    return res.status(500).json({ error: "Failed to update notification preferences" });
  }
});

// POST: Snooze supply reminders for 1 week
pushNotificationRouter.post("/snooze-supply-reminder", authenticateToken, async (req, res) => {
  try {
    const userId = req.userId;

    const user = await User.findByPk(userId);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    // Only cleaners can snooze supply reminders
    if (user.type !== "cleaner") {
      return res.status(403).json({ error: "Only cleaners can snooze supply reminders" });
    }

    // Set snooze for 1 week from now
    const snoozeUntil = new Date();
    snoozeUntil.setDate(snoozeUntil.getDate() + 7);

    await user.update({ supplyReminderSnoozedUntil: snoozeUntil });

    console.log(`[Push] Supply reminders snoozed for user ${userId} until ${snoozeUntil.toISOString()}`);
    return res.status(200).json({
      message: "Supply reminders snoozed for 1 week",
      snoozedUntil: snoozeUntil.toISOString(),
    });
  } catch (error) {
    console.error("[Push] Error snoozing supply reminders:", error);
    return res.status(500).json({ error: "Failed to snooze supply reminders" });
  }
});

// GET: Get supply reminder snooze status
pushNotificationRouter.get("/supply-reminder-status", authenticateToken, async (req, res) => {
  try {
    const userId = req.userId;

    const user = await User.findByPk(userId, {
      attributes: ["id", "supplyReminderSnoozedUntil"],
    });

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const now = new Date();
    const snoozedUntil = user.supplyReminderSnoozedUntil;
    const isSnoozed = !!(snoozedUntil && new Date(snoozedUntil) > now);

    return res.status(200).json({
      isSnoozed,
      snoozedUntil: isSnoozed ? snoozedUntil : null,
    });
  } catch (error) {
    console.error("[Push] Error getting supply reminder status:", error);
    return res.status(500).json({ error: "Failed to get supply reminder status" });
  }
});

module.exports = pushNotificationRouter;
