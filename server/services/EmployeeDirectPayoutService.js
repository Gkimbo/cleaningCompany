/**
 * EmployeeDirectPayoutService
 *
 * Handles split payouts between business owners and their employees.
 * When enabled, employees receive their pay directly via Stripe instead
 * of the business owner receiving everything and paying employees manually.
 */

const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
const {
  User,
  BusinessEmployee,
  EmployeeJobAssignment,
  StripeConnectAccount,
  Payout,
} = require("../models");
const EmployeeStripeConnectService = require("./EmployeeStripeConnectService");
const EmployeeBatchPayoutService = require("./EmployeeBatchPayoutService");

class EmployeeDirectPayoutService {
  /**
   * Check if direct employee payouts are enabled for a business owner
   *
   * @param {number} businessOwnerId - ID of the business owner
   * @returns {boolean} - True if direct payouts are enabled
   */
  static async isDirectPayoutEnabled(businessOwnerId) {
    const businessOwner = await User.findByPk(businessOwnerId);
    return businessOwner?.employeePayoutMethod === "direct_to_employees";
  }

  /**
   * Check if an employee can receive direct payouts
   *
   * @param {object} assignment - EmployeeJobAssignment record
   * @returns {object} - { canReceive, reason, employee, stripeAccountId }
   */
  static async canEmployeeReceiveDirectPayout(assignment) {
    // Self-assignments don't get split (business owner pays themselves)
    if (assignment.isSelfAssignment) {
      return {
        canReceive: false,
        reason: "self_assignment",
      };
    }

    if (!assignment.businessEmployeeId) {
      return {
        canReceive: false,
        reason: "no_employee",
      };
    }

    const employee = await BusinessEmployee.findByPk(assignment.businessEmployeeId);
    if (!employee) {
      return {
        canReceive: false,
        reason: "employee_not_found",
      };
    }

    // Check if business owner has enabled direct payouts
    const isEnabled = await this.isDirectPayoutEnabled(assignment.businessOwnerId);
    if (!isEnabled) {
      return {
        canReceive: false,
        reason: "direct_payouts_disabled",
        employee,
      };
    }

    // Check if employee has Stripe Connect set up
    if (!employee.stripeConnectAccountId) {
      return {
        canReceive: false,
        reason: "no_stripe_account",
        employee,
      };
    }

    if (!employee.stripeConnectOnboarded) {
      // Double-check with Stripe
      const isReady = await EmployeeStripeConnectService.isReadyForPayouts(
        employee.id
      );
      if (!isReady) {
        return {
          canReceive: false,
          reason: "stripe_not_onboarded",
          employee,
        };
      }
    }

    return {
      canReceive: true,
      employee,
      stripeAccountId: employee.stripeConnectAccountId,
    };
  }

