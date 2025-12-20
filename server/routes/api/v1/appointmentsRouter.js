const express = require("express");
const jwt = require("jsonwebtoken");
const {
  User,
  UserAppointments,
  UserHomes,
  UserBills,
  UserCleanerAppointments,
  UserPendingRequests,
  UserReviews,
  Payout,
} = require("../../../models");
const AppointmentSerializer = require("../../../serializers/AppointmentSerializer");
const UserInfo = require("../../../services/UserInfoClass");
const calculatePrice = require("../../../services/CalculatePrice");
const HomeSerializer = require("../../../serializers/homesSerializer");
const { emit } = require("nodemon");
const Email = require("../../../services/sendNotifications/EmailClass");

const appointmentRouter = express.Router();
const secretKey = process.env.SESSION_SECRET;

appointmentRouter.get("/unassigned", async (req, res) => {
  const token = req.headers.authorization.split(" ")[1];
  try {
    const userAppointments = await UserAppointments.findAll({
      where: { hasBeenAssigned: false },
    });
    const serializedAppointments =
      AppointmentSerializer.serializeArray(userAppointments);

    return res.status(200).json({ appointments: serializedAppointments });
  } catch (error) {
    console.error(error);
    return res.status(401).json({ error: "Invalid or expired token" });
  }
});

appointmentRouter.get("/unassigned/:id", async (req, res) => {
  const token = req.headers.authorization.split(" ")[1];
  const { id } = req.params;
  let employees = [];

  try {
    const userAppointments = await UserAppointments.findOne({
      where: { id: id },
    });
    const employeesAssigned = await UserCleanerAppointments.findAll({
      where: {
        appointmentId: id,
      },
    });
    if (employeesAssigned) {
      employees = employeesAssigned.map((employeeId) => {
        return employeeId.dataValues.employeeId;
      });
    }
    const serializedAppointment =
      AppointmentSerializer.serializeOne(userAppointments);

    return res.status(200).json({
      appointment: serializedAppointment,
      employeesAssigned: employees,
    });
  } catch (error) {
    console.error(error);
    return res.status(401).json({ error: "Invalid or expired token" });
  }
});

const { Op } = require("sequelize");
const UserSerializer = require("../../../serializers/userSerializer");
const RequestSerializer = require("../../../serializers/RequestsSerializer");

appointmentRouter.get("/my-requests", async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({ error: "Authorization token required" });
    }

    const token = authHeader.split(" ")[1];
    const decodedToken = jwt.verify(token, secretKey);
    const userId = decodedToken.userId;

    const existingAppointments = await UserAppointments.findAll({
      where: { userId },
    });

    if (!existingAppointments.length) {
      return res.status(404).json({ message: "No appointments found" });
    }

    const appointmentIds = existingAppointments.map(
      (appointment) => appointment.id
    );

    const pendingRequests = await UserPendingRequests.findAll({
      where: { appointmentId: { [Op.in]: appointmentIds } },
    });

    if (!pendingRequests.length) {
      return res.status(200).json({ pendingRequestsEmployee: [] });
    }

    const pendingRequestsEmployee = await Promise.all(
      pendingRequests.map(async (request) => {
        const appointment = existingAppointments.find(
          (appointment) =>
            appointment.dataValues.id === request.dataValues.appointmentId
        );

        const employeeRequesting = await User.findOne({
          where: { id: request.dataValues.employeeId },
          include: [
            {
              model: UserReviews,
              as: "reviews",
            },
          ],
        });

        const serializedAppointment =
          AppointmentSerializer.serializeOne(appointment);
        const serializedEmployee =
          UserSerializer.serializeOne(employeeRequesting);
        const serializedRequest = RequestSerializer.serializeOne(request);

        return {
          request: serializedRequest,
          appointment: serializedAppointment,
          employeeRequesting: serializedEmployee,
        };
      })
    );

    return res.status(200).json({ pendingRequestsEmployee });
  } catch (error) {
    console.error("Error fetching my requests:", error);
    return res.status(401).json({ error: "Invalid or expired token" });
  }
});

// Get pending request counts grouped by home for homeowner
appointmentRouter.get("/requests-by-home", async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({ error: "Authorization token required" });
    }

    const token = authHeader.split(" ")[1];
    const decodedToken = jwt.verify(token, secretKey);
    const userId = decodedToken.userId;

    // Get all appointments for this homeowner
    const existingAppointments = await UserAppointments.findAll({
      where: { userId },
    });

    if (!existingAppointments.length) {
      return res.status(200).json({ requestCountsByHome: {} });
    }

    const appointmentIds = existingAppointments.map((apt) => apt.id);

    // Get all pending requests for these appointments
    const pendingRequests = await UserPendingRequests.findAll({
      where: {
        appointmentId: { [Op.in]: appointmentIds },
        status: "pending"
      },
    });

    // Group counts by homeId
    const requestCountsByHome = {};
    pendingRequests.forEach((request) => {
      const appointment = existingAppointments.find(
        (apt) => apt.id === request.appointmentId
      );
      if (appointment) {
        const homeId = appointment.homeId;
        requestCountsByHome[homeId] = (requestCountsByHome[homeId] || 0) + 1;
      }
    });

    return res.status(200).json({ requestCountsByHome });
  } catch (error) {
    console.error("Error fetching requests by home:", error);
    return res.status(401).json({ error: "Invalid or expired token" });
  }
});

