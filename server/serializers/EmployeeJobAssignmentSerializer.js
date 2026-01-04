const EncryptionService = require("../services/EncryptionService");

class EmployeeJobAssignmentSerializer {
  // Fields that are encrypted in the User model
  static encryptedUserFields = ["firstName", "lastName", "email", "phone"];

  static decryptUserField(value) {
    if (!value) return null;
    return EncryptionService.decrypt(value);
  }

  /**
   * Serialize a single EmployeeJobAssignment
   * @param {Object} assignment - EmployeeJobAssignment instance or plain object
   * @param {Object} options - Serialization options
   * @param {boolean} options.includeAppointment - Include appointment details
   * @param {boolean} options.includeEmployee - Include employee details
   * @param {boolean} options.includeClientDetails - Include client details (requires permission)
   * @param {boolean} options.includePayInfo - Include pay information (requires permission)
   * @returns {Object} Serialized assignment
   */
  static serializeOne(assignment, options = {}) {
    if (!assignment) return null;

    const {
      includeAppointment = true,
      includeEmployee = true,
      includeClientDetails = true,
      includePayInfo = true,
    } = options;

    const data = assignment.dataValues || assignment;

    const serialized = {
      id: data.id,
      businessEmployeeId: data.businessEmployeeId,
      appointmentId: data.appointmentId,
      businessOwnerId: data.businessOwnerId,
      status: data.status,
      isSelfAssignment: data.isSelfAssignment,
      assignedAt: data.assignedAt,
      startedAt: data.startedAt,
      completedAt: data.completedAt,
    };

    // Include pay info if allowed
    if (includePayInfo) {
      serialized.payAmount = data.payAmount;
      serialized.payType = data.payType;
      serialized.hoursWorked = data.hoursWorked;
      serialized.payoutStatus = data.payoutStatus;
      serialized.formattedPay = data.payAmount != null
        ? `$${(data.payAmount / 100).toFixed(2)}`
        : null;
    }

    // Serialize employee if present
    if (includeEmployee && data.employee) {
      serialized.employee = {
        id: data.employee.id,
        firstName: data.employee.firstName,
        lastName: data.employee.lastName,
        paymentMethod: data.employee.paymentMethod,
      };
    }

    // Serialize appointment if present
    if (includeAppointment && data.appointment) {
      serialized.appointment = this.serializeAppointment(
        data.appointment,
        includeClientDetails
      );
    }

    return serialized;
  }

  /**
   * Serialize an array of EmployeeJobAssignments
   * @param {Array} assignments - Array of EmployeeJobAssignment instances
   * @param {Object} options - Serialization options
   * @returns {Array} Serialized assignments
   */
  static serializeArray(assignments, options = {}) {
    if (!assignments || !Array.isArray(assignments)) return [];
    return assignments.map((assignment) => this.serializeOne(assignment, options));
  }

  /**
   * Serialize appointment with optional client details
   * @param {Object} appointment - UserAppointments instance
   * @param {boolean} includeClientDetails - Whether to include client details
   * @returns {Object} Serialized appointment
   */
  static serializeAppointment(appointment, includeClientDetails = true) {
    if (!appointment) return null;

    const data = appointment.dataValues || appointment;

    const serialized = {
      id: data.id,
      date: data.date,
      scheduledDate: data.scheduledDate,
      price: data.price,
      completed: data.completed,
    };

    // Include home details
    if (data.home) {
      serialized.home = this.serializeHome(data.home, includeClientDetails);
    }

    // Include client/user details if allowed
    if (includeClientDetails && data.user) {
      serialized.user = this.serializeUser(data.user);
    } else if (data.user) {
      // Minimal user info when client details not allowed
      serialized.user = {
        id: data.user.id,
        firstName: this.decryptUserField(data.user.firstName),
      };
    }

    return serialized;
  }

  /**
   * Serialize home with optional sensitive details
   * @param {Object} home - UserHomes instance
   * @param {boolean} includeDetails - Whether to include sensitive details
   * @returns {Object} Serialized home
   */
  static serializeHome(home, includeDetails = true) {
    if (!home) return null;

    const data = home.dataValues || home;

    const serialized = {
      id: data.id,
      numBeds: data.numBeds,
      numBaths: data.numBaths,
    };

    if (includeDetails) {
      serialized.address = data.address;
      serialized.keyPadCode = data.keyPadCode;
      serialized.keyLocation = data.keyLocation;
      serialized.notes = data.notes;
    }

    return serialized;
  }

