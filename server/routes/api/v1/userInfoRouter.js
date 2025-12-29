const express = require("express");
const jwt = require("jsonwebtoken");
const UserSerializer = require("../../../serializers/userSerializer");
const UserInfo = require("../../../services/UserInfoClass");
const {
  User,
  UserHomes,
  UserAppointments,
  UserBills,
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
        },
        {
          model: UserBills,
          as: "bills",
        },
      ],
    });
    let serializedUser = UserSerializer.serializeOne(user.dataValues);
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

module.exports = userInfoRouter;
