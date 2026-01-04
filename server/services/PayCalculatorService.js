/**
 * PayCalculatorService - Handles pay calculations for business owner employees
 * Provides real-time profit calculation and financial summaries
 */

const { Op } = require("sequelize");
const {
  EmployeeJobAssignment,
  UserAppointments,
  User,
  sequelize,
} = require("../models");
const { getPricingConfig } = require("../config/businessConfig");

class PayCalculatorService {
  /**
   * Calculate job financials for a given appointment and employee pay
   * @param {Object} appointment - Appointment object with price
   * @param {number} employeePayAmount - Pay amount in cents
   * @returns {Object} Financial breakdown
   */
  static async calculateJobFinancials(appointment, employeePayAmount) {
    const config = await getPricingConfig();
    const platformFeePercent = config?.businessOwnerFeePercent || 0.10;

    // Get customer payment amount (convert from string to cents if needed)
    let customerPays;
    if (typeof appointment.price === "string") {
      customerPays = Math.round(parseFloat(appointment.price) * 100);
    } else {
      customerPays = appointment.price;
    }

    // Calculate platform fee
    const platformFee = Math.round(customerPays * platformFeePercent);

    // Calculate business owner's revenue after platform fee
    const revenueAfterFee = customerPays - platformFee;

    // Calculate profit
    const businessOwnerProfit = revenueAfterFee - employeePayAmount;

    // Calculate profit margin
    const profitMargin =
      revenueAfterFee > 0
        ? ((businessOwnerProfit / revenueAfterFee) * 100).toFixed(1)
        : 0;

    // Generate warnings
    const warnings = [];
    if (employeePayAmount > revenueAfterFee) {
      warnings.push({
        type: "negative_profit",
        message: `Pay exceeds revenue by $${((employeePayAmount - revenueAfterFee) / 100).toFixed(2)}`,
        severity: "error",
      });
    } else if (profitMargin < 10) {
      warnings.push({
        type: "low_margin",
        message: `Low profit margin: ${profitMargin}%`,
        severity: "warning",
      });
    } else if (profitMargin < 20) {
      warnings.push({
        type: "moderate_margin",
        message: `Moderate profit margin: ${profitMargin}%`,
        severity: "info",
      });
    }

    return {
      customerPays,
      platformFee,
      platformFeePercent: platformFeePercent * 100,
      revenueAfterFee,
      employeePay: employeePayAmount,
      businessOwnerProfit,
      profitMargin: parseFloat(profitMargin),
      warnings,
      // Formatted values for display
      formatted: {
        customerPays: `$${(customerPays / 100).toFixed(2)}`,
        platformFee: `$${(platformFee / 100).toFixed(2)}`,
        revenueAfterFee: `$${(revenueAfterFee / 100).toFixed(2)}`,
        employeePay: `$${(employeePayAmount / 100).toFixed(2)}`,
        businessOwnerProfit: `$${(businessOwnerProfit / 100).toFixed(2)}`,
        profitMargin: `${profitMargin}%`,
      },
    };
  }

