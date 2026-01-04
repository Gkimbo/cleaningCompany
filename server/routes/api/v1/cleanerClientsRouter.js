/**
 * Cleaner Clients Router
 * API endpoints for managing cleaner-client relationships and invitations
 */

const express = require("express");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");
const models = require("../../../models");
const {
  User,
  CleanerClient,
  UserHomes,
  RecurringSchedule,
  UserAppointments,
  UserCleanerAppointments,
  UserBills,
  Payout,
} = models;
const InvitationService = require("../../../services/InvitationService");
const calculatePrice = require("../../../services/CalculatePrice");
const IncentiveService = require("../../../services/IncentiveService");
const Email = require("../../../services/sendNotifications/EmailClass");
const PushNotification = require("../../../services/sendNotifications/PushNotificationClass");
const EncryptionService = require("../../../services/EncryptionService");
const NotificationService = require("../../../services/NotificationService");

const cleanerClientsRouter = express.Router();
const secretKey = process.env.SESSION_SECRET;
const saltRounds = 10;

// Hash password helper
const hashPassword = async (password) => {
  return bcrypt.hash(password, saltRounds);
};

// Middleware to verify cleaner access
const verifyCleaner = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    const token = authHeader.split(" ")[1];
    const decoded = jwt.verify(token, secretKey);
    const user = await User.findByPk(decoded.userId);

    if (!user || user.type !== "cleaner") {
      return res.status(403).json({ error: "Cleaner access required" });
    }

    req.user = user;
    next();
  } catch (err) {
    return res.status(401).json({ error: "Invalid token" });
  }
};

// =====================
// CLEANER ENDPOINTS
// =====================

/**
 * POST /invite
 * Invite a new client
 * Requires cleaner authentication
 */
cleanerClientsRouter.post("/invite", verifyCleaner, async (req, res) => {
  try {
    const {
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
    } = req.body;

    // Validate required fields
    if (!name || !name.trim()) {
      return res.status(400).json({ error: "Client name is required" });
    }
    if (!email || !email.trim()) {
      return res.status(400).json({ error: "Client email is required" });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ error: "Invalid email format" });
    }

    // Create the invitation
    const cleanerClient = await InvitationService.createInvitation(
      {
        cleanerId: req.user.id,
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
      },
      models
    );

    // Send invitation email (non-blocking - don't fail if email fails)
    // Use original values from request since cleanerClient fields are now encrypted
    const cleanerName = `${EncryptionService.decrypt(req.user.firstName)} ${EncryptionService.decrypt(req.user.lastName)}`;
    const clientEmail = email.trim().toLowerCase();
    const clientName = name.trim();
    const addressStr = address
      ? `${address.address}, ${address.city}, ${address.state} ${address.zipcode}`
      : null;

    try {
      await Email.sendClientInvitation(
        clientEmail,
        clientName,
        cleanerName,
        cleanerClient.inviteToken,
        addressStr
      );
    } catch (emailErr) {
      console.error("Error sending invitation email (non-fatal):", emailErr);
      // Don't fail the request if email fails
    }

    res.status(201).json({
      success: true,
      message: "Invitation sent successfully",
      cleanerClient: {
        id: cleanerClient.id,
        inviteToken: cleanerClient.inviteToken,
        invitedName: clientName,
        invitedEmail: clientEmail,
        status: cleanerClient.status,
        invitedAt: cleanerClient.invitedAt,
      },
    });
  } catch (err) {
    console.error("Error creating invitation:", err);
    res.status(400).json({ error: err.message });
  }
});

/**
 * GET /
 * Get all clients for the authenticated cleaner
 * Requires cleaner authentication
 */
cleanerClientsRouter.get("/", verifyCleaner, async (req, res) => {
  try {
    const { status } = req.query;

    const clients = await InvitationService.getCleanerClients(
      req.user.id,
      status,
      models
    );

    res.json({
      clients: clients.map((c) => ({
        id: c.id,
        status: c.status,
        invitedName: c.invitedName,
        invitedEmail: c.invitedEmail,
        invitedPhone: c.invitedPhone,
        invitedBeds: c.invitedBeds,
        invitedBaths: c.invitedBaths,
        invitedAddress: c.invitedAddress,
        invitedAt: c.invitedAt,
        acceptedAt: c.acceptedAt,
        defaultFrequency: c.defaultFrequency,
        defaultPrice: c.defaultPrice,
        autoPayEnabled: c.autoPayEnabled,
        client: c.client
          ? {
              id: c.client.id,
              firstName: EncryptionService.decrypt(c.client.firstName),
              lastName: EncryptionService.decrypt(c.client.lastName),
              email: EncryptionService.decrypt(c.client.email),
              phone: c.client.phone ? EncryptionService.decrypt(c.client.phone) : null,
            }
          : null,
        home: c.home
          ? {
              id: c.home.id,
              nickName: c.home.nickName,
              address: EncryptionService.decrypt(c.home.address),
              city: EncryptionService.decrypt(c.home.city),
              state: EncryptionService.decrypt(c.home.state),
              numBeds: c.home.numBeds,
              numBaths: c.home.numBaths,
            }
          : null,
      })),
    });
  } catch (err) {
    console.error("Error fetching clients:", err);
    res.status(500).json({ error: "Failed to fetch clients" });
  }
});

