/**
 * Calendar Sync Service
 * Handles automatic syncing of iCal feeds and creating appointments
 * - Syncs calendars with autoSync enabled every hour
 * - Daily health check at midnight
 */

const cron = require("node-cron");
const {
  CalendarSync,
  UserAppointments,
  UserHomes,
  UserBills,
  User,
} = require("../models");
const Email = require("./sendNotifications/EmailClass");
const { getCheckoutDates } = require("./icalParser");
const calculatePrice = require("./CalculatePrice");

/**
 * Sync a single calendar and create appointments
 * @param {Object} sync - CalendarSync record
 * @returns {Object} - Result of sync operation
 */
const syncSingleCalendar = async (sync, sendEmail = false) => {
  const result = {
    syncId: sync.id,
    homeId: sync.homeId,
    platform: sync.platform,
    success: false,
    checkoutsFound: 0,
    appointmentsCreated: 0,
    createdAppointments: [], // Track details of created appointments
    error: null,
  };

  try {
    // Fetch checkout dates from iCal
    const checkoutDates = await getCheckoutDates(sync.icalUrl);
    result.checkoutsFound = checkoutDates.length;

    // Get home details
    const home = await UserHomes.findByPk(sync.homeId);
    if (!home) {
      throw new Error("Home not found");
    }

    const syncedUids = sync.syncedEventUids || [];
    const deletedDates = sync.deletedDates || [];
    const newSyncedUids = [...syncedUids];
    let appointmentsCreated = 0;

    // Process checkout dates and create appointments
    if (sync.autoCreateAppointments) {
      for (const checkout of checkoutDates) {
        // Skip if already synced
        if (syncedUids.includes(checkout.uid)) {
          continue;
        }

        // Calculate the cleaning date based on daysAfterCheckout setting
        const checkoutDate = new Date(checkout.checkoutDate);
        const cleaningDate = new Date(checkoutDate);
        cleaningDate.setDate(cleaningDate.getDate() + sync.daysAfterCheckout);

        const cleaningDateStr = cleaningDate.toISOString().split("T")[0];

        // Skip if this date was previously deleted by user
        if (deletedDates.includes(cleaningDateStr)) {
          newSyncedUids.push(checkout.uid);
          continue;
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
          newSyncedUids.push(checkout.uid);
          continue;
        }

        // Calculate price based on home details
        const price = await calculatePrice(
          home.sheetsProvided,
          home.towelsProvided,
          home.numBeds,
          home.numBaths,
          home.timeToBeCompleted
        );

        // Get user's bill and update
        const existingBill = await UserBills.findOne({
          where: { userId: sync.userId },
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
          userId: sync.userId,
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

        // Track the created appointment for email notification
        result.createdAppointments.push({
          id: newAppointment.id,
          date: cleaningDateStr,
          price,
          source: checkout.summary || `${sync.platform} booking`,
        });

        appointmentsCreated++;
        newSyncedUids.push(checkout.uid);
      }
    }

    // Update sync record
    await sync.update({
      lastSyncAt: new Date(),
      lastSyncStatus: "success",
      lastSyncError: null,
      syncedEventUids: newSyncedUids,
    });

    result.success = true;
    result.appointmentsCreated = appointmentsCreated;

    // Send email notification if appointments were created and sendEmail is true
    if (sendEmail && appointmentsCreated > 0) {
      try {
        const user = await User.findByPk(sync.userId);
        if (user && user.email) {
          await Email.sendAutoSyncAppointmentsCreated(
            user.email,
            user.firstName || user.username,
            home,
            result.createdAppointments,
            sync.platform
          );
        }
      } catch (emailError) {
        console.error(`[CalendarSync] Failed to send email notification:`, emailError.message);
        // Don't fail the sync if email fails
      }
    }
  } catch (error) {
    result.error = error.message;

    // Update sync record with error
    await sync.update({
      lastSyncAt: new Date(),
      lastSyncStatus: "error",
      lastSyncError: error.message,
    });
  }

  return result;
};

/**
 * Sync all active calendars with autoSync enabled
 * Called automatically every 6 hours
 * @returns {Object} - Summary of sync operations
 */
const syncAllCalendars = async () => {
  const summary = {
    startedAt: new Date(),
    totalSyncs: 0,
    successful: 0,
    failed: 0,
    totalAppointmentsCreated: 0,
    results: [],
  };

  try {
    // Find all active calendar syncs with autoSync enabled
    const activeSyncs = await CalendarSync.findAll({
      where: {
        isActive: true,
        autoSync: true,
      },
    });

    summary.totalSyncs = activeSyncs.length;
    console.log(`[CalendarSync] Found ${activeSyncs.length} calendars with auto-sync enabled`);

    // Process each sync (with email notifications enabled)
    for (const sync of activeSyncs) {
      const result = await syncSingleCalendar(sync, true);
      summary.results.push(result);

      if (result.success) {
        summary.successful++;
        summary.totalAppointmentsCreated += result.appointmentsCreated;
      } else {
        summary.failed++;
      }

      // Small delay between syncs to avoid rate limiting
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  } catch (error) {
    console.error("Error in syncAllCalendars:", error);
    summary.error = error.message;
  }

  summary.completedAt = new Date();
  summary.duration = summary.completedAt - summary.startedAt;

  return summary;
};

/**
 * Daily health check for all connected calendars
 * Checks if calendars are still accessible
 */
const runDailyHealthCheck = async () => {
  console.log("[CalendarSync] Running daily health check...");

  try {
    const syncs = await CalendarSync.findAll({
      where: { isActive: true },
    });

    console.log(`[CalendarSync] Checking ${syncs.length} connected calendars`);

    let healthy = 0;
    let unhealthy = 0;

    for (const sync of syncs) {
      try {
        await getCheckoutDates(sync.icalUrl);
        healthy++;
      } catch (error) {
        unhealthy++;
        console.warn(`[CalendarSync] Calendar ${sync.id} (${sync.platform}) is unhealthy: ${error.message}`);

        // Update sync record with error if not already in error state
        if (sync.lastSyncStatus !== "error") {
          await sync.update({
            lastSyncStatus: "error",
            lastSyncError: `Health check failed: ${error.message}`,
          });
        }
      }

      // Small delay between checks
      await new Promise((resolve) => setTimeout(resolve, 500));
    }

    console.log(`[CalendarSync] Health check complete: ${healthy} healthy, ${unhealthy} unhealthy`);

    return { total: syncs.length, healthy, unhealthy };
  } catch (error) {
    console.error("[CalendarSync] Error during health check:", error);
    throw error;
  }
};

/**
 * Start periodic sync using cron
 * - Auto-sync runs every 6 hours for calendars with autoSync enabled
 * - Daily health check runs at midnight
 */
let cronJobsStarted = false;

const startPeriodicSync = () => {
  if (cronJobsStarted) {
    console.log("[CalendarSync] Scheduler already running");
    return;
  }

  cronJobsStarted = true;

  // Run auto-sync every hour (at minute 0 of every hour)
  // Cron: "0 * * * *" = At minute 0 of every hour
  cron.schedule("0 * * * *", async () => {
    console.log("[CalendarSync] Running scheduled auto-sync (hourly)...");
    try {
      const result = await syncAllCalendars();
      console.log(`[CalendarSync] Auto-sync complete: ${result.successful}/${result.totalSyncs} successful, ${result.totalAppointmentsCreated} appointments created`);
    } catch (error) {
      console.error("[CalendarSync] Scheduled auto-sync failed:", error);
    }
  });

  // Run daily health check at midnight
  // Cron: "0 0 * * *" = At 00:00 every day
  cron.schedule("0 0 * * *", async () => {
    console.log("[CalendarSync] Running scheduled daily health check...");
    try {
      await runDailyHealthCheck();
    } catch (error) {
      console.error("[CalendarSync] Scheduled health check failed:", error);
    }
  });

  console.log("[CalendarSync] Scheduler initialized:");
  console.log("  - Auto-sync: Every hour (calendars with auto-sync enabled)");
  console.log("  - Health check: Daily at midnight");

  // Run initial sync after a short delay (only for calendars with autoSync enabled)
  setTimeout(async () => {
    console.log("[CalendarSync] Running initial auto-sync...");
    try {
      const result = await syncAllCalendars();
      console.log(`[CalendarSync] Initial sync complete: ${result.successful}/${result.totalSyncs} successful, ${result.totalAppointmentsCreated} appointments created`);
    } catch (error) {
      console.error("[CalendarSync] Initial sync failed:", error);
    }
  }, 10000);
};

const stopPeriodicSync = () => {
  // Note: node-cron doesn't have a built-in way to stop all scheduled tasks
  // For a full implementation, we'd need to track task references
  cronJobsStarted = false;
  console.log("[CalendarSync] Scheduler stopped (new jobs won't be scheduled)");
};

module.exports = {
  syncSingleCalendar,
  syncAllCalendars,
  runDailyHealthCheck,
  startPeriodicSync,
  stopPeriodicSync,
};
