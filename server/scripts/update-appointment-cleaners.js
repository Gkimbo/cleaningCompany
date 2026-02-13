/**
 * Script to update existing appointments' empoyeesNeeded values
 * based on home size and time window constraints
 */

const { Op } = require('sequelize');
const { sequelize, UserAppointments, UserHomes } = require('../models');
const { getCleanersNeeded } = require('../config/businessConfig');

async function updateAppointmentCleaners() {
  try {
    console.log('Fetching appointments with home data...');

    // Get future appointments that aren't completed or cancelled
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const appointments = await UserAppointments.findAll({
      include: [{
        model: UserHomes,
        as: 'home',
        attributes: ['id', 'numBeds', 'numBaths', 'timeToBeCompleted']
      }],
      where: {
        completed: false,
        wasCancelled: { [Op.or]: [false, null] },
        date: { [Op.gte]: today }
      }
    });

    console.log(`Found ${appointments.length} appointments to check`);

    let updatedCount = 0;

    for (const apt of appointments) {
      if (!apt.home) {
        console.log(`Appointment ${apt.id} has no home, skipping`);
        continue;
      }

      const timeWindow = apt.timeWindow || apt.home.timeToBeCompleted || 'anytime';
      const needed = getCleanersNeeded(apt.home.numBeds, apt.home.numBaths, timeWindow);

      if (apt.empoyeesNeeded !== needed) {
        console.log(`Updating appointment ${apt.id}: ${apt.empoyeesNeeded} -> ${needed} (${apt.home.numBeds}bed/${apt.home.numBaths}bath, ${timeWindow})`);
        await apt.update({ empoyeesNeeded: needed });
        updatedCount++;
      }
    }

    console.log(`\nDone! Updated ${updatedCount} appointments`);
    process.exit(0);
  } catch (error) {
    console.error('Error updating appointments:', error);
    process.exit(1);
  }
}

updateAppointmentCleaners();