// =====================
// PUBLIC ENDPOINTS (for invitation acceptance)
// MUST be defined before /:id routes to avoid matching "invitations" as an ID
// =====================

/**
 * GET /invitations/:token
 * Validate an invitation token and return pre-filled data
 * Public endpoint
 */
cleanerClientsRouter.get("/invitations/:token", async (req, res) => {
  try {
    const { token } = req.params;

    const cleanerClient = await InvitationService.validateInviteToken(token, models);

    if (!cleanerClient) {
      return res.status(404).json({
        valid: false,
        error: "Invalid invitation link",
      });
    }

    if (cleanerClient.isAlreadyAccepted) {
      return res.status(400).json({
        valid: false,
        error: "This invitation has already been accepted. Please log in.",
      });
    }

    if (cleanerClient.isExpired) {
      return res.status(400).json({
        valid: false,
        error: "This invitation has been declined.",
      });
    }

    // Check if invitation was cancelled
    const isCancelled = cleanerClient.isCancelled || false;

    res.json({
      valid: true,
      isCancelled,
      invitation: {
        // Don't show cleaner name if invitation was cancelled
        cleanerName: isCancelled
          ? null
          : cleanerClient.cleaner
            ? `${EncryptionService.decrypt(cleanerClient.cleaner.firstName)} ${EncryptionService.decrypt(cleanerClient.cleaner.lastName)}`
            : "Your Cleaner",
        name: cleanerClient.invitedName,
        email: cleanerClient.invitedEmail,
        phone: cleanerClient.invitedPhone,
        address: cleanerClient.invitedAddress,
        beds: cleanerClient.invitedBeds,
        baths: cleanerClient.invitedBaths,
      },
    });
  } catch (err) {
    console.error("Error validating invitation:", err);
    res.status(500).json({ error: "Failed to validate invitation" });
  }
});

/**
 * POST /invitations/:token/accept
 * Accept an invitation and create user account
 * Public endpoint
 */
cleanerClientsRouter.post("/invitations/:token/accept", async (req, res) => {
  try {
    const { token } = req.params;
    const { password, phone, addressCorrections } = req.body;

    // Validate required fields
    if (!password || password.length < 8) {
      return res.status(400).json({
        error: "Password must be at least 8 characters",
      });
    }

    const result = await InvitationService.acceptInvitation(
      token,
      { password, phone, addressCorrections },
      models,
      hashPassword
    );

    // Generate JWT token for the new user
    const jwtToken = jwt.sign(
      { userId: result.user.id },
      secretKey,
      { expiresIn: "30d" }
    );

    // Notify the cleaner that their client accepted (non-blocking)
    try {
      const cleaner = await User.findByPk(result.cleanerClient.cleanerId);
      if (cleaner) {
        const clientName = `${EncryptionService.decrypt(result.user.firstName)} ${EncryptionService.decrypt(result.user.lastName)}`;
        const cleanerName = `${EncryptionService.decrypt(cleaner.firstName)} ${EncryptionService.decrypt(cleaner.lastName)}`;
        const homeAddress = result.home
          ? `${EncryptionService.decrypt(result.home.address)}, ${EncryptionService.decrypt(result.home.city)}`
          : "Address pending";

        // Send email notification
        await Email.sendInvitationAccepted(
          EncryptionService.decrypt(cleaner.email),
          cleanerName,
          clientName,
          homeAddress
        );

        // Send push notification
        if (cleaner.expoPushToken) {
          await PushNotification.sendPushInvitationAccepted(
            cleaner.expoPushToken,
            cleanerName,
            clientName
          );
        }
      }
    } catch (notifyErr) {
      console.error("Error notifying cleaner (non-fatal):", notifyErr);
    }

    res.status(201).json({
      success: true,
      message: "Account created successfully",
      user: {
        id: result.user.id,
        firstName: EncryptionService.decrypt(result.user.firstName),
        lastName: EncryptionService.decrypt(result.user.lastName),
        email: EncryptionService.decrypt(result.user.email),
        type: result.user.type,
      },
      token: jwtToken,
      home: result.home
        ? {
            id: result.home.id,
            nickName: result.home.nickName,
            address: EncryptionService.decrypt(result.home.address),
          }
        : null,
    });
  } catch (err) {
    console.error("Error accepting invitation:", err);
    res.status(400).json({ error: err.message });
  }
});

/**
 * POST /invitations/:token/decline
 * Decline an invitation
 * Public endpoint
 */
cleanerClientsRouter.post("/invitations/:token/decline", async (req, res) => {
  try {
    const { token } = req.params;

    await InvitationService.declineInvitation(token, models);

    res.json({
      success: true,
      message: "Invitation declined",
    });
  } catch (err) {
    console.error("Error declining invitation:", err);
    res.status(400).json({ error: err.message });
  }
});

// =====================
// CLIENT ENDPOINTS (for homeowners to see their cleaner)
// MUST be defined before /:id routes to avoid matching "my-cleaner" as an ID
// =====================

