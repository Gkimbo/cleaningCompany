#!/usr/bin/env node
/**
 * Backfill script to populate timezone for existing homes
 *
 * This script:
 * 1. Finds all homes without a timezone set
 * 2. Uses lat/lng coordinates to determine timezone (via geo-tz)
 * 3. Falls back to state-based timezone lookup if no coordinates
 * 4. Updates each home with the determined timezone
 *
 * Run with: node scripts/backfillHomeTimezones.js
 */

require("dotenv").config();
const { UserHomes } = require("../models");
const TimezoneService = require("../services/TimezoneService");
const EncryptionService = require("../services/EncryptionService");

async function backfillTimezones() {
	console.log("=".repeat(60));
	console.log("Timezone Backfill Script");
	console.log("=".repeat(60));
	console.log("");

	try {
		// Find all homes without timezone
		const homes = await UserHomes.findAll({
			where: { timezone: null },
		});

		console.log(`Found ${homes.length} homes without timezone\n`);

		if (homes.length === 0) {
			console.log("No homes need backfilling. Exiting.");
			return;
		}

		let updated = 0;
		let failed = 0;
		let fromCoords = 0;
		let fromState = 0;

		for (const home of homes) {
			try {
				// Get timezone from coordinates or state fallback
				// Note: latitude/longitude are already decrypted by the model's afterFind hook
				const timezone = TimezoneService.getTimezoneForHome({
					latitude: home.latitude,
					longitude: home.longitude,
					state: home.state,
				});

				// Track whether we used coords or state
				if (home.latitude && home.longitude) {
					const coordsTimezone = TimezoneService.getTimezoneFromCoords(
						home.latitude,
						home.longitude
					);
					if (coordsTimezone) {
						fromCoords++;
					} else {
						fromState++;
					}
				} else {
					fromState++;
				}

				// Update directly to avoid triggering encryption hooks on already-encrypted fields
				await UserHomes.update(
					{ timezone },
					{ where: { id: home.id }, individualHooks: false }
				);
				updated++;

				if (updated % 100 === 0) {
					console.log(`Progress: ${updated}/${homes.length} homes updated`);
				}
			} catch (error) {
				console.error(`Failed to update home ${home.id}:`, error.message);
				failed++;
			}
		}

		console.log("");
		console.log("=".repeat(60));
		console.log("Backfill Complete");
		console.log("=".repeat(60));
		console.log(`  Total homes processed: ${homes.length}`);
		console.log(`  Successfully updated:  ${updated}`);
		console.log(`  Failed:                ${failed}`);
		console.log(`  From coordinates:      ${fromCoords}`);
		console.log(`  From state fallback:   ${fromState}`);
		console.log("");

		// Verify the update
		const remainingNull = await UserHomes.count({
			where: { timezone: null },
		});
		console.log(`Remaining homes without timezone: ${remainingNull}`);

		if (remainingNull > 0) {
			console.log("\nWarning: Some homes still don't have timezone set.");
			console.log("This may be due to missing coordinates AND state data.");
		}
	} catch (error) {
		console.error("Backfill failed:", error);
		process.exit(1);
	}
}

// Run the backfill
backfillTimezones()
	.then(() => {
		console.log("\nBackfill script completed successfully.");
		process.exit(0);
	})
	.catch((err) => {
		console.error("Backfill script failed:", err);
		process.exit(1);
	});
