const jwt = require("jsonwebtoken");
const { User } = require("../models");

const secretKey = process.env.SESSION_SECRET;

/**
 * Middleware to verify the user is a business owner
 * Used for business owner dashboard and employee management routes
 */
const verifyBusinessOwner = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Authorization token required" });
  }

  try {
    const token = authHeader.split(" ")[1];
    const decoded = jwt.verify(token, secretKey);
    const user = await User.findByPk(decoded.userId);

    if (!user) {
      return res.status(401).json({ error: "User not found" });
    }

    if (!user.isBusinessOwner) {
      return res.status(403).json({ error: "Business owner access required" });
    }

    if (user.accountFrozen) {
      return res.status(403).json({ error: "Account is suspended" });
    }

    req.user = user;
    req.businessOwnerId = user.id;
    next();
  } catch (err) {
    if (err.name === "JsonWebTokenError" || err.name === "TokenExpiredError") {
      return res.status(401).json({ error: "Invalid or expired token" });
    }
    console.error("Error in verifyBusinessOwner middleware:", err);
    return res.status(500).json({ error: "Server error" });
  }
};

module.exports = verifyBusinessOwner;
