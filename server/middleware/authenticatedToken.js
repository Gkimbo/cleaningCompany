const jwt = require("jsonwebtoken");
const { User } = require("../models");

const secretKey = process.env.SESSION_SECRET;

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

		if (user && user.accountFrozen) {
			return res.status(403).json({
				message: "Your account has been suspended",
				reason: user.accountFrozenReason || "Please contact support for more information",
				accountSuspended: true,
			});
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
