/**
 * Backfill script to geocode existing homes that don't have coordinates
 *
 * Run with: node scripts/backfillHomeCoordinates.js
 *
 * Note: This script respects Nominatim's rate limit (1 request per second)
 * and includes retry logic with 3-second waits between retries.
 */

const { UserHomes } = require("../models");
const HomeClass = require("../services/HomeClass");
const { Op } = require("sequelize");

async function backfillCoordinates() {
  console.log("Starting coordinate backfill...\n");

  try {
    // Find all homes without coordinates
    const homes = await UserHomes.findAll({
      where: {
        [Op.or]: [{ latitude: null }, { longitude: null }],
      },
    });

    console.log(`Found ${homes.length} homes to geocode\n`);

    if (homes.length === 0) {
      console.log("No homes need geocoding. Exiting.");
      process.exit(0);
    }

    let successCount = 0;
    let failCount = 0;

    for (let i = 0; i < homes.length; i++) {
      const home = homes[i];

      try {
        // Rate limit: Nominatim requires 1 request per second
        // Wait before each request (except the first)
        if (i > 0) {
          await new Promise((resolve) => setTimeout(resolve, 1100));
        }

        console.log(
          `[${i + 1}/${homes.length}] Geocoding home ${home.id}: ${home.address}, ${home.city}, ${home.state} ${home.zipcode}`
        );

        const { latitude, longitude } = await HomeClass.geocodeAddress(
          home.address,
          home.city,
          home.state,
          home.zipcode
        );

        await home.update({ latitude, longitude });
        console.log(`  -> Updated: ${latitude}, ${longitude}`);
        successCount++;
      } catch (error) {
        console.error(`  -> Failed: ${error.message}`);
        failCount++;
      }
    }

    console.log("\n=== Backfill Complete ===");
    console.log(`Successfully updated: ${successCount}`);
    console.log(`Failed: ${failCount}`);
    console.log(`Total processed: ${homes.length}`);
  } catch (error) {
    console.error("Fatal error during backfill:", error);
    process.exit(1);
  }

  process.exit(0);
}

// Run the backfill
backfillCoordinates();
