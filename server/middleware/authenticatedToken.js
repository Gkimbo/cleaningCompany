const jwt = require("jsonwebtoken");
const { User } = require("../models");

const secretKey = process.env.SESSION_SECRET;

// Routes that frozen users can still access
const FROZEN_ALLOWED_ROUTES = [
	"/api/v1/user-sessions/current",
	"/api/v1/user-sessions/logout",
	"/api/v1/user-info",
	"/api/v1/messages",
	"/api/v1/notifications",
	"/api/v1/account-settings",
	"/api/v1/employee-info",
];

// Check if the current path is allowed for frozen users
const isAllowedForFrozen = (fullPath) => {
	return FROZEN_ALLOWED_ROUTES.some(
		(route) => fullPath === route || fullPath.startsWith(route + "/")
	);
};

const authenticateToken = async (req, res, next) => {
	const token = req.headers.authorization?.split(" ")[1];
	if (!token) {
		return res.status(401).json({ message: "No token provided" });
	}

	try {
		const decoded = jwt.verify(token, secretKey);
		req.userId = decoded.userId;

		// Check if user account is suspended
		const user = await User.findByPk(decoded.userId, {
			attributes: ["id", "accountFrozen", "accountFrozenReason"],
		});

		// Allow frozen users to access certain routes
		// Use originalUrl to get the full path including the router base
		const fullPath = req.originalUrl.split("?")[0]; // Remove query params
		if (user && user.accountFrozen && !isAllowedForFrozen(fullPath)) {
			return res.status(403).json({
				message: "Your account has been suspended",
				reason: user.accountFrozenReason || "Please contact support for more information",
				accountSuspended: true,
			});
		}

		// Attach frozen status to request for routes that need it
		if (user) {
			req.accountFrozen = user.accountFrozen;
			req.accountFrozenReason = user.accountFrozenReason;
		}

		next();
	} catch (err) {
		if (err.name === "JsonWebTokenError" || err.name === "TokenExpiredError") {
			return res.status(403).json({ message: "Invalid token" });
		}
		console.error("Error in authenticateToken middleware:", err);
		return res.status(500).json({ message: "Server error" });
	}
};

module.exports = authenticateToken;
