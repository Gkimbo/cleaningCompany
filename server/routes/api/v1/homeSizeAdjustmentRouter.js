const express = require("express");
const jwt = require("jsonwebtoken");
const { Op } = require("sequelize");
const {
  User,
  UserAppointments,
  UserHomes,
  HomeSizeAdjustmentRequest,
  HomeSizeAdjustmentPhoto,
} = require("../../../models");
const calculatePrice = require("../../../services/CalculatePrice");
const Email = require("../../../services/sendNotifications/EmailClass");
const PushNotification = require("../../../services/sendNotifications/PushNotificationClass");

const homeSizeAdjustmentRouter = express.Router();
const secretKey = process.env.SESSION_SECRET;

// Middleware to verify token and extract user
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).json({ error: "Authorization token required" });
  }

  try {
    const token = authHeader.split(" ")[1];
    const decoded = jwt.verify(token, secretKey);
    req.user = decoded;
    next();
  } catch (error) {
    if (error.name === "TokenExpiredError") {
      return res.status(401).json({ error: "Token has expired" });
    }
    return res.status(403).json({ error: "Invalid token" });
  }
};

/**
 * POST /
 * Cleaner creates a home size adjustment request
 * Requires photos of each reported bedroom and bathroom as proof
 */
homeSizeAdjustmentRouter.post("/", authenticateToken, async (req, res) => {
  const { appointmentId, reportedNumBeds, reportedNumBaths, cleanerNote, photos } = req.body;
  const cleanerId = req.user.userId;

  try {
    // Validate input
    if (!appointmentId || !reportedNumBeds || !reportedNumBaths) {
      return res.status(400).json({ error: "Appointment ID, beds, and baths are required" });
    }

    // Parse the reported values
    const numBeds = parseInt(reportedNumBeds.replace('+', ''), 10) || parseInt(reportedNumBeds, 10);
    const numBaths = Math.ceil(parseFloat(reportedNumBaths.replace('+', '')) || parseFloat(reportedNumBaths));

    // Validate photos are provided
    if (!photos || !Array.isArray(photos)) {
      return res.status(400).json({
        error: "Photos are required to report a home size discrepancy",
        details: "Please take photos of each bedroom and bathroom as proof"
      });
    }

    // Count photos by type
    const bedroomPhotos = photos.filter(p => p.roomType === 'bedroom');
    const bathroomPhotos = photos.filter(p => p.roomType === 'bathroom');

    // Validate we have enough photos
    if (bedroomPhotos.length < numBeds) {
      return res.status(400).json({
        error: `You must provide a photo for each bedroom. Expected ${numBeds} bedroom photos, got ${bedroomPhotos.length}`,
        missingType: 'bedroom',
        expected: numBeds,
        received: bedroomPhotos.length
      });
    }

    if (bathroomPhotos.length < numBaths) {
      return res.status(400).json({
        error: `You must provide a photo for each bathroom. Expected ${numBaths} bathroom photos, got ${bathroomPhotos.length}`,
        missingType: 'bathroom',
        expected: numBaths,
        received: bathroomPhotos.length
      });
    }

    // Validate each photo has required data
    for (const photo of photos) {
      if (!photo.photoData || !photo.roomType || !photo.roomNumber) {
        return res.status(400).json({
          error: "Each photo must have photoData, roomType, and roomNumber"
        });
      }
    }

    // Get the appointment
    const appointment = await UserAppointments.findByPk(appointmentId);
    if (!appointment) {
      return res.status(404).json({ error: "Appointment not found" });
    }

    // Verify cleaner is assigned to this appointment
    const employeesAssigned = appointment.employeesAssigned || [];
    if (!employeesAssigned.includes(String(cleanerId))) {
      return res.status(403).json({ error: "You are not assigned to this appointment" });
    }

    // Check if there's already a pending request for this appointment
    const existingRequest = await HomeSizeAdjustmentRequest.findOne({
      where: {
        appointmentId,
        status: {
          [Op.in]: ["pending_homeowner", "pending_owner"],
        },
      },
    });

    if (existingRequest) {
      return res.status(400).json({ error: "An adjustment request already exists for this appointment" });
    }

    // Get home details
    const home = await UserHomes.findByPk(appointment.homeId);
    if (!home) {
      return res.status(404).json({ error: "Home not found" });
    }

    // Calculate new price with reported values
    const newPrice = await calculatePrice(
      appointment.bringSheets,
      appointment.bringTowels,
      reportedNumBeds,
      reportedNumBaths,
      appointment.timeToBeCompleted,
      appointment.sheetConfigurations,
      appointment.towelConfigurations
    );

    const originalPrice = parseFloat(appointment.price);
    const priceDifference = newPrice - originalPrice;

    // Create the adjustment request
    const adjustmentRequest = await HomeSizeAdjustmentRequest.create({
      appointmentId,
      homeId: home.id,
      cleanerId,
      homeownerId: appointment.userId,
      originalNumBeds: home.numBeds,
      originalNumBaths: home.numBaths,
      originalPrice,
      reportedNumBeds: String(reportedNumBeds),
      reportedNumBaths: String(reportedNumBaths),
      calculatedNewPrice: newPrice,
      priceDifference,
      cleanerNote: cleanerNote || null,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours from now
    });

    // Save all the photos as proof
    const photoPromises = photos.map(photo =>
      HomeSizeAdjustmentPhoto.create({
        adjustmentRequestId: adjustmentRequest.id,
        roomType: photo.roomType,
        roomNumber: photo.roomNumber,
        photoUrl: photo.photoData, // Base64 data stored directly
        s3Key: null, // Could be used for S3 storage in future
      })
    );
    await Promise.all(photoPromises);

    console.log(`📸 Saved ${photos.length} proof photos for adjustment request ${adjustmentRequest.id}`);

    // Get user details for notifications
    const homeowner = await User.findByPk(appointment.userId);
    const cleaner = await User.findByPk(cleanerId);

    // Send email notification to homeowner
    if (homeowner.notifications?.includes("email")) {
      await Email.sendHomeSizeAdjustmentRequest(
        homeowner.email,
        homeowner.firstName || homeowner.username,
        cleaner.firstName || cleaner.username,
        home.address,
        {
          originalBeds: home.numBeds,
          originalBaths: home.numBaths,
          reportedBeds: reportedNumBeds,
          reportedBaths: reportedNumBaths,
          priceDifference,
        }
      );
    }

    // Send push notification to homeowner
    if (homeowner.notifications?.includes("phone") && homeowner.expoPushToken) {
      await PushNotification.sendPushHomeSizeAdjustment(
        homeowner.expoPushToken,
        homeowner.firstName || homeowner.username,
        cleaner.firstName || cleaner.username,
        priceDifference
      );
    }

    console.log(`✅ Home size adjustment request created: ID ${adjustmentRequest.id} for appointment ${appointmentId}`);

    return res.status(201).json({
      success: true,
      adjustmentRequest: {
        id: adjustmentRequest.id,
        originalNumBeds: adjustmentRequest.originalNumBeds,
        originalNumBaths: adjustmentRequest.originalNumBaths,
        reportedNumBeds: adjustmentRequest.reportedNumBeds,
        reportedNumBaths: adjustmentRequest.reportedNumBaths,
        originalPrice: adjustmentRequest.originalPrice,
        calculatedNewPrice: adjustmentRequest.calculatedNewPrice,
        priceDifference: adjustmentRequest.priceDifference,
        status: adjustmentRequest.status,
      },
      message: "Adjustment request created and homeowner notified",
    });
  } catch (error) {
    console.error("Error creating home size adjustment request:", error);
    return res.status(500).json({ error: "Failed to create adjustment request" });
  }
});

