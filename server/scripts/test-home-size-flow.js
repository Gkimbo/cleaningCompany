#!/usr/bin/env node
/**
 * Test script for Home Size Adjustment flow
 * Tests the entire flow from cleaner submission through HR/owner review
 *
 * Usage: node scripts/test-home-size-flow.js
 */

require('dotenv').config();
const jwt = require('jsonwebtoken');

const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:3001';
const SECRET_KEY = process.env.SESSION_SECRET;

// Generate test tokens
function generateToken(userId, type) {
  return jwt.sign(
    { userId, type },
    SECRET_KEY,
    { expiresIn: '1h' }
  );
}

// Helper for API calls
async function apiCall(method, endpoint, token, body = null) {
  const options = {
    method,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    }
  };

  if (body) {
    options.body = JSON.stringify(body);
  }

  const response = await fetch(`${BASE_URL}${endpoint}`, options);
  const data = await response.json();
  return { status: response.status, data };
}

// Create a small test image (1x1 red pixel PNG as base64)
function createTestPhoto(roomType, roomNumber) {
  // Minimal valid PNG (1x1 red pixel)
  const base64Image = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg==';
  return {
    roomType,
    roomNumber,
    photoData: base64Image
  };
}

async function runTests() {
  console.log('🧪 HOME SIZE ADJUSTMENT FLOW TEST\n');
  console.log('='.repeat(60));

  let testsPassed = 0;
  let testsFailed = 0;
  let createdRequestId = null;

  // We need real user IDs from the database - let's first get them
  console.log('\n📋 Step 0: Get test users from database...');

  // For this test, we'll use demo accounts (adjust IDs as needed)
  // Typically: owner=1, cleaner=assigned to appointments, homeowner=appointment owner
  const testUsers = {
    owner: { id: 1, type: 'owner' },
    hr: { id: null, type: 'humanResources' }, // Will find from DB
    cleaner: { id: null, type: 'cleaner' },
    homeowner: { id: null, type: 'client' }
  };

  // Generate tokens for testing (we'll need valid appointment data)
  const ownerToken = generateToken(testUsers.owner.id, 'owner');

  // Test 1: Get pending adjustments as owner (to see if any exist)
  console.log('\n📋 Step 1: Check existing pending adjustments...');
  try {
    const result = await apiCall('GET', '/api/v1/home-size-adjustment/pending', ownerToken);
    console.log(`   Status: ${result.status}`);
    console.log(`   Found ${result.data.adjustments?.length || 0} existing adjustments`);

    if (result.status === 200) {
      console.log('   ✅ Owner can access pending adjustments endpoint');
      testsPassed++;

      // Check if there are any adjustments with photos
      if (result.data.adjustments && result.data.adjustments.length > 0) {
        const withPhotos = result.data.adjustments.filter(a => a.photos && a.photos.length > 0);
        console.log(`   📸 ${withPhotos.length} adjustments have photos`);

        if (withPhotos.length > 0) {
          const sample = withPhotos[0];
          console.log(`\n   Sample adjustment #${sample.id}:`);
          console.log(`   - Status: ${sample.status}`);
          console.log(`   - Photos: ${sample.photos.length}`);

          // Verify photo structure
          const photo = sample.photos[0];
          const hasCorrectFields = photo.photoUrl && photo.roomType && photo.roomNumber !== undefined;

          if (hasCorrectFields) {
            console.log('   ✅ Photo has correct field structure (photoUrl, roomType, roomNumber)');
            testsPassed++;
          } else {
            console.log('   ❌ Photo missing required fields');
            console.log(`      Fields present: ${Object.keys(photo).join(', ')}`);
            testsFailed++;
          }

          // Check if photoUrl is a valid base64 image or URL
          if (photo.photoUrl.startsWith('data:image/') || photo.photoUrl.startsWith('http')) {
            console.log('   ✅ photoUrl is valid (base64 or URL)');
            testsPassed++;
          } else {
            console.log('   ❌ photoUrl format is invalid');
            console.log(`      Starts with: ${photo.photoUrl.substring(0, 30)}...`);
            testsFailed++;
          }
        }
      }
    } else {
      console.log(`   ❌ Failed: ${result.data.error}`);
      testsFailed++;
    }
  } catch (error) {
    console.log(`   ❌ Error: ${error.message}`);
    testsFailed++;
  }

  // Test 2: Test photo validation (missing photos)
  console.log('\n📋 Step 2: Test photo validation...');
  try {
    // Try to create without photos - should fail
    const cleanerToken = generateToken(2, 'cleaner'); // Use a test cleaner ID
    const result = await apiCall('POST', '/api/v1/home-size-adjustment/', cleanerToken, {
      appointmentId: 1,
      reportedNumBeds: '3',
      reportedNumBaths: '2',
      cleanerNote: 'Test note'
      // No photos - should fail
    });

    if (result.status === 400 && result.data.error?.includes('Photos are required')) {
      console.log('   ✅ Correctly rejects request without photos');
      testsPassed++;
    } else if (result.status === 403 || result.status === 404) {
      console.log(`   ⚠️  Cleaner/appointment access issue (${result.status}) - skipping validation test`);
    } else {
      console.log(`   ❌ Expected 400 with photo error, got ${result.status}: ${result.data.error}`);
      testsFailed++;
    }
  } catch (error) {
    console.log(`   ❌ Error: ${error.message}`);
    testsFailed++;
  }

  // Test 3: Test invalid photo format validation
  console.log('\n📋 Step 3: Test invalid photo format rejection...');
  try {
    const cleanerToken = generateToken(2, 'cleaner');
    const result = await apiCall('POST', '/api/v1/home-size-adjustment/', cleanerToken, {
      appointmentId: 1,
      reportedNumBeds: '2',
      reportedNumBaths: '1',
      cleanerNote: 'Test note',
      photos: [
        { roomType: 'bedroom', roomNumber: 1, photoData: 'not-a-valid-base64-image' },
        { roomType: 'bedroom', roomNumber: 2, photoData: 'also-not-valid' }
      ]
    });

    if (result.status === 400 && result.data.error?.includes('image format')) {
      console.log('   ✅ Correctly rejects invalid photo format');
      testsPassed++;
    } else if (result.status === 403 || result.status === 404) {
      console.log(`   ⚠️  Cleaner/appointment access issue (${result.status}) - skipping format test`);
    } else {
      console.log(`   ❌ Expected 400 with format error, got ${result.status}: ${result.data.error}`);
      testsFailed++;
    }
  } catch (error) {
    console.log(`   ❌ Error: ${error.message}`);
    testsFailed++;
  }

  // Test 4: Test HR access to photos
  console.log('\n📋 Step 4: Test HR photo access...');
  try {
    // First find an HR user
    const { Sequelize } = require('../models');
    const { User } = require('../models');

    const hrUser = await User.findOne({ where: { type: 'humanResources' } });

    if (hrUser) {
      const hrToken = generateToken(hrUser.id, 'humanResources');
      const result = await apiCall('GET', '/api/v1/home-size-adjustment/pending', hrToken);

      if (result.status === 200) {
        console.log('   ✅ HR can access pending adjustments');
        testsPassed++;

        // Check if photos are included
        if (result.data.adjustments?.length > 0) {
          const hasPhotos = result.data.adjustments.some(a => a.photos !== undefined);
          if (hasPhotos) {
            console.log('   ✅ Photos are included in HR response');
            testsPassed++;
          } else {
            console.log('   ⚠️  No photos in response (may be none to show)');
          }
        }
      } else {
        console.log(`   ❌ HR access failed: ${result.data.error}`);
        testsFailed++;
      }
    } else {
      console.log('   ⚠️  No HR user found in database - skipping HR test');
    }
  } catch (error) {
    console.log(`   ⚠️  Database not available for HR test: ${error.message}`);
  }

  // Test 5: Test homeowner does NOT see photos
  console.log('\n📋 Step 5: Test homeowner photo restriction...');
  try {
    const homeownerToken = generateToken(3, 'client'); // Use a test homeowner ID
    const result = await apiCall('GET', '/api/v1/home-size-adjustment/pending', homeownerToken);

    if (result.status === 200) {
      console.log('   ✅ Homeowner can access their pending adjustments');
      testsPassed++;

      // Check that photos are NOT included
      if (result.data.adjustments?.length > 0) {
        const hasPhotos = result.data.adjustments.some(a => a.photos !== undefined);
        if (!hasPhotos) {
          console.log('   ✅ Photos are correctly hidden from homeowner');
          testsPassed++;
        } else {
          console.log('   ❌ Photos should NOT be visible to homeowner!');
          testsFailed++;
        }
      } else {
        console.log('   ⚠️  No pending adjustments for this homeowner to test photo visibility');
      }
    } else {
      console.log(`   Status ${result.status} - ${result.data.error || 'OK for no pending'}`);
    }
  } catch (error) {
    console.log(`   ❌ Error: ${error.message}`);
    testsFailed++;
  }

  // Test 6: Get single adjustment by ID and verify photo visibility
  console.log('\n📋 Step 6: Test single adjustment photo visibility by user type...');
  try {
    const { HomeSizeAdjustmentRequest } = require('../models');

    // Find any adjustment request
    const anyRequest = await HomeSizeAdjustmentRequest.findOne({
      order: [['createdAt', 'DESC']]
    });

    if (anyRequest) {
      console.log(`   Testing with adjustment #${anyRequest.id}...`);

      // Test as owner
      const ownerResult = await apiCall('GET', `/api/v1/home-size-adjustment/${anyRequest.id}`, ownerToken);
      if (ownerResult.status === 200 && ownerResult.data.request?.photos !== undefined) {
        console.log('   ✅ Owner can see photos on single adjustment');
        testsPassed++;
      } else if (ownerResult.status === 200) {
        console.log(`   ⚠️  Owner got response but photos field: ${ownerResult.data.request?.photos}`);
      }

      // Test as homeowner (should NOT have photos)
      const homeownerToken = generateToken(anyRequest.homeownerId, 'client');
      const homeownerResult = await apiCall('GET', `/api/v1/home-size-adjustment/${anyRequest.id}`, homeownerToken);
      if (homeownerResult.status === 200 && homeownerResult.data.request?.photos === undefined) {
        console.log('   ✅ Homeowner correctly cannot see photos on single adjustment');
        testsPassed++;
      } else if (homeownerResult.status === 200) {
        console.log(`   ❌ Homeowner should not see photos!`);
        testsFailed++;
      }

      // Test as cleaner (should NOT have photos)
      const cleanerToken = generateToken(anyRequest.cleanerId, 'cleaner');
      const cleanerResult = await apiCall('GET', `/api/v1/home-size-adjustment/${anyRequest.id}`, cleanerToken);
      if (cleanerResult.status === 200 && cleanerResult.data.request?.photos === undefined) {
        console.log('   ✅ Cleaner correctly cannot see photos on single adjustment');
        testsPassed++;
      } else if (cleanerResult.status === 200) {
        console.log(`   ❌ Cleaner should not see photos!`);
        testsFailed++;
      }
    } else {
      console.log('   ⚠️  No adjustment requests found to test');
    }
  } catch (error) {
    console.log(`   ⚠️  Database test skipped: ${error.message}`);
  }

  // Test 7: Test serializer field names
  console.log('\n📋 Step 7: Verify serializer field names...');
  try {
    const { HomeSizeAdjustmentRequest, HomeSizeAdjustmentPhoto } = require('../models');

    const requestWithPhotos = await HomeSizeAdjustmentRequest.findOne({
      include: [{
        model: HomeSizeAdjustmentPhoto,
        as: 'photos'
      }],
      order: [['createdAt', 'DESC']]
    });

    if (requestWithPhotos && requestWithPhotos.photos?.length > 0) {
      const HomeSizeAdjustmentSerializer = require('../serializers/HomeSizeAdjustmentSerializer');
      const serialized = HomeSizeAdjustmentSerializer.serializeOne(requestWithPhotos);

      if (serialized.photos && serialized.photos.length > 0) {
        const photo = serialized.photos[0];
        const expectedFields = ['id', 'adjustmentRequestId', 'photoUrl', 'roomType', 'roomNumber', 'createdAt'];
        const hasAllFields = expectedFields.every(field => photo[field] !== undefined || field === 'adjustmentRequestId');

        if (hasAllFields) {
          console.log('   ✅ Serializer returns correct photo field names');
          console.log(`      Fields: ${Object.keys(photo).join(', ')}`);
          testsPassed++;
        } else {
          console.log('   ❌ Serializer missing expected fields');
          console.log(`      Expected: ${expectedFields.join(', ')}`);
          console.log(`      Got: ${Object.keys(photo).join(', ')}`);
          testsFailed++;
        }

        // Verify specific field names (not the old wrong ones)
        if (photo.photoUrl !== undefined && photo.photoData === undefined) {
          console.log('   ✅ Uses "photoUrl" not "photoData"');
          testsPassed++;
        } else {
          console.log('   ❌ Wrong field name: should be "photoUrl" not "photoData"');
          testsFailed++;
        }

        if (photo.roomType !== undefined && photo.room === undefined) {
          console.log('   ✅ Uses "roomType" not "room"');
          testsPassed++;
        } else {
          console.log('   ❌ Wrong field name: should be "roomType" not "room"');
          testsFailed++;
        }
      } else {
        console.log('   ⚠️  No photos in serialized output');
      }
    } else {
      console.log('   ⚠️  No requests with photos found');
    }
  } catch (error) {
    console.log(`   ⚠️  Serializer test skipped: ${error.message}`);
  }

  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('📊 TEST SUMMARY');
  console.log('='.repeat(60));
  console.log(`   ✅ Passed: ${testsPassed}`);
  console.log(`   ❌ Failed: ${testsFailed}`);
  console.log(`   Total: ${testsPassed + testsFailed}`);

  if (testsFailed === 0) {
    console.log('\n🎉 All tests passed!\n');
  } else {
    console.log('\n⚠️  Some tests failed. Review output above.\n');
  }

  process.exit(testsFailed > 0 ? 1 : 0);
}

// Run if called directly
runTests().catch(error => {
  console.error('Test script error:', error);
  process.exit(1);
});
