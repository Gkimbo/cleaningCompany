const express = require("express");
const router = express.Router();
const verifyBusinessOwner = require("../../../middleware/verifyBusinessOwner");
const BusinessEmployeeService = require("../../../services/BusinessEmployeeService");
const EmployeeJobAssignmentService = require("../../../services/EmployeeJobAssignmentService");
const BusinessAnalyticsService = require("../../../services/BusinessAnalyticsService");
const BusinessVerificationService = require("../../../services/BusinessVerificationService");
const PayCalculatorService = require("../../../services/PayCalculatorService");
const CustomJobFlowService = require("../../../services/CustomJobFlowService");
const BusinessEmployeeSerializer = require("../../../serializers/BusinessEmployeeSerializer");
const EmployeeJobAssignmentSerializer = require("../../../serializers/EmployeeJobAssignmentSerializer");
const { UserAppointments, UserHomes, User, Payout } = require("../../../models");

// All routes require business owner authentication
router.use(verifyBusinessOwner);

// =====================================
// Employee Management Routes
// =====================================

/**
 * GET /employees - Get all employees for the business owner
 */
router.get("/employees", async (req, res) => {
  try {
    const { status } = req.query;
    const statusFilter = status ? status.split(",") : undefined;

    const employees = await BusinessEmployeeService.getEmployeesByBusinessOwner(
      req.businessOwnerId,
      { status: statusFilter }
    );

    res.json({ employees: BusinessEmployeeSerializer.serializeArray(employees) });
  } catch (error) {
    console.error("Error fetching employees:", error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /employees/invite - Invite a new employee
 */
router.post("/employees/invite", async (req, res) => {
  try {
    const { firstName, lastName, email, phone, defaultHourlyRate, paymentMethod, notes } = req.body;

    if (!firstName || !lastName || !email) {
      return res.status(400).json({ error: "First name, last name, and email are required" });
    }

    const employee = await BusinessEmployeeService.inviteEmployee(req.businessOwnerId, {
      firstName,
      lastName,
      email,
      phone,
      defaultHourlyRate,
      paymentMethod,
      notes,
    });

    // TODO: Send invitation email

    res.status(201).json({
      message: "Invitation sent successfully",
      employee,
    });
  } catch (error) {
    console.error("Error inviting employee:", error);
    res.status(400).json({ error: error.message });
  }
});

/**
 * GET /employees/available - Get employees available for a specific job
 * NOTE: This must be defined BEFORE /employees/:employeeId to avoid route conflicts
 */
router.get("/employees/available", async (req, res) => {
  try {
    const { date, startTime, jobType } = req.query;

    if (!date) {
      return res.status(400).json({ error: "Date is required" });
    }

    const employees = await BusinessEmployeeService.getAvailableEmployees(
      req.businessOwnerId,
      date,
      startTime || null,
      jobType || null
    );

    res.json({ employees: BusinessEmployeeSerializer.serializeArray(employees) });
  } catch (error) {
    console.error("Error fetching available employees:", error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /employees/:employeeId - Get a single employee
 */
router.get("/employees/:employeeId", async (req, res) => {
  try {
    const employee = await BusinessEmployeeService.getEmployeeById(
      parseInt(req.params.employeeId),
      req.businessOwnerId
    );

    if (!employee) {
      return res.status(404).json({ error: "Employee not found" });
    }

    res.json({ employee: BusinessEmployeeSerializer.serializeOne(employee, { includeAssignments: true }) });
  } catch (error) {
    console.error("Error fetching employee:", error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * PUT /employees/:employeeId - Update an employee
 */
router.put("/employees/:employeeId", async (req, res) => {
  try {
    const employee = await BusinessEmployeeService.updateEmployee(
      parseInt(req.params.employeeId),
      req.businessOwnerId,
      req.body
    );

    res.json({ message: "Employee updated", employee: BusinessEmployeeSerializer.serializeOne(employee) });
  } catch (error) {
    console.error("Error updating employee:", error);
    res.status(400).json({ error: error.message });
  }
});

/**
 * DELETE /employees/:employeeId - Terminate an employee
 */
router.delete("/employees/:employeeId", async (req, res) => {
  try {
    const { reason } = req.body;

    const employee = await BusinessEmployeeService.terminateEmployee(
      parseInt(req.params.employeeId),
      req.businessOwnerId,
      reason
    );

    res.json({ message: "Employee terminated", employee: BusinessEmployeeSerializer.serializeOne(employee) });
  } catch (error) {
    console.error("Error terminating employee:", error);
    res.status(400).json({ error: error.message });
  }
});

/**
 * POST /employees/:employeeId/reactivate - Reactivate a terminated employee
 */
router.post("/employees/:employeeId/reactivate", async (req, res) => {
  try {
    const employee = await BusinessEmployeeService.reactivateEmployee(
      parseInt(req.params.employeeId),
      req.businessOwnerId
    );

    res.json({ message: "Employee reactivated", employee: BusinessEmployeeSerializer.serializeOne(employee) });
  } catch (error) {
    console.error("Error reactivating employee:", error);
    res.status(400).json({ error: error.message });
  }
});

/**
 * POST /employees/:employeeId/resend-invite - Resend invitation
 */
router.post("/employees/:employeeId/resend-invite", async (req, res) => {
  try {
    const employee = await BusinessEmployeeService.resendInvite(
      parseInt(req.params.employeeId),
      req.businessOwnerId
    );

    // TODO: Send invitation email

    res.json({ message: "Invitation resent", employee: BusinessEmployeeSerializer.serializeOne(employee) });
  } catch (error) {
    console.error("Error resending invite:", error);
    res.status(400).json({ error: error.message });
  }
});

/**
 * PUT /employees/:employeeId/availability - Update employee availability schedule
 */
router.put("/employees/:employeeId/availability", async (req, res) => {
  try {
    const { schedule, defaultJobTypes, maxJobsPerDay } = req.body;
    const employeeId = parseInt(req.params.employeeId);

    // Update availability schedule if provided
    if (schedule) {
      await BusinessEmployeeService.updateAvailability(
        employeeId,
        req.businessOwnerId,
        schedule
      );
    }

    // Update job types and max jobs if provided
    const updates = {};
    if (defaultJobTypes !== undefined) {
      updates.defaultJobTypes = defaultJobTypes;
    }
    if (maxJobsPerDay !== undefined) {
      updates.maxJobsPerDay = maxJobsPerDay;
    }

    if (Object.keys(updates).length > 0) {
      await BusinessEmployeeService.updateEmployee(
        employeeId,
        req.businessOwnerId,
        updates
      );
    }

    const employee = await BusinessEmployeeService.getEmployeeById(
      employeeId,
      req.businessOwnerId
    );

    res.json({ message: "Availability updated", employee: BusinessEmployeeSerializer.serializeOne(employee) });
  } catch (error) {
    console.error("Error updating availability:", error);
    res.status(400).json({ error: error.message });
  }
});

// =====================================
// Job Assignment Routes
// =====================================

/**
 * GET /assignments - Get all assignments
 */
router.get("/assignments", async (req, res) => {
  try {
    const { startDate, endDate, status } = req.query;

    const start = startDate || new Date().toISOString().split("T")[0];
    const end = endDate || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];

    const assignments = await EmployeeJobAssignmentService.getUpcomingAssignments(
      req.businessOwnerId,
      start,
      end
    );

    res.json({ assignments: EmployeeJobAssignmentSerializer.serializeArray(assignments) });
  } catch (error) {
    console.error("Error fetching assignments:", error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /assignments - Assign an employee to a job
 */
router.post("/assignments", async (req, res) => {
  try {
    const { employeeId, appointmentId, payAmount, payType } = req.body;

    if (!employeeId || !appointmentId) {
      return res.status(400).json({ error: "Employee ID and appointment ID are required" });
    }

    const assignment = await EmployeeJobAssignmentService.assignEmployeeToJob(
      req.businessOwnerId,
      { employeeId, appointmentId, payAmount: payAmount || 0, payType }
    );

    res.status(201).json({ message: "Employee assigned", assignment });
  } catch (error) {
    console.error("Error assigning employee:", error);
    res.status(400).json({ error: error.message });
  }
});

/**
 * DELETE /assignments/:assignmentId - Unassign from job
 */
router.delete("/assignments/:assignmentId", async (req, res) => {
  try {
    await EmployeeJobAssignmentService.unassignFromJob(
      parseInt(req.params.assignmentId),
      req.businessOwnerId
    );

    res.json({ message: "Assignment removed" });
  } catch (error) {
    console.error("Error removing assignment:", error);
    res.status(400).json({ error: error.message });
  }
});

/**
 * POST /assignments/:assignmentId/reassign - Reassign to different employee
 */
router.post("/assignments/:assignmentId/reassign", async (req, res) => {
  try {
    const { newEmployeeId } = req.body;

    if (!newEmployeeId) {
      return res.status(400).json({ error: "New employee ID is required" });
    }

    const assignment = await EmployeeJobAssignmentService.reassignJob(
      parseInt(req.params.assignmentId),
      newEmployeeId,
      req.businessOwnerId
    );

    res.json({ message: "Job reassigned", assignment });
  } catch (error) {
    console.error("Error reassigning job:", error);
    res.status(400).json({ error: error.message });
  }
});

/**
 * POST /self-assign/:appointmentId - Self-assign to a job
 */
router.post("/self-assign/:appointmentId", async (req, res) => {
  try {
    const assignment = await EmployeeJobAssignmentService.assignSelfToJob(
      req.businessOwnerId,
      parseInt(req.params.appointmentId)
    );

    res.status(201).json({ message: "Self-assigned to job", assignment });
  } catch (error) {
    console.error("Error self-assigning:", error);
    res.status(400).json({ error: error.message });
  }
});

// =====================================
// Pay Management Routes
// =====================================

/**
 * PUT /assignments/:assignmentId/pay - Update pay for assignment
 */
router.put("/assignments/:assignmentId/pay", async (req, res) => {
  try {
    const { newPayAmount, reason } = req.body;

    if (newPayAmount === undefined || newPayAmount === null) {
      return res.status(400).json({ error: "New pay amount is required" });
    }

    const assignment = await EmployeeJobAssignmentService.updateJobPay(
      parseInt(req.params.assignmentId),
      req.businessOwnerId,
      { newPayAmount, reason }
    );

    res.json({ message: "Pay updated", assignment });
  } catch (error) {
    console.error("Error updating pay:", error);
    res.status(400).json({ error: error.message });
  }
});

/**
 * GET /assignments/:assignmentId/pay-history - Get pay change history
 */
router.get("/assignments/:assignmentId/pay-history", async (req, res) => {
  try {
    const history = await EmployeeJobAssignmentService.getPayChangeHistory(
      parseInt(req.params.assignmentId)
    );

    res.json({ history: EmployeeJobAssignmentSerializer.serializePayHistoryArray(history) });
  } catch (error) {
    console.error("Error fetching pay history:", error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /calculate-pay - Calculate job financials
 */
router.post("/calculate-pay", async (req, res) => {
  try {
    const { appointmentId, employeePayAmount } = req.body;

    const appointment = await UserAppointments.findByPk(appointmentId);
    if (!appointment) {
      return res.status(404).json({ error: "Appointment not found" });
    }

    const financials = await PayCalculatorService.calculateJobFinancials(
      appointment,
      employeePayAmount || 0
    );

    res.json(financials);
  } catch (error) {
    console.error("Error calculating pay:", error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /validate-pay - Validate a pay amount
 */
router.post("/validate-pay", async (req, res) => {
  try {
    const { employeePayAmount, jobTotal } = req.body;

    const validation = await PayCalculatorService.validatePayAmount(
      employeePayAmount,
      jobTotal
    );

    res.json(validation);
  } catch (error) {
    console.error("Error validating pay:", error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /suggested-pay/:appointmentId - Get suggested pay amounts
 */
router.get("/suggested-pay/:appointmentId", async (req, res) => {
  try {
    const appointment = await UserAppointments.findByPk(req.params.appointmentId, {
      include: [{ model: UserHomes, as: "home" }],
    });

    if (!appointment) {
      return res.status(404).json({ error: "Appointment not found" });
    }

    const suggestions = await PayCalculatorService.calculateSuggestedPay(appointment);

    res.json(suggestions);
  } catch (error) {
    console.error("Error getting suggested pay:", error);
    res.status(500).json({ error: error.message });
  }
});

// =====================================
// Dashboard & Reports Routes
// =====================================

/**
 * GET /dashboard - Get dashboard overview
 */
router.get("/dashboard", async (req, res) => {
  try {
    const today = new Date().toISOString().split("T")[0];
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
    const thirtyDaysFromNow = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];

    const [employeeStats, financials, upcomingAssignments, unpaidAssignments] = await Promise.all([
      BusinessEmployeeService.getEmployeeStats(req.businessOwnerId),
      PayCalculatorService.getFinancialSummary(req.businessOwnerId, thirtyDaysAgo, today),
      EmployeeJobAssignmentService.getUpcomingAssignments(req.businessOwnerId, today, thirtyDaysFromNow),
      EmployeeJobAssignmentService.getUnpaidAssignments(req.businessOwnerId),
    ]);

    res.json({
      employeeStats,
      financials,
      upcomingJobCount: upcomingAssignments.length,
      unpaidPayrollCount: unpaidAssignments.length,
      unpaidPayrollTotal: unpaidAssignments.reduce((sum, a) => sum + a.payAmount, 0),
    });
  } catch (error) {
    console.error("Error fetching dashboard:", error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /calendar - Get calendar data
 */
router.get("/calendar", async (req, res) => {
  try {
    const { month, year } = req.query;
    const now = new Date();
    const targetMonth = month ? parseInt(month) - 1 : now.getMonth();
    const targetYear = year ? parseInt(year) : now.getFullYear();

    const startDate = new Date(targetYear, targetMonth, 1).toISOString().split("T")[0];
    const endDate = new Date(targetYear, targetMonth + 1, 0).toISOString().split("T")[0];

    const assignments = await EmployeeJobAssignmentService.getUpcomingAssignments(
      req.businessOwnerId,
      startDate,
      endDate
    );

    // Group by date
    const calendarData = {};
    for (const assignment of assignments) {
      const date = assignment.appointment.date;
      if (!calendarData[date]) {
        calendarData[date] = [];
      }
      calendarData[date].push({
        id: assignment.id,
        appointmentId: assignment.appointmentId,
        employeeName: assignment.employee
          ? `${assignment.employee.firstName} ${assignment.employee.lastName}`
          : "Self",
        clientName: assignment.appointment.user
          ? `${assignment.appointment.user.firstName} ${assignment.appointment.user.lastName}`
          : "Unknown",
        address: assignment.appointment.home?.address,
        payAmount: assignment.payAmount,
        isSelfAssignment: assignment.isSelfAssignment,
        status: assignment.status,
      });
    }

    res.json({ calendar: calendarData, month: targetMonth + 1, year: targetYear });
  } catch (error) {
    console.error("Error fetching calendar:", error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /financials - Get financial report
 */
router.get("/financials", async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const now = new Date();
    const start = startDate || new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split("T")[0];
    const end = endDate || now.toISOString().split("T")[0];

    const financials = await PayCalculatorService.getFinancialSummary(
      req.businessOwnerId,
      start,
      end
    );

    res.json(financials);
  } catch (error) {
    console.error("Error fetching financials:", error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /payroll-summary - Get payroll by employee
 */
router.get("/payroll-summary", async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const now = new Date();
    const start = startDate || new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split("T")[0];
    const end = endDate || now.toISOString().split("T")[0];

    const payroll = await PayCalculatorService.getPayrollSummary(
      req.businessOwnerId,
      start,
      end
    );

    res.json({ payroll, period: { startDate: start, endDate: end } });
  } catch (error) {
    console.error("Error fetching payroll summary:", error);
    res.status(500).json({ error: error.message });
  }
});

// =====================================
// Analytics Routes
// Premium analytics available to business owners with 50+ monthly cleanings
// =====================================

/**
 * GET /analytics - Get all analytics (respects tier access)
 */
router.get("/analytics", async (req, res) => {
  try {
    const analytics = await BusinessAnalyticsService.getAllAnalytics(
      req.businessOwnerId,
      {
        months: parseInt(req.query.months) || undefined,
        topClientsLimit: parseInt(req.query.topClientsLimit) || undefined,
        churnDays: parseInt(req.query.churnDays) || undefined,
      }
    );

    res.json(analytics);
  } catch (error) {
    console.error("Error fetching analytics:", error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /analytics/access - Check analytics tier access
 */
router.get("/analytics/access", async (req, res) => {
  try {
    const access = await BusinessAnalyticsService.getAnalyticsAccess(req.businessOwnerId);
    res.json(access);
  } catch (error) {
    console.error("Error checking analytics access:", error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /analytics/overview - Get overview metrics (available to all tiers)
 */
router.get("/analytics/overview", async (req, res) => {
  try {
    const overview = await BusinessAnalyticsService.getOverviewAnalytics(req.businessOwnerId);
    res.json(overview);
  } catch (error) {
    console.error("Error fetching overview analytics:", error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /analytics/employees - Get employee performance analytics (premium)
 */
router.get("/analytics/employees", async (req, res) => {
  try {
    // Check access
    const access = await BusinessAnalyticsService.getAnalyticsAccess(req.businessOwnerId);
    if (!access.features.employeeAnalytics) {
      return res.status(403).json({
        error: "Employee analytics requires premium tier",
        tier: access.tier,
        qualification: access.qualification,
      });
    }

    const employees = await BusinessAnalyticsService.getEmployeeAnalytics(
      req.businessOwnerId,
      {
        months: parseInt(req.query.months) || undefined,
        limit: parseInt(req.query.limit) || undefined,
      }
    );

    res.json(employees);
  } catch (error) {
    console.error("Error fetching employee analytics:", error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /analytics/clients - Get client insights (premium)
 */
router.get("/analytics/clients", async (req, res) => {
  try {
    // Check access
    const access = await BusinessAnalyticsService.getAnalyticsAccess(req.businessOwnerId);
    if (!access.features.clientInsights) {
      return res.status(403).json({
        error: "Client insights requires premium tier",
        tier: access.tier,
        qualification: access.qualification,
      });
    }

    const clients = await BusinessAnalyticsService.getClientAnalytics(
      req.businessOwnerId,
      {
        topClientsLimit: parseInt(req.query.topClientsLimit) || undefined,
        churnDays: parseInt(req.query.churnDays) || undefined,
      }
    );

    res.json(clients);
  } catch (error) {
    console.error("Error fetching client analytics:", error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /analytics/financials - Get financial breakdown (premium)
 */
router.get("/analytics/financials", async (req, res) => {
  try {
    // Check access
    const access = await BusinessAnalyticsService.getAnalyticsAccess(req.businessOwnerId);
    if (!access.features.advancedFinancials) {
      return res.status(403).json({
        error: "Advanced financials requires premium tier",
        tier: access.tier,
        qualification: access.qualification,
      });
    }

    const financials = await BusinessAnalyticsService.getFinancialAnalytics(
      req.businessOwnerId,
      {
        months: parseInt(req.query.months) || undefined,
      }
    );

    res.json(financials);
  } catch (error) {
    console.error("Error fetching financial analytics:", error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /analytics/trends - Get trend data for charts
 */
router.get("/analytics/trends", async (req, res) => {
  try {
    const { period = "monthly", months = 12 } = req.query;

    // Check if premium tier for extended history
    const access = await BusinessAnalyticsService.getAnalyticsAccess(req.businessOwnerId);
    const maxMonths = access.tier === "premium" ? 24 : 6;
    const requestedMonths = Math.min(parseInt(months), maxMonths);

    const trends = await BusinessAnalyticsService.getTrends(
      req.businessOwnerId,
      {
        period,
        months: requestedMonths,
      }
    );

    res.json({
      ...trends,
      access: {
        tier: access.tier,
        maxMonthsAllowed: maxMonths,
      },
    });
  } catch (error) {
    console.error("Error fetching trends:", error);
    res.status(500).json({ error: error.message });
  }
});

// =====================================
// Business Verification Routes
// Verified businesses get marketplace highlighting
// =====================================

/**
 * GET /verification/status - Get current verification status
 */
router.get("/verification/status", async (req, res) => {
  try {
    const status = await BusinessVerificationService.getVerificationStatus(req.businessOwnerId);
    res.json(status);
  } catch (error) {
    console.error("Error fetching verification status:", error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /verification/eligibility - Check if eligible for verification
 */
router.get("/verification/eligibility", async (req, res) => {
  try {
    const eligibility = await BusinessVerificationService.checkVerificationEligibility(
      req.businessOwnerId
    );
    res.json(eligibility);
  } catch (error) {
    console.error("Error checking verification eligibility:", error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /verification/request - Request verification
 */
router.post("/verification/request", async (req, res) => {
  try {
    const result = await BusinessVerificationService.requestVerification(req.businessOwnerId);

    if (!result.success) {
      return res.status(400).json(result);
    }

    res.json(result);
  } catch (error) {
    console.error("Error requesting verification:", error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * PUT /verification/profile - Update business profile for verification
 */
router.put("/verification/profile", async (req, res) => {
  try {
    const { businessDescription, businessHighlightOptIn } = req.body;

    const result = await BusinessVerificationService.updateBusinessProfile(
      req.businessOwnerId,
      { businessDescription, businessHighlightOptIn }
    );

    res.json(result);
  } catch (error) {
    console.error("Error updating business profile:", error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /verification/config - Get verification requirements
 */
router.get("/verification/config", async (req, res) => {
  try {
    const config = BusinessVerificationService.getVerificationConfig();
    res.json(config);
  } catch (error) {
    console.error("Error fetching verification config:", error);
    res.status(500).json({ error: error.message });
  }
});

// =====================================
// Payout Routes
// =====================================

/**
 * GET /payouts/pending - Get pending payouts
 */
router.get("/payouts/pending", async (req, res) => {
  try {
    const unpaidAssignments = await EmployeeJobAssignmentService.getUnpaidAssignments(
      req.businessOwnerId
    );

    res.json({ payouts: EmployeeJobAssignmentSerializer.serializeForPayoutArray(unpaidAssignments) });
  } catch (error) {
    console.error("Error fetching pending payouts:", error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /payouts/:assignmentId/mark-paid-outside - Mark as paid outside platform
 */
router.post("/payouts/:assignmentId/mark-paid-outside", async (req, res) => {
  try {
    const { note } = req.body;
    const { EmployeeJobAssignment } = require("../../../models");

    const assignment = await EmployeeJobAssignment.findOne({
      where: {
        id: parseInt(req.params.assignmentId),
        businessOwnerId: req.businessOwnerId,
        status: "completed",
        payoutStatus: "pending",
      },
    });

    if (!assignment) {
      return res.status(404).json({ error: "Assignment not found or not eligible" });
    }

    await assignment.update({
      payoutStatus: "paid_outside_platform",
      paidOutsidePlatformAt: new Date(),
      paidOutsidePlatformNote: note,
    });

    res.json({ message: "Marked as paid outside platform", assignment });
  } catch (error) {
    console.error("Error marking as paid outside:", error);
    res.status(500).json({ error: error.message });
  }
});

// =====================================
// Custom Job Flow Routes
// =====================================

/**
 * GET /job-flows - List all custom job flows
 */
router.get("/job-flows", async (req, res) => {
  try {
    const { status } = req.query;
    const flows = await CustomJobFlowService.getFlowsByBusinessOwner(
      req.businessOwnerId,
      { status }
    );

    res.json({ flows });
  } catch (error) {
    console.error("Error fetching job flows:", error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /job-flows - Create a new job flow
 */
router.post("/job-flows", async (req, res) => {
  try {
    const { name, description, photoRequirement, jobNotes, isDefault } = req.body;

    if (!name) {
      return res.status(400).json({ error: "Flow name is required" });
    }

    const flow = await CustomJobFlowService.createFlow(req.businessOwnerId, {
      name,
      description,
      photoRequirement,
      jobNotes,
      isDefault,
    });

    res.status(201).json({ message: "Job flow created", flow });
  } catch (error) {
    console.error("Error creating job flow:", error);
    res.status(400).json({ error: error.message });
  }
});

/**
 * GET /job-flows/assignments - List all flow assignments
 */
router.get("/job-flows/assignments", async (req, res) => {
  try {
    const assignments = await CustomJobFlowService.getFlowAssignments(req.businessOwnerId);
    res.json({ assignments });
  } catch (error) {
    console.error("Error fetching flow assignments:", error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /job-flows/:flowId - Get a specific job flow
 */
router.get("/job-flows/:flowId", async (req, res) => {
  try {
    const flow = await CustomJobFlowService.getFlowById(
      parseInt(req.params.flowId),
      req.businessOwnerId
    );

    res.json({ flow });
  } catch (error) {
    console.error("Error fetching job flow:", error);
    res.status(404).json({ error: error.message });
  }
});

/**
 * PUT /job-flows/:flowId - Update a job flow
 */
router.put("/job-flows/:flowId", async (req, res) => {
  try {
    const flow = await CustomJobFlowService.updateFlow(
      parseInt(req.params.flowId),
      req.businessOwnerId,
      req.body
    );

    res.json({ message: "Job flow updated", flow });
  } catch (error) {
    console.error("Error updating job flow:", error);
    res.status(400).json({ error: error.message });
  }
});

/**
 * DELETE /job-flows/:flowId - Archive or delete a job flow
 */
router.delete("/job-flows/:flowId", async (req, res) => {
  try {
    const { permanent } = req.query;

    if (permanent === "true") {
      await CustomJobFlowService.deleteFlow(
        parseInt(req.params.flowId),
        req.businessOwnerId
      );
      res.json({ message: "Job flow deleted permanently" });
    } else {
      const flow = await CustomJobFlowService.archiveFlow(
        parseInt(req.params.flowId),
        req.businessOwnerId
      );
      res.json({ message: "Job flow archived", flow });
    }
  } catch (error) {
    console.error("Error deleting job flow:", error);
    res.status(400).json({ error: error.message });
  }
});

/**
 * POST /job-flows/:flowId/set-default - Set a flow as the default
 */
router.post("/job-flows/:flowId/set-default", async (req, res) => {
  try {
    const flow = await CustomJobFlowService.setDefaultFlow(
      req.businessOwnerId,
      parseInt(req.params.flowId)
    );

    res.json({ message: "Default flow updated", flow });
  } catch (error) {
    console.error("Error setting default flow:", error);
    res.status(400).json({ error: error.message });
  }
});

/**
 * POST /job-flows/clear-default - Clear the default flow
 */
router.post("/job-flows/clear-default", async (req, res) => {
  try {
    await CustomJobFlowService.clearDefaultFlow(req.businessOwnerId);
    res.json({ message: "Default flow cleared" });
  } catch (error) {
    console.error("Error clearing default flow:", error);
    res.status(400).json({ error: error.message });
  }
});

// =====================================
// Job Flow Checklist Routes
// =====================================

/**
 * GET /job-flows/:flowId/checklist - Get the checklist for a flow
 */
router.get("/job-flows/:flowId/checklist", async (req, res) => {
  try {
    const flow = await CustomJobFlowService.getFlowById(
      parseInt(req.params.flowId),
      req.businessOwnerId
    );

    res.json({ checklist: flow.checklist || null });
  } catch (error) {
    console.error("Error fetching checklist:", error);
    res.status(404).json({ error: error.message });
  }
});

/**
 * POST /job-flows/:flowId/checklist - Create a checklist from scratch
 */
router.post("/job-flows/:flowId/checklist", async (req, res) => {
  try {
    const { sections } = req.body;

    if (!sections || !Array.isArray(sections)) {
      return res.status(400).json({ error: "Sections array is required" });
    }

    const checklist = await CustomJobFlowService.createChecklistFromScratch(
      parseInt(req.params.flowId),
      req.businessOwnerId,
      { sections }
    );

    res.status(201).json({ message: "Checklist created", checklist });
  } catch (error) {
    console.error("Error creating checklist:", error);
    res.status(400).json({ error: error.message });
  }
});

/**
 * PUT /job-flows/:flowId/checklist - Update the checklist
 */
router.put("/job-flows/:flowId/checklist", async (req, res) => {
  try {
    const { sections } = req.body;

    if (!sections || !Array.isArray(sections)) {
      return res.status(400).json({ error: "Sections array is required" });
    }

    const checklist = await CustomJobFlowService.updateChecklist(
      parseInt(req.params.flowId),
      req.businessOwnerId,
      { sections }
    );

    res.json({ message: "Checklist updated", checklist });
  } catch (error) {
    console.error("Error updating checklist:", error);
    res.status(400).json({ error: error.message });
  }
});

/**
 * DELETE /job-flows/:flowId/checklist - Delete the checklist
 */
router.delete("/job-flows/:flowId/checklist", async (req, res) => {
  try {
    await CustomJobFlowService.deleteChecklist(
      parseInt(req.params.flowId),
      req.businessOwnerId
    );

    res.json({ message: "Checklist deleted" });
  } catch (error) {
    console.error("Error deleting checklist:", error);
    res.status(400).json({ error: error.message });
  }
});

/**
 * POST /job-flows/:flowId/checklist/fork-platform - Fork platform checklist
 */
router.post("/job-flows/:flowId/checklist/fork-platform", async (req, res) => {
  try {
    const { versionId } = req.body;

    const checklist = await CustomJobFlowService.forkPlatformChecklist(
      parseInt(req.params.flowId),
      req.businessOwnerId,
      versionId
    );

    res.status(201).json({ message: "Platform checklist forked", checklist });
  } catch (error) {
    console.error("Error forking platform checklist:", error);
    res.status(400).json({ error: error.message });
  }
});

/**
 * PUT /job-flows/:flowId/checklist/items/:itemId/notes - Add notes to checklist item
 */
router.put("/job-flows/:flowId/checklist/items/:itemId/notes", async (req, res) => {
  try {
    const { notes } = req.body;

    const checklist = await CustomJobFlowService.addItemNotes(
      parseInt(req.params.flowId),
      req.businessOwnerId,
      req.params.itemId,
      notes
    );

    res.json({ message: "Item notes updated", checklist });
  } catch (error) {
    console.error("Error updating item notes:", error);
    res.status(400).json({ error: error.message });
  }
});

// =====================================
// Flow Assignment Routes
// =====================================

/**
 * POST /job-flows/assignments/client/:clientId - Assign flow to a client
 */
router.post("/job-flows/assignments/client/:clientId", async (req, res) => {
  try {
    const { flowId } = req.body;

    if (!flowId) {
      return res.status(400).json({ error: "Flow ID is required" });
    }

    const assignment = await CustomJobFlowService.assignFlowToClient(
      req.businessOwnerId,
      parseInt(req.params.clientId),
      flowId
    );

    res.status(201).json({ message: "Flow assigned to client", assignment });
  } catch (error) {
    console.error("Error assigning flow to client:", error);
    res.status(400).json({ error: error.message });
  }
});

/**
 * POST /job-flows/assignments/home/:homeId - Assign flow to a home
 */
router.post("/job-flows/assignments/home/:homeId", async (req, res) => {
  try {
    const { flowId } = req.body;

    if (!flowId) {
      return res.status(400).json({ error: "Flow ID is required" });
    }

    const assignment = await CustomJobFlowService.assignFlowToHome(
      req.businessOwnerId,
      parseInt(req.params.homeId),
      flowId
    );

    res.status(201).json({ message: "Flow assigned to home", assignment });
  } catch (error) {
    console.error("Error assigning flow to home:", error);
    res.status(400).json({ error: error.message });
  }
});

/**
 * DELETE /job-flows/assignments/:assignmentId - Remove a flow assignment
 */
router.delete("/job-flows/assignments/:assignmentId", async (req, res) => {
  try {
    await CustomJobFlowService.removeFlowAssignment(
      parseInt(req.params.assignmentId),
      req.businessOwnerId
    );

    res.json({ message: "Flow assignment removed" });
  } catch (error) {
    console.error("Error removing flow assignment:", error);
    res.status(400).json({ error: error.message });
  }
});

module.exports = router;
