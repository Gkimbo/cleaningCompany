const {
  GuestNotLeftReport,
  EmployeeJobAssignment,
  UserAppointments,
  UserHomes,
  User,
  BusinessEmployee,
} = require("../models");
const { calculateDistance } = require("../utils/geoUtils");
const NotificationService = require("./NotificationService");
const EncryptionService = require("./EncryptionService");

class GuestNotLeftService {
  /**
   * Report that a guest has not left the property
   * @param {number} assignmentId - The job assignment ID
   * @param {number} employeeUserId - The user ID of the cleaner
   * @param {Object} locationData - { latitude, longitude } (optional)
   * @param {string} notes - Optional notes from the cleaner
   * @param {Object} io - Socket.io instance for real-time updates
   * @returns {Object} The created report and updated assignment
   */
  static async reportGuestNotLeft(assignmentId, employeeUserId, locationData = {}, notes = null, io = null) {
    // 1. Find the assignment and validate ownership
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
        status: "assigned", // Can only report guest not left if job hasn't started
      },
      include: [
        {
          model: UserAppointments,
          as: "appointment",
          include: [
            {
              model: UserHomes,
              as: "home",
            },
            {
              model: User,
              as: "user", // The homeowner
            },
          ],
        },
      ],
    });

    if (!assignment) {
      throw new Error("Assignment not found or job already started");
    }

    // Verify this employee is assigned to this job
    const isAssigned = assignment.businessEmployeeId === employee.id ||
      (assignment.isSelfAssignment && assignment.businessOwnerId === employeeUserId);

    if (!isAssigned) {
      throw new Error("You are not assigned to this job");
    }

    // 2. Calculate distance from home if GPS data provided
    let distanceFromHome = null;
    const { latitude, longitude } = locationData;
    const home = assignment.appointment?.home;

    if (latitude && longitude && home?.latitude && home?.longitude) {
      // Home coordinates may be encrypted
      const homeLat = home.latitude ? parseFloat(EncryptionService.decrypt(home.latitude)) : null;
      const homeLon = home.longitude ? parseFloat(EncryptionService.decrypt(home.longitude)) : null;

      if (homeLat && homeLon) {
        distanceFromHome = calculateDistance(latitude, longitude, homeLat, homeLon);
      }
    }

    // 3. Create the guest not left report
    const report = await GuestNotLeftReport.create({
      employeeJobAssignmentId: assignmentId,
      appointmentId: assignment.appointmentId,
      reportedBy: employeeUserId,
      reportedAt: new Date(),
      cleanerLatitude: latitude || null,
      cleanerLongitude: longitude || null,
      distanceFromHome,
      notes,
    });

    // 4. Update the assignment
    const reportCount = assignment.guestNotLeftReportCount + 1;
    await assignment.update({
      guestNotLeftReported: true,
      guestNotLeftReportCount: reportCount,
      lastGuestNotLeftAt: new Date(),
    });

    // 5. Notify the homeowner
    const homeowner = assignment.appointment?.user;
    if (homeowner) {
      const cleanerName = employee.firstName || "Your cleaner";
      const propertyName = home?.nickname || home?.address || "your property";

      await NotificationService.notifyUser({
        userId: homeowner.id,
        type: "guest_not_left",
        title: "Guest Still Present",
        body: reportCount > 1
          ? `${cleanerName} reports guests are still at ${propertyName}. This is report #${reportCount}. They will try again later.`
          : `${cleanerName} arrived at ${propertyName} but guests haven't left yet. They will try again later.`,
        data: {
          appointmentId: assignment.appointmentId,
          assignmentId,
          reportCount,
          cleanerName,
          propertyName,
        },
        actionRequired: false,
        relatedAppointmentId: assignment.appointmentId,
        sendPush: true,
        sendEmail: false,
        io,
      });
    }

    // 6. Check if we need to escalate (3+ reports)
    if (reportCount >= 3) {
      await this.escalateGuestNotLeft(assignment, reportCount, io);
    }

    return {
      report,
      reportCount,
      homeownerNotified: !!homeowner,
      message: "Guest not left reported. Job remains in your queue.",
    };
  }

  /**
   * Escalate to business owner after multiple reports
   */
  static async escalateGuestNotLeft(assignment, reportCount, io = null) {
    const businessOwner = await User.findByPk(assignment.businessOwnerId);
    if (!businessOwner) return;

    const appointment = assignment.appointment;
    const home = appointment?.home;
    const homeowner = appointment?.user;

    const propertyName = home?.nickname || home?.address || "a property";
    const clientName = homeowner ? `${homeowner.firstName || ""} ${homeowner.lastName || ""}`.trim() : "client";

    await NotificationService.notifyUser({
      userId: businessOwner.id,
      type: "guest_not_left_escalation",
      title: "Repeated Guest Present Reports",
      body: `${reportCount} guest-not-left reports for ${clientName}'s property at ${propertyName}. May need intervention.`,
      data: {
        appointmentId: assignment.appointmentId,
        assignmentId: assignment.id,
        reportCount,
        clientName,
        propertyName,
      },
      actionRequired: true,
      relatedAppointmentId: assignment.appointmentId,
      sendPush: true,
      sendEmail: true,
      io,
    });
  }

  /**
   * Clear the guest not left flag when job successfully starts
   * @param {number} assignmentId
   */
  static async clearGuestNotLeftFlag(assignmentId) {
    const assignment = await EmployeeJobAssignment.findByPk(assignmentId);
    if (!assignment) return;

    // Only clear the flag, keep the count for history
    if (assignment.guestNotLeftReported) {
      await assignment.update({
        guestNotLeftReported: false,
      });

      // Resolve all unresolved reports for this assignment
      await GuestNotLeftReport.update(
        {
          resolved: true,
          resolvedAt: new Date(),
          resolution: "job_completed",
        },
        {
          where: {
            employeeJobAssignmentId: assignmentId,
            resolved: false,
          },
        }
      );
    }
  }

  /**
   * Get the guest not left report history for an assignment
   * @param {number} assignmentId
   * @returns {Array} Array of GuestNotLeftReport records
   */
  static async getReportHistory(assignmentId) {
    return GuestNotLeftReport.findAll({
      where: { employeeJobAssignmentId: assignmentId },
      include: [
        {
          model: User,
          as: "reporter",
          attributes: ["id", "firstName", "lastName"],
        },
      ],
      order: [["reportedAt", "DESC"]],
    });
  }

  /**
   * Handle expired jobs with unresolved guest not left reports
   * Called by cron job - finds jobs past their date with unresolved reports
   */
  static async handleExpiredGuestNotLeftJobs() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Find assignments with guest not left that are past their appointment date
    const expiredAssignments = await EmployeeJobAssignment.findAll({
      where: {
        guestNotLeftReported: true,
        status: "assigned", // Never started
      },
      include: [
        {
          model: UserAppointments,
          as: "appointment",
          where: {
            date: { $lt: today },
          },
        },
      ],
    });

    for (const assignment of expiredAssignments) {
      // Mark reports as expired
      await GuestNotLeftReport.update(
        {
          resolved: true,
          resolvedAt: new Date(),
          resolution: "expired",
        },
        {
          where: {
            employeeJobAssignmentId: assignment.id,
            resolved: false,
          },
        }
      );

      // Clear the flag
      await assignment.update({
        guestNotLeftReported: false,
      });

      // Notify business owner
      const businessOwner = await User.findByPk(assignment.businessOwnerId);
      if (businessOwner) {
        await NotificationService.notifyUser({
          userId: businessOwner.id,
          type: "guest_not_left_expired",
          title: "Job Expired - Guest Never Left",
          body: `A job could not be completed because guests never left the property. Please review and reschedule if needed.`,
          data: {
            appointmentId: assignment.appointmentId,
            assignmentId: assignment.id,
          },
          actionRequired: true,
          relatedAppointmentId: assignment.appointmentId,
          sendPush: true,
          sendEmail: true,
        });
      }
    }

    return expiredAssignments.length;
  }

  /**
   * Get current guest not left status for an assignment
   * @param {number} assignmentId
   * @returns {Object} Status info
   */
  static async getGuestNotLeftStatus(assignmentId) {
    const assignment = await EmployeeJobAssignment.findByPk(assignmentId);
    if (!assignment) return null;

    return {
      guestNotLeftReported: assignment.guestNotLeftReported,
      reportCount: assignment.guestNotLeftReportCount,
      lastReportedAt: assignment.lastGuestNotLeftAt,
    };
  }
}

module.exports = GuestNotLeftService;
