const express = require("express");
const jwt = require("jsonwebtoken");
const UserSerializer = require("../../../serializers/userSerializer");
const UserInfo = require("../../../services/UserInfoClass");
const {
  User,
  UserHomes,
  UserAppointments,
  UserBills,
  UserReviews,
  UserPendingRequests,
  MultiCleanerJob,
  CleanerJoinRequest,
} = require("../../../models");

const HomeClass = require("../../../services/HomeClass");
const HomeSerializer = require("../../../serializers/homesSerializer");
const {
  isInServiceArea,
  getCleanersNeeded,
  getPricingConfig,
} = require("../../../config/businessConfig");
const { Op } = require("sequelize");

const userInfoRouter = express.Router();
const secretKey = process.env.SESSION_SECRET;

userInfoRouter.get("/", async (req, res) => {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) {
    return res.status(401).json({ error: "Authorization token required" });
  }
  try {
    const decodedToken = jwt.verify(token, secretKey);
    const userId = decodedToken.userId;
    const user = await User.findByPk(userId, {
      include: [
        {
          model: UserHomes,
          as: "homes",
        },
        {
          model: UserAppointments,
          as: "appointments",
          where: { wasCancelled: false },
          required: false, // Still include users with no appointments
        },
        {
          model: UserBills,
          as: "bills",
        },
      ],
    });

    // Get all client reviews for this user's appointments
    const appointmentIds = user.appointments.map((apt) => apt.id);
    const clientReviews = await UserReviews.findAll({
      where: {
        appointmentId: { [Op.in]: appointmentIds },
        reviewerId: userId,
        reviewType: "homeowner_to_cleaner",
      },
      attributes: ["appointmentId"],
    });
    const reviewedAppointmentIds = new Set(clientReviews.map((r) => r.appointmentId));

    // Get pending cleaner requests for each appointment
    const pendingRequests = await UserPendingRequests.findAll({
      where: {
        appointmentId: { [Op.in]: appointmentIds },
        status: { [Op.in]: ["pending", "onHold"] },
      },
      attributes: ["appointmentId"],
    });

    // Count pending requests per appointment
    const pendingRequestCounts = {};
    pendingRequests.forEach((req) => {
      pendingRequestCounts[req.appointmentId] = (pendingRequestCounts[req.appointmentId] || 0) + 1;
    });

    // Get multi-cleaner job data for appointments
    const multiCleanerJobs = await MultiCleanerJob.findAll({
      where: {
        appointmentId: { [Op.in]: appointmentIds },
      },
      attributes: ["id", "appointmentId", "totalCleanersRequired", "cleanersConfirmed", "status"],
    });

    // Map multi-cleaner job data by appointment ID
    const multiCleanerJobsByAppointment = {};
    multiCleanerJobs.forEach((job) => {
      multiCleanerJobsByAppointment[job.appointmentId] = {
        multiCleanerJobId: job.id,
        cleanersNeeded: job.totalCleanersRequired,
        cleanersConfirmed: job.cleanersConfirmed,
        multiCleanerStatus: job.status,
      };
    });

    // Get pending approval requests (cleaner join requests awaiting homeowner approval)
    const pendingApprovalRequests = await CleanerJoinRequest.findAll({
      where: {
        appointmentId: { [Op.in]: appointmentIds },
        status: "pending",
      },
      attributes: ["appointmentId"],
    });

    // Count pending approval requests per appointment
    const pendingApprovalCounts = {};
    pendingApprovalRequests.forEach((req) => {
      pendingApprovalCounts[req.appointmentId] = (pendingApprovalCounts[req.appointmentId] || 0) + 1;
    });

    // Add hasClientReview, pendingRequestCount, and multi-cleaner data to each appointment
    const appointmentsWithReviewStatus = user.appointments.map((apt) => {
      const mcJob = multiCleanerJobsByAppointment[apt.id];
      const employeesCount = apt.employeesAssigned ? apt.employeesAssigned.length : 0;
      // Use appointment's empoyeesNeeded (calculated at booking with time window factored in)
      // Fall back to 1 if not set
      const appointmentNeeds = apt.empoyeesNeeded || 1;

      return {
        ...apt.dataValues,
        hasClientReview: reviewedAppointmentIds.has(apt.id),
        pendingRequestCount: pendingRequestCounts[apt.id] || 0,
        pendingApprovalCount: pendingApprovalCounts[apt.id] || 0,
        // If there's a MultiCleanerJob record, use that data; otherwise use appointment's empoyeesNeeded
        cleanersNeeded: mcJob ? mcJob.cleanersNeeded : appointmentNeeds,
        cleanersConfirmed: mcJob ? mcJob.cleanersConfirmed : employeesCount,
        multiCleanerJobId: mcJob ? mcJob.multiCleanerJobId : null,
        multiCleanerStatus: mcJob ? mcJob.multiCleanerStatus : null,
      };
    });

    // Replace appointments with enriched data
    const userData = {
      ...user.dataValues,
      appointments: appointmentsWithReviewStatus,
    };

    let serializedUser = UserSerializer.serializeOne(userData);
    return res.status(200).json({ user: serializedUser });
  } catch (error) {
    console.log(error);
    return res.status(401).json({ error: "Invalid or expired token" });
  }
});

