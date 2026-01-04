const jwt = require("jsonwebtoken");
const { User, BusinessEmployee } = require("../models");

const secretKey = process.env.SESSION_SECRET;

/**
 * Middleware to verify the user is a business employee
 * Used for employee-facing routes (viewing assigned jobs, etc.)
 */
const verifyBusinessEmployee = async (req, res, next) => {
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

    // Check if user is an employee (has employeeOfBusinessId)
    if (!user.employeeOfBusinessId) {
      return res.status(403).json({ error: "Business employee access required" });
    }

    if (user.accountFrozen) {
      return res.status(403).json({ error: "Account is suspended" });
    }

    // Get the employee record
    const employeeRecord = await BusinessEmployee.findOne({
      where: {
        userId: user.id,
        status: "active",
      },
    });

    if (!employeeRecord) {
      return res.status(403).json({ error: "Employee record not found or inactive" });
    }

    req.user = user;
    req.employeeRecord = employeeRecord;
    req.businessOwnerId = user.employeeOfBusinessId;
    next();
  } catch (err) {
    if (err.name === "JsonWebTokenError" || err.name === "TokenExpiredError") {
      return res.status(401).json({ error: "Invalid or expired token" });
    }
    console.error("Error in verifyBusinessEmployee middleware:", err);
    return res.status(500).json({ error: "Server error" });
  }
};

module.exports = verifyBusinessEmployee;
