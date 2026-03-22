/**
 * Service Area Config Seeder
 *
 * Migrates the static service area configuration from businessConfig.js
 * to the ServiceAreaConfigs table in the database.
 *
 * Run with: node server/seeders/serviceAreaConfigSeeder.js
 */

const { ServiceAreaConfig } = require("../models");
const { businessConfig } = require("../config/businessConfig");

async function seedServiceAreaConfig() {
  try {
    console.log("[ServiceAreaSeeder] Starting...");

    // Check if there's already an active config
    const existingConfig = await ServiceAreaConfig.getActive();

    if (existingConfig) {
      console.log("[ServiceAreaSeeder] Active config already exists (ID:", existingConfig.id, ")");
      console.log("[ServiceAreaSeeder] Skipping seeding to preserve existing configuration.");
      return;
    }

    // Get the static config
    const staticConfig = businessConfig.serviceAreas;

    // Create the initial config from static values
    const config = await ServiceAreaConfig.create({
      enabled: staticConfig.enabled,
      mode: "list", // Static config uses list mode
      cities: staticConfig.cities || [],
      states: staticConfig.states || [],
      zipcodes: staticConfig.zipcodes || [],
      centerAddress: null,
      centerLatitude: null,
      centerLongitude: null,
      radiusMiles: 25,
      outsideAreaMessage: staticConfig.outsideAreaMessage || "We don't currently service this area. We're expanding soon!",
      isActive: true,
      updatedBy: null, // System migration
      changeNote: "Initial migration from static businessConfig.js",
    });

    console.log("[ServiceAreaSeeder] Created initial config:");
    console.log("  - ID:", config.id);
    console.log("  - Enabled:", config.enabled);
    console.log("  - Mode:", config.mode);
    console.log("  - Cities:", (config.cities || []).length, "cities");
    console.log("  - States:", (config.states || []).join(", ") || "(none)");
    console.log("  - Zipcodes:", (config.zipcodes || []).length, "zipcodes");
    console.log("[ServiceAreaSeeder] Done!");

    return config;
  } catch (error) {
    console.error("[ServiceAreaSeeder] Error:", error);
    throw error;
  }
}

// Run if executed directly
if (require.main === module) {
  seedServiceAreaConfig()
    .then(() => {
      console.log("[ServiceAreaSeeder] Seeding complete");
      process.exit(0);
    })
    .catch((err) => {
      console.error("[ServiceAreaSeeder] Failed:", err);
      process.exit(1);
    });
}

module.exports = { seedServiceAreaConfig };