// Get all pending requests for a client (homeowner) with details
appointmentRouter.get("/client-pending-requests", async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({ error: "Authorization token required" });
    }

    const token = authHeader.split(" ")[1];
    const decodedToken = jwt.verify(token, secretKey);
    const userId = decodedToken.userId;

    // Get all homes for this user
    const homes = await UserHomes.findAll({
      where: { userId },
    });

    if (!homes.length) {
      return res.status(200).json({ totalCount: 0, requestsByHome: [] });
    }

    // Get all appointments for this user
    const existingAppointments = await UserAppointments.findAll({
      where: { userId },
    });

    if (!existingAppointments.length) {
      return res.status(200).json({ totalCount: 0, requestsByHome: [] });
    }

    const appointmentIds = existingAppointments.map((apt) => apt.id);

    // Get all pending requests for these appointments
    const pendingRequests = await UserPendingRequests.findAll({
      where: {
        appointmentId: { [Op.in]: appointmentIds },
        status: "pending"
      },
    });

    if (!pendingRequests.length) {
      return res.status(200).json({ totalCount: 0, requestsByHome: [] });
    }

    // Group requests by home with full details
    const homeMap = {};
    for (const home of homes) {
      homeMap[home.id] = {
        home: HomeSerializer.serializeOne(home),
        requests: [],
      };
    }

    for (const request of pendingRequests) {
      const appointment = existingAppointments.find(
        (apt) => apt.id === request.appointmentId
      );
      if (appointment && homeMap[appointment.homeId]) {
        const cleaner = await User.findOne({
          where: { id: request.employeeId },
          include: [
            {
              model: UserReviews,
              as: "reviews",
            },
          ],
        });

        homeMap[appointment.homeId].requests.push({
          request: RequestSerializer.serializeOne(request),
          appointment: AppointmentSerializer.serializeOne(appointment),
          cleaner: UserSerializer.serializeOne(cleaner),
        });
      }
    }

    // Filter out homes with no requests and convert to array
    const requestsByHome = Object.values(homeMap).filter(
      (item) => item.requests.length > 0
    );

    return res.status(200).json({
      totalCount: pendingRequests.length,
      requestsByHome,
    });
  } catch (error) {
    console.error("Error fetching client pending requests:", error);
    return res.status(401).json({ error: "Invalid or expired token" });
  }
});

// Get pending requests for a specific home
appointmentRouter.get("/requests-for-home/:homeId", async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({ error: "Authorization token required" });
    }

    const token = authHeader.split(" ")[1];
    const decodedToken = jwt.verify(token, secretKey);
    const userId = decodedToken.userId;
    const { homeId } = req.params;

    // Verify the home belongs to this user
    const home = await UserHomes.findOne({
      where: { id: homeId, userId },
    });

    if (!home) {
      return res.status(404).json({ error: "Home not found" });
    }

    // Get all appointments for this home
    const appointments = await UserAppointments.findAll({
      where: { homeId, userId },
    });

    if (!appointments.length) {
      return res.status(200).json({ requests: [] });
    }

    const appointmentIds = appointments.map((apt) => apt.id);

    // Get all pending requests for these appointments
    const pendingRequests = await UserPendingRequests.findAll({
      where: {
        appointmentId: { [Op.in]: appointmentIds },
        status: "pending"
      },
    });

    if (!pendingRequests.length) {
      return res.status(200).json({ requests: [] });
    }

    // Build response with appointment and cleaner details
    const requests = await Promise.all(
      pendingRequests.map(async (request) => {
        const appointment = appointments.find(
          (apt) => apt.id === request.appointmentId
        );

        const cleaner = await User.findOne({
          where: { id: request.employeeId },
          include: [
            {
              model: UserReviews,
              as: "reviews",
            },
          ],
        });

        const serializedAppointment = AppointmentSerializer.serializeOne(appointment);
        const serializedCleaner = UserSerializer.serializeOne(cleaner);
        const serializedRequest = RequestSerializer.serializeOne(request);

        return {
          request: serializedRequest,
          appointment: serializedAppointment,
          cleaner: serializedCleaner,
        };
      })
    );

    return res.status(200).json({ requests, home: HomeSerializer.serializeOne(home) });
  } catch (error) {
    console.error("Error fetching requests for home:", error);
    return res.status(401).json({ error: "Invalid or expired token" });
  }
});

appointmentRouter.get("/:homeId", async (req, res) => {
  const { homeId } = req.params;
  try {
    const appointments = await UserAppointments.findAll({
      where: {
        homeId: homeId,
      },
    });
    const serializedAppointments =
      AppointmentSerializer.serializeArray(appointments);
    return res.status(200).json({ appointments: serializedAppointments });
  } catch (error) {
    console.log(error);
    return res.status(401).json({ error: "Invalid or expired token" });
  }
});

appointmentRouter.get("/home/:homeId", async (req, res) => {
  const { homeId } = req.params;
  try {
    const home = await UserHomes.findAll({
      where: {
        id: homeId,
      },
    });
    const serializedHome = HomeSerializer.serializeArray(home);

    return res.status(200).json({ home: serializedHome });
  } catch (error) {
    console.log(error);
    return res.status(401).json({ error: "Invalid or expired token" });
  }
});

