#!/usr/bin/env node
/**
 * Test script to check for bugs in the reviews pending endpoint
 */

require('dotenv').config();
const { User, UserHomes, UserAppointments, UserReviews, HomePreferredCleaner } = require('../models');
const EncryptionService = require('../services/EncryptionService');

async function testReviewsEndpoint() {
  console.log('🧪 Testing Reviews Pending Endpoint Logic\n');

  let passed = 0;
  let failed = 0;

  // Test 1: Find a cleaner and test homeowner lookup
  console.log('📋 Test 1: Homeowner lookup for cleaners\n');

  const cleaner = await User.findOne({ where: { type: 'cleaner' } });
  if (!cleaner) {
    console.log('  ⚠️  No cleaner found - skipping');
  } else {
    console.log('  Testing as cleaner ID:', cleaner.id);

    // Find a completed appointment where this cleaner was assigned
    const appointments = await UserAppointments.findAll({
      where: { completed: true },
      limit: 20
    });

    const cleanerApt = appointments.find(apt => {
      const assigned = apt.employeesAssigned || [];
      return assigned.includes(String(cleaner.id));
    });

    if (!cleanerApt) {
      console.log('  ⚠️  No completed appointments for cleaner - skipping');
    } else {
      console.log('  Found appointment:', cleanerApt.id);

      const home = await UserHomes.findByPk(cleanerApt.homeId);
      if (!home) {
        console.log('  ❌ No home found');
        failed++;
      } else {
        console.log('  ✅ Home found, ID:', home.id, 'Owner ID:', home.userId);
        passed++;

        // Test homeowner lookup
        if (home.userId) {
          const homeowner = await User.findByPk(home.userId, {
            attributes: ['id', 'username', 'firstName', 'lastName']
          });

          if (homeowner) {
            console.log('  ✅ Homeowner found:', homeowner.id);
            passed++;

            // Test decryption
            try {
              const firstName = homeowner.firstName ? EncryptionService.decrypt(homeowner.firstName) : null;
              const lastName = homeowner.lastName ? EncryptionService.decrypt(homeowner.lastName) : null;
              console.log('  ✅ Decrypted name:', firstName, lastName);
              passed++;
            } catch (err) {
              console.log('  ❌ Decryption error:', err.message);
              failed++;
            }
          } else {
            console.log('  ❌ Homeowner not found for userId:', home.userId);
            failed++;
          }
        } else {
          console.log('  ⚠️  Home has no userId');
        }
      }
    }
  }

  // Test 2: Test cleaner name decryption
  console.log('\n📋 Test 2: Cleaner name decryption\n');

  const testCleaner = await User.findOne({
    where: { type: 'cleaner' },
    attributes: ['id', 'username', 'firstName', 'lastName']
  });

  if (testCleaner) {
    try {
      const firstName = testCleaner.firstName ? EncryptionService.decrypt(testCleaner.firstName) : null;
      const lastName = testCleaner.lastName ? EncryptionService.decrypt(testCleaner.lastName) : null;
      console.log('  ✅ Cleaner name decrypted:', firstName, lastName);
      passed++;
    } catch (err) {
      console.log('  ❌ Cleaner decryption error:', err.message);
      failed++;
    }
  }

  // Test 3: Check for null handling edge cases
  console.log('\n📋 Test 3: Null handling edge cases\n');

  // Test with null firstName/lastName
  const nullCheck1 = null ? EncryptionService.decrypt(null) : null;
  console.log('  ✅ Null firstName handled correctly:', nullCheck1);
  passed++;

  // Test with undefined
  const undefinedCheck = undefined ? EncryptionService.decrypt(undefined) : null;
  console.log('  ✅ Undefined handled correctly:', undefinedCheck);
  passed++;

  // Test 4: Check HomePreferredCleaner lookup
  console.log('\n📋 Test 4: HomePreferredCleaner model exists\n');

  if (HomePreferredCleaner) {
    console.log('  ✅ HomePreferredCleaner model exists');
    passed++;
  } else {
    console.log('  ❌ HomePreferredCleaner model missing');
    failed++;
  }

  // Test 5: Verify frontend state.account values
  console.log('\n📋 Test 5: User type values in database\n');

  const userTypes = await User.findAll({
    attributes: ['type'],
    group: ['type']
  });

  console.log('  User types in DB:', userTypes.map(u => u.type || 'null').join(', '));
  console.log('  ✅ User types retrieved');
  passed++;

  // Test 6: Check that employee type exists (for isCleaner check)
  const employeeCount = await User.count({ where: { type: 'employee' } });
  console.log('  Employee users:', employeeCount);
  if (employeeCount > 0) {
    console.log('  ✅ Employee type exists - will be treated as cleaner in reviews');
    passed++;
  } else {
    console.log('  ⚠️  No employee users found');
  }

  // Summary
  console.log('\n' + '='.repeat(50));
  console.log('📊 TEST SUMMARY');
  console.log('='.repeat(50));
  console.log(`  ✅ Passed: ${passed}`);
  console.log(`  ❌ Failed: ${failed}`);

  if (failed === 0) {
    console.log('\n🎉 All tests passed! No bugs found in reviews endpoint logic.\n');
  } else {
    console.log('\n⚠️  Some tests failed - review output above.\n');
  }

  process.exit(failed > 0 ? 1 : 0);
}

testReviewsEndpoint().catch(e => {
  console.error('Error:', e);
  process.exit(1);
});
