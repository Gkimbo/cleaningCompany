/**
 * EmployeeJobAssignmentService - Handles job assignment to business employees
 * Manages assignment, completion, and pay tracking
 */

const { Op } = require("sequelize");
const {
  BusinessEmployee,
  EmployeeJobAssignment,
  EmployeePayChangeLog,
  UserAppointments,
  UserHomes,
  User,
  CleanerClient,
  AppointmentJobFlow,
  sequelize,
} = require("../models");
const MarketplaceJobRequirementsService = require("./MarketplaceJobRequirementsService");
const CustomJobFlowService = require("./CustomJobFlowService");
const AppointmentJobFlowService = require("./AppointmentJobFlowService");
const GuestNotLeftService = require("./GuestNotLeftService");
const AnalyticsService = require("./AnalyticsService");
const NotificationService = require("./NotificationService");
const { calculateDistance } = require("../utils/geoUtils");
const EncryptionService = require("./EncryptionService");

class EmployeeJobAssignmentService {
  /**
   * Calculate hours worked between two timestamps, rounded UP to nearest 0.5 hour
   * @param {Date} startTime - Start time
   * @param {Date} endTime - End time
   * @returns {number} Hours worked, rounded up to nearest 0.5
   */
  static calculateHoursWorked(startTime, endTime) {
    if (!startTime || !endTime) return 0;

    const start = new Date(startTime);
    const end = new Date(endTime);
    const diffMs = end - start;

    // Convert to hours
    const hours = diffMs / (1000 * 60 * 60);

    // Round up to nearest 0.5 hour
    // e.g., 1.1 -> 1.5, 1.6 -> 2.0, 2.0 -> 2.0
    const roundedUp = Math.ceil(hours * 2) / 2;

    // Minimum of 0.5 hours if any time was worked
    return hours > 0 ? Math.max(0.5, roundedUp) : 0;
  }

  /**
   * Assign an employee to a job
   * @param {number} businessOwnerId - ID of the business owner
   * @param {Object} assignmentData - Assignment details
   * @param {number} assignmentData.employeeId - BusinessEmployee ID
   * @param {number} assignmentData.appointmentId - Appointment ID
   * @param {number} assignmentData.payAmount - Pay amount in cents
   * @param {string} [assignmentData.payType] - 'flat_rate' or 'hourly'
   * @returns {Promise<Object>} Created assignment
   */
  static async assignEmployeeToJob(businessOwnerId, assignmentData) {
    const { employeeId, appointmentId, payAmount, payType = "flat_rate" } = assignmentData;

    // Verify employee belongs to this business owner
    const employee = await BusinessEmployee.findOne({
      where: {
        id: employeeId,
        businessOwnerId,
        status: "active",
      },
    });

    if (!employee) {
      throw new Error("Employee not found or not active");
    }

    // Verify appointment exists and belongs to this business owner's client
    const appointment = await UserAppointments.findOne({
      where: { id: appointmentId },
      include: [
        {
          model: UserHomes,
          as: "home",
        },
      ],
    });

    if (!appointment) {
      throw new Error("Appointment not found");
    }

    // Check if this appointment is already assigned to an employee
    const existingAssignment = await EmployeeJobAssignment.findOne({
      where: {
        appointmentId,
        businessOwnerId,
        status: { [Op.notIn]: ["cancelled", "no_show"] },
      },
    });

    if (existingAssignment) {
      throw new Error("This appointment is already assigned to an employee");
    }

    // Resolve the job flow for this appointment
    const flowResolution = await CustomJobFlowService.resolveFlowForAppointment(
      appointment,
      businessOwnerId,
      assignmentData.jobFlowOverride // Optional job-level override
    );

    const isMarketplacePickup = flowResolution.usesPlatformFlow;

    // Create the assignment and job flow
    const assignment = await sequelize.transaction(async (t) => {
      // Create or get the AppointmentJobFlow
      let jobFlow = await AppointmentJobFlow.findOne({
        where: { appointmentId },
        transaction: t,
      });

      if (!jobFlow) {
        jobFlow = await AppointmentJobFlowService.createJobFlowForAppointment(
          appointmentId,
          flowResolution
        );
      }

      const newAssignment = await EmployeeJobAssignment.create(
        {
          businessEmployeeId: employeeId,
          appointmentId,
          businessOwnerId,
          assignedAt: new Date(),
          assignedBy: businessOwnerId,
          status: "assigned",
          payAmount,
          payType,
          isSelfAssignment: false,
          isMarketplacePickup,
          appointmentJobFlowId: jobFlow.id,
          // Legacy fields - still populated for backwards compatibility
          checklistProgress: jobFlow.checklistProgress,
        },
        { transaction: t }
      );

      // Update appointment to reflect assignment
      await appointment.update(
        {
          assignedToBusinessEmployee: true,
          businessEmployeeAssignmentId: newAssignment.id,
          hasBeenAssigned: true,
        },
        { transaction: t }
      );

      return newAssignment;
    });

    // Send notification to the employee (after transaction completes)
    try {
      // Get the employee's user record for notification
      const employeeUser = await User.findByPk(employee.userId);

      // Get client info
      const client = await User.findByPk(appointment.userId);

      // Get business owner info
      const businessOwner = await User.findByPk(businessOwnerId);

      // Only send notification if employee has a user account with email or push token
      if (employeeUser && (employeeUser.email || employeeUser.expoPushToken)) {
        const home = appointment.home || await UserHomes.findByPk(appointment.homeId);

        await NotificationService.notifyEmployeeJobAssigned({
          employeeUserId: employee.userId,
          employeeName: employee.firstName || "Team Member",
          appointmentId,
          appointmentDate: appointment.date,
          clientName: client ? `${client.firstName || ""} ${client.lastName || ""}`.trim() : "Client",
          address: home?.address || "Address on file",
          payAmount,
          businessName: businessOwner?.businessName || "Your employer",
        });
      }
    } catch (notificationError) {
      // Log but don't fail the assignment if notification fails
      console.error("[EmployeeJobAssignmentService] Failed to send job assignment notification:", notificationError);
    }

    return assignment;
  }

