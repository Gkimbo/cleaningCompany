const express = require("express");
const router = express.Router();
const verifyBusinessOwner = require("../../../middleware/verifyBusinessOwner");
const BusinessEmployeeService = require("../../../services/BusinessEmployeeService");
const EmployeeJobAssignmentService = require("../../../services/EmployeeJobAssignmentService");
const BusinessAnalyticsService = require("../../../services/BusinessAnalyticsService");
const BusinessVolumeService = require("../../../services/BusinessVolumeService");
const BusinessVerificationService = require("../../../services/BusinessVerificationService");
const PayCalculatorService = require("../../../services/PayCalculatorService");
const CustomJobFlowService = require("../../../services/CustomJobFlowService");
const BusinessEmployeeSerializer = require("../../../serializers/BusinessEmployeeSerializer");
const EmployeeJobAssignmentSerializer = require("../../../serializers/EmployeeJobAssignmentSerializer");
const AppointmentSerializer = require("../../../serializers/AppointmentSerializer");
const CustomJobFlowSerializer = require("../../../serializers/CustomJobFlowSerializer");
const ClientJobFlowAssignmentSerializer = require("../../../serializers/ClientJobFlowAssignmentSerializer");
const CustomJobFlowChecklistSerializer = require("../../../serializers/CustomJobFlowChecklistSerializer");
const TimesheetSerializer = require("../../../serializers/TimesheetSerializer");
const EncryptionService = require("../../../services/EncryptionService");
const { UserAppointments, UserHomes, User, Payout, CleanerClient, sequelize, EmployeeJobAssignment, BusinessEmployee, RecurringSchedule, PricingConfig, UserCleanerAppointments } = require("../../../models");
const { Op } = require("sequelize");

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
 * GET /employees/for-job/:appointmentId - Get employees with calculated pay for a specific job
 * Calculates estimated hours based on home size (beds/baths) and number of cleaners
 * Query params:
 *   - mode: "add" (default) or "reassign" - affects cleaner count calculation
 */
router.get("/employees/for-job/:appointmentId", async (req, res) => {
  try {
    const appointmentId = parseInt(req.params.appointmentId);
    const mode = req.query.mode || "add"; // "add" or "reassign"

    // Get the appointment with home details
    const appointment = await UserAppointments.findByPk(appointmentId, {
      include: [{ model: UserHomes, as: "home" }],
    });
    if (!appointment) {
      return res.status(404).json({ error: "Appointment not found" });
    }

    const jobPriceInCents = appointment.price ? Math.round(parseFloat(appointment.price) * 100) : 0;

    // Get home size for duration estimation
    const numBeds = appointment.home?.numBeds || 2;
    const numBaths = appointment.home?.numBaths || 1;

    // Get existing employees already assigned to this job (with employee details)
    const existingAssignmentRecords = await EmployeeJobAssignment.findAll({
      where: {
        appointmentId,
        status: { [Op.notIn]: ["cancelled", "no_show", "unassigned"] },
      },
      include: [{ model: BusinessEmployee, as: "employee" }],
    });
    const existingAssignments = existingAssignmentRecords.length;

    // Get all active employees
    const employees = await BusinessEmployeeService.getEmployeesByBusinessOwner(
      req.businessOwnerId,
      { status: ["active"] }
    );

    // Calculate total cleaners based on mode:
    // - "add": We're adding a new employee, so count = existing + 1
    // - "reassign": We're replacing an employee, so count stays the same
    const totalCleaners = mode === "reassign"
      ? Math.max(1, existingAssignments)  // Keep same count for reassign
      : existingAssignments + 1;           // Add one for new employee

    const employeesWithPay = employees.map((emp) => {
      const serialized = BusinessEmployeeSerializer.serializeOne(emp);

      // Estimate hours based on home size and number of cleaners
      const estimatedHours = EmployeeJobAssignmentService.estimateJobDuration(
        numBeds,
        numBaths,
        totalCleaners
      );

      // Debug logging for first employee
      if (employees.indexOf(emp) === 0) {
        console.log("[employees-for-job] Pay calculation inputs:", {
          numBeds,
          numBaths,
          totalCleaners,
          estimatedHours,
          jobPriceInCents,
          employeePayType: emp.payType,
          employeeHourlyRate: emp.defaultHourlyRate,
        });
      }

      const { payAmount, payType } = EmployeeJobAssignmentService.calculateEmployeePay(
        emp,
        jobPriceInCents,
        estimatedHours
      );

      return {
        ...serialized,
        calculatedPay: payAmount,
        calculatedPayType: payType,
        formattedCalculatedPay: `$${(payAmount / 100).toFixed(2)}`,
        estimatedHours,
      };
    });

    // Also calculate total job duration (without dividing by cleaners) for display
    const totalJobHours = EmployeeJobAssignmentService.estimateJobDuration(numBeds, numBaths, 1);
    const hoursPerCleaner = EmployeeJobAssignmentService.estimateJobDuration(numBeds, numBaths, totalCleaners);

    // Recalculate pay for existing assigned employees based on new cleaner count
    // This shows what their pay would be with hours split among more cleaners
    let recalculatedExistingPay = 0;
    const recalculatedAssignments = existingAssignmentRecords.map((assignment) => {
      const emp = assignment.employee;
      if (!emp) return null;

      // Serialize employee to decrypt fields
      const serializedEmp = BusinessEmployeeSerializer.serializeOne(emp);

      const { payAmount } = EmployeeJobAssignmentService.calculateEmployeePay(
        emp,
        jobPriceInCents,
        hoursPerCleaner
      );
      recalculatedExistingPay += payAmount;

      return {
        assignmentId: assignment.id,
        employeeId: emp.id,
        employeeName: `${serializedEmp.firstName || ""} ${serializedEmp.lastName || ""}`.trim(),
        originalPay: assignment.payAmount,
        recalculatedPay: payAmount,
        formattedRecalculatedPay: `$${(payAmount / 100).toFixed(2)}`,
      };
    }).filter(Boolean);

    res.json({
      employees: employeesWithPay,
      jobPrice: jobPriceInCents,
      jobDetails: {
        numBeds,
        numBaths,
        totalJobHours,
        existingAssignments,
        totalCleaners,
        hoursPerCleaner,
        recalculatedExistingPay,
        recalculatedAssignments,
      },
    });
  } catch (error) {
    console.error("Error fetching employees for job:", error);
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
      employee: BusinessEmployeeSerializer.serializeOne(employee),
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
      { employeeId, appointmentId, payAmount: Math.floor(payAmount || 0), payType }
    );

    res.status(201).json({ message: "Employee assigned", assignment: EmployeeJobAssignmentSerializer.serializeOne(assignment) });
  } catch (error) {
    console.error("Error assigning employee:", error);
    res.status(400).json({ error: error.message });
  }
});

/**
 * GET /assignments/:assignmentId - Get a single assignment with full details
 */
router.get("/assignments/:assignmentId", async (req, res) => {
  try {
    const assignment = await EmployeeJobAssignment.findOne({
      where: {
        id: parseInt(req.params.assignmentId),
        businessOwnerId: req.businessOwnerId,
      },
      include: [
        {
          model: BusinessEmployee,
          as: "employee",
          attributes: ["id", "firstName", "lastName", "phone", "email", "defaultHourlyRate", "payType", "payRate", "defaultJobRate"],
        },
        {
          model: UserAppointments,
          as: "appointment",
          include: [
            {
              model: UserHomes,
              as: "home",
              include: [
                {
                  model: User,
                  as: "user",
                  attributes: ["id", "firstName", "lastName", "email", "phone"],
                },
              ],
            },
          ],
        },
      ],
    });

    if (!assignment) {
      return res.status(404).json({ error: "Assignment not found" });
    }

    // Get all assignments for this appointment (for multi-employee jobs)
    const allAssignments = await EmployeeJobAssignment.findAll({
      where: {
        appointmentId: assignment.appointmentId,
        businessOwnerId: req.businessOwnerId,
        status: { [Op.notIn]: ["cancelled", "unassigned"] },
      },
      include: [
        {
          model: BusinessEmployee,
          as: "employee",
          attributes: ["id", "firstName", "lastName", "phone", "email", "defaultHourlyRate", "payType", "payRate", "defaultJobRate"],
        },
      ],
      order: [["assignedAt", "ASC"]],
    });

    // Calculate expected pay for each assignment based on home size
    const numBeds = assignment.appointment?.home?.numBeds || 2;
    const numBaths = assignment.appointment?.home?.numBaths || 1;
    const totalCleaners = allAssignments.length;
    const jobPriceInCents = assignment.appointment?.price
      ? Math.round(parseFloat(assignment.appointment.price) * 100)
      : 0;

    // Estimate hours based on home size and number of cleaners
    const estimatedHours = EmployeeJobAssignmentService.estimateJobDuration(numBeds, numBaths, totalCleaners);

    // Add calculated pay to each assignment
    const assignmentsWithCalculatedPay = allAssignments.map((a, idx) => {
      const serialized = EmployeeJobAssignmentSerializer.serializeOne(a);

      // Debug logging for first assignment
      if (idx === 0) {
        console.log("[assignment-detail] Calculating pay for assignment:", {
          numBeds,
          numBaths,
          totalCleaners,
          estimatedHours,
          jobPriceInCents,
          isSelfAssignment: a.isSelfAssignment,
          employeeId: a.employee?.id,
          employeePayType: a.employee?.payType,
          employeeHourlyRate: a.employee?.defaultHourlyRate,
          storedPayAmount: a.payAmount,
          storedPayType: a.payType,
        });
      }

      // For self-assignments or if employee data is missing, use the stored pay
      let calculatedPay = serialized.payAmount || 0;
      let calculatedPayType = serialized.payType || "flat_rate";

      // Calculate what this employee SHOULD make based on their default rates
      if (a.employee) {
        const result = EmployeeJobAssignmentService.calculateEmployeePay(
          a.employee,
          jobPriceInCents,
          estimatedHours
        );
        calculatedPay = result.payAmount;
        calculatedPayType = result.payType;
      }

      if (idx === 0) {
        console.log("[assignment-detail] Calculated:", { calculatedPay, calculatedPayType });
      }

      // Add employee rate info for display
      const employeeRateInfo = a.employee ? {
        defaultHourlyRate: a.employee.defaultHourlyRate,
        defaultJobRate: a.employee.defaultJobRate,
        payRate: a.employee.payRate ? parseFloat(a.employee.payRate) : null,
        payType: a.employee.payType,
      } : null;

      return {
        ...serialized,
        calculatedPay,
        calculatedPayType,
        formattedCalculatedPay: `$${(calculatedPay / 100).toFixed(2)}`,
        estimatedHours,
        employeeRateInfo,
        // Flag if stored pay differs from calculated
        payNeedsUpdate: serialized.payAmount !== calculatedPay || serialized.payType !== calculatedPayType,
      };
    });

    // Get platform fee percentage for business owners
    const pricingConfig = await PricingConfig.getActive();
    const platformFeePercent = pricingConfig?.businessOwnerFeePercent
      ? parseFloat(pricingConfig.businessOwnerFeePercent)
      : 0.10; // Default 10%
    const platformFeeAmount = Math.round(jobPriceInCents * platformFeePercent);

    res.json({
      assignment: EmployeeJobAssignmentSerializer.serializeOne(assignment),
      allAssignments: assignmentsWithCalculatedPay,
      totalAssigned: allAssignments.length,
      jobDetails: {
        numBeds,
        numBaths,
        estimatedHours,
        jobPrice: jobPriceInCents,
        platformFeePercent,
        platformFeeAmount,
      },
    });
  } catch (error) {
    console.error("Error fetching assignment:", error);
    res.status(500).json({ error: error.message });
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

    res.json({ message: "Job reassigned", assignment: EmployeeJobAssignmentSerializer.serializeOne(assignment) });
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

    res.status(201).json({ message: "Self-assigned to job", assignment: EmployeeJobAssignmentSerializer.serializeOne(assignment) });
  } catch (error) {
    console.error("Error self-assigning:", error);
    res.status(400).json({ error: error.message });
  }
});

