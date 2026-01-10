/**
 * BusinessEmployeeService - Handles business employee management
 * Manages employee invitations, onboarding, and access control
 */

const crypto = require("crypto");
const EncryptionService = require("./EncryptionService");
const {
  BusinessEmployee,
  User,
  EmployeeJobAssignment,
  sequelize,
} = require("../models");

class BusinessEmployeeService {
  /**
   * Generate a unique invitation token
   * @returns {Promise<string>} Unique invitation token
   */
  static async generateInviteToken() {
    const maxAttempts = 10;
    let attempts = 0;

    while (attempts < maxAttempts) {
      // Generate a 32-character hex token
      const token = crypto.randomBytes(16).toString("hex");

      // Check if token already exists
      const existing = await BusinessEmployee.findOne({
        where: { inviteToken: token },
      });

      if (!existing) {
        return token;
      }

      attempts++;
    }

    throw new Error("Failed to generate unique invitation token");
  }

  /**
   * Invite a new employee to join the business
   * @param {number} businessOwnerId - ID of the business owner
   * @param {Object} employeeData - Employee details
   * @param {string} employeeData.firstName
   * @param {string} employeeData.lastName
   * @param {string} employeeData.email
   * @param {string} [employeeData.phone]
   * @param {number} [employeeData.defaultHourlyRate] - Default hourly rate in cents
   * @param {string} [employeeData.paymentMethod] - 'stripe_connect' or 'direct_payment'
   * @param {string} [employeeData.notes]
   * @returns {Promise<Object>} Created BusinessEmployee record
   */
  static async inviteEmployee(businessOwnerId, employeeData) {
    const {
      firstName,
      lastName,
      email,
      phone,
      defaultHourlyRate,
      paymentMethod = "direct_payment",
      notes,
    } = employeeData;

    // Verify business owner exists and is a business owner
    const businessOwner = await User.findByPk(businessOwnerId);
    if (!businessOwner || !businessOwner.isBusinessOwner) {
      throw new Error("Invalid business owner");
    }

    // Check if employee with same email already exists for this business owner
    const emailHash = EncryptionService.hash(email.toLowerCase());
    const existing = await BusinessEmployee.findOne({
      where: {
        businessOwnerId,
        emailHash,
        status: ["pending_invite", "active", "inactive"],
      },
    });

    if (existing) {
      throw new Error("An employee with this email already exists");
    }

    // Generate invite token
    const inviteToken = await this.generateInviteToken();
    const inviteExpiresAt = new Date();
    inviteExpiresAt.setDate(inviteExpiresAt.getDate() + 7); // 7 days expiration

    // Create the employee record
    const employee = await BusinessEmployee.create({
      businessOwnerId,
      firstName,
      lastName,
      email: email.toLowerCase(),
      phone,
      status: "pending_invite",
      inviteToken,
      inviteExpiresAt,
      invitedAt: new Date(),
      defaultHourlyRate: defaultHourlyRate || null,
      paymentMethod,
      notes,
    });

    return employee;
  }

  /**
   * Resend an invitation to an employee
   * @param {number} businessEmployeeId - ID of the business employee
   * @param {number} businessOwnerId - ID of the business owner
   * @returns {Promise<Object>} Updated BusinessEmployee record
   */
  static async resendInvite(businessEmployeeId, businessOwnerId) {
    const employee = await BusinessEmployee.findOne({
      where: {
        id: businessEmployeeId,
        businessOwnerId,
        status: "pending_invite",
      },
    });

    if (!employee) {
      throw new Error("Employee not found or invite already accepted");
    }

    // Generate new invite token
    const inviteToken = await this.generateInviteToken();
    const inviteExpiresAt = new Date();
    inviteExpiresAt.setDate(inviteExpiresAt.getDate() + 7);

    await employee.update({
      inviteToken,
      inviteExpiresAt,
      invitedAt: new Date(),
    });

    return employee;
  }