  /**
   * Process a split payout for a job assignment
   *
   * Splits the total payout between:
   * - Business Owner: receives their share IMMEDIATELY
   * - Employee: receives their payAmount in BI-WEEKLY BATCH (every other Friday)
   *
   * @param {object} appointment - The appointment record
   * @param {object} assignment - The EmployeeJobAssignment record
   * @param {number} netAmount - Total amount after platform fee (in cents)
   * @param {string} chargeId - Stripe charge ID for source_transaction
   * @param {object} payout - The Payout record (for business owner)
   * @returns {object} - Result of the payout operation
   */
  static async processSplitPayout(appointment, assignment, netAmount, chargeId, payout) {
    const result = {
      employeePayout: null,
      businessOwnerPayout: null,
      payoutMethod: "business_owner", // Default fallback
    };

    try {
      // Check if employee can receive direct payout
      const eligibility = await this.canEmployeeReceiveDirectPayout(assignment);

      if (!eligibility.canReceive) {
        // Fall back to business owner receiving everything
        console.log(
          `[EmployeeDirectPayout] Employee not eligible for direct payout: ${eligibility.reason}`
        );
        result.payoutMethod = "business_owner_fallback";
        result.fallbackReason = eligibility.reason;
        return result;
      }

      const employee = eligibility.employee;
      const employeeAmount = assignment.payAmount || 0;

      if (employeeAmount <= 0) {
        // No employee pay set, all goes to business owner
        result.payoutMethod = "business_owner";
        result.fallbackReason = "no_employee_pay_set";
        return result;
      }

      // Calculate business owner's share
      const businessOwnerAmount = netAmount - employeeAmount;

      if (businessOwnerAmount < 0) {
        // Employee pay exceeds available amount - this shouldn't happen
        console.error(
          `[EmployeeDirectPayout] Employee pay (${employeeAmount}) exceeds net amount (${netAmount})`
        );
        result.payoutMethod = "business_owner_fallback";
        result.fallbackReason = "employee_pay_exceeds_net";
        return result;
      }

      // Get business owner's Stripe Connect account
      const businessOwnerConnect = await StripeConnectAccount.findOne({
        where: { userId: assignment.businessOwnerId },
      });

      if (!businessOwnerConnect || !businessOwnerConnect.payoutsEnabled) {
        result.payoutMethod = "business_owner_fallback";
        result.fallbackReason = "business_owner_stripe_not_ready";
        return result;
      }

      // 1. PAY BUSINESS OWNER IMMEDIATELY
      if (businessOwnerAmount > 0) {
        const businessOwnerTransferParams = {
          amount: businessOwnerAmount,
          currency: "usd",
          destination: businessOwnerConnect.stripeAccountId,
          metadata: {
            appointmentId: appointment.id.toString(),
            assignmentId: assignment.id.toString(),
            payoutId: payout?.id?.toString() || "",
            payoutType: "business_owner_immediate",
          },
        };

        if (chargeId) {
          businessOwnerTransferParams.source_transaction = chargeId;
        }

        console.log(
          `[EmployeeDirectPayout] Paying business owner IMMEDIATELY: $${(businessOwnerAmount / 100).toFixed(2)} to ${businessOwnerConnect.stripeAccountId}`
        );

        let businessOwnerTransfer;
        try {
          businessOwnerTransfer = await stripe.transfers.create(
            businessOwnerTransferParams
          );
          result.businessOwnerPayout = {
            transferId: businessOwnerTransfer.id,
            amount: businessOwnerAmount,
          };
        } catch (stripeError) {
          // Handle Stripe transfer errors gracefully
          const errorMessage = stripeError.message || "Unknown Stripe error";
          const errorCode = stripeError.code || "unknown";

          console.error(`[EmployeeDirectPayout] Stripe transfer failed for business owner:`, {
            code: errorCode,
            message: errorMessage,
            type: stripeError.type,
          });

          // If Stripe transfer fails, fall back to business owner (they can retry manually)
          result.payoutMethod = "business_owner_fallback";
          result.fallbackReason = `stripe_transfer_failed_${errorCode}`;
          result.error = errorMessage;

          if (errorCode === "balance_insufficient") {
            result.error = "Platform has insufficient funds in Stripe account. Please add funds and retry the payout.";
          }

          return result;
        }
      }

      // 2. QUEUE EMPLOYEE PAYOUT FOR BI-WEEKLY BATCH
      if (employeeAmount > 0) {
        console.log(
          `[EmployeeDirectPayout] Queuing employee payout for bi-weekly batch: $${(employeeAmount / 100).toFixed(2)} for employee ${employee.id}`
        );

        const pendingPayout = await EmployeeBatchPayoutService.createPendingPayout(
          assignment,
          employeeAmount,
          appointment
        );

        result.employeePayout = {
          pending: true,
          pendingPayoutId: pendingPayout.id,
          amount: employeeAmount,
          scheduledPayoutDate: pendingPayout.scheduledPayoutDate,
        };
      }

      // Update assignment with payout details
      // Note: payoutStatus is set to 'pending_batch' by EmployeeBatchPayoutService.createPendingPayout()
      await assignment.update({
        businessOwnerPaidAmount: businessOwnerAmount,
        payoutMethod: "batched_biweekly",
      });

      result.payoutMethod = "batched_biweekly";

      console.log(
        `[EmployeeDirectPayout] Split payout complete: owner=$${(businessOwnerAmount / 100).toFixed(2)} (immediate), employee=$${(employeeAmount / 100).toFixed(2)} (batched)`
      );

      return result;
    } catch (error) {
      console.error("[EmployeeDirectPayout] Error processing split payout:", error);
      result.error = error.message;
      result.payoutMethod = "business_owner_fallback";
      return result;
    }
  }

  /**
   * Get payout summary for a business owner
   *
   * @param {number} businessOwnerId - ID of the business owner
   * @param {object} options - Filter options (dateFrom, dateTo)
   * @returns {object} - Summary of payouts
   */
  static async getPayoutSummary(businessOwnerId, options = {}) {
    const { Op } = require("sequelize");
    const where = {
      businessOwnerId,
      status: "completed",
    };

    if (options.dateFrom) {
      where.completedAt = { [Op.gte]: options.dateFrom };
    }
    if (options.dateTo) {
      where.completedAt = {
        ...(where.completedAt || {}),
        [Op.lte]: options.dateTo,
      };
    }

    const assignments = await EmployeeJobAssignment.findAll({
      where,
      attributes: [
        "payoutMethod",
        "employeePaidAmount",
        "businessOwnerPaidAmount",
        "payAmount",
      ],
    });

    const summary = {
      totalJobs: assignments.length,
      directToEmployee: 0,
      split: 0,
      businessOwner: 0,
      businessOwnerFallback: 0,
      totalEmployeePaid: 0,
      totalBusinessOwnerPaid: 0,
    };

    for (const a of assignments) {
      summary[a.payoutMethod === "direct_to_employee" ? "directToEmployee" : a.payoutMethod]++;
      summary.totalEmployeePaid += a.employeePaidAmount || 0;
      summary.totalBusinessOwnerPaid += a.businessOwnerPaidAmount || 0;
    }

    return summary;
  }
}

module.exports = EmployeeDirectPayoutService;