  /**
   * Get financial summary for a business owner over a date range
   * @param {number} businessOwnerId - ID of the business owner
   * @param {string} startDate - Start date (YYYY-MM-DD)
   * @param {string} endDate - End date (YYYY-MM-DD)
   * @returns {Promise<Object>} Financial summary
   */
  static async getFinancialSummary(businessOwnerId, startDate, endDate) {
    const config = await getPricingConfig();
    const platformFeePercent = config?.businessOwnerFeePercent || 0.10;

    // Get all completed assignments in date range
    const assignments = await EmployeeJobAssignment.findAll({
      where: {
        businessOwnerId,
        status: "completed",
      },
      include: [
        {
          model: UserAppointments,
          as: "appointment",
          where: {
            date: {
              [Op.gte]: startDate,
              [Op.lte]: endDate,
            },
          },
          attributes: ["id", "date", "price"],
        },
      ],
    });

    let totalRevenue = 0;
    let totalEmployeePay = 0;
    let totalPlatformFees = 0;
    let selfAssignmentCount = 0;
    let employeeAssignmentCount = 0;

    for (const assignment of assignments) {
      const price =
        typeof assignment.appointment.price === "string"
          ? Math.round(parseFloat(assignment.appointment.price) * 100)
          : assignment.appointment.price;

      const platformFee = Math.round(price * platformFeePercent);

      totalRevenue += price;
      totalPlatformFees += platformFee;
      totalEmployeePay += assignment.payAmount;

      if (assignment.isSelfAssignment) {
        selfAssignmentCount++;
      } else {
        employeeAssignmentCount++;
      }
    }

    const netProfit = totalRevenue - totalPlatformFees - totalEmployeePay;
    const averageJobRevenue = assignments.length > 0 ? totalRevenue / assignments.length : 0;
    const averageEmployeePay =
      employeeAssignmentCount > 0 ? totalEmployeePay / employeeAssignmentCount : 0;

    return {
      summary: {
        totalRevenue,
        totalPlatformFees,
        totalEmployeePay,
        netProfit,
        jobCount: assignments.length,
        selfAssignmentCount,
        employeeAssignmentCount,
        averageJobRevenue: Math.round(averageJobRevenue),
        averageEmployeePay: Math.round(averageEmployeePay),
      },
      formatted: {
        totalRevenue: `$${(totalRevenue / 100).toFixed(2)}`,
        totalPlatformFees: `$${(totalPlatformFees / 100).toFixed(2)}`,
        totalEmployeePay: `$${(totalEmployeePay / 100).toFixed(2)}`,
        netProfit: `$${(netProfit / 100).toFixed(2)}`,
        averageJobRevenue: `$${(averageJobRevenue / 100).toFixed(2)}`,
        averageEmployeePay: `$${(averageEmployeePay / 100).toFixed(2)}`,
      },
      period: {
        startDate,
        endDate,
      },
      platformFeePercent: platformFeePercent * 100,
    };
  }

  /**
   * Validate a pay amount and return warnings
   * @param {number} employeePayAmount - Pay amount in cents
   * @param {number} jobTotal - Total job price in cents
   * @param {number} [platformFeePercent] - Platform fee percentage (default from config)
   * @returns {Object} Validation result with warnings
   */
  static async validatePayAmount(employeePayAmount, jobTotal, platformFeePercent = null) {
    if (platformFeePercent === null) {
      const config = await getPricingConfig();
      platformFeePercent = config?.businessOwnerFeePercent || 0.10;
    }

    const platformFee = Math.round(jobTotal * platformFeePercent);
    const revenueAfterFee = jobTotal - platformFee;
    const profit = revenueAfterFee - employeePayAmount;
    const profitMargin =
      revenueAfterFee > 0 ? ((profit / revenueAfterFee) * 100).toFixed(1) : 0;

    const warnings = [];
    let isValid = true;

    if (employeePayAmount < 0) {
      warnings.push({
        type: "invalid_amount",
        message: "Pay amount cannot be negative",
        severity: "error",
      });
      isValid = false;
    }

    if (employeePayAmount > revenueAfterFee) {
      warnings.push({
        type: "exceeds_revenue",
        message: `Pay exceeds revenue after platform fee. You will lose $${((employeePayAmount - revenueAfterFee) / 100).toFixed(2)} on this job.`,
        severity: "error",
      });
    }

    if (profitMargin < 0) {
      warnings.push({
        type: "negative_margin",
        message: "This pay amount results in a loss",
        severity: "error",
      });
    } else if (profitMargin < 10) {
      warnings.push({
        type: "low_margin",
        message: `Very low profit margin (${profitMargin}%)`,
        severity: "warning",
      });
    } else if (profitMargin < 20) {
      warnings.push({
        type: "moderate_margin",
        message: `Moderate profit margin (${profitMargin}%)`,
        severity: "info",
      });
    }

    return {
      isValid,
      warnings,
      calculations: {
        jobTotal,
        platformFee,
        revenueAfterFee,
        employeePay: employeePayAmount,
        profit,
        profitMargin: parseFloat(profitMargin),
      },
    };
  }

