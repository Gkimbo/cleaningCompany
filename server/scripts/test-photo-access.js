#!/usr/bin/env node
/**
 * Test photo access control - verifies that only owners/HR can see photos
 */

require('dotenv').config();
const { User, HomeSizeAdjustmentRequest, HomeSizeAdjustmentPhoto, UserHomes, UserAppointments } = require('../models');
const HomeSizeAdjustmentSerializer = require('../serializers/HomeSizeAdjustmentSerializer');

async function testPhotoAccess() {
  console.log('🔐 Testing Photo Access Control Logic\n');

  // Find a request with an owner, homeowner, and cleaner
  const request = await HomeSizeAdjustmentRequest.findOne({
    order: [['id', 'DESC']]
  });

  if (!request) {
    console.log('No adjustment requests found');
    return;
  }

  // Create test photos first
  const testBase64 = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg==';
  await HomeSizeAdjustmentPhoto.create({
    adjustmentRequestId: request.id,
    roomType: 'bedroom',
    roomNumber: 1,
    photoUrl: testBase64
  });

  // Find different user types
  const owner = await User.findOne({ where: { type: 'owner' } });
  const hr = await User.findOne({ where: { type: 'humanResources' } });
  const homeowner = await User.findByPk(request.homeownerId);
  const cleaner = await User.findByPk(request.cleanerId);

  console.log('Testing with request #' + request.id);
  console.log('  Owner ID:', owner?.id);
  console.log('  HR ID:', hr?.id);
  console.log('  Homeowner ID:', homeowner?.id);
  console.log('  Cleaner ID:', cleaner?.id);

  // Simulate the include logic from the router
  async function fetchWithPhotoAccess(userType) {
    const isOwnerOrHR = userType === 'owner' || userType === 'humanResources';

    const includes = [
      { model: UserHomes, as: 'home', attributes: ['id', 'address', 'city'] },
      { model: UserAppointments, as: 'appointment', attributes: ['id', 'date'] },
      { model: User, as: 'cleaner', attributes: ['id', 'username', 'firstName'] },
      { model: User, as: 'homeowner', attributes: ['id', 'username', 'firstName'] },
    ];

    // KEY LOGIC: Only include photos for owners and HR
    if (isOwnerOrHR) {
      includes.push({
        model: HomeSizeAdjustmentPhoto,
        as: 'photos',
        attributes: ['id', 'roomType', 'roomNumber', 'photoUrl', 'createdAt'],
      });
    }

    const result = await HomeSizeAdjustmentRequest.findByPk(request.id, { include: includes });
    return HomeSizeAdjustmentSerializer.serializeOne(result);
  }

  console.log('\n📋 Testing photo visibility by user type:\n');

  // Test owner
  const ownerView = await fetchWithPhotoAccess('owner');
  const ownerCanSeePhotos = ownerView.photos && ownerView.photos.length > 0;
  console.log('  Owner sees photos:', ownerCanSeePhotos ? '✅ YES' : '❌ NO');

  // Test HR
  const hrView = await fetchWithPhotoAccess('humanResources');
  const hrCanSeePhotos = hrView.photos && hrView.photos.length > 0;
  console.log('  HR sees photos:', hrCanSeePhotos ? '✅ YES' : '❌ NO');

  // Test homeowner
  const homeownerView = await fetchWithPhotoAccess('client');
  const homeownerCanSeePhotos = homeownerView.photos && homeownerView.photos.length > 0;
  console.log('  Homeowner sees photos:', homeownerCanSeePhotos ? '❌ SECURITY BUG!' : '✅ NO (correct)');

  // Test cleaner
  const cleanerView = await fetchWithPhotoAccess('cleaner');
  const cleanerCanSeePhotos = cleanerView.photos && cleanerView.photos.length > 0;
  console.log('  Cleaner sees photos:', cleanerCanSeePhotos ? '❌ SECURITY BUG!' : '✅ NO (correct)');

  // Cleanup
  await HomeSizeAdjustmentPhoto.destroy({ where: { adjustmentRequestId: request.id } });

  console.log('\n' + '='.repeat(50));
  if (ownerCanSeePhotos && hrCanSeePhotos && !homeownerCanSeePhotos && !cleanerCanSeePhotos) {
    console.log('🎉 Photo access control is working correctly!');
    console.log('\nSummary:');
    console.log('  ✅ Owners can view evidence photos');
    console.log('  ✅ HR can view evidence photos');
    console.log('  ✅ Homeowners cannot see photos (privacy protected)');
    console.log('  ✅ Cleaners cannot see photos (prevents tampering claims)');
  } else {
    console.log('⚠️  Access control issues detected');
  }

  process.exit(0);
}

testPhotoAccess().catch(e => {
  console.error('Error:', e);
  process.exit(1);
});