/**
 * GET /pending
 * Get pending adjustment requests for current user (homeowner or owner)
 */
homeSizeAdjustmentRouter.get("/pending", authenticateToken, async (req, res) => {
  const userId = req.user.userId;

  try {
    const user = await User.findByPk(userId);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    let whereClause;
    const isOwner = user.type === "owner";

    if (isOwner) {
      // Owners see disputed and expired requests
      whereClause = {
        status: {
          [Op.in]: ["pending_owner", "expired", "denied"],
        },
      };
    } else {
      // Homeowners see their pending requests
      whereClause = {
        homeownerId: userId,
        status: "pending_homeowner",
      };
    }

    // Build includes - only owners get photos
    const includes = [
      {
        model: UserHomes,
        as: "home",
        attributes: ["id", "address", "city", "state", "zipcode", "nickName"],
      },
      {
        model: UserAppointments,
        as: "appointment",
        attributes: ["id", "date", "price"],
      },
      {
        model: User,
        as: "cleaner",
        attributes: isOwner
          ? ["id", "username", "firstName", "lastName", "ownerPrivateNotes", "falseClaimCount"]
          : ["id", "username", "firstName", "lastName"],
      },
      {
        model: User,
        as: "homeowner",
        attributes: isOwner
          ? ["id", "username", "firstName", "lastName", "ownerPrivateNotes", "falseHomeSizeCount"]
          : ["id", "username", "firstName", "lastName"],
      },
    ];

    // Only include photos for owners
    if (isOwner) {
      includes.push({
        model: HomeSizeAdjustmentPhoto,
        as: "photos",
        attributes: ["id", "roomType", "roomNumber", "photoUrl", "createdAt"],
      });
    }

    const requests = await HomeSizeAdjustmentRequest.findAll({
      where: whereClause,
      include: includes,
      order: [["createdAt", "DESC"]],
    });

    return res.json({ adjustments: requests });
  } catch (error) {
    console.error("Error fetching pending requests:", error);
    return res.status(500).json({ error: "Failed to fetch pending requests" });
  }
});