// Middleware to verify homeowner access
const verifyHomeowner = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    const token = authHeader.split(" ")[1];
    const decoded = jwt.verify(token, secretKey);
    const user = await User.findByPk(decoded.userId);

    if (!user || user.type !== "homeowner") {
      return res.status(403).json({ error: "Homeowner access required" });
    }

    req.user = user;
    next();
  } catch (err) {
    return res.status(401).json({ error: "Invalid token" });
  }
};

/**
 * GET /my-cleaner
 * Get the client's preferred cleaner (if they were invited by one)
 * For homeowners to see their assigned cleaner on dashboard
 */
cleanerClientsRouter.get("/my-cleaner", verifyHomeowner, async (req, res) => {
  try {
    // Find active cleaner-client relationship for this user
    const relationship = await CleanerClient.findOne({
      where: {
        clientId: req.user.id,
        status: "active",
      },
      include: [
        {
          model: User,
          as: "cleaner",
          attributes: ["id", "firstName", "lastName", "email", "phoneNumber", "profilePhoto"],
        },
      ],
    });

    if (!relationship) {
      return res.json({ cleaner: null });
    }

    // Get cleaner's average rating
    const { Review } = models;
    const reviews = await Review.findAll({
      where: { cleanerId: relationship.cleanerId },
    });

    const avgRating = reviews.length > 0
      ? (reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length).toFixed(1)
      : null;

    res.json({
      cleaner: {
        id: relationship.cleaner.id,
        firstName: EncryptionService.decrypt(relationship.cleaner.firstName),
        lastName: EncryptionService.decrypt(relationship.cleaner.lastName),
        profilePhoto: relationship.cleaner.profilePhoto,
        averageRating: avgRating,
        totalReviews: reviews.length,
      },
      relationship: {
        id: relationship.id,
        autoPayEnabled: relationship.autoPayEnabled,
        autoScheduleEnabled: relationship.autoScheduleEnabled,
        defaultFrequency: relationship.defaultFrequency,
        defaultPrice: relationship.defaultPrice,
        since: relationship.acceptedAt,
      },
    });
  } catch (err) {
    console.error("Error fetching my cleaner:", err);
    res.status(500).json({ error: "Failed to fetch cleaner information" });
  }
});

/**
 * GET /pending-client-responses
 * Get appointments booked by this cleaner that are awaiting client response
 * Returns pending, expired, and declined bookings
 * MUST be defined before /:id routes
 */
cleanerClientsRouter.get("/pending-client-responses", verifyCleaner, async (req, res) => {
  try {
    const cleanerId = req.user.id;
    const { Op } = require("sequelize");
    const today = new Date().toISOString().split("T")[0];

    // Get appointments booked by this cleaner that need client response
    const appointments = await UserAppointments.findAll({
      where: {
        bookedByCleanerId: cleanerId,
        date: { [Op.gte]: today },
        // Include pending, declined, and expired (but not accepted)
        [Op.or]: [
          { clientResponse: null }, // Pending response
          { clientResponse: "declined" },
          { clientResponse: "expired" },
        ],
      },
      include: [
        {
          model: UserHomes,
          as: "home",
          attributes: ["id", "nickName", "address", "city", "numBeds", "numBaths"],
        },
        {
          model: User,
          as: "user",
          attributes: ["id", "firstName", "lastName", "email"],
        },
      ],
      order: [
        ["expiresAt", "ASC"],
        ["date", "ASC"],
      ],
    });

    // Group by status
    const pending = [];
    const declined = [];
    const expired = [];

    for (const apt of appointments) {
      const now = new Date();
      const isExpired = apt.expiresAt && new Date(apt.expiresAt) < now;

      const aptData = {
        id: apt.id,
        date: apt.date,
        price: apt.price,
        timeWindow: apt.timeToBeCompleted,
        expiresAt: apt.expiresAt,
        clientResponse: apt.clientResponse,
        declineReason: apt.declineReason,
        clientSuggestedDates: apt.suggestedDates,
        rebookingAttempts: apt.rebookingAttempts || 0,
        client: {
          id: apt.user?.id,
          name: apt.user ? `${EncryptionService.decrypt(apt.user.firstName)} ${EncryptionService.decrypt(apt.user.lastName)}` : "Unknown",
          email: apt.user?.email ? EncryptionService.decrypt(apt.user.email) : null,
        },
        home: {
          id: apt.home?.id,
          nickName: apt.home?.nickName,
          address: apt.home ? `${EncryptionService.decryptHomeField(apt.home.address)}, ${EncryptionService.decryptHomeField(apt.home.city)}` : "",
          beds: apt.home?.numBeds,
          baths: apt.home?.numBaths,
        },
      };

      if (apt.clientResponse === "declined") {
        declined.push(aptData);
      } else if (isExpired || apt.clientResponse === "expired") {
        expired.push({ ...aptData, clientResponse: "expired" });
      } else {
        pending.push(aptData);
      }
    }

    res.json({
      pending,
      declined,
      expired,
      total: pending.length + declined.length + expired.length,
    });
  } catch (err) {
    console.error("Error fetching pending client responses:", err);
    res.status(500).json({ error: "Failed to fetch pending client responses" });
  }
});

