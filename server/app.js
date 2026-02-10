/* eslint-disable no-unused-vars */
/* eslint-disable no-console */
const express = require("express");
const passport = require("passport");
const cors = require("cors");
const session = require("express-session");
const http = require("http");
const { Server } = require("socket.io");
const jwt = require("jsonwebtoken");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");

require("dotenv").config();
require("./passport-config");

const rootRouter = require("./routes/rootRouter");
const { startPeriodicSync } = require("./services/calendarSyncService");
const { startBillingScheduler } = require("./services/billingService");
const { startCompletionApprovalMonitor } = require("./services/cron/CompletionApprovalMonitor");
const { startAutoCompleteMonitor } = require("./services/cron/AutoCompleteMonitor");
const { startApprovalTimeoutJob } = require("./services/cron/CleanerApprovalTimeoutJob");
const { startTenantPresentTimeoutJob } = require("./services/cron/TenantPresentTimeoutJob");
const { startExpirationJob: startHomeSizeExpirationJob } = require("./services/cron/HomeSizeAdjustmentExpirationJob");

// Allow multiple origins for web, iOS simulator, and Android emulator
const allowedOrigins = [
	"http://localhost:19006",
	"http://localhost:8081",
	"http://localhost:8082",
	"http://localhost:8083",
	"http://localhost:8084",
	"http://localhost:8085",
	"http://localhost:19000",
	"http://10.0.2.2:8081", // Android emulator
];

const clientURL = "http://localhost:19006"; // Default for backwards compatibility
const secretKey = process.env.SESSION_SECRET;

// Rate limiters for API security
const apiLimiter = rateLimit({
	windowMs: 15 * 60 * 1000, // 15 minutes
	max: 10000, // 10000 requests per window
	message: { error: "Too many requests, please try again later" },
	standardHeaders: true,
	legacyHeaders: false,
});

const authLimiter = rateLimit({
	windowMs: 15 * 60 * 1000, // 15 minutes
	max: 10, // 10 login attempts per 15 minutes
	message: { error: "Too many login attempts, please try again later" },
	standardHeaders: true,
	legacyHeaders: false,
});

const app = express();
const port = 3000;

// Create HTTP server and Socket.io instance
const server = http.createServer(app);
const io = new Server(server, {
	cors: {
		origin: allowedOrigins,
		credentials: true,
	},
});

// Socket.io authentication middleware
io.use((socket, next) => {
	const token = socket.handshake.auth.token;
	if (!token) {
		return next(new Error("Authentication required"));
	}

	jwt.verify(token, secretKey, (err, decoded) => {
		if (err) {
			return next(new Error("Invalid token"));
		}
		socket.userId = decoded.userId;
		next();
	});
});

// Socket.io connection handler
io.on("connection", (socket) => {
	console.log(`User ${socket.userId} connected to socket`);

	// Join user to their personal room for direct notifications
	socket.join(`user_${socket.userId}`);

	// Join a conversation room
	socket.on("join_conversation", (conversationId) => {
		socket.join(`conversation_${conversationId}`);
		console.log(`User ${socket.userId} joined conversation ${conversationId}`);
	});

	// Leave a conversation room
	socket.on("leave_conversation", (conversationId) => {
		socket.leave(`conversation_${conversationId}`);
		console.log(`User ${socket.userId} left conversation ${conversationId}`);
	});

	socket.on("disconnect", () => {
		console.log(`User ${socket.userId} disconnected from socket`);
	});
});

// Make io accessible to routes
app.set("io", io);

// Security headers with Helmet
app.use(helmet({
	contentSecurityPolicy: {
		directives: {
			defaultSrc: ["'self'"],
			scriptSrc: ["'self'"],
			styleSrc: ["'self'", "'unsafe-inline'"],
			imgSrc: ["'self'", "data:", "https:"],
		}
	},
	hsts: { maxAge: 31536000, includeSubDomains: true },
	frameguard: { action: "deny" },
	noSniff: true,
	xssFilter: true,
}));

// CORS & headers
app.use(
	cors({
		origin: function (origin, callback) {
			// Allow requests with no origin (mobile apps, curl, etc.)
			if (!origin) return callback(null, true);
			if (allowedOrigins.includes(origin)) {
				return callback(null, true);
			}
			return callback(new Error("Not allowed by CORS"));
		},
		credentials: true,
	})
);

app.use((req, res, next) => {
	const origin = req.headers.origin;
	if (allowedOrigins.includes(origin)) {
		res.setHeader("Access-Control-Allow-Origin", origin);
	}
	res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE");
	res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
	res.setHeader("Access-Control-Allow-Credentials", "true");
	next();
});

// Session with secure cookie settings
app.use(
	session({
		secret: secretKey,
		resave: false,
		saveUninitialized: false,
		cookie: {
			maxAge: 24 * 60 * 60 * 1000, // 24 hours (reduced from 30 days)
			httpOnly: true,
			secure: process.env.NODE_ENV === "production",
			sameSite: "strict",
		},
	})
);

// Passport
app.use(passport.initialize());
app.use(passport.session());

// Stripe Webhook needs raw body
app.use("/api/v1/payments/webhook", express.raw({ type: "application/json" }));

// Normal JSON parsing for other routes (increased limit for photo uploads)
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Apply rate limiting
app.use("/api/", apiLimiter);
app.use("/api/v1/user-sessions/login", authLimiter);
app.use("/api/v1/user-sessions/forgot-password", authLimiter);
app.use("/api/v1/user-sessions/forgot-username", authLimiter);

// Routes
app.use(rootRouter);

// Start server (use http server for Socket.io)
server.listen(port, () => {
	console.log(`Server running on port ${port}`);

	// Start periodic calendar sync (every hour)
	// Only in non-test environment
	if (process.env.NODE_ENV !== "test") {
		startPeriodicSync(60 * 60 * 1000); // 1 hour
		startBillingScheduler(); // Monthly interest on unpaid fees
		startCompletionApprovalMonitor(io, 15 * 60 * 1000); // 2-step completion auto-approval (every 15 min)
		startAutoCompleteMonitor(io, 5 * 60 * 1000); // Auto-complete reminders and fallback (every 5 min)
		startApprovalTimeoutJob(io, 15 * 60 * 1000); // Multi-cleaner join request auto-approval (every 15 min)
		startTenantPresentTimeoutJob(io, 5 * 60 * 1000); // Tenant present response/return timeouts (every 5 min)
		startHomeSizeExpirationJob(io, 15 * 60 * 1000); // Home size adjustment expiration (every 15 min)
	}
});
