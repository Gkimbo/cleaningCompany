const express = require("express");
const jwt = require("jsonwebtoken");
const {
  User,
  UserAppointments,
  UserHomes,
  UserBills,
  CalendarSync,
} = require("../../../models");
const {
  getCheckoutDates,
  validateIcalUrl,
  detectPlatform,
} = require("../../../services/icalParser");
const calculatePrice = require("../../../services/CalculatePrice");

const calendarSyncRouter = express.Router();
const secretKey = process.env.SESSION_SECRET;

// Middleware to verify JWT token
const verifyToken = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).json({ error: "Authorization token required" });
  }

  try {
    const token = authHeader.split(" ")[1];
    const decoded = jwt.verify(token, secretKey);
    req.userId = decoded.userId;
    next();
  } catch (error) {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
};

// Get all calendar syncs for the current user
calendarSyncRouter.get("/", verifyToken, async (req, res) => {
  try {
    const syncs = await CalendarSync.findAll({
      where: { userId: req.userId },
      include: [
        {
          model: UserHomes,
          as: "home",
          attributes: ["id", "nickName", "address", "city"],
        },
      ],
      order: [["createdAt", "DESC"]],
    });

    return res.status(200).json({ syncs });
  } catch (error) {
    console.error("Error fetching calendar syncs:", error);
    return res.status(500).json({ error: "Failed to fetch calendar syncs" });
  }
});

// Get calendar syncs for a specific home
calendarSyncRouter.get("/home/:homeId", verifyToken, async (req, res) => {
  const { homeId } = req.params;

  try {
    // Verify the user owns this home
    const home = await UserHomes.findOne({
      where: { id: homeId, userId: req.userId },
    });

    if (!home) {
      return res.status(404).json({ error: "Home not found" });
    }

    const syncs = await CalendarSync.findAll({
      where: { homeId, userId: req.userId },
      order: [["createdAt", "DESC"]],
    });

    return res.status(200).json({ syncs });
  } catch (error) {
    console.error("Error fetching calendar syncs for home:", error);
    return res.status(500).json({ error: "Failed to fetch calendar syncs" });
  }
});

// Add a new calendar sync
calendarSyncRouter.post("/", verifyToken, async (req, res) => {
  const { homeId, icalUrl, autoCreateAppointments, daysAfterCheckout, autoSync } = req.body;

  try {
    // Validate required fields
    if (!homeId || !icalUrl) {
      return res.status(400).json({ error: "Home ID and iCal URL are required" });
    }

    // Validate iCal URL format
    if (!validateIcalUrl(icalUrl)) {
      return res.status(400).json({
        error: "Invalid iCal URL. Please provide a valid calendar export URL from Airbnb, VRBO, or similar platform.",
      });
    }

    // Verify the user owns this home
    const home = await UserHomes.findOne({
      where: { id: homeId, userId: req.userId },
    });

    if (!home) {
      return res.status(404).json({ error: "Home not found" });
    }

    // Check if this URL is already synced for this home
    const existingSync = await CalendarSync.findOne({
      where: { homeId, icalUrl },
    });

    if (existingSync) {
      return res.status(400).json({ error: "This calendar is already connected to this home" });
    }

    // Detect the platform from the URL
    const platform = detectPlatform(icalUrl);

    // Test the iCal URL by fetching it
    let checkoutDates = [];
    try {
      checkoutDates = await getCheckoutDates(icalUrl);
    } catch (fetchError) {
      return res.status(400).json({
        error: `Failed to fetch calendar: ${fetchError.message}. Please check the URL and try again.`,
      });
    }

    // Create the calendar sync record
    const newSync = await CalendarSync.create({
      userId: req.userId,
      homeId,
      platform,
      icalUrl,
      isActive: true,
      lastSyncAt: new Date(),
      lastSyncStatus: "success",
      autoCreateAppointments: autoCreateAppointments !== false,
      daysAfterCheckout: daysAfterCheckout || 0,
      syncedEventUids: [],
      autoSync: autoSync === true,
    });

    return res.status(201).json({
      sync: newSync,
      upcomingCheckouts: checkoutDates.length,
      message: `Calendar connected successfully! Found ${checkoutDates.length} upcoming checkout(s).`,
    });
  } catch (error) {
    console.error("Error creating calendar sync:", error);
    return res.status(500).json({ error: "Failed to create calendar sync" });
  }
});

