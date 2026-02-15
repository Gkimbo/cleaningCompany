const EncryptionService = require("../services/EncryptionService");

class BusinessEmployeeSerializer {
  // Fields that are encrypted in both BusinessEmployee and User models
  static encryptedFields = ["firstName", "lastName", "email", "phone"];

  static decryptField(value) {
    if (!value) return null;
    return EncryptionService.decrypt(value);
  }

  /**
   * Serialize a single BusinessEmployee
   * @param {Object} employee - BusinessEmployee instance or plain object
   * @param {Object} options - Serialization options
   * @param {boolean} options.includeUser - Include nested user data
   * @param {boolean} options.includeAssignments - Include job assignments
   * @param {boolean} options.includeBusinessOwner - Include business owner data
   * @returns {Object} Serialized employee
   */
  static serializeOne(employee, options = {}) {
    if (!employee) return null;

    const {
      includeUser = true,
      includeAssignments = false,
      includeBusinessOwner = false,
    } = options;

    const data = employee.dataValues || employee;

    const serialized = {
      id: data.id,
      businessOwnerId: data.businessOwnerId,
      userId: data.userId,
      firstName: this.decryptField(data.firstName),
      lastName: this.decryptField(data.lastName),
      email: this.decryptField(data.email),
      phone: this.decryptField(data.phone),
      status: data.status,
      payType: data.payType,
      defaultHourlyRate: data.defaultHourlyRate,
      defaultJobRate: data.defaultJobRate,
      payRate: data.payRate ? parseFloat(data.payRate) : null,
      paymentMethod: data.paymentMethod,
      stripeConnectOnboarded: data.stripeConnectOnboarded,
      canViewClientDetails: data.canViewClientDetails,
      canViewJobEarnings: data.canViewJobEarnings,
      canMessageClients: data.canMessageClients,
      availableSchedule: data.availableSchedule,
      defaultJobTypes: data.defaultJobTypes,
      maxJobsPerDay: data.maxJobsPerDay,
      invitedAt: data.invitedAt,
      acceptedAt: data.acceptedAt,
      createdAt: data.createdAt,
    };

    // Include formatted pay rates
    if (data.defaultHourlyRate) {
      serialized.formattedHourlyRate = `$${(data.defaultHourlyRate / 100).toFixed(2)}/hr`;
    }
    if (data.defaultJobRate) {
      serialized.formattedJobRate = `$${(data.defaultJobRate / 100).toFixed(2)}/job`;
    }
    if (data.payRate) {
      serialized.formattedPayRate = `${parseFloat(data.payRate)}%`;
    }

    // Serialize nested user if present and requested (check both data and employee for Sequelize associations)
    const rawUser = data.user || employee.user;
    if (includeUser && rawUser) {
      serialized.user = this.serializeUser(rawUser);
    }

    // Serialize business owner if present and requested (check both data and employee for Sequelize associations)
    const rawBusinessOwner = data.businessOwner || employee.businessOwner;
    if (includeBusinessOwner && rawBusinessOwner) {
      serialized.businessOwner = this.serializeUser(rawBusinessOwner);
    }

    // Include job assignments if present and requested (check both data and employee for Sequelize associations)
    const rawJobAssignments = data.jobAssignments || employee.jobAssignments;
    if (includeAssignments && rawJobAssignments) {
      serialized.jobAssignments = rawJobAssignments.map((assignment) => ({
        id: assignment.id,
        appointmentId: assignment.appointmentId,
        status: assignment.status,
        payAmount: assignment.payAmount,
        assignedAt: assignment.assignedAt,
        completedAt: assignment.completedAt,
      }));
    }

    // Include availability info if present (from getAvailableEmployees)
    if (data.availability) {
      serialized.availability = data.availability;
    }

    return serialized;
  }