  /**
   * Assign business owner to their own job (self-assignment)
   * @param {number} businessOwnerId - ID of the business owner
   * @param {number} appointmentId - Appointment ID
   * @returns {Promise<Object>} Created assignment
   */
  static async assignSelfToJob(businessOwnerId, appointmentId) {
    // Verify business owner
    const businessOwner = await User.findByPk(businessOwnerId);
    if (!businessOwner || !businessOwner.isBusinessOwner) {
      throw new Error("Invalid business owner");
    }

    // Verify appointment exists
    const appointment = await UserAppointments.findByPk(appointmentId);
    if (!appointment) {
      throw new Error("Appointment not found");
    }

    // Check if already assigned
    const existingAssignment = await EmployeeJobAssignment.findOne({
      where: {
        appointmentId,
        businessOwnerId,
        status: { [Op.notIn]: ["cancelled", "no_show"] },
      },
    });

    if (existingAssignment) {
      throw new Error("This appointment is already assigned");
    }

    // Resolve the job flow for this appointment
    const flowResolution = await CustomJobFlowService.resolveFlowForAppointment(
      appointment,
      businessOwnerId
    );

    const isMarketplacePickup = flowResolution.usesPlatformFlow;

    // Create self-assignment with $0 pay
    const assignment = await sequelize.transaction(async (t) => {
      // Create or get the AppointmentJobFlow
      let jobFlow = await AppointmentJobFlow.findOne({
        where: { appointmentId },
        transaction: t,
      });

      if (!jobFlow) {
        jobFlow = await AppointmentJobFlowService.createJobFlowForAppointment(
          appointmentId,
          flowResolution
        );
      }

      const newAssignment = await EmployeeJobAssignment.create(
        {
          businessEmployeeId: null, // No employee - self assignment
          appointmentId,
          businessOwnerId,
          assignedAt: new Date(),
          assignedBy: businessOwnerId,
          status: "assigned",
          payAmount: 0, // $0 for self-assignment
          payType: "flat_rate",
          isSelfAssignment: true,
          isMarketplacePickup,
          appointmentJobFlowId: jobFlow.id,
          // Legacy fields - still populated for backwards compatibility
          checklistProgress: jobFlow.checklistProgress,
        },
        { transaction: t }
      );

      // Update appointment
      await appointment.update(
        {
          assignedToBusinessEmployee: true,
          businessEmployeeAssignmentId: newAssignment.id,
          hasBeenAssigned: true,
        },
        { transaction: t }
      );

      return newAssignment;
    });

    return assignment;
  }

  /**
   * Unassign an employee from a job
   * @param {number} assignmentId - Assignment ID
   * @param {number} businessOwnerId - ID of the business owner
   * @returns {Promise<void>}
   */
  static async unassignFromJob(assignmentId, businessOwnerId) {
    const assignment = await EmployeeJobAssignment.findOne({
      where: {
        id: assignmentId,
        businessOwnerId,
        status: "assigned", // Can only unassign if not started
      },
    });

    if (!assignment) {
      throw new Error("Assignment not found or cannot be unassigned");
    }

    await sequelize.transaction(async (t) => {
      // Update the appointment
      await UserAppointments.update(
        {
          assignedToBusinessEmployee: false,
          businessEmployeeAssignmentId: null,
        },
        {
          where: { id: assignment.appointmentId },
          transaction: t,
        }
      );

      // Update assignment status
      await assignment.update(
        { status: "cancelled" },
        { transaction: t }
      );
    });
  }

  /**
   * Reassign a job to a different employee
   * @param {number} assignmentId - Current assignment ID
   * @param {number} newEmployeeId - New BusinessEmployee ID
   * @param {number} businessOwnerId - ID of the business owner
   * @returns {Promise<Object>} New assignment
   */
  static async reassignJob(assignmentId, newEmployeeId, businessOwnerId) {
    const currentAssignment = await EmployeeJobAssignment.findOne({
      where: {
        id: assignmentId,
        businessOwnerId,
        status: "assigned",
      },
    });

    if (!currentAssignment) {
      throw new Error("Assignment not found or cannot be reassigned");
    }

    // Verify new employee
    const newEmployee = await BusinessEmployee.findOne({
      where: {
        id: newEmployeeId,
        businessOwnerId,
        status: "active",
      },
    });

    if (!newEmployee) {
      throw new Error("New employee not found or not active");
    }

    // Transaction to cancel old and create new
    const newAssignment = await sequelize.transaction(async (t) => {
      // Cancel old assignment
      await currentAssignment.update(
        { status: "cancelled" },
        { transaction: t }
      );

      // Create new assignment
      const assignment = await EmployeeJobAssignment.create(
        {
          businessEmployeeId: newEmployeeId,
          appointmentId: currentAssignment.appointmentId,
          businessOwnerId,
          assignedAt: new Date(),
          assignedBy: businessOwnerId,
          status: "assigned",
          payAmount: currentAssignment.payAmount,
          payType: currentAssignment.payType,
          isSelfAssignment: false,
        },
        { transaction: t }
      );

      // Update appointment
      await UserAppointments.update(
        { businessEmployeeAssignmentId: assignment.id },
        {
          where: { id: currentAssignment.appointmentId },
          transaction: t,
        }
      );

      return assignment;
    });

    // Send notifications after transaction completes
    try {
      // Get appointment details
      const appointment = await UserAppointments.findByPk(currentAssignment.appointmentId, {
        include: [{ model: UserHomes, as: "home" }],
      });

      // Get client info
      const client = await User.findByPk(appointment?.userId);

      // Get business owner info
      const businessOwner = await User.findByPk(businessOwnerId);

      // Notify new employee about the assignment
      const newEmployeeUser = await User.findByPk(newEmployee.userId);
      if (newEmployeeUser && (newEmployeeUser.email || newEmployeeUser.expoPushToken)) {
        await NotificationService.notifyEmployeeJobAssigned({
          employeeUserId: newEmployee.userId,
          employeeName: newEmployee.firstName || "Team Member",
          appointmentId: currentAssignment.appointmentId,
          appointmentDate: appointment?.date,
          clientName: client ? `${client.firstName || ""} ${client.lastName || ""}`.trim() : "Client",
          address: appointment?.home?.address || "Address on file",
          payAmount: currentAssignment.payAmount,
          businessName: businessOwner?.businessName || "Your employer",
        });
      }

      // Notify old employee about being unassigned (if they had a user account)
      const oldEmployee = await BusinessEmployee.findByPk(currentAssignment.businessEmployeeId);
      if (oldEmployee?.userId) {
        await NotificationService.notifyEmployeeJobReassigned({
          employeeUserId: oldEmployee.userId,
          appointmentId: currentAssignment.appointmentId,
          appointmentDate: appointment?.date,
        });
      }
    } catch (notificationError) {
      console.error("[EmployeeJobAssignmentService] Failed to send reassignment notifications:", notificationError);
    }

    return newAssignment;
  }

