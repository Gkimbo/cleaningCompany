"use strict";

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Create the ENUM type first (Postgres requires this to be separate)
    await queryInterface.sequelize.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'enum_HomePreferredCleaners_preferenceLevel') THEN
          CREATE TYPE "enum_HomePreferredCleaners_preferenceLevel" AS ENUM('preferred', 'favorite');
        END IF;
      END$$;
    `);

    // Add preferenceLevel field using raw SQL to avoid Sequelize ENUM bug
    await queryInterface.sequelize.query(`
      ALTER TABLE "HomePreferredCleaners"
      ADD COLUMN "preferenceLevel" "enum_HomePreferredCleaners_preferenceLevel" NOT NULL DEFAULT 'preferred';
      COMMENT ON COLUMN "HomePreferredCleaners"."preferenceLevel" IS 'Tier level: preferred (auto-book) or favorite (notification only)';
    `);

    // Add priority field for ordering multiple cleaners at same level
    await queryInterface.addColumn("HomePreferredCleaners", "priority", {
      type: Sequelize.INTEGER,
      allowNull: false,
      defaultValue: 0,
      comment: "Priority ordering when multiple cleaners exist (higher = more priority)",
    });

    // Add index for efficient queries by preference level
    await queryInterface.addIndex("HomePreferredCleaners", ["homeId", "preferenceLevel"], {
      name: "idx_home_preferred_cleaners_level",
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeIndex("HomePreferredCleaners", "idx_home_preferred_cleaners_level");
    await queryInterface.removeColumn("HomePreferredCleaners", "priority");
    await queryInterface.removeColumn("HomePreferredCleaners", "preferenceLevel");

    // Drop the ENUM type
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_HomePreferredCleaners_preferenceLevel";');
  },
};