appointmentRouter.post("/", async (req, res) => {
  const { token, homeId, dateArray, keyPadCode, keyLocation } = req.body;
  let appointmentTotal = 0;
  const home = await UserHomes.findOne({ where: { id: homeId } });

  // Check if home exists
  if (!home) {
    return res.status(404).json({ error: "Home not found" });
  }

  // Check if home is outside service area
  if (home.dataValues.outsideServiceArea) {
    return res.status(403).json({
      error: "Booking is not available for homes outside our service area"
    });
  }

  // Verify user has a payment method set up
  try {
    const decodedToken = jwt.verify(token, secretKey);
    const userId = decodedToken.userId;
    const user = await User.findByPk(userId);

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    if (!user.hasPaymentMethod) {
      return res.status(403).json({
        error: "Payment method required. Please add a payment method before booking appointments."
      });
    }
  } catch (tokenError) {
    return res.status(401).json({ error: "Invalid or expired token" });
  }

  dateArray.forEach((date) => {
    // Use configurations if provided, otherwise fall back to home defaults
    const sheetConfigs = date.sheetConfigurations || home.dataValues.bedConfigurations;
    const towelConfigs = date.towelConfigurations || home.dataValues.bathroomConfigurations;

    const price = calculatePrice(
      date.bringSheets,
      date.bringTowels,
      home.dataValues.numBeds,
      home.dataValues.numBaths,
      home.dataValues.timeToBeCompleted,
      sheetConfigs,
      towelConfigs
    );
    date.price = price;
    date.sheetConfigurations = sheetConfigs;
    date.towelConfigurations = towelConfigs;
    appointmentTotal += price;
  });
  try {
    const decodedToken = jwt.verify(token, secretKey);
    const userId = decodedToken.userId;
    const existingBill = await UserBills.findOne({
      where: { userId },
    });
    const oldAppt = existingBill.dataValues.appointmentDue;
    const total =
      existingBill.dataValues.cancellationFee +
      existingBill.dataValues.appointmentDue;

    await existingBill.update({
      appointmentDue: oldAppt + appointmentTotal,
      totalDue: total + appointmentTotal,
    });

    const appointments = await Promise.all(
      dateArray.map(async (date) => {
        const homeBeingScheduled = await UserHomes.findOne({
          where: { id: homeId },
        });
        let bringSheets = date.bringSheets
        let bringTowels = date.bringTowels
        let paid = date.paid

        if(!date.bringSheets){
          bringSheets = "no"
        }
        if(!date.bringTowels){
          bringTowels = "no"
        }
        if(!paid){
          paid = false
        }

        const newAppointment = await UserAppointments.create({
          userId,
          homeId,
          date: date.date,
          price: date.price,
          paid,
          bringTowels,
          bringSheets,
          keyPadCode,
          keyLocation,
          completed: false,
          hasBeenAssigned: false,
          empoyeesNeeded: homeBeingScheduled.dataValues.cleanersNeeded,
          timeToBeCompleted: homeBeingScheduled.dataValues.timeToBeCompleted,
          sheetConfigurations: date.sheetConfigurations || null,
          towelConfigurations: date.towelConfigurations || null,
        });
        const appointmentId = newAppointment.dataValues.id;

        const day = new Date(date.date);
        const daysOfWeek = [
          "Monday",
          "Tuesday",
          "Wednesday",
          "Thursday",
          "Friday",
          "Saturday",
          "Sunday",
        ];
        const dayOfWeekIndex = day.getDay();
        const dayOfWeek = daysOfWeek[dayOfWeekIndex];
      })
    );

    return res.status(201).json({ appointments });
  } catch (error) {
    console.error(error);
    return res.status(401).json({ error: "Invalid or expired token" });
  }
});

// Update appointment linens
appointmentRouter.patch("/:id/linens", async (req, res) => {
  const { id } = req.params;
  const {
    sheetConfigurations,
    towelConfigurations,
    bringSheets,
    bringTowels,
  } = req.body;

  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({ error: "Authorization token required" });
    }

    const token = authHeader.split(" ")[1];
    const decodedToken = jwt.verify(token, secretKey);
    const userId = decodedToken.userId;

    const appointment = await UserAppointments.findOne({
      where: { id },
    });

    if (!appointment) {
      return res.status(404).json({ error: "Appointment not found" });
    }

    // Verify user owns this appointment
    if (appointment.dataValues.userId !== userId) {
      return res.status(403).json({ error: "Not authorized to update this appointment" });
    }

    // Get home info to recalculate price
    const home = await UserHomes.findOne({
      where: { id: appointment.dataValues.homeId },
    });

    // Calculate new price
    const newPrice = calculatePrice(
      bringSheets,
      bringTowels,
      home.dataValues.numBeds,
      home.dataValues.numBaths,
      appointment.dataValues.timeToBeCompleted,
      sheetConfigurations,
      towelConfigurations
    );

    // Update appointment and bill using the service method
    const updatedAppointment = await UserInfo.editAppointmentLinensInDB({
      id,
      sheetConfigurations,
      towelConfigurations,
      bringSheets,
      bringTowels,
      newPrice,
    });

    const serializedAppointment = AppointmentSerializer.serializeOne(updatedAppointment);
    return res.status(200).json({ appointment: serializedAppointment });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Failed to update appointment linens" });
  }
});

appointmentRouter.delete("/:id", async (req, res) => {
  const { id } = req.params;
  const { fee, user } = req.body;
  try {
    const decodedToken = jwt.verify(user, secretKey);
    const userId = decodedToken.userId;
    const existingBill = await UserBills.findOne({
      where: { userId },
    });

    const appointmentToDelete = await UserAppointments.findOne({
      where: { id: id },
    });
    const appointmentTotal = Number(appointmentToDelete.dataValues.price);
    const oldFee = Number(existingBill.dataValues.cancellationFee);
    const oldAppt = Number(existingBill.dataValues.appointmentDue);

    const total =
      Number(existingBill.dataValues.cancellationFee) +
      Number(existingBill.dataValues.appointmentDue);

    await existingBill.update({
      cancellationFee: oldFee + fee,
      appointmentDue: oldAppt - appointmentTotal,
      totalDue: total + fee - appointmentTotal,
    });
    const connectionsToDelete = await UserCleanerAppointments.destroy({
      where: { appointmentId: id },
    });

    const deletedAppointmentInfo = await UserAppointments.destroy({
      where: { id: id },
    });

    return res.status(201).json({ message: "Appointment Deleted" });
  } catch (error) {
    console.error(error);
    return res.status(401).json({ error: "Invalid or expired token" });
  }
});

appointmentRouter.delete("/id/:id", async (req, res) => {
  const { id } = req.params;
  try {
    const appointmentToDelete = await UserAppointments.findOne({
      where: { id: id },
    });

    const connectionsToDelete = await UserCleanerAppointments.destroy({
      where: { appointmentId: id },
    });

    const deletedAppointmentInfo = await UserAppointments.destroy({
      where: { id: id },
    });

    return res.status(201).json({ message: "Appointment Deleted" });
  } catch (error) {
    console.error(error);
    return res.status(401).json({ error: "Invalid or expired token" });
  }
});

