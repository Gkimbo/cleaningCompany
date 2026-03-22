/**
 * BusinessOwnerService - Client-side service for business owner API calls
 * Handles employee management, job assignments, dashboard, and payouts
 */

import HttpClient from "../HttpClient";

class BusinessOwnerService {
  // =====================
  // EMPLOYEE MANAGEMENT
  // =====================

  /**
   * Get all employees for the business owner
   */
  static async getEmployees(token, status = null) {
    const url = status ? `/business-owner/employees?status=${status}` : "/business-owner/employees";
    const result = await HttpClient.get(url, { token });

    if (result.success === false) {
      if (__DEV__) console.warn("[BusinessOwner] getEmployees failed:", result.error);
      return { employees: [] };
    }

    return result;
  }

  /**
   * Get employees with calculated pay for a specific job
   */
  static async getEmployeesForJob(token, appointmentId, mode = "add") {
    const result = await HttpClient.get(`/business-owner/employees/for-job/${appointmentId}?mode=${mode}`, { token });

    if (result.success === false) {
      if (__DEV__) console.warn("[BusinessOwner] getEmployeesForJob failed:", result.error);
      return { employees: [] };
    }

    return result;
  }

  /**
   * Invite a new employee
   */
  static async inviteEmployee(token, employeeData) {
    const result = await HttpClient.post("/business-owner/employees/invite", employeeData, { token });

    if (result.success === false) {
      return { success: false, error: result.error || "Failed to send invitation" };
    }

    return { success: true, employee: result.employee };
  }

  /**
   * Get a specific employee
   */
  static async getEmployee(token, employeeId) {
    const result = await HttpClient.get(`/business-owner/employees/${employeeId}`, { token });

    if (result.success === false) {
      if (__DEV__) console.warn("[BusinessOwner] getEmployee failed:", result.error);
      return null;
    }

    return result;
  }

  /**
   * Update an employee
   */
  static async updateEmployee(token, employeeId, updates) {
    const result = await HttpClient.put(`/business-owner/employees/${employeeId}`, updates, { token });

    if (result.success === false) {
      return { success: false, error: result.error || "Failed to update employee" };
    }

    return { success: true, employee: result.employee };
  }

  /**
   * Terminate an employee
   */
  static async terminateEmployee(token, employeeId, reason = "") {
    const result = await HttpClient.delete(`/business-owner/employees/${employeeId}`, { token, body: { reason } });

    if (result.success === false) {
      return { success: false, error: result.error || "Failed to terminate employee" };
    }

    return { success: true, message: result.message };
  }

  /**
   * Reactivate a terminated employee
   */
  static async reactivateEmployee(token, employeeId) {
    const result = await HttpClient.post(`/business-owner/employees/${employeeId}/reactivate`, {}, { token });

    if (result.success === false) {
      return { success: false, error: result.error || "Failed to reactivate employee" };
    }

    return { success: true, employee: result.employee };
  }

  /**
   * Update employee availability schedule
   */
  static async updateAvailability(token, employeeId, availabilityData) {
    const result = await HttpClient.put(`/business-owner/employees/${employeeId}/availability`, availabilityData, { token });

    if (result.success === false) {
      return { success: false, error: result.error || "Failed to update availability" };
    }

    return { success: true, employee: result.employee };
  }

  /**
   * Get available employees for a specific date/time
   */
  static async getAvailableEmployees(token, date, startTime = null, jobType = null) {
    const params = new URLSearchParams({ date });
    if (startTime) params.append("startTime", startTime);
    if (jobType) params.append("jobType", jobType);

    const result = await HttpClient.get(`/business-owner/employees/available?${params}`, { token });

    if (result.success === false) {
      if (__DEV__) console.warn("[BusinessOwner] getAvailableEmployees failed:", result.error);
      return { employees: [] };
    }

    return result;
  }

  /**
   * Get team members available for a specific job (used for team booking)
   */
  static async getTeamForJob(token, jobDate, startTime = null) {
    const params = new URLSearchParams({ jobDate });
    if (startTime) params.append("startTime", startTime);

    const result = await HttpClient.get(`/business-owner/team-for-job?${params}`, { token });

    if (result.success === false) {
      if (__DEV__) console.warn("[BusinessOwner] getTeamForJob failed:", result.error);
      return { employees: [] };
    }

    return result;
  }

