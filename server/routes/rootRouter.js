const express = require("express");
const clientRouter = require("./clientRouter");
const userSessionsRouter = require("./api/v1/userSessionsRouter");
const usersRouter = require("./api/v1/usersRouter");
const userInfoRouter = require("./api/v1/userInfoRouter");
const appointmentRouter = require("./api/v1/appointmentsRouter");
const employeeInfoRouter = require("./api/v1/employeeInfoRouter");
const applicationRouter = require("./api/v1/applicationRouter");

const rootRouter = new express.Router();

rootRouter.use("/api/v1/user-sessions", userSessionsRouter);
rootRouter.use("/api/v1/users", usersRouter);
rootRouter.use("/api/v1/user-info", userInfoRouter);
rootRouter.use("/api/v1/employee-info", employeeInfoRouter);
rootRouter.use("/api/v1/appointments", appointmentRouter);
rootRouter.use("/api/v1/applications", applicationRouter)
rootRouter.use("/", clientRouter);

module.exports = rootRouter;