  /**
   * Update pay amount for an assignment
   * @param {number} assignmentId - Assignment ID
   * @param {number} businessOwnerId - ID of the business owner
   * @param {Object} payData - Pay update data
   * @param {number} payData.newPayAmount - New pay amount in cents
   * @param {string} [payData.reason] - Reason for change
   * @returns {Promise<Object>} Updated assignment
   */
  static async updateJobPay(assignmentId, businessOwnerId, payData) {
    const { newPayAmount, reason } = payData;

    const assignment = await EmployeeJobAssignment.findOne({
      where: {
        id: assignmentId,
        businessOwnerId,
        status: { [Op.notIn]: ["paid", "paid_outside_platform"] },
      },
    });

    if (!assignment) {
      throw new Error("Assignment not found or already paid");
    }

    const previousPayAmount = assignment.payAmount;

    await sequelize.transaction(async (t) => {
      // Log the change
      await EmployeePayChangeLog.create(
        {
          employeeJobAssignmentId: assignmentId,
          businessOwnerId,
          previousPayAmount,
          newPayAmount,
          reason,
          changedAt: new Date(),
          changedBy: businessOwnerId,
        },
        { transaction: t }
      );

      // Update the assignment
      await assignment.update(
        {
          payAmount: newPayAmount,
          payAdjustmentReason: reason,
        },
        { transaction: t }
      );
    });

    // Track pay override analytics
    await AnalyticsService.trackPayOverride(
      assignment.appointmentId,
      assignment.employeeId,
      previousPayAmount,
      newPayAmount,
      reason || "unspecified",
      businessOwnerId
    );

    return assignment.reload();
  }

  /**
   * Get pay change history for an assignment
   * @param {number} assignmentId - Assignment ID
   * @returns {Promise<Object[]>} Array of pay change logs
   */
  static async getPayChangeHistory(assignmentId) {
    return EmployeePayChangeLog.findAll({
      where: { employeeJobAssignmentId: assignmentId },
      include: [
        {
          model: User,
          as: "changedByUser",
          attributes: ["id", "firstName", "lastName"],
        },
      ],
      order: [["changedAt", "DESC"]],
    });
  }

  /**
   * Start a job (employee action)
   * @param {number} assignmentId - Assignment ID
   * @param {number} employeeUserId - User ID of the employee
   * @param {Object} [locationData] - Optional GPS coordinates { latitude, longitude }
   * @returns {Promise<Object>} Updated assignment
   */
  static async startJob(assignmentId, employeeUserId, locationData = {}) {
    // Find employee record for this user
    const employee = await BusinessEmployee.findOne({
      where: {
        userId: employeeUserId,
        status: "active",
      },
    });

    if (!employee) {
      throw new Error("Employee record not found");
    }

    const assignment = await EmployeeJobAssignment.findOne({
      where: {
        id: assignmentId,
        [Op.or]: [
          { businessEmployeeId: employee.id },
          { businessOwnerId: employeeUserId, isSelfAssignment: true },
        ],
        status: "assigned",
      },
      include: [
        {
          model: UserAppointments,
          as: "appointment",
          include: [{ model: UserHomes, as: "home" }],
        },
      ],
    });

    if (!assignment) {
      throw new Error("Assignment not found or cannot be started");
    }

    // Calculate distance from home if GPS data provided
    const { latitude, longitude } = locationData;
    let startDistanceFromHome = null;
    let startLocationVerified = null;

    if (latitude && longitude) {
      const home = assignment.appointment?.home;
      if (home?.latitude && home?.longitude) {
        const homeLat = parseFloat(EncryptionService.decrypt(home.latitude));
        const homeLon = parseFloat(EncryptionService.decrypt(home.longitude));

        if (homeLat && homeLon) {
          startDistanceFromHome = calculateDistance(latitude, longitude, homeLat, homeLon);
          startLocationVerified = true;
        }
      }
    }

    // Clear any guest not left flag
    await GuestNotLeftService.clearGuestNotLeftFlag(assignmentId);

    await assignment.update({
      status: "started",
      startedAt: new Date(),
      startLatitude: latitude || null,
      startLongitude: longitude || null,
      startDistanceFromHome,
      startLocationVerified,
    });

    return assignment;
  }