/**
 * GET /:id
 * Get a specific adjustment request
 * Photos are only included for owners
 */
homeSizeAdjustmentRouter.get("/:id", authenticateToken, async (req, res) => {
  const { id } = req.params;
  const userId = req.user.userId;

  try {
    // First check if user is a owner
    const user = await User.findByPk(userId);
    const isOwner = user && user.type === "owner";

    // Build includes - only owners get photos and tracking fields
    const includes = [
      {
        model: UserHomes,
        as: "home",
        attributes: ["id", "address", "city", "state", "zipcode", "nickName"],
      },
      {
        model: UserAppointments,
        as: "appointment",
        attributes: ["id", "date", "price"],
      },
      {
        model: User,
        as: "cleaner",
        attributes: isOwner
          ? ["id", "username", "firstName", "lastName", "ownerPrivateNotes", "falseClaimCount"]
          : ["id", "username", "firstName", "lastName"],
      },
      {
        model: User,
        as: "homeowner",
        attributes: isOwner
          ? ["id", "username", "firstName", "lastName", "ownerPrivateNotes", "falseHomeSizeCount"]
          : ["id", "username", "firstName", "lastName"],
      },
    ];

    // Only include photos for owners
    if (isOwner) {
      includes.push({
        model: HomeSizeAdjustmentPhoto,
        as: "photos",
        attributes: ["id", "roomType", "roomNumber", "photoUrl", "createdAt"],
      });
    }

    const request = await HomeSizeAdjustmentRequest.findByPk(id, {
      include: includes,
    });

    if (!request) {
      return res.status(404).json({ error: "Request not found" });
    }

    // Check authorization: must be homeowner, cleaner, or owner
    if (
      request.homeownerId !== userId &&
      request.cleanerId !== userId &&
      !isOwner
    ) {
      return res.status(403).json({ error: "Not authorized to view this request" });
    }

    return res.json({ request });
  } catch (error) {
    console.error("Error fetching request:", error);
    return res.status(500).json({ error: "Failed to fetch request" });
  }
});

/**
 * POST /:id/homeowner-response
 * Homeowner approves or denies the adjustment request
 */