  /**
   * Resend invitation email to an employee
   */
  static async resendInvite(token, employeeId) {
    const result = await HttpClient.post(`/business-owner/employees/${employeeId}/resend-invite`, {}, { token });

    if (result.success === false) {
      return { success: false, error: result.error || "Failed to resend invitation" };
    }

    return { success: true, message: result.message };
  }

  // =====================
  // JOB ASSIGNMENTS
  // =====================

  /**
   * Get job assignments with optional filters
   */
  static async getAssignments(token, filters = {}) {
    const params = new URLSearchParams();
    if (filters.employeeId) params.append("employeeId", filters.employeeId);
    if (filters.status) params.append("status", filters.status);
    if (filters.startDate) params.append("startDate", filters.startDate);
    if (filters.endDate) params.append("endDate", filters.endDate);

    const url = `/business-owner/assignments${params.toString() ? `?${params}` : ""}`;
    const result = await HttpClient.get(url, { token });

    if (result.success === false) {
      if (__DEV__) console.warn("[BusinessOwner] getAssignments failed:", result.error);
      return { assignments: [] };
    }

    return result;
  }

  /**
   * Get a single assignment by ID
   */
  static async getAssignmentDetail(token, assignmentId) {
    const result = await HttpClient.get(`/business-owner/assignments/${assignmentId}`, { token });

    if (result.success === false) {
      return { error: result.error || "Failed to load assignment details" };
    }

    return result;
  }

  /**
   * Assign an employee to a job
   */
  static async assignEmployee(token, assignmentData) {
    const result = await HttpClient.post("/business-owner/assignments", assignmentData, { token });

    if (result.success === false) {
      return { success: false, error: result.error || "Failed to assign employee" };
    }

    return { success: true, assignment: result.assignment };
  }

  /**
   * Self-assign business owner to a job (tracked as $0 payroll)
   */
  static async selfAssign(token, appointmentId) {
    const result = await HttpClient.post(`/business-owner/self-assign/${appointmentId}`, {}, { token });

    if (result.success === false) {
      return { success: false, error: result.error || "Failed to self-assign" };
    }

    return { success: true, assignment: result.assignment };
  }

  /**
   * Unassign an employee from a job
   */
  static async unassignJob(token, assignmentId) {
    const result = await HttpClient.delete(`/business-owner/assignments/${assignmentId}`, { token });

    if (result.success === false) {
      return { success: false, error: result.error || "Failed to unassign job" };
    }

    return { success: true, message: result.message };
  }

  /**
   * Reassign a job to a different employee
   */
  static async reassignJob(token, assignmentId, newEmployeeId) {
    const result = await HttpClient.post(`/business-owner/assignments/${assignmentId}/reassign`, { newEmployeeId }, { token });

    if (result.success === false) {
      return { success: false, error: result.error || "Failed to reassign job" };
    }

    return { success: true, assignment: result.assignment };
  }

  /**
   * Update job pay for an assignment
   */
  static async updateJobPay(token, assignmentId, payData) {
    const result = await HttpClient.put(`/business-owner/assignments/${assignmentId}/pay`, payData, { token });

    if (result.success === false) {
      return { success: false, error: result.error || "Failed to update pay" };
    }

    return { success: true, assignment: result.assignment, changeLog: result.changeLog };
  }

  /**
   * Recalculate pay for an assignment based on home size and employee's default rates
   */
  static async recalculatePay(token, assignmentId) {
    const result = await HttpClient.post(`/business-owner/assignments/${assignmentId}/recalculate-pay`, {}, { token });

    if (result.success === false) {
      return { success: false, error: result.error || "Failed to recalculate pay" };
    }

    return { success: true, assignment: result.assignment };
  }

  /**
   * Get pay change history for an assignment
   */
  static async getPayHistory(token, assignmentId) {
    const result = await HttpClient.get(`/business-owner/assignments/${assignmentId}/pay-history`, { token });

    if (result.success === false) {
      if (__DEV__) console.warn("[BusinessOwner] getPayHistory failed:", result.error);
      return { changeLog: [] };
    }

    return result;
  }

