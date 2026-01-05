"use strict";

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable("CleanerPreferredPerks", {
      id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
      },
      cleanerId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        unique: true,
        references: {
          model: "Users",
          key: "id",
        },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      },
      tierLevel: {
        type: Sequelize.ENUM("bronze", "silver", "gold", "platinum"),
        allowNull: false,
        defaultValue: "bronze",
      },
      preferredHomeCount: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      // Cached perk values (recalculated when tier changes)
      bonusPercent: {
        type: Sequelize.DECIMAL(5, 2),
        allowNull: false,
        defaultValue: 0,
      },
      fasterPayouts: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      payoutHours: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 48,
      },
      earlyAccess: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      lastCalculatedAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal("CURRENT_TIMESTAMP"),
      },
      createdAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal("CURRENT_TIMESTAMP"),
      },
      updatedAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal("CURRENT_TIMESTAMP"),
      },
    });

    // Index for quick lookups by cleaner
    await queryInterface.addIndex("CleanerPreferredPerks", ["cleanerId"], {
      name: "idx_cleaner_preferred_perks_cleaner",
    });

    // Index for tier-based queries (e.g., finding all platinum cleaners)
    await queryInterface.addIndex("CleanerPreferredPerks", ["tierLevel"], {
      name: "idx_cleaner_preferred_perks_tier",
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeIndex("CleanerPreferredPerks", "idx_cleaner_preferred_perks_tier");
    await queryInterface.removeIndex("CleanerPreferredPerks", "idx_cleaner_preferred_perks_cleaner");
    await queryInterface.dropTable("CleanerPreferredPerks");
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_CleanerPreferredPerks_tierLevel";');
  },
};