// Recalculate and sync bill from actual appointments
userInfoRouter.post("/sync-bill", async (req, res) => {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) {
    return res.status(401).json({ error: "Authorization token required" });
  }
  try {
    const decodedToken = jwt.verify(token, secretKey);
    const userId = decodedToken.userId;

    // Get all unpaid appointments for this user
    const unpaidAppointments = await UserAppointments.findAll({
      where: {
        userId,
        paid: false,
      },
    });

    // Calculate correct appointmentDue from actual unpaid appointments
    const correctAppointmentDue = unpaidAppointments.reduce((total, appt) => {
      return total + (Number(appt.price) || 0);
    }, 0);

    // Get or create user's bill
    let bill = await UserBills.findOne({ where: { userId } });
    if (!bill) {
      bill = await UserBills.create({
        userId,
        appointmentDue: correctAppointmentDue,
        cancellationFee: 0,
        totalDue: correctAppointmentDue,
      });
    } else {
      const cancellationFee = Number(bill.cancellationFee) || 0;
      const oldAppointmentDue = Number(bill.appointmentDue) || 0;
      const newTotalDue = correctAppointmentDue + cancellationFee;

      await bill.update({
        appointmentDue: correctAppointmentDue,
        totalDue: newTotalDue,
      });

      console.log(`[Sync Bill] User ${userId}: appointmentDue ${oldAppointmentDue} -> ${correctAppointmentDue}, totalDue -> ${newTotalDue}`);
    }

    return res.status(200).json({
      success: true,
      bill: {
        appointmentDue: correctAppointmentDue,
        cancellationFee: Number(bill.cancellationFee) || 0,
        totalDue: correctAppointmentDue + (Number(bill.cancellationFee) || 0),
      },
      unpaidAppointmentsCount: unpaidAppointments.length,
    });
  } catch (error) {
    console.error("[Sync Bill] Error:", error);
    return res.status(500).json({ error: "Failed to sync bill" });
  }
});

userInfoRouter.post("/home", async (req, res) => {
  const { token } = req.body.user;
  const {
    nickName,
    address,
    city,
    state,
    zipcode,
    numBeds,
    numBaths,
    sheetsProvided,
    towelsProvided,
    keyPadCode,
    keyLocation,
    recyclingLocation,
    compostLocation,
    trashLocation,
    contact,
    specialNotes,
    timeToBeCompleted,
    // New fields for sheets/towels details
    cleanSheetsLocation,
    dirtySheetsLocation,
    cleanTowelsLocation,
    dirtyTowelsLocation,
    bedConfigurations,
    bathroomConfigurations,
  } = req.body.home;
  try {
    const decodedToken = jwt.verify(token, secretKey);
    const userId = decodedToken.userId;
    const user = await User.findOne({
      where: { id: userId },
    });
    const checkZipCode = await HomeClass.checkZipCodeExists(zipcode);
    if (!checkZipCode) {
      return res.status(400).json("Cannot find zipcode");
    }

    // Check if address is within service area
    const serviceAreaCheck = isInServiceArea(city, state, zipcode);
    const outsideServiceArea = !serviceAreaCheck.isServiceable;

    let cleanersNeeded = getCleanersNeeded(numBeds, numBaths);

    const newHome = await UserInfo.addHomeToDB({
      nickName,
      userId,
      address,
      city,
      state,
      zipcode,
      numBeds,
      numBaths,
      sheetsProvided,
      towelsProvided,
      keyPadCode,
      keyLocation,
      recyclingLocation,
      compostLocation,
      trashLocation,
      contact,
      specialNotes,
      cleanersNeeded,
      timeToBeCompleted,
      outsideServiceArea,
      cleanSheetsLocation,
      dirtySheetsLocation,
      cleanTowelsLocation,
      dirtyTowelsLocation,
      bedConfigurations,
      bathroomConfigurations,
    });

    // Serialize the home to ensure consistent structure with fetched homes
    const serializedHome = HomeSerializer.serializeOne(newHome);

    return res.status(201).json({
      user,
      home: serializedHome,
      outsideServiceArea,
      serviceAreaMessage: outsideServiceArea
        ? "This home is outside our current service area. It has been saved to your profile, but you won't be able to book appointments until we expand to this area."
        : null,
    });
  } catch (error) {
    console.log(error);
    return res.status(401).json({ error: "Invalid or expired token" });
  }
});