  /**
   * Complete a job (employee action)
   * @param {number} assignmentId - Assignment ID
   * @param {number} employeeUserId - User ID of the employee
   * @param {number} [hoursWorked] - Hours worked (for hourly jobs)
   * @returns {Promise<Object>} Updated assignment
   */
  static async completeJob(assignmentId, employeeUserId, hoursWorked = null) {
    // Find employee record for this user
    const employee = await BusinessEmployee.findOne({
      where: {
        userId: employeeUserId,
        status: "active",
      },
    });

    const assignment = await EmployeeJobAssignment.findOne({
      where: {
        id: assignmentId,
        [Op.or]: [
          { businessEmployeeId: employee?.id },
          { businessOwnerId: employeeUserId, isSelfAssignment: true },
        ],
        status: "started",
      },
      include: [
        {
          model: UserAppointments,
          as: "appointment",
          attributes: ["id", "price"],
        },
      ],
    });

    if (!assignment) {
      throw new Error("Assignment not found or cannot be completed");
    }

    // Validate completion requirements using AppointmentJobFlow
    if (assignment.appointmentJobFlowId) {
      await AppointmentJobFlowService.validateCompletionRequirements(assignment.appointmentJobFlowId);
    } else if (assignment.isMarketplacePickup) {
      // Fallback to old method for legacy assignments
      await MarketplaceJobRequirementsService.validateCompletionRequirements(assignmentId);
    }

    const completedAt = new Date();
    const updateData = {
      status: "completed",
      completedAt,
    };

    // Calculate pay based on pay type
    const payType = assignment.payType;

    if (payType === "hourly") {
      // Hourly: pay = hours worked × hourly rate
      let calculatedHours = hoursWorked;
      if (!calculatedHours && assignment.startedAt) {
        calculatedHours = this.calculateHoursWorked(assignment.startedAt, completedAt);
      }

      if (calculatedHours) {
        updateData.hoursWorked = calculatedHours;
        const hourlyRate = employee?.defaultHourlyRate || 0;
        updateData.payAmount = Math.round(hourlyRate * calculatedHours);
      }
    } else if (payType === "per_job" || payType === "flat_rate") {
      // Per Job / Flat Rate: pay = employee's default job rate
      const jobRate = employee?.defaultJobRate || 0;
      if (jobRate > 0) {
        updateData.payAmount = jobRate;
      }
      // Also track hours if available (for records, not pay calculation)
      if (hoursWorked) {
        updateData.hoursWorked = hoursWorked;
      } else if (assignment.startedAt) {
        updateData.hoursWorked = this.calculateHoursWorked(assignment.startedAt, completedAt);
      }
    } else if (payType === "percentage") {
      // Percentage: pay = (percentage / 100) × job price
      const appointmentPrice = assignment.appointment?.price || 0;
      const payRate = parseFloat(employee?.payRate) || 0;
      if (payRate > 0 && appointmentPrice > 0) {
        updateData.payAmount = Math.round((payRate / 100) * appointmentPrice);
      }
      // Also track hours if available (for records, not pay calculation)
      if (hoursWorked) {
        updateData.hoursWorked = hoursWorked;
      } else if (assignment.startedAt) {
        updateData.hoursWorked = this.calculateHoursWorked(assignment.startedAt, completedAt);
      }
    }

    await assignment.update(updateData);

    // Also mark appointment as completed
    await UserAppointments.update(
      { completed: true },
      { where: { id: assignment.appointmentId } }
    );

    return assignment;
  }

  /**
   * Update hours worked for a completed assignment (business owner action)
   * Recalculates pay based on the new hours if the assignment is hourly
   * @param {number} assignmentId - Assignment ID
   * @param {number} businessOwnerId - ID of the business owner
   * @param {number} hoursWorked - New hours worked value
   * @returns {Promise<Object>} Updated assignment with employee info
   */
  static async updateHoursWorked(assignmentId, businessOwnerId, hoursWorked) {
    const assignment = await EmployeeJobAssignment.findOne({
      where: {
        id: assignmentId,
        businessOwnerId,
        status: "completed",
      },
      include: [
        {
          model: BusinessEmployee,
          as: "employee",
          attributes: ["id", "firstName", "lastName", "defaultHourlyRate", "payType"],
        },
      ],
    });

    if (!assignment) {
      throw new Error("Completed assignment not found");
    }

    // Round to nearest 0.5 hours
    const roundedHours = Math.ceil(hoursWorked * 2) / 2;

    const updateData = {
      hoursWorked: roundedHours,
    };

    // Recalculate pay if this is an hourly assignment
    if (assignment.payType === "hourly" && assignment.employee) {
      const hourlyRate = assignment.employee.defaultHourlyRate || 0;
      updateData.payAmount = Math.round(hourlyRate * roundedHours);
    }

    await assignment.update(updateData);

    // Reload to get fresh data
    await assignment.reload({
      include: [
        {
          model: BusinessEmployee,
          as: "employee",
          attributes: ["id", "firstName", "lastName", "defaultHourlyRate", "payType"],
        },
      ],
    });

    return assignment;
  }