// Update a calendar sync
calendarSyncRouter.patch("/:id", verifyToken, async (req, res) => {
  const { id } = req.params;
  const { isActive, autoCreateAppointments, daysAfterCheckout, autoSync } = req.body;

  try {
    const sync = await CalendarSync.findOne({
      where: { id, userId: req.userId },
    });

    if (!sync) {
      return res.status(404).json({ error: "Calendar sync not found" });
    }

    const updates = {};
    if (typeof isActive === "boolean") updates.isActive = isActive;
    if (typeof autoCreateAppointments === "boolean") updates.autoCreateAppointments = autoCreateAppointments;
    if (typeof daysAfterCheckout === "number") updates.daysAfterCheckout = daysAfterCheckout;
    if (typeof autoSync === "boolean") updates.autoSync = autoSync;

    await sync.update(updates);

    return res.status(200).json({ sync, message: "Calendar sync updated" });
  } catch (error) {
    console.error("Error updating calendar sync:", error);
    return res.status(500).json({ error: "Failed to update calendar sync" });
  }
});

// Delete a calendar sync
calendarSyncRouter.delete("/:id", verifyToken, async (req, res) => {
  const { id } = req.params;

  try {
    const sync = await CalendarSync.findOne({
      where: { id, userId: req.userId },
    });

    if (!sync) {
      return res.status(404).json({ error: "Calendar sync not found" });
    }

    await sync.destroy();

    return res.status(200).json({ message: "Calendar sync removed" });
  } catch (error) {
    console.error("Error deleting calendar sync:", error);
    return res.status(500).json({ error: "Failed to delete calendar sync" });
  }
});

// Manually trigger a sync for a specific calendar
calendarSyncRouter.post("/:id/sync", verifyToken, async (req, res) => {
  const { id } = req.params;

  try {
    const sync = await CalendarSync.findOne({
      where: { id, userId: req.userId },
      include: [{ model: UserHomes, as: "home" }],
    });

    if (!sync) {
      return res.status(404).json({ error: "Calendar sync not found" });
    }

    // Fetch checkout dates from iCal
    let checkoutDates;
    try {
      checkoutDates = await getCheckoutDates(sync.icalUrl);
    } catch (fetchError) {
      await sync.update({
        lastSyncAt: new Date(),
        lastSyncStatus: "error",
        lastSyncError: fetchError.message,
      });
      return res.status(400).json({ error: `Sync failed: ${fetchError.message}` });
    }

    const home = sync.home;
    const syncedUids = sync.syncedEventUids || [];
    const deletedDates = sync.deletedDates || [];
    const newAppointments = [];
    const newSyncedUids = [...syncedUids];
    const newDeletedDates = [...deletedDates];

    // Process checkout dates and create appointments
    if (sync.autoCreateAppointments) {
      for (const checkout of checkoutDates) {
        // Calculate the cleaning date based on daysAfterCheckout setting
        const checkoutDate = new Date(checkout.checkoutDate);
        const cleaningDate = new Date(checkoutDate);
        cleaningDate.setDate(cleaningDate.getDate() + sync.daysAfterCheckout);

        const cleaningDateStr = cleaningDate.toISOString().split("T")[0];

        // If this date was previously deleted but still exists in external calendar,
        // remove it from deletedDates so we can recreate the appointment
        // (user is manually syncing, so they want to restore deleted appointments)
        if (deletedDates.includes(cleaningDateStr)) {
          const deleteIndex = newDeletedDates.indexOf(cleaningDateStr);
          if (deleteIndex > -1) {
            newDeletedDates.splice(deleteIndex, 1);
            console.log(`[Calendar Sync] Removing ${cleaningDateStr} from deletedDates - will recreate appointment`);
          }
        }

        // Check if appointment already exists for this date
        const existingAppointment = await UserAppointments.findOne({
          where: {
            homeId: sync.homeId,
            date: cleaningDateStr,
          },
        });

        if (existingAppointment) {
          // Mark as synced even if appointment exists
          if (!newSyncedUids.includes(checkout.uid)) {
            newSyncedUids.push(checkout.uid);
          }
          continue;
        }

        // If already synced but appointment no longer exists, we need to recreate it
        // (user manually deleted the appointment)
        const wasPreviouslySynced = syncedUids.includes(checkout.uid);
        if (wasPreviouslySynced) {
          // Appointment was deleted - will recreate below
          console.log(`[Calendar Sync] Recreating deleted appointment for ${cleaningDateStr}`);
        }

        // Calculate price based on home details
        const price = await calculatePrice(
          home.sheetsProvided,
          home.towelsProvided,
          home.numBeds,
          home.numBaths,
          home.timeToBeCompleted
        );

        // Get user's bill
        const existingBill = await UserBills.findOne({
          where: { userId: req.userId },
        });

        if (existingBill) {
          const oldAppt = Number(existingBill.dataValues.appointmentDue) || 0;
          const cancellationFee = Number(existingBill.dataValues.cancellationFee) || 0;
          const total = cancellationFee + oldAppt;
          const priceNum = Number(price) || 0;

          await existingBill.update({
            appointmentDue: oldAppt + priceNum,
            totalDue: total + priceNum,
          });
        }

        // Create the appointment
        const newAppointment = await UserAppointments.create({
          userId: req.userId,
          homeId: sync.homeId,
          date: cleaningDateStr,
          price,
          paid: false,
          bringTowels: home.towelsProvided === "yes" ? "Yes" : "No",
          bringSheets: home.sheetsProvided === "yes" ? "Yes" : "No",
          keyPadCode: home.keyPadCode,
          keyLocation: home.keyLocation,
          completed: false,
          hasBeenAssigned: false,
          empoyeesNeeded: home.cleanersNeeded || 1,
          timeToBeCompleted: home.timeToBeCompleted,
        });

        newAppointments.push({
          id: newAppointment.id,
          date: cleaningDateStr,
          price,
          source: checkout.summary || `${sync.platform} booking`,
        });

        if (!newSyncedUids.includes(checkout.uid)) {
          newSyncedUids.push(checkout.uid);
        }
      }
    }

    // Update sync record
    await sync.update({
      lastSyncAt: new Date(),
      lastSyncStatus: "success",
      lastSyncError: null,
      syncedEventUids: newSyncedUids,
      deletedDates: newDeletedDates,
    });

    return res.status(200).json({
      message: "Sync completed successfully",
      checkoutsFound: checkoutDates.length,
      appointmentsCreated: newAppointments.length,
      newAppointments,
    });
  } catch (error) {
    console.error("Error syncing calendar:", error);
    return res.status(500).json({ error: "Failed to sync calendar" });
  }
});

