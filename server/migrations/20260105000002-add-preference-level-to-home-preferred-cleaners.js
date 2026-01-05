"use strict";

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Add preferenceLevel field (preferred = auto-book, favorite = notification only)
    await queryInterface.addColumn("HomePreferredCleaners", "preferenceLevel", {
      type: Sequelize.ENUM("preferred", "favorite"),
      allowNull: false,
      defaultValue: "preferred",
      comment: "Tier level: preferred (auto-book) or favorite (notification only)",
    });

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