  /**
   * Validate an invitation token
   * @param {string} token - Invitation token
   * @returns {Promise<Object|null>} BusinessEmployee record or null if invalid
   */
  static async validateInviteToken(token) {
    if (!token || typeof token !== "string" || token.length !== 32) {
      return null;
    }

    const employee = await BusinessEmployee.findOne({
      where: { inviteToken: token },
      include: [
        {
          model: User,
          as: "businessOwner",
          attributes: ["id", "firstName", "lastName", "businessName"],
        },
      ],
    });

    if (!employee) {
      return null;
    }

    // Check if invitation is expired
    if (employee.inviteExpiresAt && employee.inviteExpiresAt < new Date()) {
      return {
        ...employee.toJSON(),
        isExpired: true,
      };
    }

    // Check if already accepted
    if (employee.status !== "pending_invite") {
      return {
        ...employee.toJSON(),
        isAlreadyAccepted: employee.status === "active" || employee.status === "inactive",
        isTerminated: employee.status === "terminated",
        // Include email for account recovery when already accepted
        email: employee.email,
      };
    }

    return employee;
  }

  /**
   * Accept an employee invitation
   * @param {string} inviteToken - Invitation token
   * @param {number} userId - ID of the user accepting the invite
   * @returns {Promise<Object>} Updated BusinessEmployee record
   */
  static async acceptInvite(inviteToken, userId) {
    const employee = await this.validateInviteToken(inviteToken);

    if (!employee) {
      throw new Error("Invalid invitation token");
    }

    if (employee.isExpired) {
      throw new Error("Invitation has expired");
    }

    if (employee.isAlreadyAccepted) {
      throw new Error("Invitation has already been accepted");
    }

    if (employee.isTerminated) {
      throw new Error("This employee record has been terminated");
    }

    // Get the user
    const user = await User.findByPk(userId);
    if (!user) {
      throw new Error("User not found");
    }

    // Check if user is already an employee of another business
    if (user.employeeOfBusinessId) {
      throw new Error("User is already an employee of another business");
    }

    // Transaction to update both employee and user
    const result = await sequelize.transaction(async (t) => {
      // Update the employee record
      await employee.update(
        {
          userId,
          status: "active",
          acceptedAt: new Date(),
          inviteToken: null, // Clear the token
          inviteExpiresAt: null,
        },
        { transaction: t }
      );

      // Update the user to be a business employee
      await user.update(
        {
          type: "employee",
          employeeOfBusinessId: employee.businessOwnerId,
          isMarketplaceCleaner: false,
        },
        { transaction: t }
      );

      return employee.reload({ transaction: t });
    });

    return result;
  }

  /**
   * Accept an employee invitation with signup (create new user account)
   * @param {string} inviteToken - Invitation token
   * @param {Object} userData - User signup data
   * @param {string} userData.firstName
   * @param {string} userData.lastName
   * @param {string} userData.username
   * @param {string} userData.password - Plain text password (will be hashed)
   * @param {string} [userData.phone]
   * @param {number} [userData.termsId]
   * @param {number} [userData.privacyPolicyId]
   * @returns {Promise<Object>} { user, employee }
   */
  static async acceptInviteWithSignup(inviteToken, userData) {
    const employee = await this.validateInviteToken(inviteToken);

    if (!employee) {
      throw new Error("Invalid invitation token");
    }

    if (employee.isExpired) {
      throw new Error("Invitation has expired");
    }

    if (employee.isAlreadyAccepted) {
      throw new Error("Invitation has already been accepted");
    }

    if (employee.isTerminated) {
      throw new Error("This employee record has been terminated");
    }

    const { firstName, lastName, username, password, phone, termsId, privacyPolicyId } = userData;

    // Validate required fields
    if (!firstName || !lastName || !username || !password) {
      throw new Error("First name, last name, username, and password are required");
    }

    // Validate username length
    if (username.length < 4 || username.length > 12) {
      throw new Error("Username must be between 4 and 12 characters");
    }

    // Check for existing username
    const existingUsername = await User.findOne({
      where: { username: username.toLowerCase() },
    });
    if (existingUsername) {
      throw new Error("Username already exists");
    }

    // Check for existing email (using the employee's invited email)
    const emailToUse = employee.email;
    const emailHash = EncryptionService.hash(emailToUse.toLowerCase());
    const existingEmail = await User.findOne({
      where: { emailHash },
    });
    if (existingEmail) {
      throw new Error("An account with this email already exists");
    }

    // Transaction to create user and update employee
    const result = await sequelize.transaction(async (t) => {
      // Create the user account
      const newUser = await User.create(
        {
          firstName,
          lastName,
          username: username.toLowerCase(),
          password, // Will be hashed by User model's beforeCreate hook
          email: emailToUse,
          phone: phone || employee.phone || null,
          type: "employee",
          employeeOfBusinessId: employee.businessOwnerId,
          isMarketplaceCleaner: false,
          termsId: termsId || null,
          privacyPolicyId: privacyPolicyId || null,
        },
        { transaction: t }
      );

      // Update the employee record
      await employee.update(
        {
          userId: newUser.id,
          status: "active",
          acceptedAt: new Date(),
          inviteToken: null,
          inviteExpiresAt: null,
          // Update names if provided differently
          firstName: firstName || employee.firstName,
          lastName: lastName || employee.lastName,
          phone: phone || employee.phone,
        },
        { transaction: t }
      );

      await employee.reload({ transaction: t });

      return { user: newUser, employee };
    });

    return result;
  }

