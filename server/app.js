/* eslint-disable no-unused-vars */
/* eslint-disable no-console */
const express = require("express");
const bodyParser = require("body-parser");
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

// Middleware
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
app.use(
	session({
		secret: secretKey,
		resave: false,
		saveUninitialized: false,
		cookie: {
			maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days in milliseconds
		},
	})
);

app.use(bodyParser.json());
app.use(passport.initialize());
app.use(passport.session());

// Routes
app.use(rootRouter);

// Start the server
const server = app.listen(port, () => {
	console.log(`Server is running on port ${port}`);
});