  // =====================
  // DASHBOARD & REPORTS
  // =====================

  /**
   * Get dashboard overview data
   */
  static async getDashboard(token) {
    const result = await HttpClient.get("/business-owner/dashboard", { token });

    if (result.success === false) {
      if (__DEV__) console.warn("[BusinessOwner] getDashboard failed:", result.error);
      return { overview: {}, employees: [], recentActivity: [] };
    }

    return result;
  }

  /**
   * Get calendar data for a specific month
   */
  static async getCalendar(token, month, year) {
    const result = await HttpClient.get(`/business-owner/calendar?month=${month}&year=${year}`, { token });

    if (result.success === false) {
      if (__DEV__) console.warn("[BusinessOwner] getCalendar failed:", result.error);
      return { assignments: [], employees: [], unassignedJobs: [] };
    }

    return result;
  }

  /**
   * Get financial report
   */
  static async getFinancials(token, startDate, endDate) {
    const result = await HttpClient.get(`/business-owner/financials?startDate=${startDate}&endDate=${endDate}`, { token });

    if (result.success === false) {
      if (__DEV__) console.warn("[BusinessOwner] getFinancials failed:", result.error);
      return { summary: {}, byEmployee: [], byJob: [] };
    }

    return result;
  }

  /**
   * Get annual tax export data
   */
  static async getTaxExport(token, year) {
    const result = await HttpClient.get(`/business-owner/tax-export/${year}`, { token });

    if (result.success === false) {
      return { error: result.error || "Failed to fetch tax data" };
    }

    return result;
  }

  /**
   * Get payroll summary
   */
  static async getPayrollSummary(token, period = "month") {
    const result = await HttpClient.get(`/business-owner/payroll-summary?period=${period}`, { token });

    if (result.success === false) {
      if (__DEV__) console.warn("[BusinessOwner] getPayrollSummary failed:", result.error);
      return { payroll: {} };
    }

    return result;
  }

  // =====================
  // PAYOUTS
  // =====================

  /**
   * Get pending payouts
   */
  static async getPendingPayouts(token) {
    const result = await HttpClient.get("/business-owner/payouts/pending", { token });

    if (result.success === false) {
      if (__DEV__) console.warn("[BusinessOwner] getPendingPayouts failed:", result.error);
      return { pendingPayouts: [], totalAmount: 0, byEmployee: [] };
    }

    return result;
  }

  /**
   * Mark an assignment as paid outside the platform
   */
  static async markPaidOutsidePlatform(token, assignmentId, note = "") {
    const result = await HttpClient.post(`/business-owner/payouts/${assignmentId}/mark-paid-outside`, { note }, { token });

    if (result.success === false) {
      return { success: false, error: result.error || "Failed to mark as paid" };
    }

    return { success: true, assignment: result.assignment };
  }

  /**
   * Update hours worked for an assignment (for hourly employees)
   */
  static async updateHoursWorked(token, assignmentId, hoursWorked) {
    const result = await HttpClient.put(`/business-owner/assignments/${assignmentId}/hours`, { hoursWorked }, { token });

    if (result.success === false) {
      return { success: false, error: result.error || "Failed to update hours" };
    }

    return { success: true, assignment: result.assignment };
  }

  /**
   * Process multiple payouts at once
   */
  static async processBatchPayouts(token, assignmentIds) {
    const result = await HttpClient.post("/business-owner/payouts/batch", { assignmentIds }, { token });

    if (result.success === false) {
      return { success: false, error: result.error || "Failed to process payouts" };
    }

    return { success: true, processed: result.processed };
  }

  // =====================
  // ANALYTICS
  // =====================

  /**
   * Get analytics tier access info
   */
  static async getAnalyticsAccess(token) {
    const result = await HttpClient.get("/business-owner/analytics/access", { token });

    if (result.success === false) {
      if (__DEV__) console.warn("[BusinessOwner] getAnalyticsAccess failed:", result.error);
      return { tier: "standard", features: { basicMetrics: true } };
    }

    return result;
  }

