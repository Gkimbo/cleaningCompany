/**
 * EmployeeBatchPayoutService
 *
 * Handles bi-weekly batched payouts to employees.
 * Business owners are paid immediately when jobs complete;
 * employee payouts are batched and paid every other Friday.
 */

const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
const { Op } = require("sequelize");
const {
  EmployeePendingPayout,
  EmployeeJobAssignment,
  BusinessEmployee,
  StripeConnectAccount,
  User,
} = require("../models");

// Anchor date for bi-weekly calculations (a known payout Friday)
const BIWEEKLY_ANCHOR = new Date("2024-01-05");

class EmployeeBatchPayoutService {
  /**
   * Calculate the next bi-weekly Friday payout date
   * Pay periods run Monday-Sunday for two weeks, payout on the following Friday.
   *
   * @param {Date} fromDate - Calculate from this date (default: now)
   * @returns {Date} - Next payout Friday
   */
  static getNextPayoutDate(fromDate = new Date()) {
    const today = new Date(fromDate);
    today.setHours(0, 0, 0, 0);

    // Find the next Friday
    let nextFriday = new Date(today);
    const dayOfWeek = nextFriday.getDay();
    const daysUntilFriday = (5 - dayOfWeek + 7) % 7;
    nextFriday.setDate(nextFriday.getDate() + (daysUntilFriday === 0 ? 7 : daysUntilFriday));

    // Check if this Friday is a payout Friday (every other Friday from anchor)
    while (!this.isPayoutFriday(nextFriday)) {
      nextFriday.setDate(nextFriday.getDate() + 7);
    }

    return nextFriday;
  }

  /**
   * Check if a given date is a payout Friday
   *
   * @param {Date} date - Date to check
   * @returns {boolean}
   */
  static isPayoutFriday(date = new Date()) {
    const checkDate = new Date(date);
    checkDate.setHours(0, 0, 0, 0);

    // Must be a Friday
    if (checkDate.getDay() !== 5) {
      return false;
    }

    // Calculate weeks since anchor
    const msPerWeek = 7 * 24 * 60 * 60 * 1000;
    const weeksSinceAnchor = Math.floor((checkDate - BIWEEKLY_ANCHOR) / msPerWeek);

    // Payout Fridays are every even number of weeks from anchor
    return weeksSinceAnchor % 2 === 0;
  }

  /**
   * Create a pending payout record when a job completes
   * Called instead of immediate employee payout
   *
   * @param {EmployeeJobAssignment} assignment - The job assignment
   * @param {number} amount - Amount in cents
   * @param {object} appointment - The appointment record
   * @returns {EmployeePendingPayout} - The created record
   */
  static async createPendingPayout(assignment, amount, appointment) {
    const scheduledPayoutDate = this.getNextPayoutDate();

    const pendingPayout = await EmployeePendingPayout.create({
      businessEmployeeId: assignment.businessEmployeeId,
      businessOwnerId: assignment.businessOwnerId,
      employeeJobAssignmentId: assignment.id,
      appointmentId: appointment.id,
      amount,
      payType: assignment.payType,
      hoursWorked: assignment.hoursWorked,
      status: "pending",
      earnedAt: new Date(),
      scheduledPayoutDate,
    });

    // Update assignment to reference pending payout
    await assignment.update({
      payoutStatus: "pending_batch",
      pendingPayoutId: pendingPayout.id,
    });

    console.log(
      `[EmployeeBatchPayout] Created pending payout #${pendingPayout.id} for $${(amount / 100).toFixed(2)} - scheduled for ${scheduledPayoutDate.toISOString().split("T")[0]}`
    );

    return pendingPayout;
  }