  /**
   * Get payroll summary by employee for a date range
   * @param {number} businessOwnerId - ID of the business owner
   * @param {string} startDate - Start date (YYYY-MM-DD)
   * @param {string} endDate - End date (YYYY-MM-DD)
   * @returns {Promise<Object[]>} Payroll by employee
   */
  static async getPayrollSummary(businessOwnerId, startDate, endDate) {
    const results = await EmployeeJobAssignment.findAll({
      where: {
        businessOwnerId,
        status: "completed",
        isSelfAssignment: false,
      },
      include: [
        {
          model: UserAppointments,
          as: "appointment",
          where: {
            date: {
              [Op.gte]: startDate,
              [Op.lte]: endDate,
            },
          },
          attributes: ["id", "date"],
        },
      ],
      attributes: [
        "businessEmployeeId",
        [sequelize.fn("SUM", sequelize.col("payAmount")), "totalPay"],
        [sequelize.fn("COUNT", sequelize.col("EmployeeJobAssignment.id")), "jobCount"],
      ],
      group: ["businessEmployeeId"],
      raw: true,
    });

    // Get employee names
    const { BusinessEmployee } = require("../models");
    const employeeIds = results.map((r) => r.businessEmployeeId);
    const employees = await BusinessEmployee.findAll({
      where: { id: employeeIds },
      attributes: ["id", "firstName", "lastName"],
    });

    const employeeMap = new Map(employees.map((e) => [e.id, e]));

    return results.map((r) => {
      const employee = employeeMap.get(r.businessEmployeeId);
      return {
        employeeId: r.businessEmployeeId,
        employeeName: employee
          ? `${employee.firstName} ${employee.lastName}`
          : "Unknown",
        totalPay: parseInt(r.totalPay, 10),
        jobCount: parseInt(r.jobCount, 10),
        formattedTotalPay: `$${(parseInt(r.totalPay, 10) / 100).toFixed(2)}`,
        averagePerJob: `$${(parseInt(r.totalPay, 10) / parseInt(r.jobCount, 10) / 100).toFixed(2)}`,
      };
    });
  }

  /**
   * Calculate suggested pay based on job characteristics
   * @param {Object} appointment - Appointment with home details
   * @param {Object} [options] - Calculation options
   * @returns {Object} Suggested pay amounts
   */
  static async calculateSuggestedPay(appointment, options = {}) {
    const config = await getPricingConfig();
    const platformFeePercent = config?.businessOwnerFeePercent || 0.10;

    // Get job price
    const jobPrice =
      typeof appointment.price === "string"
        ? Math.round(parseFloat(appointment.price) * 100)
        : appointment.price;

    const platformFee = Math.round(jobPrice * platformFeePercent);
    const revenueAfterFee = jobPrice - platformFee;

    // Calculate suggested amounts based on different profit margins
    const suggestions = [
      {
        label: "Generous (20% margin)",
        payAmount: Math.round(revenueAfterFee * 0.80),
        profitMargin: 20,
      },
      {
        label: "Standard (35% margin)",
        payAmount: Math.round(revenueAfterFee * 0.65),
        profitMargin: 35,
      },
      {
        label: "Conservative (50% margin)",
        payAmount: Math.round(revenueAfterFee * 0.50),
        profitMargin: 50,
      },
    ];

    return {
      jobPrice,
      platformFee,
      revenueAfterFee,
      suggestions: suggestions.map((s) => ({
        ...s,
        formattedPayAmount: `$${(s.payAmount / 100).toFixed(2)}`,
        yourProfit: revenueAfterFee - s.payAmount,
        formattedProfit: `$${((revenueAfterFee - s.payAmount) / 100).toFixed(2)}`,
      })),
    };
  }
}

module.exports = PayCalculatorService;