appointmentRouter.patch("/remove-employee", async (req, res) => {
  const { id, appointmentId } = req.body;
  let userInfo;
  try {
    const checkItExists = await UserCleanerAppointments.findOne({
      where: {
        employeeId: id,
        appointmentId: Number(appointmentId),
      },
    });
    if (checkItExists) {
      await UserCleanerAppointments.destroy({
        where: {
          employeeId: id,
          appointmentId: Number(appointmentId),
        },
      });

      const updateAppointment = await UserAppointments.findOne({
        where: {
          id: Number(appointmentId),
        },
      });

      const bookingClientId = updateAppointment.dataValues.userId;
      const homeId = updateAppointment.dataValues.homeId;
      const appointmentDate = updateAppointment.dataValues.date;

      if (updateAppointment) {
        let employees = Array.isArray(
          updateAppointment?.dataValues?.employeesAssigned
        )
          ? [...updateAppointment.dataValues.employeesAssigned]
          : [];

        const updatedEmployees = employees.filter(
          (empId) => empId !== String(id)
        );

        if (updatedEmployees.length !== employees.length) {
          await updateAppointment.update({
            employeesAssigned: updatedEmployees,
            hasBeenAssigned: false,
          });
        }
      }

      let clientEmail;
      let clientUserName;
      let phoneNumber;
      let address;

      if (bookingClientId) {
        const id = Number(bookingClientId);
        const bookingClient = await User.findOne({
          where: {
            id: id,
          },
        });
        clientEmail = bookingClient.dataValues.email;
        clientUserName = bookingClient.dataValues.username;
      }
      if (homeId) {
        const id = Number(homeId);
        const home = await UserHomes.findOne({
          where: {
            id: id,
          },
        });
        phoneNumber = home.dataValues.contact;
        address = {
          street: home.dataValues.address,
          city: home.dataValues.city,
          state: home.dataValues.state,
          zipcode: home.dataValues.zipcode,
        };
      }
      await Email.sendEmailCancellation(
        clientEmail,
        address,
        clientUserName,
        appointmentDate
      );
    }

    return res.status(200).json({ user: userInfo });
  } catch (error) {
    console.error(error);

    if (error.name === "TokenExpiredError") {
      return res.status(401).json({ error: "Token has expired" });
    }

    return res.status(401).json({ error: "Invalid token" });
  }
});

