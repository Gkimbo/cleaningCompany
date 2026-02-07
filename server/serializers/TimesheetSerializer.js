/**
 * TimesheetSerializer
 * Serializes timesheet and employee hours data for API responses
 */

const EncryptionService = require("../services/EncryptionService");

class TimesheetSerializer {
  static decryptField(value) {
    if (!value) return null;
    return EncryptionService.decrypt(value);
  }

  /**
   * Serialize timesheet data (summary of all employees' hours)
   * @param {Object} timesheetData - Timesheet data from service
   * @returns {Object} Serialized timesheet data
   */
  static serializeTimesheetData(timesheetData) {
    if (!timesheetData) return null;

    return {
      startDate: timesheetData.startDate,
      endDate: timesheetData.endDate,
      totalHours: timesheetData.totalHours,
      totalPay: timesheetData.totalPay,
      formattedTotalPay: `$${(timesheetData.totalPay / 100).toFixed(2)}`,
      employeeCount: timesheetData.employeeCount,
      jobCount: timesheetData.jobCount,
      employees: timesheetData.employees?.map(emp => this.serializeEmployeeSummary(emp)) || [],
    };
  }

  /**
   * Serialize individual employee summary within timesheet
   * @param {Object} employeeSummary - Employee summary data
   * @returns {Object} Serialized employee summary
   */
  static serializeEmployeeSummary(employeeSummary) {
    if (!employeeSummary) return null;

    const employee = employeeSummary.employee;
    const employeeData = employee?.dataValues || employee;

    return {
      employee: employeeData ? {
        id: employeeData.id,
        firstName: this.decryptField(employeeData.firstName),
        lastName: this.decryptField(employeeData.lastName),
        payType: employeeData.payType,
        hourlyRate: employeeData.defaultHourlyRate,
        formattedHourlyRate: employeeData.defaultHourlyRate
          ? `$${(employeeData.defaultHourlyRate / 100).toFixed(2)}/hr`
          : null,
      } : null,
      totalHours: employeeSummary.totalHours,
      totalPay: employeeSummary.totalPay,
      formattedTotalPay: `$${(employeeSummary.totalPay / 100).toFixed(2)}`,
      jobCount: employeeSummary.jobCount,
      jobs: employeeSummary.jobs?.map(job => this.serializeTimesheetJob(job)) || [],
    };
  }

  /**
   * Serialize individual job within timesheet
   * @param {Object} job - Job data
   * @returns {Object} Serialized job
   */
  static serializeTimesheetJob(job) {
    if (!job) return null;

    return {
      id: job.id,
      date: job.date,
      hoursWorked: job.hoursWorked,
      payAmount: job.payAmount,
      formattedPay: `$${(job.payAmount / 100).toFixed(2)}`,
      payType: job.payType,
      startedAt: job.startedAt,
      completedAt: job.completedAt,
      address: job.address,
    };
  }

  /**
   * Serialize employee hours detail
   * @param {Object} hoursDetail - Hours detail from service
   * @returns {Object} Serialized hours detail
   */
  static serializeEmployeeHoursDetail(hoursDetail) {
    if (!hoursDetail) return null;

    const employee = hoursDetail.employee;

    return {
      employee: {
        id: employee.id,
        firstName: this.decryptField(employee.firstName),
        lastName: this.decryptField(employee.lastName),
        payType: employee.payType,
        hourlyRate: employee.hourlyRate,
        formattedHourlyRate: employee.hourlyRate
          ? `$${(employee.hourlyRate / 100).toFixed(2)}/hr`
          : null,
        jobRate: employee.jobRate,
        formattedJobRate: employee.jobRate
          ? `$${(employee.jobRate / 100).toFixed(2)}/job`
          : null,
      },
      startDate: hoursDetail.startDate,
      endDate: hoursDetail.endDate,
      totalHours: hoursDetail.totalHours,
      totalPay: hoursDetail.totalPay,
      formattedTotalPay: `$${(hoursDetail.totalPay / 100).toFixed(2)}`,
      completedJobs: hoursDetail.completedJobs,
      pendingJobs: hoursDetail.pendingJobs,
      dailyBreakdown: hoursDetail.dailyBreakdown?.map(day => this.serializeDailyBreakdown(day)) || [],
      weeklyTotals: hoursDetail.weeklyTotals?.map(week => this.serializeWeeklyTotal(week)) || [],
    };
  }

  /**
   * Serialize daily breakdown entry
   * @param {Object} day - Daily breakdown data
   * @returns {Object} Serialized daily breakdown
   */
  static serializeDailyBreakdown(day) {
    if (!day) return null;

    return {
      date: day.date,
      hours: day.hours,
      pay: day.pay,
      formattedPay: `$${(day.pay / 100).toFixed(2)}`,
      jobs: day.jobs?.map(job => ({
        id: job.id,
        status: job.status,
        hoursWorked: job.hoursWorked,
        payAmount: job.payAmount,
        formattedPay: `$${(job.payAmount / 100).toFixed(2)}`,
        payType: job.payType,
        startedAt: job.startedAt,
        completedAt: job.completedAt,
        address: job.address,
        client: job.client,
        home: job.home,
      })) || [],
    };
  }

  /**
   * Serialize weekly total entry
   * @param {Object} week - Weekly total data
   * @returns {Object} Serialized weekly total
   */
  static serializeWeeklyTotal(week) {
    if (!week) return null;

    return {
      weekStart: week.weekStart,
      weekEnd: week.weekEnd,
      hours: week.hours,
      pay: week.pay,
      formattedPay: `$${(week.pay / 100).toFixed(2)}`,
      jobCount: week.jobCount,
    };
  }
}

module.exports = TimesheetSerializer;