// Get disclaimer acceptance status
calendarSyncRouter.get("/disclaimer/status", verifyToken, async (req, res) => {
  try {
    const user = await User.findByPk(req.userId, {
      attributes: ["id", "calendarSyncDisclaimerAcceptedAt"],
    });

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    return res.status(200).json({
      accepted: !!user.calendarSyncDisclaimerAcceptedAt,
      acceptedAt: user.calendarSyncDisclaimerAcceptedAt,
    });
  } catch (error) {
    console.error("Error fetching disclaimer status:", error);
    return res.status(500).json({ error: "Failed to fetch disclaimer status" });
  }
});

// Accept the disclaimer
calendarSyncRouter.post("/disclaimer/accept", verifyToken, async (req, res) => {
  try {
    const user = await User.findByPk(req.userId);

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const acceptedAt = new Date();
    await user.update({ calendarSyncDisclaimerAcceptedAt: acceptedAt });

    return res.status(200).json({
      success: true,
      acceptedAt,
    });
  } catch (error) {
    console.error("Error accepting disclaimer:", error);
    return res.status(500).json({ error: "Failed to accept disclaimer" });
  }
});

// Preview what appointments would be created from a sync
calendarSyncRouter.get("/:id/preview", verifyToken, async (req, res) => {
  const { id } = req.params;

  try {
    const sync = await CalendarSync.findOne({
      where: { id, userId: req.userId },
      include: [{ model: UserHomes, as: "home" }],
    });

    if (!sync) {
      return res.status(404).json({ error: "Calendar sync not found" });
    }

    // Fetch checkout dates from iCal
    let checkoutDates;
    try {
      checkoutDates = await getCheckoutDates(sync.icalUrl);
    } catch (fetchError) {
      return res.status(400).json({ error: `Failed to fetch calendar: ${fetchError.message}` });
    }

    const home = sync.home;
    const syncedUids = sync.syncedEventUids || [];
    const preview = [];

    for (const checkout of checkoutDates) {
      const checkoutDate = new Date(checkout.checkoutDate);
      const cleaningDate = new Date(checkoutDate);
      cleaningDate.setDate(cleaningDate.getDate() + sync.daysAfterCheckout);

      const cleaningDateStr = cleaningDate.toISOString().split("T")[0];

      // Check if already synced
      const alreadySynced = syncedUids.includes(checkout.uid);

      // Check if appointment already exists
      const existingAppointment = await UserAppointments.findOne({
        where: {
          homeId: sync.homeId,
          date: cleaningDateStr,
        },
      });

      // Calculate price
      const price = await calculatePrice(
        home.sheetsProvided,
        home.towelsProvided,
        home.numBeds,
        home.numBaths,
        home.timeToBeCompleted
      );

      preview.push({
        checkoutDate: checkout.checkoutDate,
        cleaningDate: cleaningDateStr,
        source: checkout.summary || `${sync.platform} booking`,
        price,
        status: alreadySynced
          ? "already_synced"
          : existingAppointment
          ? "appointment_exists"
          : "will_create",
      });
    }

    return res.status(200).json({
      preview,
      totalCheckouts: checkoutDates.length,
      willCreate: preview.filter((p) => p.status === "will_create").length,
    });
  } catch (error) {
    console.error("Error previewing sync:", error);
    return res.status(500).json({ error: "Failed to preview sync" });
  }
});

module.exports = calendarSyncRouter;
