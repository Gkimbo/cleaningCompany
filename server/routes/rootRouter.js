const express = require("express");
const clientRouter = require("./clientRouter");
const userSessionsRouter = require("./api/v1/userSessionsRouter");
const usersRouter = require("./api/v1/usersRouter");
const userInfoRouter = require("./api/v1/userInfoRouter");
const appointmentRouter = require("./api/v1/appointmentsRouter");

const rootRouter = new express.Router();

rootRouter.use("/api/v1/user-sessions", userSessionsRouter);
rootRouter.use("/api/v1/users", usersRouter);
rootRouter.use("/api/v1/user-info", userInfoRouter);
rootRouter.use("/api/v1/appointments", appointmentRouter);
rootRouter.use("/", clientRouter);

module.exports = rootRouter;