  /**
   * Get all analytics (combined endpoint, respects tier)
   */
  static async getAllAnalytics(token, options = {}) {
    const params = new URLSearchParams();
    if (options.months) params.append("months", options.months);
    if (options.topClientsLimit) params.append("topClientsLimit", options.topClientsLimit);
    if (options.churnDays) params.append("churnDays", options.churnDays);

    const url = `/business-owner/analytics${params.toString() ? `?${params}` : ""}`;
    const result = await HttpClient.get(url, { token });

    if (result.success === false) {
      if (__DEV__) console.warn("[BusinessOwner] getAllAnalytics failed:", result.error);
      return { access: { tier: "standard" }, overview: {} };
    }

    return result;
  }

  /**
   * Get overview analytics (available to all tiers)
   */
  static async getOverviewAnalytics(token) {
    const result = await HttpClient.get("/business-owner/analytics/overview", { token });

    if (result.success === false) {
      if (__DEV__) console.warn("[BusinessOwner] getOverviewAnalytics failed:", result.error);
      return {};
    }

    return result;
  }

  /**
   * Get employee performance analytics (premium)
   */
  static async getEmployeeAnalytics(token, options = {}) {
    const params = new URLSearchParams();
    if (options.months) params.append("months", options.months);
    if (options.limit) params.append("limit", options.limit);

    const url = `/business-owner/analytics/employees${params.toString() ? `?${params}` : ""}`;
    const result = await HttpClient.get(url, { token });

    if (result.status === 403) {
      return { error: "premium_required", ...result };
    }

    if (result.success === false) {
      if (__DEV__) console.warn("[BusinessOwner] getEmployeeAnalytics failed:", result.error);
      return { employees: [] };
    }

    return result;
  }

  /**
   * Get client insights (premium)
   */
  static async getClientAnalytics(token, options = {}) {
    const params = new URLSearchParams();
    if (options.topClientsLimit) params.append("topClientsLimit", options.topClientsLimit);
    if (options.churnDays) params.append("churnDays", options.churnDays);

    const url = `/business-owner/analytics/clients${params.toString() ? `?${params}` : ""}`;
    const result = await HttpClient.get(url, { token });

    if (result.status === 403) {
      return { error: "premium_required", ...result };
    }

    if (result.success === false) {
      if (__DEV__) console.warn("[BusinessOwner] getClientAnalytics failed:", result.error);
      return {};
    }

    return result;
  }

  /**
   * Get financial analytics (premium)
   */
  static async getFinancialAnalytics(token, options = {}) {
    const params = new URLSearchParams();
    if (options.months) params.append("months", options.months);

    const url = `/business-owner/analytics/financials${params.toString() ? `?${params}` : ""}`;
    const result = await HttpClient.get(url, { token });

    if (result.status === 403) {
      return { error: "premium_required", ...result };
    }

    if (result.success === false) {
      if (__DEV__) console.warn("[BusinessOwner] getFinancialAnalytics failed:", result.error);
      return {};
    }

    return result;
  }

  /**
   * Get trend data for charts
   */
  static async getTrends(token, options = {}) {
    const params = new URLSearchParams();
    if (options.period) params.append("period", options.period);
    if (options.months) params.append("months", options.months);

    const url = `/business-owner/analytics/trends${params.toString() ? `?${params}` : ""}`;
    const result = await HttpClient.get(url, { token });

    if (result.success === false) {
      if (__DEV__) console.warn("[BusinessOwner] getTrends failed:", result.error);
      return { data: [] };
    }

    return result;
  }

  // =====================
  // VERIFICATION
  // =====================

  /**
   * Get verification status
   */
  static async getVerificationStatus(token) {
    const result = await HttpClient.get("/business-owner/verification/status", { token });

    if (result.success === false) {
      if (__DEV__) console.warn("[BusinessOwner] getVerificationStatus failed:", result.error);
      return { found: false };
    }

    return result;
  }

  /**
   * Check eligibility for verification
   */
  static async checkVerificationEligibility(token) {
    const result = await HttpClient.get("/business-owner/verification/eligibility", { token });

    if (result.success === false) {
      if (__DEV__) console.warn("[BusinessOwner] checkVerificationEligibility failed:", result.error);
      return { eligible: false };
    }

    return result;
  }