  /**
   * Mark assignment as no-show (business owner action)
   * @param {number} assignmentId - Assignment ID
   * @param {number} businessOwnerId - ID of the business owner
   * @returns {Promise<Object>} Updated assignment
   */
  static async markNoShow(assignmentId, businessOwnerId) {
    const assignment = await EmployeeJobAssignment.findOne({
      where: {
        id: assignmentId,
        businessOwnerId,
        status: { [Op.in]: ["assigned", "started"] },
      },
    });

    if (!assignment) {
      throw new Error("Assignment not found");
    }

    await sequelize.transaction(async (t) => {
      await assignment.update(
        {
          status: "no_show",
          payAmount: 0, // No pay for no-show
        },
        { transaction: t }
      );

      // Update appointment
      await UserAppointments.update(
        {
          assignedToBusinessEmployee: false,
          businessEmployeeAssignmentId: null,
        },
        {
          where: { id: assignment.appointmentId },
          transaction: t,
        }
      );
    });

    return assignment;
  }

  /**
   * Get assignments by employee
   * @param {number} employeeId - BusinessEmployee ID
   * @param {Object} [filters] - Query filters
   * @param {string[]} [filters.status] - Filter by status(es)
   * @param {string} [filters.startDate] - Filter by date range start
   * @param {string} [filters.endDate] - Filter by date range end
   * @returns {Promise<Object[]>} Array of assignments
   */
  static async getAssignmentsByEmployee(employeeId, filters = {}) {
    const { status, startDate, endDate } = filters;

    const where = { businessEmployeeId: employeeId };
    if (status && status.length > 0) {
      where.status = status;
    }

    const appointmentWhere = {};
    if (startDate) {
      appointmentWhere.date = { [Op.gte]: startDate };
    }
    if (endDate) {
      appointmentWhere.date = {
        ...appointmentWhere.date,
        [Op.lte]: endDate,
      };
    }

    return EmployeeJobAssignment.findAll({
      where,
      include: [
        {
          model: UserAppointments,
          as: "appointment",
          where: Object.keys(appointmentWhere).length > 0 ? appointmentWhere : undefined,
          include: [
            {
              model: UserHomes,
              as: "home",
              attributes: ["id", "address", "numBeds", "numBaths"],
            },
          ],
        },
      ],
      order: [[{ model: UserAppointments, as: "appointment" }, "date", "ASC"]],
    });
  }

