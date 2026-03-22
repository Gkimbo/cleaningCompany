const jwt = require("jsonwebtoken");
const { User } = require("../models");

const secretKey = process.env.SESSION_SECRET;

/**
 * Middleware to verify the user is either an owner or IT staff
 * Used for IT dashboard routes and IT dispute resolution
 */
const verifyITOrOwner = async (req, res, next) => {
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

    if (user.type !== "owner" && user.type !== "it") {
      return res.status(403).json({ error: "IT or Owner access required" });
    }

    req.user = user;
    next();
  } catch (err) {
    if (err.name === "JsonWebTokenError" || err.name === "TokenExpiredError") {
      return res.status(401).json({ error: "Invalid or expired token" });
    }
    console.error("Error in verifyITOrOwner middleware:", err);
    return res.status(500).json({ error: "Server error" });
  }
};

module.exports = verifyITOrOwner;