  /**
   * Request verification
   */
  static async requestVerification(token) {
    const result = await HttpClient.post("/business-owner/verification/request", {}, { token });

    if (result.success === false) {
      return { success: false, error: result.error || "Failed to request verification" };
    }

    return result;
  }

  /**
   * Update business profile
   */
  static async updateBusinessProfile(token, profileData) {
    const result = await HttpClient.put("/business-owner/verification/profile", profileData, { token });

    if (result.success === false) {
      return { success: false, error: result.error || "Failed to update profile" };
    }

    return result;
  }

  /**
   * Get verification requirements/config
   */
  static async getVerificationConfig(token) {
    const result = await HttpClient.get("/business-owner/verification/config", { token });

    if (result.success === false) {
      if (__DEV__) console.warn("[BusinessOwner] getVerificationConfig failed:", result.error);
      return {};
    }

    return result;
  }

  // =====================
  // PAY CALCULATOR (local)
  // =====================

  /**
   * Calculate job financials locally (preview before saving)
   */
  static calculateJobFinancials(customerPays, employeePay, platformFeePercent = 10) {
    const platformFee = Math.round(customerPays * (platformFeePercent / 100));
    const afterFees = customerPays - platformFee;
    const profit = afterFees - employeePay;
    const profitMargin = afterFees > 0 ? ((profit / afterFees) * 100).toFixed(1) : 0;

    const warnings = [];
    if (profit < 0) {
      warnings.push({
        type: "negative_profit",
        message: "Employee pay exceeds revenue after platform fees",
      });
    } else if (profitMargin < 10) {
      warnings.push({
        type: "low_margin",
        message: "Profit margin is below 10%",
      });
    }

    return {
      customerPays,
      platformFee,
      employeePay,
      businessOwnerProfit: profit,
      profitMargin: parseFloat(profitMargin),
      warnings,
      formatted: {
        customerPays: `$${(customerPays / 100).toFixed(2)}`,
        platformFee: `$${(platformFee / 100).toFixed(2)}`,
        employeePay: `$${(employeePay / 100).toFixed(2)}`,
        businessOwnerProfit: `$${(profit / 100).toFixed(2)}`,
        profitMargin: `${profitMargin}%`,
      },
    };
  }

  /**
   * Suggest pay amounts at different margin levels
   */
  static suggestPayAmounts(customerPays, platformFeePercent = 10) {
    const platformFee = Math.round(customerPays * (platformFeePercent / 100));
    const afterFees = customerPays - platformFee;

    return {
      margin20: {
        payAmount: Math.round(afterFees * 0.8),
        formatted: `$${((afterFees * 0.8) / 100).toFixed(2)}`,
        label: "20% margin",
      },
      margin35: {
        payAmount: Math.round(afterFees * 0.65),
        formatted: `$${((afterFees * 0.65) / 100).toFixed(2)}`,
        label: "35% margin",
      },
      margin50: {
        payAmount: Math.round(afterFees * 0.5),
        formatted: `$${((afterFees * 0.5) / 100).toFixed(2)}`,
        label: "50% margin",
      },
    };
  }

  // =====================
  // Client Payment Tracking
  // =====================

  /**
   * Get unpaid client appointments
   */
  static async getClientPayments(token) {
    const result = await HttpClient.get("/business-owner/client-payments", { token });

    if (result.success === false) {
      if (__DEV__) console.warn("[BusinessOwner] getClientPayments failed:", result.error);
      return { unpaidAppointments: [], totalUnpaid: 0 };
    }

    return result;
  }

  /**
   * Mark an appointment as paid by client
   */
  static async markAppointmentPaid(token, appointmentId) {
    const result = await HttpClient.post(`/business-owner/appointments/${appointmentId}/mark-paid`, {}, { token });

    if (result.success === false) {
      return { success: false, error: result.error || "Failed to mark appointment as paid" };
    }

    return result;
  }

  /**
   * Send a payment reminder to client
   */
  static async sendPaymentReminder(token, appointmentId) {
    const result = await HttpClient.post(`/business-owner/appointments/${appointmentId}/send-reminder`, {}, { token });

    if (result.success === false) {
      return { success: false, error: result.error || "Failed to send reminder" };
    }

    return result;
  }

