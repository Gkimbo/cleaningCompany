const express = require("express");
const clientRouter = require("./clientRouter");
const userSessionsRouter = require("./api/v1/userSessionsRouter");
const usersRouter = require("./api/v1/usersRouter");
const userInfoRouter = require("./api/v1/userInfoRouter");
const appointmentRouter = require("./api/v1/appointmentsRouter");
const employeeInfoRouter = require("./api/v1/employeeInfoRouter");
const applicationRouter = require("./api/v1/applicationRouter");
const reviewsRouter = require("./api/v1/reviewsRouter");
const paymentRouter = require("./api/v1/paymentRouter");
const messageRouter = require("./api/v1/messageRouter");
const stripeConnectRouter = require("./api/v1/stripeConnectRouter");
const taxRouter = require("./api/v1/taxRouter");
const jobPhotosRouter = require("./api/v1/jobPhotosRouter");
const calendarSyncRouter = require("./api/v1/calendarSyncRouter");
const ownerDashboardRouter = require("./api/v1/ownerDashboardRouter");
const hrDashboardRouter = require("./api/v1/hrDashboardRouter");
const termsRouter = require("./api/v1/termsRouter");
const pricingRouter = require("./api/v1/pricingRouter");
const pushNotificationRouter = require("./api/v1/pushNotificationRouter");
const homeSizeAdjustmentRouter = require("./api/v1/homeSizeAdjustmentRouter");

const rootRouter = new express.Router();

rootRouter.use("/api/v1/user-sessions", userSessionsRouter);
rootRouter.use("/api/v1/users", usersRouter);
rootRouter.use("/api/v1/user-info", userInfoRouter);
rootRouter.use("/api/v1/employee-info", employeeInfoRouter);
rootRouter.use("/api/v1/appointments", appointmentRouter);
rootRouter.use("/api/v1/applications", applicationRouter);
rootRouter.use("/api/v1/reviews", reviewsRouter);
rootRouter.use("/api/v1/payments", paymentRouter);
rootRouter.use("/api/v1/messages", messageRouter);
rootRouter.use("/api/v1/stripe-connect", stripeConnectRouter);
rootRouter.use("/api/v1/tax", taxRouter);
rootRouter.use("/api/v1/job-photos", jobPhotosRouter);
rootRouter.use("/api/v1/calendar-sync", calendarSyncRouter);
rootRouter.use("/api/v1/owner-dashboard", ownerDashboardRouter);
rootRouter.use("/api/v1/hr-dashboard", hrDashboardRouter);
rootRouter.use("/api/v1/terms", termsRouter);
rootRouter.use("/api/v1/pricing", pricingRouter);
rootRouter.use("/api/v1/push-notifications", pushNotificationRouter);
rootRouter.use("/api/v1/home-size-adjustment", homeSizeAdjustmentRouter);

rootRouter.use("/", clientRouter);

module.exports = rootRouter;