  /**
   * Get pending earnings for an employee
   *
   * @param {number} businessEmployeeId - Employee ID
   * @returns {object} - { totalPending, nextPayoutDate, jobs }
   */
  static async getPendingEarningsForEmployee(businessEmployeeId) {
    const pendingPayouts = await EmployeePendingPayout.findAll({
      where: {
        businessEmployeeId,
        status: "pending",
      },
      include: [
        {
          model: EmployeeJobAssignment,
          as: "assignment",
          include: ["appointment"],
        },
      ],
      order: [["earnedAt", "DESC"]],
    });

    const totalPending = pendingPayouts.reduce((sum, p) => sum + p.amount, 0);
    const nextPayoutDate = this.getNextPayoutDate();

    return {
      totalPending,
      formattedTotal: `$${(totalPending / 100).toFixed(2)}`,
      nextPayoutDate,
      jobCount: pendingPayouts.length,
      jobs: pendingPayouts.map((p) => ({
        id: p.id,
        amount: p.amount,
        formattedAmount: p.getFormattedAmount(),
        earnedAt: p.earnedAt,
        payType: p.payType,
        hoursWorked: p.hoursWorked,
        scheduledPayoutDate: p.scheduledPayoutDate,
        appointmentId: p.appointmentId,
      })),
    };
  }

  /**
   * Get pending payroll summary for a business owner
   *
   * @param {number} businessOwnerId - Business owner ID
   * @returns {object} - { totalPending, byEmployee, nextPayoutDate }
   */
  static async getPendingPayrollForBusiness(businessOwnerId) {
    const pendingPayouts = await EmployeePendingPayout.findAll({
      where: {
        businessOwnerId,
        status: "pending",
      },
      include: [
        {
          model: BusinessEmployee,
          as: "employee",
          attributes: ["id", "firstName", "lastName", "email"],
        },
      ],
      order: [["businessEmployeeId", "ASC"], ["earnedAt", "DESC"]],
    });

    // Group by employee
    const byEmployee = {};
    for (const payout of pendingPayouts) {
      const empId = payout.businessEmployeeId;
      if (!byEmployee[empId]) {
        byEmployee[empId] = {
          employeeId: empId,
          employeeName: payout.employee
            ? `${payout.employee.firstName} ${payout.employee.lastName}`
            : "Unknown",
          totalPending: 0,
          jobCount: 0,
          jobs: [],
        };
      }
      byEmployee[empId].totalPending += payout.amount;
      byEmployee[empId].jobCount += 1;
      byEmployee[empId].jobs.push({
        id: payout.id,
        amount: payout.amount,
        earnedAt: payout.earnedAt,
        appointmentId: payout.appointmentId,
      });
    }

    const totalPending = pendingPayouts.reduce((sum, p) => sum + p.amount, 0);
    const nextPayoutDate = this.getNextPayoutDate();

    return {
      totalPending,
      formattedTotal: `$${(totalPending / 100).toFixed(2)}`,
      nextPayoutDate,
      employeeCount: Object.keys(byEmployee).length,
      jobCount: pendingPayouts.length,
      byEmployee: Object.values(byEmployee).map((emp) => ({
        ...emp,
        formattedTotal: `$${(emp.totalPending / 100).toFixed(2)}`,
      })),
    };
  }

  /**
   * Process bi-weekly payouts for all due pending payouts
   * Called by cron job every other Friday
   *
   * @returns {object} - { processed, success, failed, results }
   */
  static async processBiWeeklyPayouts() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    console.log(`[EmployeeBatchPayout] Starting bi-weekly payout processing for ${today.toISOString().split("T")[0]}`);

    // Find all pending payouts scheduled for today or earlier
    const duePayouts = await EmployeePendingPayout.findAll({
      where: {
        status: "pending",
        scheduledPayoutDate: {
          [Op.lte]: today,
        },
      },
      include: [
        {
          model: BusinessEmployee,
          as: "employee",
          include: [{ model: User, as: "user" }],
        },
      ],
      order: [["businessEmployeeId", "ASC"]],
    });

    if (duePayouts.length === 0) {
      console.log("[EmployeeBatchPayout] No payouts due today");
      return { processed: 0, success: 0, failed: 0, results: [] };
    }

    console.log(`[EmployeeBatchPayout] Found ${duePayouts.length} pending payouts to process`);

    // Group by employee for batch processing
    const byEmployee = {};
    for (const payout of duePayouts) {
      const empId = payout.businessEmployeeId;
      if (!byEmployee[empId]) {
        byEmployee[empId] = {
          employee: payout.employee,
          payouts: [],
          totalAmount: 0,
        };
      }
      byEmployee[empId].payouts.push(payout);
      byEmployee[empId].totalAmount += payout.amount;
    }

