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
  JobPhoto,
  CalendarSync,
  StripeConnectAccount,
  CleanerClient,
  HomePreferredCleaner,
} = require("../../../models");
const AppointmentSerializer = require("../../../serializers/AppointmentSerializer");
const UserInfo = require("../../../services/UserInfoClass");
const calculatePrice = require("../../../services/CalculatePrice");
const { checkLastMinuteBooking } = require("../../../services/CalculatePrice");
const LastMinuteNotificationService = require("../../../services/LastMinuteNotificationService");
const HomeSerializer = require("../../../serializers/homesSerializer");
const EncryptionService = require("../../../services/EncryptionService");
const { emit } = require("nodemon");
const Email = require("../../../services/sendNotifications/EmailClass");
const PushNotification = require("../../../services/sendNotifications/PushNotificationClass");
const { businessConfig, getPricingConfig } = require("../../../config/businessConfig");
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
const { recordPaymentTransaction } = require("./paymentRouter");
const IncentiveService = require("../../../services/IncentiveService");
const NotificationService = require("../../../services/NotificationService");
const MultiCleanerService = require("../../../services/MultiCleanerService");
const { Notification } = require("../../../models");

const appointmentRouter = express.Router();
const secretKey = process.env.SESSION_SECRET;

// Static pricing config (used as fallback, prefer getPricingConfig() for database values)
const { pricing } = businessConfig;

// Store pending linens update email timeouts to debounce multiple rapid updates
const pendingLinensEmailTimeouts = new Map();

