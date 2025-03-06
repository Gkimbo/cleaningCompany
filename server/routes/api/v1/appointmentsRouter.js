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
      const pendingRequestsEmployee = {
        request: [],
        appointment: [],
        employeeRequesting: [],
      };
      return res.status(200).json({ pendingRequestsEmployee: [pendingRequestsEmployee] });
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

  dateArray.forEach((date) => {
    const price = calculatePrice(
      date.bringSheets,
      date.bringTowels,
      home.dataValues.numBeds,
      home.dataValues.numBaths
    );
    date.price = price;
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
        console.log(date.date);
        const newAppointment = await UserAppointments.create({
          userId,
          homeId,
          date: date.date,
          price: date.price,
          paid: date.paid,
          bringTowels: date.bringTowels,
          bringSheets: date.bringSheets,
          keyPadCode,
          keyLocation,
          completed: false,
          hasBeenAssigned: false,
          empoyeesNeeded: homeBeingScheduled.dataValues.cleanersNeeded,
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
  console.log(requestId)
  try {
    const request = await UserPendingRequests.findOne({
      where: { id: requestId },
    });
    console.log("Request: ", request);
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
      await Email.sendEmailCancellation(
        clientEmail,
        address,
        clientUserName,
        appointmentDate
      );
      return res
      .status(200)
      .json({ message: "Request update" });
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

// appointmentRouter.patch("/remove-request", async (req, res) => {
//   const { id, appointmentId } = req.body;
//   try {
//     const request = await UserPendingRequests.findOne({
//       where: { appointmentId: Number(appointmentId), employeeId: Number(id) },
//     });

//     if (!request) {
//       return res.status(404).json({ error: "Request not found" });
//     }

//     const appointment = await UserAppointments.findByPk(Number(appointmentId));
//     if (!appointment) {
//       return res.status(404).json({ error: "Appointment not found" });
//     }

//     const client = await User.findByPk(appointment.dataValues.userId);
//     if (!client) {
//       return res.status(404).json({ error: "Client not found" });
//     }

//     const cleaner = await User.findByPk(id);
//     if (!cleaner) {
//       return res.status(404).json({ error: "Cleaner not found" });
//     }

//     const removedRequestData = request.get();
//     await request.destroy();

//     await Email.removeRequestEmail(
//       client.dataValues.email,
//       client.dataValues.username,
//       appointment.dataValues.date
//     );

//     return res.status(200).json({
//       message: "Request removed",
//       removedRequest: removedRequestData,
//     });
//   } catch (error) {
//     console.error(error);
//     return res.status(500).json({ error: "Server error" });
//   }
// });

appointmentRouter.patch("/:id", async (req, res) => {
  const { id, bringTowels, bringSheets, keyPadCode, keyLocation } = req.body;
  let userInfo;

  try {
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