  /**
   * Get payroll history (paid payments)
   */
  static async getPayrollHistory(token, limit = 50) {
    const result = await HttpClient.get(`/business-owner/payroll/history?limit=${limit}`, { token });

    if (result.success === false) {
      if (__DEV__) console.warn("[BusinessOwner] getPayrollHistory failed:", result.error);
      return { payouts: [] };
    }

    return result;
  }

  /**
   * Get pending bi-weekly payroll summary
   */
  static async getPendingPayroll(token) {
    const result = await HttpClient.get("/business-owner/payroll/pending", { token });

    if (result.success === false) {
      if (__DEV__) console.warn("[BusinessOwner] getPendingPayroll failed:", result.error);
      return { totalPending: 0, nextPayoutDate: null, byEmployee: [], formatted: { totalPending: "$0.00" } };
    }

    return result;
  }

  /**
   * Trigger an early payout for an employee (before the scheduled bi-weekly date)
   */
  static async triggerEarlyPayout(token, employeeId) {
    const result = await HttpClient.post(`/business-owner/payroll/early-payout/${employeeId}`, {}, { token });

    if (result.success === false) {
      return { success: false, error: result.error || "Failed to trigger early payout" };
    }

    return { success: true, ...result };
  }

  // =====================
  // TIMESHEET & HOURS TRACKING
  // =====================

  /**
   * Get timesheet data for all employees
   */
  static async getTimesheetData(token, startDate, endDate) {
    const params = new URLSearchParams();
    if (startDate) params.append("startDate", startDate);
    if (endDate) params.append("endDate", endDate);

    const url = `/business-owner/timesheet${params.toString() ? `?${params}` : ""}`;
    const result = await HttpClient.get(url, { token });

    if (result.success === false) {
      if (__DEV__) console.warn("[BusinessOwner] getTimesheetData failed:", result.error);
      return { employees: [], totalHours: 0, totalPay: 0 };
    }

    return result;
  }

  /**
   * Get hours detail for a specific employee
   */
  static async getEmployeeHours(token, employeeId, startDate, endDate) {
    const params = new URLSearchParams();
    if (startDate) params.append("startDate", startDate);
    if (endDate) params.append("endDate", endDate);

    const url = `/business-owner/employees/${employeeId}/hours${params.toString() ? `?${params}` : ""}`;
    const result = await HttpClient.get(url, { token });

    if (result.success === false) {
      return { error: result.error || "Failed to fetch hours" };
    }

    return result;
  }

  /**
   * Get employee workload data for fair job distribution
   */
  static async getEmployeeWorkload(token) {
    const result = await HttpClient.get("/business-owner/employee-workload", { token });

    if (result.success === false) {
      if (__DEV__) console.warn("[BusinessOwner] getEmployeeWorkload failed:", result.error);
      return { employees: [], teamAverage: {}, unassignedJobCount: 0 };
    }

    return result;
  }

  /**
   * Get unassigned jobs for the business owner
   */
  static async getUnassignedJobs(token) {
    const result = await HttpClient.get("/business-owner/unassigned-jobs", { token });

    if (result.success === false) {
      if (__DEV__) console.warn("[BusinessOwner] getUnassignedJobs failed:", result.error);
      return { jobs: [] };
    }

    return result;
  }

  // =====================================
  // Employee Bonus Methods
  // =====================================

  /**
   * Create a bonus for an employee
   */
  static async createBonus(token, bonusData) {
    const result = await HttpClient.post("/business-owner/bonuses", bonusData, { token });

    if (result.success === false) {
      return { error: result.error };
    }

    return result;
  }

  /**
   * Get all bonuses (with optional filters)
   */
  static async getBonuses(token, filters = {}) {
    const params = new URLSearchParams();
    if (filters.status) params.append("status", filters.status);
    if (filters.employeeId) params.append("employeeId", filters.employeeId);
    if (filters.limit) params.append("limit", filters.limit);

    const url = `/business-owner/bonuses${params.toString() ? `?${params}` : ""}`;
    const result = await HttpClient.get(url, { token });

    if (result.success === false) {
      if (__DEV__) console.warn("[BusinessOwner] getBonuses failed:", result.error);
      return [];
    }

    return result;
  }