  /**
   * Serialize an array of BusinessEmployees
   * @param {Array} employees - Array of BusinessEmployee instances
   * @param {Object} options - Serialization options
   * @returns {Array} Serialized employees
   */
  static serializeArray(employees, options = {}) {
    if (!employees || !Array.isArray(employees)) return [];
    return employees.map((employee) => this.serializeOne(employee, options));
  }

  /**
   * Serialize user data with decryption
   * @param {Object} user - User instance or plain object
   * @returns {Object} Serialized user with decrypted fields
   */
  static serializeUser(user) {
    if (!user) return null;

    const data = user.dataValues || user;

    return {
      id: data.id,
      firstName: this.decryptField(data.firstName),
      lastName: this.decryptField(data.lastName),
      email: this.decryptField(data.email),
      phone: this.decryptField(data.phone),
      businessName: data.businessName,
      businessLogo: data.businessLogo,
      expoPushToken: data.expoPushToken,
    };
  }

  /**
   * Serialize for employee list view (minimal data)
   * @param {Object} employee - BusinessEmployee instance
   * @returns {Object} Minimal serialized employee
   */
  static serializeListItem(employee) {
    if (!employee) return null;

    const data = employee.dataValues || employee;
    // Check both data.user and employee.user for Sequelize associations
    const rawUser = data.user || employee.user;

    return {
      id: data.id,
      firstName: this.decryptField(data.firstName),
      lastName: this.decryptField(data.lastName),
      status: data.status,
      canMessageClients: data.canMessageClients,
      paymentMethod: data.paymentMethod,
      user: rawUser ? {
        id: rawUser.id,
        firstName: this.decryptField(rawUser.firstName),
        lastName: this.decryptField(rawUser.lastName),
      } : null,
    };
  }

  /**
   * Serialize for invitation response
   * @param {Object} employee - BusinessEmployee with businessOwner included
   * @returns {Object} Invitation data
   */
  static serializeInvitation(employee) {
    if (!employee) return null;

    const data = employee.dataValues || employee;
    // Check both data.businessOwner and employee.businessOwner for Sequelize associations
    const rawBusinessOwner = data.businessOwner || employee.businessOwner;
    const businessOwner = rawBusinessOwner
      ? this.serializeUser(rawBusinessOwner)
      : null;

    return {
      firstName: this.decryptField(data.firstName),
      lastName: this.decryptField(data.lastName),
      email: this.decryptField(data.email),
      businessName: businessOwner?.businessName || "Business",
      businessLogo: businessOwner?.businessLogo || null,
      businessOwnerName: businessOwner
        ? `${businessOwner.firstName} ${businessOwner.lastName}`
        : null,
    };
  }

  /**
   * Serialize for employee profile view
   * @param {Object} employee - BusinessEmployee with businessOwner included
   * @returns {Object} Profile data
   */
  static serializeProfile(employee) {
    if (!employee) return null;

    const data = employee.dataValues || employee;
    // Check both data.businessOwner and employee.businessOwner for Sequelize associations
    const rawBusinessOwner = data.businessOwner || employee.businessOwner;
    const businessOwner = rawBusinessOwner
      ? this.serializeUser(rawBusinessOwner)
      : null;

    return {
      id: data.id,
      firstName: this.decryptField(data.firstName),
      lastName: this.decryptField(data.lastName),
      email: this.decryptField(data.email),
      phone: this.decryptField(data.phone),
      status: data.status,
      paymentMethod: data.paymentMethod,
      stripeConnectOnboarded: data.stripeConnectOnboarded,
      canViewClientDetails: data.canViewClientDetails,
      canViewJobEarnings: data.canViewJobEarnings,
      canMessageClients: data.canMessageClients,
      businessOwner: businessOwner
        ? {
            name: `${businessOwner.firstName} ${businessOwner.lastName}`,
            businessName: businessOwner.businessName,
            businessLogo: businessOwner.businessLogo,
          }
        : null,
    };
  }
}

module.exports = BusinessEmployeeSerializer;