// =====================
// PARAMETERIZED ID ROUTES
// These must come AFTER all specific string routes like /invitations, /my-cleaner, /pending-client-responses
// =====================

/**
 * GET /:id
 * Get a specific client relationship
 * Requires cleaner authentication
 */
cleanerClientsRouter.get("/:id", verifyCleaner, async (req, res) => {
  try {
    const { id } = req.params;

    const cleanerClient = await CleanerClient.findOne({
      where: {
        id,
        cleanerId: req.user.id,
      },
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
        {
          model: RecurringSchedule,
          as: "recurringSchedules",
          where: { isActive: true },
          required: false,
        },
      ],
    });

    if (!cleanerClient) {
      return res.status(404).json({ error: "Client not found" });
    }

    res.json({ cleanerClient });
  } catch (err) {
    console.error("Error fetching client:", err);
    res.status(500).json({ error: "Failed to fetch client" });
  }
});

/**
 * GET /:id/full
 * Get full client details with home info and appointments
 * Returns all appointments grouped by: history, today, upcoming
 * Requires cleaner authentication
 */
cleanerClientsRouter.get("/:id/full", verifyCleaner, async (req, res) => {
  try {
    const { id } = req.params;
    const today = new Date().toISOString().split("T")[0];

    const cleanerClient = await CleanerClient.findOne({
      where: {
        id,
        cleanerId: req.user.id,
      },
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
        {
          model: RecurringSchedule,
          as: "recurringSchedules",
          required: false,
        },
      ],
    });

    if (!cleanerClient) {
      return res.status(404).json({ error: "Client not found" });
    }

    // Decrypt client fields if present
    let clientData = null;
    if (cleanerClient.client) {
      clientData = {
        id: cleanerClient.client.id,
        firstName: EncryptionService.decrypt(cleanerClient.client.firstName),
        lastName: EncryptionService.decrypt(cleanerClient.client.lastName),
        email: EncryptionService.decrypt(cleanerClient.client.email),
        phone: cleanerClient.client.phone ? EncryptionService.decrypt(cleanerClient.client.phone) : null,
      };
    }

    // Decrypt home fields if present
    let homeData = null;
    if (cleanerClient.home) {
      homeData = {
        id: cleanerClient.home.id,
        nickName: cleanerClient.home.nickName,
        address: EncryptionService.decrypt(cleanerClient.home.address),
        city: EncryptionService.decrypt(cleanerClient.home.city),
        state: EncryptionService.decrypt(cleanerClient.home.state),
        zipcode: EncryptionService.decrypt(cleanerClient.home.zipcode),
        numBeds: cleanerClient.home.numBeds,
        numBaths: cleanerClient.home.numBaths,
        keyPadCode: cleanerClient.home.keyPadCode ? EncryptionService.decrypt(cleanerClient.home.keyPadCode) : null,
        keyLocation: cleanerClient.home.keyLocation ? EncryptionService.decrypt(cleanerClient.home.keyLocation) : null,
        sheetsProvided: cleanerClient.home.sheetsProvided,
        towelsProvided: cleanerClient.home.towelsProvided,
        timeToBeCompleted: cleanerClient.home.timeToBeCompleted,
        cleanersNeeded: cleanerClient.home.cleanersNeeded,
        specialNotes: cleanerClient.home.specialNotes,
        contact: cleanerClient.home.contact ? EncryptionService.decrypt(cleanerClient.home.contact) : null,
      };
    }

    // Fetch appointments if home exists
    let appointments = { history: [], today: [], upcoming: [] };
    if (cleanerClient.homeId) {
      const allAppointments = await UserAppointments.findAll({
        where: { homeId: cleanerClient.homeId },
        order: [["date", "DESC"]],
      });

      // Group appointments
      allAppointments.forEach((apt) => {
        const aptData = {
          id: apt.id,
          date: apt.date,
          price: apt.price,
          completed: apt.completed,
          paid: apt.paid,
          paymentStatus: apt.paymentStatus,
          timeToBeCompleted: apt.timeToBeCompleted,
          bringSheets: apt.bringSheets,
          bringTowels: apt.bringTowels,
          hasBeenAssigned: apt.hasBeenAssigned,
          employeesAssigned: apt.employeesAssigned,
        };

        if (apt.date < today) {
          appointments.history.push(aptData);
        } else if (apt.date === today) {
          appointments.today.push(aptData);
        } else {
          appointments.upcoming.push(aptData);
        }
      });

      // Sort upcoming in ascending order (soonest first)
      appointments.upcoming.reverse();
    }

    res.json({
      cleanerClient: {
        id: cleanerClient.id,
        status: cleanerClient.status,
        invitedName: cleanerClient.invitedName,
        invitedEmail: cleanerClient.invitedEmail,
        invitedPhone: cleanerClient.invitedPhone,
        invitedAddress: cleanerClient.invitedAddress,
        invitedBeds: cleanerClient.invitedBeds,
        invitedBaths: cleanerClient.invitedBaths,
        invitedNotes: cleanerClient.invitedNotes,
        invitedAt: cleanerClient.invitedAt,
        acceptedAt: cleanerClient.acceptedAt,
        defaultFrequency: cleanerClient.defaultFrequency,
        defaultPrice: cleanerClient.defaultPrice,
        defaultDayOfWeek: cleanerClient.defaultDayOfWeek,
        defaultTimeWindow: cleanerClient.defaultTimeWindow,
        autoPayEnabled: cleanerClient.autoPayEnabled,
        autoScheduleEnabled: cleanerClient.autoScheduleEnabled,
        clientId: cleanerClient.clientId,
        homeId: cleanerClient.homeId,
      },
      client: clientData,
      home: homeData,
      appointments,
      recurringSchedules: cleanerClient.recurringSchedules || [],
    });
  } catch (err) {
    console.error("Error fetching full client details:", err);
    res.status(500).json({ error: "Failed to fetch client details" });
  }
});

