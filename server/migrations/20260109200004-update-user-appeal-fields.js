"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    // Create ENUM type for scrutiny level
    await queryInterface.sequelize.query(`
      CREATE TYPE "enum_Users_appealScrutinyLevel" AS ENUM (
        'none', 'watch', 'high_risk'
      );
    `).catch(() => {}); // Ignore if already exists

    // Add appeal history tracking fields to Users table
    await queryInterface.addColumn("Users", "appealStats", {
      type: Sequelize.JSONB,
      defaultValue: {
        total: 0,
        approved: 0,
        denied: 0,
        pending: 0,
      },
      comment: "Appeal statistics for this user",
    });

    await queryInterface.addColumn("Users", "lastAppealDate", {
      type: Sequelize.DATE,
      allowNull: true,
    });

    // Scrutiny flags
    await queryInterface.addColumn("Users", "appealScrutinyLevel", {
      type: Sequelize.ENUM("none", "watch", "high_risk"),
      defaultValue: "none",
    });

    await queryInterface.addColumn("Users", "appealScrutinyReason", {
      type: Sequelize.TEXT,
      allowNull: true,
    });

    await queryInterface.addColumn("Users", "appealScrutinySetAt", {
      type: Sequelize.DATE,
      allowNull: true,
    });

    // Pattern detection
    await queryInterface.addColumn("Users", "appealPatterns", {
      type: Sequelize.JSONB,
      defaultValue: {
        categoryCounts: {},
        approvalRate: null,
        avgDaysBetweenAppeals: null,
      },
      comment: "Pattern analysis for appeal behavior",
    });

    // Add index on scrutiny level for quick filtering
    await queryInterface.addIndex("Users", ["appealScrutinyLevel"], {
      name: "idx_users_appeal_scrutiny",
      where: {
        appealScrutinyLevel: {
          [Sequelize.Op.ne]: "none",
        },
      },
    }).catch(() => {}); // Partial index might not work on all DBs
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn("Users", "appealStats");
    await queryInterface.removeColumn("Users", "lastAppealDate");
    await queryInterface.removeColumn("Users", "appealScrutinyLevel");
    await queryInterface.removeColumn("Users", "appealScrutinyReason");
    await queryInterface.removeColumn("Users", "appealScrutinySetAt");
    await queryInterface.removeColumn("Users", "appealPatterns");

    await queryInterface.removeIndex("Users", "idx_users_appeal_scrutiny").catch(() => {});

    await queryInterface.sequelize.query(`
      DROP TYPE IF EXISTS "enum_Users_appealScrutinyLevel";
    `);
  },
};
