/**
 * InvitationService - Handles client invitation business logic
 * Manages invitation token generation, validation, and acceptance
 */

const crypto = require("crypto");
const { Op } = require("sequelize");
const HomeClass = require("./HomeClass");
const EncryptionService = require("./EncryptionService");

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
      // Generate a 64-character hex token (256 bits for security)
      const token = crypto.randomBytes(32).toString("hex");

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

    // Validate token format: must be 32 or 64 lowercase hex characters
    if (!token || typeof token !== "string" || !/^[a-f0-9]{32}([a-f0-9]{32})?$/.test(token)) {
      return null;
    }

    const cleanerClient = await CleanerClient.findOne({
      where: { inviteToken: token },
      include: [
        {
          model: User,
          as: "cleaner",
          attributes: ["id", "firstName", "lastName", "email", "businessName", "businessLogo", "isBusinessOwner"],
        },
      ],
    });

    if (!cleanerClient) {
      return null;
    }

    // Check if invitation has expired
    if (cleanerClient.inviteExpiresAt && cleanerClient.inviteExpiresAt < new Date()) {
      return {
        ...cleanerClient.toJSON(),
        isExpired: true,
        expirationReason: "expired",
      };
    }

    // Check if invitation is still pending or cancelled (cancelled can still create account)
    if (cleanerClient.status !== "pending_invite" && cleanerClient.status !== "cancelled") {
      return {
        ...cleanerClient.toJSON(),
        isExpired: cleanerClient.status === "declined",
        isAlreadyAccepted: cleanerClient.status === "active" || cleanerClient.status === "inactive",
        // Include email for account recovery when already accepted
        email: cleanerClient.email,
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

    // Validate input lengths (defense in depth - also validated at route level)
    if (!name || !name.trim()) {
      throw new Error("Client name is required");
    }
    if (name.trim().length > 100) {
      throw new Error("Client name must not exceed 100 characters");
    }
    if (!email || !email.trim()) {
      throw new Error("Client email is required");
    }
    if (email.trim().length > 254) {
      throw new Error("Email address is too long");
    }
    if (phone && phone.trim().length > 20) {
      throw new Error("Phone number must not exceed 20 characters");
    }
    if (notes && notes.length > 2000) {
      throw new Error("Notes must not exceed 2000 characters");
    }

    // Check if this cleaner already has a pending or active invitation for this email
    // Use hash for lookup since invitedEmail is encrypted
    const emailHash = EncryptionService.hash(email.toLowerCase().trim());
    const existing = await CleanerClient.findOne({
      where: {
        cleanerId,
        invitedEmailHash: emailHash,
        status: { [Op.in]: ["pending_invite", "active"] },
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

    // Set invitation expiration to 7 days from now
    const inviteExpiresAt = new Date();
    inviteExpiresAt.setDate(inviteExpiresAt.getDate() + 7);

    const cleanerClient = await CleanerClient.create({
      cleanerId,
      inviteToken,
      invitedEmail: email.toLowerCase().trim(),
      invitedEmailHash: emailHash,
      invitedName: name.trim(),
      invitedPhone: phone ? phone.trim() : null,
      invitedAddress: addressValue,
      invitedBeds: beds || null,
      invitedBaths: baths || null,
      invitedNotes: notes || null,
      status: "pending_invite",
      invitedAt: new Date(),
      inviteExpiresAt,
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
   * @param {number} [params.termsId] - Terms and conditions ID
   * @param {number} [params.privacyPolicyId] - Privacy policy ID
   * @param {number} [params.paymentTermsId] - Payment terms ID
   * @param {Object} models - Sequelize models object
   * @param {Function} hashPassword - Function to hash password
   * @returns {Object} Created User record
   */
  static async acceptInvitation(token, params, models, hashPassword) {
    const { CleanerClient, User, UserHomes, UserBills, TermsAndConditions, UserTermsAcceptance } = models;
    const { password, phone, addressCorrections, termsId, privacyPolicyId, paymentTermsId, damageProtectionId } = params;

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
    // Use emailHash for lookup since email is encrypted in the database
    const invitedEmail = cleanerClient.invitedEmail;
    const emailHash = EncryptionService.hash(invitedEmail?.toLowerCase?.().trim() || invitedEmail);
    const existingUsers = await User.findAll({
      where: { emailHash },
    });

    if (existingUsers.length > 0) {
      throw new Error("An account with this email already exists. Please log in instead.");
    }

    // Validate address corrections if provided
    if (addressCorrections && typeof addressCorrections === "object") {
      // Validate address field lengths
      if (addressCorrections.address && addressCorrections.address.length > 500) {
        throw new Error("Address is too long (max 500 characters)");
      }
      if (addressCorrections.city && addressCorrections.city.length > 100) {
        throw new Error("City name is too long (max 100 characters)");
      }
      if (addressCorrections.state && addressCorrections.state.length > 50) {
        throw new Error("State name is too long (max 50 characters)");
      }
      // Validate zipcode format (US format: 5 digits or 5+4)
      if (addressCorrections.zipcode) {
        const zipRegex = /^\d{5}(-\d{4})?$/;
        if (!zipRegex.test(addressCorrections.zipcode)) {
          throw new Error("Invalid zipcode format (use 5 digits or 5+4 format)");
        }
      }
    }

    // Parse the name into first/last
    const nameParts = cleanerClient.invitedName.trim().split(" ");
    const firstName = nameParts[0];
    const lastName = nameParts.slice(1).join(" ") || firstName;

    // Hash the password
    const hashedPassword = await hashPassword(password);

    // Get terms versions if IDs provided
    let termsVersion = null;
    let termsRecord = null;
    if (termsId && TermsAndConditions) {
      termsRecord = await TermsAndConditions.findByPk(termsId);
      if (termsRecord) {
        termsVersion = termsRecord.version;
      }
    }

    let privacyVersion = null;
    let privacyRecord = null;
    if (privacyPolicyId && TermsAndConditions) {
      privacyRecord = await TermsAndConditions.findByPk(privacyPolicyId);
      if (privacyRecord) {
        privacyVersion = privacyRecord.version;
      }
    }

    let paymentTermsVersion = null;
    let paymentTermsRecord = null;
    if (paymentTermsId && TermsAndConditions) {
      paymentTermsRecord = await TermsAndConditions.findByPk(paymentTermsId);
      if (paymentTermsRecord) {
        paymentTermsVersion = paymentTermsRecord.version;
      }
    }

    let damageProtectionVersion = null;
    let damageProtectionRecord = null;
    if (damageProtectionId && TermsAndConditions) {
      damageProtectionRecord = await TermsAndConditions.findByPk(damageProtectionId);
      if (damageProtectionRecord) {
        damageProtectionVersion = damageProtectionRecord.version;
      }
    }

    // Create the user
    const user = await User.create({
      firstName,
      lastName,
      email: cleanerClient.invitedEmail,
      phone: phone || cleanerClient.invitedPhone || null,
      password: hashedPassword,
      type: "homeowner",
      hasPaymentMethod: false,
      termsAcceptedVersion: termsVersion,
      privacyPolicyAcceptedVersion: privacyVersion,
      paymentTermsAcceptedVersion: paymentTermsVersion,
      damageProtectionAcceptedVersion: damageProtectionVersion,
    });

    // Create UserBills record
    await UserBills.create({
      userId: user.id,
      appointmentDue: 0,
      cancellationDue: 0,
      totalDue: 0,
    });

    // Record terms acceptance if available
    if (UserTermsAcceptance) {
      if (termsId && termsRecord) {
        await UserTermsAcceptance.create({
          userId: user.id,
          termsId,
          acceptedAt: new Date(),
          termsContentSnapshot: termsRecord.contentType === "text" ? termsRecord.content : null,
        });
      }

      if (privacyPolicyId && privacyRecord) {
        await UserTermsAcceptance.create({
          userId: user.id,
          termsId: privacyPolicyId,
          acceptedAt: new Date(),
          termsContentSnapshot: privacyRecord.contentType === "text" ? privacyRecord.content : null,
        });
      }

      if (paymentTermsId && paymentTermsRecord) {
        await UserTermsAcceptance.create({
          userId: user.id,
          termsId: paymentTermsId,
          acceptedAt: new Date(),
          termsContentSnapshot: paymentTermsRecord.contentType === "text" ? paymentTermsRecord.content : null,
        });
      }

      if (damageProtectionId && damageProtectionRecord) {
        await UserTermsAcceptance.create({
          userId: user.id,
          termsId: damageProtectionId,
          acceptedAt: new Date(),
          termsContentSnapshot: damageProtectionRecord.contentType === "text" ? damageProtectionRecord.content : null,
        });
      }
    }

    // Check if invitation was cancelled by the business owner
    const isCancelled = cleanerClient.isCancelled || cleanerClient.status === "cancelled";

    // Parse invitedAddress safely - may be a string, object, or null
    let parsedInvitedAddress = {};
    if (cleanerClient.invitedAddress) {
      if (typeof cleanerClient.invitedAddress === "string") {
        try {
          parsedInvitedAddress = JSON.parse(cleanerClient.invitedAddress);
          // Ensure it's actually an object
          if (typeof parsedInvitedAddress !== "object" || parsedInvitedAddress === null) {
            parsedInvitedAddress = {};
          }
        } catch (e) {
          // If JSON parsing fails, treat as empty
          parsedInvitedAddress = {};
        }
      } else if (typeof cleanerClient.invitedAddress === "object") {
        parsedInvitedAddress = cleanerClient.invitedAddress;
      }
    }

    // Merge address from invitation with any corrections
    const address = {
      ...parsedInvitedAddress,
      ...addressCorrections,
    };

    // Create the home if address info was provided
    let home = null;
    if (address && address.address) {
      // Geocode the address to get coordinates for distance calculations
      const { latitude, longitude } = await HomeClass.geocodeAddress(
        address.address,
        address.city || "",
        address.state || "",
        address.zipcode || ""
      );

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
        latitude,
        longitude,
      });
    }

    // Update the CleanerClient record
    // For cancelled invitations, don't link the client - they become a normal user
    if (isCancelled) {
      // Just mark as used but don't link - user becomes a regular homeowner
      await cleanerClient.update({
        acceptedAt: new Date(),
        inviteToken: null, // Clear token after acceptance for security
      });
    } else {
      // Normal flow - link the client to the cleaner
      await cleanerClient.update({
        clientId: user.id,
        homeId: home ? home.id : null,
        status: "active",
        acceptedAt: new Date(),
        inviteToken: null, // Clear token after acceptance for security
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

    // Reset expiration to 7 days from now and update last reminder timestamp
    const inviteExpiresAt = new Date();
    inviteExpiresAt.setDate(inviteExpiresAt.getDate() + 7);

    await cleanerClient.update({
      lastInviteReminderAt: new Date(),
      inviteExpiresAt,
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
      inviteToken: null, // Clear token after decline for security
    });

    return true;
  }
}

module.exports = InvitationService;
