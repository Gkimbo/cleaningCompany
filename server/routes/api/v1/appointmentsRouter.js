const express = require("express");
const jwt = require("jsonwebtoken");
const {
  User,
  UserAppointments,
  UserHomes,
  UserBills,
  UserCleanerAppointments,
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
        console.log(date.date)
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

        // const cleaners = await User.findAll({
        //   where: { type: "cleaner" },
        // });
        // const numCleaners = homeBeingScheduled.dataValues.cleanersNeeded;

        // let selectedCleaners = [];
        // let cleanersAssigned = 0;
        // let employeeArray = [];
        // for (const cleaner of cleaners) {
        //   if (cleanersAssigned >= numCleaners) {
        // await newAppointment.update({
        //   hasBeenAssigned: true,
        // });
        // break;
        // }
        // if (cleaner.dataValues.daysWorking) {
        //   if (cleaner.dataValues.daysWorking.includes(dayOfWeek)) {
        //     let employee = await User.findByPk(cleaner.dataValues.id, {
        //       include: [
        //         {
        //           model: UserCleanerAppointments,
        //           as: "cleanerAppointments",
        //         },
        //       ],
        //     });
        // const appointmentIds =
        //   employee.dataValues.cleanerAppointments.map(
        //     (appointment) => appointment.appointmentId
        //   );
        // const appointments = await UserAppointments.findAll({
        //   where: {
        //     id: appointmentIds,
        //   },
        // });
        // const dateCounts = {};
        // appointments.forEach((appointment) => {
        //   const date = appointment.dataValues.date;
        //   dateCounts[date] = (dateCounts[date] || 0) + 1;
        // });

        // if (!dateCounts[date.date] || dateCounts[date.date] < 2) {
        //   const assignedEmployee = {
        //     id: cleaner.dataValues.id,
        //     name: cleaner.dataValues.username,
        //     daysWorking: cleaner.dataValues.daysWorking,
        //   };
        //         employeeArray.push(assignedEmployee);
        //         selectedCleaners.push(cleaner);
        //         await newAppointment.update({
        //           employeesAssigned: employeeArray,
        //         });
        //         cleanersAssigned++;
        //       }
        //     }
        //   }
        // }
        // if (selectedCleaners.length > 0) {
        //   const newAppointments = await Promise.all(
        //     selectedCleaners.map(async (cleaner) => {
        //       const newConnection = await UserCleanerAppointments.create({
        //         appointmentId,
        //         employeeId: cleaner.dataValues.id,
        //       });
        //       return newConnection;
        //     })
        //  );

        //   return newAppointments;
        // } else {
        //   console.log("No cleaner available for", day);
        // }
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

appointmentRouter.patch("/add-employee", async (req, res) => {
  const { id, appointmentId } = req.body;
  let userInfo;
  try {
    const checkItExists = await UserCleanerAppointments.findOne({
      where: {
        employeeId: id,
        appointmentId: Number(appointmentId),
      },
    });
    if (!checkItExists) {
      userInfo = await UserCleanerAppointments.create({
        employeeId: id,
        appointmentId: Number(appointmentId),
      });
      const updateAppointment = await UserAppointments.findOne({
        where: {
          id: appointmentId,
        },
      });

      const bookingClientId = updateAppointment.dataValues.userId;
      const homeId = updateAppointment.dataValues.homeId;
      const appointmentDate = updateAppointment.dataValues.date;
      let employees;

      if (updateAppointment) {
        if (!Array.isArray(updateAppointment?.dataValues?.employeesAssigned)) {
          employees = [];
        } else {
          employees = [...updateAppointment.dataValues.employeesAssigned];
        }

        if (!employees.includes(String(id))) {
          employees.push(String(id));
          const response = await updateAppointment.update({
            employeesAssigned: employees,
            hasBeenAssigned: true,
          });
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
        await Email.sendEmailConfirmation(
          clientEmail,
          address,
          clientUserName,
          appointmentDate
        );
      }
      return res.status(200).json({ user: userInfo });
    }
    return res
      .status(201)
      .json({ error: "This cleaner is already attached to this appointment" });
  } catch (error) {
    console.error(error);
    if (error.name === "TokenExpiredError") {
      return res.status(401).json({ error: "Token has expired" });
    }
    return res.status(401).json({ error: "Invalid token" });
  }
});

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

// const user = await User.findByPk(userId, {
// 	include: [
// 		{
// 			model: UserHomes,
// 			as: "homes",
// 		},
// 		{
// 			model: UserAppointments,
// 			as: "appointments",
// 		},
// 	],
// });

// const home = await UserHomes.findByPk(homeId, {
// 	include: [
// 		{
// 			model: User,
// 			as: "user",
// 		},
// 		{
// 			model: UserAppointments,
// 			as: "appointments",
// 		},
// 	],
// });