  /**
   * Decline an employee invitation
   * @param {string} inviteToken - Invitation token
   * @returns {Promise<void>}
   */
  static async declineInvite(inviteToken) {
    const employee = await this.validateInviteToken(inviteToken);

    if (!employee) {
      throw new Error("Invalid invitation token");
    }

    if (employee.isAlreadyAccepted) {
      throw new Error("Invitation has already been accepted");
    }

    // Mark invitation as declined by clearing the token
    await employee.update({
      inviteToken: null,
      inviteExpiresAt: null,
      status: "declined",
    });
  }

  /**
   * Get all employees for a business owner
   * @param {number} businessOwnerId - ID of the business owner
   * @param {Object} [options] - Query options
   * @param {string[]} [options.status] - Filter by status(es)
   * @returns {Promise<Object[]>} Array of BusinessEmployee records
   */
  static async getEmployeesByBusinessOwner(businessOwnerId, options = {}) {
    const { status } = options;

    const where = { businessOwnerId };
    if (status && status.length > 0) {
      where.status = status;
    }

    const employees = await BusinessEmployee.findAll({
      where,
      include: [
        {
          model: User,
          as: "user",
          attributes: ["id", "firstName", "lastName", "email", "phone"],
          required: false,
        },
      ],
      order: [["createdAt", "DESC"]],
    });

    return employees;
  }

  /**
   * Get a single employee by ID
   * @param {number} employeeId - ID of the business employee
   * @param {number} businessOwnerId - ID of the business owner
   * @returns {Promise<Object|null>} BusinessEmployee record or null
   */
  static async getEmployeeById(employeeId, businessOwnerId) {
    return BusinessEmployee.findOne({
      where: {
        id: employeeId,
        businessOwnerId,
      },
      include: [
        {
          model: User,
          as: "user",
          attributes: ["id", "firstName", "lastName", "email", "phone", "expoPushToken"],
          required: false,
        },
        {
          model: EmployeeJobAssignment,
          as: "jobAssignments",
          limit: 10,
          order: [["createdAt", "DESC"]],
        },
      ],
    });
  }

  /**
   * Update an employee's details
   * @param {number} employeeId - ID of the business employee
   * @param {number} businessOwnerId - ID of the business owner
   * @param {Object} updates - Fields to update
   * @returns {Promise<Object>} Updated BusinessEmployee record
   */
  static async updateEmployee(employeeId, businessOwnerId, updates) {
    const employee = await BusinessEmployee.findOne({
      where: {
        id: employeeId,
        businessOwnerId,
      },
    });

    if (!employee) {
      throw new Error("Employee not found");
    }

    // Only allow updating certain fields
    const allowedUpdates = [
      "firstName",
      "lastName",
      "phone",
      "defaultHourlyRate",
      "paymentMethod",
      "canViewClientDetails",
      "canViewJobEarnings",
      "canMessageClients",
      "notes",
      "availableSchedule",
      "defaultJobTypes",
      "maxJobsPerDay",
    ];

    const filteredUpdates = {};
    for (const key of allowedUpdates) {
      if (updates[key] !== undefined) {
        filteredUpdates[key] = updates[key];
      }
    }

    await employee.update(filteredUpdates);
    return employee;
  }