/**
 * PATCH /:id/home
 * Update home details for a client
 * Requires cleaner authentication
 */
cleanerClientsRouter.patch("/:id/home", verifyCleaner, async (req, res) => {
  try {
    const { id } = req.params;
    const {
      specialNotes,
      keyPadCode,
      keyLocation,
      sheetsProvided,
      towelsProvided,
      timeToBeCompleted,
      cleanersNeeded,
    } = req.body;

    // Verify the cleaner owns this client relationship
    const cleanerClient = await CleanerClient.findOne({
      where: {
        id,
        cleanerId: req.user.id,
      },
    });

    if (!cleanerClient) {
      return res.status(404).json({ error: "Client not found" });
    }

    // For pending invitations, update the invited notes
    if (cleanerClient.status === "pending_invite") {
      if (specialNotes !== undefined) {
        await cleanerClient.update({ invitedNotes: specialNotes });
      }
      return res.json({
        success: true,
        message: "Invitation notes updated",
      });
    }

    // For active clients, update the home
    if (!cleanerClient.homeId) {
      return res.status(400).json({ error: "No home associated with this client" });
    }

    const home = await UserHomes.findByPk(cleanerClient.homeId);
    if (!home) {
      return res.status(404).json({ error: "Home not found" });
    }

    // Build update object
    const updates = {};
    if (specialNotes !== undefined) updates.specialNotes = specialNotes;
    if (keyPadCode !== undefined) updates.keyPadCode = keyPadCode;
    if (keyLocation !== undefined) updates.keyLocation = keyLocation;
    if (sheetsProvided !== undefined) updates.sheetsProvided = sheetsProvided;
    if (towelsProvided !== undefined) updates.towelsProvided = towelsProvided;
    if (timeToBeCompleted !== undefined) updates.timeToBeCompleted = timeToBeCompleted;
    if (cleanersNeeded !== undefined) updates.cleanersNeeded = cleanersNeeded;

    await home.update(updates);

    res.json({
      success: true,
      message: "Home updated successfully",
    });
  } catch (err) {
    console.error("Error updating home:", err);
    res.status(500).json({ error: "Failed to update home" });
  }
});

/**
 * PATCH /:id
 * Update a client relationship (settings, pricing, etc.)
 * Requires cleaner authentication
 */
cleanerClientsRouter.patch("/:id", verifyCleaner, async (req, res) => {
  try {
    const { id } = req.params;
    const {
      defaultFrequency,
      defaultPrice,
      defaultDayOfWeek,
      defaultTimeWindow,
      autoPayEnabled,
      autoScheduleEnabled,
      invitedNotes,
    } = req.body;

    const cleanerClient = await CleanerClient.findOne({
      where: {
        id,
        cleanerId: req.user.id,
      },
    });

    if (!cleanerClient) {
      return res.status(404).json({ error: "Client not found" });
    }

    // Build update object
    const updates = {};
    if (defaultFrequency !== undefined) updates.defaultFrequency = defaultFrequency;
    if (defaultPrice !== undefined) updates.defaultPrice = defaultPrice;
    if (defaultDayOfWeek !== undefined) updates.defaultDayOfWeek = defaultDayOfWeek;
    if (defaultTimeWindow !== undefined) updates.defaultTimeWindow = defaultTimeWindow;
    if (autoPayEnabled !== undefined) updates.autoPayEnabled = autoPayEnabled;
    if (autoScheduleEnabled !== undefined) updates.autoScheduleEnabled = autoScheduleEnabled;
    if (invitedNotes !== undefined) updates.invitedNotes = invitedNotes;

    await cleanerClient.update(updates);

    res.json({
      success: true,
      message: "Client updated successfully",
      cleanerClient,
    });
  } catch (err) {
    console.error("Error updating client:", err);
    res.status(500).json({ error: "Failed to update client" });
  }
});

/**
 * DELETE /:id
 * Cancel a pending invitation or deactivate an active client relationship
 * For pending invitations: Sets status to 'cancelled' - client can still create account but won't be linked
 * For active clients: Sets status to 'inactive' and deactivates recurring schedules
 * Requires cleaner authentication
 */