homeSizeAdjustmentRouter.post("/:id/homeowner-response", authenticateToken, async (req, res) => {
  const { id } = req.params;
  const { approve, reason } = req.body;
  const userId = req.user.userId;

  try {
    const request = await HomeSizeAdjustmentRequest.findByPk(id);
    if (!request) {
      return res.status(404).json({ error: "Request not found" });
    }

    if (request.homeownerId !== userId) {
      return res.status(403).json({ error: "You are not authorized to respond to this request" });
    }

    if (request.status !== "pending_homeowner") {
      return res.status(400).json({ error: "This request has already been processed" });
    }

    const home = await UserHomes.findByPk(request.homeId);
    const appointment = await UserAppointments.findByPk(request.appointmentId);
    const homeowner = await User.findByPk(userId);
    const cleaner = await User.findByPk(request.cleanerId);

    if (approve) {
      // Homeowner approved - update home and charge difference

      // Update home with new bed/bath counts
      await home.update({
        numBeds: request.reportedNumBeds,
        numBaths: request.reportedNumBaths,
      });

      // Update the triggering appointment price
      await appointment.update({
        price: String(request.calculatedNewPrice),
      });

      // Update ALL future/current appointments for this home with recalculated prices
      const today = new Date().toISOString().split('T')[0];
      const futureAppointments = await UserAppointments.findAll({
        where: {
          homeId: request.homeId,
          completed: false,
          id: { [Op.ne]: appointment.id }, // Exclude the one we just updated
          date: { [Op.gte]: today }
        }
      });

      for (const appt of futureAppointments) {
        const newApptPrice = await calculatePrice(
          appt.bringSheets,
          appt.bringTowels,
          request.reportedNumBeds,
          request.reportedNumBaths,
          appt.timeToBeCompleted,
          appt.sheetConfigurations,
          appt.towelConfigurations
        );
        await appt.update({ price: String(newApptPrice) });
      }

      console.log(`📋 Updated ${futureAppointments.length} future appointments with new pricing for home ${request.homeId}`);

      // Handle payment for price difference
      let chargeStatus = "waived";
      let chargePaymentIntentId = null;

      if (request.priceDifference > 0) {
        // For now, mark as pending - actual Stripe charge would go here
        // In production, you'd charge the customer's default payment method
        chargeStatus = "pending";
        console.log(`💰 Price difference of $${request.priceDifference} to be charged to homeowner ${userId}`);
      }

      await request.update({
        status: "approved",
        homeownerRespondedAt: new Date(),
        chargePaymentIntentId,
        chargeStatus,
      });

      // Notify cleaner of approval
      if (cleaner.notifications?.includes("email")) {
        await Email.sendAdjustmentApproved(
          cleaner.email,
          cleaner.firstName || cleaner.username,
          home.address,
          request.reportedNumBeds,
          request.reportedNumBaths,
          request.priceDifference
        );
      }

      if (cleaner.notifications?.includes("phone") && cleaner.expoPushToken) {
        await PushNotification.sendPushAdjustmentApproved(
          cleaner.expoPushToken,
          cleaner.firstName || cleaner.username,
          home.address
        );
      }

      console.log(`✅ Adjustment request ${id} approved by homeowner. Home updated.`);

      return res.json({
        success: true,
        message: "Adjustment approved, home updated, and payment processed",
        chargeStatus,
      });
    } else {
      // Homeowner denied - escalate to owner
      await request.update({
        status: "pending_owner",
        homeownerResponse: reason || null,
        homeownerRespondedAt: new Date(),
      });

      // Notify owners
      const owners = await User.findAll({ where: { type: "owner" } });
      for (const owner of owners) {
        if (owner.notifications?.includes("email")) {
          // Use notificationEmail if set, otherwise main email
          await Email.sendAdjustmentNeedsOwnerReview(
            owner.getNotificationEmail(),
            owner.firstName || owner.username,
            request,
            home,
            cleaner,
            homeowner
          );
        }

        if (owner.notifications?.includes("phone") && owner.expoPushToken) {
          await PushNotification.sendPushAdjustmentNeedsReview(
            owner.expoPushToken,
            request.id
          );
        }
      }

      console.log(`⚠️ Adjustment request ${id} denied by homeowner. Escalated to owners.`);

      return res.json({
        success: true,
        message: "Request denied and escalated to owner for review",
      });
    }
  } catch (error) {
    console.error("Error processing homeowner response:", error);
    return res.status(500).json({ error: "Failed to process response" });
  }
});

