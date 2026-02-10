"use strict";

/**
 * Migration: Seed Initial Checklist Version
 *
 * Creates an initial ChecklistVersion from existing ChecklistSections/Items
 * if none exists. This is needed for the custom job flow feature to work.
 */

module.exports = {
  async up(queryInterface, Sequelize) {
    // Check if a ChecklistVersion already exists
    const existingVersions = await queryInterface.sequelize.query(
      'SELECT COUNT(*) as count FROM "ChecklistVersions"',
      { type: Sequelize.QueryTypes.SELECT }
    );

    if (existingVersions[0].count > 0) {
      console.log("ChecklistVersion already exists, skipping seed...");
      return;
    }

    // Get existing sections with their items
    const sections = await queryInterface.sequelize.query(
      `SELECT id, title, icon, "displayOrder" FROM "ChecklistSections" ORDER BY "displayOrder"`,
      { type: Sequelize.QueryTypes.SELECT }
    );

    if (sections.length === 0) {
      console.log("No ChecklistSections found, creating default checklist version...");

      // Create a minimal default checklist
      const defaultChecklist = {
        sections: [
          {
            title: "General Cleaning",
            icon: "🧹",
            displayOrder: 1,
            items: [
              { content: "Dust all surfaces", displayOrder: 1, indentLevel: 0 },
              { content: "Vacuum floors", displayOrder: 2, indentLevel: 0 },
              { content: "Mop hard floors", displayOrder: 3, indentLevel: 0 },
              { content: "Empty trash", displayOrder: 4, indentLevel: 0 },
            ],
          },
          {
            title: "Kitchen",
            icon: "🍳",
            displayOrder: 2,
            items: [
              { content: "Clean countertops", displayOrder: 1, indentLevel: 0 },
              { content: "Clean sink", displayOrder: 2, indentLevel: 0 },
              { content: "Wipe appliances", displayOrder: 3, indentLevel: 0 },
            ],
          },
          {
            title: "Bathroom",
            icon: "🚿",
            displayOrder: 3,
            items: [
              { content: "Clean toilet", displayOrder: 1, indentLevel: 0 },
              { content: "Clean sink and mirror", displayOrder: 2, indentLevel: 0 },
              { content: "Clean shower/tub", displayOrder: 3, indentLevel: 0 },
            ],
          },
        ],
      };

      await queryInterface.sequelize.query(
        `INSERT INTO "ChecklistVersions" (version, "snapshotData", "publishedAt", "isActive", "createdAt", "updatedAt")
         VALUES (1, :snapshotData, :publishedAt, true, :createdAt, :updatedAt)`,
        {
          replacements: {
            snapshotData: JSON.stringify(defaultChecklist),
            publishedAt: new Date(),
            createdAt: new Date(),
            updatedAt: new Date(),
          },
          type: Sequelize.QueryTypes.INSERT,
        }
      );

      console.log("Created default ChecklistVersion (version 1)");
      return;
    }

    // Build snapshot from existing sections and items
    const snapshotData = { sections: [] };

    for (const section of sections) {
      const items = await queryInterface.sequelize.query(
        `SELECT content, "displayOrder", "indentLevel", formatting
         FROM "ChecklistItems"
         WHERE "sectionId" = :sectionId
         ORDER BY "displayOrder"`,
        {
          replacements: { sectionId: section.id },
          type: Sequelize.QueryTypes.SELECT,
        }
      );

      snapshotData.sections.push({
        title: section.title,
        icon: section.icon,
        displayOrder: section.displayOrder,
        items: items.map((item) => ({
          content: item.content,
          displayOrder: item.displayOrder,
          indentLevel: item.indentLevel || 0,
          formatting: item.formatting || { bold: false, italic: false, bulletStyle: "disc" },
        })),
      });
    }

    // Create version 1
    await queryInterface.sequelize.query(
      `INSERT INTO "ChecklistVersions" (version, "snapshotData", "publishedAt", "isActive", "createdAt", "updatedAt")
       VALUES (1, :snapshotData, :publishedAt, true, :createdAt, :updatedAt)`,
      {
        replacements: {
          snapshotData: JSON.stringify(snapshotData),
          publishedAt: new Date(),
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        type: Sequelize.QueryTypes.INSERT,
      }
    );

    console.log("Created ChecklistVersion from existing sections/items (version 1)");
  },

  async down(queryInterface, Sequelize) {
    // Only remove the seeded version 1 if it exists and has no publishedBy
    await queryInterface.sequelize.query(
      `DELETE FROM "ChecklistVersions" WHERE version = 1 AND "publishedBy" IS NULL`,
      { type: Sequelize.QueryTypes.DELETE }
    );
    console.log("Removed seeded ChecklistVersion");
  },
};