  /**
   * Terminate an employee
   * @param {number} employeeId - ID of the business employee
   * @param {number} businessOwnerId - ID of the business owner
   * @param {string} [reason] - Termination reason
   * @returns {Promise<Object>} Updated BusinessEmployee record
   */
  static async terminateEmployee(employeeId, businessOwnerId, reason = null) {
    const employee = await BusinessEmployee.findOne({
      where: {
        id: employeeId,
        businessOwnerId,
      },
      include: [
        {
          model: User,
          as: "user",
        },
      ],
    });

    if (!employee) {
      throw new Error("Employee not found");
    }

    if (employee.status === "terminated") {
      throw new Error("Employee is already terminated");
    }

    // Check for pending assignments
    const pendingAssignments = await EmployeeJobAssignment.count({
      where: {
        businessEmployeeId: employeeId,
        status: ["assigned", "started"],
      },
    });

    if (pendingAssignments > 0) {
      throw new Error(
        `Cannot terminate employee with ${pendingAssignments} pending job(s). Please reassign or complete them first.`
      );
    }

    // Transaction to update both employee and user
    await sequelize.transaction(async (t) => {
      await employee.update(
        {
          status: "terminated",
          terminatedAt: new Date(),
          terminationReason: reason,
        },
        { transaction: t }
      );

      // Update the user if linked
      if (employee.user) {
        await employee.user.update(
          {
            employeeOfBusinessId: null,
            isMarketplaceCleaner: true, // Allow them back on marketplace
          },
          { transaction: t }
        );
      }
    });

    return employee.reload();
  }

  /**
   * Reactivate a terminated employee
   * @param {number} employeeId - ID of the business employee
   * @param {number} businessOwnerId - ID of the business owner
   * @returns {Promise<Object>} Updated BusinessEmployee record
   */
  static async reactivateEmployee(employeeId, businessOwnerId) {
    const employee = await BusinessEmployee.findOne({
      where: {
        id: employeeId,
        businessOwnerId,
        status: ["terminated", "inactive"],
      },
      include: [
        {
          model: User,
          as: "user",
        },
      ],
    });

    if (!employee) {
      throw new Error("Employee not found or not eligible for reactivation");
    }

    // If employee had a linked user, check if they're available
    if (employee.userId) {
      const user = await User.findByPk(employee.userId);
      if (user && user.employeeOfBusinessId && user.employeeOfBusinessId !== businessOwnerId) {
        throw new Error("This employee is now associated with another business");
      }
    }

    // Transaction to update both employee and user
    await sequelize.transaction(async (t) => {
      await employee.update(
        {
          status: "active",
          terminatedAt: null,
          terminationReason: null,
        },
        { transaction: t }
      );

      // Re-link user if exists
      if (employee.user) {
        await employee.user.update(
          {
            employeeOfBusinessId: businessOwnerId,
            isMarketplaceCleaner: false,
          },
          { transaction: t }
        );
      }
    });

    return employee.reload();
  }

  /**
   * Validate that an employee can access a specific job
   * @param {number} userId - User ID
   * @param {number} appointmentId - Appointment ID
   * @returns {Promise<boolean>} True if access is allowed
   */
  static async canEmployeeViewJob(userId, appointmentId) {
    const user = await User.findByPk(userId);
    if (!user || !user.employeeOfBusinessId) {
      return false;
    }

    // Find the employee record
    const employee = await BusinessEmployee.findOne({
      where: {
        userId,
        status: "active",
      },
    });

    if (!employee) {
      return false;
    }

    // Check if there's an assignment for this employee on this job
    const assignment = await EmployeeJobAssignment.findOne({
      where: {
        businessEmployeeId: employee.id,
        appointmentId,
        status: ["assigned", "started", "completed"],
      },
    });

    return !!assignment;
  }

  /**
   * Get employee statistics
   * @param {number} businessOwnerId - ID of the business owner
   * @returns {Promise<Object>} Employee statistics
   */
  static async getEmployeeStats(businessOwnerId) {
    const [employees, jobStats] = await Promise.all([
      BusinessEmployee.findAll({
        where: { businessOwnerId },
        attributes: ["id", "status"],
      }),
      EmployeeJobAssignment.findAll({
        where: { businessOwnerId },
        attributes: [
          "businessEmployeeId",
          "status",
          [sequelize.fn("COUNT", sequelize.col("id")), "count"],
        ],
        group: ["businessEmployeeId", "status"],
      }),
    ]);

    const totalEmployees = employees.length;
    const activeEmployees = employees.filter((e) => e.status === "active").length;
    const pendingInvites = employees.filter((e) => e.status === "pending_invite").length;

    return {
      totalEmployees,
      activeEmployees,
      pendingInvites,
      terminatedEmployees: employees.filter((e) => e.status === "terminated").length,
      jobStats: jobStats.map((s) => s.toJSON()),
    };
  }