  /**
   * Get upcoming assignments for a business owner
   * @param {number} businessOwnerId - ID of the business owner
   * @param {string} startDate - Start date (YYYY-MM-DD)
   * @param {string} endDate - End date (YYYY-MM-DD)
   * @returns {Promise<Object[]>} Array of assignments
   */
  static async getUpcomingAssignments(businessOwnerId, startDate, endDate) {
    return EmployeeJobAssignment.findAll({
      where: {
        businessOwnerId,
        status: { [Op.in]: ["assigned", "started"] },
      },
      include: [
        {
          model: BusinessEmployee,
          as: "employee",
          attributes: ["id", "firstName", "lastName"],
        },
        {
          model: UserAppointments,
          as: "appointment",
          where: {
            date: {
              [Op.gte]: startDate,
              [Op.lte]: endDate,
            },
          },
          include: [
            {
              model: UserHomes,
              as: "home",
              attributes: ["id", "address", "numBeds", "numBaths"],
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
      order: [[{ model: UserAppointments, as: "appointment" }, "date", "ASC"]],
    });
  }

  /**
   * Get unpaid assignments for a business owner
   * @param {number} businessOwnerId - ID of the business owner
   * @returns {Promise<Object[]>} Array of unpaid completed assignments
   */
  static async getUnpaidAssignments(businessOwnerId) {
    return EmployeeJobAssignment.findAll({
      where: {
        businessOwnerId,
        status: "completed",
        payoutStatus: "pending",
        isSelfAssignment: false, // Don't include self-assignments
        payAmount: { [Op.gt]: 0 }, // Only include assignments with pay
      },
      include: [
        {
          model: BusinessEmployee,
          as: "employee",
          attributes: ["id", "firstName", "lastName", "paymentMethod", "payType", "defaultHourlyRate"],
        },
        {
          model: UserAppointments,
          as: "appointment",
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
      order: [["completedAt", "ASC"]],
    });
  }

  /**
   * Get employee's job list (for employee-facing views)
   * Employees can only see jobs assigned to them that are in valid states
   * For marketplace jobs, address visibility is restricted until closer to job time
   * @param {number} employeeUserId - User ID of the employee
   * @param {Object} [filters] - Query filters
   * @returns {Promise<Object[]>} Array of assignments with visibility-filtered data
   */
  static async getMyJobs(employeeUserId, filters = {}) {
    const { status, upcoming } = filters;

    // Find employee record
    const employee = await BusinessEmployee.findOne({
      where: {
        userId: employeeUserId,
        status: "active",
      },
    });

    if (!employee) {
      throw new Error("Employee record not found");
    }

    // Only show assignments that are not cancelled or no_show
    const where = {
      businessEmployeeId: employee.id,
      status: { [Op.notIn]: ["cancelled", "no_show"] },
    };
    if (status) {
      where.status = status;
    }

    const appointmentWhere = {
      // Exclude completed appointments
      completed: false,
    };
    if (upcoming) {
      appointmentWhere.date = { [Op.gte]: new Date().toISOString().split("T")[0] };
    }

    const assignments = await EmployeeJobAssignment.findAll({
      where,
      include: [
        {
          model: UserAppointments,
          as: "appointment",
          where: Object.keys(appointmentWhere).length > 0 ? appointmentWhere : undefined,
          include: [
            {
              model: UserHomes,
              as: "home",
              // For now, fetch all fields - we'll filter them per-assignment below
              attributes: ["id", "address", "numBeds", "numBaths", "keyPadCode", "keyLocation"],
            },
            {
              model: User,
              as: "user",
              attributes: ["id", "firstName", "lastName", "phone"],
            },
          ],
        },
      ],
      order: [[{ model: UserAppointments, as: "appointment" }, "date", "ASC"]],
    });

    // Apply visibility restrictions per assignment
    return assignments.map((assignment) => {
      const plainAssignment = assignment.get({ plain: true });

      // Check if employee has permission to view client details
      const canViewDetails = employee.canViewClientDetails;

      // For marketplace jobs, restrict full address until within 24 hours of job or job is started
      const isMarketplace = plainAssignment.isMarketplacePickup;
      const jobDate = new Date(plainAssignment.appointment.date);
      const now = new Date();
      const hoursUntilJob = (jobDate - now) / (1000 * 60 * 60);
      const isWithin24Hours = hoursUntilJob <= 24;
      const hasStarted = plainAssignment.status === "started" || plainAssignment.status === "completed";

      // Determine if full address should be shown
      const showFullAddress = canViewDetails && (!isMarketplace || isWithin24Hours || hasStarted);

      // Filter home data based on permissions
      if (plainAssignment.appointment.home) {
        if (!showFullAddress) {
          // For marketplace jobs not yet within 24 hours, show city/area only
          const fullAddress = plainAssignment.appointment.home.address;
          plainAssignment.appointment.home = {
            id: plainAssignment.appointment.home.id,
            numBeds: plainAssignment.appointment.home.numBeds,
            numBaths: plainAssignment.appointment.home.numBaths,
            // Show general area (city) for planning purposes
            generalArea: this.extractGeneralArea(fullAddress),
            addressRestricted: isMarketplace && !isWithin24Hours && !hasStarted,
          };
        } else if (!canViewDetails) {
          // No permission to view client details
          plainAssignment.appointment.home = {
            id: plainAssignment.appointment.home.id,
            numBeds: plainAssignment.appointment.home.numBeds,
            numBaths: plainAssignment.appointment.home.numBaths,
          };
        }
      }

      // Filter user data based on permissions
      if (plainAssignment.appointment.user) {
        if (!canViewDetails) {
          plainAssignment.appointment.user = {
            id: plainAssignment.appointment.user.id,
            firstName: plainAssignment.appointment.user.firstName,
          };
        }
      }

      return plainAssignment;
    });
  }

  /**
   * Extract city/general area from a full address for marketplace jobs
   * @param {string} fullAddress - The complete address
   * @returns {string} General area/city name
   */
  static extractGeneralArea(fullAddress) {
    if (!fullAddress) return "Location pending";

    // Try to extract city from common address formats
    // Format: "123 Main St, City, State ZIP" or "123 Main St, City State ZIP"
    const parts = fullAddress.split(",");
    if (parts.length >= 2) {
      // Get the city part (usually second-to-last or second part)
      const cityPart = parts[parts.length - 2] || parts[1];
      return cityPart.trim().split(" ")[0] + " area";
    }

    return "Location confirmed";
  }

  /**
   * Get timesheet data for all employees (hours summary)
   * @param {number} businessOwnerId - ID of the business owner
   * @param {string} startDate - Start date (YYYY-MM-DD)
   * @param {string} endDate - End date (YYYY-MM-DD)
   * @returns {Promise<Object>} Timesheet data with employee summaries and job details
   */
  static async getTimesheetData(businessOwnerId, startDate, endDate) {
    // Get all completed assignments with hours in the date range
    const assignments = await EmployeeJobAssignment.findAll({
      where: {
        businessOwnerId,
        status: "completed",
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
            date: {
              [Op.gte]: startDate,
              [Op.lte]: endDate,
            },
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
      order: [[{ model: UserAppointments, as: "appointment" }, "date", "ASC"]],
    });

    // Group by employee and calculate totals
    const employeeMap = new Map();
    let totalHours = 0;
    let totalPay = 0;

    assignments.forEach((assignment) => {
      const data = assignment.dataValues || assignment;
      const empId = data.businessEmployeeId;

      if (!employeeMap.has(empId)) {
        employeeMap.set(empId, {
          employee: data.employee,
          totalHours: 0,
          totalPay: 0,
          jobCount: 0,
          jobs: [],
        });
      }

      const summary = employeeMap.get(empId);
      const hours = parseFloat(data.hoursWorked) || 0;
      const pay = data.payAmount || 0;

      summary.totalHours += hours;
      summary.totalPay += pay;
      summary.jobCount++;
      summary.jobs.push({
        id: data.id,
        date: data.appointment?.date,
        hoursWorked: hours,
        payAmount: pay,
        payType: data.payType,
        startedAt: data.startedAt,
        completedAt: data.completedAt,
        address: data.appointment?.home?.address,
      });

      totalHours += hours;
      totalPay += pay;
    });

    // Convert map to array and sort by total hours
    const employeeSummaries = Array.from(employeeMap.values())
      .sort((a, b) => b.totalHours - a.totalHours);

    return {
      startDate,
      endDate,
      totalHours,
      totalPay,
      employeeCount: employeeSummaries.length,
      jobCount: assignments.length,
      employees: employeeSummaries,
    };
  }

  /**
   * Get hours detail for a specific employee
   * @param {number} businessOwnerId - ID of the business owner
   * @param {number} employeeId - BusinessEmployee ID
   * @param {string} startDate - Start date (YYYY-MM-DD)
   * @param {string} endDate - End date (YYYY-MM-DD)
   * @returns {Promise<Object>} Employee hours detail with daily breakdown
   */
  static async getEmployeeHoursDetail(businessOwnerId, employeeId, startDate, endDate) {
    // Verify employee belongs to this business owner
    const employee = await BusinessEmployee.findOne({
      where: {
        id: employeeId,
        businessOwnerId,
      },
      attributes: ["id", "firstName", "lastName", "payType", "defaultHourlyRate", "defaultJobRate"],
    });

    if (!employee) {
      throw new Error("Employee not found");
    }

    // Get all assignments for this employee in the date range
    const assignments = await EmployeeJobAssignment.findAll({
      where: {
        businessOwnerId,
        businessEmployeeId: employeeId,
        status: { [Op.in]: ["completed", "started", "assigned"] },
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
          include: [
            {
              model: UserHomes,
              as: "home",
              attributes: ["id", "address", "numBeds", "numBaths"],
            },
            {
              model: User,
              as: "user",
              attributes: ["id", "firstName", "lastName"],
            },
          ],
        },
      ],
      order: [[{ model: UserAppointments, as: "appointment" }, "date", "ASC"]],
    });

    // Group by date for daily breakdown
    const dailyMap = new Map();
    let totalHours = 0;
    let totalPay = 0;
    let completedJobs = 0;
    let pendingJobs = 0;

    assignments.forEach((assignment) => {
      const data = assignment.dataValues || assignment;
      const date = data.appointment?.date;

      if (!dailyMap.has(date)) {
        dailyMap.set(date, {
          date,
          hours: 0,
          pay: 0,
          jobs: [],
        });
      }

      const dayData = dailyMap.get(date);
      const hours = parseFloat(data.hoursWorked) || 0;
      const pay = data.payAmount || 0;

      dayData.hours += hours;
      dayData.pay += pay;
      dayData.jobs.push({
        id: data.id,
        status: data.status,
        hoursWorked: hours,
        payAmount: pay,
        payType: data.payType,
        startedAt: data.startedAt,
        completedAt: data.completedAt,
        address: data.appointment?.home?.address,
        client: data.appointment?.user
          ? `${data.appointment.user.firstName || ""} ${data.appointment.user.lastName || ""}`.trim()
          : null,
        home: data.appointment?.home
          ? { numBeds: data.appointment.home.numBeds, numBaths: data.appointment.home.numBaths }
          : null,
      });

      if (data.status === "completed") {
        totalHours += hours;
        totalPay += pay;
        completedJobs++;
      } else {
        pendingJobs++;
      }
    });

    // Convert map to array and sort by date descending (most recent first)
    const dailyBreakdown = Array.from(dailyMap.values())
      .sort((a, b) => new Date(b.date) - new Date(a.date));

    // Calculate weekly totals
    const weeklyTotals = this.calculateWeeklyTotals(dailyBreakdown);

    return {
      employee: {
        id: employee.id,
        firstName: employee.firstName,
        lastName: employee.lastName,
        payType: employee.payType,
        hourlyRate: employee.defaultHourlyRate,
        jobRate: employee.defaultJobRate,
      },
      startDate,
      endDate,
      totalHours,
      totalPay,
      completedJobs,
      pendingJobs,
      dailyBreakdown,
      weeklyTotals,
    };
  }

  /**
   * Get employee workload data for fair job distribution
   * @param {number} businessOwnerId - ID of the business owner
   * @returns {Promise<Object>} Workload data with employee metrics and team averages
   */
  static async getEmployeeWorkloadData(businessOwnerId) {
    const now = new Date();
    const today = now.toISOString().split("T")[0];

    // Calculate date ranges
    const dayOfWeek = now.getDay();
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - dayOfWeek);
    const weekStartStr = weekStart.toISOString().split("T")[0];

    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthStartStr = monthStart.toISOString().split("T")[0];

    const yearStart = new Date(now.getFullYear(), 0, 1);
    const yearStartStr = yearStart.toISOString().split("T")[0];

    // Get all active employees with their employment start date
    const employees = await BusinessEmployee.findAll({
      where: {
        businessOwnerId,
        status: "active",
      },
      attributes: ["id", "firstName", "lastName", "userId", "acceptedAt", "createdAt"],
      order: [["firstName", "ASC"]],
    });

    if (employees.length === 0) {
      return {
        employees: [],
        teamAverage: { hoursPerWeek: 0, hoursThisWeek: 0 },
        unassignedJobCount: 0,
      };
    }

    // Get all completed assignments for these employees
    const employeeIds = employees.map((e) => e.id);
    const allAssignments = await EmployeeJobAssignment.findAll({
      where: {
        businessOwnerId,
        businessEmployeeId: { [Op.in]: employeeIds },
        status: "completed",
        isSelfAssignment: false,
      },
      include: [
        {
          model: UserAppointments,
          as: "appointment",
          attributes: ["id", "date"],
        },
      ],
    });

    // Calculate metrics for each employee
    const employeeMetrics = employees.map((employee) => {
      const employedSince = employee.acceptedAt || employee.createdAt;
      const employmentDays = Math.floor((now - new Date(employedSince)) / (1000 * 60 * 60 * 24));
      const employmentWeeks = Math.max(1, Math.floor(employmentDays / 7));

      // Filter assignments for this employee
      const empAssignments = allAssignments.filter(
        (a) => a.businessEmployeeId === employee.id
      );

      // Calculate hours for different periods
      let hoursThisWeek = 0;
      let hoursThisMonth = 0;
      let hoursThisYear = 0;
      let hoursAllTime = 0;
      let jobsThisWeek = 0;
      let jobsThisMonth = 0;
      let jobsAllTime = 0;

      empAssignments.forEach((assignment) => {
        const hours = parseFloat(assignment.hoursWorked) || 0;
        const jobDate = assignment.appointment?.date;

        hoursAllTime += hours;
        jobsAllTime++;

        if (jobDate >= weekStartStr && jobDate <= today) {
          hoursThisWeek += hours;
          jobsThisWeek++;
        }
        if (jobDate >= monthStartStr && jobDate <= today) {
          hoursThisMonth += hours;
          jobsThisMonth++;
        }
        if (jobDate >= yearStartStr && jobDate <= today) {
          hoursThisYear += hours;
        }
      });

      const avgHoursPerWeek = hoursAllTime / employmentWeeks;

      return {
        id: employee.id,
        firstName: employee.firstName,
        lastName: employee.lastName,
        userId: employee.userId,
        employedSince,
        employmentDays,
        employmentWeeks,
        isNew: employmentDays < 7,
        hours: {
          thisWeek: parseFloat(hoursThisWeek.toFixed(1)),
          thisMonth: parseFloat(hoursThisMonth.toFixed(1)),
          thisYear: parseFloat(hoursThisYear.toFixed(1)),
          allTime: parseFloat(hoursAllTime.toFixed(1)),
        },
        avgHoursPerWeek: parseFloat(avgHoursPerWeek.toFixed(1)),
        jobs: {
          thisWeek: jobsThisWeek,
          thisMonth: jobsThisMonth,
          allTime: jobsAllTime,
        },
        workloadPercent: 0, // Will be calculated after team average
      };
    });

    // Calculate team averages
    const totalWeeklyHours = employeeMetrics.reduce((sum, e) => sum + e.hours.thisWeek, 0);
    const activeEmployeeCount = employeeMetrics.length;
    const teamAvgHoursThisWeek = activeEmployeeCount > 0 ? totalWeeklyHours / activeEmployeeCount : 0;

    const totalAvgHoursPerWeek = employeeMetrics.reduce((sum, e) => sum + e.avgHoursPerWeek, 0);
    const teamAvgHoursPerWeek = activeEmployeeCount > 0 ? totalAvgHoursPerWeek / activeEmployeeCount : 0;

    // Calculate workload percentage for each employee (relative to team average this week)
    employeeMetrics.forEach((emp) => {
      if (teamAvgHoursThisWeek > 0) {
        emp.workloadPercent = Math.round((emp.hours.thisWeek / teamAvgHoursThisWeek) * 100);
      } else if (emp.hours.thisWeek > 0) {
        emp.workloadPercent = 100; // If no team average but employee has hours
      } else {
        emp.workloadPercent = 0;
      }
    });

    // Get unassigned jobs count (upcoming jobs not assigned to any employee)
    const unassignedJobs = await UserAppointments.findAll({
      where: {
        date: { [Op.gte]: today },
        completed: false,
        assignedToBusinessEmployee: false,
      },
      include: [
        {
          model: CleanerClient,
          as: "cleanerClient",
          where: { cleanerId: businessOwnerId },
          required: true,
        },
      ],
    });

    return {
      employees: employeeMetrics,
      teamAverage: {
        hoursPerWeek: parseFloat(teamAvgHoursPerWeek.toFixed(1)),
        hoursThisWeek: parseFloat(teamAvgHoursThisWeek.toFixed(1)),
      },
      unassignedJobCount: unassignedJobs.length,
    };
  }

  /**
   * Get unassigned jobs for a business owner
   * @param {number} businessOwnerId - ID of the business owner
   * @returns {Promise<Array>} Array of unassigned appointments
   */
  static async getUnassignedJobs(businessOwnerId) {
    const today = new Date().toISOString().split("T")[0];

    const unassignedJobs = await UserAppointments.findAll({
      where: {
        date: { [Op.gte]: today },
        completed: false,
        assignedToBusinessEmployee: false,
      },
      include: [
        {
          model: CleanerClient,
          as: "cleanerClient",
          where: { cleanerId: businessOwnerId },
          required: true,
          include: [
            {
              model: User,
              as: "client",
              attributes: ["id", "firstName", "lastName"],
            },
          ],
        },
        {
          model: UserHomes,
          as: "home",
          attributes: ["id", "address", "numBeds", "numBaths"],
        },
      ],
      order: [["date", "ASC"], ["startTime", "ASC"]],
    });

    return unassignedJobs.map((job) => ({
      id: job.id,
      date: job.date,
      startTime: job.startTime,
      endTime: job.endTime,
      price: job.price,
      clientName: job.cleanerClient?.client
        ? `${job.cleanerClient.client.firstName || ""} ${job.cleanerClient.client.lastName || ""}`.trim()
        : "Client",
      address: job.home?.address || "Address on file",
      numBeds: job.home?.numBeds,
      numBaths: job.home?.numBaths,
    }));
  }

  /**
   * Calculate weekly totals from daily breakdown
   * @param {Array} dailyBreakdown - Array of daily data
   * @returns {Array} Weekly totals
   */
  static calculateWeeklyTotals(dailyBreakdown) {
    const weekMap = new Map();

    dailyBreakdown.forEach((day) => {
      const date = new Date(day.date);
      // Get the Sunday of the week
      const dayOfWeek = date.getDay();
      const sunday = new Date(date);
      sunday.setDate(date.getDate() - dayOfWeek);
      const weekKey = sunday.toISOString().split("T")[0];

      if (!weekMap.has(weekKey)) {
        const saturday = new Date(sunday);
        saturday.setDate(sunday.getDate() + 6);
        weekMap.set(weekKey, {
          weekStart: weekKey,
          weekEnd: saturday.toISOString().split("T")[0],
          hours: 0,
          pay: 0,
          jobCount: 0,
        });
      }

      const week = weekMap.get(weekKey);
      week.hours += day.hours;
      week.pay += day.pay;
      week.jobCount += day.jobs.filter((j) => j.status === "completed").length;
    });

    return Array.from(weekMap.values())
      .sort((a, b) => new Date(b.weekStart) - new Date(a.weekStart));
  }
}

module.exports = EmployeeJobAssignmentService;
