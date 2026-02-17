/**
 * ClientJobFlowAssignmentSerializer
 * Serializes ClientJobFlowAssignment models for API responses
 */

const EncryptionService = require("../services/EncryptionService");

class ClientJobFlowAssignmentSerializer {
  static decryptField(value) {
    if (!value) return null;
    return EncryptionService.decrypt(value);
  }

  /**
   * Serialize a single ClientJobFlowAssignment
   * @param {Object} assignment - ClientJobFlowAssignment instance or plain object
   * @param {Object} options - Serialization options
   * @param {boolean} options.includeFlow - Include flow details
   * @param {boolean} options.includeClient - Include client details
   * @param {boolean} options.includeHome - Include home details
   * @returns {Object} Serialized assignment
   */
  static serializeOne(assignment, options = {}) {
    if (!assignment) return null;

    const {
      includeFlow = true,
      includeClient = true,
      includeHome = true,
    } = options;

    const data = assignment.dataValues || assignment;

    const serialized = {
      id: data.id,
      businessOwnerId: data.businessOwnerId,
      cleanerClientId: data.cleanerClientId,
      homeId: data.homeId,
      customJobFlowId: data.customJobFlowId,
      isHomeAssignment: data.homeId != null,
      isClientAssignment: data.cleanerClientId != null && data.homeId == null,
      createdAt: data.createdAt,
      updatedAt: data.updatedAt,
    };

    // Include flow if present and requested
    if (includeFlow && data.flow) {
      const CustomJobFlowSerializer = require("./CustomJobFlowSerializer");
      serialized.flow = CustomJobFlowSerializer.serializeForSelect(data.flow);
    }

    // Include client if present and requested
    if (includeClient && data.cleanerClient) {
      serialized.cleanerClient = this.serializeCleanerClient(data.cleanerClient);
    }

    // Include home if present and requested
    if (includeHome && data.home) {
      serialized.home = this.serializeHome(data.home);
    }

    return serialized;
  }

  /**
   * Serialize an array of ClientJobFlowAssignments
   * @param {Array} assignments - Array of ClientJobFlowAssignment instances
   * @param {Object} options - Serialization options
   * @returns {Array} Serialized assignments
   */
  static serializeArray(assignments, options = {}) {
    if (!assignments || !Array.isArray(assignments)) return [];
    return assignments.map((assignment) => this.serializeOne(assignment, options));
  }

  /**
   * Serialize a CleanerClient
   * @param {Object} client - CleanerClient instance
   * @returns {Object} Serialized client
   */
  static serializeCleanerClient(client) {
    if (!client) return null;

    const data = client.dataValues || client;

    // CleanerClient has encrypted PII fields (invitedEmail, invitedPhone, invitedName)
    const serialized = {
      id: data.id,
      displayName: data.displayName,
      email: this.decryptField(data.email) || this.decryptField(data.invitedEmail),
      phone: this.decryptField(data.phone) || this.decryptField(data.invitedPhone),
    };

    // If client has a linked user, decrypt their fields
    if (data.user) {
      serialized.user = {
        id: data.user.id,
        firstName: this.decryptField(data.user.firstName),
        lastName: this.decryptField(data.user.lastName),
      };
    }

    return serialized;
  }

  /**
   * Serialize a Home
   * @param {Object} home - UserHomes instance
   * @returns {Object} Serialized home
   */
  static serializeHome(home) {
    if (!home) return null;

    const data = home.dataValues || home;

    return {
      id: data.id,
      address: this.decryptField(data.address),
      city: this.decryptField(data.city),
      state: this.decryptField(data.state),
      zipcode: this.decryptField(data.zipcode),
      numBeds: data.numBeds,
      numBaths: data.numBaths,
    };
  }

  /**
   * Serialize for list view
   * @param {Object} assignment - ClientJobFlowAssignment instance
   * @returns {Object} Serialized for list
   */
  static serializeForList(assignment) {
    if (!assignment) return null;

    const data = assignment.dataValues || assignment;

    const serialized = {
      id: data.id,
      customJobFlowId: data.customJobFlowId,
      isHomeAssignment: data.homeId != null,
      isClientAssignment: data.cleanerClientId != null && data.homeId == null,
    };

    // Add flow name if available
    if (data.flow) {
      serialized.flowName = data.flow.name;
    }

    // Add target name (decrypt PII fields)
    if (data.home) {
      serialized.targetType = "home";
      serialized.targetName = this.decryptField(data.home.address);
    } else if (data.cleanerClient) {
      serialized.targetType = "client";
      serialized.targetName = data.cleanerClient.displayName;
    }

    return serialized;
  }

  /**
   * Serialize array for list view
   * @param {Array} assignments - Array of ClientJobFlowAssignment instances
   * @returns {Array} Serialized for list
   */
  static serializeArrayForList(assignments) {
    if (!assignments || !Array.isArray(assignments)) return [];
    return assignments.map((a) => this.serializeForList(a));
  }
}

module.exports = ClientJobFlowAssignmentSerializer;