cleanerClientsRouter.delete("/:id", verifyCleaner, async (req, res) => {
  try {
    const { id } = req.params;

    const cleanerClient = await CleanerClient.findOne({
      where: {
        id,
        cleanerId: req.user.id,
      },
    });

    if (!cleanerClient) {
      return res.status(404).json({ error: "Client not found" });
    }

    // Handle pending invitations differently from active clients
    if (cleanerClient.status === "pending_invite") {
      // Cancel the invitation - client can still use the link to create a normal account
      await cleanerClient.update({ status: "cancelled" });

      res.json({
        success: true,
        message: "Invitation cancelled",
      });
    } else {
      // Deactivate active client relationship
      await cleanerClient.update({ status: "inactive" });

      // Also deactivate any recurring schedules
      await RecurringSchedule.update(
        { isActive: false },
        { where: { cleanerClientId: id } }
      );

      res.json({
        success: true,
        message: "Client relationship deactivated",
      });
    }
  } catch (err) {
    console.error("Error deleting client:", err);
    res.status(500).json({ error: "Failed to delete client" });
  }
});

/**
 * POST /:id/resend-invite
 * Resend an invitation email
 * Requires cleaner authentication
 */
cleanerClientsRouter.post("/:id/resend-invite", verifyCleaner, async (req, res) => {
  try {
    const { id } = req.params;

    const cleanerClient = await InvitationService.resendInvitation(
      id,
      req.user.id,
      models
    );

    // Send invitation reminder email (non-blocking)
    // Decrypt fields in case they're still encrypted after update
    const cleanerName = `${EncryptionService.decrypt(req.user.firstName)} ${EncryptionService.decrypt(req.user.lastName)}`;
    const clientEmail = EncryptionService.decrypt(cleanerClient.invitedEmail) || cleanerClient.invitedEmail;
    const clientName = EncryptionService.decrypt(cleanerClient.invitedName) || cleanerClient.invitedName;

    try {
      await Email.sendInvitationReminder(
        clientEmail,
        clientName,
        cleanerName,
        cleanerClient.inviteToken
      );
    } catch (emailErr) {
      console.error("Error sending invitation reminder (non-fatal):", emailErr);
    }

    res.json({
      success: true,
      message: "Invitation resent successfully",
    });
  } catch (err) {
    console.error("Error resending invitation:", err);
    res.status(400).json({ error: err.message });
  }
});

/**
 * POST /:id/book
 * Book an appointment for a linked client (cleaner-initiated booking)
 * Requires cleaner authentication and active client relationship
 */
cleanerClientsRouter.post("/:id/book", verifyCleaner, async (req, res) => {
  try {
    const { id } = req.params;
    const { date, price, notes, timeWindow } = req.body;

    // Validate date
    if (!date) {
      return res.status(400).json({ error: "Date is required" });
    }

    // Verify the cleaner-client relationship
    const cleanerClient = await CleanerClient.findOne({
      where: {
        id,
        cleanerId: req.user.id,
        status: "active",
      },
      include: [
        {
          model: User,
          as: "client",
          attributes: ["id", "firstName", "lastName", "email", "phone", "paymentMethod"],
        },
        {
          model: UserHomes,
          as: "home",
        },
      ],
    });

    if (!cleanerClient) {
      return res.status(404).json({
        error: "Active client relationship not found",
      });
    }

    if (!cleanerClient.client || !cleanerClient.home) {
      return res.status(400).json({
        error: "Client must have an account and home set up before booking",
      });
    }

    const client = cleanerClient.client;
    const home = cleanerClient.home;

    // Check if client has payment method
    if (!client.paymentMethod) {
      return res.status(400).json({
        error: "Client does not have a payment method set up",
      });
    }

    // Check for existing appointment on the same date
    const existingAppointment = await UserAppointments.findOne({
      where: {
        homeId: home.id,
        date: date,
      },
    });

    if (existingAppointment) {
      return res.status(400).json({
        error: "An appointment already exists for this date",
      });
    }

    // Calculate or use provided price
    let appointmentPrice;
    if (price) {
      appointmentPrice = parseFloat(price);
    } else if (cleanerClient.defaultPrice) {
      appointmentPrice = parseFloat(cleanerClient.defaultPrice);
    } else {
      // Calculate based on home details
      appointmentPrice = await calculatePrice(
        home.bringSheets || "no",
        home.bringTowels || "no",
        home.numBeds,
        home.numBaths,
        timeWindow || home.timeToBeCompleted || "anytime"
      );
    }

    // Create the appointment
    const appointment = await UserAppointments.create({
      userId: client.id,
      homeId: home.id,
      date: date,
      price: appointmentPrice.toString(),
      originalPrice: appointmentPrice.toString(),
      completed: false,
      paid: false,
      hasBeenAssigned: true,
      employeesAssigned: [req.user.id.toString()],
      empoyeesNeeded: home.cleanersNeeded || 1,
      timeToBeCompleted: timeWindow || home.timeToBeCompleted || "anytime",
      bringSheets: home.bringSheets || "no",
      bringTowels: home.bringTowels || "no",
      keyPadCode: home.keyPadCode || null,
      keyLocation: home.keyLocation || null,
      bookedByCleanerId: req.user.id,
      autoPayEnabled: cleanerClient.autoPayEnabled !== false,
      discountApplied: false,
    });

    // Create the cleaner assignment record
    await UserCleanerAppointments.create({
      appointmentId: appointment.id,
      employeeId: req.user.id,
    });

    // Update or create user bill
    let userBill = await UserBills.findOne({
      where: { userId: client.id },
    });

    if (!userBill) {
      userBill = await UserBills.create({
        userId: client.id,
        appointmentDue: appointmentPrice,
        cancellationDue: 0,
        totalDue: appointmentPrice,
        appointmentPaid: 0,
        cancellationPaid: 0,
        totalPaid: 0,
      });
    } else {
      await userBill.update({
        appointmentDue: parseFloat(userBill.appointmentDue || 0) + appointmentPrice,
        totalDue: parseFloat(userBill.totalDue || 0) + appointmentPrice,
      });
    }

    // Calculate cleaner payout (platform takes fee)
    const platformFeePercent = await IncentiveService.calculateCleanerFee(req.user.id, models);
    const platformFee = appointmentPrice * (platformFeePercent / 100);
    const cleanerPayout = appointmentPrice - platformFee;

    // Create payout record
    await Payout.create({
      cleanerId: req.user.id,
      appointmentId: appointment.id,
      amount: cleanerPayout,
      platformFee: platformFee,
      status: "pending",
    });

    // TODO: Send notification to client about the booking
    // await sendBookingNotification(client, appointment, req.user);

    res.status(201).json({
      success: true,
      message: "Appointment booked successfully",
      appointment: {
        id: appointment.id,
        date: appointment.date,
        price: appointment.price,
        clientName: `${EncryptionService.decrypt(client.firstName)} ${EncryptionService.decrypt(client.lastName)}`,
        homeAddress: `${EncryptionService.decrypt(home.address)}, ${EncryptionService.decrypt(home.city)}`,
        timeWindow: appointment.timeToBeCompleted,
      },
    });
  } catch (err) {
    console.error("Error booking for client:", err);
    res.status(500).json({ error: "Failed to book appointment" });
  }
});