appointmentRouter.patch("/request-employee", async (req, res) => {
  const { id, appointmentId } = req.body;

  try {
    const appointment = await UserAppointments.findByPk(Number(appointmentId));
    if (!appointment) {
      return res.status(404).json({ error: "Appointment not found" });
    }

    const client = await User.findByPk(appointment.dataValues.userId);
    if (!client) {
      return res.status(404).json({ error: "Client not found" });
    }

    const cleaner = await User.findByPk(id);
    if (!cleaner) {
      return res.status(404).json({ error: "Cleaner not found" });
    }

    const existingRequest = await UserPendingRequests.findOne({
      where: { employeeId: id, appointmentId: Number(appointmentId) },
    });
    if (existingRequest) {
      return res
        .status(400)
        .json({ error: "Request already sent to the client" });
    }

    await UserPendingRequests.create({
      employeeId: id,
      appointmentId: Number(appointmentId),
      status: "pending",
    });

    const allReviews = await UserReviews.findAll({
      where: { userId: cleaner.dataValues.id },
    });

    const getAverageRating = () => {
      if (allReviews.length === 0) return "No ratings yet";
      const totalRating = allReviews.reduce(
        (sum, review) => sum + review.dataValues.rating,
        0
      );
      return (totalRating / allReviews.length).toFixed(1);
    };

    const averageRating = getAverageRating();

    await Email.sendEmployeeRequest(
      client.dataValues.email,
      client.dataValues.username,
      cleaner.dataValues.username,
      averageRating,
      appointment.dataValues.date
    );

    return res
      .status(200)
      .json({ message: "Request sent to the client for approval" });
  } catch (error) {
    console.error("❌ Server error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

appointmentRouter.patch("/approve-request", async (req, res) => {
  const { requestId, approve } = req.body;
  try {
    const request = await UserPendingRequests.findOne({
      where: { id: requestId },
    });
    if (!request) {
      return res.status(404).json({ error: "Request not found" });
    }

    if (approve) {
      await UserCleanerAppointments.create({
        employeeId: request.dataValues.employeeId,
        appointmentId: request.dataValues.appointmentId,
      });

      const appointment = await UserAppointments.findOne({
        where: { id: request.dataValues.appointmentId },
      });

      let employees = appointment.dataValues.employeesAssigned || [];
      if (!employees.includes(String(request.dataValues.employeeId))) {
        employees.push(String(request.dataValues.employeeId));
      }

      await appointment.update({
        employeesAssigned: employees,
        hasBeenAssigned: true,
      });

      // Create payout record for the approved cleaner
      const cleanerId = request.dataValues.employeeId;
      const appointmentId = request.dataValues.appointmentId;
      const cleanerCount = employees.length;
      const priceInCents = Math.round(parseFloat(appointment.dataValues.price) * 100);
      const perCleanerGross = Math.round(priceInCents / cleanerCount);
      const platformFee = Math.round(perCleanerGross * 0.10); // 10% platform fee
      const netAmount = perCleanerGross - platformFee; // 90% to cleaner

      // Check if payout record already exists
      const existingPayout = await Payout.findOne({
        where: { appointmentId, cleanerId },
      });

      if (!existingPayout) {
        await Payout.create({
          appointmentId,
          cleanerId,
          grossAmount: perCleanerGross,
          platformFee,
          netAmount,
          status: "pending", // Will change to "held" when payment is captured
        });
      }

      // Update existing payout records for other cleaners (recalculate split)
      if (cleanerCount > 1) {
        for (const empId of employees) {
          if (String(empId) !== String(cleanerId)) {
            const existingOtherPayout = await Payout.findOne({
              where: { appointmentId, cleanerId: empId },
            });
            if (existingOtherPayout && existingOtherPayout.status === "pending") {
              const updatedGross = Math.round(priceInCents / cleanerCount);
              const updatedFee = Math.round(updatedGross * 0.10);
              const updatedNet = updatedGross - updatedFee;
              await existingOtherPayout.update({
                grossAmount: updatedGross,
                platformFee: updatedFee,
                netAmount: updatedNet,
              });
            }
          }
        }
      }

      // Send email and in-app notification to the cleaner
      const cleaner = await User.findByPk(cleanerId);
      const homeowner = await User.findByPk(appointment.dataValues.userId);
      const home = await UserHomes.findByPk(appointment.dataValues.homeId);

      if (cleaner && homeowner && home) {
        // Send email notification
        const address = {
          street: home.dataValues.address,
          city: home.dataValues.city,
          state: home.dataValues.state,
          zipcode: home.dataValues.zipcode,
        };
        await Email.sendRequestApproved(
          cleaner.dataValues.email,
          cleaner.dataValues.username,
          homeowner.dataValues.username,
          address,
          appointment.dataValues.date
        );

        // Add in-app notification
        const notifications = cleaner.dataValues.notifications || [];
        const formattedDate = new Date(appointment.dataValues.date).toLocaleDateString(undefined, {
          weekday: "long",
          month: "short",
          day: "numeric",
          year: "numeric",
        });
        notifications.unshift(`Your cleaning request for ${formattedDate} at ${home.dataValues.address} has been approved!`);
        await cleaner.update({ notifications: notifications.slice(0, 50) }); // Keep last 50 notifications
      }

      await request.destroy();

      return res.status(200).json({ message: "Cleaner assigned successfully" });
    } else {
      await request.destroy();
      return res.status(200).json({ message: "Request denied" });
    }
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Server error" });
  }
});

appointmentRouter.patch("/deny-request", async (req, res) => {
  const { id, appointmentId } = req.body;
  try {
    const request = await UserPendingRequests.findOne({
      where: { appointmentId: Number(appointmentId), employeeId: Number(id) },
    });

    if (!request) {
      return res.status(404).json({ error: "Request not found" });
    }

    const appointment = await UserAppointments.findByPk(Number(appointmentId));
    if (!appointment) {
      return res.status(404).json({ error: "Appointment not found" });
    }

    const client = await User.findByPk(appointment.dataValues.userId);
    if (!client) {
      return res.status(404).json({ error: "Client not found" });
    }

    const cleaner = await User.findByPk(id);
    if (!cleaner) {
      return res.status(404).json({ error: "Cleaner not found" });
    }

    const removedRequestData = request.get();
    await request.destroy();

    // Send denial notification to the cleaner (not the homeowner)
    await Email.sendRequestDenied(
      cleaner.dataValues.email,
      cleaner.dataValues.username,
      appointment.dataValues.date
    );

    // Add in-app notification to cleaner
    const home = await UserHomes.findByPk(appointment.dataValues.homeId);
    const notifications = cleaner.dataValues.notifications || [];
    const formattedDate = new Date(appointment.dataValues.date).toLocaleDateString(undefined, {
      weekday: "long",
      month: "short",
      day: "numeric",
      year: "numeric",
    });
    notifications.unshift(`Your cleaning request for ${formattedDate} was not approved. Check out other available appointments!`);
    await cleaner.update({ notifications: notifications.slice(0, 50) });

    return res.status(200).json({
      message: "Request removed",
      removedRequest: removedRequestData,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Server error" });
  }
});

appointmentRouter.patch("/undo-request-choice", async (req, res) => {
  const { id, appointmentId } = req.body;
  let userInfo;
  try {
    const checkItExists = await UserCleanerAppointments.findOne({
      where: {
        employeeId: id,
        appointmentId: Number(appointmentId),
      },
    });
    if (checkItExists) {
      await UserCleanerAppointments.destroy({
        where: {
          employeeId: id,
          appointmentId: Number(appointmentId),
        },
      });

      const updateAppointment = await UserAppointments.findOne({
        where: {
          id: Number(appointmentId),
        },
      });

      const bookingClientId = updateAppointment.dataValues.userId;
      const homeId = updateAppointment.dataValues.homeId;
      const appointmentDate = updateAppointment.dataValues.date;

      if (updateAppointment) {
        let employees = Array.isArray(
          updateAppointment?.dataValues?.employeesAssigned
        )
          ? [...updateAppointment.dataValues.employeesAssigned]
          : [];

        const updatedEmployees = employees.filter(
          (empId) => empId !== String(id)
        );

        if (updatedEmployees.length !== employees.length) {
          await updateAppointment.update({
            employeesAssigned: updatedEmployees,
            hasBeenAssigned: false,
          });
        }
      }

      let clientEmail;
      let clientUserName;
      let phoneNumber;
      let address;

      if (bookingClientId) {
        const id = Number(bookingClientId);
        const bookingClient = await User.findOne({
          where: {
            id: id,
          },
        });
        clientEmail = bookingClient.dataValues.email;
        clientUserName = bookingClient.dataValues.username;
      }
      if (homeId) {
        const id = Number(homeId);
        const home = await UserHomes.findOne({
          where: {
            id: id,
          },
        });
        phoneNumber = home.dataValues.contact;
        address = {
          street: home.dataValues.address,
          city: home.dataValues.city,
          state: home.dataValues.state,
          zipcode: home.dataValues.zipcode,
        };
      }

      const appointment = await UserAppointments.findByPk(
        Number(appointmentId)
      );
      if (!appointment) {
        return res.status(404).json({ error: "Appointment not found" });
      }

      const client = await User.findByPk(appointment.dataValues.userId);
      if (!client) {
        return res.status(404).json({ error: "Client not found" });
      }

      const cleaner = await User.findByPk(id);
      if (!cleaner) {
        return res.status(404).json({ error: "Cleaner not found" });
      }

      const existingRequest = await UserPendingRequests.findOne({
        where: { employeeId: id, appointmentId: Number(appointmentId) },
      });
      if (existingRequest) {
        return res
          .status(400)
          .json({ error: "Request already sent to the client" });
      }

      await UserPendingRequests.create({
        employeeId: id,
        appointmentId: Number(appointmentId),
        status: "pending",
      });

      await Email.sendEmailCancellation(
        clientEmail,
        address,
        clientUserName,
        appointmentDate
      );
      return res.status(200).json({ message: "Request update" });
    } else {
      const appointment = await UserAppointments.findByPk(
        Number(appointmentId)
      );
      if (!appointment) {
        return res.status(404).json({ error: "Appointment not found" });
      }

      const client = await User.findByPk(appointment.dataValues.userId);
      if (!client) {
        return res.status(404).json({ error: "Client not found" });
      }

      const cleaner = await User.findByPk(id);
      if (!cleaner) {
        return res.status(404).json({ error: "Cleaner not found" });
      }

      const existingRequest = await UserPendingRequests.findOne({
        where: { employeeId: id, appointmentId: Number(appointmentId) },
      });
      if (existingRequest) {
        return res
          .status(400)
          .json({ error: "Request already sent to the client" });
      }

      await UserPendingRequests.create({
        employeeId: id,
        appointmentId: Number(appointmentId),
        status: "pending",
      });
      return res
        .status(200)
        .json({ message: "Request sent to the client for approval" });
    }
  } catch (error) {
    console.error("❌ Server error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

appointmentRouter.patch("/remove-request", async (req, res) => {
  const { id, appointmentId } = req.body;
  try {
    const request = await UserPendingRequests.findOne({
      where: { appointmentId: Number(appointmentId), employeeId: Number(id) },
    });

    if (!request) {
      return res.status(404).json({ error: "Request not found" });
    }

    const appointment = await UserAppointments.findByPk(Number(appointmentId));
    if (!appointment) {
      return res.status(404).json({ error: "Appointment not found" });
    }

    const client = await User.findByPk(appointment.dataValues.userId);
    if (!client) {
      return res.status(404).json({ error: "Client not found" });
    }

    const cleaner = await User.findByPk(id);
    if (!cleaner) {
      return res.status(404).json({ error: "Cleaner not found" });
    }

    const removedRequestData = request.get();
    await request.destroy();

    await Email.removeRequestEmail(
      client.dataValues.email,
      client.dataValues.username,
      appointment.dataValues.date
    );

    return res.status(200).json({
      message: "Request removed",
      removedRequest: removedRequestData,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Server error" });
  }
});

// ============================================================================
// CANCELLATION POLICY ENDPOINTS
// ============================================================================

// Get cancellation info for an appointment
appointmentRouter.get("/cancellation-info/:id", async (req, res) => {
  const { id } = req.params;
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    return res.status(401).json({ error: "Authorization token required" });
  }

  try {
    const token = authHeader.split(" ")[1];
    const decodedToken = jwt.verify(token, secretKey);
    const userId = decodedToken.userId;

    const appointment = await UserAppointments.findByPk(id);
    if (!appointment) {
      return res.status(404).json({ error: "Appointment not found" });
    }

    const user = await User.findByPk(userId);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    // Calculate days until appointment
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const appointmentDate = new Date(appointment.date);
    appointmentDate.setHours(0, 0, 0, 0);
    const diffTime = appointmentDate - today;
    const daysUntilAppointment = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    const isHomeowner = appointment.userId === userId;
    const isCleaner = appointment.employeesAssigned?.includes(String(userId));
    const hasCleanerAssigned = appointment.hasBeenAssigned && appointment.employeesAssigned?.length > 0;
    const price = parseFloat(appointment.price) || 0;

    let response = {
      daysUntilAppointment,
      appointmentDate: appointment.date,
      price,
      hasCleanerAssigned,
      isHomeowner,
      isCleaner,
    };

    if (isHomeowner) {
      // Homeowner cancellation rules: 3 days
      const isWithinPenaltyWindow = daysUntilAppointment <= 3 && hasCleanerAssigned;
      const estimatedRefund = isWithinPenaltyWindow ? price * 0.5 : price;
      const cleanerPayout = isWithinPenaltyWindow ? price * 0.5 * 0.9 : 0; // 50% minus 10% platform fee

      response = {
        ...response,
        userType: "homeowner",
        isWithinPenaltyWindow,
        penaltyWindowDays: 3,
        estimatedRefund: estimatedRefund.toFixed(2),
        cleanerPayout: cleanerPayout.toFixed(2),
        warningMessage: isWithinPenaltyWindow
          ? `Cancelling within 3 days of the cleaning means the assigned cleaner will receive $${cleanerPayout.toFixed(2)} (50% of the price minus 10% platform fee). You will be refunded $${estimatedRefund.toFixed(2)}.`
          : hasCleanerAssigned
          ? "You can cancel this appointment for a full refund."
          : "You can cancel this appointment. No payment has been processed yet.",
      };
    } else if (isCleaner) {
      // Cleaner cancellation rules: 4 days
      const isWithinPenaltyWindow = daysUntilAppointment <= 4;

      // Count recent cancellation penalties
      const threeMonthsAgo = new Date();
      threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);

      const recentPenalties = await UserReviews.count({
        where: {
          userId: userId,
          reviewType: "system_cancellation_penalty",
          createdAt: { [Op.gte]: threeMonthsAgo },
        },
      });

      const willBeFrozen = recentPenalties >= 2; // This will be the 3rd

      response = {
        ...response,
        userType: "cleaner",
        isWithinPenaltyWindow,
        penaltyWindowDays: 4,
        recentCancellationPenalties: recentPenalties,
        willResultInFreeze: willBeFrozen,
        warningMessage: isWithinPenaltyWindow
          ? willBeFrozen
            ? `WARNING: Cancelling within 4 days of the cleaning will result in an automatic 1-star rating. You already have ${recentPenalties} cancellation penalties in the last 3 months. THIS CANCELLATION WILL FREEZE YOUR ACCOUNT.`
            : `Cancelling within 4 days of the cleaning will result in an automatic 1-star rating with the note "Last minute cancellation". You currently have ${recentPenalties} cancellation ${recentPenalties === 1 ? "penalty" : "penalties"} in the last 3 months. ${3 - recentPenalties - 1} more will result in your account being frozen.`
          : "You can cancel this job without penalty.",
      };
    } else {
      return res.status(403).json({ error: "You are not authorized to cancel this appointment" });
    }

    return res.json(response);
  } catch (error) {
    console.error("Error getting cancellation info:", error);
    return res.status(500).json({ error: "Failed to get cancellation info" });
  }
});

// Homeowner cancellation endpoint
appointmentRouter.post("/:id/cancel-homeowner", async (req, res) => {
  const { id } = req.params;
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    return res.status(401).json({ error: "Authorization token required" });
  }

  try {
    const token = authHeader.split(" ")[1];
    const decodedToken = jwt.verify(token, secretKey);
    const userId = decodedToken.userId;

    const appointment = await UserAppointments.findByPk(id);
    if (!appointment) {
      return res.status(404).json({ error: "Appointment not found" });
    }

    // Verify user is the homeowner
    if (appointment.userId !== userId) {
      return res.status(403).json({ error: "You can only cancel your own appointments" });
    }

    // Check if appointment is already completed
    if (appointment.completed) {
      return res.status(400).json({ error: "Cannot cancel a completed appointment" });
    }

    // Calculate days until appointment
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const appointmentDate = new Date(appointment.date);
    appointmentDate.setHours(0, 0, 0, 0);
    const diffTime = appointmentDate - today;
    const daysUntilAppointment = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    const hasCleanerAssigned = appointment.hasBeenAssigned && appointment.employeesAssigned?.length > 0;
    const isWithinPenaltyWindow = daysUntilAppointment <= 3 && hasCleanerAssigned;
    const price = parseFloat(appointment.price) || 0;
    const priceInCents = Math.round(price * 100);

    let refundResult = null;
    let cleanerPayoutResult = null;

    // Handle payment cancellation/refund
    if (appointment.paymentIntentId) {
      const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
      const paymentIntent = await stripe.paymentIntents.retrieve(appointment.paymentIntentId);

      if (isWithinPenaltyWindow) {
        // Partial refund: 50% to homeowner
        const refundAmount = Math.round(priceInCents * 0.5);
        const cleanerAmount = Math.round(priceInCents * 0.5 * 0.9); // 50% minus 10% platform fee

        if (paymentIntent.status === "succeeded") {
          // Payment was captured, process partial refund
          refundResult = await stripe.refunds.create({
            payment_intent: paymentIntent.id,
            amount: refundAmount,
          });

          // Create payout records for cleaners
          const cleanerIds = appointment.employeesAssigned || [];
          const perCleanerAmount = Math.round(cleanerAmount / cleanerIds.length);

          for (const cleanerId of cleanerIds) {
            await Payout.create({
              appointmentId: appointment.id,
              cleanerId,
              grossAmount: Math.round(priceInCents * 0.5 / cleanerIds.length),
              platformFee: Math.round(priceInCents * 0.5 * 0.1 / cleanerIds.length),
              netAmount: perCleanerAmount,
              status: "pending",
            });
          }

          cleanerPayoutResult = {
            totalAmount: cleanerAmount / 100,
            perCleaner: perCleanerAmount / 100,
            cleanerCount: cleanerIds.length,
          };
        } else if (paymentIntent.status === "requires_capture") {
          // Payment authorized but not captured - cancel the auth
          await stripe.paymentIntents.cancel(paymentIntent.id);
        }

        await appointment.update({ paymentStatus: "partially_refunded" });
      } else {
        // Full cancellation/refund
        if (paymentIntent.status === "succeeded") {
          refundResult = await stripe.refunds.create({
            payment_intent: paymentIntent.id,
          });
          await appointment.update({ paymentStatus: "refunded" });
        } else if (paymentIntent.status === "requires_capture") {
          await stripe.paymentIntents.cancel(paymentIntent.id);
          await appointment.update({ paymentStatus: "cancelled" });
        }
      }
    }

    // Update user bills
    const existingBill = await UserBills.findOne({ where: { userId } });
    if (existingBill) {
      const appointmentTotal = price;
      const oldAppt = Number(existingBill.appointmentDue);
      const oldFee = Number(existingBill.cancellationFee);
      const cancellationFee = isWithinPenaltyWindow ? price * 0.5 : 0;

      await existingBill.update({
        cancellationFee: oldFee + cancellationFee,
        appointmentDue: oldAppt - appointmentTotal,
        totalDue: oldFee + cancellationFee + oldAppt - appointmentTotal,
      });
    }

    // Send notification emails to cleaners
    if (hasCleanerAssigned) {
      const cleanerIds = appointment.employeesAssigned || [];
      const home = await UserHomes.findByPk(appointment.homeId);
      const homeowner = await User.findByPk(userId);

      for (const cleanerId of cleanerIds) {
        const cleaner = await User.findByPk(cleanerId);
        if (cleaner) {
          // Add in-app notification
          const notifications = cleaner.notifications || [];
          const formattedDate = new Date(appointment.date).toLocaleDateString(undefined, {
            weekday: "long",
            month: "short",
            day: "numeric",
          });
          notifications.unshift(
            isWithinPenaltyWindow
              ? `The homeowner cancelled the ${formattedDate} cleaning. You will receive a partial payment of $${(price * 0.5 * 0.9 / cleanerIds.length).toFixed(2)}.`
              : `The homeowner cancelled the ${formattedDate} cleaning at ${home?.address || "their property"}.`
          );
          await cleaner.update({ notifications: notifications.slice(0, 50) });
        }
      }
    }

    // Delete related records
    await UserCleanerAppointments.destroy({ where: { appointmentId: id } });
    await UserPendingRequests.destroy({ where: { appointmentId: id } });

    // Delete any associated payout records that haven't been processed (except for penalty payouts)
    if (!isWithinPenaltyWindow) {
      await Payout.destroy({ where: { appointmentId: id, status: "pending" } });
    }

    // Delete the appointment
    await appointment.destroy();

    return res.json({
      success: true,
      message: isWithinPenaltyWindow
        ? "Appointment cancelled. Cleaner will receive partial payment."
        : "Appointment cancelled successfully.",
      refund: refundResult ? { amount: refundResult.amount / 100 } : null,
      cleanerPayout: cleanerPayoutResult,
      wasWithinPenaltyWindow: isWithinPenaltyWindow,
    });
  } catch (error) {
    console.error("Error cancelling appointment as homeowner:", error);
    return res.status(500).json({ error: "Failed to cancel appointment" });
  }
});

// Cleaner cancellation endpoint
appointmentRouter.post("/:id/cancel-cleaner", async (req, res) => {
  const { id } = req.params;
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    return res.status(401).json({ error: "Authorization token required" });
  }

  try {
    const token = authHeader.split(" ")[1];
    const decodedToken = jwt.verify(token, secretKey);
    const userId = decodedToken.userId;

    const appointment = await UserAppointments.findByPk(id);
    if (!appointment) {
      return res.status(404).json({ error: "Appointment not found" });
    }

    // Verify user is an assigned cleaner
    const isAssigned = appointment.employeesAssigned?.includes(String(userId));
    if (!isAssigned) {
      return res.status(403).json({ error: "You are not assigned to this appointment" });
    }

    // Check if appointment is already completed
    if (appointment.completed) {
      return res.status(400).json({ error: "Cannot cancel a completed appointment" });
    }

    const cleaner = await User.findByPk(userId);
    if (!cleaner) {
      return res.status(404).json({ error: "Cleaner not found" });
    }

    // Check if account is frozen
    if (cleaner.accountFrozen) {
      return res.status(403).json({ error: "Your account is frozen. Please contact support." });
    }

    // Calculate days until appointment
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const appointmentDate = new Date(appointment.date);
    appointmentDate.setHours(0, 0, 0, 0);
    const diffTime = appointmentDate - today;
    const daysUntilAppointment = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    const isWithinPenaltyWindow = daysUntilAppointment <= 4;
    let accountFrozen = false;

    if (isWithinPenaltyWindow) {
      // Create system cancellation penalty review
      await UserReviews.create({
        userId: userId,
        reviewerId: 0, // System-generated (0 indicates system)
        appointmentId: appointment.id,
        reviewType: "system_cancellation_penalty",
        isPublished: true, // System reviews are always published
        review: 1, // 1-star rating
        reviewComment: "Last minute cancellation",
        privateComment: `Cleaner cancelled within ${daysUntilAppointment} days of the scheduled cleaning.`,
        professionalism: 1,
      });

      // Check if account should be frozen
      const threeMonthsAgo = new Date();
      threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);

      const recentPenalties = await UserReviews.count({
        where: {
          userId: userId,
          reviewType: "system_cancellation_penalty",
          createdAt: { [Op.gte]: threeMonthsAgo },
        },
      });

      if (recentPenalties >= 3) {
        await cleaner.update({
          accountFrozen: true,
          accountFrozenAt: new Date(),
          accountFrozenReason: "3 or more last-minute cancellations within 3 months",
        });
        accountFrozen = true;
      }
    }

    // Remove cleaner from the appointment
    await UserCleanerAppointments.destroy({
      where: { employeeId: userId, appointmentId: id },
    });

    // Update the appointment
    let employees = Array.isArray(appointment.employeesAssigned)
      ? [...appointment.employeesAssigned]
      : [];
    const updatedEmployees = employees.filter((empId) => empId !== String(userId));

    await appointment.update({
      employeesAssigned: updatedEmployees,
      hasBeenAssigned: updatedEmployees.length > 0,
    });

    // Delete pending payout for this cleaner
    await Payout.destroy({
      where: { appointmentId: id, cleanerId: userId, status: "pending" },
    });

    // Send notification to homeowner
    const homeowner = await User.findByPk(appointment.userId);
    const home = await UserHomes.findByPk(appointment.homeId);

    if (homeowner) {
      const notifications = homeowner.notifications || [];
      const formattedDate = new Date(appointment.date).toLocaleDateString(undefined, {
        weekday: "long",
        month: "short",
        day: "numeric",
      });
      notifications.unshift(
        `A cleaner has cancelled their assignment for the ${formattedDate} cleaning at ${home?.address || "your property"}. A new cleaner will need to be assigned.`
      );
      await homeowner.update({ notifications: notifications.slice(0, 50) });

      // Send email notification
      if (home) {
        await Email.sendEmailCancellation(
          homeowner.email,
          {
            street: home.address,
            city: home.city,
            state: home.state,
            zipcode: home.zipcode,
          },
          homeowner.username,
          appointment.date
        );
      }
    }

    return res.json({
      success: true,
      message: isWithinPenaltyWindow
        ? "You have been removed from this appointment. A 1-star cancellation penalty has been applied."
        : "You have been removed from this appointment.",
      wasWithinPenaltyWindow: isWithinPenaltyWindow,
      accountFrozen,
      penaltyApplied: isWithinPenaltyWindow,
    });
  } catch (error) {
    console.error("Error cancelling appointment as cleaner:", error);
    return res.status(500).json({ error: "Failed to cancel appointment" });
  }
});

appointmentRouter.patch("/:id", async (req, res) => {
  const {
    id,
    bringTowels,
    bringSheets,
    keyPadCode,
    keyLocation,
    timeToBeCompleted,
  } = req.body;
  let userInfo;

  try {
    if (timeToBeCompleted) {
      userInfo = await UserInfo.editTimeInDB({
        id,
        timeToBeCompleted,
      });
    }
    if (bringSheets) {
      userInfo = await UserInfo.editSheetsInDB({
        id,
        bringSheets,
      });
    }
    if (bringTowels) {
      userInfo = await UserInfo.editTowelsInDB({
        id,
        bringTowels,
      });
    }
    if (keyPadCode) {
      userInfo = await UserInfo.editCodeKeyInDB({
        id,
        keyPadCode,
        keyLocation: "",
      });
    }
    if (keyLocation) {
      userInfo = await UserInfo.editCodeKeyInDB({
        id,
        keyLocation,
        keyPadCode: "",
      });
    }
    return res.status(200).json({ user: userInfo });
  } catch (error) {
    console.error(error);

    if (error.name === "TokenExpiredError") {
      return res.status(401).json({ error: "Token has expired" });
    }

    return res.status(401).json({ error: "Invalid token" });
  }
});

module.exports = appointmentRouter;
