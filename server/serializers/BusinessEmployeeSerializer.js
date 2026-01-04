const EncryptionService = require("../services/EncryptionService");

class BusinessEmployeeSerializer {
  // Fields that are encrypted in the User model (nested user data)
  static encryptedUserFields = ["firstName", "lastName", "email", "phone"];

  static decryptUserField(value) {
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
      firstName: data.firstName,
      lastName: data.lastName,
      email: data.email,
      phone: data.phone,
      status: data.status,
      defaultHourlyRate: data.defaultHourlyRate,
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

    // Include formatted pay rate
    if (data.defaultHourlyRate) {
      serialized.formattedHourlyRate = `$${(data.defaultHourlyRate / 100).toFixed(2)}`;
    }

    // Serialize nested user if present and requested
    if (includeUser && data.user) {
      serialized.user = this.serializeUser(data.user);
    }

    // Serialize business owner if present and requested
    if (includeBusinessOwner && data.businessOwner) {
      serialized.businessOwner = this.serializeUser(data.businessOwner);
    }

    // Include job assignments if present and requested
    if (includeAssignments && data.jobAssignments) {
      serialized.jobAssignments = data.jobAssignments.map((assignment) => ({
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
      firstName: this.decryptUserField(data.firstName),
      lastName: this.decryptUserField(data.lastName),
      email: this.decryptUserField(data.email),
      phone: this.decryptUserField(data.phone),
      businessName: data.businessName,
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

    return {
      id: data.id,
      firstName: data.firstName,
      lastName: data.lastName,
      status: data.status,
      canMessageClients: data.canMessageClients,
      paymentMethod: data.paymentMethod,
      user: data.user ? {
        id: data.user.id,
        firstName: this.decryptUserField(data.user.firstName),
        lastName: this.decryptUserField(data.user.lastName),
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
    const businessOwner = data.businessOwner
      ? this.serializeUser(data.businessOwner)
      : null;

    return {
      firstName: data.firstName,
      lastName: data.lastName,
      email: data.email,
      businessName: businessOwner?.businessName || "Business",
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
    const businessOwner = data.businessOwner
      ? this.serializeUser(data.businessOwner)
      : null;

    return {
      id: data.id,
      firstName: data.firstName,
      lastName: data.lastName,
      email: data.email,
      phone: data.phone,
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
          }
        : null,
    };
  }
}

module.exports = BusinessEmployeeSerializer;