userInfoRouter.patch("/home", async (req, res) => {
  const {
    id,
    nickName,
    address,
    city,
    state,
    zipcode,
    numBeds,
    numBaths,
    sheetsProvided,
    towelsProvided,
    keyPadCode,
    keyLocation,
    recyclingLocation,
    compostLocation,
    trashLocation,
    contact,
    specialNotes,
    timeToBeCompleted,
    // New fields for sheets/towels details
    cleanSheetsLocation,
    dirtySheetsLocation,
    cleanTowelsLocation,
    dirtyTowelsLocation,
    bedConfigurations,
    bathroomConfigurations,
  } = req.body;

  try {
    const checkZipCode = await HomeClass.checkZipCodeExists(zipcode);
    if (!checkZipCode) {
      return res.status(400).json({ error: "Cannot find zipcode" });
    }

    // Check if address is within service area
    const serviceAreaCheck = isInServiceArea(city, state, zipcode);
    const outsideServiceArea = !serviceAreaCheck.isServiceable;

    let cleanersNeeded = getCleanersNeeded(numBeds, numBaths);

    const userInfo = await UserInfo.editHomeInDB({
      id,
      nickName,
      address,
      city,
      state,
      zipcode,
      numBeds,
      numBaths,
      sheetsProvided,
      towelsProvided,
      keyPadCode,
      keyLocation,
      recyclingLocation,
      compostLocation,
      trashLocation,
      contact,
      specialNotes,
      cleanersNeeded,
      timeToBeCompleted,
      outsideServiceArea,
      cleanSheetsLocation,
      dirtySheetsLocation,
      cleanTowelsLocation,
      dirtyTowelsLocation,
      bedConfigurations,
      bathroomConfigurations,
    });

    return res.status(200).json({
      user: userInfo,
      outsideServiceArea,
      serviceAreaMessage: outsideServiceArea ? serviceAreaCheck.message : null,
    });
  } catch (error) {
    console.error(error);

    if (error.name === "TokenExpiredError") {
      return res.status(401).json({ error: "Token has expired" });
    }

    return res.status(401).json({ error: "Invalid token" });
  }
});