// ==========================================
// BOOK FOR CLIENT ENDPOINTS (using /:id param)
// ==========================================

/**
 * POST /:id/book-for-client
 * Business owner books an appointment on behalf of their client
 * Client will receive notifications and must accept/decline within 48 hours
 */
cleanerClientsRouter.post("/:id/book-for-client", verifyCleaner, async (req, res) => {
  try {
    const { id } = req.params;
    const { date, price, timeWindow, notes } = req.body;
    const cleanerId = req.user.id;

    // Validate required fields
    if (!date) {
      return res.status(400).json({ error: "Date is required" });
    }

    // Find the cleaner-client relationship
    const cleanerClient = await CleanerClient.findOne({
      where: {
        id,
        cleanerId,
        status: "active",
      },
      include: [
        {
          model: User,
          as: "client",
          attributes: ["id", "firstName", "lastName", "email", "expoPushToken", "notifications"],
        },
        {
          model: UserHomes,
          as: "home",
          attributes: ["id", "numBeds", "numBaths", "sheetsProvided", "towelsProvided", "keyPadCode", "keyLocation", "cleanersNeeded", "timeToBeCompleted", "isSetupComplete"],
        },
      ],
    });

    if (!cleanerClient) {
      return res.status(404).json({ error: "Client relationship not found" });
    }

    if (!cleanerClient.home) {
      return res.status(400).json({ error: "Client has no associated home" });
    }

    if (!cleanerClient.home.isSetupComplete) {
      return res.status(400).json({ error: "Client has not completed home setup" });
    }

    // Check if there's already a pending booking for this date
    const existingPending = await UserAppointments.findOne({
      where: {
        homeId: cleanerClient.homeId,
        date,
        clientResponsePending: true,
      },
    });

    if (existingPending) {
      return res.status(400).json({ error: "A pending booking already exists for this date" });
    }

    // Check if there's already a confirmed appointment for this date
    const existingConfirmed = await UserAppointments.findOne({
      where: {
        homeId: cleanerClient.homeId,
        date,
        clientResponsePending: false,
        clientResponse: { [models.Sequelize.Op.or]: ["accepted", null] },
      },
    });

    if (existingConfirmed) {
      return res.status(400).json({ error: "An appointment already exists for this date" });
    }

    // Calculate price if not provided
    const appointmentPrice = price || cleanerClient.defaultPrice || 150;

    // Calculate expiration (48 hours from now)
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 48);

    // Get cleaner name
    const cleaner = await User.findByPk(cleanerId);
    const cleanerName = `${EncryptionService.decrypt(cleaner.firstName)} ${EncryptionService.decrypt(cleaner.lastName)}`;

    // Create the appointment
    const appointment = await UserAppointments.create({
      userId: cleanerClient.clientId,
      homeId: cleanerClient.homeId,
      date,
      price: String(appointmentPrice),
      paid: false,
      completed: false,
      hasBeenAssigned: true, // Pre-assigned to the business owner
      employeesAssigned: [String(cleanerId)],
      empoyeesNeeded: cleanerClient.home.cleanersNeeded || 1,
      timeToBeCompleted: timeWindow || cleanerClient.home.timeToBeCompleted || "anytime",
      bringTowels: cleanerClient.home.towelsProvided ? "no" : "yes",
      bringSheets: cleanerClient.home.sheetsProvided ? "no" : "yes",
      keyPadCode: cleanerClient.home.keyPadCode,
      keyLocation: cleanerClient.home.keyLocation,
      bookedByCleanerId: cleanerId,
      clientResponsePending: true,
      expiresAt,
      autoPayEnabled: cleanerClient.autoPayEnabled,
      businessOwnerPrice: appointmentPrice,
    });

    // Create cleaner-appointment link
    await UserCleanerAppointments.create({
      appointmentId: appointment.id,
      employeeId: cleanerId,
    });

    // Get io instance for real-time notifications
    const io = req.app.get("io");

    // Notify client via all channels (push, email, in-app, socket)
    await NotificationService.notifyPendingBooking({
      clientId: cleanerClient.clientId,
      cleanerId,
      appointmentId: appointment.id,
      appointmentDate: date,
      price: appointmentPrice,
      cleanerName,
      io,
    });

    console.log(`[BookForClient] Cleaner ${cleanerId} booked appointment ${appointment.id} for client ${cleanerClient.clientId}`);

    res.status(201).json({
      message: "Booking created successfully. Waiting for client approval.",
      appointment: {
        id: appointment.id,
        date,
        price: appointmentPrice,
        status: "pending_approval",
        expiresAt,
      },
    });
  } catch (err) {
    console.error("Error booking for client:", err);
    res.status(500).json({ error: "Failed to create booking" });
  }
});

