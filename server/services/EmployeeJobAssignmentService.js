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
  MultiCleanerJob,
  Notification,
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
const TimezoneService = require("./TimezoneService");

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
   * Estimate job duration based on home size
   * @param {number} numBeds - Number of bedrooms
   * @param {number} numBaths - Number of bathrooms
   * @param {number} numCleaners - Number of cleaners assigned (default 1)
   * @returns {number} Estimated hours per cleaner
   */
  static estimateJobDuration(numBeds = 2, numBaths = 1, numCleaners = 1) {
    // Base time + time per bedroom + time per bathroom
    const baseHours = 1;
    const hoursPerBed = 0.25;
    const hoursPerBath = 0.5;

    const rawTotalHours = baseHours + (numBeds * hoursPerBed) + (numBaths * hoursPerBath);
    // Round UP to nearest 0.5 before dividing by cleaners
    const totalHours = Math.ceil(rawTotalHours * 2) / 2;

    // Divide by number of cleaners (minimum 1 hour per person)
    const hoursPerCleaner = Math.max(1, totalHours / Math.max(1, numCleaners));

    // Round UP to nearest 0.5
    return Math.ceil(hoursPerCleaner * 2) / 2;
  }

  /**
   * Calculate employee pay based on their default rate settings and job price
   * @param {Object} employee - BusinessEmployee record
   * @param {number} jobPriceInCents - Job price in cents
   * @param {number} [estimatedHours] - Estimated hours for hourly employees
   * @returns {Object} { payAmount, payType, estimatedHours } - Pay amount in cents and type
   */
  static calculateEmployeePay(employee, jobPriceInCents, estimatedHours = 2) {
    if (!employee) {
      return { payAmount: 0, payType: "flat_rate", estimatedHours: 0, warning: "No employee provided" };
    }

    const payType = employee.payType || "hourly";
    let warning = null;

    switch (payType) {
      case "percentage":
        // Pay is a percentage of the job price
        const percentRate = parseFloat(employee.payRate) || 0;
        if (!employee.payRate || percentRate === 0) {
          warning = "Employee pay rate (percentage) not configured - defaulting to $0";
          console.warn("[PayCalculation] Percentage pay rate not configured");
        }
        const percentPay = Math.round((jobPriceInCents * percentRate) / 100);
        return { payAmount: percentPay, payType: "percentage", estimatedHours, warning };

      case "flat":
      case "per_job":
      case "flat_rate":
        // Flat rate per job
        const flatRate = Math.round(employee.defaultJobRate || 0);
        if (!employee.defaultJobRate || flatRate === 0) {
          warning = "Employee job rate not configured - defaulting to $0";
          console.warn("[PayCalculation] Job rate not configured");
        }
        return { payAmount: flatRate, payType: "flat_rate", estimatedHours, warning };

      case "hourly":
      default:
        // Hourly rate * estimated hours
        const hourlyRate = employee.defaultHourlyRate || 0;
        if (!employee.defaultHourlyRate || hourlyRate === 0) {
          warning = "Employee hourly rate not configured - defaulting to $0";
          console.warn("[PayCalculation] Hourly rate not configured");
        }
        const hourlyPay = Math.round(hourlyRate * estimatedHours);
        return { payAmount: hourlyPay, payType: "hourly", estimatedHours, warning };
    }
  }

  /**
   * Recalculate pay for all existing assignments when the cleaner count changes.
   * Only recalculates hourly and percentage employees (flat rate stays the same).
   * @param {number} appointmentId - The appointment ID
   * @param {number} businessOwnerId - The business owner ID
   * @param {Object} [excludeAssignmentId] - Assignment ID to exclude (the one just created)
   * @returns {Promise<number>} Number of assignments updated
   */
  static async recalculateAllAssignmentsForJob(appointmentId, businessOwnerId, excludeAssignmentId = null, existingTransaction = null) {
    // Internal implementation that accepts a transaction
    const doRecalculate = async (t) => {
      // Get appointment with home details - lock for update
      const appointment = await UserAppointments.findByPk(appointmentId, {
        include: [{ model: UserHomes, as: "home" }],
        lock: t.LOCK.UPDATE,
        transaction: t,
      });
      if (!appointment) return 0;

      // Get home size
      const numBeds = appointment.home?.numBeds || 2;
      const numBaths = appointment.home?.numBaths || 1;

      // Count ALL active assignments (including the new one)
      const totalCleaners = await EmployeeJobAssignment.count({
        where: {
          appointmentId,
          status: { [Op.notIn]: ["cancelled", "no_show", "unassigned"] },
        },
        transaction: t,
      });

      // Calculate hours per cleaner
      const hoursPerCleaner = this.estimateJobDuration(numBeds, numBaths, totalCleaners);
      const jobPriceInCents = appointment.price || 0;

      // Get all existing assignments (excluding the new one if specified)
      const whereClause = {
        appointmentId,
        businessOwnerId,
        status: { [Op.notIn]: ["cancelled", "no_show", "unassigned"] },
        isSelfAssignment: false, // Only update employees, not self-assignments
      };
      if (excludeAssignmentId) {
        whereClause.id = { [Op.ne]: excludeAssignmentId };
      }

      const existingAssignments = await EmployeeJobAssignment.findAll({
        where: whereClause,
        include: [{ model: BusinessEmployee, as: "employee" }],
        lock: t.LOCK.UPDATE,
        transaction: t,
      });

      let updatedCount = 0;
      for (const assignment of existingAssignments) {
        const emp = assignment.employee;
        if (!emp) continue;

        const payType = emp.payType || "hourly";

        // Only recalculate for hourly and percentage employees
        // Flat rate/per_job stays the same regardless of cleaner count
        if (payType === "hourly") {
          const hourlyRate = emp.defaultHourlyRate || 0;
          const newPayAmount = Math.round(hourlyRate * hoursPerCleaner);

          if (newPayAmount !== assignment.payAmount) {
            await assignment.update({
              payAmount: newPayAmount,
              payAdjustmentReason: `Recalculated: cleaner count changed to ${totalCleaners}`,
            }, { transaction: t });
            updatedCount++;
          }
        } else if (payType === "percentage") {
          // For percentage pay, each employee gets their percentage of the job price
          // NOT divided by cleaner count - each gets their own percentage
          const percentRate = parseFloat(emp.payRate) || 0;
          const newPayAmount = Math.round((jobPriceInCents * percentRate) / 100);

          if (newPayAmount !== assignment.payAmount) {
            await assignment.update({
              payAmount: newPayAmount,
              payAdjustmentReason: `Recalculated: cleaner count changed to ${totalCleaners}`,
            }, { transaction: t });
            updatedCount++;
          }
        }
      }

      if (updatedCount > 0) {
        console.log(`[EmployeeJobAssignmentService] Recalculated pay for ${updatedCount} assignments (new cleaner count: ${totalCleaners})`);
      }

      return updatedCount;
    };

    // If an existing transaction is provided, use it; otherwise create a new one
    if (existingTransaction) {
      return doRecalculate(existingTransaction);
    } else {
      return await sequelize.transaction(doRecalculate);
    }
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
  static async assignEmployeeToJob(businessOwnerId, assignmentData, io = null) {
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

    // CRITICAL: Verify the business owner has legitimate access to this appointment
    // They can only assign employees to jobs they booked OR jobs from their clients
    const wasBookedByBusinessOwner = appointment.bookedByCleanerId === businessOwnerId;

    let isClientOfBusinessOwner = false;
    if (!wasBookedByBusinessOwner && appointment.userId) {
      // Check if the homeowner is a client of this business owner
      const clientRelationship = await CleanerClient.findOne({
        where: {
          cleanerId: businessOwnerId,
          clientId: appointment.userId,
          status: "active",
        },
      });
      isClientOfBusinessOwner = !!clientRelationship;
    }

    if (!wasBookedByBusinessOwner && !isClientOfBusinessOwner) {
      throw new Error("You do not have permission to assign employees to this appointment");
    }

    // Create the assignment and job flow - all checks inside transaction with locks
    const assignment = await sequelize.transaction(async (t) => {
      // Resolve the job flow inside transaction to prevent race conditions
      // with default flow changes happening concurrently
      const flowResolution = await CustomJobFlowService.resolveFlowForAppointment(
        appointment,
        businessOwnerId,
        assignmentData.jobFlowOverride // Optional job-level override
      );

      const isMarketplacePickup = flowResolution.usesPlatformFlow;
      // CRITICAL: Lock the appointment row to prevent race conditions when multiple
      // employees are assigned simultaneously. This lock serializes concurrent assignment
      // requests for the same appointment, even when there are no existing assignments.
      await UserAppointments.findByPk(appointmentId, {
        lock: t.LOCK.UPDATE,
        transaction: t,
      });

      // Lock existing assignments for this appointment to prevent race conditions
      const existingAssignments = await EmployeeJobAssignment.findAll({
        where: {
          appointmentId,
          status: { [Op.notIn]: ["cancelled", "no_show", "unassigned"] },
        },
        lock: t.LOCK.UPDATE,
        transaction: t,
      });

      // Check for duplicate assignment (same employee twice)
      const duplicateAssignment = existingAssignments.find(
        (a) => a.businessEmployeeId === employeeId
      );
      if (duplicateAssignment) {
        throw new Error("This employee is already assigned to this job");
      }

      // For marketplace multi-cleaner jobs, enforce cleaner count limit
      if (appointment.isMultiCleanerJob && appointment.multiCleanerJobId) {
        const multiCleanerJob = await MultiCleanerJob.findByPk(appointment.multiCleanerJobId, {
          lock: t.LOCK.UPDATE,
          transaction: t,
        });
        if (multiCleanerJob && existingAssignments.length >= multiCleanerJob.totalCleanersRequired) {
          throw new Error(`This job requires exactly ${multiCleanerJob.totalCleanersRequired} cleaners`);
        }
      }

      // Create or get the AppointmentJobFlow
      let jobFlow = await AppointmentJobFlow.findOne({
        where: { appointmentId },
        transaction: t,
      });

      if (!jobFlow) {
        jobFlow = await AppointmentJobFlowService.createJobFlowForAppointment(
          appointmentId,
          flowResolution,
          t
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
          // Store hourly rate at assignment time for accurate pay calculation at completion
          hourlyRateAtAssignment: payType === "hourly" ? (employee.defaultHourlyRate || 0) : null,
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

      // Recalculate pay for all existing assignments INSIDE the same transaction
      // This prevents race conditions when multiple employees are assigned simultaneously
      await this.recalculateAllAssignmentsForJob(appointmentId, businessOwnerId, newAssignment.id, t);

      // Audit log for job assignment
      console.info("[AUDIT] Job assignment created", {
        action: "EMPLOYEE_ASSIGNED",
        assignmentId: newAssignment.id,
        appointmentId,
        businessOwnerId,
        employeeId,
        payAmount,
        payType,
        timestamp: new Date().toISOString(),
      });

      return newAssignment;
    });

    // Send notification to the employee (after transaction completes)
    // NOTE: We intentionally do NOT notify the homeowner when employees are assigned/unassigned.
    // The homeowner is only notified if the business owner fully declines/cancels the appointment
    // (handled via NotificationService.notifyBusinessOwnerDeclined).
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

    // Delete any unassigned reminder notifications for this appointment
    // These should be removed from the notification list since someone is now assigned
    try {
      await Notification.destroy({
        where: {
          relatedAppointmentId: appointmentId,
          type: "unassigned_reminder_bo",
        },
      });

      // Emit socket event to update badge count in real-time
      if (io) {
        const [unreadCount, actionRequiredCount] = await Promise.all([
          Notification.getUnreadCount(businessOwnerId),
          Notification.getActionRequiredCount(businessOwnerId),
        ]);
        io.to(`user_${businessOwnerId}`).emit("notification_count_update", {
          unreadCount,
          actionRequiredCount,
        });
      }
    } catch (clearError) {
      console.error("[EmployeeJobAssignmentService] Failed to clear unassigned reminder notifications:", clearError);
    }

    return assignment;
  }

  /**
   * Assign business owner to their own job (self-assignment)
   * @param {number} businessOwnerId - ID of the business owner
   * @param {number} appointmentId - Appointment ID
   * @param {Object} io - Socket.io instance for real-time updates
   * @returns {Promise<Object>} Created assignment
   */
  static async assignSelfToJob(businessOwnerId, appointmentId, io = null) {
    // Verify business owner
    const businessOwner = await User.findByPk(businessOwnerId);
    if (!businessOwner || !businessOwner.isBusinessOwner) {
      throw new Error("Invalid business owner");
    }

    // Use transaction with locking to prevent race condition on self-assignment
    const assignment = await sequelize.transaction(async (t) => {
      // Verify appointment exists and lock it
      const appointment = await UserAppointments.findByPk(appointmentId, {
        lock: t.LOCK.UPDATE,
        transaction: t,
      });
      if (!appointment) {
        throw new Error("Appointment not found");
      }

      // CRITICAL: Verify the business owner has legitimate access to this appointment
      const wasBookedByBusinessOwner = appointment.bookedByCleanerId === businessOwnerId;

      let isClientOfBusinessOwner = false;
      if (!wasBookedByBusinessOwner && appointment.userId) {
        const clientRelationship = await CleanerClient.findOne({
          where: {
            cleanerId: businessOwnerId,
            clientId: appointment.userId,
            status: "active",
          },
          transaction: t,
        });
        isClientOfBusinessOwner = !!clientRelationship;
      }

      if (!wasBookedByBusinessOwner && !isClientOfBusinessOwner) {
        throw new Error("You do not have permission to self-assign to this appointment");
      }

      // Check if business owner already self-assigned to this job (inside transaction)
      const existingSelfAssignment = await EmployeeJobAssignment.findOne({
        where: {
          appointmentId,
          businessOwnerId,
          isSelfAssignment: true,
          status: { [Op.notIn]: ["cancelled", "no_show", "unassigned"] },
        },
        transaction: t,
      });

      if (existingSelfAssignment) {
        throw new Error("You are already assigned to this job");
      }

      // Resolve the job flow for this appointment
      const flowResolution = await CustomJobFlowService.resolveFlowForAppointment(
        appointment,
        businessOwnerId
      );

      const isMarketplacePickup = flowResolution.usesPlatformFlow;

      // Create or get the AppointmentJobFlow
      let jobFlow = await AppointmentJobFlow.findOne({
        where: { appointmentId },
        transaction: t,
      });

      if (!jobFlow) {
        jobFlow = await AppointmentJobFlowService.createJobFlowForAppointment(
          appointmentId,
          flowResolution,
          t
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

      // Recalculate pay for all existing employee assignments INSIDE the same transaction
      // This prevents race conditions when multiple employees are assigned simultaneously
      await this.recalculateAllAssignmentsForJob(appointmentId, businessOwnerId, newAssignment.id, t);

      return newAssignment;
    });

    // Delete any unassigned reminder notifications for this appointment
    // These should be removed from the notification list since someone is now assigned
    try {
      await Notification.destroy({
        where: {
          relatedAppointmentId: appointmentId,
          type: "unassigned_reminder_bo",
        },
      });

      // Emit socket event to update badge count in real-time
      if (io) {
        const [unreadCount, actionRequiredCount] = await Promise.all([
          Notification.getUnreadCount(businessOwnerId),
          Notification.getActionRequiredCount(businessOwnerId),
        ]);
        io.to(`user_${businessOwnerId}`).emit("notification_count_update", {
          unreadCount,
          actionRequiredCount,
        });
      }
    } catch (clearError) {
      console.error("[EmployeeJobAssignmentService] Failed to clear unassigned reminder notifications:", clearError);
    }

    return assignment;
  }

  /**
   * Unassign an employee from a job
   * NOTE: This method intentionally does NOT notify the homeowner.
   * Employee rearrangements are internal to the business owner's operations.
   * The homeowner is only notified if the appointment is fully cancelled/declined.
   * @param {number} assignmentId - Assignment ID
   * @param {number} businessOwnerId - ID of the business owner
   * @param {Object} io - Socket.io instance for real-time updates
   * @returns {Promise<void>}
   */
  static async unassignFromJob(assignmentId, businessOwnerId, io = null) {
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

    // Check how many other employees are assigned to this job
    const otherAssignments = await EmployeeJobAssignment.count({
      where: {
        appointmentId: assignment.appointmentId,
        id: { [Op.ne]: assignmentId },
        status: { [Op.notIn]: ["cancelled", "no_show", "unassigned"] },
      },
    });

    await sequelize.transaction(async (t) => {
      // Only update the appointment if this is the last employee
      if (otherAssignments === 0) {
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
      }

      // Mark the assignment as unassigned (so it can be found for unassigned jobs query)
      await assignment.update({ status: "unassigned" }, { transaction: t });
    });

    // If the job is now fully unassigned and within 4 days, create a reminder notification
    if (otherAssignments === 0) {
      try {
        const appointment = await UserAppointments.findByPk(assignment.appointmentId, {
          include: [{ model: User, as: "user" }],
        });

        if (appointment && !appointment.completed && !appointment.wasCancelled) {
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          // Use noon to avoid timezone edge cases that could shift the day
          const appointmentDate = new Date(appointment.date + "T12:00:00");
          const daysUntil = Math.round((appointmentDate - today) / (1000 * 60 * 60 * 24));

          // Only create notification if appointment is within 4 days
          if (daysUntil >= 0 && daysUntil <= 4) {
            // Get client name
            let clientName = "Client";
            if (appointment.user) {
              const firstName = appointment.user.firstName
                ? EncryptionService.decrypt(appointment.user.firstName)
                : "";
              const lastName = appointment.user.lastName
                ? EncryptionService.decrypt(appointment.user.lastName)
                : "";
              clientName = `${firstName} ${lastName}`.trim() || "Client";
            }

            // Create the notification (this also emits socket event via NotificationService)
            await NotificationService.notifyUnassignedAppointmentReminder({
              businessOwnerId,
              appointmentId: appointment.id,
              appointmentDate: appointment.date,
              clientName,
              daysUntil,
              reminderCount: 1,
              io,
            });
          }
        }
      } catch (notifyError) {
        console.error("[EmployeeJobAssignmentService] Failed to create unassigned reminder:", notifyError);
      }
    }

    // Recalculate pay for remaining assignments now that cleaner count decreased
    // Remaining hourly employees now have more hours (total ÷ fewer cleaners)
    if (otherAssignments > 0) {
      try {
        await this.recalculateAllAssignmentsForJob(assignment.appointmentId, businessOwnerId);
      } catch (recalcError) {
        console.error("[EmployeeJobAssignmentService] Failed to recalculate pay for remaining assignments:", recalcError);
      }
    }

    return { remainingAssignments: otherAssignments };
  }

  /**
   * Bulk unassign all cleaners from a job (for multi-cleaner jobs)
   * Handles everything in a single transaction to avoid race conditions
   * @param {number} appointmentId - The appointment to unassign all cleaners from
   * @param {number} businessOwnerId - ID of the business owner
   * @param {Object} io - Socket.io instance for notifications
   * @returns {Promise<Object>} Result with count of removed assignments
   */
  static async bulkUnassignFromJob(appointmentId, businessOwnerId, io = null) {
    // Find all active assignments for this appointment
    const assignments = await EmployeeJobAssignment.findAll({
      where: {
        appointmentId,
        businessOwnerId,
        status: { [Op.notIn]: ["cancelled", "no_show", "unassigned"] },
      },
    });

    if (assignments.length === 0) {
      throw new Error("No active assignments found for this job");
    }

    await sequelize.transaction(async (t) => {
      // Update the appointment to mark as unassigned
      await UserAppointments.update(
        {
          assignedToBusinessEmployee: false,
          businessEmployeeAssignmentId: null,
        },
        {
          where: { id: appointmentId },
          transaction: t,
        }
      );

      // Mark all assignments as unassigned
      await EmployeeJobAssignment.update(
        { status: "unassigned" },
        {
          where: {
            id: { [Op.in]: assignments.map((a) => a.id) },
          },
          transaction: t,
        }
      );
    });

    // Create notification if job is within 4 days
    try {
      const appointment = await UserAppointments.findByPk(appointmentId, {
        include: [{ model: User, as: "user" }],
      });

      if (appointment && !appointment.completed && !appointment.wasCancelled) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const appointmentDate = new Date(appointment.date + "T12:00:00");
        const daysUntil = Math.round((appointmentDate - today) / (1000 * 60 * 60 * 24));

        if (daysUntil >= 0 && daysUntil <= 4) {
          let clientName = "Client";
          if (appointment.user) {
            const firstName = appointment.user.firstName
              ? EncryptionService.decrypt(appointment.user.firstName)
              : "";
            const lastName = appointment.user.lastName
              ? EncryptionService.decrypt(appointment.user.lastName)
              : "";
            clientName = `${firstName} ${lastName}`.trim() || "Client";
          }

          await NotificationService.notifyUnassignedAppointmentReminder({
            businessOwnerId,
            appointmentId: appointment.id,
            appointmentDate: appointment.date,
            clientName,
            daysUntil,
            reminderCount: 1,
            io,
          });
        }
      }
    } catch (notifyError) {
      console.error("[EmployeeJobAssignmentService] Failed to create unassigned reminder:", notifyError);
    }

    return { removedCount: assignments.length };
  }

  /**
   * Reassign a job to a different employee
   * @param {number} assignmentId - Current assignment ID
   * @param {number} newEmployeeId - New BusinessEmployee ID
   * @param {number} businessOwnerId - ID of the business owner
   * @returns {Promise<Object>} Updated assignment
   */
  static async reassignJob(assignmentId, newEmployeeId, businessOwnerId) {
    const currentAssignment = await EmployeeJobAssignment.findOne({
      where: {
        id: assignmentId,
        businessOwnerId,
        status: "assigned",
      },
      include: [{ model: BusinessEmployee, as: "employee" }],
    });

    if (!currentAssignment) {
      throw new Error("Assignment not found or cannot be reassigned");
    }

    const oldEmployee = currentAssignment.employee;
    const oldEmployeeId = currentAssignment.businessEmployeeId;

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

    // Check if trying to reassign to the same employee
    if (oldEmployeeId === newEmployeeId) {
      throw new Error("Employee is already assigned to this job");
    }

    // Get appointment to calculate pay based on job price and home size
    const appointment = await UserAppointments.findByPk(currentAssignment.appointmentId, {
      include: [{ model: UserHomes, as: "home" }],
    });

    // Get home size for duration estimation
    const numBeds = appointment?.home?.numBeds || 2;
    const numBaths = appointment?.home?.numBaths || 1;

    // Count all active assignments for this job (including this one)
    const totalCleaners = await EmployeeJobAssignment.count({
      where: {
        appointmentId: currentAssignment.appointmentId,
        status: { [Op.notIn]: ["cancelled", "no_show", "unassigned"] },
      },
    });

    // Estimate hours based on home size and number of cleaners
    const estimatedHours = this.estimateJobDuration(numBeds, numBaths, totalCleaners);

    // Calculate pay for the new employee based on their default rates
    const jobPriceInCents = appointment?.price || 0; // Already in cents

    const { payAmount: calculatedPay, payType: calculatedPayType } = this.calculateEmployeePay(
      newEmployee,
      jobPriceInCents,
      estimatedHours
    );

    const previousPayAmount = currentAssignment.payAmount;

    // Update the existing assignment (patch instead of cancel + create)
    await sequelize.transaction(async (t) => {
      // Log the pay change for audit trail
      await EmployeePayChangeLog.create(
        {
          employeeJobAssignmentId: assignmentId,
          businessOwnerId,
          previousPayAmount,
          newPayAmount: calculatedPay,
          reason: `Reassigned from ${oldEmployee?.firstName || 'Unknown'} to ${newEmployee.firstName}`,
          changedAt: new Date(),
          changedBy: businessOwnerId,
        },
        { transaction: t }
      );

      // Update the assignment with new employee and pay
      await currentAssignment.update(
        {
          businessEmployeeId: newEmployeeId,
          payAmount: calculatedPay,
          payType: calculatedPayType,
          // Store new employee's hourly rate at reassignment time
          hourlyRateAtAssignment: calculatedPayType === "hourly" ? (newEmployee.defaultHourlyRate || 0) : null,
          assignedAt: new Date(), // Reset assignment time
        },
        { transaction: t }
      );
    });

    // Reload the assignment with updated data
    await currentAssignment.reload({
      include: [{ model: BusinessEmployee, as: "employee" }],
    });

    // Send notifications after transaction completes
    // NOTE: We intentionally only notify employees (new and old), NOT the homeowner.
    // Employee rearrangements are internal to the business owner's operations.
    // The homeowner is only notified if the appointment is fully cancelled/declined.
    try {
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
          payAmount: calculatedPay,
          businessName: businessOwner?.businessName || "Your employer",
        });
      }

      // Notify old employee about being unassigned (if they had a user account)
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

    return currentAssignment;
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

    // Use transaction with row lock to prevent race conditions
    const result = await sequelize.transaction(async (t) => {
      // Lock the row for update to prevent concurrent modifications
      const assignment = await EmployeeJobAssignment.findOne({
        where: {
          id: assignmentId,
          businessOwnerId,
          status: { [Op.notIn]: ["paid", "paid_outside_platform"] },
        },
        lock: t.LOCK.UPDATE,
        transaction: t,
      });

      if (!assignment) {
        throw new Error("Assignment not found or already paid");
      }

      const previousPayAmount = assignment.payAmount;

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

      return { assignment, previousPayAmount };
    });

    // Track pay override analytics (outside transaction - non-critical)
    await AnalyticsService.trackPayOverride(
      result.assignment.appointmentId,
      result.assignment.businessEmployeeId,
      result.previousPayAmount,
      newPayAmount,
      reason || "unspecified",
      businessOwnerId
    );

    return result.assignment.reload();
  }

  /**
   * Recalculate pay for an assignment based on home size and employee's default rates
   * @param {number} assignmentId - Assignment ID
   * @param {number} businessOwnerId - Business owner ID
   * @returns {Promise<Object>} Updated assignment with new calculated pay
   */
  static async recalculatePay(assignmentId, businessOwnerId) {
    // Use transaction with row lock to prevent race conditions
    const result = await sequelize.transaction(async (t) => {
      // Lock the assignment row for update
      const assignment = await EmployeeJobAssignment.findOne({
        where: {
          id: assignmentId,
          businessOwnerId,
          status: { [Op.notIn]: ["paid", "paid_outside_platform"] },
        },
        include: [
          { model: BusinessEmployee, as: "employee" },
        ],
        lock: t.LOCK.UPDATE,
        transaction: t,
      });

      if (!assignment) {
        throw new Error("Assignment not found or already paid");
      }

      // Get appointment with home details
      const appointment = await UserAppointments.findByPk(assignment.appointmentId, {
        include: [{ model: UserHomes, as: "home" }],
        transaction: t,
      });

      if (!appointment) {
        throw new Error("Appointment not found");
      }

      // Count total active assignments for this job
      const totalAssignments = await EmployeeJobAssignment.count({
        where: {
          appointmentId: assignment.appointmentId,
          status: { [Op.notIn]: ["cancelled", "no_show", "unassigned"] },
        },
        transaction: t,
      });

      // Get home size
      const numBeds = appointment.home?.numBeds || 2;
      const numBaths = appointment.home?.numBaths || 1;

      // Calculate estimated hours based on home size and number of cleaners
      const estimatedHours = EmployeeJobAssignmentService.estimateJobDuration(numBeds, numBaths, totalAssignments);

      // Calculate pay based on employee's default rates
      const jobPriceInCents = appointment.price || 0; // Already in cents
      const { payAmount: newPayAmount, payType: newPayType } = EmployeeJobAssignmentService.calculateEmployeePay(
        assignment.employee,
        jobPriceInCents,
        estimatedHours
      );

      const previousPayAmount = assignment.payAmount;

      // Log the change
      await EmployeePayChangeLog.create(
        {
          employeeJobAssignmentId: assignmentId,
          businessOwnerId,
          previousPayAmount,
          newPayAmount,
          reason: `Recalculated: ${numBeds}bd/${numBaths}ba, ${totalAssignments} cleaner(s), ${estimatedHours}hrs`,
          changedAt: new Date(),
          changedBy: businessOwnerId,
        },
        { transaction: t }
      );

      // Update the assignment with new pay and correct payType
      await assignment.update(
        {
          payAmount: newPayAmount,
          payType: newPayType,
          payAdjustmentReason: `Recalculated based on home size`,
        },
        { transaction: t }
      );

      return assignment;
    });

    return result.reload({
      include: [{ model: BusinessEmployee, as: "employee" }],
    });
  }

  /**
   * Get pay change history for an assignment
   * @param {number} assignmentId - Assignment ID
   * @param {number} businessOwnerId - Business owner ID for authorization
   * @returns {Promise<Object[]>} Array of pay change logs
   */
  static async getPayChangeHistory(assignmentId, businessOwnerId) {
    // Verify the assignment belongs to this business owner
    const assignment = await EmployeeJobAssignment.findOne({
      where: {
        id: assignmentId,
        businessOwnerId: businessOwnerId,
      },
    });

    if (!assignment) {
      throw new Error("Assignment not found or unauthorized");
    }

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

    // Block job start if appointment is paused (homeowner account frozen)
    if (assignment.appointment?.isPaused) {
      throw new Error("Cannot start job - this appointment is currently paused");
    }

    // Block job start if appointment was cancelled
    if (assignment.appointment?.wasCancelled) {
      throw new Error("Cannot start job - this appointment has been cancelled");
    }

    // Block job start if payment capture has failed
    if (assignment.appointment?.paymentCaptureFailed) {
      throw new Error("Cannot start job - client payment issue. Please contact support or wait for the client to resolve their payment issue.");
    }

    // Calculate distance from home if GPS data provided
    const { latitude, longitude, offlineStartedAt } = locationData;
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

    // Use offline start time if provided (for offline sync), otherwise current time
    const startedAt = offlineStartedAt ? new Date(offlineStartedAt) : new Date();

    await assignment.update({
      status: "started",
      startedAt,
      startLatitude: latitude || null,
      startLongitude: longitude || null,
      startDistanceFromHome,
      startLocationVerified,
    });

    return assignment;
  }

  /**
   * Check if all employees have completed their assignments for an appointment
   * @param {number} appointmentId - Appointment ID
   * @returns {Promise<Object>} Completion status
   */
  static async checkAllEmployeesCompleted(appointmentId) {
    const assignments = await EmployeeJobAssignment.findAll({
      where: {
        appointmentId,
        status: { [Op.notIn]: ["cancelled", "no_show", "unassigned"] },
      },
    });

    const completed = assignments.filter((a) => a.status === "completed");

    return {
      allCompleted: completed.length === assignments.length && assignments.length > 0,
      totalAssigned: assignments.length,
      completedCount: completed.length,
    };
  }

  /**
   * Complete a job (employee action)
   * @param {number} assignmentId - Assignment ID
   * @param {number} employeeUserId - User ID of the employee
   * @param {number} [hoursWorked] - Hours worked (for hourly jobs)
   * @returns {Promise<Object>} Updated assignment with jobFullyCompleted flag
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
          attributes: ["id", "price", "isPaused", "wasCancelled"],
        },
      ],
    });

    if (!assignment) {
      throw new Error("Assignment not found or cannot be completed");
    }

    // Block job completion if appointment is paused (homeowner account frozen)
    if (assignment.appointment?.isPaused) {
      throw new Error("Cannot complete job - this appointment is currently paused");
    }

    // Block job completion if appointment was cancelled
    if (assignment.appointment?.wasCancelled) {
      throw new Error("Cannot complete job - this appointment has been cancelled");
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

    // Validate hoursWorked if provided - cannot exceed actual elapsed time by more than 30 minutes
    if (hoursWorked && assignment.startedAt) {
      const actualHours = this.calculateHoursWorked(assignment.startedAt, completedAt);
      const maxAllowedHours = actualHours + 0.5; // 30 minute buffer for clock differences
      if (hoursWorked > maxAllowedHours) {
        throw new Error(`Hours worked (${hoursWorked}) cannot exceed actual elapsed time (${actualHours.toFixed(2)} hours) by more than 30 minutes`);
      }
      // Also ensure hoursWorked is positive
      if (hoursWorked <= 0) {
        throw new Error("Hours worked must be a positive number");
      }
    }

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
        // Use stored hourly rate from assignment time, fall back to current rate for legacy assignments
        const hourlyRate = assignment.hourlyRateAtAssignment ?? employee?.defaultHourlyRate ?? 0;
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
      // Percentage: pay = (percentage / 100) × job price in cents
      // appointment.price is already INTEGER cents
      const appointmentPriceCents = assignment.appointment?.price || 0;
      const payRate = parseFloat(employee?.payRate) || 0;
      if (payRate > 0 && appointmentPriceCents > 0) {
        updateData.payAmount = Math.round((payRate / 100) * appointmentPriceCents);
      }
      // Also track hours if available (for records, not pay calculation)
      if (hoursWorked) {
        updateData.hoursWorked = hoursWorked;
      } else if (assignment.startedAt) {
        updateData.hoursWorked = this.calculateHoursWorked(assignment.startedAt, completedAt);
      }
    }

    await assignment.update(updateData);

    // Check if all employees have completed their assignments
    const completionStatus = await this.checkAllEmployeesCompleted(assignment.appointmentId);

    // Only mark appointment as completed when ALL employees are done
    if (completionStatus.allCompleted) {
      await UserAppointments.update(
        { completed: true },
        { where: { id: assignment.appointmentId } }
      );
    }

    return {
      assignment,
      jobFullyCompleted: completionStatus.allCompleted,
      completionStatus,
    };
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

    // Require job to have been started before hours can be recorded
    if (!assignment.startedAt) {
      throw new Error("Cannot update hours - job was never started (no start time recorded)");
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
          attributes: ["id", "firstName", "lastName", "payType", "defaultHourlyRate", "defaultJobRate", "payRate"],
          required: false, // Allow self-assignments (null businessEmployeeId)
        },
        {
          model: UserAppointments,
          as: "appointment",
          required: true,
          where: {
            date: {
              [Op.gte]: startDate,
              [Op.lte]: endDate,
            },
            wasCancelled: { [Op.ne]: true },
            completed: { [Op.ne]: true },
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
      status: { [Op.notIn]: ["cancelled", "no_show", "unassigned"] },
    };
    if (status) {
      where.status = status;
    }

    const appointmentWhere = {
      // Exclude completed appointments
      completed: false,
      // Exclude paused appointments (homeowner account frozen)
      isPaused: { [Op.ne]: true },
      // Exclude cancelled appointments
      wasCancelled: { [Op.ne]: true },
    };
    if (upcoming) {
      appointmentWhere.date = { [Op.gte]: TimezoneService.getTodayInTimezone() };
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
    const today = TimezoneService.getTodayInTimezone();

    // Calculate date ranges
    const dayOfWeek = now.getDay();
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - dayOfWeek);
    const weekStartStr = TimezoneService.formatDateInTimezone(weekStart);

    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthStartStr = TimezoneService.formatDateInTimezone(monthStart);

    const yearStart = new Date(now.getFullYear(), 0, 1);
    const yearStartStr = TimezoneService.formatDateInTimezone(yearStart);

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
    const today = TimezoneService.getTodayInTimezone();

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
      const weekKey = TimezoneService.formatDateInTimezone(sunday);

      if (!weekMap.has(weekKey)) {
        const saturday = new Date(sunday);
        saturday.setDate(sunday.getDate() + 6);
        weekMap.set(weekKey, {
          weekStart: weekKey,
          weekEnd: TimezoneService.formatDateInTimezone(saturday),
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
