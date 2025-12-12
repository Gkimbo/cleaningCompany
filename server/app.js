/* eslint-disable no-unused-vars */
/* eslint-disable no-console */
const express = require("express");
const passport = require("passport");
const cors = require("cors");
const session = require("express-session");
const http = require("http");
const { Server } = require("socket.io");
const jwt = require("jsonwebtoken");

require("dotenv").config();
require("./passport-config");

const rootRouter = require("./routes/rootRouter");

const clientURL = "http://localhost:19006";
const secretKey = process.env.SESSION_SECRET;

const app = express();
const port = 3000;

// Create HTTP server and Socket.io instance
const server = http.createServer(app);
const io = new Server(server, {
	cors: {
		origin: clientURL,
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

// CORS & headers
app.use(
	cors({
		origin: clientURL,
		credentials: true,
	})
);

app.use((req, res, next) => {
	res.setHeader("Access-Control-Allow-Origin", clientURL);
	res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE");
	res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
	res.setHeader("Access-Control-Allow-Credentials", "true");
	next();
});

// Session
app.use(
	session({
		secret: secretKey,
		resave: false,
		saveUninitialized: false,
		cookie: { maxAge: 30 * 24 * 60 * 60 * 1000 }, // 30 days
	})
);

// Passport
app.use(passport.initialize());
app.use(passport.session());

// Stripe Webhook needs raw body
app.use("/api/v1/payments/webhook", express.raw({ type: "application/json" }));

// Normal JSON parsing for other routes
app.use(express.json());

// Routes
app.use(rootRouter);

// Start server (use http server for Socket.io)
server.listen(port, () => {
	console.log(`Server running on port ${port}`);
});