/**
 * GET /:id/pending-bookings
 * Get all pending bookings for a specific client relationship
 */
cleanerClientsRouter.get("/:id/pending-bookings", verifyCleaner, async (req, res) => {
  try {
    const { id } = req.params;
    const cleanerId = req.user.id;

    const cleanerClient = await CleanerClient.findOne({
      where: { id, cleanerId },
    });

    if (!cleanerClient) {
      return res.status(404).json({ error: "Client relationship not found" });
    }

    const pendingBookings = await UserAppointments.findAll({
      where: {
        homeId: cleanerClient.homeId,
        bookedByCleanerId: cleanerId,
        clientResponsePending: true,
      },
      order: [["date", "ASC"]],
    });

    res.json({ pendingBookings });
  } catch (err) {
    console.error("Error fetching pending bookings:", err);
    res.status(500).json({ error: "Failed to fetch pending bookings" });
  }
});

/**
 * GET /:id/platform-price
 * Calculate platform price for a client's home based on beds/baths
 */
cleanerClientsRouter.get("/:id/platform-price", verifyCleaner, async (req, res) => {
  try {
    const { id } = req.params;
    const cleanerId = req.user.id;

    // Get the cleaner-client relationship with home details
    const cleanerClient = await CleanerClient.findOne({
      where: { id, cleanerId },
      include: [
        {
          model: UserHomes,
          as: "home",
          attributes: ["id", "numBeds", "numBaths"],
        },
      ],
    });

    if (!cleanerClient) {
      return res.status(404).json({ error: "Client not found" });
    }

    if (!cleanerClient.home) {
      return res.status(400).json({ error: "No home associated with this client" });
    }

    const { numBeds, numBaths } = cleanerClient.home;

    // Calculate base platform price (no linens, anytime window)
    const platformPrice = await calculatePrice(
      "no", // sheets
      "no", // towels
      numBeds,
      numBaths,
      "anytime" // time window
    );

    res.json({
      platformPrice,
      numBeds,
      numBaths,
      breakdown: {
        basePrice: 150,
        extraBeds: Math.max(0, numBeds - 1),
        extraBaths: Math.max(0, Math.floor(numBaths) - 1),
        halfBath: (numBaths % 1) >= 0.5 ? 1 : 0,
      },
    });
  } catch (err) {
    console.error("Error calculating platform price:", err);
    res.status(500).json({ error: "Failed to calculate platform price" });
  }
});

/**
 * PATCH /:id/default-price
 * Update the default price for a client
 */
cleanerClientsRouter.patch("/:id/default-price", verifyCleaner, async (req, res) => {
  try {
    const { id } = req.params;
    const { price } = req.body;
    const cleanerId = req.user.id;

    // Validate price
    if (price === undefined || price === null) {
      return res.status(400).json({ error: "Price is required" });
    }

    const numericPrice = parseFloat(price);
    if (isNaN(numericPrice) || numericPrice < 0) {
      return res.status(400).json({ error: "Price must be a positive number" });
    }

    // Get the cleaner-client relationship
    const cleanerClient = await CleanerClient.findOne({
      where: { id, cleanerId },
    });

    if (!cleanerClient) {
      return res.status(404).json({ error: "Client not found" });
    }

    // Update the default price
    await cleanerClient.update({ defaultPrice: numericPrice });

    res.json({
      success: true,
      cleanerClient: {
        id: cleanerClient.id,
        defaultPrice: numericPrice,
      },
    });
  } catch (err) {
    console.error("Error updating default price:", err);
    res.status(500).json({ error: "Failed to update default price" });
  }
});

module.exports = cleanerClientsRouter;
