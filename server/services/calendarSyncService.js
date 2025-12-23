/**
 * Calendar Sync Service
 * Handles automatic syncing of iCal feeds and creating appointments
 */

const {
  CalendarSync,
  UserAppointments,
  UserHomes,
  UserBills,
} = require("../models");
const { getCheckoutDates } = require("./icalParser");
const calculatePrice = require("./CalculatePrice");

/**
 * Sync a single calendar and create appointments
 * @param {Object} sync - CalendarSync record
 * @returns {Object} - Result of sync operation
 */
const syncSingleCalendar = async (sync) => {
  const result = {
    syncId: sync.id,
    homeId: sync.homeId,
    platform: sync.platform,
    success: false,
    checkoutsFound: 0,
    appointmentsCreated: 0,
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
          const oldAppt = existingBill.dataValues.appointmentDue;
          const total =
            existingBill.dataValues.cancellationFee +
            existingBill.dataValues.appointmentDue;

          await existingBill.update({
            appointmentDue: oldAppt + price,
            totalDue: total + price,
          });
        }

        // Create the appointment
        await UserAppointments.create({
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
 * Sync all active calendars
 * This function should be called periodically (e.g., every hour)
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
    // Find all active calendar syncs
    const activeSyncs = await CalendarSync.findAll({
      where: { isActive: true },
    });

    summary.totalSyncs = activeSyncs.length;

    // Process each sync
    for (const sync of activeSyncs) {
      const result = await syncSingleCalendar(sync);
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
 * Start periodic sync (runs every hour by default)
 * @param {number} intervalMs - Interval in milliseconds (default: 1 hour)
 */
let syncInterval = null;

const startPeriodicSync = (intervalMs = 60 * 60 * 1000) => {
  if (syncInterval) {
    console.log("Periodic sync already running");
    return;
  }

  console.log(`Starting periodic calendar sync every ${intervalMs / 1000 / 60} minutes`);

  // Run initial sync after a short delay
  setTimeout(async () => {
    console.log("Running initial calendar sync...");
    const result = await syncAllCalendars();
    console.log(`Initial sync complete: ${result.successful}/${result.totalSyncs} successful, ${result.totalAppointmentsCreated} appointments created`);
  }, 10000);

  // Set up periodic sync
  syncInterval = setInterval(async () => {
    console.log("Running scheduled calendar sync...");
    const result = await syncAllCalendars();
    console.log(`Scheduled sync complete: ${result.successful}/${result.totalSyncs} successful, ${result.totalAppointmentsCreated} appointments created`);
  }, intervalMs);
};

const stopPeriodicSync = () => {
  if (syncInterval) {
    clearInterval(syncInterval);
    syncInterval = null;
    console.log("Periodic sync stopped");
  }
};

module.exports = {
  syncSingleCalendar,
  syncAllCalendars,
  startPeriodicSync,
  stopPeriodicSync,
};
