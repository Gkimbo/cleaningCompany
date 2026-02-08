/**
 * Script to sync MultiCleanerJob records with appointments
 * that need multiple cleaners
 */

const { Op } = require('sequelize');
const { sequelize, UserAppointments, UserHomes, MultiCleanerJob } = require('../models');

async function syncMultiCleanerJobs() {
  try {
    console.log('Finding appointments needing multiple cleaners...');

    // Get future appointments that need multiple cleaners
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const appointments = await UserAppointments.findAll({
      include: [{
        model: UserHomes,
        as: 'home',
        attributes: ['id', 'numBeds', 'numBaths']
      }],
      where: {
        completed: false,
        wasCancelled: { [Op.or]: [false, null] },
        date: { [Op.gte]: today },
        empoyeesNeeded: { [Op.gt]: 1 }
      }
    });

    console.log(`Found ${appointments.length} appointments needing multiple cleaners`);

    let createdCount = 0;
    let updatedCount = 0;

    for (const apt of appointments) {
      // Check if multi-cleaner job already exists
      let multiCleanerJob = await MultiCleanerJob.findOne({
        where: { appointmentId: apt.id }
      });

      if (!multiCleanerJob) {
        // Create new multi-cleaner job
        multiCleanerJob = await MultiCleanerJob.create({
          appointmentId: apt.id,
          totalCleanersRequired: apt.empoyeesNeeded,
          cleanersConfirmed: apt.employeesAssigned || 0,
          status: 'open'
        });
        console.log(`Created MultiCleanerJob ${multiCleanerJob.id} for appointment ${apt.id} (${apt.empoyeesNeeded} cleaners needed)`);
        createdCount++;
      } else if (multiCleanerJob.totalCleanersRequired !== apt.empoyeesNeeded) {
        // Update existing multi-cleaner job
        await multiCleanerJob.update({
          totalCleanersRequired: apt.empoyeesNeeded
        });
        console.log(`Updated MultiCleanerJob ${multiCleanerJob.id} for appointment ${apt.id}: totalCleanersRequired ${multiCleanerJob.totalCleanersRequired} -> ${apt.empoyeesNeeded}`);
        updatedCount++;
      }

      // Update appointment to link to multi-cleaner job
      if (!apt.isMultiCleanerJob || apt.multiCleanerJobId !== multiCleanerJob.id) {
        await apt.update({
          isMultiCleanerJob: true,
          multiCleanerJobId: multiCleanerJob.id
        });
        console.log(`Linked appointment ${apt.id} to MultiCleanerJob ${multiCleanerJob.id}`);
      }
    }

    console.log(`\nDone! Created ${createdCount} new MultiCleanerJobs, updated ${updatedCount}`);
    process.exit(0);
  } catch (error) {
    console.error('Error syncing multi-cleaner jobs:', error);
    process.exit(1);
  }
}

syncMultiCleanerJobs();