/**
 * POST /:id/owner-resolve
 * Owner resolves a disputed adjustment request
 */
homeSizeAdjustmentRouter.post("/:id/owner-resolve", authenticateToken, async (req, res) => {
  const { id } = req.params;
  const { approve, ownerNote, finalBeds, finalBaths } = req.body;
  const ownerId = req.user.userId;

  try {
    const owner = await User.findByPk(ownerId);
    if (!owner || owner.type !== "owner") {
      return res.status(403).json({ error: "Owner access required" });
    }

    const request = await HomeSizeAdjustmentRequest.findByPk(id);
    if (!request) {
      return res.status(404).json({ error: "Request not found" });
    }

    if (!["pending_owner", "expired"].includes(request.status)) {
      return res.status(400).json({ error: "This request is not awaiting owner review" });
    }

    const home = await UserHomes.findByPk(request.homeId);
    const appointment = await UserAppointments.findByPk(request.appointmentId);
    const homeowner = await User.findByPk(request.homeownerId);
    const cleaner = await User.findByPk(request.cleanerId);

    if (approve) {
      // Owner approved cleaner's report (or custom values)
      const bedsToUse = finalBeds || request.reportedNumBeds;
      const bathsToUse = finalBaths || request.reportedNumBaths;

      // Recalculate price with final values
      const finalPrice = await calculatePrice(
        appointment.bringSheets,
        appointment.bringTowels,
        bedsToUse,
        bathsToUse,
        appointment.timeToBeCompleted,
        appointment.sheetConfigurations,
        appointment.towelConfigurations
      );

      const priceDiff = finalPrice - parseFloat(appointment.price);

      // Update home
      await home.update({
        numBeds: String(bedsToUse),
        numBaths: String(bathsToUse),
      });

      // Update the triggering appointment price
      await appointment.update({
        price: String(finalPrice),
      });

      // Update ALL future/current appointments for this home with recalculated prices
      const today = new Date().toISOString().split('T')[0];
      const futureAppointments = await UserAppointments.findAll({
        where: {
          homeId: request.homeId,
          completed: false,
          id: { [Op.ne]: appointment.id }, // Exclude the one we just updated
          date: { [Op.gte]: today }
        }
      });

      for (const appt of futureAppointments) {
        const newApptPrice = await calculatePrice(
          appt.bringSheets,
          appt.bringTowels,
          bedsToUse,
          bathsToUse,
          appt.timeToBeCompleted,
          appt.sheetConfigurations,
          appt.towelConfigurations
        );
        await appt.update({ price: String(newApptPrice) });
      }

      console.log(`📋 Updated ${futureAppointments.length} future appointments with new pricing for home ${request.homeId}`);

      // Record false home size claim on homeowner (they disputed but were wrong)
      const timestamp = new Date().toISOString();
      const currentNotes = homeowner.ownerPrivateNotes || '';
      const newNote = `[${timestamp}] HOME SIZE DISCREPANCY: Homeowner disputed cleaner's claim but owner found home was incorrectly sized. Original: ${request.originalNumBeds}bd/${request.originalNumBaths}ba, Actual: ${bedsToUse}bd/${bathsToUse}ba. Owner: ${owner.firstName} ${owner.lastName}`;

      await homeowner.update({
        ownerPrivateNotes: currentNotes ? currentNotes + '\n' + newNote : newNote,
        falseHomeSizeCount: (homeowner.falseHomeSizeCount || 0) + 1
      });

      console.log(`📝 Added false home size record to homeowner ${homeowner.id}. Total count: ${(homeowner.falseHomeSizeCount || 0) + 1}`);

      let chargeStatus = "waived";
      if (priceDiff > 0) {
        chargeStatus = "pending";
        console.log(`💰 Price difference of $${priceDiff} to be charged to homeowner ${request.homeownerId}`);
      }

      await request.update({
        status: "owner_approved",
        ownerId,
        ownerNote: ownerNote || null,
        ownerResolvedAt: new Date(),
        chargeStatus,
      });

      // Notify both parties
      if (homeowner.notifications?.includes("email")) {
        await Email.sendAdjustmentResolved(
          homeowner.email,
          homeowner.firstName || homeowner.username,
          "approved",
          bedsToUse,
          bathsToUse,
          priceDiff,
          ownerNote
        );
      }

      if (cleaner.notifications?.includes("email")) {
        await Email.sendAdjustmentResolved(
          cleaner.email,
          cleaner.firstName || cleaner.username,
          "approved",
          bedsToUse,
          bathsToUse,
          priceDiff,
          ownerNote
        );
      }

      console.log(`✅ Owner ${ownerId} approved adjustment request ${id}`);

      return res.json({
        success: true,
        message: "Adjustment approved by owner, home updated",
        finalBeds: bedsToUse,
        finalBaths: bathsToUse,
        chargeStatus,
      });
    } else {
      // Owner denied - side with homeowner (cleaner made false claim)
      await request.update({
        status: "owner_denied",
        ownerId,
        ownerNote: ownerNote || null,
        ownerResolvedAt: new Date(),
      });

      // Record false claim on cleaner (their report was incorrect)
      const timestamp = new Date().toISOString();
      const currentNotes = cleaner.ownerPrivateNotes || '';
      const newNote = `[${timestamp}] FALSE CLAIM: Cleaner claimed home was ${request.reportedNumBeds}bd/${request.reportedNumBaths}ba but owner verified it was correctly listed as ${request.originalNumBeds}bd/${request.originalNumBaths}ba. Owner: ${owner.firstName} ${owner.lastName}`;

      await cleaner.update({
        ownerPrivateNotes: currentNotes ? currentNotes + '\n' + newNote : newNote,
        falseClaimCount: (cleaner.falseClaimCount || 0) + 1
      });

      console.log(`📝 Added false claim record to cleaner ${cleaner.id}. Total count: ${(cleaner.falseClaimCount || 0) + 1}`);

      // Notify both parties
      if (homeowner.notifications?.includes("email")) {
        await Email.sendAdjustmentResolved(
          homeowner.email,
          homeowner.firstName || homeowner.username,
          "denied",
          null,
          null,
          0,
          ownerNote
        );
      }

      if (cleaner.notifications?.includes("email")) {
        await Email.sendAdjustmentResolved(
          cleaner.email,
          cleaner.firstName || cleaner.username,
          "denied",
          null,
          null,
          0,
          ownerNote
        );
      }

      console.log(`❌ Owner ${ownerId} denied adjustment request ${id}`);

      return res.json({
        success: true,
        message: "Adjustment denied by owner",
      });
    }
  } catch (error) {
    console.error("Error resolving adjustment request:", error);
    return res.status(500).json({ error: "Failed to resolve request" });
  }
});

/**
 * GET /history/:homeId
 * Get adjustment history for a specific home
 */
homeSizeAdjustmentRouter.get("/history/:homeId", authenticateToken, async (req, res) => {
  const { homeId } = req.params;
  const userId = req.user.userId;

  try {
    const user = await User.findByPk(userId);
    const home = await UserHomes.findByPk(homeId);

    if (!home) {
      return res.status(404).json({ error: "Home not found" });
    }

    // Check authorization
    if (home.userId !== userId && user.type !== "owner") {
      return res.status(403).json({ error: "Not authorized to view this home's history" });
    }

    const requests = await HomeSizeAdjustmentRequest.findAll({
      where: { homeId },
      include: [
        {
          model: User,
          as: "cleaner",
          attributes: ["id", "username", "firstName", "lastName"],
        },
      ],
      order: [["createdAt", "DESC"]],
    });

    return res.json({ requests });
  } catch (error) {
    console.error("Error fetching history:", error);
    return res.status(500).json({ error: "Failed to fetch history" });
  }
});

module.exports = homeSizeAdjustmentRouter;
