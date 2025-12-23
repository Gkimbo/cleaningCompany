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
  const token = req.headers.authorization.split(" ")[1];
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
      const cancellationFeePerAppt = pricing.cancellation?.fee || 25;
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

    const prices = allAppointmentsToDelete.map((appt) => {
      price += Number(appt.dataValues.price);
    });

    await billToUpdate.update({
      appointmentDue: oldAppt - price,
      totalDue: total - price,
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