// PATCH /home/:id/complete-setup - Complete home setup for invited clients
userInfoRouter.patch("/home/:id/complete-setup", async (req, res) => {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) {
    return res.status(401).json({ error: "Authorization token required" });
  }

  try {
    const decodedToken = jwt.verify(token, secretKey);
    const userId = decodedToken.userId;
    const homeId = parseInt(req.params.id, 10);

    // Find the home and verify ownership
    const home = await UserHomes.findByPk(homeId);
    if (!home) {
      return res.status(404).json({ error: "Home not found" });
    }

    if (home.userId !== userId) {
      return res.status(403).json({ error: "You don't have permission to update this home" });
    }

    const {
      keyPadCode,
      keyLocation,
      trashLocation,
      recyclingLocation,
      compostLocation,
      sheetsProvided,
      towelsProvided,
      cleanSheetsLocation,
      dirtySheetsLocation,
      cleanTowelsLocation,
      dirtyTowelsLocation,
      bedConfigurations,
      bathroomConfigurations,
      contact,
    } = req.body;

    // Validate required fields
    const errors = [];

    // Must have at least one access method
    if (!keyPadCode && !keyLocation) {
      errors.push("Please provide either a keypad code or key location for access");
    }

    // Trash location is required
    if (!trashLocation) {
      errors.push("Trash location is required");
    }

    // Linen preferences are required
    if (sheetsProvided === undefined || sheetsProvided === null) {
      errors.push("Please indicate whether sheets are provided");
    }

    if (towelsProvided === undefined || towelsProvided === null) {
      errors.push("Please indicate whether towels are provided");
    }

    // If sheets are NOT provided by homeowner (company brings them), need bed configurations
    if (sheetsProvided === "no" || sheetsProvided === false) {
      if (!bedConfigurations || !Array.isArray(bedConfigurations) || bedConfigurations.length === 0) {
        errors.push("Bed configurations are required when we bring sheets");
      }
    }

    // If sheets ARE provided by homeowner, need clean/dirty locations
    if (sheetsProvided === "yes" || sheetsProvided === true) {
      if (!cleanSheetsLocation || !dirtySheetsLocation) {
        errors.push("Please provide clean and dirty sheet locations");
      }
    }

    // If towels are NOT provided by homeowner (company brings them), need bathroom configurations
    if (towelsProvided === "no" || towelsProvided === false) {
      if (!bathroomConfigurations || !Array.isArray(bathroomConfigurations) || bathroomConfigurations.length === 0) {
        errors.push("Bathroom configurations are required when we bring towels");
      }
    }

    // If towels ARE provided by homeowner, need clean/dirty locations
    if (towelsProvided === "yes" || towelsProvided === true) {
      if (!cleanTowelsLocation || !dirtyTowelsLocation) {
        errors.push("Please provide clean and dirty towel locations");
      }
    }

    if (errors.length > 0) {
      return res.status(400).json({ error: errors.join(". ") });
    }

    // Calculate cleaners needed based on beds/baths
    const cleanersNeeded = getCleanersNeeded(home.numBeds, home.numBaths);

    // Update the home with all the setup data
    await home.update({
      keyPadCode: keyPadCode || null,
      keyLocation: keyLocation || null,
      trashLocation,
      recyclingLocation: recyclingLocation || null,
      compostLocation: compostLocation || null,
      sheetsProvided,
      towelsProvided,
      cleanSheetsLocation: cleanSheetsLocation || null,
      dirtySheetsLocation: dirtySheetsLocation || null,
      cleanTowelsLocation: cleanTowelsLocation || null,
      dirtyTowelsLocation: dirtyTowelsLocation || null,
      bedConfigurations: bedConfigurations || null,
      bathroomConfigurations: bathroomConfigurations || null,
      contact: contact || home.contact,
      cleanersNeeded,
      isSetupComplete: true,
    });

    // Fetch the updated home to get decrypted values
    const updatedHome = await UserHomes.findByPk(homeId);
    const serializedHome = HomeSerializer.serializeOne(updatedHome);

    console.log(`✅ Home ${homeId} setup completed for user ${userId}`);

    return res.status(200).json({
      success: true,
      home: serializedHome,
      message: "Home setup completed successfully",
    });
  } catch (error) {
    console.error("Error completing home setup:", error);
    if (error.name === "TokenExpiredError") {
      return res.status(401).json({ error: "Token has expired" });
    }
    if (error.name === "JsonWebTokenError") {
      return res.status(401).json({ error: "Invalid token" });
    }
    return res.status(500).json({ error: "Failed to complete home setup" });
  }
});

