/**
 * InvitationService - Handles client invitation business logic
 * Manages invitation token generation, validation, and acceptance
 */

const crypto = require("crypto");

class InvitationService {
  /**
   * Generate a unique invitation token
   * Format: 32 character hex string
   * @param {Object} models - Sequelize models object
   * @returns {string} Unique invitation token
   */
  static async generateInviteToken(models) {
    const { CleanerClient } = models;
    const maxAttempts = 10;
    let attempts = 0;

    while (attempts < maxAttempts) {
      // Generate a 32-character hex token
      const token = crypto.randomBytes(16).toString("hex");

      // Check if token already exists
      const existing = await CleanerClient.findOne({
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
   * Validate an invitation token and return the CleanerClient record
   * @param {string} token - Invitation token
   * @param {Object} models - Sequelize models object
   * @returns {Object|null} CleanerClient record or null if invalid
   */
  static async validateInviteToken(token, models) {
    const { CleanerClient, User } = models;

    if (!token || typeof token !== "string" || token.length !== 32) {
      return null;
    }

    const cleanerClient = await CleanerClient.findOne({
      where: { inviteToken: token },
      include: [
        {
          model: User,
          as: "cleaner",
          attributes: ["id", "firstName", "lastName", "email"],
        },
      ],
    });

    if (!cleanerClient) {
      return null;
    }

    // Check if invitation is still pending or cancelled (cancelled can still create account)
    if (cleanerClient.status !== "pending_invite" && cleanerClient.status !== "cancelled") {
      return {
        ...cleanerClient.toJSON(),
        isExpired: cleanerClient.status === "declined",
        isAlreadyAccepted: cleanerClient.status === "active" || cleanerClient.status === "inactive",
      };
    }

    // For cancelled invitations, add isCancelled flag but keep instance for update
    if (cleanerClient.status === "cancelled") {
      cleanerClient.isCancelled = true;
      return cleanerClient;
    }

    return cleanerClient;
  }

  /**
   * Create a new CleanerClient invitation
   * @param {Object} params - Invitation parameters
   * @param {number} params.cleanerId - ID of the cleaner sending the invite
   * @param {string} params.name - Client's name
   * @param {string} params.email - Client's email
   * @param {string} [params.phone] - Client's phone (optional)
   * @param {Object} [params.address] - Client's address object
   * @param {number} [params.beds] - Number of bedrooms
   * @param {number} [params.baths] - Number of bathrooms
   * @param {string} [params.frequency] - Default cleaning frequency
   * @param {number} [params.price] - Default price
   * @param {string} [params.notes] - Notes about the home
   * @param {Object} models - Sequelize models object
   * @returns {Object} Created CleanerClient record
   */
  static async createInvitation(params, models) {
    const { CleanerClient } = models;
    const {
      cleanerId,
      name,
      email,
      phone,
      address,
      beds,
      baths,
      frequency,
      price,
      dayOfWeek,
      timeWindow,
      notes,
    } = params;

    // Check if this cleaner already has a pending or active invitation for this email
    const existing = await CleanerClient.findOne({
      where: {
        cleanerId,
        invitedEmail: email.toLowerCase().trim(),
        status: ["pending_invite", "active"],
      },
    });

    if (existing) {
      if (existing.status === "active") {
        throw new Error("This client is already linked to your account");
      } else {
        throw new Error("An invitation has already been sent to this email");
      }
    }

    // Generate unique token
    const inviteToken = await this.generateInviteToken(models);

    // Create the CleanerClient record
    // Stringify address if it's an object (will be encrypted by model hooks)
    const addressValue = address && typeof address === "object"
      ? JSON.stringify(address)
      : address || null;

    const cleanerClient = await CleanerClient.create({
      cleanerId,
      inviteToken,
      invitedEmail: email.toLowerCase().trim(),
      invitedName: name.trim(),
      invitedPhone: phone ? phone.trim() : null,
      invitedAddress: addressValue,
      invitedBeds: beds || null,
      invitedBaths: baths || null,
      invitedNotes: notes || null,
      status: "pending_invite",
      invitedAt: new Date(),
      defaultFrequency: frequency || null,
      defaultPrice: price || null,
      defaultDayOfWeek: dayOfWeek != null ? dayOfWeek : null,
      defaultTimeWindow: timeWindow || null,
      autoPayEnabled: true,
      autoScheduleEnabled: true,
    });

    return cleanerClient;
  }

  /**
   * Accept an invitation and create user/home records
   * @param {string} token - Invitation token
   * @param {Object} params - Acceptance parameters
   * @param {string} params.password - User's password
   * @param {string} [params.phone] - User's phone (if not in invitation)
   * @param {Object} [params.addressCorrections] - Corrected address info
   * @param {Object} models - Sequelize models object
   * @param {Function} hashPassword - Function to hash password
   * @returns {Object} Created User record
   */
  static async acceptInvitation(token, params, models, hashPassword) {
    const { CleanerClient, User, UserHomes, UserBills } = models;
    const { password, phone, addressCorrections } = params;

    // Validate token
    const cleanerClient = await this.validateInviteToken(token, models);
    if (!cleanerClient) {
      throw new Error("Invalid or expired invitation");
    }

    if (cleanerClient.isAlreadyAccepted) {
      throw new Error("This invitation has already been accepted");
    }

    if (cleanerClient.isExpired) {
      throw new Error("This invitation has been declined");
    }

    // Check if a user with this email already exists
    const existingUser = await User.findOne({
      where: { email: cleanerClient.invitedEmail },
    });

    if (existingUser) {
      throw new Error("An account with this email already exists. Please log in instead.");
    }

    // Parse the name into first/last
    const nameParts = cleanerClient.invitedName.trim().split(" ");
    const firstName = nameParts[0];
    const lastName = nameParts.slice(1).join(" ") || firstName;

    // Hash the password
    const hashedPassword = await hashPassword(password);

    // Create the user
    const user = await User.create({
      firstName,
      lastName,
      email: cleanerClient.invitedEmail,
      phone: phone || cleanerClient.invitedPhone || null,
      password: hashedPassword,
      type: "homeowner",
      hasPaymentMethod: false,
    });

    // Create UserBills record
    await UserBills.create({
      usersId: user.id,
      appointmentDue: 0,
      cancellationDue: 0,
      totalDue: 0,
    });

    // Check if invitation was cancelled by the business owner
    const isCancelled = cleanerClient.isCancelled || cleanerClient.status === "cancelled";

    // Merge address from invitation with any corrections
    const address = {
      ...cleanerClient.invitedAddress,
      ...addressCorrections,
    };

    // Create the home if address info was provided
    let home = null;
    if (address && address.address) {
      home = await UserHomes.create({
        userId: user.id,
        nickName: address.nickName || "Home",
        address: address.address,
        city: address.city || "",
        state: address.state || "",
        zipcode: address.zipcode || "",
        numBeds: cleanerClient.invitedBeds || 1,
        numBaths: cleanerClient.invitedBaths || 1,
        contact: user.phone || user.email,
        timeToBeCompleted: cleanerClient.defaultTimeWindow || "anytime",
        // Only set preferred cleaner if invitation wasn't cancelled
        preferredCleanerId: isCancelled ? null : cleanerClient.cleanerId,
        specialNotes: cleanerClient.invitedNotes || null,
        // Mark as incomplete - client needs to finish setup (access info, linens)
        isSetupComplete: false,
      });
    }

    // Update the CleanerClient record
    // For cancelled invitations, don't link the client - they become a normal user
    if (isCancelled) {
      // Just mark as used but don't link - user becomes a regular homeowner
      await cleanerClient.update({
        acceptedAt: new Date(),
      });
    } else {
      // Normal flow - link the client to the cleaner
      await cleanerClient.update({
        clientId: user.id,
        homeId: home ? home.id : null,
        status: "active",
        acceptedAt: new Date(),
      });
    }

    return {
      user,
      home,
      cleanerClient,
    };
  }

  /**
   * Resend an invitation email
   * @param {number} cleanerClientId - ID of the CleanerClient record
   * @param {number} cleanerId - ID of the cleaner (for verification)
   * @param {Object} models - Sequelize models object
   * @returns {Object} Updated CleanerClient record
   */
  static async resendInvitation(cleanerClientId, cleanerId, models) {
    const { CleanerClient } = models;

    const cleanerClient = await CleanerClient.findOne({
      where: {
        id: cleanerClientId,
        cleanerId,
        status: "pending_invite",
      },
    });

    if (!cleanerClient) {
      throw new Error("Invitation not found or already accepted");
    }

    // Update last reminder timestamp
    await cleanerClient.update({
      lastInviteReminderAt: new Date(),
    });

    return cleanerClient;
  }

  /**
   * Get all clients for a cleaner
   * @param {number} cleanerId - ID of the cleaner
   * @param {string} [status] - Filter by status (optional)
   * @param {Object} models - Sequelize models object
   * @returns {Array} List of CleanerClient records
   */
  static async getCleanerClients(cleanerId, status, models) {
    const { CleanerClient, User, UserHomes } = models;

    const where = { cleanerId };
    if (status) {
      where.status = status;
    }

    const clients = await CleanerClient.findAll({
      where,
      include: [
        {
          model: User,
          as: "client",
          attributes: ["id", "firstName", "lastName", "email", "phone"],
          required: false,
        },
        {
          model: UserHomes,
          as: "home",
          required: false,
        },
      ],
      order: [
        ["status", "ASC"], // active first, then pending_invite, then inactive
        ["createdAt", "DESC"],
      ],
    });

    return clients;
  }

  /**
   * Decline an invitation
   * @param {string} token - Invitation token
   * @param {Object} models - Sequelize models object
   * @returns {boolean} Success status
   */
  static async declineInvitation(token, models) {
    const { CleanerClient } = models;

    const cleanerClient = await CleanerClient.findOne({
      where: {
        inviteToken: token,
        status: "pending_invite",
      },
    });

    if (!cleanerClient) {
      throw new Error("Invitation not found or already processed");
    }

    await cleanerClient.update({
      status: "declined",
    });

    return true;
  }
}

module.exports = InvitationService;
