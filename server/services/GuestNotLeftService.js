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

// Constants for tenant present workflow
const RESPONSE_DEADLINE_MINUTES = 30;
const MIN_HOURS_FOR_RETURN = 2;
const GPS_VERIFICATION_DISTANCE_METERS = 200;
const SCRUTINY_HIGH_RISK_NO_CLEAN_COUNT = 5;
const SCRUTINY_WATCH_NO_CLEAN_COUNT = 3;

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

  // ========================================
  // TENANT PRESENT WORKFLOW (Enhanced)
  // ========================================

  /**
   * Report tenant still present with enhanced workflow
   * This creates a report and starts the 30-minute homeowner response timer
   */
  static async reportTenantPresent(appointmentId, cleanerId, gpsData = {}, notes = null, io = null) {
    // Get appointment with home details
    const appointment = await UserAppointments.findByPk(appointmentId, {
      include: [
        { model: UserHomes, as: "home" },
        { model: User, as: "client" },
      ],
    });

    if (!appointment) {
      throw new Error("Appointment not found");
    }

    // Check if job already started
    if (appointment.jobStartedAt) {
      throw new Error("Cannot report tenant present after job has started");
    }

    // Check for existing active report
    const existingReport = await GuestNotLeftReport.findOne({
      where: { appointmentId, resolved: false },
    });

    if (existingReport) {
      throw new Error("There is already an active tenant present report for this appointment");
    }

    // Get assignment (works for both independent cleaners and business employees)
    let assignment = await EmployeeJobAssignment.findOne({
      where: { appointmentId, status: "assigned" },
    });

    // Also check if cleaner is the preferred cleaner directly assigned
    if (!assignment && appointment.cleanerId === cleanerId) {
      // Create a virtual assignment for independent cleaners
      assignment = { id: null, appointmentId };
    }

    if (!assignment && appointment.cleanerId !== cleanerId) {
      throw new Error("You are not assigned to this appointment");
    }

    // Calculate time window end
    const timeWindowEnd = this.calculateTimeWindowEnd(appointment);

    // Verify GPS
    let gpsVerifiedOnSite = null;
    let distanceFromHome = null;
    const home = appointment.home;

    if (gpsData.latitude && gpsData.longitude && home?.latitude && home?.longitude) {
      const homeLat = parseFloat(EncryptionService.decrypt(home.latitude));
      const homeLon = parseFloat(EncryptionService.decrypt(home.longitude));

      if (homeLat && homeLon) {
        distanceFromHome = calculateDistance(gpsData.latitude, gpsData.longitude, homeLat, homeLon);
        gpsVerifiedOnSite = distanceFromHome <= GPS_VERIFICATION_DISTANCE_METERS;
      }
    }

    // Calculate response deadline (30 min from now)
    const responseDeadline = new Date();
    responseDeadline.setMinutes(responseDeadline.getMinutes() + RESPONSE_DEADLINE_MINUTES);

    // Create report
    const report = await GuestNotLeftReport.create({
      employeeJobAssignmentId: assignment.id,
      appointmentId,
      reportedBy: cleanerId,
      reportedAt: new Date(),
      cleanerLatitude: gpsData.latitude || null,
      cleanerLongitude: gpsData.longitude || null,
      distanceFromHome,
      notes,
      resolved: false,
      homeownerNotifiedAt: new Date(),
      responseDeadline,
      timeWindowEnd,
      gpsVerifiedOnSite,
    });

    // Update cleaner stats
    const cleaner = await User.findByPk(cleanerId);
    if (cleaner) {
      await cleaner.update({
        tenantPresentReportCount: (cleaner.tenantPresentReportCount || 0) + 1,
        lastTenantPresentReportAt: new Date(),
      });
    }

    // Notify homeowner
    const cleanerName = cleaner ? `${cleaner.firstName || "Your cleaner"}` : "Your cleaner";
    const address = home?.address || "your property";

    await NotificationService.notifyUser({
      userId: appointment.userId,
      type: "guest_not_left",
      title: "Tenant Still Present",
      body: `${cleanerName} arrived but someone is still at ${address}. Please respond within 30 minutes.`,
      data: {
        reportId: report.id,
        appointmentId,
        cleanerName,
        address,
        responseDeadline: responseDeadline.toISOString(),
        requiresResponse: true,
      },
      actionRequired: true,
      relatedAppointmentId: appointmentId,
      sendPush: true,
      sendEmail: true,
      io,
    });

    return {
      report: this.serializeTenantPresentReport(report, appointment),
      message: "Tenant present reported. Homeowner has been notified.",
    };
  }

  /**
   * Cleaner indicates they will wait on-site
   */
  static async cleanerWillWait(reportId, cleanerId) {
    const report = await this.validateReportAccess(reportId, cleanerId, "cleaner");

    await report.update({
      cleanerAction: "waiting",
      cleanerActionAt: new Date(),
    });

    return { report: this.serializeTenantPresentReport(report) };
  }

  /**
   * Cleaner indicates they will return later (only if 2+ hours remain)
   */
  static async cleanerWillReturn(reportId, cleanerId, estimatedReturnTime = null) {
    const report = await this.validateReportAccess(reportId, cleanerId, "cleaner");

    // Check time remaining
    if (report.timeWindowEnd) {
      const hoursRemaining = (new Date(report.timeWindowEnd) - new Date()) / (1000 * 60 * 60);
      if (hoursRemaining < MIN_HOURS_FOR_RETURN) {
        throw new Error(`Not enough time remaining. At least ${MIN_HOURS_FOR_RETURN} hours required.`);
      }
    }

    // Default return time if not specified
    if (!estimatedReturnTime && report.timeWindowEnd) {
      estimatedReturnTime = new Date(new Date(report.timeWindowEnd).getTime() - 60 * 60 * 1000);
    }

    await report.update({
      cleanerAction: "will_return",
      cleanerActionAt: new Date(),
      scheduledReturnTime: estimatedReturnTime,
    });

    return { report: this.serializeTenantPresentReport(report) };
  }

  /**
   * Cleaner cancels - no penalty to either party
   */
  static async cleanerCancelling(reportId, cleanerId, io = null) {
    const report = await this.validateReportAccess(reportId, cleanerId, "cleaner");

    const appointment = await UserAppointments.findByPk(report.appointmentId, {
      include: [{ model: UserHomes, as: "home" }],
    });

    // Update report
    await report.update({
      cleanerAction: "cancelled",
      cleanerActionAt: new Date(),
      resolved: true,
      resolvedAt: new Date(),
      resolvedBy: cleanerId,
      resolution: "cancelled_no_penalty",
    });

    // Cancel appointment without penalty
    await appointment.update({
      wasCancelled: true,
      cancellationType: "system",
      cancellationCategory: "tenant_present",
      cancellationConfirmedAt: new Date(),
      cancellationReason: "Tenant present - cleaner cancelled",
      reviewsBlocked: true,
    });

    // Update cleaner no-clean count
    const cleaner = await User.findByPk(cleanerId);
    if (cleaner) {
      await cleaner.update({
        tenantPresentNoCleanCount: (cleaner.tenantPresentNoCleanCount || 0) + 1,
      });
      await this.updateCleanerScrutiny(cleanerId);
    }

    // Update home stats
    if (appointment.home) {
      await appointment.home.update({
        tenantPresentIncidentCount: (appointment.home.tenantPresentIncidentCount || 0) + 1,
        lastTenantPresentIncidentAt: new Date(),
      });
    }

    // Notify homeowner
    await NotificationService.notifyUser({
      userId: appointment.userId,
      type: "guest_not_left",
      title: "Cleaning Cancelled",
      body: `Today's cleaning was cancelled because the tenant was still present. No charges have been applied.`,
      data: { appointmentId: appointment.id, cancelled: true },
      actionRequired: false,
      relatedAppointmentId: appointment.id,
      sendPush: true,
      sendEmail: true,
      io,
    });

    return { report: this.serializeTenantPresentReport(report) };
  }

  /**
   * Cleaner confirms they have returned
   */
  static async cleanerReturned(reportId, cleanerId, gpsData = {}) {
    const report = await this.validateReportAccess(reportId, cleanerId, "cleaner");

    if (report.cleanerAction !== "will_return") {
      throw new Error("Cleaner did not indicate they would return");
    }

    await report.update({
      actualReturnTime: new Date(),
      cleanerReturnedGpsLat: gpsData.latitude || null,
      cleanerReturnedGpsLng: gpsData.longitude || null,
    });

    return { report: this.serializeTenantPresentReport(report) };
  }

  /**
   * Cleaner proceeds with job (tenant left)
   */
  static async cleanerProceeding(reportId, cleanerId) {
    const report = await this.validateReportAccess(reportId, cleanerId, "cleaner");

    await report.update({
      cleanerAction: "proceeded",
      cleanerActionAt: new Date(),
      resolved: true,
      resolvedAt: new Date(),
      resolvedBy: cleanerId,
      resolution: "completed",
    });

    return { report: this.serializeTenantPresentReport(report) };
  }

  /**
   * Homeowner indicates situation is resolved
   */
  static async homeownerResolved(reportId, homeownerId, note = null, io = null) {
    const report = await this.validateReportAccess(reportId, homeownerId, "homeowner");

    await report.update({
      homeownerResponse: "resolved",
      homeownerResponseAt: new Date(),
      homeownerResponseNote: note,
    });

    // Notify cleaner
    await NotificationService.notifyUser({
      userId: report.reportedBy,
      type: "guest_not_left",
      title: "Tenant Leaving",
      body: "The homeowner says the tenant is leaving. You can proceed with the cleaning.",
      data: { reportId, resolved: true },
      actionRequired: false,
      sendPush: true,
      io,
    });

    return { report: this.serializeTenantPresentReport(report) };
  }

  /**
   * Homeowner requests more time (up to 60 min)
   */
  static async homeownerNeedsTime(reportId, homeownerId, additionalMinutes, note = null, io = null) {
    const report = await this.validateReportAccess(reportId, homeownerId, "homeowner");

    const cappedMinutes = Math.min(additionalMinutes, 60);

    await report.update({
      homeownerResponse: "need_time",
      homeownerResponseAt: new Date(),
      homeownerResponseNote: note,
      additionalTimeRequested: cappedMinutes,
    });

    // Notify cleaner
    await NotificationService.notifyUser({
      userId: report.reportedBy,
      type: "guest_not_left",
      title: "More Time Needed",
      body: `The homeowner needs ${cappedMinutes} more minutes. You can wait or come back later.`,
      data: { reportId, additionalMinutes: cappedMinutes },
      actionRequired: true,
      sendPush: true,
      io,
    });

    return { report: this.serializeTenantPresentReport(report) };
  }

  /**
   * Homeowner cannot resolve - auto-cancels with no penalty
   */
  static async homeownerCannotResolve(reportId, homeownerId, io = null) {
    const report = await this.validateReportAccess(reportId, homeownerId, "homeowner");

    const appointment = await UserAppointments.findByPk(report.appointmentId, {
      include: [{ model: UserHomes, as: "home" }],
    });

    // Update report
    await report.update({
      homeownerResponse: "cannot_resolve",
      homeownerResponseAt: new Date(),
      resolved: true,
      resolvedAt: new Date(),
      resolvedBy: homeownerId,
      resolution: "cancelled_no_penalty",
    });

    // Cancel appointment
    await appointment.update({
      wasCancelled: true,
      cancellationType: "homeowner",
      cancellationCategory: "tenant_present",
      cancellationConfirmedAt: new Date(),
      cancellationReason: "Tenant present - homeowner cannot resolve",
      reviewsBlocked: true,
    });

    // Update stats
    const cleaner = await User.findByPk(report.reportedBy);
    if (cleaner) {
      await cleaner.update({
        tenantPresentNoCleanCount: (cleaner.tenantPresentNoCleanCount || 0) + 1,
      });
      await this.updateCleanerScrutiny(report.reportedBy);
    }

    if (appointment.home) {
      await appointment.home.update({
        tenantPresentIncidentCount: (appointment.home.tenantPresentIncidentCount || 0) + 1,
        lastTenantPresentIncidentAt: new Date(),
      });
    }

    // Notify cleaner
    await NotificationService.notifyUser({
      userId: report.reportedBy,
      type: "guest_not_left",
      title: "Cleaning Cancelled",
      body: "The homeowner cannot resolve the situation. The appointment has been cancelled with no penalty.",
      data: { reportId, cancelled: true },
      actionRequired: false,
      sendPush: true,
      io,
    });

    return { report: this.serializeTenantPresentReport(report) };
  }

  /**
   * Handle response timeout (called by cron)
   */
  static async handleResponseTimeout(reportId, io = null) {
    const report = await GuestNotLeftReport.findByPk(reportId);
    if (!report || report.resolved || report.homeownerResponse) {
      return null;
    }

    await report.update({
      homeownerResponse: "no_response",
      homeownerResponseAt: new Date(),
    });

    // Notify cleaner
    await NotificationService.notifyUser({
      userId: report.reportedBy,
      type: "guest_not_left",
      title: "No Response from Homeowner",
      body: "The homeowner did not respond. You can wait longer, come back later, or cancel the appointment.",
      data: { reportId, noResponse: true },
      actionRequired: true,
      sendPush: true,
      io,
    });

    return report;
  }

  /**
   * Handle return timeout - cleaner said will return but didn't
   */
  static async handleReturnTimeout(reportId, io = null) {
    const report = await GuestNotLeftReport.findByPk(reportId);
    if (!report || report.resolved || report.cleanerAction !== "will_return" || report.actualReturnTime) {
      return null;
    }

    if (report.timeWindowEnd && new Date() < new Date(report.timeWindowEnd)) {
      return null; // Window still open
    }

    const appointment = await UserAppointments.findByPk(report.appointmentId, {
      include: [{ model: UserHomes, as: "home" }],
    });

    // Mark as cleaner no return
    await report.update({
      resolved: true,
      resolvedAt: new Date(),
      resolution: "cleaner_no_return",
    });

    // Cancel appointment
    await appointment.update({
      wasCancelled: true,
      cancellationType: "system",
      cancellationCategory: "tenant_present",
      cancellationConfirmedAt: new Date(),
      cancellationReason: "Tenant present - cleaner did not return",
      reviewsBlocked: true,
    });

    // Update cleaner stats (counts against them)
    const cleaner = await User.findByPk(report.reportedBy);
    if (cleaner) {
      await cleaner.update({
        tenantPresentNoCleanCount: (cleaner.tenantPresentNoCleanCount || 0) + 1,
      });
      await this.updateCleanerScrutiny(report.reportedBy);
    }

    if (appointment.home) {
      await appointment.home.update({
        tenantPresentIncidentCount: (appointment.home.tenantPresentIncidentCount || 0) + 1,
        lastTenantPresentIncidentAt: new Date(),
      });
    }

    return report;
  }

  // ========================================
  // ANTI-GAMING & SCRUTINY
  // ========================================

  /**
   * Update cleaner scrutiny level based on report history
   */
  static async updateCleanerScrutiny(cleanerId) {
    const stats = await this.getCleanerReportStats(cleanerId, 6);
    const { totalReports, reportsWithoutCleaning } = stats;

    let scrutinyLevel = "none";

    if (reportsWithoutCleaning >= SCRUTINY_HIGH_RISK_NO_CLEAN_COUNT) {
      scrutinyLevel = "high_risk";
    } else if (reportsWithoutCleaning >= SCRUTINY_WATCH_NO_CLEAN_COUNT) {
      scrutinyLevel = "watch";
    }

    await User.update(
      { tenantReportScrutinyLevel: scrutinyLevel },
      { where: { id: cleanerId } }
    );

    return scrutinyLevel;
  }

  /**
   * Get cleaner report stats for last N months
   */
  static async getCleanerReportStats(cleanerId, months = 6) {
    const { Op } = require("sequelize");
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - months);

    const reports = await GuestNotLeftReport.findAll({
      where: {
        reportedBy: cleanerId,
        reportedAt: { [Op.gte]: startDate },
      },
    });

    const totalReports = reports.length;
    const reportsWithoutCleaning = reports.filter(
      (r) => r.resolution && r.resolution !== "completed"
    ).length;

    return { totalReports, reportsWithoutCleaning, periodMonths: months };
  }

  /**
   * Get home incident stats
   */
  static async getHomeIncidentStats(homeId, months = 12) {
    const { Op } = require("sequelize");
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - months);

    const appointments = await UserAppointments.findAll({
      where: { homeId },
      attributes: ["id"],
    });

    const appointmentIds = appointments.map((a) => a.id);

    const reports = await GuestNotLeftReport.findAll({
      where: {
        appointmentId: { [Op.in]: appointmentIds },
        reportedAt: { [Op.gte]: startDate },
      },
    });

    const uniqueCleaners = new Set(reports.map((r) => r.reportedBy));

    return {
      totalIncidents: reports.length,
      uniqueCleanersReporting: uniqueCleaners.size,
      likelyRealIssue: uniqueCleaners.size >= 2,
    };
  }

  // ========================================
  // QUERIES
  // ========================================

  /**
   * Get active report for appointment
   */
  static async getActiveReportForAppointment(appointmentId) {
    const report = await GuestNotLeftReport.findOne({
      where: { appointmentId, resolved: false },
      include: [{ model: User, as: "reporter", attributes: ["id", "firstName", "lastName"] }],
    });

    if (!report) return null;

    const appointment = await UserAppointments.findByPk(appointmentId, {
      include: [{ model: UserHomes, as: "home" }],
    });

    return this.serializeTenantPresentReport(report, appointment);
  }

  /**
   * Get pending reports for homeowner
   */
  static async getPendingReportsForHomeowner(homeownerId) {
    const appointments = await UserAppointments.findAll({
      where: { userId: homeownerId },
      attributes: ["id"],
    });

    const appointmentIds = appointments.map((a) => a.id);

    const reports = await GuestNotLeftReport.findAll({
      where: {
        appointmentId: { [Op.in]: appointmentIds },
        resolved: false,
        homeownerResponse: null,
      },
      include: [{ model: User, as: "reporter", attributes: ["id", "firstName", "lastName"] }],
      order: [["reportedAt", "DESC"]],
    });

    return Promise.all(
      reports.map(async (report) => {
        const appointment = await UserAppointments.findByPk(report.appointmentId, {
          include: [{ model: UserHomes, as: "home" }],
        });
        return this.serializeTenantPresentReport(report, appointment);
      })
    );
  }

  /**
   * Get reports with expired response deadline (for cron)
   */
  static async getReportsWithExpiredDeadline() {
    const { Op } = require("sequelize");
    return GuestNotLeftReport.findAll({
      where: {
        resolved: false,
        homeownerResponse: null,
        responseDeadline: { [Op.lte]: new Date() },
      },
    });
  }

  /**
   * Get reports where cleaner said will return but window expired (for cron)
   */
  static async getExpiredReturnReports() {
    const { Op } = require("sequelize");
    return GuestNotLeftReport.findAll({
      where: {
        resolved: false,
        cleanerAction: "will_return",
        actualReturnTime: null,
        timeWindowEnd: { [Op.lte]: new Date() },
      },
    });
  }

  // ========================================
  // HELPERS
  // ========================================

  /**
   * Validate report access for user
   */
  static async validateReportAccess(reportId, userId, userType) {
    const report = await GuestNotLeftReport.findByPk(reportId);
    if (!report) throw new Error("Report not found");
    if (report.resolved) throw new Error("Report already resolved");

    if (userType === "cleaner" && report.reportedBy !== userId) {
      throw new Error("Not authorized");
    }

    if (userType === "homeowner") {
      const appointment = await UserAppointments.findByPk(report.appointmentId);
      if (!appointment || appointment.userId !== userId) {
        throw new Error("Not authorized");
      }
    }

    return report;
  }

  /**
   * Calculate time window end from appointment
   */
  static calculateTimeWindowEnd(appointment) {
    const timeConstraint = appointment.timeConstraint;
    if (!timeConstraint) {
      const endOfDay = new Date(appointment.date);
      endOfDay.setHours(23, 59, 59);
      return endOfDay;
    }

    const parts = timeConstraint.split("-");
    if (parts.length !== 2) {
      const endOfDay = new Date(appointment.date);
      endOfDay.setHours(23, 59, 59);
      return endOfDay;
    }

    const endTimePart = parts[1].trim();
    const timeMatch = endTimePart.match(/(\d{1,2}):?(\d{2})?\s*(AM|PM)?/i);

    if (!timeMatch) {
      const endOfDay = new Date(appointment.date);
      endOfDay.setHours(23, 59, 59);
      return endOfDay;
    }

    let hours = parseInt(timeMatch[1], 10);
    const minutes = timeMatch[2] ? parseInt(timeMatch[2], 10) : 0;
    const meridiem = timeMatch[3]?.toUpperCase();

    if (meridiem === "PM" && hours !== 12) hours += 12;
    if (meridiem === "AM" && hours === 12) hours = 0;

    const windowEnd = new Date(appointment.date);
    windowEnd.setHours(hours, minutes, 0, 0);

    return windowEnd;
  }

  /**
   * Serialize report for API response
   */
  static serializeTenantPresentReport(report, appointment = null) {
    const now = new Date();
    const responseDeadline = report.responseDeadline ? new Date(report.responseDeadline) : null;
    const timeWindowEnd = report.timeWindowEnd ? new Date(report.timeWindowEnd) : null;

    const hoursRemaining = timeWindowEnd ? (timeWindowEnd - now) / (1000 * 60 * 60) : null;

    return {
      id: report.id,
      appointmentId: report.appointmentId,
      reportedBy: report.reportedBy,
      reportedAt: report.reportedAt,
      notes: report.notes,
      resolved: report.resolved,
      resolution: report.resolution,

      // GPS
      gpsVerifiedOnSite: report.gpsVerifiedOnSite,
      distanceFromHome: report.distanceFromHome,

      // Homeowner response
      homeownerResponse: report.homeownerResponse,
      homeownerResponseAt: report.homeownerResponseAt,
      additionalTimeRequested: report.additionalTimeRequested,
      responseDeadline: report.responseDeadline,
      isAwaitingResponse: !report.homeownerResponse && responseDeadline && now < responseDeadline,
      isResponseExpired: !report.homeownerResponse && responseDeadline && now >= responseDeadline,
      minutesUntilDeadline: responseDeadline ? Math.max(0, Math.floor((responseDeadline - now) / (1000 * 60))) : null,

      // Cleaner action
      cleanerAction: report.cleanerAction,
      scheduledReturnTime: report.scheduledReturnTime,
      actualReturnTime: report.actualReturnTime,
      canReturn: hoursRemaining !== null && hoursRemaining >= MIN_HOURS_FOR_RETURN,

      // Time window
      timeWindowEnd: report.timeWindowEnd,
      hoursRemaining: hoursRemaining !== null ? Math.max(0, hoursRemaining) : null,
      isTimeWindowExpired: timeWindowEnd && now >= timeWindowEnd,

      // Reporter
      reporter: report.reporter ? {
        id: report.reporter.id,
        firstName: report.reporter.firstName,
        lastName: report.reporter.lastName,
      } : null,

      // Appointment
      appointment: appointment ? {
        id: appointment.id,
        date: appointment.date,
        timeConstraint: appointment.timeConstraint,
        address: appointment.home?.address,
        city: appointment.home?.city,
      } : null,
    };
  }
}

module.exports = GuestNotLeftService;
