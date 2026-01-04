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

class EmployeeJobAssignmentService {
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
   * @returns {Promise<Object>} Updated assignment
   */
  static async startJob(assignmentId, employeeUserId) {
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
    });

    if (!assignment) {
      throw new Error("Assignment not found or cannot be started");
    }

    await assignment.update({
      status: "started",
      startedAt: new Date(),
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

    const updateData = {
      status: "completed",
      completedAt: new Date(),
    };

    // If hourly, calculate final pay
    if (assignment.payType === "hourly" && hoursWorked) {
      updateData.hoursWorked = hoursWorked;
      // Get employee's hourly rate
      if (employee) {
        const hourlyRate = employee.defaultHourlyRate || 0;
        updateData.payAmount = Math.round(hourlyRate * hoursWorked);
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
          attributes: ["id", "firstName", "lastName", "paymentMethod"],
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
}

module.exports = EmployeeJobAssignmentService;
