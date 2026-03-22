/**
 * Recurring Schedule Generation Job
 * Generates future appointments for all active recurring schedules.
 * Runs weekly to ensure appointments are always scheduled ahead.
 */

const { Op } = require("sequelize");
const { RecurringSchedule } = require("../../models");
const { generateAppointmentsForSchedule } = require("../../routes/api/v1/recurringSchedulesRouter");

/**
 * Process all active recurring schedules and generate appointments
 * @returns {Object} Summary of processed schedules
 */
async function processRecurringScheduleGeneration() {
  const results = {
    schedulesProcessed: 0,
    appointmentsCreated: 0,
    skipped: 0,
    errors: 0,
    details: []
  };

  try {
    console.log("[RecurringScheduleGenerationJob] Starting recurring schedule generation...");

    // Find all active, non-paused schedules
    const schedules = await RecurringSchedule.findAll({
      where: {
        isActive: true,
        isPaused: false,
      },
    });

    console.log(`[RecurringScheduleGenerationJob] Found ${schedules.length} active schedules to process`);

    for (const schedule of schedules) {
      try {
        // Check if paused until date has passed
        if (schedule.pausedUntil && new Date(schedule.pausedUntil) > new Date()) {
          console.log(`[RecurringScheduleGenerationJob] Skipping schedule ${schedule.id}: Still paused until ${schedule.pausedUntil}`);
          results.skipped++;
          continue;
        }

        // Check if schedule has an end date that has passed
        if (schedule.endDate && new Date(schedule.endDate) < new Date()) {
          console.log(`[RecurringScheduleGenerationJob] Skipping schedule ${schedule.id}: End date ${schedule.endDate} has passed`);
          results.skipped++;
          continue;
        }

        const appointments = await generateAppointmentsForSchedule(schedule);
        results.appointmentsCreated += appointments.length;
        results.schedulesProcessed++;

        if (appointments.length > 0) {
          console.log(`[RecurringScheduleGenerationJob] Schedule ${schedule.id}: Created ${appointments.length} appointments`);
          results.details.push({
            scheduleId: schedule.id,
            appointmentsCreated: appointments.length,
          });
        }
      } catch (error) {
        results.errors++;
        console.error(`[RecurringScheduleGenerationJob] Error processing schedule ${schedule.id}:`, error.message);
        results.details.push({
          scheduleId: schedule.id,
          error: error.message,
        });
      }
    }

    console.log(`[RecurringScheduleGenerationJob] Completed. Schedules: ${results.schedulesProcessed}, Appointments: ${results.appointmentsCreated}, Skipped: ${results.skipped}, Errors: ${results.errors}`);
    return results;
  } catch (error) {
    console.error("[RecurringScheduleGenerationJob] Fatal error:", error);
    throw error;
  }
}

/**
 * Start the recurring schedule generation job as a recurring interval
 * Runs weekly (every 7 days) to generate appointments ahead of time
 * @param {number} intervalMs - Interval in milliseconds (default: 7 days)
 * @returns {Object} Interval reference for cleanup
 */
function startRecurringScheduleGenerationJob(intervalMs = 7 * 24 * 60 * 60 * 1000) {
  console.log(`[RecurringScheduleGenerationJob] Starting recurring schedule generation job (interval: ${intervalMs}ms / ${intervalMs / (24 * 60 * 60 * 1000)} days)`);

  // Run immediately on start to catch up on any missed generations
  processRecurringScheduleGeneration().catch((err) => {
    console.error("[RecurringScheduleGenerationJob] Error on initial run:", err);
  });

  // Then run on the scheduled interval
  const interval = setInterval(() => {
    processRecurringScheduleGeneration().catch((err) => {
      console.error("[RecurringScheduleGenerationJob] Error on interval run:", err);
    });
  }, intervalMs);

  return interval;
}

module.exports = {
  processRecurringScheduleGeneration,
  startRecurringScheduleGenerationJob,
};