appointmentRouter.get("/unassigned", async (req, res) => {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) {
    return res.status(401).json({ error: "Authorization token required" });
  }
  try {
    const { preferredOnly } = req.query;

    // Build the where clause
    const whereClause = {
      hasBeenAssigned: false,
      assignedToBusinessEmployee: false, // Exclude business-assigned jobs from marketplace
    };

    // If preferredOnly filter is enabled, filter to cleaner's preferred homes
    if (preferredOnly === "true") {
      const decodedToken = jwt.verify(token, secretKey);
      const cleanerId = decodedToken.userId;

      // Get all home IDs where this cleaner is preferred
      const preferredHomeRecords = await HomePreferredCleaner.findAll({
        where: { cleanerId },
        attributes: ["homeId"],
      });

      const preferredHomeIds = preferredHomeRecords.map((ph) => ph.homeId);

      // If cleaner has no preferred homes, return empty list
      if (preferredHomeIds.length === 0) {
        return res.status(200).json({ appointments: [], preferredHomeCount: 0 });
      }

      // Filter appointments to only those from preferred homes
      const { Op } = require("sequelize");
      whereClause.homeId = { [Op.in]: preferredHomeIds };
    }

    // Filter out appointments that are assigned to business employees
    const userAppointments = await UserAppointments.findAll({
      where: whereClause,
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
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) {
    return res.status(401).json({ error: "Authorization token required" });
  }
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

    // Get all pending and onHold requests for these appointments
    const pendingRequests = await UserPendingRequests.findAll({
      where: {
        appointmentId: { [Op.in]: appointmentIds },
        status: { [Op.in]: ["pending", "onHold"] },
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

// Get cancellation info for an appointment
// IMPORTANT: Must be defined BEFORE /:homeId to avoid route conflict
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
      // Homeowner cancellation rules - fetch from database
      const pricingConfig = await getPricingConfig();
      const { cancellation: cancellationConfig, platform: platformConfig } = pricingConfig;

      const penaltyDays = cancellationConfig.homeownerPenaltyDays;
      const standardRefundPercent = cancellationConfig.refundPercentage;
      const platformFee = platformConfig.feePercent;
      const cancellationFeeAmount = cancellationConfig.fee;
      const cancellationWindowDays = cancellationConfig.windowDays;
      const isWithinPenaltyWindow = daysUntilAppointment <= penaltyDays && hasCleanerAssigned;
      const willChargeCancellationFee = daysUntilAppointment <= cancellationWindowDays;

      // Check if discount was applied (incentive appointment)
      const discountApplied = appointment.discountApplied === true;
      const originalPrice = discountApplied && appointment.originalPrice
        ? parseFloat(appointment.originalPrice)
        : price;

      // Get incentive-specific cancellation rates
      const incentiveRefundPercent = cancellationConfig.incentiveRefundPercent || 0.10;
      const incentiveCleanerPercent = cancellationConfig.incentiveCleanerPercent || 0.40;

      // Use different rates for incentive appointments
      const refundPercent = discountApplied ? incentiveRefundPercent : standardRefundPercent;

      // Check if appointment is prepaid
      const isPrepaid = appointment.paid === true;

      // Calculate refund amounts - always show expected refund for informational purposes
      // isWithinPenaltyWindow means cleaner is assigned AND within 3 days
      const estimatedRefund = isWithinPenaltyWindow ? price * refundPercent : price;

      // Cleaner payout calculation differs for incentive vs standard
      let cleanerPayout;
      if (isWithinPenaltyWindow) {
        if (discountApplied) {
          // Incentive: cleaner gets % of ORIGINAL price, no separate platform fee
          cleanerPayout = originalPrice * incentiveCleanerPercent;
        } else {
          // Standard: cleaner gets remaining amount minus platform fee
          cleanerPayout = price * (1 - standardRefundPercent) * (1 - platformFee);
        }
      } else {
        cleanerPayout = 0;
      }

      // Calculate what platform keeps for incentive cancellations (for display)
      const platformKeeps = discountApplied && isWithinPenaltyWindow
        ? price - estimatedRefund - cleanerPayout
        : 0;

      // Check if user has a payment method on file
      const hasPaymentMethod = user.hasPaymentMethod && user.stripeCustomerId;

      // Check if cancellation is blocked due to missing payment method
      const cancellationBlocked = willChargeCancellationFee && !hasPaymentMethod;

      // Build warning message
      let warningMessage;
      if (cancellationBlocked) {
        // Still show penalty info but note that payment method is required
        if (isWithinPenaltyWindow) {
          warningMessage = `You cannot cancel within ${cancellationWindowDays} days without a payment method on file. If you add a payment method, cancelling within ${penaltyDays} days of the cleaning means you will receive a ${refundPercent * 100}% refund ($${estimatedRefund.toFixed(2)}). The cleaner will receive $${cleanerPayout.toFixed(2)}.`;
        } else {
          warningMessage = `You cannot cancel within ${cancellationWindowDays} days of the appointment without a payment method on file. A $${cancellationFeeAmount} cancellation fee is required. Please add a payment method first.`;
        }
      } else if (willChargeCancellationFee) {
        if (isWithinPenaltyWindow) {
          if (discountApplied) {
            warningMessage = `Because you received a discount on this appointment, cancelling within ${penaltyDays} days means you will only receive a ${refundPercent * 100}% refund ($${estimatedRefund.toFixed(2)}). The cleaner will receive $${cleanerPayout.toFixed(2)} (${incentiveCleanerPercent * 100}% of the original $${originalPrice.toFixed(2)} price). Additionally, a $${cancellationFeeAmount} cancellation fee will be charged.`;
          } else {
            warningMessage = `Cancelling within ${penaltyDays} days of the cleaning means you will receive a ${refundPercent * 100}% refund ($${estimatedRefund.toFixed(2)}). The cleaner will receive $${cleanerPayout.toFixed(2)} (${(1 - refundPercent) * 100}% minus ${platformFee * 100}% platform fee). Additionally, a $${cancellationFeeAmount} cancellation fee will be charged.`;
          }
        } else if (isPrepaid) {
          warningMessage = `A $${cancellationFeeAmount} cancellation fee will be charged to your card on file. You will receive a full refund of $${price.toFixed(2)} for the cleaning cost.`;
        } else {
          warningMessage = `A $${cancellationFeeAmount} cancellation fee will be charged to your card on file for cancelling within ${cancellationWindowDays} days of the appointment.`;
        }
      } else if (isWithinPenaltyWindow) {
        if (discountApplied) {
          warningMessage = `Because you received a discount on this appointment, cancelling within ${penaltyDays} days means you will only receive a ${refundPercent * 100}% refund ($${estimatedRefund.toFixed(2)}). The cleaner will receive $${cleanerPayout.toFixed(2)} (${incentiveCleanerPercent * 100}% of the original $${originalPrice.toFixed(2)} price).`;
        } else {
          warningMessage = `Cancelling within ${penaltyDays} days of the cleaning means you will receive a ${refundPercent * 100}% refund ($${estimatedRefund.toFixed(2)}). The cleaner will receive $${cleanerPayout.toFixed(2)}.`;
        }
      } else if (isPrepaid) {
        warningMessage = "You will receive a full refund of the cleaning cost.";
      } else if (hasCleanerAssigned) {
        warningMessage = "You can cancel this appointment. The payment authorization will be cancelled.";
      } else {
        warningMessage = "You can cancel this appointment. No payment has been processed yet.";
      }

      response = {
        ...response,
        userType: "homeowner",
        isWithinPenaltyWindow,
        penaltyWindowDays: penaltyDays,
        isPrepaid,
        estimatedRefund: estimatedRefund.toFixed(2),
        cleanerPayout: cleanerPayout.toFixed(2),
        // Discount/incentive info
        discountApplied,
        originalPrice: originalPrice.toFixed(2),
        refundPercent: refundPercent * 100,
        incentiveCleanerPercent: discountApplied ? incentiveCleanerPercent * 100 : null,
        platformKeeps: platformKeeps.toFixed(2),
        // Cancellation fee info
        willChargeCancellationFee,
        cancellationFee: cancellationFeeAmount,
        cancellationWindowDays,
        hasPaymentMethod,
        cancellationBlocked,
        warningMessage,
      };
    } else if (isCleaner) {
      // Cleaner cancellation rules - fetch from database
      const pricingConfig = await getPricingConfig();
      const { cancellation: cancellationConfig } = pricingConfig;

      const penaltyDays = cancellationConfig.cleanerPenaltyDays;
      const isWithinPenaltyWindow = daysUntilAppointment <= penaltyDays;

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

      const willBeFrozen = recentPenalties >= 2;

      response = {
        ...response,
        userType: "cleaner",
        isWithinPenaltyWindow,
        penaltyWindowDays: penaltyDays,
        recentCancellationPenalties: recentPenalties,
        willResultInFreeze: willBeFrozen,
        // Require acknowledgment for last-minute cancellations
        requiresAcknowledgment: isWithinPenaltyWindow,
        acknowledgmentMessage: isWithinPenaltyWindow
          ? willBeFrozen
            ? "I understand that cancelling this appointment will result in a 1-star rating and my account will be frozen due to having 3 or more last-minute cancellations within 3 months."
            : "I understand that cancelling this appointment within the penalty window will result in an automatic 1-star rating. I acknowledge that 3 last-minute cancellations within 3 months will result in my account being frozen."
          : null,
        warningMessage: isWithinPenaltyWindow
          ? willBeFrozen
            ? `WARNING: Cancelling within ${penaltyDays} days of the cleaning will result in an automatic 1-star rating. You already have ${recentPenalties} cancellation penalties in the last 3 months. THIS CANCELLATION WILL FREEZE YOUR ACCOUNT.`
            : `Cancelling within ${penaltyDays} days of the cleaning will result in an automatic 1-star rating with the note "Last minute cancellation". You currently have ${recentPenalties} cancellation ${recentPenalties === 1 ? "penalty" : "penalties"} in the last 3 months. ${3 - recentPenalties - 1} more will result in your account being frozen.`
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

// Get archived cleanings (completed with client review) for a user
// NOTE: This must be defined BEFORE /:homeId to avoid route conflict
appointmentRouter.get("/archived", async (req, res) => {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) {
    return res.status(401).json({ error: "Authorization token required" });
  }

  try {
    const decoded = jwt.verify(token, secretKey);
    const userId = decoded.userId;

    // Get all completed appointments for this user
    const completedAppointments = await UserAppointments.findAll({
      where: {
        userId: userId,
        completed: true,
      },
      order: [["date", "DESC"]],
    });

    // Get reviews for these appointments (homeowner_to_cleaner type)
    const appointmentIds = completedAppointments.map((apt) => apt.id);
    const reviews = await UserReviews.findAll({
      where: {
        appointmentId: { [Op.in]: appointmentIds },
        reviewType: "homeowner_to_cleaner",
      },
    });

    // Filter to only appointments with client reviews
    const reviewedAppointmentIds = new Set(reviews.map((r) => r.appointmentId));
    const archivedAppointments = completedAppointments.filter((apt) =>
      reviewedAppointmentIds.has(apt.id)
    );

    // Enrich with home and cleaner info
    const enrichedAppointments = await Promise.all(
      archivedAppointments.map(async (apt) => {
        const serialized = AppointmentSerializer.serializeOne(apt);

        // Get home info
        const home = await UserHomes.findByPk(apt.homeId);
        if (home) {
          serialized.home = HomeSerializer.serializeOne(home);
        }

        // Get cleaner name from assigned employees
        if (apt.employeesAssigned && apt.employeesAssigned.length > 0) {
          const cleanerId = apt.employeesAssigned[0];
          const cleaner = await User.findByPk(cleanerId);
          if (cleaner) {
            serialized.cleanerName = cleaner.username;
          }
        }

        return serialized;
      })
    );

    return res.status(200).json({ appointments: enrichedAppointments });
  } catch (error) {
    console.error("Error fetching archived cleanings:", error);

    if (error.name === "TokenExpiredError") {
      return res.status(401).json({ error: "Token has expired" });
    }

    return res.status(401).json({ error: "Failed to fetch archived cleanings" });
  }
});

// ==========================================
// CLIENT BOOKING RESPONSE ENDPOINTS
// NOTE: These must be defined BEFORE /:homeId to avoid route conflict
// ==========================================

/**
 * GET /pending-approval
 * Get all appointments pending client approval
 * For clients to see bookings their business owner made for them
 */
appointmentRouter.get("/pending-approval", async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    const token = authHeader.split(" ")[1];
    const decoded = jwt.verify(token, secretKey);
    const userId = decoded.userId;

    const pendingAppointments = await UserAppointments.findAll({
      where: {
        userId,
        clientResponsePending: true,
        [Op.or]: [
          { expiresAt: null },
          { expiresAt: { [Op.gt]: new Date() } },
        ],
      },
      include: [
        {
          model: UserHomes,
          as: "home",
          attributes: ["id", "nickName", "address", "city", "state", "numBeds", "numBaths"],
        },
        {
          model: User,
          as: "bookedByCleaner",
          attributes: ["id", "firstName", "lastName", "profilePhoto"],
        },
      ],
      order: [["expiresAt", "ASC"]],
    });

    // Decrypt and serialize response
    const serializedAppointments = pendingAppointments.map((apt) => {
      const cleanerName = apt.bookedByCleaner
        ? `${EncryptionService.decrypt(apt.bookedByCleaner.firstName)} ${EncryptionService.decrypt(apt.bookedByCleaner.lastName)}`
        : "Your Cleaner";

      return {
        id: apt.id,
        date: apt.date,
        price: apt.price,
        expiresAt: apt.expiresAt,
        timeToBeCompleted: apt.timeToBeCompleted,
        home: apt.home ? {
          id: apt.home.id,
          nickName: apt.home.nickName,
          address: EncryptionService.decrypt(apt.home.address),
          city: EncryptionService.decrypt(apt.home.city),
          state: EncryptionService.decrypt(apt.home.state),
          numBeds: apt.home.numBeds,
          numBaths: apt.home.numBaths,
        } : null,
        bookedBy: {
          id: apt.bookedByCleaner?.id,
          name: cleanerName,
          profilePhoto: apt.bookedByCleaner?.profilePhoto,
        },
      };
    });

    res.json({ appointments: serializedAppointments });
  } catch (error) {
    console.error("Error fetching pending approval appointments:", error);
    res.status(500).json({ error: "Failed to fetch pending appointments" });
  }
});

// ==========================================
// STATIC PREFIX ROUTES - Must come BEFORE catch-all /:param routes
// ==========================================

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

  // Check if home setup is complete (for homes created via invitation)
  if (home.dataValues.isSetupComplete === false) {
    return res.status(403).json({
      error: "Please complete your home setup before booking. You need to provide access information and linen preferences."
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

  try {
    const decodedToken = jwt.verify(token, secretKey);
    const userId = decodedToken.userId;

    // Check if homeowner is eligible for discount incentive
    const discountResult = await IncentiveService.isHomeownerEligible(userId);

    // Check if home uses preferred cleaners feature (default: true)
    const usePreferredCleaners = home.dataValues.usePreferredCleaners !== false;

    // Check if home has a preferred cleaner (business owner relationship)
    // Only use preferred cleaner logic if the toggle is enabled
    let cleanerClientRelation = null;
    const preferredCleanerId = usePreferredCleaners ? home.dataValues.preferredCleanerId : null;
    if (preferredCleanerId) {
      cleanerClientRelation = await CleanerClient.findOne({
        where: {
          cleanerId: preferredCleanerId,
          homeId: home.dataValues.id,
          status: "active",
        },
      });
    }

    for (const date of dateArray) {
      // Use configurations if provided, otherwise fall back to home defaults
      const sheetConfigs = date.sheetConfigurations || home.dataValues.bedConfigurations;
      const towelConfigs = date.towelConfigurations || home.dataValues.bathroomConfigurations;

      let finalPrice;

      // If this home has a preferred cleaner with custom pricing, use their price
      if (cleanerClientRelation && cleanerClientRelation.dataValues.defaultPrice) {
        finalPrice = parseFloat(cleanerClientRelation.dataValues.defaultPrice);
        // No discounts apply to business owner pricing
        date.originalPrice = null;
        date.discountApplied = false;
        date.discountPercent = null;
        date.isPreferredCleanerPrice = true;
      } else {
        // Calculate platform price
        const originalPrice = await calculatePrice(
          date.bringSheets,
          date.bringTowels,
          home.dataValues.numBeds,
          home.dataValues.numBaths,
          home.dataValues.timeToBeCompleted,
          sheetConfigs,
          towelConfigs
        );

        // Apply discount if eligible
        finalPrice = originalPrice;
        if (discountResult.eligible && discountResult.remainingCleanings > 0) {
          const discountAmount = originalPrice * discountResult.discountPercent;
          finalPrice = Math.round((originalPrice - discountAmount) * 100) / 100;
          date.originalPrice = originalPrice.toString();
          date.discountApplied = true;
          date.discountPercent = discountResult.discountPercent;
          // Decrement remaining for this batch of appointments
          discountResult.remainingCleanings--;
        } else {
          date.originalPrice = null;
          date.discountApplied = false;
          date.discountPercent = null;
        }
        date.isPreferredCleanerPrice = false;
      }

      // Check if this is a last-minute booking and add fee
      const lastMinuteCheck = await checkLastMinuteBooking(date.date);
      if (lastMinuteCheck.isLastMinute) {
        date.isLastMinuteBooking = true;
        date.lastMinuteFeeApplied = lastMinuteCheck.fee;
        finalPrice += lastMinuteCheck.fee;
      } else {
        date.isLastMinuteBooking = false;
        date.lastMinuteFeeApplied = null;
      }

      date.price = finalPrice;
      date.sheetConfigurations = sheetConfigs;
      date.towelConfigurations = towelConfigs;
      date.preferredCleanerId = preferredCleanerId || null;
      appointmentTotal += finalPrice;
    }

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
          // Discount incentive fields
          discountApplied: date.discountApplied || false,
          discountPercent: date.discountPercent || null,
          originalPrice: date.originalPrice || null,
          // Last-minute booking fields
          isLastMinuteBooking: date.isLastMinuteBooking || false,
          lastMinuteFeeApplied: date.lastMinuteFeeApplied || null,
        });
        const appointmentId = newAppointment.dataValues.id;

        // If this is a preferred cleaner appointment, notify the cleaner
        if (date.preferredCleanerId) {
          try {
            const cleaner = await User.findByPk(date.preferredCleanerId);
            const client = await User.findByPk(userId);
            const homeAddress = `${EncryptionService.decrypt(homeBeingScheduled.dataValues.address)}, ${EncryptionService.decrypt(homeBeingScheduled.dataValues.city)}`;
            const formattedDate = new Date(date.date).toLocaleDateString("en-US", {
              weekday: "short",
              month: "short",
              day: "numeric",
            });

            // Send push notification to cleaner
            if (cleaner && cleaner.dataValues.expoPushToken) {
              await PushNotification.sendPushNotification(
                cleaner.dataValues.expoPushToken,
                "New Client Appointment",
                `${EncryptionService.decrypt(client.dataValues.firstName)} booked a cleaning for ${formattedDate}. Tap to accept or decline.`,
                { type: "client_appointment_request", appointmentId }
              );
            }

            // Send email notification to cleaner
            if (cleaner && cleaner.dataValues.email) {
              await Email.sendNewClientAppointmentEmail(
                EncryptionService.decrypt(cleaner.dataValues.email),
                EncryptionService.decrypt(cleaner.dataValues.firstName),
                `${EncryptionService.decrypt(client.dataValues.firstName)} ${EncryptionService.decrypt(client.dataValues.lastName)}`,
                date.date,
                homeAddress,
                date.price,
                appointmentId
              );
            }
          } catch (notifyErr) {
            console.error("Error notifying preferred cleaner:", notifyErr);
          }
        }

        return newAppointment;
      })
    );

    // Check if this is a large home and include info in response
    const MultiCleanerService = require("../../../services/MultiCleanerService");
    let largeHomeInfo = null;
    try {
      const isLarge = await MultiCleanerService.isLargeHome(
        home.dataValues.numBeds,
        home.dataValues.numBaths
      );
      if (isLarge) {
        const recommendedCleaners = await MultiCleanerService.calculateRecommendedCleaners(home);
        const estimatedMinutes = await MultiCleanerService.estimateJobDuration(home, recommendedCleaners);
        largeHomeInfo = {
          isLargeHome: true,
          recommendedCleaners,
          estimatedMinutes,
          estimatedHours: (estimatedMinutes / 60).toFixed(1),
          warning: `This is a large home (${home.dataValues.numBeds} beds, ${home.dataValues.numBaths} baths). We recommend ${recommendedCleaners} cleaners for optimal service.`,
        };
      }
    } catch (err) {
      console.error("Error checking large home:", err);
    }

    // Send last-minute notifications for any last-minute bookings
    const lastMinuteAppointments = appointments.filter(
      (apt) => apt.isLastMinuteBooking
    );
    if (lastMinuteAppointments.length > 0) {
      // Send notifications asynchronously (don't block response)
      setImmediate(async () => {
        try {
          for (const apt of lastMinuteAppointments) {
            const aptRecord = await UserAppointments.findByPk(apt.id);
            await LastMinuteNotificationService.notifyNearbyCleaners(
              aptRecord,
              home,
              req.io
            );
          }
        } catch (err) {
          console.error("[LastMinuteNotification] Error sending notifications:", err);
        }
      });
    }

    return res.status(201).json({ appointments, largeHomeInfo });
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

    // Capture previous linens values for comparison in email
    const previousLinens = {
      bringSheets: appointment.dataValues.bringSheets,
      bringTowels: appointment.dataValues.bringTowels,
    };

    // Get home info to recalculate price
    const home = await UserHomes.findOne({
      where: { id: appointment.dataValues.homeId },
    });

    // Calculate new price
    const newPrice = await calculatePrice(
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

    // If appointment has been assigned, send delayed email to assigned cleaner
    if (appointment.dataValues.hasBeenAssigned) {
      // Find the assigned cleaner via UserCleanerAppointments
      const cleanerAppointment = await UserCleanerAppointments.findOne({
        where: { appointmentId: id },
      });

      if (cleanerAppointment) {
        const cleaner = await User.findByPk(cleanerAppointment.dataValues.employeeId);
        const homeowner = await User.findByPk(appointment.dataValues.userId);

        if (cleaner && homeowner) {
          // Get pricing config for fee calculation
          const pricingConfig = await getPricingConfig();
          const cleanerSharePercent = 1 - (pricingConfig.platform?.feePercent || 0.1);
          const cleanerPayout = Number(newPrice) * cleanerSharePercent;

          const linensConfig = {
            bringSheets,
            bringTowels,
            sheetConfigurations,
            towelConfigurations,
            previousBringSheets: previousLinens.bringSheets,
            previousBringTowels: previousLinens.bringTowels,
          };

          // Cancel any existing pending email for this appointment (debounce)
          if (pendingLinensEmailTimeouts.has(id)) {
            clearTimeout(pendingLinensEmailTimeouts.get(id));
            console.log(`[Linens Update] Cancelled previous pending email for appointment ${id}`);
          }

          // Capture original previous values for the email (before any updates in this session)
          const originalPreviousLinens = { ...previousLinens };

          // 1-minute delay before sending email to allow for multiple quick updates
          const timeoutId = setTimeout(async () => {
            try {
              // Remove from pending map
              pendingLinensEmailTimeouts.delete(id);

              // Re-fetch appointment to get latest data in case of more updates
              const latestAppointment = await UserAppointments.findByPk(id);
              if (latestAppointment) {
                const latestLinensConfig = {
                  bringSheets: latestAppointment.dataValues.bringSheets,
                  bringTowels: latestAppointment.dataValues.bringTowels,
                  sheetConfigurations: latestAppointment.dataValues.sheetConfigurations,
                  towelConfigurations: latestAppointment.dataValues.towelConfigurations,
                  // Include previous values to show what was removed
                  previousBringSheets: originalPreviousLinens.bringSheets,
                  previousBringTowels: originalPreviousLinens.bringTowels,
                };
                const latestPayout = Number(latestAppointment.dataValues.price) * cleanerSharePercent;

                await Email.sendLinensConfigurationUpdated(
                  EncryptionService.decrypt(cleaner.dataValues.email),
                  cleaner.dataValues.username,
                  homeowner.dataValues.username,
                  latestAppointment.dataValues.date,
                  latestPayout,
                  latestLinensConfig
                );
                console.log(`[Linens Update] Email sent to cleaner for appointment ${id}`);
              }
            } catch (emailError) {
              console.error(`[Linens Update] Failed to send email for appointment ${id}:`, emailError);
              pendingLinensEmailTimeouts.delete(id);
            }
          }, 60000); // 1 minute = 60000ms

          // Store the timeout ID so we can cancel it if another update comes in
          pendingLinensEmailTimeouts.set(id, timeoutId);
        }
      }
    }

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

    // Only subtract if not already paid
    const amountToSubtract = appointmentToDelete.dataValues.paid ? 0 : appointmentTotal;

    // Ensure values don't go negative
    const newAppointmentDue = Math.max(0, oldAppt - amountToSubtract);
    const newCancellationFee = oldFee + fee;
    const newTotalDue = Math.max(0, newCancellationFee + newAppointmentDue);

    await existingBill.update({
      cancellationFee: newCancellationFee,
      appointmentDue: newAppointmentDue,
      totalDue: newTotalDue,
    });

    // Track deleted date for calendar sync to prevent re-creation
    const homeId = appointmentToDelete.dataValues.homeId;
    const appointmentDate = appointmentToDelete.dataValues.date;
    const dateStr = typeof appointmentDate === 'string'
      ? appointmentDate.split('T')[0]
      : new Date(appointmentDate).toISOString().split('T')[0];

    const calendarSyncs = await CalendarSync.findAll({
      where: { homeId, isActive: true },
    });

    for (const sync of calendarSyncs) {
      const deletedDates = sync.deletedDates || [];
      if (!deletedDates.includes(dateStr)) {
        await sync.update({
          deletedDates: [...deletedDates, dateStr],
        });
      }
    }

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
            hasBeenAssigned: updatedEmployees.length > 0,
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

      // Send push notification to homeowner
      const bookingClient = await User.findByPk(bookingClientId);
      if (bookingClient?.expoPushToken) {
        await PushNotification.sendPushCancellation(
          bookingClient.expoPushToken,
          clientUserName,
          appointmentDate,
          address
        );
      }
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

// Get booking info for an appointment (large home warnings, etc.)
appointmentRouter.get("/booking-info/:appointmentId", async (req, res) => {
  const { appointmentId } = req.params;
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    return res.status(401).json({ error: "Authorization token required" });
  }

  try {
    const token = authHeader.split(" ")[1];
    jwt.verify(token, secretKey);

    const appointment = await UserAppointments.findByPk(appointmentId);
    if (!appointment) {
      return res.status(404).json({ error: "Appointment not found" });
    }

    const home = await UserHomes.findByPk(appointment.homeId);
    if (!home) {
      return res.status(404).json({ error: "Home not found" });
    }

    const numBeds = parseInt(home.numBeds) || 0;
    const numBaths = parseInt(home.numBaths) || 0;
    const timeToBeCompleted = home.timeToBeCompleted || "anytime";
    const cleanersNeeded = home.cleanersNeeded || 1;

    // Use MultiCleanerService for consistent large home detection
    const isLargeHome = await MultiCleanerService.isLargeHome(numBeds, numBaths);
    const isEdgeLargeHome = await MultiCleanerService.isEdgeLargeHome(numBeds, numBaths);
    const soloAllowed = await MultiCleanerService.isSoloAllowed(numBeds, numBaths);
    const multiCleanerRequired = await MultiCleanerService.isMultiCleanerRequired(numBeds, numBaths);
    const recommendedCleaners = await MultiCleanerService.calculateRecommendedCleaners(home);

    // Time constraint only matters for large homes
    const hasTimeConstraint = isLargeHome && timeToBeCompleted !== "anytime";

    // Build acknowledgment message based on conditions
    let acknowledgmentMessage = null;
    if (isLargeHome && soloAllowed) {
      // Edge large home - solo is allowed with warning
      if (hasTimeConstraint) {
        acknowledgmentMessage = `I understand this is a larger home (${numBeds} beds, ${numBaths} baths) that may require additional time. The cleaning must be completed between ${timeToBeCompleted}, which may be difficult solo. I choose to clean this home by myself.`;
      } else {
        acknowledgmentMessage = `I understand this is a larger home (${numBeds} beds, ${numBaths} baths) that may take longer to clean. I choose to clean this home by myself.`;
      }
    }

    return res.json({
      appointmentId: parseInt(appointmentId),
      homeInfo: {
        numBeds,
        numBaths,
        timeToBeCompleted,
        cleanersNeeded,
      },
      isLargeHome,
      isEdgeLargeHome,
      soloAllowed,
      multiCleanerRequired,
      recommendedCleaners,
      hasTimeConstraint,
      // Only require acknowledgment for edge large homes (solo allowed with warning)
      // Clearly large homes require multi-cleaner, no solo option
      requiresAcknowledgment: isLargeHome && soloAllowed,
      acknowledgmentMessage,
    });
  } catch (error) {
    console.error("Error getting booking info:", error);
    return res.status(500).json({ error: "Failed to get booking info" });
  }
});

appointmentRouter.patch("/request-employee", async (req, res) => {
  const { id, appointmentId, acknowledged } = req.body;

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

    // Check if cleaner has set up Stripe Connect account for payouts
    const stripeAccount = await StripeConnectAccount.findOne({
      where: { userId: id },
    });

    if (!stripeAccount || !stripeAccount.onboardingComplete) {
      return res.status(400).json({
        error: "Stripe account required",
        message: "You need to set up your Stripe account to receive payments before you can request appointments.",
        requiresStripeSetup: true,
      });
    }

    if (!stripeAccount.payoutsEnabled) {
      return res.status(400).json({
        error: "Stripe account incomplete",
        message: "Your Stripe account setup is incomplete. Please complete your account verification to receive payments.",
        requiresStripeSetup: true,
        stripeAccountStatus: stripeAccount.accountStatus,
      });
    }

    // Check if home is large and requires acknowledgment
    const home = await UserHomes.findByPk(appointment.homeId);
    if (home) {
      const numBeds = parseInt(home.numBeds) || 0;
      const numBaths = parseInt(home.numBaths) || 0;
      const MultiCleanerService = require("../../../services/MultiCleanerService");
      const isLargeHome = await MultiCleanerService.isLargeHome(numBeds, numBaths);

      if (isLargeHome && !acknowledged) {
        const timeToBeCompleted = home.timeToBeCompleted || "anytime";
        const hasTimeConstraint = timeToBeCompleted !== "anytime";
        const recommendedCleaners = await MultiCleanerService.calculateRecommendedCleaners(home);

        let message = `This is a large home (${numBeds} beds, ${numBaths} baths). Recommended: ${recommendedCleaners} cleaners. Cleaning alone may take longer than the allowed window.`;
        if (hasTimeConstraint) {
          message += ` The cleaning must be completed between ${timeToBeCompleted}, which may be difficult without assistance.`;
        }

        return res.status(400).json({
          error: "Acknowledgment required",
          message,
          requiresAcknowledgment: true,
          isLargeHome: true,
          hasTimeConstraint,
          recommendedCleaners,
          // Offer multi-cleaner option
          multiCleanerOption: {
            available: true,
            message: "You can choose to join as part of a multi-cleaner team, or clean solo with acknowledgment.",
          },
        });
      }
    }

    // Check if cleaner is a preferred cleaner for this home (direct booking)
    const homeId = appointment.dataValues.homeId;
    const isPreferredCleaner = await HomePreferredCleaner.findOne({
      where: { homeId, cleanerId: id },
    });

    if (isPreferredCleaner) {
      // Preferred cleaners can book directly without approval
      // Check if appointment is already assigned
      if (appointment.dataValues.hasBeenAssigned) {
        return res.status(400).json({
          error: "A cleaner is already assigned to this appointment.",
        });
      }

      // Create the cleaner-appointment assignment
      await UserCleanerAppointments.create({
        employeeId: id,
        appointmentId: Number(appointmentId),
      });

      // Update appointment as assigned
      const employees = [String(id)];
      await appointment.update({
        employeesAssigned: employees,
        hasBeenAssigned: true,
      });

      // Create payment intent if one doesn't exist
      if (!appointment.dataValues.paymentIntentId) {
        try {
          const priceInCents = Math.round(parseFloat(appointment.dataValues.price) * 100);
          const user = await User.findByPk(appointment.dataValues.userId);

          if (user && user.stripeCustomerId) {
            const customer = await stripe.customers.retrieve(user.stripeCustomerId);
            const defaultPaymentMethod = customer.invoice_settings?.default_payment_method;

            if (defaultPaymentMethod) {
              const paymentIntent = await stripe.paymentIntents.create({
                amount: priceInCents,
                currency: "usd",
                customer: user.stripeCustomerId,
                payment_method: defaultPaymentMethod,
                capture_method: "manual",
                confirm: true,
                off_session: true,
                metadata: {
                  userId: appointment.dataValues.userId,
                  homeId: homeId,
                  appointmentId: Number(appointmentId),
                },
              });

              await appointment.update({
                paymentIntentId: paymentIntent.id,
                paymentStatus: "pending",
              });

              await recordPaymentTransaction({
                type: "authorization",
                status: "pending",
                amount: priceInCents,
                userId: appointment.dataValues.userId,
                appointmentId: Number(appointmentId),
                stripePaymentIntentId: paymentIntent.id,
                description: `Payment authorization for preferred cleaner direct booking ${appointmentId}`,
                metadata: { homeId },
              });
            }
          }
        } catch (paymentError) {
          console.error("Error creating payment intent on direct booking:", paymentError);
        }
      }

      // Create payout record for the cleaner
      const pricingConfig = await getPricingConfig();
      const { platform: platformConfig } = pricingConfig;

      const payoutPrice = appointment.dataValues.discountApplied && appointment.dataValues.originalPrice
        ? parseFloat(appointment.dataValues.originalPrice)
        : parseFloat(appointment.dataValues.price);
      const priceInCents = Math.round(payoutPrice * 100);

      const feeResult = await IncentiveService.calculateCleanerFee(
        id,
        priceInCents,
        platformConfig.feePercent
      );

      const existingPayout = await Payout.findOne({
        where: { appointmentId: Number(appointmentId), cleanerId: id },
      });

      if (!existingPayout) {
        await Payout.create({
          appointmentId: Number(appointmentId),
          cleanerId: id,
          grossAmount: priceInCents,
          platformFee: feeResult.platformFee,
          netAmount: feeResult.netAmount,
          status: "pending",
          incentiveApplied: feeResult.incentiveApplied,
          originalPlatformFee: feeResult.originalPlatformFee,
        });
      }

      // Capture payment immediately if within 3 days of appointment
      const appointmentDate = new Date(appointment.dataValues.date);
      const now = new Date();
      const diffInDays = (appointmentDate - now) / (1000 * 60 * 60 * 24);

      if (
        diffInDays <= 3 &&
        diffInDays >= 0 &&
        appointment.dataValues.paymentStatus !== "captured"
      ) {
        try {
          const user = await User.findByPk(appointment.dataValues.userId);

          if (appointment.dataValues.paymentIntentId) {
            await stripe.paymentIntents.capture(appointment.dataValues.paymentIntentId);
            await appointment.update({ paymentStatus: "captured" });
          } else if (user && user.stripeCustomerId) {
            const customer = await stripe.customers.retrieve(user.stripeCustomerId);
            const defaultPaymentMethod = customer.invoice_settings?.default_payment_method;

            if (defaultPaymentMethod) {
              const priceForCapture = Math.round(parseFloat(appointment.dataValues.price) * 100);
              const capturedIntent = await stripe.paymentIntents.create({
                amount: priceForCapture,
                currency: "usd",
                customer: user.stripeCustomerId,
                payment_method: defaultPaymentMethod,
                confirm: true,
                off_session: true,
                metadata: {
                  userId: appointment.dataValues.userId,
                  homeId: homeId,
                  appointmentId: Number(appointmentId),
                },
              });

              await appointment.update({
                paymentIntentId: capturedIntent.id,
                paymentStatus: "captured",
              });
            }
          }
        } catch (captureError) {
          console.error("Error capturing payment on direct booking:", captureError);
        }
      }

      // Send informational notification to homeowner (not approval request)
      const formattedDate = new Date(appointment.dataValues.date).toLocaleDateString("en-US", {
        weekday: "long",
        month: "long",
        day: "numeric",
      });

      await Email.sendPreferredCleanerBookingNotification(
        EncryptionService.decrypt(client.dataValues.email),
        client.dataValues.username,
        cleaner.dataValues.username,
        home?.address ? EncryptionService.decrypt(home.address) : "your property",
        formattedDate
      );

      if (client.dataValues.expoPushToken) {
        await PushNotification.sendPushNotification(
          client.dataValues.expoPushToken,
          "Preferred Cleaner Booked",
          `${cleaner.dataValues.username} (your preferred cleaner) has booked the ${formattedDate} cleaning at ${home?.address ? EncryptionService.decrypt(home.address) : "your property"}.`
        );
      }

      return res.status(200).json({
        message: "Job booked successfully! As a preferred cleaner, no approval was needed.",
        directBooking: true,
      });
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
      EncryptionService.decrypt(client.dataValues.email),
      client.dataValues.username,
      cleaner.dataValues.username,
      averageRating,
      appointment.dataValues.date
    );

    // Send push notification to homeowner
    if (client.dataValues.expoPushToken) {
      await PushNotification.sendPushEmployeeRequest(
        client.dataValues.expoPushToken,
        client.dataValues.username,
        cleaner.dataValues.username,
        averageRating,
        appointment.dataValues.date
      );
    }

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

    // Get the appointment first to check assignment status
    const appointment = await UserAppointments.findOne({
      where: { id: request.dataValues.appointmentId },
    });

    if (!appointment) {
      return res.status(404).json({ error: "Appointment not found" });
    }

    if (approve) {
      // Block if a cleaner is already assigned
      if (appointment.dataValues.hasBeenAssigned) {
        return res.status(400).json({
          error: "A cleaner is already assigned to this appointment. Remove them first to approve another.",
        });
      }

      await UserCleanerAppointments.create({
        employeeId: request.dataValues.employeeId,
        appointmentId: request.dataValues.appointmentId,
      });

      // Only 1 cleaner can be assigned, so employeesAssigned will have just this cleaner
      const employees = [String(request.dataValues.employeeId)];

      await appointment.update({
        employeesAssigned: employees,
        hasBeenAssigned: true,
      });

      // Create payment intent if one doesn't exist (for appointments booked without upfront payment)
      if (!appointment.dataValues.paymentIntentId) {
        try {
          const priceInCents = Math.round(parseFloat(appointment.dataValues.price) * 100);
          const user = await User.findByPk(appointment.dataValues.userId);

          if (user && user.stripeCustomerId) {
            // Get the customer's default payment method
            const customer = await stripe.customers.retrieve(user.stripeCustomerId);
            const defaultPaymentMethod = customer.invoice_settings?.default_payment_method;

            if (defaultPaymentMethod) {
              const paymentIntent = await stripe.paymentIntents.create({
                amount: priceInCents,
                currency: "usd",
                customer: user.stripeCustomerId,
                payment_method: defaultPaymentMethod,
                capture_method: "manual",
                confirm: true,
                off_session: true,
                metadata: {
                  userId: appointment.dataValues.userId,
                  homeId: appointment.dataValues.homeId,
                  appointmentId: appointment.dataValues.id,
                },
              });

              await appointment.update({
                paymentIntentId: paymentIntent.id,
                paymentStatus: "pending",
              });

              // Record the authorization
              await recordPaymentTransaction({
                type: "authorization",
                status: "pending",
                amount: priceInCents,
                userId: appointment.dataValues.userId,
                appointmentId: appointment.dataValues.id,
                stripePaymentIntentId: paymentIntent.id,
                description: `Payment authorization for approved appointment ${appointment.dataValues.id}`,
                metadata: { homeId: appointment.dataValues.homeId },
              });
            }
          }
        } catch (paymentError) {
          console.error("Error creating payment intent on approval:", paymentError);
          // Don't fail the approval if payment intent creation fails
          // The user can still pre-pay manually later
        }
      }

      // Create payout record for the approved cleaner (only 1 cleaner per appointment)
      const pricingConfig = await getPricingConfig();
      const { platform: platformConfig } = pricingConfig;

      const cleanerId = request.dataValues.employeeId;
      const appointmentId = request.dataValues.appointmentId;

      // Use original price for cleaner payout if a homeowner discount was applied
      // This ensures cleaners get paid based on the full price, with the platform absorbing the discount
      const payoutPrice = appointment.dataValues.discountApplied && appointment.dataValues.originalPrice
        ? parseFloat(appointment.dataValues.originalPrice)
        : parseFloat(appointment.dataValues.price);
      const priceInCents = Math.round(payoutPrice * 100);

      // Check cleaner incentive eligibility and calculate fees
      const feeResult = await IncentiveService.calculateCleanerFee(
        cleanerId,
        priceInCents,
        platformConfig.feePercent
      );

      // Check if payout record already exists
      const existingPayout = await Payout.findOne({
        where: { appointmentId, cleanerId },
      });

      if (!existingPayout) {
        await Payout.create({
          appointmentId,
          cleanerId,
          grossAmount: priceInCents,
          platformFee: feeResult.platformFee,
          netAmount: feeResult.netAmount,
          status: "pending", // Will change to "held" when payment is captured
          incentiveApplied: feeResult.incentiveApplied,
          originalPlatformFee: feeResult.originalPlatformFee,
        });
      }

      // Capture payment immediately if within 3 days of appointment
      const appointmentDate = new Date(appointment.dataValues.date);
      const now = new Date();
      const diffInDays = (appointmentDate - now) / (1000 * 60 * 60 * 24);

      if (
        diffInDays <= 3 &&
        diffInDays >= 0 &&
        appointment.dataValues.paymentStatus !== "captured"
      ) {
        try {
          let capturedIntent;
          const user = await User.findByPk(appointment.dataValues.userId);

          if (appointment.dataValues.paymentIntentId) {
            // Existing payment intent - capture it
            capturedIntent = await stripe.paymentIntents.capture(
              appointment.dataValues.paymentIntentId
            );
          } else {
            // No payment intent exists - create and capture in one step
            console.log(`[Approve Request] Creating payment intent for appointment ${appointment.id} (no existing intent)`);

            if (!user || !user.stripeCustomerId) {
              console.error(`[Approve Request] No Stripe customer for appointment ${appointment.id}`);
              await appointment.update({ paymentCaptureFailed: true });
              // Continue with approval - don't return early
            } else {
              const customer = await stripe.customers.retrieve(user.stripeCustomerId);
              const defaultPaymentMethod = customer.invoice_settings?.default_payment_method;

              if (!defaultPaymentMethod) {
                console.error(`[Approve Request] No payment method for appointment ${appointment.id}`);
                await appointment.update({ paymentCaptureFailed: true });
                // Continue with approval - don't return early
              } else {
                const priceInCents = Math.round(parseFloat(appointment.dataValues.price) * 100);

                capturedIntent = await stripe.paymentIntents.create({
                  amount: priceInCents,
                  currency: "usd",
                  customer: user.stripeCustomerId,
                  payment_method: defaultPaymentMethod,
                  confirm: true,
                  off_session: true,
                  metadata: {
                    userId: appointment.dataValues.userId,
                    homeId: appointment.dataValues.homeId,
                    appointmentId: appointment.dataValues.id,
                  },
                });

                await appointment.update({ paymentIntentId: capturedIntent.id });
              }
            }
          }

          if (capturedIntent) {
            await appointment.update({
              paymentStatus: "captured",
              paid: true,
              amountPaid: capturedIntent.amount_received || capturedIntent.amount,
            });

            // Update all payout records to "held"
            await Payout.update(
              { status: "held", paymentCapturedAt: new Date() },
              { where: { appointmentId: appointment.id } }
            );

            // Record the capture transaction
            await recordPaymentTransaction({
              type: "capture",
              stripePaymentIntentId: capturedIntent.id,
              stripeChargeId: capturedIntent.latest_charge,
              amount: capturedIntent.amount_received || capturedIntent.amount,
              currency: capturedIntent.currency,
              status: "succeeded",
              appointmentId: appointment.id,
              homeownerId: appointment.dataValues.userId,
              description: `Payment captured for appointment ${appointment.id}`,
            });

            console.log(
              `[Approve Request] Payment captured for appointment ${appointment.id}`
            );
          }
        } catch (captureError) {
          console.error(
            `[Approve Request] Payment capture failed for appointment ${appointment.id}, will retry via cron:`,
            captureError.message
          );
          // Mark as failed so cron can notify and retry
          await appointment.update({ paymentCaptureFailed: true });
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
        const linensConfig = {
          bringSheets: appointment.dataValues.bringSheets,
          bringTowels: appointment.dataValues.bringTowels,
          sheetConfigurations: appointment.dataValues.sheetConfigurations,
          towelConfigurations: appointment.dataValues.towelConfigurations,
        };
        await Email.sendRequestApproved(
          EncryptionService.decrypt(cleaner.dataValues.email),
          cleaner.dataValues.username,
          homeowner.dataValues.username,
          address,
          appointment.dataValues.date,
          linensConfig
        );

        // Send push notification to cleaner
        if (cleaner.dataValues.expoPushToken) {
          await PushNotification.sendPushRequestApproved(
            cleaner.dataValues.expoPushToken,
            cleaner.dataValues.username,
            homeowner.dataValues.username,
            appointment.dataValues.date,
            address
          );
        }

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

      // Update the approved request status to "approved"
      await request.update({ status: "approved" });

      // Set all other pending requests for this appointment to "onHold"
      await UserPendingRequests.update(
        { status: "onHold" },
        {
          where: {
            appointmentId: request.dataValues.appointmentId,
            status: "pending",
            id: { [Op.ne]: request.id },
          },
        }
      );

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
      EncryptionService.decrypt(cleaner.dataValues.email),
      cleaner.dataValues.username,
      appointment.dataValues.date
    );

    // Send push notification to cleaner
    if (cleaner.dataValues.expoPushToken) {
      await PushNotification.sendPushRequestDenied(
        cleaner.dataValues.expoPushToken,
        cleaner.dataValues.username,
        appointment.dataValues.date
      );
    }

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
            hasBeenAssigned: updatedEmployees.length > 0,
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

      // Update the approved request back to pending
      const approvedRequest = await UserPendingRequests.findOne({
        where: { employeeId: id, appointmentId: Number(appointmentId), status: "approved" },
      });
      if (approvedRequest) {
        await approvedRequest.update({ status: "pending" });
      } else {
        // If no approved request exists, create a new pending request
        const existingRequest = await UserPendingRequests.findOne({
          where: { employeeId: id, appointmentId: Number(appointmentId) },
        });
        if (!existingRequest) {
          await UserPendingRequests.create({
            employeeId: id,
            appointmentId: Number(appointmentId),
            status: "pending",
          });
        }
      }

      // Reactivate any onHold requests so they can be approved
      await UserPendingRequests.update(
        { status: "pending" },
        {
          where: {
            appointmentId: Number(appointmentId),
            status: "onHold",
          },
        }
      );

      // Delete payout for the removed cleaner
      await Payout.destroy({
        where: { appointmentId: Number(appointmentId), cleanerId: id, status: "pending" },
      });

      await Email.sendEmailCancellation(
        clientEmail,
        address,
        clientUserName,
        appointmentDate
      );

      // Send push notification to homeowner
      const bookingClient = await User.findByPk(bookingClientId);
      if (bookingClient?.expoPushToken) {
        await PushNotification.sendPushCancellation(
          bookingClient.expoPushToken,
          clientUserName,
          appointmentDate,
          address
        );
      }
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
      EncryptionService.decrypt(client.dataValues.email),
      client.dataValues.username,
      appointment.dataValues.date
    );

    // Send push notification to homeowner
    if (client.dataValues.expoPushToken) {
      await PushNotification.sendPushRemoveRequest(
        client.dataValues.expoPushToken,
        client.dataValues.username,
        appointment.dataValues.date
      );
    }

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
// JOB MANAGEMENT ENDPOINTS
// ============================================================================

// POST /api/v1/appointments/:id/unstart - Undo starting a job (delete photos)
appointmentRouter.post("/:id/unstart", async (req, res) => {
  const { id } = req.params;
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    return res.status(401).json({ error: "Authorization token required" });
  }

  try {
    const token = authHeader.split(" ")[1];
    const decoded = jwt.verify(token, secretKey);
    const userId = decoded.userId;

    const appointment = await UserAppointments.findByPk(id);

    if (!appointment) {
      return res.status(404).json({ error: "Appointment not found" });
    }

    // Verify cleaner is assigned to this appointment
    if (!appointment.employeesAssigned?.includes(String(userId))) {
      return res.status(403).json({ error: "Not authorized to unstart this job" });
    }

    // Cannot unstart a completed appointment
    if (appointment.completed) {
      return res.status(400).json({ error: "Cannot unstart a completed appointment" });
    }

    // Delete all photos for this appointment
    const deletedCount = await JobPhoto.destroy({
      where: { appointmentId: id },
    });

    console.log(`[Unstart Job] Deleted ${deletedCount} photos for appointment ${id}`);

    return res.status(200).json({
      success: true,
      message: "Job unstarted successfully",
      photosDeleted: deletedCount,
    });
  } catch (error) {
    console.error("Error unstarting job:", error);
    if (error.name === "JsonWebTokenError" || error.name === "TokenExpiredError") {
      return res.status(401).json({ error: "Invalid or expired token" });
    }
    return res.status(500).json({ error: "Server error" });
  }
});

// ============================================================================
// CANCELLATION POLICY ENDPOINTS
// Note: GET /cancellation-info/:id is defined earlier (before /:homeId) to avoid route conflicts
// ============================================================================

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

    // Get pricing config from database
    const pricingConfig = await getPricingConfig();
    const { cancellation: cancellationConfig, platform: platformConfig } = pricingConfig;

    const hasCleanerAssigned = appointment.hasBeenAssigned && appointment.employeesAssigned?.length > 0;
    const isWithinPenaltyWindow = daysUntilAppointment <= cancellationConfig.homeownerPenaltyDays && hasCleanerAssigned;
    const isWithinCancellationFeeWindow = daysUntilAppointment <= cancellationConfig.windowDays;
    const price = parseFloat(appointment.price) || 0;
    const priceInCents = Math.round(price * 100);

    // Use original price for cleaner payout calculations if discount was applied
    // This ensures cleaners get paid based on the full price, with the platform absorbing the discount
    const cleanerBasePrice = appointment.discountApplied && appointment.originalPrice
      ? parseFloat(appointment.originalPrice)
      : price;
    const cleanerBasePriceInCents = Math.round(cleanerBasePrice * 100);

    // Get user for Stripe customer info
    const user = await User.findByPk(userId);

    // Block cancellation if within 7 days and no payment method (can't pay cancellation fee)
    if (isWithinCancellationFeeWindow && (!user.stripeCustomerId || !user.hasPaymentMethod)) {
      return res.status(400).json({
        error: "Cannot cancel without a payment method",
        message: "You cannot cancel within 7 days of the appointment without a payment method on file to pay the cancellation fee. Please add a payment method first.",
        requiresPaymentMethod: true,
        daysUntilAppointment,
      });
    }

    let refundResult = null;
    let cleanerPayoutResult = null;
    let cancellationFeeResult = null;

    const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);

    // Debug logging for cancellation fee
    console.log(`[Cancellation] User ${userId} cancelling appointment ${id}`);
    console.log(`[Cancellation] Days until appointment: ${daysUntilAppointment}`);
    console.log(`[Cancellation] Cancellation window days: ${cancellationConfig.windowDays}`);
    console.log(`[Cancellation] isWithinCancellationFeeWindow: ${isWithinCancellationFeeWindow}`);
    console.log(`[Cancellation] User stripeCustomerId: ${user.stripeCustomerId}`);
    console.log(`[Cancellation] User hasPaymentMethod: ${user.hasPaymentMethod}`);
    console.log(`[Cancellation] Cancellation fee: $${cancellationConfig.fee}`);

    // Charge cancellation fee if within the window and user has payment method
    if (isWithinCancellationFeeWindow && user.stripeCustomerId && user.hasPaymentMethod) {
      const cancellationFeeAmountCents = Math.round(cancellationConfig.fee * 100);

      try {
        // Get the customer's default payment method
        console.log(`[Cancellation] Retrieving Stripe customer: ${user.stripeCustomerId}`);
        const customer = await stripe.customers.retrieve(user.stripeCustomerId);
        const defaultPaymentMethod = customer.invoice_settings?.default_payment_method;
        console.log(`[Cancellation] Default payment method: ${defaultPaymentMethod}`);

        if (defaultPaymentMethod) {
          // Create and confirm a PaymentIntent for the cancellation fee
          console.log(`[Cancellation] Creating PaymentIntent for $${cancellationConfig.fee} (${cancellationFeeAmountCents} cents)`);
          const cancellationPaymentIntent = await stripe.paymentIntents.create({
            amount: cancellationFeeAmountCents,
            currency: "usd",
            customer: user.stripeCustomerId,
            payment_method: defaultPaymentMethod,
            confirm: true,
            off_session: true,
            description: `Cancellation fee for appointment on ${appointment.date}`,
            metadata: {
              appointmentId: appointment.id.toString(),
              userId: userId.toString(),
              type: "cancellation_fee",
            },
          });

          console.log(`[Cancellation] PaymentIntent created: ${cancellationPaymentIntent.id}, Status: ${cancellationPaymentIntent.status}`);

          cancellationFeeResult = {
            charged: true,
            amount: cancellationConfig.fee,
            paymentIntentId: cancellationPaymentIntent.id,
          };
        } else {
          console.log(`[Cancellation] User ${userId} has no default payment method, adding fee to bill`);
          // Add fee to user's bill since we couldn't charge it
          const existingBillForFee = await UserBills.findOne({ where: { userId } });
          if (existingBillForFee) {
            const currentFee = Number(existingBillForFee.cancellationFee) || 0;
            const currentTotal = Number(existingBillForFee.totalDue) || 0;
            await existingBillForFee.update({
              cancellationFee: currentFee + cancellationConfig.fee,
              totalDue: currentTotal + cancellationConfig.fee,
            });
          }
          cancellationFeeResult = {
            charged: false,
            addedToBill: true,
            amount: cancellationConfig.fee,
            reason: "No default payment method - added to bill",
          };
        }
      } catch (stripeError) {
        console.error(`[Cancellation] Error charging cancellation fee, adding to bill:`, stripeError);
        // Add fee to user's bill since charge failed
        const existingBillForFee = await UserBills.findOne({ where: { userId } });
        if (existingBillForFee) {
          const currentFee = Number(existingBillForFee.cancellationFee) || 0;
          const currentTotal = Number(existingBillForFee.totalDue) || 0;
          await existingBillForFee.update({
            cancellationFee: currentFee + cancellationConfig.fee,
            totalDue: currentTotal + cancellationConfig.fee,
          });
        }
        cancellationFeeResult = {
          charged: false,
          addedToBill: true,
          amount: cancellationConfig.fee,
          reason: `Charge failed: ${stripeError.message} - added to bill`,
        };
      }
    } else if (isWithinCancellationFeeWindow) {
      // User doesn't have payment method set up, add fee to bill
      console.log(`[Cancellation] User ${userId} has no payment method configured, adding fee to bill`);
      const existingBillForFee = await UserBills.findOne({ where: { userId } });
      if (existingBillForFee) {
        const currentFee = Number(existingBillForFee.cancellationFee) || 0;
        const currentTotal = Number(existingBillForFee.totalDue) || 0;
        await existingBillForFee.update({
          cancellationFee: currentFee + cancellationConfig.fee,
          totalDue: currentTotal + cancellationConfig.fee,
        });
      }
      cancellationFeeResult = {
        charged: false,
        addedToBill: true,
        amount: cancellationConfig.fee,
        reason: "No payment method configured - added to bill",
      };
    } else if (!isWithinCancellationFeeWindow) {
      console.log(`[Cancellation] Not within cancellation fee window (${daysUntilAppointment} days > ${cancellationConfig.windowDays} days) - no fee charged`);
    }

    // Handle payment cancellation/refund for prepaid appointments
    if (appointment.paymentIntentId || appointment.paid) {
      let paymentIntent = null;

      if (appointment.paymentIntentId) {
        try {
          paymentIntent = await stripe.paymentIntents.retrieve(appointment.paymentIntentId);
        } catch (stripeRetrieveError) {
          console.error(`[Cancellation] Error retrieving payment intent: ${stripeRetrieveError.message}`);
        }
      }

      const isPaid = appointment.paid || (paymentIntent && paymentIntent.status === "succeeded");
      const platformFeePercent = platformConfig.feePercent;

      console.log(`[Cancellation] Appointment paid status: ${appointment.paid}, paymentIntent status: ${paymentIntent?.status}`);
      console.log(`[Cancellation] isWithinPenaltyWindow: ${isWithinPenaltyWindow}, hasCleanerAssigned: ${hasCleanerAssigned}`);

      if (isWithinPenaltyWindow && isPaid) {
        // Within 3 days with cleaner assigned: partial refund to client, portion to cleaner
        // If homeowner used an incentive discount, they get reduced refund (configurable, default 10% instead of 50%)
        const standardRefundPercent = cancellationConfig.refundPercentage; // 0.5 (50%)
        const discountedRefundPercent = cancellationConfig.incentiveRefundPercent || 0.10; // Default 10% if not configured
        const refundPercent = appointment.discountApplied ? discountedRefundPercent : standardRefundPercent;

        const clientRefundAmount = Math.round(priceInCents * refundPercent); // Refund based on what client paid

        let cleanerPortion, platformFee, cleanerAmount;

        if (appointment.discountApplied) {
          // Incentive cancellation: Cleaner gets configurable % of original price, platform keeps rest for Stripe fees
          const cleanerPercent = cancellationConfig.incentiveCleanerPercent || 0.40; // Default 40% if not configured
          cleanerAmount = Math.round(cleanerBasePriceInCents * cleanerPercent);
          cleanerPortion = cleanerAmount; // No separate platform fee - platform keeps what's left
          platformFee = 0; // Platform fee absorbed into what platform keeps
        } else {
          // Standard cancellation: Cleaner gets 50% minus platform fee
          cleanerPortion = Math.round(cleanerBasePriceInCents * (1 - standardRefundPercent));
          platformFee = Math.round(cleanerPortion * platformFeePercent);
          cleanerAmount = cleanerPortion - platformFee;
        }

        console.log(`[Cancellation] Discount applied: ${appointment.discountApplied}, Refund percent: ${refundPercent * 100}%`);
        console.log(`[Cancellation] Partial refund: client gets $${clientRefundAmount/100}, cleaner gets $${cleanerAmount/100}, platform keeps $${(priceInCents - clientRefundAmount - cleanerAmount)/100}`);

        if (paymentIntent && paymentIntent.status === "succeeded") {
          // Payment was captured, process partial refund to client
          refundResult = await stripe.refunds.create({
            payment_intent: paymentIntent.id,
            amount: clientRefundAmount,
          });

          // Create payout records for cleaners (their portion minus platform fee)
          const cleanerIds = appointment.employeesAssigned || [];
          const perCleanerAmount = Math.round(cleanerAmount / cleanerIds.length);
          const perCleanerGross = Math.round(cleanerPortion / cleanerIds.length);
          const perCleanerPlatformFee = Math.round(platformFee / cleanerIds.length);

          // Delete any existing pending payouts for this appointment
          await Payout.destroy({ where: { appointmentId: appointment.id, status: "pending" } });

          for (const cleanerId of cleanerIds) {
            await Payout.create({
              appointmentId: appointment.id,
              cleanerId,
              grossAmount: perCleanerGross,
              platformFee: perCleanerPlatformFee,
              netAmount: perCleanerAmount,
              status: "pending",
              paymentCapturedAt: new Date(),
            });
          }

          cleanerPayoutResult = {
            totalAmount: cleanerAmount / 100,
            perCleaner: perCleanerAmount / 100,
            cleanerCount: cleanerIds.length,
            platformFeeTotal: platformFee / 100,
          };

          await appointment.update({ paymentStatus: "partially_refunded" });
        } else if (paymentIntent && paymentIntent.status === "requires_capture") {
          // Payment authorized but not captured - cancel the auth
          await stripe.paymentIntents.cancel(paymentIntent.id);
          await appointment.update({ paymentStatus: "cancelled" });
        }
      } else if (isPaid) {
        // Paid but NOT within penalty window (or no cleaner assigned): Full refund to client
        console.log(`[Cancellation] Full refund: returning $${priceInCents/100} to client`);

        if (paymentIntent && paymentIntent.status === "succeeded") {
          refundResult = await stripe.refunds.create({
            payment_intent: paymentIntent.id,
          });
          await appointment.update({ paymentStatus: "refunded" });
        } else if (paymentIntent && paymentIntent.status === "requires_capture") {
          await stripe.paymentIntents.cancel(paymentIntent.id);
          await appointment.update({ paymentStatus: "cancelled" });
        }

        // Delete any pending payouts since cleaner won't be paid
        await Payout.destroy({ where: { appointmentId: appointment.id, status: "pending" } });
      } else {
        // Not paid yet - just cancel any pending authorization
        if (paymentIntent && paymentIntent.status === "requires_capture") {
          await stripe.paymentIntents.cancel(paymentIntent.id);
          await appointment.update({ paymentStatus: "cancelled" });
        }
      }
    }

    // Update user bills
    const existingBill = await UserBills.findOne({ where: { userId } });
    if (existingBill) {
      const appointmentTotal = appointment.paid ? 0 : price; // Only subtract if not already paid
      const oldAppt = Number(existingBill.appointmentDue);
      const oldFee = Number(existingBill.cancellationFee);
      const cancellationFeeAmount = isWithinPenaltyWindow ? price * cancellationConfig.refundPercentage : 0;

      // Ensure values don't go negative
      const newAppointmentDue = Math.max(0, oldAppt - appointmentTotal);
      const newCancellationFee = oldFee + cancellationFeeAmount;
      const newTotalDue = Math.max(0, newCancellationFee + newAppointmentDue);

      await existingBill.update({
        cancellationFee: newCancellationFee,
        appointmentDue: newAppointmentDue,
        totalDue: newTotalDue,
      });
    }

    // Send notifications to cleaners (in-app and email)
    if (hasCleanerAssigned) {
      const cleanerIds = appointment.employeesAssigned || [];
      const home = await UserHomes.findByPk(appointment.homeId);
      const homeowner = await User.findByPk(userId);

      // Use actual payout amount if available, otherwise calculate
      // If discount was applied: cleaner gets 40% of original price
      // Otherwise: cleaner gets 50% of price minus platform fee
      let cleanerPayment;
      if (cleanerPayoutResult) {
        cleanerPayment = cleanerPayoutResult.perCleaner.toFixed(2);
      } else if (appointment.discountApplied) {
        // 40% of original price to cleaner
        cleanerPayment = (cleanerBasePrice * 0.40 / cleanerIds.length).toFixed(2);
      } else {
        // Standard: 50% minus platform fee
        cleanerPayment = (cleanerBasePrice * (1 - cancellationConfig.refundPercentage) * (1 - platformConfig.feePercent) / cleanerIds.length).toFixed(2);
      }

      // Only show payment amount if appointment was paid and cleaner is getting compensated
      const showPayment = isWithinPenaltyWindow && cleanerPayoutResult;

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
            showPayment
              ? `The homeowner cancelled the ${formattedDate} cleaning. You will receive a partial payment of $${cleanerPayment}.`
              : `The homeowner cancelled the ${formattedDate} cleaning at ${home ? EncryptionService.decrypt(home.address) : "their property"}.`
          );
          await cleaner.update({ notifications: notifications.slice(0, 50) });

          // Send email notification to cleaner
          if (cleaner.email) {
            const homeAddress = home
              ? `${EncryptionService.decrypt(home.city)}, ${EncryptionService.decrypt(home.state)}`
              : "the scheduled location";

            try {
              await Email.sendHomeownerCancelledNotification(
                EncryptionService.decrypt(cleaner.email),
                cleaner.firstName ? EncryptionService.decrypt(cleaner.firstName) : cleaner.username,
                appointment.date,
                homeAddress,
                showPayment,
                showPayment ? cleanerPayment : null
              );
            } catch (emailError) {
              console.error(`Error sending cancellation email to cleaner ${cleanerId}:`, emailError);
              // Don't fail the cancellation if email fails
            }
          }
        }
      }
    }

    // Track deleted date for calendar sync to prevent re-creation
    const homeId = appointment.homeId;
    const dateStr = appointmentDate.toISOString().split('T')[0];

    const calendarSyncs = await CalendarSync.findAll({
      where: { homeId, isActive: true },
    });

    for (const sync of calendarSyncs) {
      const deletedDates = sync.deletedDates || [];
      if (!deletedDates.includes(dateStr)) {
        await sync.update({
          deletedDates: [...deletedDates, dateStr],
        });
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

    // Build response message
    let message = "Appointment cancelled successfully.";
    if (isWithinPenaltyWindow) {
      message = "Appointment cancelled. Cleaner will receive partial payment.";
    }
    if (cancellationFeeResult?.charged) {
      message += ` A $${cancellationFeeResult.amount} cancellation fee has been charged to your card.`;
    }

    console.log(`[Cancellation] Cancellation complete. Fee result:`, JSON.stringify(cancellationFeeResult));

    return res.json({
      success: true,
      message,
      refund: refundResult ? { amount: refundResult.amount / 100 } : null,
      cleanerPayout: cleanerPayoutResult,
      wasWithinPenaltyWindow: isWithinPenaltyWindow,
      cancellationFee: cancellationFeeResult,
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

    // Require acknowledgment for last-minute cancellations
    if (isWithinPenaltyWindow) {
      const { acknowledged } = req.body;
      if (!acknowledged) {
        return res.status(400).json({
          error: "Acknowledgment required",
          message: "You must acknowledge the penalties before cancelling within the penalty window. Cancelling will result in an automatic 1-star rating. 3 last-minute cancellations within 3 months will freeze your account.",
          requiresAcknowledgment: true,
        });
      }
    }

    if (isWithinPenaltyWindow) {
      // Create system cancellation penalty review
      await UserReviews.create({
        userId: userId,
        reviewerId: null, // System-generated
        reviewerName: "System",
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

        // Remove cleaner from all future appointments
        const futureAssignments = await UserCleanerAppointments.findAll({
          where: { employeeId: userId },
          include: [{
            model: UserAppointments,
            as: "appointment",
            where: {
              date: { [Op.gte]: today.toISOString().split('T')[0] },
              completed: false,
            },
          }],
        });

        for (const assignment of futureAssignments) {
          const futureAppointment = assignment.appointment;

          // Skip the current appointment being cancelled (already handled below)
          if (futureAppointment.id === parseInt(id)) continue;

          // Remove from employeesAssigned array
          let futureEmployees = Array.isArray(futureAppointment.employeesAssigned)
            ? [...futureAppointment.employeesAssigned]
            : [];
          const updatedFutureEmployees = futureEmployees.filter(
            (empId) => empId !== String(userId)
          );

          await futureAppointment.update({
            employeesAssigned: updatedFutureEmployees,
            hasBeenAssigned: updatedFutureEmployees.length > 0,
          });

          // Delete the assignment record
          await assignment.destroy();

          // Delete pending payout for this cleaner
          await Payout.destroy({
            where: {
              appointmentId: futureAppointment.id,
              cleanerId: userId,
              status: "pending",
            },
          });

          // Notify homeowner about the removed assignment
          const futureHomeowner = await User.findByPk(futureAppointment.userId);
          const futureHome = await UserHomes.findByPk(futureAppointment.homeId);

          if (futureHomeowner) {
            const notifications = futureHomeowner.notifications || [];
            const formattedDate = new Date(futureAppointment.date).toLocaleDateString(undefined, {
              weekday: "long",
              month: "short",
              day: "numeric",
            });
            notifications.unshift(
              `A cleaner has been removed from the ${formattedDate} cleaning at ${futureHome?.address || "your property"} due to account issues. A new cleaner will need to be assigned.`
            );
            await futureHomeowner.update({ notifications: notifications.slice(0, 50) });

            // Send email notification
            if (futureHome) {
              const futureAddress = {
                street: EncryptionService.decrypt(futureHome.address),
                city: EncryptionService.decrypt(futureHome.city),
                state: EncryptionService.decrypt(futureHome.state),
                zipcode: EncryptionService.decrypt(futureHome.zipcode),
              };
              await Email.sendEmailCancellation(
                EncryptionService.decrypt(futureHomeowner.email),
                futureAddress,
                futureHomeowner.username,
                futureAppointment.date
              );

              // Send push notification
              if (futureHomeowner.expoPushToken) {
                await PushNotification.sendPushCancellation(
                  futureHomeowner.expoPushToken,
                  futureHomeowner.username,
                  futureAppointment.date,
                  futureAddress
                );
              }
            }
          }
        }
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

    // Delete the approved request for this cleaner
    await UserPendingRequests.destroy({
      where: {
        appointmentId: id,
        employeeId: userId,
        status: "approved",
      },
    });

    // Reactivate any onHold requests so homeowner can choose another cleaner
    await UserPendingRequests.update(
      { status: "pending" },
      {
        where: {
          appointmentId: id,
          status: "onHold",
        },
      }
    );

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
        `A cleaner has cancelled their assignment for the ${formattedDate} cleaning at ${home ? EncryptionService.decrypt(home.address) : "your property"}. A new cleaner will need to be assigned.`
      );
      await homeowner.update({ notifications: notifications.slice(0, 50) });

      // Send email notification
      if (home) {
        const homeAddress = {
          street: EncryptionService.decrypt(home.address),
          city: EncryptionService.decrypt(home.city),
          state: EncryptionService.decrypt(home.state),
          zipcode: EncryptionService.decrypt(home.zipcode),
        };
        await Email.sendEmailCancellation(
          EncryptionService.decrypt(homeowner.email),
          homeAddress,
          homeowner.username,
          appointment.date
        );

        // Send push notification
        if (homeowner.expoPushToken) {
          await PushNotification.sendPushCancellation(
            homeowner.expoPushToken,
            homeowner.username,
            appointment.date,
            homeAddress
          );
        }
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
    contact,
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
    if (contact !== undefined) {
      userInfo = await UserInfo.editContactInDB({
        id,
        contact,
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

/**
 * POST /:id/respond
 * Client accepts or declines a pending booking
 * Body: { action: 'accept' | 'decline', declineReason?: string, suggestedDates?: string[] }
 */
appointmentRouter.post("/:id/respond", async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    const token = authHeader.split(" ")[1];
    const decoded = jwt.verify(token, secretKey);
    const userId = decoded.userId;
    const { id } = req.params;
    const { action, declineReason, suggestedDates } = req.body;

    if (!action || !["accept", "decline"].includes(action)) {
      return res.status(400).json({ error: "Invalid action. Must be 'accept' or 'decline'" });
    }

    // Find the appointment
    const appointment = await UserAppointments.findOne({
      where: {
        id,
        userId,
        clientResponsePending: true,
      },
      include: [
        {
          model: User,
          as: "bookedByCleaner",
          attributes: ["id", "firstName", "lastName", "email", "expoPushToken", "notifications"],
        },
        {
          model: UserHomes,
          as: "home",
        },
      ],
    });

    if (!appointment) {
      return res.status(404).json({ error: "Pending appointment not found" });
    }

    // Check if expired
    if (appointment.expiresAt && new Date(appointment.expiresAt) < new Date()) {
      return res.status(400).json({ error: "This booking request has expired" });
    }

    const client = await User.findByPk(userId);
    const clientName = `${EncryptionService.decrypt(client.firstName)} ${EncryptionService.decrypt(client.lastName)}`;
    const cleanerName = appointment.bookedByCleaner
      ? `${EncryptionService.decrypt(appointment.bookedByCleaner.firstName)} ${EncryptionService.decrypt(appointment.bookedByCleaner.lastName)}`
      : "Your Cleaner";

    const io = req.app.get("io");

    if (action === "accept") {
      // Accept the booking
      await appointment.update({
        clientResponsePending: false,
        clientResponse: "accepted",
        clientRespondedAt: new Date(),
      });

      // Notify business owner
      await NotificationService.notifyBookingAccepted({
        cleanerId: appointment.bookedByCleanerId,
        clientId: userId,
        appointmentId: appointment.id,
        appointmentDate: appointment.date,
        clientName,
        io,
      });

      // Mark related notification as actioned
      const relatedNotification = await Notification.findOne({
        where: {
          userId,
          relatedAppointmentId: appointment.id,
          type: "pending_booking",
        },
      });
      if (relatedNotification) {
        await NotificationService.markAsActioned(relatedNotification.id);
      }

      console.log(`[BookingResponse] Client ${userId} accepted appointment ${id}`);

      res.json({
        message: "Booking accepted successfully",
        appointment: {
          id: appointment.id,
          date: appointment.date,
          price: appointment.price,
          status: "confirmed",
        },
      });
    } else {
      // Decline the booking
      await appointment.update({
        clientResponsePending: false,
        clientResponse: "declined",
        clientRespondedAt: new Date(),
        declineReason: declineReason || null,
        suggestedDates: suggestedDates || null,
      });

      // Notify business owner
      await NotificationService.notifyBookingDeclined({
        cleanerId: appointment.bookedByCleanerId,
        clientId: userId,
        appointmentId: appointment.id,
        appointmentDate: appointment.date,
        clientName,
        declineReason,
        suggestedDates,
        io,
      });

      // Mark related notification as actioned
      const relatedNotification = await Notification.findOne({
        where: {
          userId,
          relatedAppointmentId: appointment.id,
          type: "pending_booking",
        },
      });
      if (relatedNotification) {
        await NotificationService.markAsActioned(relatedNotification.id);
      }

      console.log(`[BookingResponse] Client ${userId} declined appointment ${id}`);

      res.json({
        message: "Booking declined",
        appointment: {
          id: appointment.id,
          date: appointment.date,
          status: "declined",
        },
      });
    }
  } catch (error) {
    console.error("Error responding to booking:", error);
    res.status(500).json({ error: "Failed to respond to booking" });
  }
});

/**
 * POST /:id/rebook
 * Business owner creates a new booking after a previous one was declined
 * Body: { date, price?, timeWindow? }
 */
appointmentRouter.post("/:id/rebook", async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    const token = authHeader.split(" ")[1];
    const decoded = jwt.verify(token, secretKey);
    const cleanerId = decoded.userId;
    const { id } = req.params;
    const { date, price, timeWindow } = req.body;

    if (!date) {
      return res.status(400).json({ error: "Date is required" });
    }

    // Find the original declined appointment
    const originalAppointment = await UserAppointments.findOne({
      where: {
        id,
        bookedByCleanerId: cleanerId,
        clientResponse: "declined",
      },
      include: [
        {
          model: UserHomes,
          as: "home",
        },
        {
          model: User,
          as: "user",
          attributes: ["id", "firstName", "lastName"],
        },
      ],
    });

    if (!originalAppointment) {
      return res.status(404).json({ error: "Original declined appointment not found" });
    }

    // Check rebooking limit
    if (originalAppointment.rebookingAttempts >= 3) {
      return res.status(400).json({ error: "Maximum rebooking attempts reached" });
    }

    // Calculate price
    const appointmentPrice = price || originalAppointment.price;

    // Calculate expiration
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 48);

    // Get cleaner name
    const cleaner = await User.findByPk(cleanerId);
    const cleanerName = `${EncryptionService.decrypt(cleaner.firstName)} ${EncryptionService.decrypt(cleaner.lastName)}`;

    // Create new appointment
    const newAppointment = await UserAppointments.create({
      userId: originalAppointment.userId,
      homeId: originalAppointment.homeId,
      date,
      price: String(appointmentPrice),
      paid: false,
      completed: false,
      hasBeenAssigned: true,
      employeesAssigned: [String(cleanerId)],
      empoyeesNeeded: originalAppointment.empoyeesNeeded,
      timeToBeCompleted: timeWindow || originalAppointment.timeToBeCompleted,
      bringTowels: originalAppointment.bringTowels,
      bringSheets: originalAppointment.bringSheets,
      keyPadCode: originalAppointment.keyPadCode,
      keyLocation: originalAppointment.keyLocation,
      bookedByCleanerId: cleanerId,
      clientResponsePending: true,
      expiresAt,
      autoPayEnabled: originalAppointment.autoPayEnabled,
      businessOwnerPrice: appointmentPrice,
      originalBookingId: originalAppointment.id,
      rebookingAttempts: originalAppointment.rebookingAttempts + 1,
    });

    // Update original appointment's rebooking count
    await originalAppointment.update({
      rebookingAttempts: originalAppointment.rebookingAttempts + 1,
    });

    // Create cleaner-appointment link
    await UserCleanerAppointments.create({
      appointmentId: newAppointment.id,
      employeeId: cleanerId,
    });

    const io = req.app.get("io");

    // Notify client
    await NotificationService.notifyRebooking({
      clientId: originalAppointment.userId,
      cleanerId,
      appointmentId: newAppointment.id,
      appointmentDate: date,
      price: appointmentPrice,
      cleanerName,
      rebookingAttempt: newAppointment.rebookingAttempts,
      io,
    });

    console.log(`[Rebook] Cleaner ${cleanerId} rebooked appointment ${newAppointment.id} from original ${id}`);

    res.status(201).json({
      message: "Rebooking created successfully",
      appointment: {
        id: newAppointment.id,
        date,
        price: appointmentPrice,
        status: "pending_approval",
        expiresAt,
        rebookingAttempt: newAppointment.rebookingAttempts,
      },
    });
  } catch (error) {
    console.error("Error rebooking appointment:", error);
    res.status(500).json({ error: "Failed to create rebooking" });
  }
});

// ==========================================
// CATCH-ALL PARAMETERIZED ROUTE - MUST BE LAST
// WARNING: This route matches ANY single-segment GET path
// All other GET routes MUST be defined above this
// ==========================================

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

module.exports = appointmentRouter;
