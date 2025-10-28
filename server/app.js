/* eslint-disable no-unused-vars */ 
/* eslint-disable no-console */
const express = require("express");
const passport = require("passport");
const cors = require("cors");
const session = require("express-session");

require("dotenv").config();
require("./passport-config");

const rootRouter = require("./routes/rootRouter");

const clientURL = "http://localhost:19006";
const secretKey = process.env.SESSION_SECRET;

const app = express();
const port = 3000;

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

// Start server
app.listen(port, () => {
	console.log(`Server running on port ${port}`);
});