userInfoRouter.delete("/home", async (req, res) => {
  const id = req.body.id;
  try {
    const today = new Date();
    const oneWeekFromToday = new Date(today);
    let price = 0;
    oneWeekFromToday.setDate(oneWeekFromToday.getDate() + 7);

    const homeToDelete = await UserHomes.findAll({
      where: {
        id: id,
      },
    });

    const billToUpdate = await UserBills.findOne({
      where: {
        userId: homeToDelete[0].dataValues.userId,
      },
    });

    const oldAppt = Number(billToUpdate.dataValues.appointmentDue);
    const total =
      Number(billToUpdate.dataValues.cancellationFee) +
      Number(billToUpdate.dataValues.appointmentDue);

    const appointmentsWithinWeek = await UserAppointments.findAll({
      where: {
        homeId: id,
        date: {
          [Op.between]: [today, oneWeekFromToday],
        },
      },
    });

    if (appointmentsWithinWeek.length > 0) {
      const pricing = await getPricingConfig();
      const cancellationFeePerAppt = pricing?.cancellation?.fee ?? 25;
      const cancellationFee = cancellationFeePerAppt * appointmentsWithinWeek.length;
      const oldFee = Number(billToUpdate.dataValues.cancellationFee);

      const total =
        Number(billToUpdate.dataValues.cancellationFee) +
        Number(billToUpdate.dataValues.appointmentDue);

      await billToUpdate.update({
        cancellationFee: oldFee + cancellationFee,
        totalDue: total + cancellationFee,
      });
    }

    const allAppointmentsToDelete = await UserAppointments.findAll({
      where: {
        homeId: id,
      },
    });

    // Only count unpaid appointments
    let unpaidPrice = 0;
    allAppointmentsToDelete.forEach((appt) => {
      if (!appt.dataValues.paid) {
        unpaidPrice += Number(appt.dataValues.price);
      }
    });

    // Ensure values don't go negative
    const newAppointmentDue = Math.max(0, oldAppt - unpaidPrice);
    const newTotalDue = Math.max(0, Number(billToUpdate.dataValues.cancellationFee) + newAppointmentDue);

    await billToUpdate.update({
      appointmentDue: newAppointmentDue,
      totalDue: newTotalDue,
    });

    await UserAppointments.destroy({
      where: {
        homeId: id,
      },
    });

    const deleteHome = await UserInfo.deleteHomeInfo(id);
    return res.status(201).json({ message: "home deleted" });
  } catch (error) {
    console.log(error);
    return res.status(401).json({ error: "Invalid or expired token" });
  }
});

/**
 * PUT /service-area
 * Update cleaner's service area location for last-minute booking notifications
 */
userInfoRouter.put("/service-area", async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Authorization token required" });
  }

  try {
    const token = authHeader.split(" ")[1];
    const decoded = jwt.verify(token, secretKey);
    const user = await User.findByPk(decoded.userId);

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    if (user.type !== "cleaner") {
      return res.status(403).json({ error: "Only cleaners can set service area" });
    }

    const { address, latitude, longitude, radiusMiles } = req.body;

    if (!latitude || !longitude) {
      return res.status(400).json({ error: "Latitude and longitude are required" });
    }

    // Validate coordinates
    const lat = parseFloat(latitude);
    const lon = parseFloat(longitude);
    if (isNaN(lat) || isNaN(lon) || lat < -90 || lat > 90 || lon < -180 || lon > 180) {
      return res.status(400).json({ error: "Invalid coordinates" });
    }

    // Update user's service area
    await user.update({
      serviceAreaAddress: address || null,
      serviceAreaLatitude: String(latitude),
      serviceAreaLongitude: String(longitude),
      serviceAreaRadiusMiles: radiusMiles || 30,
    });

    res.json({
      success: true,
      message: "Service area updated successfully",
      serviceArea: {
        address: address || null,
        radiusMiles: radiusMiles || 30,
        // Don't return exact coordinates for privacy
        hasLocation: true,
      },
    });
  } catch (error) {
    console.error("[UserInfo] Error updating service area:", error);
    if (error.name === "JsonWebTokenError") {
      return res.status(401).json({ error: "Invalid token" });
    }
    res.status(500).json({ error: "Failed to update service area" });
  }
});

/**
 * GET /service-area
 * Get cleaner's current service area settings
 */
userInfoRouter.get("/service-area", async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Authorization token required" });
  }

  try {
    const token = authHeader.split(" ")[1];
    const decoded = jwt.verify(token, secretKey);
    const user = await User.findByPk(decoded.userId);

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    if (user.type !== "cleaner") {
      return res.status(403).json({ error: "Only cleaners can view service area" });
    }

    res.json({
      serviceArea: {
        address: user.serviceAreaAddress || null,
        radiusMiles: parseFloat(user.serviceAreaRadiusMiles) || 30,
        hasLocation: !!(user.serviceAreaLatitude && user.serviceAreaLongitude),
      },
    });
  } catch (error) {
    console.error("[UserInfo] Error getting service area:", error);
    if (error.name === "JsonWebTokenError") {
      return res.status(401).json({ error: "Invalid token" });
    }
    res.status(500).json({ error: "Failed to get service area" });
  }
});

module.exports = userInfoRouter;