  /**
   * Serialize user with decryption
   * @param {Object} user - User instance
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
    };
  }

  /**
   * Serialize for employee's job list view
   * @param {Object} assignment - EmployeeJobAssignment with appointment
   * @param {Object} employeeRecord - The employee's BusinessEmployee record (for permissions)
   * @returns {Object} Serialized job for employee view
   */
  static serializeForEmployee(assignment, employeeRecord) {
    if (!assignment) return null;

    const data = assignment.dataValues || assignment;

    const serialized = {
      id: data.id,
      status: data.status,
      assignedAt: data.assignedAt,
      startedAt: data.startedAt,
      completedAt: data.completedAt,
    };

    // Include pay info only if employee has permission
    if (employeeRecord?.canViewJobEarnings) {
      serialized.payAmount = data.payAmount;
      serialized.payType = data.payType;
      serialized.formattedPay = data.payAmount != null
        ? `$${(data.payAmount / 100).toFixed(2)}`
        : null;
    }

    // Serialize appointment with permission-based details
    if (data.appointment) {
      serialized.appointment = this.serializeAppointment(
        data.appointment,
        employeeRecord?.canViewClientDetails ?? false
      );
    }

    return serialized;
  }

  /**
   * Serialize for employee's job list (array)
   * @param {Array} assignments - Array of assignments
   * @param {Object} employeeRecord - The employee's BusinessEmployee record
   * @returns {Array} Serialized jobs
   */
  static serializeArrayForEmployee(assignments, employeeRecord) {
    if (!assignments || !Array.isArray(assignments)) return [];
    return assignments.map((a) => this.serializeForEmployee(a, employeeRecord));
  }

  /**
   * Serialize pay change history
   * @param {Object} historyEntry - EmployeePayChangeLog instance
   * @returns {Object} Serialized history entry
   */
  static serializePayHistory(historyEntry) {
    if (!historyEntry) return null;

    const data = historyEntry.dataValues || historyEntry;

    const serialized = {
      id: data.id,
      previousPayAmount: data.previousPayAmount,
      newPayAmount: data.newPayAmount,
      reason: data.reason,
      changedAt: data.changedAt,
      formattedPreviousPay: `$${(data.previousPayAmount / 100).toFixed(2)}`,
      formattedNewPay: `$${(data.newPayAmount / 100).toFixed(2)}`,
    };

    // Include who made the change
    if (data.changedByUser) {
      serialized.changedBy = {
        id: data.changedByUser.id,
        firstName: this.decryptUserField(data.changedByUser.firstName),
        lastName: this.decryptUserField(data.changedByUser.lastName),
      };
    }

    return serialized;
  }

  /**
   * Serialize pay history array
   * @param {Array} history - Array of pay change logs
   * @returns {Array} Serialized history
   */
  static serializePayHistoryArray(history) {
    if (!history || !Array.isArray(history)) return [];
    return history.map((h) => this.serializePayHistory(h));
  }

  /**
   * Serialize for pending payouts view
   * @param {Object} assignment - EmployeeJobAssignment with employee and appointment
   * @returns {Object} Serialized payout item
   */
  static serializeForPayout(assignment) {
    if (!assignment) return null;

    const data = assignment.dataValues || assignment;

    return {
      id: data.id,
      appointmentId: data.appointmentId,
      payAmount: data.payAmount,
      formattedPay: `$${(data.payAmount / 100).toFixed(2)}`,
      payType: data.payType,
      completedAt: data.completedAt,
      payoutStatus: data.payoutStatus,
      employee: data.employee ? {
        id: data.employee.id,
        firstName: data.employee.firstName,
        lastName: data.employee.lastName,
        paymentMethod: data.employee.paymentMethod,
      } : null,
      appointment: data.appointment ? {
        id: data.appointment.id,
        date: data.appointment.date,
        price: data.appointment.price,
        home: data.appointment.home ? {
          id: data.appointment.home.id,
          address: data.appointment.home.address,
        } : null,
      } : null,
    };
  }

  /**
   * Serialize array for pending payouts
   * @param {Array} assignments - Array of unpaid assignments
   * @returns {Array} Serialized payout items
   */
  static serializeForPayoutArray(assignments) {
    if (!assignments || !Array.isArray(assignments)) return [];
    return assignments.map((a) => this.serializeForPayout(a));
  }
}

module.exports = EmployeeJobAssignmentSerializer;
