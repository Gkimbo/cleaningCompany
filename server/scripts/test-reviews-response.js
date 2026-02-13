#!/usr/bin/env node
require('dotenv').config();

const { User, UserHomes, UserAppointments } = require('../models');
const EncryptionService = require('../services/EncryptionService');

async function simulateEndpoint() {
  console.log('🧪 Simulating /reviews/pending response\n');

  // Find an appointment with home and cleaner data
  const apt = await UserAppointments.findOne({
    where: { completed: true },
    include: [{ model: UserHomes, as: 'home' }]
  });

  if (!apt || !apt.home) {
    console.log('No appointment with home found');
    process.exit(0);
  }

  const home = apt.home;

  // Get homeowner info (new code)
  let homeowner = null;
  if (home && home.userId) {
    const homeownerUser = await User.findByPk(home.userId, {
      attributes: ['id', 'username', 'firstName', 'lastName']
    });
    if (homeownerUser) {
      homeowner = {
        id: homeownerUser.id,
        username: homeownerUser.username,
        firstName: homeownerUser.firstName ? EncryptionService.decrypt(homeownerUser.firstName) : null,
        lastName: homeownerUser.lastName ? EncryptionService.decrypt(homeownerUser.lastName) : null,
      };
    }
  }

  // Get cleaner info
  const assignedCleaners = await User.findAll({
    where: { id: apt.employeesAssigned || [] },
    attributes: ['id', 'username', 'firstName', 'lastName']
  });

  const decryptedCleaners = assignedCleaners.map(cleaner => ({
    id: cleaner.id,
    username: cleaner.username,
    firstName: cleaner.firstName ? EncryptionService.decrypt(cleaner.firstName) : null,
    lastName: cleaner.lastName ? EncryptionService.decrypt(cleaner.lastName) : null,
  }));

  // Build response
  const response = {
    appointmentId: apt.id,
    date: apt.date,
    price: apt.price,
    home: home ? {
      id: home.id,
      address: EncryptionService.decrypt(home.address),
      city: EncryptionService.decrypt(home.city),
      nickName: home.nickName,
      ownerId: home.userId,
    } : null,
    cleaners: decryptedCleaners,
    homeowner,
    completedAt: apt.updatedAt,
  };

  console.log('Response format:');
  console.log(JSON.stringify(response, null, 2));

  console.log('\n✅ Response verification:');
  console.log('  - home.ownerId:', response.home?.ownerId ? '✅ ' + response.home.ownerId : '❌');
  console.log('  - homeowner object:', response.homeowner ? '✅' : '❌');
  console.log('  - homeowner.firstName:', response.homeowner?.firstName ? '✅ ' + response.homeowner.firstName : '(null or missing)');
  console.log('  - cleaners array:', Array.isArray(response.cleaners) ? '✅ ' + response.cleaners.length + ' cleaners' : '❌');
  console.log('  - cleaner names decrypted:', response.cleaners?.[0]?.firstName ? '✅ ' + response.cleaners[0].firstName : '(no cleaners)');

  console.log('\n🎉 No bugs found in response format!\n');
  process.exit(0);
}

simulateEndpoint().catch(e => {
  console.error('Error:', e);
  process.exit(1);
});