  /**
   * Get pending bonuses
   */
  static async getPendingBonuses(token) {
    const result = await HttpClient.get("/business-owner/bonuses/pending", { token });

    if (result.success === false) {
      if (__DEV__) console.warn("[BusinessOwner] getPendingBonuses failed:", result.error);
      return [];
    }

    return result;
  }

  /**
   * Get bonus summary stats
   */
  static async getBonusSummary(token) {
    const result = await HttpClient.get("/business-owner/bonuses/summary", { token });

    if (result.success === false) {
      if (__DEV__) console.warn("[BusinessOwner] getBonusSummary failed:", result.error);
      return { pending: { total: 0, count: 0 }, paid: { total: 0, count: 0 } };
    }

    return result;
  }

  /**
   * Mark a bonus as paid
   */
  static async markBonusPaid(token, bonusId, note = null) {
    const result = await HttpClient.put(`/business-owner/bonuses/${bonusId}/paid`, { note }, { token });

    if (result.success === false) {
      return { error: result.error };
    }

    return result;
  }

  /**
   * Cancel a pending bonus
   */
  static async cancelBonus(token, bonusId) {
    const result = await HttpClient.delete(`/business-owner/bonuses/${bonusId}`, { token });

    if (result.success === false) {
      return { error: result.error };
    }

    return result;
  }

  // =====================
  // EMPLOYEE DIRECT PAYOUTS
  // =====================

  /**
   * Get employee payout settings for the business owner
   */
  static async getEmployeePayoutSettings(token) {
    const result = await HttpClient.get("/business-owner/settings/employee-payouts", { token });

    if (result.success === false) {
      if (__DEV__) console.warn("[BusinessOwner] getEmployeePayoutSettings failed:", result.error);
      return { employeePayoutMethod: "all_to_owner", employees: [] };
    }

    return result;
  }

  /**
   * Update employee payout settings
   */
  static async updateEmployeePayoutSettings(token, settings) {
    const result = await HttpClient.put("/business-owner/settings/employee-payouts", settings, { token });

    if (result.success === false) {
      return { success: false, error: result.error || "Failed to update settings" };
    }

    return { success: true, settings: result.settings };
  }

  /**
   * Check if an employee is eligible for direct payouts
   */
  static async getEmployeePayoutEligibility(token, employeeId) {
    const result = await HttpClient.get(`/business-owner/employees/${employeeId}/payout-eligibility`, { token });

    if (result.success === false) {
      if (__DEV__) console.warn("[BusinessOwner] getEmployeePayoutEligibility failed:", result.error);
      return { eligible: false, reason: "error" };
    }

    return result;
  }

  /**
   * Initiate Stripe Connect onboarding for an employee
   */
  static async initiateEmployeeStripeOnboarding(token, employeeId) {
    const result = await HttpClient.post("/business-employees/stripe-connect/onboard", { businessEmployeeId: employeeId }, { token });

    if (result.success === false) {
      return { success: false, error: result.error || "Failed to start onboarding" };
    }

    return { success: true, ...result };
  }

  /**
   * Get Stripe Connect status for an employee
   */
  static async getEmployeeStripeStatus(token, employeeId) {
    const result = await HttpClient.get(`/business-employees/stripe-connect/status?businessEmployeeId=${employeeId}`, { token });

    if (result.success === false) {
      if (__DEV__) console.warn("[BusinessOwner] getEmployeeStripeStatus failed:", result.error);
      return { hasAccount: false, onboarded: false, payoutsEnabled: false };
    }

    return result;
  }

  /**
   * Update an employee's payout method (per-employee setting)
   */
  static async updateEmployeePaymentMethod(token, employeeId, paymentMethod) {
    const result = await HttpClient.put(`/business-owner/employees/${employeeId}`, { paymentMethod }, { token });

    if (result.success === false) {
      return { success: false, error: result.error || "Failed to update payment method" };
    }

    return { success: true, employee: result.employee };
  }
}

export default BusinessOwnerService;
