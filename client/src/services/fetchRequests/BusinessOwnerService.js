/**
 * BusinessOwnerService - Client-side service for business owner API calls
 * Handles employee management, job assignments, dashboard, and payouts
 */

import { API_BASE } from "../config";

class BusinessOwnerService {
  // =====================
  // EMPLOYEE MANAGEMENT
  // =====================

  /**
   * Get all employees for the business owner
   * @param {string} token - Auth token
   * @param {string} status - Optional status filter ('pending_invite', 'active', 'inactive', 'terminated')
   * @returns {Object} { employees }
   */
  static async getEmployees(token, status = null) {
    try {
      const url = status
        ? `${API_BASE}/business-owner/employees?status=${status}`
        : `${API_BASE}/business-owner/employees`;
      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      return await response.json();
    } catch (error) {
      console.error("[BusinessOwner] Error fetching employees:", error);
      return { employees: [] };
    }
  }

  /**
   * Invite a new employee
   * @param {string} token - Auth token
   * @param {Object} employeeData - Employee information
   * @returns {Object} { success, employee, error }
   */
  static async inviteEmployee(token, employeeData) {
    try {
      const response = await fetch(`${API_BASE}/business-owner/employees/invite`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(employeeData),
      });
      const result = await response.json();
      if (!response.ok) {
        return { success: false, error: result.error || "Failed to send invitation" };
      }
      return { success: true, employee: result.employee };
    } catch (error) {
      console.error("[BusinessOwner] Error inviting employee:", error);
      return { success: false, error: "Network error. Please try again." };
    }
  }

  /**
   * Get a specific employee
   * @param {string} token - Auth token
   * @param {number} employeeId - BusinessEmployee ID
   * @returns {Object} { employee }
   */
  static async getEmployee(token, employeeId) {
    try {
      const response = await fetch(`${API_BASE}/business-owner/employees/${employeeId}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      return await response.json();
    } catch (error) {
      console.error("[BusinessOwner] Error fetching employee:", error);
      return null;
    }
  }

  /**
   * Update an employee
   * @param {string} token - Auth token
   * @param {number} employeeId - BusinessEmployee ID
   * @param {Object} updates - Fields to update
   * @returns {Object} { success, employee, error }
   */
  static async updateEmployee(token, employeeId, updates) {
    try {
      const response = await fetch(`${API_BASE}/business-owner/employees/${employeeId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(updates),
      });
      const result = await response.json();
      if (!response.ok) {
        return { success: false, error: result.error || "Failed to update employee" };
      }
      return { success: true, employee: result.employee };
    } catch (error) {
      console.error("[BusinessOwner] Error updating employee:", error);
      return { success: false, error: "Network error. Please try again." };
    }
  }

  /**
   * Terminate an employee
   * @param {string} token - Auth token
   * @param {number} employeeId - BusinessEmployee ID
   * @param {string} reason - Termination reason
   * @returns {Object} { success, error }
   */
  static async terminateEmployee(token, employeeId, reason = "") {
    try {
      const response = await fetch(`${API_BASE}/business-owner/employees/${employeeId}`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ reason }),
      });
      const result = await response.json();
      if (!response.ok) {
        return { success: false, error: result.error || "Failed to terminate employee" };
      }
      return { success: true, message: result.message };
    } catch (error) {
      console.error("[BusinessOwner] Error terminating employee:", error);
      return { success: false, error: "Network error. Please try again." };
    }
  }

  /**
   * Reactivate a terminated employee
   * @param {string} token - Auth token
   * @param {number} employeeId - BusinessEmployee ID
   * @returns {Object} { success, employee, error }
   */
  static async reactivateEmployee(token, employeeId) {
    try {
      const response = await fetch(`${API_BASE}/business-owner/employees/${employeeId}/reactivate`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      const result = await response.json();
      if (!response.ok) {
        return { success: false, error: result.error || "Failed to reactivate employee" };
      }
      return { success: true, employee: result.employee };
    } catch (error) {
      console.error("[BusinessOwner] Error reactivating employee:", error);
      return { success: false, error: "Network error. Please try again." };
    }
  }

  /**
   * Update employee availability schedule
   * @param {string} token - Auth token
   * @param {number} employeeId - BusinessEmployee ID
   * @param {Object} availabilityData - { schedule, defaultJobTypes, maxJobsPerDay }
   * @returns {Object} { success, employee, error }
   */
  static async updateAvailability(token, employeeId, availabilityData) {
    try {
      const response = await fetch(`${API_BASE}/business-owner/employees/${employeeId}/availability`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(availabilityData),
      });
      const result = await response.json();
      if (!response.ok) {
        return { success: false, error: result.error || "Failed to update availability" };
      }
      return { success: true, employee: result.employee };
    } catch (error) {
      console.error("[BusinessOwner] Error updating availability:", error);
      return { success: false, error: "Network error. Please try again." };
    }
  }

  /**
   * Get available employees for a specific date/time
   * @param {string} token - Auth token
   * @param {string} date - Date (YYYY-MM-DD)
   * @param {string} startTime - Start time (HH:MM)
   * @param {string} jobType - Optional job type
   * @returns {Object} { employees }
   */
  static async getAvailableEmployees(token, date, startTime = null, jobType = null) {
    try {
      const params = new URLSearchParams({ date });
      if (startTime) params.append("startTime", startTime);
      if (jobType) params.append("jobType", jobType);

      const response = await fetch(`${API_BASE}/business-owner/employees/available?${params}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      return await response.json();
    } catch (error) {
      console.error("[BusinessOwner] Error fetching available employees:", error);
      return { employees: [] };
    }
  }

  /**
   * Resend invitation email to an employee
   * @param {string} token - Auth token
   * @param {number} employeeId - BusinessEmployee ID
   * @returns {Object} { success, error }
   */
  static async resendInvite(token, employeeId) {
    try {
      const response = await fetch(`${API_BASE}/business-owner/employees/${employeeId}/resend-invite`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      const result = await response.json();
      if (!response.ok) {
        return { success: false, error: result.error || "Failed to resend invitation" };
      }
      return { success: true, message: result.message };
    } catch (error) {
      console.error("[BusinessOwner] Error resending invite:", error);
      return { success: false, error: "Network error. Please try again." };
    }
  }

  // =====================
  // JOB ASSIGNMENTS
  // =====================

  /**
   * Get job assignments with optional filters
   * @param {string} token - Auth token
   * @param {Object} filters - { employeeId, status, startDate, endDate }
   * @returns {Object} { assignments }
   */
  static async getAssignments(token, filters = {}) {
    try {
      const params = new URLSearchParams();
      if (filters.employeeId) params.append("employeeId", filters.employeeId);
      if (filters.status) params.append("status", filters.status);
      if (filters.startDate) params.append("startDate", filters.startDate);
      if (filters.endDate) params.append("endDate", filters.endDate);

      const url = `${API_BASE}/business-owner/assignments${params.toString() ? `?${params}` : ""}`;
      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      return await response.json();
    } catch (error) {
      console.error("[BusinessOwner] Error fetching assignments:", error);
      return { assignments: [] };
    }
  }

  /**
   * Assign an employee to a job
   * @param {string} token - Auth token
   * @param {Object} assignmentData - { appointmentId, employeeId, payAmount, payType }
   * @returns {Object} { success, assignment, error }
   */
  static async assignEmployee(token, assignmentData) {
    try {
      const response = await fetch(`${API_BASE}/business-owner/assignments`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(assignmentData),
      });
      const result = await response.json();
      if (!response.ok) {
        return { success: false, error: result.error || "Failed to assign employee" };
      }
      return { success: true, assignment: result.assignment };
    } catch (error) {
      console.error("[BusinessOwner] Error assigning employee:", error);
      return { success: false, error: "Network error. Please try again." };
    }
  }

  /**
   * Self-assign business owner to a job (tracked as $0 payroll)
   * @param {string} token - Auth token
   * @param {number} appointmentId - Appointment ID
   * @returns {Object} { success, assignment, error }
   */
  static async selfAssign(token, appointmentId) {
    try {
      const response = await fetch(`${API_BASE}/business-owner/self-assign/${appointmentId}`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      const result = await response.json();
      if (!response.ok) {
        return { success: false, error: result.error || "Failed to self-assign" };
      }
      return { success: true, assignment: result.assignment };
    } catch (error) {
      console.error("[BusinessOwner] Error self-assigning:", error);
      return { success: false, error: "Network error. Please try again." };
    }
  }

  /**
   * Unassign an employee from a job
   * @param {string} token - Auth token
   * @param {number} assignmentId - Assignment ID
   * @returns {Object} { success, error }
   */
  static async unassignJob(token, assignmentId) {
    try {
      const response = await fetch(`${API_BASE}/business-owner/assignments/${assignmentId}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      const result = await response.json();
      if (!response.ok) {
        return { success: false, error: result.error || "Failed to unassign job" };
      }
      return { success: true, message: result.message };
    } catch (error) {
      console.error("[BusinessOwner] Error unassigning job:", error);
      return { success: false, error: "Network error. Please try again." };
    }
  }

  /**
   * Reassign a job to a different employee
   * @param {string} token - Auth token
   * @param {number} assignmentId - Assignment ID
   * @param {number} newEmployeeId - New employee ID
   * @returns {Object} { success, assignment, error }
   */
  static async reassignJob(token, assignmentId, newEmployeeId) {
    try {
      const response = await fetch(`${API_BASE}/business-owner/assignments/${assignmentId}/reassign`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ newEmployeeId }),
      });
      const result = await response.json();
      if (!response.ok) {
        return { success: false, error: result.error || "Failed to reassign job" };
      }
      return { success: true, assignment: result.assignment };
    } catch (error) {
      console.error("[BusinessOwner] Error reassigning job:", error);
      return { success: false, error: "Network error. Please try again." };
    }
  }

  /**
   * Update job pay for an assignment
   * @param {string} token - Auth token
   * @param {number} assignmentId - Assignment ID
   * @param {Object} payData - { payAmount, reason }
   * @returns {Object} { success, assignment, changeLog, error }
   */
  static async updateJobPay(token, assignmentId, payData) {
    try {
      const response = await fetch(`${API_BASE}/business-owner/assignments/${assignmentId}/pay`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payData),
      });
      const result = await response.json();
      if (!response.ok) {
        return { success: false, error: result.error || "Failed to update pay" };
      }
      return { success: true, assignment: result.assignment, changeLog: result.changeLog };
    } catch (error) {
      console.error("[BusinessOwner] Error updating job pay:", error);
      return { success: false, error: "Network error. Please try again." };
    }
  }

  /**
   * Get pay change history for an assignment
   * @param {string} token - Auth token
   * @param {number} assignmentId - Assignment ID
   * @returns {Object} { changeLog }
   */
  static async getPayHistory(token, assignmentId) {
    try {
      const response = await fetch(`${API_BASE}/business-owner/assignments/${assignmentId}/pay-history`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      return await response.json();
    } catch (error) {
      console.error("[BusinessOwner] Error fetching pay history:", error);
      return { changeLog: [] };
    }
  }

  // =====================
  // DASHBOARD & REPORTS
  // =====================

  /**
   * Get dashboard overview data
   * @param {string} token - Auth token
   * @returns {Object} { overview, employees, recentActivity }
   */
  static async getDashboard(token) {
    try {
      const response = await fetch(`${API_BASE}/business-owner/dashboard`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      return await response.json();
    } catch (error) {
      console.error("[BusinessOwner] Error fetching dashboard:", error);
      return { overview: {}, employees: [], recentActivity: [] };
    }
  }

  /**
   * Get calendar data for a specific month
   * @param {string} token - Auth token
   * @param {number} month - Month (1-12)
   * @param {number} year - Year
   * @returns {Object} { assignments, employees, unassignedJobs }
   */
  static async getCalendar(token, month, year) {
    try {
      const response = await fetch(`${API_BASE}/business-owner/calendar?month=${month}&year=${year}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      return await response.json();
    } catch (error) {
      console.error("[BusinessOwner] Error fetching calendar:", error);
      return { assignments: [], employees: [], unassignedJobs: [] };
    }
  }

  /**
   * Get financial report
   * @param {string} token - Auth token
   * @param {string} startDate - Start date (YYYY-MM-DD)
   * @param {string} endDate - End date (YYYY-MM-DD)
   * @returns {Object} { summary, byEmployee, byJob }
   */
  static async getFinancials(token, startDate, endDate) {
    try {
      const response = await fetch(
        `${API_BASE}/business-owner/financials?startDate=${startDate}&endDate=${endDate}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );
      return await response.json();
    } catch (error) {
      console.error("[BusinessOwner] Error fetching financials:", error);
      return { summary: {}, byEmployee: [], byJob: [] };
    }
  }

  /**
   * Get payroll summary
   * @param {string} token - Auth token
   * @param {string} period - Period ('week', 'month', 'quarter', 'year')
   * @returns {Object} { payroll }
   */
  static async getPayrollSummary(token, period = "month") {
    try {
      const response = await fetch(`${API_BASE}/business-owner/payroll-summary?period=${period}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      return await response.json();
    } catch (error) {
      console.error("[BusinessOwner] Error fetching payroll summary:", error);
      return { payroll: {} };
    }
  }

  // =====================
  // PAYOUTS
  // =====================

  /**
   * Get pending payouts
   * @param {string} token - Auth token
   * @returns {Object} { pendingPayouts, totalAmount, byEmployee }
   */
  static async getPendingPayouts(token) {
    try {
      const response = await fetch(`${API_BASE}/business-owner/payouts/pending`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      return await response.json();
    } catch (error) {
      console.error("[BusinessOwner] Error fetching pending payouts:", error);
      return { pendingPayouts: [], totalAmount: 0, byEmployee: [] };
    }
  }

  /**
   * Mark an assignment as paid outside the platform
   * @param {string} token - Auth token
   * @param {number} assignmentId - Assignment ID
   * @param {string} note - Optional note about the payment
   * @returns {Object} { success, assignment, error }
   */
  static async markPaidOutsidePlatform(token, assignmentId, note = "") {
    try {
      const response = await fetch(`${API_BASE}/business-owner/payouts/${assignmentId}/mark-paid-outside`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ note }),
      });
      const result = await response.json();
      if (!response.ok) {
        return { success: false, error: result.error || "Failed to mark as paid" };
      }
      return { success: true, assignment: result.assignment };
    } catch (error) {
      console.error("[BusinessOwner] Error marking paid outside:", error);
      return { success: false, error: "Network error. Please try again." };
    }
  }

  /**
   * Process multiple payouts at once
   * @param {string} token - Auth token
   * @param {Array<number>} assignmentIds - Array of assignment IDs to process
   * @returns {Object} { success, processed, errors }
   */
  static async processBatchPayouts(token, assignmentIds) {
    try {
      const response = await fetch(`${API_BASE}/business-owner/payouts/batch`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ assignmentIds }),
      });
      const result = await response.json();
      if (!response.ok) {
        return { success: false, error: result.error || "Failed to process payouts" };
      }
      return { success: true, processed: result.processed };
    } catch (error) {
      console.error("[BusinessOwner] Error processing batch payouts:", error);
      return { success: false, error: "Network error. Please try again." };
    }
  }

  // =====================
  // PAY CALCULATOR (local)
  // =====================

  /**
   * Calculate job financials locally (preview before saving)
   * @param {number} customerPays - Total customer payment in cents
   * @param {number} employeePay - Employee pay in cents
   * @param {number} platformFeePercent - Platform fee percentage (default 10)
   * @returns {Object} { customerPays, platformFee, employeePay, businessOwnerProfit, profitMargin, warnings }
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
   * @param {number} customerPays - Total customer payment in cents
   * @param {number} platformFeePercent - Platform fee percentage (default 10)
   * @returns {Object} { margin20, margin35, margin50 }
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
}

export default BusinessOwnerService;
