#!/usr/bin/env node
/**
 * Comprehensive Dispute System Test
 * Tests all dispute types, flows, edge cases, and potential bugs
 */

require('dotenv').config();
const {
  User,
  UserAppointments,
  UserHomes,
  CancellationAppeal,
  HomeSizeAdjustmentRequest,
  PaymentDispute,
  SupportTicket,
  sequelize
} = require('../models');

let passed = 0;
let failed = 0;
let warnings = 0;

function logPass(msg) {
  console.log(`  ✅ ${msg}`);
  passed++;
}

function logFail(msg) {
  console.log(`  ❌ ${msg}`);
  failed++;
}

function logWarn(msg) {
  console.log(`  ⚠️  ${msg}`);
  warnings++;
}

function logSection(title) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`📋 ${title}`);
  console.log('='.repeat(60));
}

async function testDisputeSystem() {
  console.log('\n🧪 COMPREHENSIVE DISPUTE SYSTEM TEST\n');

  // ==========================================
  // 1. MODEL EXISTENCE & SCHEMA VALIDATION
  // ==========================================
  logSection('1. Model Existence & Schema Validation');

  // Test CancellationAppeal model
  if (CancellationAppeal) {
    logPass('CancellationAppeal model exists');

    const appealAttrs = Object.keys(CancellationAppeal.rawAttributes);
    const requiredAppealFields = ['id', 'appointmentId', 'appealerType', 'description', 'status', 'category'];
    const missingAppealFields = requiredAppealFields.filter(f => !appealAttrs.includes(f));

    if (missingAppealFields.length === 0) {
      logPass('CancellationAppeal has all required fields');
    } else {
      logFail(`CancellationAppeal missing fields: ${missingAppealFields.join(', ')}`);
    }
  } else {
    logFail('CancellationAppeal model not found');
  }

  // Test HomeSizeAdjustmentRequest model
  if (HomeSizeAdjustmentRequest) {
    logPass('HomeSizeAdjustmentRequest model exists');

    const adjustAttrs = Object.keys(HomeSizeAdjustmentRequest.rawAttributes);
    const requiredAdjustFields = ['id', 'appointmentId', 'cleanerId', 'status', 'reportedNumBeds', 'reportedNumBaths'];
    const missingAdjustFields = requiredAdjustFields.filter(f => !adjustAttrs.includes(f));

    if (missingAdjustFields.length === 0) {
      logPass('HomeSizeAdjustmentRequest has all required fields');
    } else {
      logFail(`HomeSizeAdjustmentRequest missing fields: ${missingAdjustFields.join(', ')}`);
    }
  } else {
    logFail('HomeSizeAdjustmentRequest model not found');
  }

  // Test PaymentDispute model
  if (PaymentDispute) {
    logPass('PaymentDispute model exists');
  } else {
    logWarn('PaymentDispute model not found (may not be implemented)');
  }

  // Test SupportTicket model
  if (SupportTicket) {
    logPass('SupportTicket model exists');

    const ticketAttrs = Object.keys(SupportTicket.rawAttributes);
    const requiredTicketFields = ['id', 'caseNumber', 'status', 'category', 'priority'];
    const missingTicketFields = requiredTicketFields.filter(f => !ticketAttrs.includes(f));

    if (missingTicketFields.length === 0) {
      logPass('SupportTicket has all required fields');
    } else {
      logFail(`SupportTicket missing fields: ${missingTicketFields.join(', ')}`);
    }
  } else {
    logFail('SupportTicket model not found');
  }

  // ==========================================
  // 2. USER ROLE VERIFICATION
  // ==========================================
  logSection('2. User Role Verification');

  const owner = await User.findOne({ where: { type: 'owner' } });
  const hr = await User.findOne({ where: { type: 'humanResources' } });
  const cleaner = await User.findOne({ where: { type: 'cleaner' } });
  const homeowner = await User.findOne({ where: { type: null } });

  if (owner) {
    logPass(`Owner found: ID ${owner.id}`);
  } else {
    logFail('No owner user found - dispute resolution requires owner');
  }

  if (hr) {
    logPass(`HR user found: ID ${hr.id}`);
  } else {
    logWarn('No HR user found - some dispute features may not work');
  }

  if (cleaner) {
    logPass(`Cleaner found: ID ${cleaner.id}`);
  } else {
    logWarn('No cleaner found - cannot test cleaner disputes');
  }

  if (homeowner) {
    logPass(`Homeowner found: ID ${homeowner.id}`);
  } else {
    logWarn('No homeowner found - cannot test homeowner disputes');
  }

  // ==========================================
  // 3. CANCELLATION APPEAL TESTS
  // ==========================================
  logSection('3. Cancellation Appeal System');

  // Check for existing appeals
  const appealCount = await CancellationAppeal.count();
  console.log(`  Total appeals in database: ${appealCount}`);

  // Check appeal status distribution
  const appealStatuses = await CancellationAppeal.findAll({
    attributes: ['status', [sequelize.fn('COUNT', sequelize.col('status')), 'count']],
    group: ['status'],
    raw: true
  });

  if (appealStatuses.length > 0) {
    logPass('Appeal status distribution:');
    appealStatuses.forEach(s => {
      console.log(`      - ${s.status}: ${s.count}`);
    });
  } else {
    logWarn('No appeals in database to analyze');
  }

  // Validate appeal status values
  const validAppealStatuses = ['submitted', 'under_review', 'awaiting_documents', 'escalated', 'approved', 'partially_approved', 'denied'];
  const invalidStatuses = appealStatuses.filter(s => !validAppealStatuses.includes(s.status));

  if (invalidStatuses.length === 0) {
    logPass('All appeal statuses are valid');
  } else {
    logFail(`Invalid appeal statuses found: ${invalidStatuses.map(s => s.status).join(', ')}`);
  }

  // Check for orphaned appeals (no appointment)
  const orphanedAppeals = await CancellationAppeal.findAll({
    include: [{
      model: UserAppointments,
      as: 'appointment',
      required: false
    }]
  });

  const appealsWithoutAppointment = orphanedAppeals.filter(a => !a.appointment);
  if (appealsWithoutAppointment.length === 0) {
    logPass('No orphaned appeals (all have valid appointments)');
  } else {
    logFail(`${appealsWithoutAppointment.length} orphaned appeals found (missing appointments)`);
  }

  // Check appealer type validity
  const appealerTypes = await CancellationAppeal.findAll({
    attributes: ['appealerType'],
    group: ['appealerType'],
    raw: true
  });

  const validAppealerTypes = ['homeowner', 'cleaner'];
  const invalidAppealerTypes = appealerTypes.filter(a => !validAppealerTypes.includes(a.appealerType));

  if (invalidAppealerTypes.length === 0) {
    logPass('All appealer types are valid (homeowner or cleaner)');
  } else {
    logFail(`Invalid appealer types: ${invalidAppealerTypes.map(a => a.appealerType).join(', ')}`);
  }

  // ==========================================
  // 4. HOME SIZE ADJUSTMENT TESTS
  // ==========================================
  logSection('4. Home Size Adjustment System');

  const adjustmentCount = await HomeSizeAdjustmentRequest.count();
  console.log(`  Total adjustment requests: ${adjustmentCount}`);

  // Check adjustment status distribution
  const adjustmentStatuses = await HomeSizeAdjustmentRequest.findAll({
    attributes: ['status', [sequelize.fn('COUNT', sequelize.col('status')), 'count']],
    group: ['status'],
    raw: true
  });

  if (adjustmentStatuses.length > 0) {
    logPass('Adjustment status distribution:');
    adjustmentStatuses.forEach(s => {
      console.log(`      - ${s.status}: ${s.count}`);
    });
  } else {
    logWarn('No adjustment requests to analyze');
  }

  // Validate adjustment status flow
  const validAdjustmentStatuses = ['pending_homeowner', 'approved', 'denied', 'pending_owner', 'owner_approved', 'owner_denied', 'expired'];
  const invalidAdjustStatuses = adjustmentStatuses.filter(s => !validAdjustmentStatuses.includes(s.status));

  if (invalidAdjustStatuses.length === 0) {
    logPass('All adjustment statuses are valid');
  } else {
    logFail(`Invalid adjustment statuses: ${invalidAdjustStatuses.map(s => s.status).join(', ')}`);
  }

  // Check for adjustments with photos (photos are in separate HomeSizeAdjustmentPhoto table)
  try {
    const { HomeSizeAdjustmentPhoto } = require('../models');
    if (HomeSizeAdjustmentPhoto) {
      const photoCount = await HomeSizeAdjustmentPhoto.count();
      console.log(`  Evidence photos in database: ${photoCount}`);
      logPass('HomeSizeAdjustmentPhoto model exists');
    } else {
      logWarn('HomeSizeAdjustmentPhoto model not found');
    }
  } catch (err) {
    logWarn(`Could not check photos: ${err.message}`);
  }

  // ==========================================
  // 5. SUPPORT TICKET TESTS
  // ==========================================
  logSection('5. Support Ticket System');

  const ticketCount = await SupportTicket.count();
  console.log(`  Total support tickets: ${ticketCount}`);

  // Check ticket categories
  const ticketCategories = await SupportTicket.findAll({
    attributes: ['category', [sequelize.fn('COUNT', sequelize.col('category')), 'count']],
    group: ['category'],
    raw: true
  });

  if (ticketCategories.length > 0) {
    logPass('Ticket category distribution:');
    ticketCategories.forEach(c => {
      console.log(`      - ${c.category}: ${c.count}`);
    });
  } else {
    logWarn('No support tickets to analyze');
  }

  // Validate ticket categories
  const validCategories = ['account_issue', 'behavior_concern', 'service_complaint', 'billing_question', 'technical_issue', 'policy_violation', 'other'];
  const invalidCategories = ticketCategories.filter(c => !validCategories.includes(c.category));

  if (invalidCategories.length === 0) {
    logPass('All ticket categories are valid');
  } else {
    logFail(`Invalid categories: ${invalidCategories.map(c => c.category).join(', ')}`);
  }

  // Check ticket priorities
  const ticketPriorities = await SupportTicket.findAll({
    attributes: ['priority', [sequelize.fn('COUNT', sequelize.col('priority')), 'count']],
    group: ['priority'],
    raw: true
  });

  const validPriorities = ['low', 'normal', 'high', 'urgent'];
  const invalidPriorities = ticketPriorities.filter(p => !validPriorities.includes(p.priority));

  if (invalidPriorities.length === 0) {
    logPass('All ticket priorities are valid');
  } else {
    logFail(`Invalid priorities: ${invalidPriorities.map(p => p.priority).join(', ')}`);
  }

  // ==========================================
  // 6. SERVICE LAYER TESTS
  // ==========================================
  logSection('6. Service Layer Validation');

  // Test ConflictResolutionService exists
  try {
    const ConflictResolutionService = require('../services/ConflictResolutionService');
    logPass('ConflictResolutionService loaded');

    // Check required methods exist
    const requiredMethods = [
      'getConflictCase',
      'processRefund',
      'processCleanerPayout',
      'resolveAppeal',
      'resolveAdjustment'
    ];

    requiredMethods.forEach(method => {
      if (typeof ConflictResolutionService[method] === 'function') {
        logPass(`Method ${method}() exists`);
      } else {
        logFail(`Method ${method}() missing`);
      }
    });
  } catch (err) {
    logFail(`ConflictResolutionService error: ${err.message}`);
  }

  // Test AppealService exists
  try {
    const AppealService = require('../services/AppealService');
    logPass('AppealService loaded');
  } catch (err) {
    logWarn(`AppealService not found: ${err.message}`);
  }

  // Test SupportTicketService exists
  try {
    const SupportTicketService = require('../services/SupportTicketService');
    logPass('SupportTicketService loaded');
  } catch (err) {
    logWarn(`SupportTicketService not found: ${err.message}`);
  }

  // ==========================================
  // 7. DATA INTEGRITY CHECKS
  // ==========================================
  logSection('7. Data Integrity Checks');

  // Check for appeals with invalid appointment references
  if (appealCount > 0) {
    const appealsWithAppt = await CancellationAppeal.findAll({
      include: [{
        model: UserAppointments,
        as: 'appointment',
        required: false
      }],
      limit: 100
    });

    const invalidRefs = appealsWithAppt.filter(a => a.appointmentId && !a.appointment);
    if (invalidRefs.length === 0) {
      logPass('All appeal appointment references are valid');
    } else {
      logFail(`${invalidRefs.length} appeals have invalid appointment references`);
    }
  }

  // Check for adjustments with invalid cleaner references
  if (adjustmentCount > 0) {
    const adjustmentsWithCleaner = await HomeSizeAdjustmentRequest.findAll({
      include: [{
        model: User,
        as: 'cleaner',
        required: false
      }],
      limit: 100
    });

    const invalidCleanerRefs = adjustmentsWithCleaner.filter(a => a.cleanerId && !a.cleaner);
    if (invalidCleanerRefs.length === 0) {
      logPass('All adjustment cleaner references are valid');
    } else {
      logFail(`${invalidCleanerRefs.length} adjustments have invalid cleaner references`);
    }
  }

  // Check for refund amount consistency
  try {
    const appointmentAttrs = Object.keys(UserAppointments.rawAttributes);
    if (appointmentAttrs.includes('refundAmount')) {
      const appointmentsWithRefunds = await UserAppointments.findAll({
        where: {
          refundAmount: { [require('sequelize').Op.gt]: 0 }
        },
        limit: 50
      });

      let refundIssues = 0;
      for (const apt of appointmentsWithRefunds) {
        const originalAmount = (apt.price || 0) * 100; // Convert to cents
        const refundedAmount = apt.refundAmount || 0;

        if (refundedAmount > originalAmount) {
          refundIssues++;
          console.log(`    ⚠️ Appointment ${apt.id}: refunded ${refundedAmount} > original ${originalAmount}`);
        }
      }

      if (refundIssues === 0) {
        logPass('All refund amounts are within original prices');
      } else {
        logFail(`${refundIssues} appointments have over-refunded amounts`);
      }
    } else {
      logWarn('refundAmount column not found on UserAppointments - migration may be needed');
    }
  } catch (err) {
    logWarn(`Could not check refund amounts: ${err.message}`);
  }

  // ==========================================
  // 8. EDGE CASE CHECKS
  // ==========================================
  logSection('8. Edge Case Checks');

  // Check for stuck disputes (old and still pending)
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const stuckAppeals = await CancellationAppeal.count({
    where: {
      status: { [require('sequelize').Op.in]: ['submitted', 'under_review'] },
      createdAt: { [require('sequelize').Op.lt]: thirtyDaysAgo }
    }
  });

  if (stuckAppeals === 0) {
    logPass('No stuck appeals (pending > 30 days)');
  } else {
    logWarn(`${stuckAppeals} appeals stuck for more than 30 days`);
  }

  const stuckAdjustments = await HomeSizeAdjustmentRequest.count({
    where: {
      status: { [require('sequelize').Op.in]: ['pending_homeowner', 'pending_owner'] },
      createdAt: { [require('sequelize').Op.lt]: thirtyDaysAgo }
    }
  });

  if (stuckAdjustments === 0) {
    logPass('No stuck adjustments (pending > 30 days)');
  } else {
    logWarn(`${stuckAdjustments} adjustments stuck for more than 30 days`);
  }

  // Check for duplicate appeals on same appointment
  const duplicateAppeals = await sequelize.query(`
    SELECT "appointmentId", COUNT(*) as count
    FROM "CancellationAppeals"
    WHERE "appointmentId" IS NOT NULL
    GROUP BY "appointmentId"
    HAVING COUNT(*) > 1
  `, { type: sequelize.QueryTypes.SELECT });

  if (duplicateAppeals.length === 0) {
    logPass('No duplicate appeals for same appointment');
  } else {
    logWarn(`${duplicateAppeals.length} appointments have multiple appeals`);
  }

  // ==========================================
  // 9. AUTHORIZATION TESTS
  // ==========================================
  logSection('9. Authorization Configuration');

  // Check verifyHROrOwner middleware exists
  try {
    const verifyHROrOwner = require('../middleware/verifyHROrOwner');
    logPass('verifyHROrOwner middleware exists');
  } catch (err) {
    logFail('verifyHROrOwner middleware not found');
  }

  // Check conflictRouter exists and has routes
  try {
    const conflictRouter = require('../routes/api/v1/conflictRouter');
    logPass('conflictRouter loaded');

    // Check it's an Express router
    if (conflictRouter.stack && Array.isArray(conflictRouter.stack)) {
      const routeCount = conflictRouter.stack.filter(layer => layer.route).length;
      logPass(`conflictRouter has ${routeCount} routes defined`);
    }
  } catch (err) {
    logFail(`conflictRouter error: ${err.message}`);
  }

  // Check cancellationAppealRouter exists
  try {
    const appealRouter = require('../routes/api/v1/cancellationAppealRouter');
    logPass('cancellationAppealRouter loaded');
  } catch (err) {
    logFail(`cancellationAppealRouter error: ${err.message}`);
  }

  // ==========================================
  // 10. NOTIFICATION INTEGRATION
  // ==========================================
  logSection('10. Notification Integration');

  // Check NotificationService exists
  try {
    const NotificationService = require('../services/NotificationService');
    logPass('NotificationService loaded');

    if (typeof NotificationService.createNotification === 'function') {
      logPass('createNotification method exists');
    } else {
      logWarn('createNotification method not found');
    }
  } catch (err) {
    logWarn(`NotificationService: ${err.message}`);
  }

  // Check EmailClass exists
  try {
    const EmailClass = require('../services/sendNotifications/EmailClass');
    logPass('EmailClass loaded');

    // Check for dispute-related email methods
    const emailMethods = ['sendAppealSubmittedConfirmation', 'sendAppealStatusUpdate'];
    emailMethods.forEach(method => {
      if (typeof EmailClass[method] === 'function') {
        logPass(`Email method ${method}() exists`);
      } else {
        logWarn(`Email method ${method}() not found`);
      }
    });
  } catch (err) {
    logWarn(`EmailClass: ${err.message}`);
  }

  // ==========================================
  // SUMMARY
  // ==========================================
  console.log('\n' + '='.repeat(60));
  console.log('📊 DISPUTE SYSTEM TEST SUMMARY');
  console.log('='.repeat(60));
  console.log(`  ✅ Passed:   ${passed}`);
  console.log(`  ❌ Failed:   ${failed}`);
  console.log(`  ⚠️  Warnings: ${warnings}`);
  console.log('='.repeat(60));

  if (failed === 0) {
    console.log('\n🎉 All critical tests passed!\n');
  } else {
    console.log('\n⚠️  Some tests failed - review output above.\n');
  }

  process.exit(failed > 0 ? 1 : 0);
}

testDisputeSystem().catch(err => {
  console.error('\n❌ Test script error:', err);
  process.exit(1);
});