  /**
   * Get available employees for a specific job date/time
   * @param {number} businessOwnerId - ID of the business owner
   * @param {Date|string} jobDate - Date of the job
   * @param {string} [startTime] - Start time in HH:MM format
   * @param {string} [jobType] - Type of cleaning job
   * @returns {Promise<Object[]>} Array of available employees with availability info
   */
  static async getAvailableEmployees(businessOwnerId, jobDate, startTime = null, jobType = null) {
    const date = new Date(jobDate);
    const dayOfWeek = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"][date.getDay()];

    // Get all active employees
    const employees = await BusinessEmployee.findAll({
      where: {
        businessOwnerId,
        status: "active",
      },
      include: [
        {
          model: User,
          as: "user",
          attributes: ["id", "firstName", "lastName"],
          required: false,
        },
      ],
    });

    // Get job counts for that date for each employee
    const dateStart = new Date(date);
    dateStart.setHours(0, 0, 0, 0);
    const dateEnd = new Date(date);
    dateEnd.setHours(23, 59, 59, 999);

    const jobCounts = await EmployeeJobAssignment.findAll({
      where: {
        businessOwnerId,
        status: ["assigned", "started", "completed"],
      },
      attributes: [
        "businessEmployeeId",
        [sequelize.fn("COUNT", sequelize.col("EmployeeJobAssignment.id")), "jobCount"],
      ],
      group: ["businessEmployeeId"],
      include: [
        {
          model: sequelize.models.UserAppointments,
          as: "appointment",
          attributes: [],
          where: {
            scheduledDate: {
              [sequelize.Sequelize.Op.between]: [dateStart, dateEnd],
            },
          },
          required: true,
        },
      ],
    });

    const jobCountMap = {};
    jobCounts.forEach((jc) => {
      jobCountMap[jc.businessEmployeeId] = parseInt(jc.get("jobCount"), 10);
    });

    // Check availability for each employee
    const results = employees.map((employee) => {
      const isAvailable = employee.isAvailableOn(dayOfWeek, startTime);
      const canHandleType = !jobType || employee.canHandleJobType(jobType);
      const currentJobCount = jobCountMap[employee.id] || 0;
      const maxReached = employee.maxJobsPerDay && currentJobCount >= employee.maxJobsPerDay;

      return {
        ...employee.toJSON(),
        availability: {
          isAvailable,
          canHandleType,
          currentJobCount,
          maxJobsPerDay: employee.maxJobsPerDay,
          maxReached,
          reason: !isAvailable
            ? "Not available on this day/time"
            : !canHandleType
            ? "Cannot handle this job type"
            : maxReached
            ? `Already has ${currentJobCount} job(s) on this day`
            : null,
        },
      };
    });

    // Sort: available first, then by name
    results.sort((a, b) => {
      const aReady = a.availability.isAvailable && a.availability.canHandleType && !a.availability.maxReached;
      const bReady = b.availability.isAvailable && b.availability.canHandleType && !b.availability.maxReached;
      if (aReady && !bReady) return -1;
      if (!aReady && bReady) return 1;
      return a.firstName.localeCompare(b.firstName);
    });

    return results;
  }

  /**
   * Update employee availability schedule
   * @param {number} employeeId - ID of the business employee
   * @param {number} businessOwnerId - ID of the business owner
   * @param {Object} schedule - Availability schedule object
   * @returns {Promise<Object>} Updated BusinessEmployee record
   */
  static async updateAvailability(employeeId, businessOwnerId, schedule) {
    const employee = await BusinessEmployee.findOne({
      where: {
        id: employeeId,
        businessOwnerId,
      },
    });

    if (!employee) {
      throw new Error("Employee not found");
    }

    // Validate schedule format
    const validDays = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];
    const sanitizedSchedule = {};

    for (const [day, settings] of Object.entries(schedule)) {
      if (!validDays.includes(day.toLowerCase())) {
        throw new Error(`Invalid day: ${day}`);
      }

      // Validate time format if provided
      if (settings.start && !/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/.test(settings.start)) {
        throw new Error(`Invalid start time format for ${day}`);
      }
      if (settings.end && !/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/.test(settings.end)) {
        throw new Error(`Invalid end time format for ${day}`);
      }

      sanitizedSchedule[day.toLowerCase()] = {
        available: Boolean(settings.available),
        start: settings.start || null,
        end: settings.end || null,
      };
    }

    await employee.update({ availableSchedule: sanitizedSchedule });
    return employee;
  }
}

module.exports = BusinessEmployeeService;