/**
 * GET /my-jobs - Get marketplace jobs booked by business owner with assignment status
 * Returns only marketplace pickups (excludes direct client bookings)
 * Jobs with clear indication of assignment status and available actions
 */
router.get("/my-jobs", async (req, res) => {
  try {
    const { upcoming, status } = req.query;
    const today = new Date().toISOString().split("T")[0];

    // Get list of client IDs for this business owner
    // These are direct bookings, not marketplace pickups
    const clientRelationships = await CleanerClient.findAll({
      where: { cleanerId: req.businessOwnerId },
      attributes: ["clientId"],
    });
    const clientIds = clientRelationships.map(c => c.clientId);

    // Build where clause for appointments booked by this business owner
    const whereClause = {
      bookedByCleanerId: req.businessOwnerId,
      wasCancelled: { [Op.ne]: true },
    };

    // Filter by upcoming if specified
    if (upcoming === "true") {
      whereClause.date = { [Op.gte]: today };
      whereClause.completed = { [Op.ne]: true };
    }

    // Get all appointments booked by this business owner
    const appointments = await UserAppointments.findAll({
      where: whereClause,
      include: [
        {
          model: UserHomes,
          as: "home",
          include: [
            {
              model: User,
              as: "user",
              attributes: ["id", "firstName", "lastName"],
            },
          ],
        },
      ],
      order: [["date", "ASC"]],
    });

    // Filter out direct client bookings - only keep marketplace pickups
    // A marketplace pickup is where the homeowner is NOT a client of the business
    const marketplaceJobs = appointments.filter(apt => {
      const homeownerId = apt.home?.user?.id;
      return homeownerId && !clientIds.includes(homeownerId);
    });

    // Get all active assignments for these marketplace jobs
    const appointmentIds = marketplaceJobs.map(a => a.id);
    const activeAssignments = appointmentIds.length > 0
      ? await EmployeeJobAssignment.findAll({
          where: {
            appointmentId: { [Op.in]: appointmentIds },
            status: { [Op.notIn]: ["cancelled", "unassigned"] },
          },
          include: [
            {
              model: BusinessEmployee,
              as: "employee",
              attributes: ["id", "userId"],
              include: [
                {
                  model: User,
                  as: "user",
                  attributes: ["firstName", "lastName"],
                },
              ],
            },
          ],
        })
      : [];

    // Create a map of appointmentId to assignment
    const assignmentMap = {};
    activeAssignments.forEach(a => {
      assignmentMap[a.appointmentId] = a;
    });

    // Get list of employees for assignment options
    const employees = await BusinessEmployee.findAll({
      where: {
        businessOwnerId: req.businessOwnerId,
        status: "active",
      },
      include: [
        {
          model: User,
          as: "user",
          attributes: ["id", "firstName", "lastName"],
        },
      ],
    });

    const employeeList = employees.map(emp => {
      const firstName = emp.user?.firstName
        ? EncryptionService.decrypt(emp.user.firstName)
        : "";
      const lastName = emp.user?.lastName
        ? EncryptionService.decrypt(emp.user.lastName)
        : "";
      return {
        id: emp.id,
        userId: emp.userId,
        name: `${firstName} ${lastName}`.trim(),
      };
    });

    // Format response with assignment status and available actions
    const jobs = marketplaceJobs.map(apt => {
      const assignment = assignmentMap[apt.id];
      const isAssigned = !!assignment;

      // Decrypt client info and home location
      const clientFirstName = apt.home?.user?.firstName
        ? EncryptionService.decrypt(apt.home.user.firstName)
        : null;
      const clientLastName = apt.home?.user?.lastName
        ? EncryptionService.decrypt(apt.home.user.lastName)
        : null;
      const address = apt.home?.address
        ? EncryptionService.decrypt(apt.home.address)
        : "";
      const city = apt.home?.city
        ? EncryptionService.decrypt(apt.home.city)
        : "";
      const homeState = apt.home?.state
        ? EncryptionService.decrypt(apt.home.state)
        : "";

      // Get assigned employee name if assigned
      let assignedTo = null;
      if (assignment) {
        if (assignment.isSelfAssignment) {
          assignedTo = { type: "self", name: "You (Business Owner)" };
        } else if (assignment.employee) {
          const empFirstName = assignment.employee.user?.firstName
            ? EncryptionService.decrypt(assignment.employee.user.firstName)
            : "";
          const empLastName = assignment.employee.user?.lastName
            ? EncryptionService.decrypt(assignment.employee.user.lastName)
            : "";
          assignedTo = {
            type: "employee",
            employeeId: assignment.employee.id,
            name: `${empFirstName} ${empLastName}`.trim(),
          };
        }
      }

      // Filter by status if specified
      if (status === "unassigned" && isAssigned) return null;
      if (status === "assigned" && !isAssigned) return null;

      return {
        id: apt.id,
        date: apt.date,
        startTime: apt.startTime,
        timeToBeCompleted: apt.timeToBeCompleted,
        price: apt.price,
        completed: apt.completed,
        clientName: clientFirstName && clientLastName
          ? `${clientFirstName} ${clientLastName}`
          : "Unknown Client",
        address,
        city,
        state: homeState,
        homeId: apt.homeId,
        numBeds: apt.home?.numBeds,
        numBaths: apt.home?.numBaths,
        // Assignment status
        isAssigned,
        assignedTo,
        assignmentId: assignment?.id || null,
        assignmentStatus: assignment?.status || null,
        // Available actions
        actions: {
          canSelfAssign: !isAssigned,
          canAssignEmployee: !isAssigned && employeeList.length > 0,
          canReassign: isAssigned && assignment?.status === "assigned",
          canUnassign: isAssigned && assignment?.status === "assigned",
        },
      };
    }).filter(Boolean); // Remove nulls from status filtering

    res.json({
      jobs,
      employees: employeeList,
      summary: {
        total: jobs.length,
        assigned: jobs.filter(j => j.isAssigned).length,
        unassigned: jobs.filter(j => !j.isAssigned).length,
      },
    });
  } catch (error) {
    console.error("Error fetching my jobs:", error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /all-jobs - Get ALL jobs for the business owner (both client and marketplace)
 * Returns jobs with a source label indicating if from client or marketplace
 */
router.get("/all-jobs", async (req, res) => {
  try {
    const { upcoming, status, source: sourceFilter } = req.query;
    const today = new Date().toISOString().split("T")[0];

    // Get list of client IDs for this business owner
    const clientRelationships = await CleanerClient.findAll({
      where: { cleanerId: req.businessOwnerId, status: "active" },
      attributes: ["clientId"],
    });
    const clientIds = clientRelationships.filter(c => c.clientId).map(c => c.clientId);

    // Build base where clause
    const baseWhere = {
      wasCancelled: { [Op.ne]: true },
    };

    // Filter by upcoming if specified
    if (upcoming === "true") {
      baseWhere.date = { [Op.gte]: today };
      baseWhere.completed = { [Op.ne]: true };
    }

    // Get appointments from two sources:
    // 1. Appointments booked by this business owner
    // 2. Appointments from homes owned by clients of this business owner
    let whereClause;
    if (clientIds.length > 0) {
      whereClause = {
        ...baseWhere,
        [Op.or]: [
          { bookedByCleanerId: req.businessOwnerId },
          { "$home.userId$": { [Op.in]: clientIds } },
        ],
      };
    } else {
      // No clients, just get appointments booked by business owner
      whereClause = {
        ...baseWhere,
        bookedByCleanerId: req.businessOwnerId,
      };
    }

    // Get all relevant appointments
    const appointments = await UserAppointments.findAll({
      where: whereClause,
      include: [
        {
          model: UserHomes,
          as: "home",
          required: true,
          include: [
            {
              model: User,
              as: "user",
              attributes: ["id", "firstName", "lastName"],
            },
          ],
        },
      ],
      order: [["date", "ASC"]],
    });

    // Get all active assignments for these appointments
    const appointmentIds = appointments.map(a => a.id);
    const activeAssignments = appointmentIds.length > 0
      ? await EmployeeJobAssignment.findAll({
          where: {
            appointmentId: { [Op.in]: appointmentIds },
            status: { [Op.notIn]: ["cancelled", "unassigned"] },
          },
          include: [
            {
              model: BusinessEmployee,
              as: "employee",
              attributes: ["id", "userId"],
              include: [
                {
                  model: User,
                  as: "user",
                  attributes: ["firstName", "lastName"],
                },
              ],
            },
          ],
        })
      : [];

    // Create a map of appointmentId to assignment
    const assignmentMap = {};
    activeAssignments.forEach(a => {
      assignmentMap[a.appointmentId] = a;
    });

    // Format response with source label
    const jobs = appointments.map(apt => {
      const assignment = assignmentMap[apt.id];
      const isAssigned = !!assignment;
      const homeownerId = apt.home?.user?.id;

      // Determine source: client job or marketplace pickup
      const isClientJob = homeownerId && clientIds.includes(homeownerId);
      const source = isClientJob ? "client" : "marketplace";

      // Decrypt client info and home location
      const clientFirstName = apt.home?.user?.firstName
        ? EncryptionService.decrypt(apt.home.user.firstName)
        : null;
      const clientLastName = apt.home?.user?.lastName
        ? EncryptionService.decrypt(apt.home.user.lastName)
        : null;
      const address = apt.home?.address
        ? EncryptionService.decrypt(apt.home.address)
        : "";
      const city = apt.home?.city
        ? EncryptionService.decrypt(apt.home.city)
        : "";
      const homeState = apt.home?.state
        ? EncryptionService.decrypt(apt.home.state)
        : "";

      // Get assigned employee name if assigned
      let assignedTo = null;
      if (assignment) {
        if (assignment.isSelfAssignment) {
          assignedTo = { type: "self", name: "You (Business Owner)" };
        } else if (assignment.employee) {
          const empFirstName = assignment.employee.user?.firstName
            ? EncryptionService.decrypt(assignment.employee.user.firstName)
            : "";
          const empLastName = assignment.employee.user?.lastName
            ? EncryptionService.decrypt(assignment.employee.user.lastName)
            : "";
          assignedTo = {
            type: "employee",
            employeeId: assignment.employee.id,
            name: `${empFirstName} ${empLastName}`.trim(),
          };
        }
      }

      // Filter by status if specified
      if (status === "unassigned" && isAssigned) return null;
      if (status === "assigned" && !isAssigned) return null;

      return {
        id: apt.id,
        date: apt.date,
        startTime: apt.startTime,
        timeToBeCompleted: apt.timeToBeCompleted,
        price: apt.price,
        completed: apt.completed,
        source, // "client" or "marketplace"
        clientName: clientFirstName && clientLastName
          ? `${clientFirstName} ${clientLastName}`
          : "Unknown Client",
        address,
        city,
        state: homeState,
        homeId: apt.homeId,
        numBeds: apt.home?.numBeds,
        numBaths: apt.home?.numBaths,
        // Assignment status
        isAssigned,
        assignedTo,
        assignmentId: assignment?.id || null,
        assignmentStatus: assignment?.status || null,
      };
    }).filter(Boolean);

    // Apply source filter if specified
    let filteredJobs = jobs;
    if (sourceFilter === "client") {
      filteredJobs = jobs.filter(j => j.source === "client");
    } else if (sourceFilter === "marketplace") {
      filteredJobs = jobs.filter(j => j.source === "marketplace");
    }

    // Separate by source for summary
    const clientJobs = jobs.filter(j => j.source === "client");
    const marketplaceJobs = jobs.filter(j => j.source === "marketplace");

    res.json({
      jobs: filteredJobs,
      summary: {
        total: jobs.length,
        clientJobs: clientJobs.length,
        marketplaceJobs: marketplaceJobs.length,
        assigned: jobs.filter(j => j.isAssigned).length,
        unassigned: jobs.filter(j => !j.isAssigned).length,
        filtered: filteredJobs.length,
      },
    });
  } catch (error) {
    console.error("Error fetching all jobs:", error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /my-jobs/:appointmentId - Get full details for a specific job
 * Returns complete job and home details for business owner viewing a marketplace job
 */
router.get("/my-jobs/:appointmentId", async (req, res) => {
  try {
    const appointmentId = parseInt(req.params.appointmentId);

    // Get the appointment with full home and client details
    const appointment = await UserAppointments.findOne({
      where: {
        id: appointmentId,
        bookedByCleanerId: req.businessOwnerId,
      },
      include: [
        {
          model: UserHomes,
          as: "home",
          include: [
            {
              model: User,
              as: "user",
              attributes: ["id", "firstName", "lastName", "email", "phone"],
            },
          ],
        },
        {
          model: RecurringSchedule,
          as: "recurringSchedule",
          attributes: ["timeWindow"],
          required: false,
        },
      ],
    });

    if (!appointment) {
      return res.status(404).json({ error: "Job not found or not accessible" });
    }

    // Check for active assignment
    const assignment = await EmployeeJobAssignment.findOne({
      where: {
        appointmentId: appointment.id,
        status: { [Op.notIn]: ["cancelled", "unassigned"] },
      },
      include: [
        {
          model: BusinessEmployee,
          as: "employee",
          include: [
            {
              model: User,
              as: "user",
              attributes: ["firstName", "lastName"],
            },
          ],
        },
      ],
    });

    // Get list of employees for assignment options
    const employees = await BusinessEmployee.findAll({
      where: {
        businessOwnerId: req.businessOwnerId,
        status: "active",
      },
      include: [
        {
          model: User,
          as: "user",
          attributes: ["id", "firstName", "lastName"],
        },
      ],
    });

    const employeeList = employees.map(emp => {
      const firstName = emp.user?.firstName
        ? EncryptionService.decrypt(emp.user.firstName)
        : "";
      const lastName = emp.user?.lastName
        ? EncryptionService.decrypt(emp.user.lastName)
        : "";
      return {
        id: emp.id,
        userId: emp.userId,
        name: `${firstName} ${lastName}`.trim(),
      };
    });

    // Decrypt client info
    const clientFirstName = appointment.home?.user?.firstName
      ? EncryptionService.decrypt(appointment.home.user.firstName)
      : null;
    const clientLastName = appointment.home?.user?.lastName
      ? EncryptionService.decrypt(appointment.home.user.lastName)
      : null;
    const clientEmail = appointment.home?.user?.email
      ? EncryptionService.decrypt(appointment.home.user.email)
      : null;
    const clientPhone = appointment.home?.user?.phone
      ? EncryptionService.decrypt(appointment.home.user.phone)
      : null;

    // Decrypt home info
    const address = appointment.home?.address
      ? EncryptionService.decrypt(appointment.home.address)
      : "";
    const city = appointment.home?.city
      ? EncryptionService.decrypt(appointment.home.city)
      : "";
    const homeState = appointment.home?.state
      ? EncryptionService.decrypt(appointment.home.state)
      : "";
    const zipcode = appointment.home?.zipcode
      ? EncryptionService.decrypt(appointment.home.zipcode)
      : "";
    const keyPadCode = appointment.keyPadCode
      ? EncryptionService.decrypt(appointment.keyPadCode)
      : appointment.home?.keyPadCode
        ? EncryptionService.decrypt(appointment.home.keyPadCode)
        : null;
    const keyLocation = appointment.keyLocation
      ? EncryptionService.decrypt(appointment.keyLocation)
      : appointment.home?.keyLocation
        ? EncryptionService.decrypt(appointment.home.keyLocation)
        : null;
    const contact = appointment.contact
      ? EncryptionService.decrypt(appointment.contact)
      : appointment.home?.contact
        ? EncryptionService.decrypt(appointment.home.contact)
        : null;

    // Build assignment info
    let assignedTo = null;
    if (assignment) {
      if (assignment.isSelfAssignment) {
        assignedTo = { type: "self", name: "You (Business Owner)" };
      } else if (assignment.employee) {
        const empFirstName = assignment.employee.user?.firstName
          ? EncryptionService.decrypt(assignment.employee.user.firstName)
          : "";
        const empLastName = assignment.employee.user?.lastName
          ? EncryptionService.decrypt(assignment.employee.user.lastName)
          : "";
        assignedTo = {
          type: "employee",
          employeeId: assignment.employee.id,
          name: `${empFirstName} ${empLastName}`.trim(),
        };
      }
    }

    const isAssigned = !!assignment;

    res.json({
      job: {
        id: appointment.id,
        date: appointment.date,
        startTime: appointment.startTime,
        timeToBeCompleted: appointment.timeToBeCompleted,
        timeWindow: appointment.recurringSchedule?.timeWindow || null,
        price: appointment.price,
        paid: appointment.paid,
        paymentStatus: appointment.paymentStatus,
        completed: appointment.completed,
        wasCancelled: appointment.wasCancelled,
        bringTowels: appointment.bringTowels,
        bringSheets: appointment.bringSheets,
        sheetConfigurations: appointment.sheetConfigurations,
        towelConfigurations: appointment.towelConfigurations,
        // Assignment status
        isAssigned,
        assignedTo,
        assignmentId: assignment?.id || null,
        assignmentStatus: assignment?.status || null,
        // Available actions
        actions: {
          canSelfAssign: !isAssigned,
          canAssignEmployee: !isAssigned && employeeList.length > 0,
          canReassign: isAssigned && assignment?.status === "assigned",
          canUnassign: isAssigned && assignment?.status === "assigned",
        },
      },
      home: {
        id: appointment.home?.id,
        nickName: appointment.home?.nickName,
        address,
        city,
        state: homeState,
        zipcode,
        numBeds: appointment.home?.numBeds,
        numBaths: appointment.home?.numBaths,
        numHalfBaths: appointment.home?.numHalfBaths,
        squareFootage: appointment.home?.squareFootage,
        sheetsProvided: appointment.home?.sheetsProvided,
        towelsProvided: appointment.home?.towelsProvided,
        cleanersNeeded: appointment.home?.cleanersNeeded,
        keyPadCode,
        keyLocation,
        contact,
        specialNotes: appointment.home?.specialNotes,
        recyclingLocation: appointment.home?.recyclingLocation,
        compostLocation: appointment.home?.compostLocation,
        trashLocation: appointment.home?.trashLocation,
        bedConfigurations: appointment.home?.bedConfigurations,
        bathroomConfigurations: appointment.home?.bathroomConfigurations,
      },
      client: {
        id: appointment.home?.user?.id,
        firstName: clientFirstName,
        lastName: clientLastName,
        fullName: clientFirstName && clientLastName
          ? `${clientFirstName} ${clientLastName}`
          : "Unknown Client",
        email: clientEmail,
        phone: clientPhone,
      },
      employees: employeeList,
    });
  } catch (error) {
    console.error("Error fetching job details:", error);
    res.status(500).json({ error: error.message });
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
      { newPayAmount: Math.floor(newPayAmount), reason }
    );

    res.json({ message: "Pay updated", assignment: EmployeeJobAssignmentSerializer.serializeOne(assignment) });
  } catch (error) {
    console.error("Error updating pay:", error);
    res.status(400).json({ error: error.message });
  }
});

/**
 * POST /assignments/:assignmentId/recalculate-pay - Recalculate pay based on home size
 * Recalculates pay using the employee's default rate and the home's beds/baths
 */
router.post("/assignments/:assignmentId/recalculate-pay", async (req, res) => {
  try {
    const assignment = await EmployeeJobAssignmentService.recalculatePay(
      parseInt(req.params.assignmentId),
      req.businessOwnerId
    );

    res.json({
      message: "Pay recalculated",
      assignment: EmployeeJobAssignmentSerializer.serializeOne(assignment),
    });
  } catch (error) {
    console.error("Error recalculating pay:", error);
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
 * PUT /assignments/:assignmentId/hours - Update hours worked for an assignment
 * Used for hourly employees - recalculates pay based on employee's hourly rate
 */
router.put("/assignments/:assignmentId/hours", async (req, res) => {
  try {
    const { hoursWorked } = req.body;

    if (hoursWorked === undefined || hoursWorked === null || hoursWorked < 0) {
      return res.status(400).json({ error: "Valid hours worked value is required" });
    }

    const assignment = await EmployeeJobAssignmentService.updateHoursWorked(
      parseInt(req.params.assignmentId),
      req.businessOwnerId,
      parseFloat(hoursWorked)
    );

    res.json({
      message: "Hours updated",
      assignment: EmployeeJobAssignmentSerializer.serializeOne(assignment),
    });
  } catch (error) {
    console.error("Error updating hours:", error);
    res.status(400).json({ error: error.message });
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
    const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split("T")[0];
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
    const thirtyDaysFromNow = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];

    // Calculate start of current week and month
    const now = new Date();
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay());
    const weekStart = startOfWeek.toISOString().split("T")[0];

    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthStart = startOfMonth.toISOString().split("T")[0];

    // Get client IDs to determine source (client vs marketplace)
    const clientRelationships = await CleanerClient.findAll({
      where: { cleanerId: req.businessOwnerId },
      attributes: ["clientId"],
    });
    const clientIds = clientRelationships.map(c => c.clientId);

    const [
      employeeStats,
      financials,
      upcomingAssignments,
      unpaidAssignments,
      todaysAssignments,
      tomorrowsAssignments,
      totalClients,
      weeklyFinancials,
      employees,
    ] = await Promise.all([
      BusinessEmployeeService.getEmployeeStats(req.businessOwnerId),
      PayCalculatorService.getFinancialSummary(req.businessOwnerId, thirtyDaysAgo, today),
      EmployeeJobAssignmentService.getUpcomingAssignments(req.businessOwnerId, today, thirtyDaysFromNow),
      EmployeeJobAssignmentService.getUnpaidAssignments(req.businessOwnerId),
      EmployeeJobAssignmentService.getUpcomingAssignments(req.businessOwnerId, today, today),
      EmployeeJobAssignmentService.getUpcomingAssignments(req.businessOwnerId, tomorrow, tomorrow),
      CleanerClient.count({ where: { cleanerId: req.businessOwnerId, status: "active" } }),
      PayCalculatorService.getFinancialSummary(req.businessOwnerId, weekStart, today),
      BusinessEmployeeService.getEmployeesByBusinessOwner(req.businessOwnerId, { status: ["active"] }),
    ]);

    // Helper function to format assigned appointments with source
    const formatAssignedAppointments = (assignments) => {
      return assignments.map(assignment => {
        // Decrypt employee name (BusinessEmployee has encrypted PII fields)
        const employeeFirstName = assignment.employee?.firstName
          ? EncryptionService.decrypt(assignment.employee.firstName)
          : null;
        const employeeLastName = assignment.employee?.lastName
          ? EncryptionService.decrypt(assignment.employee.lastName)
          : null;

        // Decrypt client/user name (User has encrypted PII fields)
        const clientFirstName = assignment.appointment?.home?.user?.firstName
          ? EncryptionService.decrypt(assignment.appointment.home.user.firstName)
          : null;
        const clientLastName = assignment.appointment?.home?.user?.lastName
          ? EncryptionService.decrypt(assignment.appointment.home.user.lastName)
          : null;

        // Decrypt address (UserHomes has encrypted address)
        const address = assignment.appointment?.home?.address
          ? EncryptionService.decrypt(assignment.appointment.home.address)
          : null;

        // Determine source: client job or marketplace pickup
        const homeownerId = assignment.appointment?.home?.user?.id;
        const isClientJob = homeownerId && clientIds.includes(homeownerId);
        const source = isClientJob ? "client" : "marketplace";

        return {
          id: assignment.appointmentId,
          date: assignment.appointment?.date,
          status: assignment.status,
          startTime: assignment.appointment?.startTime,
          source,
          assignedEmployee: assignment.employee ? {
            id: assignment.employee.id,
            firstName: employeeFirstName,
            lastName: employeeLastName,
          } : (assignment.isSelfAssignment ? { id: null, firstName: "You", lastName: "(Self)" } : null),
          clientName: clientFirstName && clientLastName
            ? `${clientFirstName} ${clientLastName}`
            : "Unknown Client",
          address,
          totalPrice: parseFloat(assignment.appointment?.price || 0) * 100,
        };
      });
    };

    // Get today's assigned appointments
    const assignedAppointmentIds = todaysAssignments.map(a => a.appointmentId);
    const assignedAppointments = formatAssignedAppointments(todaysAssignments);

    // Get tomorrow's assigned appointments
    const tomorrowAssignedAppointmentIds = tomorrowsAssignments.map(a => a.appointmentId);
    const tomorrowAssignedAppointments = formatAssignedAppointments(tomorrowsAssignments);

    // Get today's unassigned appointments (appointments without assignments)
    // This includes appointments that were previously assigned but are now unassigned
    const cancelledTodayAssignments = await EmployeeJobAssignment.findAll({
      where: {
        businessOwnerId: req.businessOwnerId,
        status: "cancelled",
      },
      attributes: ["appointmentId"],
      include: [
        {
          model: UserAppointments,
          as: "appointment",
          where: {
            date: today,
            wasCancelled: { [Op.ne]: true },
            completed: { [Op.ne]: true },
          },
          attributes: ["id"],
        },
      ],
    });
    const cancelledTodayAppointmentIds = cancelledTodayAssignments
      .filter(a => a.appointment && !assignedAppointmentIds.includes(a.appointmentId))
      .map(a => a.appointmentId);

    const todaysUnassignedAppointments = await UserAppointments.findAll({
      where: {
        date: today,
        wasCancelled: { [Op.ne]: true },
        completed: { [Op.ne]: true },
        [Op.and]: [
          // Either booked by this business owner OR has a cancelled assignment from this business owner
          {
            [Op.or]: [
              { bookedByCleanerId: req.businessOwnerId },
              { id: { [Op.in]: cancelledTodayAppointmentIds.length > 0 ? cancelledTodayAppointmentIds : [0] } },
            ],
          },
          // Exclude actively assigned appointments
          ...(assignedAppointmentIds.length > 0
            ? [{ id: { [Op.notIn]: assignedAppointmentIds } }]
            : []),
        ],
      },
      include: [
        {
          model: UserHomes,
          as: "home",
          include: [
            {
              model: User,
              as: "user",
              attributes: ["id", "firstName", "lastName"],
            },
          ],
        },
      ],
      order: [["date", "ASC"]],
    });

    // Helper function to format unassigned appointments
    const formatUnassignedAppointments = (appointments) => {
      return appointments.map(apt => {
        // Decrypt client/user name
        const clientFirstName = apt.home?.user?.firstName
          ? EncryptionService.decrypt(apt.home.user.firstName)
          : null;
        const clientLastName = apt.home?.user?.lastName
          ? EncryptionService.decrypt(apt.home.user.lastName)
          : null;

        // Decrypt address
        const address = apt.home?.address
          ? EncryptionService.decrypt(apt.home.address)
          : "";

        // Determine source: client job or marketplace pickup
        const homeownerId = apt.home?.user?.id;
        const isClientJob = homeownerId && clientIds.includes(homeownerId);
        const source = isClientJob ? "client" : "marketplace";

        return {
          id: apt.id,
          date: apt.date,
          status: "unassigned",
          startTime: apt.startTime,
          source,
          assignedEmployee: null,
          clientName: clientFirstName && clientLastName
            ? `${clientFirstName} ${clientLastName}`
            : "Unknown Client",
          address,
          totalPrice: parseFloat(apt.price) * 100,
        };
      });
    };

    const unassignedAppointmentsList = formatUnassignedAppointments(todaysUnassignedAppointments);

    // Get all user IDs associated with this business (owner + employees)
    const employeeUserIds = employees
      .filter(emp => emp.userId)
      .map(emp => emp.userId);
    const businessUserIds = [req.businessOwnerId, ...employeeUserIds];

    // Create a map of userId to employee info for formatting
    const userIdToEmployee = new Map();
    userIdToEmployee.set(req.businessOwnerId, { id: null, firstName: "You", lastName: "(Self)", isSelf: true });
    employees.forEach(emp => {
      if (emp.userId) {
        userIdToEmployee.set(emp.userId, {
          id: emp.id,
          firstName: emp.firstName ? EncryptionService.decrypt(emp.firstName) : null,
          lastName: emp.lastName ? EncryptionService.decrypt(emp.lastName) : null,
          isSelf: false,
        });
      }
    });

    // Get today's marketplace pickups where business owner OR employees picked up jobs
    // These are jobs picked up from the marketplace via the cleaner flow
    const todaysMarketplacePickups = await UserCleanerAppointments.findAll({
      where: { employeeId: { [Op.in]: businessUserIds } },
      include: [
        {
          model: UserAppointments,
          as: "appointment",
          where: {
            date: today,
            wasCancelled: { [Op.ne]: true },
            completed: { [Op.ne]: true },
            // Exclude jobs already in employee assignment system
            ...(assignedAppointmentIds.length > 0
              ? { id: { [Op.notIn]: assignedAppointmentIds } }
              : {}),
          },
          include: [
            {
              model: UserHomes,
              as: "home",
              include: [
                {
                  model: User,
                  as: "user",
                  attributes: ["id", "firstName", "lastName"],
                },
              ],
            },
          ],
        },
      ],
    });

    // Format marketplace pickups (business owner or employees doing the job)
    const formatMarketplacePickups = (pickups) => {
      return pickups
        .filter(p => p.appointment) // Ensure appointment exists
        .map(pickup => {
          const apt = pickup.appointment;
          const clientFirstName = apt.home?.user?.firstName
            ? EncryptionService.decrypt(apt.home.user.firstName)
            : null;
          const clientLastName = apt.home?.user?.lastName
            ? EncryptionService.decrypt(apt.home.user.lastName)
            : null;
          const address = apt.home?.address
            ? EncryptionService.decrypt(apt.home.address)
            : "";

          // Get the employee info who picked up this job
          const assignedEmp = userIdToEmployee.get(pickup.employeeId) || { id: null, firstName: "Unknown", lastName: "" };

          return {
            id: apt.id,
            date: apt.date,
            status: "assigned",
            startTime: apt.startTime,
            source: "marketplace",
            assignedEmployee: assignedEmp,
            clientName: clientFirstName && clientLastName
              ? `${clientFirstName} ${clientLastName}`
              : "Unknown Client",
            address,
            totalPrice: parseFloat(apt.price) * 100,
          };
        });
    };

    const todaysMarketplaceList = formatMarketplacePickups(todaysMarketplacePickups);

    // Combine assigned, unassigned, and marketplace pickup appointments
    const todaysAppointments = [...assignedAppointments, ...unassignedAppointmentsList, ...todaysMarketplaceList]
      .sort((a, b) => (a.startTime || "").localeCompare(b.startTime || ""));

    // Get tomorrow's unassigned appointments
    const cancelledTomorrowAssignments = await EmployeeJobAssignment.findAll({
      where: {
        businessOwnerId: req.businessOwnerId,
        status: "cancelled",
      },
      attributes: ["appointmentId"],
      include: [
        {
          model: UserAppointments,
          as: "appointment",
          where: {
            date: tomorrow,
            wasCancelled: { [Op.ne]: true },
            completed: { [Op.ne]: true },
          },
          attributes: ["id"],
        },
      ],
    });
    const cancelledTomorrowAppointmentIds = cancelledTomorrowAssignments
      .filter(a => a.appointment && !tomorrowAssignedAppointmentIds.includes(a.appointmentId))
      .map(a => a.appointmentId);

    const tomorrowsUnassignedAppointments = await UserAppointments.findAll({
      where: {
        date: tomorrow,
        wasCancelled: { [Op.ne]: true },
        completed: { [Op.ne]: true },
        [Op.and]: [
          {
            [Op.or]: [
              { bookedByCleanerId: req.businessOwnerId },
              { id: { [Op.in]: cancelledTomorrowAppointmentIds.length > 0 ? cancelledTomorrowAppointmentIds : [0] } },
            ],
          },
          ...(tomorrowAssignedAppointmentIds.length > 0
            ? [{ id: { [Op.notIn]: tomorrowAssignedAppointmentIds } }]
            : []),
        ],
      },
      include: [
        {
          model: UserHomes,
          as: "home",
          include: [
            {
              model: User,
              as: "user",
              attributes: ["id", "firstName", "lastName"],
            },
          ],
        },
      ],
      order: [["startTime", "ASC"]],
    });

    const tomorrowUnassignedList = formatUnassignedAppointments(tomorrowsUnassignedAppointments);

    // Get tomorrow's marketplace pickups where business owner OR employees picked up jobs
    const tomorrowsMarketplacePickups = await UserCleanerAppointments.findAll({
      where: { employeeId: { [Op.in]: businessUserIds } },
      include: [
        {
          model: UserAppointments,
          as: "appointment",
          where: {
            date: tomorrow,
            wasCancelled: { [Op.ne]: true },
            completed: { [Op.ne]: true },
            // Exclude jobs already in employee assignment system
            ...(tomorrowAssignedAppointmentIds.length > 0
              ? { id: { [Op.notIn]: tomorrowAssignedAppointmentIds } }
              : {}),
          },
          include: [
            {
              model: UserHomes,
              as: "home",
              include: [
                {
                  model: User,
                  as: "user",
                  attributes: ["id", "firstName", "lastName"],
                },
              ],
            },
          ],
        },
      ],
    });

    const tomorrowsMarketplaceList = formatMarketplacePickups(tomorrowsMarketplacePickups);

    // Combine tomorrow's assigned, unassigned, and marketplace pickup appointments
    const tomorrowsAppointments = [...tomorrowAssignedAppointments, ...tomorrowUnassignedList, ...tomorrowsMarketplaceList]
      .sort((a, b) => (a.startTime || "").localeCompare(b.startTime || ""));

    // Count unpaid client appointments (appointments where paymentStatus is not 'paid')
    const unpaidAppointments = upcomingAssignments.filter(
      a => a.appointment?.paymentStatus &&
           a.appointment.paymentStatus !== "paid" &&
           a.appointment.paymentStatus !== "not_required"
    ).length;

    res.json({
      employeeStats,
      financials,
      upcomingJobCount: upcomingAssignments.length,
      unpaidPayrollCount: unpaidAssignments.length,
      unpaidPayrollTotal: unpaidAssignments.reduce((sum, a) => sum + a.payAmount, 0),
      // New data for profile
      todaysAppointments,
      tomorrowsAppointments,
      weeklyRevenue: weeklyFinancials?.totalRevenue || 0,
      monthlyRevenue: financials?.totalRevenue || 0,
      unpaidAppointments,
      totalClients,
      // Employees for My Team section
      employees: BusinessEmployeeSerializer.serializeArray(employees),
    });
  } catch (error) {
    console.error("Error fetching dashboard:", error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /calendar - Get calendar data
 * Returns both assigned jobs (via EmployeeJobAssignment) and unassigned jobs
 * (appointments from business owner's clients without assignments)
 */
router.get("/calendar", async (req, res) => {
  try {
    const { month, year } = req.query;
    const now = new Date();
    const targetMonth = month ? parseInt(month) - 1 : now.getMonth();
    const targetYear = year ? parseInt(year) : now.getFullYear();

    const startDate = new Date(targetYear, targetMonth, 1).toISOString().split("T")[0];
    const endDate = new Date(targetYear, targetMonth + 1, 0).toISOString().split("T")[0];

    // Get all assigned jobs
    const assignments = await EmployeeJobAssignmentService.getUpcomingAssignments(
      req.businessOwnerId,
      startDate,
      endDate
    );

    // Get all appointments from business owner's clients in this date range
    // that don't have an active assignment (unassigned jobs)
    // This includes:
    // 1. Appointments booked by this business owner
    // 2. Appointments that have a cancelled/unassigned assignment from this business owner
    const assignedAppointmentIds = assignments.map(a => a.appointmentId);

    // Find appointments that were previously assigned but are now unassigned
    const removedAssignments = await EmployeeJobAssignment.findAll({
      where: {
        businessOwnerId: req.businessOwnerId,
        status: { [Op.in]: ["unassigned", "cancelled"] },
      },
      attributes: ["appointmentId"],
      include: [
        {
          model: UserAppointments,
          as: "appointment",
          where: {
            date: {
              [Op.between]: [startDate, endDate],
            },
            wasCancelled: { [Op.ne]: true },
            completed: { [Op.ne]: true },
          },
          attributes: ["id"],
        },
      ],
    });
    const removedAppointmentIds = removedAssignments
      .filter(a => a.appointment && !assignedAppointmentIds.includes(a.appointmentId))
      .map(a => a.appointmentId);

    const unassignedAppointments = await UserAppointments.findAll({
      where: {
        date: {
          [Op.between]: [startDate, endDate],
        },
        wasCancelled: { [Op.ne]: true },
        completed: { [Op.ne]: true },
        [Op.and]: [
          // Either booked by this business owner OR has a cancelled assignment from this business owner
          {
            [Op.or]: [
              { bookedByCleanerId: req.businessOwnerId },
              { id: { [Op.in]: removedAppointmentIds.length > 0 ? removedAppointmentIds : [0] } },
            ],
          },
          // Exclude actively assigned appointments
          ...(assignedAppointmentIds.length > 0
            ? [{ id: { [Op.notIn]: assignedAppointmentIds } }]
            : []),
        ],
      },
      include: [
        {
          model: UserHomes,
          as: "home",
          include: [
            {
              model: User,
              as: "user",
              attributes: ["id", "firstName", "lastName"],
            },
          ],
        },
      ],
      order: [["date", "ASC"]],
    });

    // Format unassigned jobs
    const unassignedJobs = unassignedAppointments.map(apt => {
      const clientFirstName = apt.home?.user?.firstName
        ? EncryptionService.decrypt(apt.home.user.firstName)
        : null;
      const clientLastName = apt.home?.user?.lastName
        ? EncryptionService.decrypt(apt.home.user.lastName)
        : null;
      const address = apt.home?.address
        ? EncryptionService.decrypt(apt.home.address)
        : "";

      return {
        id: apt.id,
        date: apt.date,
        startTime: apt.startTime,
        clientName: clientFirstName && clientLastName
          ? `${clientFirstName} ${clientLastName}`
          : "Unknown Client",
        address,
        city: apt.home?.city || "",
        state: apt.home?.state || "",
        totalPrice: parseFloat(apt.price) * 100,
        status: apt.status,
      };
    });

    // Get all employees to find their user IDs for marketplace pickup query
    const calendarEmployees = await BusinessEmployeeService.getEmployeesByBusinessOwner(req.businessOwnerId, { status: ["active"] });
    const calendarEmployeeUserIds = calendarEmployees
      .filter(emp => emp.userId)
      .map(emp => emp.userId);
    const calendarBusinessUserIds = [req.businessOwnerId, ...calendarEmployeeUserIds];

    // Create a map of userId to employee info for formatting
    const calendarUserIdToEmployee = new Map();
    calendarUserIdToEmployee.set(req.businessOwnerId, { id: null, firstName: "You", lastName: "(Self)", isSelf: true });
    calendarEmployees.forEach(emp => {
      if (emp.userId) {
        calendarUserIdToEmployee.set(emp.userId, {
          id: emp.id,
          firstName: emp.firstName ? EncryptionService.decrypt(emp.firstName) : null,
          lastName: emp.lastName ? EncryptionService.decrypt(emp.lastName) : null,
          isSelf: false,
        });
      }
    });

    // Get marketplace pickups where business owner OR employees picked up jobs
    const marketplacePickups = await UserCleanerAppointments.findAll({
      where: { employeeId: { [Op.in]: calendarBusinessUserIds } },
      include: [
        {
          model: UserAppointments,
          as: "appointment",
          where: {
            date: { [Op.between]: [startDate, endDate] },
            wasCancelled: { [Op.ne]: true },
            completed: { [Op.ne]: true },
            // Exclude jobs already in employee assignment system
            ...(assignedAppointmentIds.length > 0
              ? { id: { [Op.notIn]: assignedAppointmentIds } }
              : {}),
          },
          include: [
            {
              model: UserHomes,
              as: "home",
              include: [
                {
                  model: User,
                  as: "user",
                  attributes: ["id", "firstName", "lastName"],
                },
              ],
            },
          ],
        },
      ],
    });

    // Format marketplace pickups to match assignment structure
    const marketplaceAssignments = marketplacePickups
      .filter(p => p.appointment)
      .map(pickup => {
        const apt = pickup.appointment;
        const clientFirstName = apt.home?.user?.firstName
          ? EncryptionService.decrypt(apt.home.user.firstName)
          : null;
        const clientLastName = apt.home?.user?.lastName
          ? EncryptionService.decrypt(apt.home.user.lastName)
          : null;
        const address = apt.home?.address
          ? EncryptionService.decrypt(apt.home.address)
          : "";

        // Get the employee info who picked up this job
        const assignedEmp = calendarUserIdToEmployee.get(pickup.employeeId) || { id: null, firstName: "Unknown", lastName: "" };

        return {
          id: pickup.id,
          appointmentId: apt.id,
          businessEmployeeId: assignedEmp.id,
          status: "assigned",
          payAmount: parseFloat(apt.price || 0) * 100,
          isSelfAssignment: assignedEmp.isSelf || false,
          isMarketplacePickup: true,
          assignedCount: 1,
          employee: assignedEmp,
          appointment: {
            id: apt.id,
            date: apt.date,
            startTime: apt.startTime,
            clientName: clientFirstName && clientLastName
              ? `${clientFirstName} ${clientLastName}`
              : "Unknown Client",
            address,
            city: apt.home?.city || "",
            state: apt.home?.state || "",
            totalPrice: parseFloat(apt.price || 0) * 100,
            status: apt.status,
          },
        };
      });

    // Count assignments per appointment (for multi-employee jobs)
    const appointmentAssignmentCounts = {};
    assignments.forEach((a) => {
      const apptId = a.appointmentId;
      appointmentAssignmentCounts[apptId] = (appointmentAssignmentCounts[apptId] || 0) + 1;
    });

    // Format assignments with full appointment data
    const formattedAssignments = assignments.map(assignment => {
      // Decrypt employee name
      const employeeFirstName = assignment.employee?.firstName
        ? EncryptionService.decrypt(assignment.employee.firstName)
        : null;
      const employeeLastName = assignment.employee?.lastName
        ? EncryptionService.decrypt(assignment.employee.lastName)
        : null;

      // Decrypt client name
      const clientFirstName = assignment.appointment?.home?.user?.firstName
        ? EncryptionService.decrypt(assignment.appointment.home.user.firstName)
        : null;
      const clientLastName = assignment.appointment?.home?.user?.lastName
        ? EncryptionService.decrypt(assignment.appointment.home.user.lastName)
        : null;

      // Decrypt address
      const address = assignment.appointment?.home?.address
        ? EncryptionService.decrypt(assignment.appointment.home.address)
        : "";

      return {
        id: assignment.id,
        appointmentId: assignment.appointmentId,
        businessEmployeeId: assignment.businessEmployeeId,
        status: assignment.status,
        payAmount: assignment.payAmount,
        isSelfAssignment: assignment.isSelfAssignment,
        assignedCount: appointmentAssignmentCounts[assignment.appointmentId] || 1,
        employee: assignment.employee ? {
          id: assignment.employee.id,
          firstName: employeeFirstName,
          lastName: employeeLastName,
        } : null,
        appointment: {
          id: assignment.appointment?.id,
          date: assignment.appointment?.date,
          startTime: assignment.appointment?.startTime,
          clientName: clientFirstName && clientLastName
            ? `${clientFirstName} ${clientLastName}`
            : "Unknown Client",
          address,
          city: assignment.appointment?.home?.city || "",
          state: assignment.appointment?.home?.state || "",
          totalPrice: parseFloat(assignment.appointment?.price || 0) * 100,
          status: assignment.appointment?.status,
        },
      };
    });

    // Combine employee assignments with marketplace pickups
    const allAssignments = [...formattedAssignments, ...marketplaceAssignments];

    res.json({
      unassignedJobs,
      assignments: allAssignments,
      month: targetMonth + 1,
      year: targetYear,
    });
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

/**
 * GET /payroll/history - Get paid payroll history
 */
router.get("/payroll/history", async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 50;
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];

    const paidAssignments = await EmployeeJobAssignment.findAll({
      where: {
        businessOwnerId: req.businessOwnerId,
        payoutStatus: { [Op.in]: ["paid", "paid_outside_platform"] },
        isSelfAssignment: false,
      },
      include: [
        {
          model: BusinessEmployee,
          as: "employee",
          attributes: ["id", "firstName", "lastName", "payType", "defaultHourlyRate"],
        },
        {
          model: UserAppointments,
          as: "appointment",
          where: {
            date: { [Op.gte]: thirtyDaysAgo },
          },
          attributes: ["id", "date", "price"],
          include: [
            {
              model: UserHomes,
              as: "home",
              attributes: ["id", "address"],
            },
          ],
        },
      ],
      order: [["completedAt", "DESC"]],
      limit,
    });

    const payouts = EmployeeJobAssignmentSerializer.serializeForPayoutArray(paidAssignments);

    res.json({ payouts });
  } catch (error) {
    console.error("Error fetching payroll history:", error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /tax-export/:year - Get annual tax export data
 * Returns financial summary and employee breakdown for the entire year
 */
router.get("/tax-export/:year", async (req, res) => {
  try {
    const year = parseInt(req.params.year);
    const currentYear = new Date().getFullYear();

    // Validate year (only allow current year and 2 years back)
    if (isNaN(year) || year < currentYear - 2 || year > currentYear) {
      return res.status(400).json({ error: "Invalid year. Only current year and 2 years back are allowed." });
    }

    const startDate = `${year}-01-01`;
    const endDate = `${year}-12-31`;

    // Get financial summary for the year
    const financials = await PayCalculatorService.getFinancialSummary(
      req.businessOwnerId,
      startDate,
      endDate
    );

    // Get employee breakdown
    const employeeBreakdown = financials.employeeBreakdown || [];

    // Count employees with earnings over $600 (1099 threshold)
    const threshold1099 = 60000; // $600 in cents
    const employeesOver1099Threshold = employeeBreakdown.filter(
      (e) => (e.totalPaid || 0) >= threshold1099
    ).length;

    res.json({
      year,
      financials: financials.financials || {},
      employeeBreakdown,
      summary: {
        totalEmployees: employeeBreakdown.length,
        employeesRequiring1099: employeesOver1099Threshold,
        totalPayroll: financials.financials?.totalPayroll || 0,
        totalRevenue: financials.financials?.totalRevenue || 0,
        netProfit: financials.financials?.netProfit || 0,
        completedJobs: financials.financials?.completedJobs || 0,
      },
    });
  } catch (error) {
    console.error("Error fetching tax export data:", error);
    res.status(500).json({ error: error.message });
  }
});

// =====================================
// Timesheet & Hours Tracking Routes
// =====================================

/**
 * GET /timesheet - Get timesheet data for all employees
 * Returns hours summary by employee for a date range
 */
router.get("/timesheet", async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const now = new Date();

    // Default to current week (Sunday to Saturday)
    const dayOfWeek = now.getDay();
    const defaultStart = new Date(now);
    defaultStart.setDate(now.getDate() - dayOfWeek);
    const defaultEnd = new Date(defaultStart);
    defaultEnd.setDate(defaultStart.getDate() + 6);

    const start = startDate || defaultStart.toISOString().split("T")[0];
    const end = endDate || defaultEnd.toISOString().split("T")[0];

    const timesheetData = await EmployeeJobAssignmentService.getTimesheetData(
      req.businessOwnerId,
      start,
      end
    );

    res.json(TimesheetSerializer.serializeTimesheetData(timesheetData));
  } catch (error) {
    console.error("Error fetching timesheet:", error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /employee-workload - Get employee workload data for fair job distribution
 * Returns hours metrics, employment duration, and workload percentages
 */
router.get("/employee-workload", async (req, res) => {
  try {
    const workloadData = await EmployeeJobAssignmentService.getEmployeeWorkloadData(
      req.businessOwnerId
    );

    res.json(workloadData);
  } catch (error) {
    console.error("Error fetching employee workload:", error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /unassigned-jobs - Get list of unassigned jobs for the business owner
 * Returns upcoming jobs not assigned to any employee
 */
router.get("/unassigned-jobs", async (req, res) => {
  try {
    const unassignedJobs = await EmployeeJobAssignmentService.getUnassignedJobs(
      req.businessOwnerId
    );

    res.json({ jobs: unassignedJobs });
  } catch (error) {
    console.error("Error fetching unassigned jobs:", error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /employees/:employeeId/hours - Get hours detail for a specific employee
 * Returns daily and weekly breakdown of hours
 */
router.get("/employees/:employeeId/hours", async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const now = new Date();

    // Default to last 30 days
    const defaultStart = new Date(now);
    defaultStart.setDate(now.getDate() - 30);

    const start = startDate || defaultStart.toISOString().split("T")[0];
    const end = endDate || now.toISOString().split("T")[0];

    const hoursDetail = await EmployeeJobAssignmentService.getEmployeeHoursDetail(
      req.businessOwnerId,
      parseInt(req.params.employeeId),
      start,
      end
    );

    res.json(TimesheetSerializer.serializeEmployeeHoursDetail(hoursDetail));
  } catch (error) {
    console.error("Error fetching employee hours:", error);
    if (error.message === "Employee not found") {
      res.status(404).json({ error: error.message });
    } else {
      res.status(500).json({ error: error.message });
    }
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
 * GET /analytics/financials - Get financial breakdown (available to all business owners)
 */
router.get("/analytics/financials", async (req, res) => {
  try {
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
    const [unpaidAssignments, largeBusinessQualification] = await Promise.all([
      EmployeeJobAssignmentService.getUnpaidAssignments(req.businessOwnerId),
      BusinessVolumeService.qualifiesForLargeBusinessFee(req.businessOwnerId),
    ]);

    res.json({
      payouts: EmployeeJobAssignmentSerializer.serializeForPayoutArray(unpaidAssignments),
      isLargeBusiness: largeBusinessQualification.qualifies,
      largeBusinessThreshold: largeBusinessQualification.threshold,
      currentMonthlyJobs: largeBusinessQualification.totalCleanings,
    });
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

    res.json({ message: "Marked as paid outside platform", assignment: EmployeeJobAssignmentSerializer.serializeOne(assignment) });
  } catch (error) {
    console.error("Error marking as paid outside:", error);
    res.status(500).json({ error: error.message });
  }
});

// =====================================
// Employee Bonus Routes
// =====================================

const EmployeeBonusService = require("../../../services/EmployeeBonusService");

/**
 * POST /bonuses - Create a new bonus for an employee
 */
router.post("/bonuses", async (req, res) => {
  try {
    const { employeeId, amount, reason } = req.body;

    if (!employeeId || !amount) {
      return res.status(400).json({ error: "employeeId and amount are required" });
    }

    const bonus = await EmployeeBonusService.createBonus(
      req.businessOwnerId,
      parseInt(employeeId),
      parseInt(amount),
      reason
    );

    res.status(201).json(bonus);
  } catch (error) {
    console.error("Error creating bonus:", error);
    res.status(400).json({ error: error.message });
  }
});

/**
 * GET /bonuses - Get all bonuses for business owner
 */
router.get("/bonuses", async (req, res) => {
  try {
    const { status, employeeId, limit } = req.query;

    const bonuses = await EmployeeBonusService.getBonusesForBusinessOwner(
      req.businessOwnerId,
      {
        status,
        employeeId: employeeId ? parseInt(employeeId) : undefined,
        limit: limit ? parseInt(limit) : 50,
      }
    );

    res.json(bonuses);
  } catch (error) {
    console.error("Error fetching bonuses:", error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /bonuses/pending - Get pending bonuses for business owner
 */
router.get("/bonuses/pending", async (req, res) => {
  try {
    const bonuses = await EmployeeBonusService.getPendingBonuses(req.businessOwnerId);
    res.json(bonuses);
  } catch (error) {
    console.error("Error fetching pending bonuses:", error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /bonuses/summary - Get bonus summary stats
 */
router.get("/bonuses/summary", async (req, res) => {
  try {
    const summary = await EmployeeBonusService.getBonusSummary(req.businessOwnerId);
    res.json(summary);
  } catch (error) {
    console.error("Error fetching bonus summary:", error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * PUT /bonuses/:id/paid - Mark a bonus as paid
 */
router.put("/bonuses/:id/paid", async (req, res) => {
  try {
    const { note } = req.body;

    const bonus = await EmployeeBonusService.markBonusPaid(
      parseInt(req.params.id),
      req.businessOwnerId,
      note
    );

    res.json(bonus);
  } catch (error) {
    console.error("Error marking bonus as paid:", error);
    res.status(400).json({ error: error.message });
  }
});

/**
 * DELETE /bonuses/:id - Cancel a pending bonus
 */
router.delete("/bonuses/:id", async (req, res) => {
  try {
    const result = await EmployeeBonusService.cancelBonus(
      parseInt(req.params.id),
      req.businessOwnerId
    );

    res.json(result);
  } catch (error) {
    console.error("Error cancelling bonus:", error);
    res.status(400).json({ error: error.message });
  }
});

// =====================================
// Client Payment Tracking Routes
// =====================================

/**
 * GET /client-payments - Get unpaid client appointments
 */
router.get("/client-payments", async (req, res) => {
  try {
    const { Op } = require("sequelize");

    // Get all appointments for this business owner's clients that are unpaid
    const appointments = await UserAppointments.findAll({
      where: {
        bookedByCleanerId: req.businessOwnerId,
        completed: true,
        paymentStatus: {
          [Op.notIn]: ["paid", "not_required"],
        },
      },
      include: [
        {
          model: UserHomes,
          as: "home",
          include: [
            {
              model: User,
              as: "user",
              attributes: ["id", "firstName", "lastName", "email"],
            },
          ],
        },
      ],
      order: [["date", "ASC"]],
    });

    const unpaidAppointments = appointments.map((apt) => {
      const clientFirstName = apt.home?.user?.firstName
        ? EncryptionService.decrypt(apt.home.user.firstName)
        : null;
      const clientLastName = apt.home?.user?.lastName
        ? EncryptionService.decrypt(apt.home.user.lastName)
        : null;
      const clientEmail = apt.home?.user?.email
        ? EncryptionService.decrypt(apt.home.user.email)
        : null;
      const address = apt.home?.address
        ? EncryptionService.decrypt(apt.home.address)
        : null;

      return {
        id: apt.id,
        date: apt.date,
        price: apt.price,
        paymentStatus: apt.paymentStatus,
        clientName: clientFirstName && clientLastName
          ? `${clientFirstName} ${clientLastName}`
          : "Unknown Client",
        clientEmail,
        address,
      };
    });

    const totalUnpaid = unpaidAppointments.reduce((sum, a) => sum + (a.price || 0), 0);

    res.json({ unpaidAppointments, totalUnpaid });
  } catch (error) {
    console.error("Error fetching client payments:", error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /appointments/:id/mark-paid - Mark appointment as paid by client
 */
router.post("/appointments/:id/mark-paid", async (req, res) => {
  try {
    const appointmentId = parseInt(req.params.id);

    const appointment = await UserAppointments.findOne({
      where: {
        id: appointmentId,
        bookedByCleanerId: req.businessOwnerId,
      },
    });

    if (!appointment) {
      return res.status(404).json({ error: "Appointment not found" });
    }

    await appointment.update({
      paymentStatus: "paid",
      manuallyPaid: true,
    });

    res.json({ success: true, appointment: AppointmentSerializer.serializeOne(appointment) });
  } catch (error) {
    console.error("Error marking appointment as paid:", error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /appointments/:id/send-reminder - Send payment reminder to client
 */
router.post("/appointments/:id/send-reminder", async (req, res) => {
  try {
    const appointmentId = parseInt(req.params.id);

    const appointment = await UserAppointments.findOne({
      where: {
        id: appointmentId,
        bookedByCleanerId: req.businessOwnerId,
      },
      include: [
        {
          model: UserHomes,
          as: "home",
          include: [
            {
              model: User,
              as: "user",
              attributes: ["id", "firstName", "lastName", "email"],
            },
          ],
        },
      ],
    });

    if (!appointment) {
      return res.status(404).json({ error: "Appointment not found" });
    }

    // Decrypt client email and name
    const clientEmailEncrypted = appointment.home?.user?.email;
    if (!clientEmailEncrypted) {
      return res.status(400).json({ error: "Client email not found" });
    }
    const clientEmail = EncryptionService.decrypt(clientEmailEncrypted);
    const clientFirstName = appointment.home?.user?.firstName
      ? EncryptionService.decrypt(appointment.home.user.firstName)
      : "Client";

    // Get the business owner info for the email
    const businessOwner = await User.findByPk(req.businessOwnerId);
    const businessOwnerFirstName = businessOwner?.firstName
      ? EncryptionService.decrypt(businessOwner.firstName)
      : null;

    // Send payment reminder email
    const Email = require("../../../services/sendNotifications/EmailClass");
    await Email.sendPaymentReminder(
      clientEmail,
      clientFirstName,
      appointment.date,
      appointment.price,
      businessOwner?.businessName || `${businessOwnerFirstName}'s Cleaning`
    );

    res.json({ success: true, message: "Payment reminder sent" });
  } catch (error) {
    console.error("Error sending payment reminder:", error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /appointments/:appointmentId/decline - Business owner declines a client appointment
 * Used when business owner cannot assign anyone to the job
 */
router.post("/appointments/:appointmentId/decline", async (req, res) => {
  try {
    const { appointmentId } = req.params;
    const { reason } = req.body;
    const NotificationService = require("../../../services/NotificationService");

    // Find the appointment
    const appointment = await UserAppointments.findOne({
      where: {
        id: appointmentId,
        bookedByCleanerId: req.businessOwnerId,
      },
      include: [
        { model: User, as: "user" },
        { model: UserHomes, as: "home" },
      ],
    });

    if (!appointment) {
      return res.status(404).json({
        error: "Appointment not found or you don't have permission to decline it"
      });
    }

    // Check if already declined
    if (appointment.businessOwnerDeclined) {
      return res.status(400).json({ error: "Appointment has already been declined" });
    }

    // Check if already completed or cancelled
    if (appointment.completed) {
      return res.status(400).json({ error: "Cannot decline a completed appointment" });
    }
    if (appointment.wasCancelled) {
      return res.status(400).json({ error: "Cannot decline a cancelled appointment" });
    }

    // Update appointment with decline info
    await appointment.update({
      businessOwnerDeclined: true,
      businessOwnerDeclinedAt: new Date(),
      businessOwnerDeclineReason: reason || null,
    });

    // Get business owner info for notification
    const businessOwner = await User.findByPk(req.businessOwnerId);
    const businessOwnerName = businessOwner.businessName ||
      `${EncryptionService.decrypt(businessOwner.firstName)} ${EncryptionService.decrypt(businessOwner.lastName)}`;

    // Notify the client
    await NotificationService.notifyBusinessOwnerDeclined({
      clientId: appointment.userId,
      businessOwnerId: req.businessOwnerId,
      businessOwnerName,
      appointmentId: appointment.id,
      appointmentDate: appointment.date,
      reason: reason || null,
    });

    console.log(`[BusinessOwner] Owner ${req.businessOwnerId} declined appointment ${appointmentId}`);

    res.json({
      success: true,
      message: "Appointment declined. Client has been notified.",
    });
  } catch (error) {
    console.error("Error declining appointment:", error);
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

    res.json({ flows: CustomJobFlowSerializer.serializeArrayForList(flows) });
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

    res.status(201).json({ message: "Job flow created", flow: CustomJobFlowSerializer.serializeOne(flow) });
  } catch (error) {
    console.error("Error creating job flow:", error);
    res.status(400).json({ error: error.message });
  }
});

/**
 * GET /job-flows/assignments - List all flow assignments with clients and homes
 * Returns assignments, all clients, and all their homes for the assignment management screen
 */
router.get("/job-flows/assignments", async (req, res) => {
  try {
    // Get existing assignments
    const assignments = await CustomJobFlowService.getFlowAssignments(req.businessOwnerId);

    // Get all active clients for this business owner
    const cleanerClients = await CleanerClient.findAll({
      where: {
        cleanerId: req.businessOwnerId,
        status: "active",
      },
      include: [
        {
          model: User,
          as: "client",
          attributes: ["id", "firstName", "lastName", "email"],
          required: false,
        },
        {
          model: UserHomes,
          as: "home",
          required: false,
        },
      ],
      order: [["createdAt", "DESC"]],
    });

    // Build a map of clientId -> all their homes
    const clientHomeMap = new Map();
    const clientIds = new Set();

    for (const cc of cleanerClients) {
      if (cc.clientId) {
        clientIds.add(cc.clientId);
      }
    }

    // Fetch ALL homes for all clients (not just the ones linked to CleanerClient)
    if (clientIds.size > 0) {
      const allClientHomes = await UserHomes.findAll({
        where: {
          userId: { [Op.in]: Array.from(clientIds) },
        },
      });

      for (const home of allClientHomes) {
        if (!clientHomeMap.has(home.userId)) {
          clientHomeMap.set(home.userId, []);
        }
        clientHomeMap.get(home.userId).push({
          id: home.id,
          nickName: home.nickName,
          address: EncryptionService.decrypt(home.address),
          city: EncryptionService.decrypt(home.city),
          state: EncryptionService.decrypt(home.state),
          numBeds: home.numBeds,
          numBaths: home.numBaths,
        });
      }
    }

    // Format clients with all their homes
    const clients = cleanerClients.map((cc) => {
      const clientName = cc.client
        ? `${EncryptionService.decrypt(cc.client.firstName)} ${EncryptionService.decrypt(cc.client.lastName)}`
        : cc.invitedName || "Unknown Client";

      const clientEmail = cc.client
        ? EncryptionService.decrypt(cc.client.email)
        : cc.invitedEmail;

      // Get all homes for this client (from the map) or fall back to the single home from CleanerClient
      let homes = [];
      if (cc.clientId && clientHomeMap.has(cc.clientId)) {
        homes = clientHomeMap.get(cc.clientId);
      } else if (cc.home) {
        homes = [{
          id: cc.home.id,
          nickName: cc.home.nickName,
          address: EncryptionService.decrypt(cc.home.address),
          city: EncryptionService.decrypt(cc.home.city),
          state: EncryptionService.decrypt(cc.home.state),
          numBeds: cc.home.numBeds,
          numBaths: cc.home.numBaths,
        }];
      }

      return {
        id: cc.id,
        clientId: cc.clientId,
        clientName,
        clientEmail,
        status: cc.status,
        // Include single home for backwards compatibility
        home: cc.home ? {
          id: cc.home.id,
          nickName: cc.home.nickName,
          address: EncryptionService.decrypt(cc.home.address),
        } : null,
        // Include ALL homes for this client
        homes,
        homeCount: homes.length,
      };
    });

    res.json({
      assignments: ClientJobFlowAssignmentSerializer.serializeArrayForList(assignments),
      clients,
    });
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

    res.json({ flow: CustomJobFlowSerializer.serializeOne(flow, { includeChecklist: true, includeAssignments: true }) });
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

    res.json({ message: "Job flow updated", flow: CustomJobFlowSerializer.serializeOne(flow) });
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
      res.json({ message: "Job flow archived", flow: CustomJobFlowSerializer.serializeOne(flow) });
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

    res.json({ message: "Default flow updated", flow: CustomJobFlowSerializer.serializeOne(flow) });
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

    res.json({ checklist: flow.checklist ? CustomJobFlowChecklistSerializer.serializeOne(flow.checklist) : null });
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

    res.status(201).json({ message: "Checklist created", checklist: CustomJobFlowChecklistSerializer.serializeOne(checklist) });
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

    res.json({ message: "Checklist updated", checklist: CustomJobFlowChecklistSerializer.serializeOne(checklist) });
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

    res.status(201).json({ success: true, message: "Platform checklist forked", checklist: CustomJobFlowChecklistSerializer.serializeOne(checklist) });
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

    res.json({ message: "Item notes updated", checklist: CustomJobFlowChecklistSerializer.serializeOne(checklist) });
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

    res.status(201).json({ message: "Flow assigned to client", assignment: ClientJobFlowAssignmentSerializer.serializeOne(assignment) });
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

    res.status(201).json({ message: "Flow assigned to home", assignment: ClientJobFlowAssignmentSerializer.serializeOne(assignment) });
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

// =====================================
// Multi-Cleaner Team Booking Routes
// =====================================

/**
 * GET /team-for-job - Get available team members for a multi-cleaner job
 * Used when business owner wants to book a marketplace multi-cleaner job with their team
 */
router.get("/team-for-job", async (req, res) => {
  try {
    const { jobDate, startTime } = req.query;
    const businessOwnerId = req.businessOwnerId;

    if (!jobDate) {
      return res.status(400).json({ error: "jobDate is required" });
    }

    // Get business owner's user record to check Stripe Connect status
    const businessOwner = await User.findByPk(businessOwnerId);
    if (!businessOwner) {
      return res.status(404).json({ error: "Business owner not found" });
    }

    // Check if business owner can be included (has Stripe Connect)
    const selfHasStripeConnect = !!businessOwner.stripeConnectAccountId;

    // Get all active employees with their availability
    const employees = await BusinessEmployeeService.getEmployeesByBusinessOwner(
      businessOwnerId,
      { status: ["active"] }
    );

    // Parse job date for availability check
    const date = new Date(jobDate);
    const dayOfWeek = date.toLocaleDateString("en-US", { weekday: "lowercase" });

    // Check availability for each employee
    const teamMembers = employees.map((emp) => {
      let isAvailable = true;
      let unavailableReason = null;

      // Check if employee has accepted invite (has userId)
      if (!emp.userId) {
        isAvailable = false;
        unavailableReason = "Pending invite acceptance";
      } else {
        // Check schedule availability
        const schedule = emp.availableSchedule || {};
        const daySchedule = schedule[dayOfWeek];

        if (daySchedule && !daySchedule.available) {
          isAvailable = false;
          unavailableReason = "Not scheduled to work this day";
        } else if (daySchedule && startTime) {
          // Check time range if provided
          const jobTime = startTime;
          const start = daySchedule.start || "00:00";
          const end = daySchedule.end || "23:59";
          if (jobTime < start || jobTime > end) {
            isAvailable = false;
            unavailableReason = `Outside working hours (${start} - ${end})`;
          }
        }
      }

      return {
        id: emp.id,
        userId: emp.userId,
        firstName: emp.firstName ? EncryptionService.decrypt(emp.firstName) : null,
        lastName: emp.lastName ? EncryptionService.decrypt(emp.lastName) : null,
        isAvailable,
        unavailableReason,
        // Hourly rate in dollars (stored in cents in DB)
        hourlyRate: emp.defaultHourlyRate ? emp.defaultHourlyRate / 100 : null,
      };
    });

    res.json({
      canIncludeSelf: true, // Business owner can always include themselves
      selfHasStripeConnect,
      employees: teamMembers,
    });
  } catch (error) {
    console.error("Error fetching team for job:", error);
    res.status(500).json({ error: error.message });
  }
});

// =====================
// BUSINESS REVIEWS
// =====================

/**
 * GET /reviews
 * Get business client reviews (reviews for employees that appear on business profile)
 */
router.get("/reviews", async (req, res) => {
  try {
    const ReviewsClass = require("../../../services/ReviewsClass");
    const reviews = await ReviewsClass.getBusinessReviewsForOwner(req.businessOwnerId);

    // Serialize reviews
    const serializedReviews = reviews.map((review) => ({
      id: review.id,
      rating: review.review,
      comment: review.reviewComment,
      reviewerName: review.reviewerName,
      createdAt: review.createdAt,
      appointmentId: review.appointmentId,
      aspects: {
        cleaningQuality: review.cleaningQuality,
        punctuality: review.punctuality,
        professionalism: review.professionalism,
        communication: review.communication,
        attentionToDetail: review.attentionToDetail,
        thoroughness: review.thoroughness,
        respectOfProperty: review.respectOfProperty,
        followedInstructions: review.followedInstructions,
      },
      wouldRecommend: review.wouldRecommend,
    }));

    res.json({ reviews: serializedReviews });
  } catch (error) {
    console.error("Error fetching business reviews:", error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /reviews/stats
 * Get review statistics for business client reviews
 */
router.get("/reviews/stats", async (req, res) => {
  try {
    const ReviewsClass = require("../../../services/ReviewsClass");
    const stats = await ReviewsClass.getBusinessReviewStats(req.businessOwnerId);
    res.json(stats);
  } catch (error) {
    console.error("Error fetching business review stats:", error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
