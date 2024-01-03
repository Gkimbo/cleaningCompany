const express = require("express");
const clientRouter = require("./clientRouter");
const userSessionsRouter = require("./api/v1/userSessionsRouter");
const usersRouter = require("./api/v1/usersRouter");

const rootRouter = new express.Router();

rootRouter.use("/api/v1/user-sessions", userSessionsRouter);
rootRouter.use("/api/v1/users", usersRouter);
rootRouter.use("/", clientRouter);

module.exports = rootRouter;
