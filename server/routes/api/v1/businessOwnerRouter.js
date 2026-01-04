const express = require("express");
const router = express.Router();
const verifyBusinessOwner = require("../../../middleware/verifyBusinessOwner");
const BusinessEmployeeService = require("../../../services/BusinessEmployeeService");
const EmployeeJobAssignmentService = require("../../../services/EmployeeJobAssignmentService");
const PayCalculatorService = require("../../../services/PayCalculatorService");
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

module.exports = router;