    const results = [];
    let successCount = 0;
    let failedCount = 0;

    // Process each employee's batch
    for (const empId of Object.keys(byEmployee)) {
      const { employee, payouts, totalAmount } = byEmployee[empId];

      try {
        const result = await this.processEmployeeBatchPayout(employee, payouts, totalAmount);
        results.push(result);

        if (result.success) {
          successCount += payouts.length;
        } else {
          failedCount += payouts.length;
        }
      } catch (error) {
        console.error(`[EmployeeBatchPayout] Error processing employee ${empId}:`, error);
        failedCount += payouts.length;
        results.push({
          employeeId: empId,
          success: false,
          error: error.message,
          payoutCount: payouts.length,
          totalAmount,
        });
      }
    }

    console.log(
      `[EmployeeBatchPayout] Completed: ${successCount} success, ${failedCount} failed`
    );

    return {
      processed: duePayouts.length,
      success: successCount,
      failed: failedCount,
      results,
    };
  }

  /**
   * Process batch payout for a single employee
   *
   * @param {BusinessEmployee} employee - The employee
   * @param {EmployeePendingPayout[]} payouts - List of pending payouts
   * @param {number} totalAmount - Total amount in cents
   * @returns {object} - Result of the payout
   */
  static async processEmployeeBatchPayout(employee, payouts, totalAmount) {
    const employeeId = employee.id;

    // Check if employee has Stripe Connect set up
    if (!employee.stripeConnectAccountId) {
      console.log(`[EmployeeBatchPayout] Employee ${employeeId} has no Stripe account`);

      // Mark all payouts as failed
      for (const payout of payouts) {
        await payout.update({
          status: "failed",
          failureReason: "Employee has not set up Stripe Connect",
          retryCount: payout.retryCount + 1,
        });
      }

      return {
        employeeId,
        success: false,
        error: "No Stripe Connect account",
        payoutCount: payouts.length,
        totalAmount,
      };
    }

    // Check if Stripe account is ready for payouts
    if (!employee.stripeConnectOnboarded) {
      console.log(`[EmployeeBatchPayout] Employee ${employeeId} has not completed Stripe onboarding`);

      for (const payout of payouts) {
        await payout.update({
          status: "failed",
          failureReason: "Employee has not completed Stripe onboarding",
          retryCount: payout.retryCount + 1,
        });
      }

      return {
        employeeId,
        success: false,
        error: "Stripe onboarding incomplete",
        payoutCount: payouts.length,
        totalAmount,
      };
    }

    // Mark all as processing
    for (const payout of payouts) {
      await payout.update({ status: "processing" });
    }

    try {
      // Create a single Stripe transfer for the total amount
      const transfer = await stripe.transfers.create({
        amount: totalAmount,
        currency: "usd",
        destination: employee.stripeConnectAccountId,
        metadata: {
          payoutType: "biweekly_batch",
          businessEmployeeId: employeeId.toString(),
          payoutCount: payouts.length.toString(),
          payoutIds: payouts.map((p) => p.id).join(","),
        },
      });

      // Mark all as completed
      const now = new Date();
      for (const payout of payouts) {
        await payout.update({
          status: "completed",
          stripeTransferId: transfer.id,
          paidAt: now,
        });

        // Update the assignment
        await EmployeeJobAssignment.update(
          {
            payoutStatus: "paid",
            employeeStripeTransferId: transfer.id,
            employeePaidAmount: payout.amount,
          },
          { where: { id: payout.employeeJobAssignmentId } }
        );
      }

      console.log(
        `[EmployeeBatchPayout] Paid employee ${employeeId}: $${(totalAmount / 100).toFixed(2)} (${payouts.length} jobs) - Transfer: ${transfer.id}`
      );

      return {
        employeeId,
        employeeName: `${employee.firstName} ${employee.lastName}`,
        success: true,
        transferId: transfer.id,
        payoutCount: payouts.length,
        totalAmount,
        formattedAmount: `$${(totalAmount / 100).toFixed(2)}`,
      };
    } catch (error) {
      console.error(`[EmployeeBatchPayout] Stripe error for employee ${employeeId}:`, error);

      // Mark all as failed
      for (const payout of payouts) {
        await payout.update({
          status: "failed",
          failureReason: error.message,
          retryCount: payout.retryCount + 1,
        });
      }

      return {
        employeeId,
        success: false,
        error: error.message,
        payoutCount: payouts.length,
        totalAmount,
      };
    }
  }

  /**
   * Process early payout for a specific employee (triggered by business owner)
   *
   * @param {number} businessEmployeeId - Employee ID
   * @param {number} businessOwnerId - Business owner ID (for verification)
   * @returns {object} - Result of the payout
   */
  static async processEarlyPayout(businessEmployeeId, businessOwnerId) {
    // Find all pending payouts for this employee from this business owner
    const pendingPayouts = await EmployeePendingPayout.findAll({
      where: {
        businessEmployeeId,
        businessOwnerId,
        status: "pending",
      },
      include: [
        {
          model: BusinessEmployee,
          as: "employee",
        },
      ],
    });

    if (pendingPayouts.length === 0) {
      return {
        success: false,
        error: "No pending payouts found for this employee",
      };
    }

    const totalAmount = pendingPayouts.reduce((sum, p) => sum + p.amount, 0);
    const employee = pendingPayouts[0].employee;

    console.log(
      `[EmployeeBatchPayout] Processing early payout for employee ${businessEmployeeId}: $${(totalAmount / 100).toFixed(2)}`
    );

    const result = await this.processEmployeeBatchPayout(employee, pendingPayouts, totalAmount);

    return {
      ...result,
      isEarlyPayout: true,
    };
  }

  /**
   * Process immediate payout for terminated employee
   *
   * @param {number} businessEmployeeId - Employee ID
   * @returns {object} - Result of the payout
   */
  static async processTerminationPayout(businessEmployeeId) {
    // Find all pending payouts for this employee
    const pendingPayouts = await EmployeePendingPayout.findAll({
      where: {
        businessEmployeeId,
        status: "pending",
      },
      include: [
        {
          model: BusinessEmployee,
          as: "employee",
        },
      ],
    });

    if (pendingPayouts.length === 0) {
      console.log(`[EmployeeBatchPayout] No pending payouts for terminated employee ${businessEmployeeId}`);
      return {
        success: true,
        message: "No pending payouts",
        totalAmount: 0,
      };
    }

    const totalAmount = pendingPayouts.reduce((sum, p) => sum + p.amount, 0);
    const employee = pendingPayouts[0].employee;

    console.log(
      `[EmployeeBatchPayout] Processing termination payout for employee ${businessEmployeeId}: $${(totalAmount / 100).toFixed(2)}`
    );

    const result = await this.processEmployeeBatchPayout(employee, pendingPayouts, totalAmount);

    return {
      ...result,
      isTerminationPayout: true,
    };
  }

  /**
   * Cancel a pending payout (e.g., if job is disputed)
   *
   * @param {number} employeeJobAssignmentId - Assignment ID
   * @param {string} reason - Cancellation reason
   * @returns {object} - Result
   */
  static async cancelPendingPayout(employeeJobAssignmentId, reason) {
    const pendingPayout = await EmployeePendingPayout.findOne({
      where: {
        employeeJobAssignmentId,
        status: "pending",
      },
    });

    if (!pendingPayout) {
      return {
        success: false,
        error: "No pending payout found for this assignment",
      };
    }

    await pendingPayout.update({
      status: "cancelled",
      failureReason: reason,
    });

    // Update the assignment
    await EmployeeJobAssignment.update(
      { payoutStatus: "cancelled", pendingPayoutId: null },
      { where: { id: employeeJobAssignmentId } }
    );

    console.log(
      `[EmployeeBatchPayout] Cancelled pending payout #${pendingPayout.id}: ${reason}`
    );

    return {
      success: true,
      cancelledAmount: pendingPayout.amount,
    };
  }
}

module.exports = EmployeeBatchPayoutService;
