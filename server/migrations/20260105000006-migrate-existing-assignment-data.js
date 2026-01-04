"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    // Migrate existing EmployeeJobAssignment checklist/photo data to AppointmentJobFlows
    // This preserves data for assignments that were created before the custom job flow feature

    const [assignments] = await queryInterface.sequelize.query(`
      SELECT
        eja.id,
        eja."appointmentId",
        eja."isMarketplacePickup",
        eja."checklistProgress",
        eja."checklistCompleted",
        eja."beforePhotoCount",
        eja."afterPhotoCount",
        eja."photosCompleted"
      FROM "EmployeeJobAssignments" eja
      WHERE eja."checklistProgress" IS NOT NULL
         OR eja."beforePhotoCount" > 0
         OR eja."afterPhotoCount" > 0
    `);

    if (assignments.length > 0) {
      console.log(`Migrating ${assignments.length} existing assignments to AppointmentJobFlows`);

      for (const assignment of assignments) {
        // Check if an AppointmentJobFlow already exists for this appointment
        const [existing] = await queryInterface.sequelize.query(`
          SELECT id FROM "AppointmentJobFlows"
          WHERE "appointmentId" = ${assignment.appointmentId}
          LIMIT 1
        `);

        if (existing.length === 0) {
          // Create AppointmentJobFlow for this assignment
          const photoRequirement = assignment.isMarketplacePickup ? 'platform_required' : 'optional';
          const checklistProgress = assignment.checklistProgress
            ? `'${JSON.stringify(assignment.checklistProgress).replace(/'/g, "''")}'::jsonb`
            : 'NULL';

          await queryInterface.sequelize.query(`
            INSERT INTO "AppointmentJobFlows" (
              "appointmentId",
              "customJobFlowId",
              "usesPlatformFlow",
              "checklistSnapshotData",
              "checklistProgress",
              "checklistCompleted",
              "photoRequirement",
              "beforePhotoCount",
              "afterPhotoCount",
              "photosCompleted",
              "createdAt",
              "updatedAt"
            ) VALUES (
              ${assignment.appointmentId},
              NULL,
              ${assignment.isMarketplacePickup},
              NULL,
              ${checklistProgress},
              ${assignment.checklistCompleted || false},
              '${photoRequirement}',
              ${assignment.beforePhotoCount || 0},
              ${assignment.afterPhotoCount || 0},
              ${assignment.photosCompleted || false},
              NOW(),
              NOW()
            )
          `);

          // Get the newly created AppointmentJobFlow ID
          const [[newFlow]] = await queryInterface.sequelize.query(`
            SELECT id FROM "AppointmentJobFlows"
            WHERE "appointmentId" = ${assignment.appointmentId}
            LIMIT 1
          `);

          // Update the EmployeeJobAssignment to reference the new AppointmentJobFlow
          if (newFlow) {
            await queryInterface.sequelize.query(`
              UPDATE "EmployeeJobAssignments"
              SET "appointmentJobFlowId" = ${newFlow.id}
              WHERE id = ${assignment.id}
            `);
          }
        }
      }

      console.log("Migration complete");
    } else {
      console.log("No existing assignments to migrate");
    }
  },

  async down(queryInterface) {
    // Remove the appointmentJobFlowId references and delete migrated AppointmentJobFlows
    await queryInterface.sequelize.query(`
      UPDATE "EmployeeJobAssignments"
      SET "appointmentJobFlowId" = NULL
    `);

    // Delete AppointmentJobFlows that don't have a customJobFlowId (migrated data)
    await queryInterface.sequelize.query(`
      DELETE FROM "AppointmentJobFlows"
      WHERE "customJobFlowId" IS NULL
    `);
  },
};
