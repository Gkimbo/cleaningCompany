/**
 * Demo Account Router
 *
 * API endpoints for the owner's "Preview as Role" feature.
 * Allows platform owners to preview the app as different role types.
 *
 * All endpoints require owner authentication.
 */

const express = require("express");
const jwt = require("jsonwebtoken");
const { User } = require("../../../models");
const DemoAccountService = require("../../../services/DemoAccountService");

const router = express.Router();
const secretKey = process.env.SESSION_SECRET;

/**
 * Middleware to verify the user is a platform owner
 */
const verifyOwner = async (req, res, next) => {
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

		if (user.type !== "owner") {
			return res.status(403).json({ error: "Owner access required" });
		}

		req.user = user;
		req.ownerId = user.id;
		next();
	} catch (err) {
		if (err.name === "JsonWebTokenError" || err.name === "TokenExpiredError") {
			return res.status(401).json({ error: "Invalid or expired token" });
		}
		console.error("Error in verifyOwner middleware:", err);
		return res.status(500).json({ error: "Server error" });
	}
};

// Apply owner verification to all routes
router.use(verifyOwner);

/**
 * GET /demo-accounts
 * Get list of available demo accounts
 */
router.get("/", async (req, res) => {
	try {
		const demoAccounts = await DemoAccountService.getDemoAccounts();
		const availableRoles = DemoAccountService.getAvailableRoles();

		res.json({
			success: true,
			demoAccounts,
			availableRoles,
		});
	} catch (error) {
		console.error("Error fetching demo accounts:", error);
		res.status(500).json({ error: error.message });
	}
});

/**
 * GET /demo-accounts/roles
 * Get available preview roles with descriptions
 */
router.get("/roles", async (req, res) => {
	try {
		const roles = DemoAccountService.getAvailableRoles();
		res.json({ success: true, roles });
	} catch (error) {
		console.error("Error fetching roles:", error);
		res.status(500).json({ error: error.message });
	}
});

/**
 * POST /demo-accounts/enter/:role
 * Start a preview session for the specified role
 */
router.post("/enter/:role", async (req, res) => {
	try {
		const { role } = req.params;
		const validRoles = ["cleaner", "homeowner", "businessOwner", "employee"];

		if (!validRoles.includes(role)) {
			return res.status(400).json({
				error: `Invalid role: ${role}. Valid roles: ${validRoles.join(", ")}`,
			});
		}

		const session = await DemoAccountService.createPreviewSession(
			req.ownerId,
			role
		);

		res.json(session);
	} catch (error) {
		console.error("Error entering preview mode:", error);
		res.status(500).json({ error: error.message });
	}
});

/**
 * POST /demo-accounts/exit
 * End preview session and return to owner mode
 * Note: This endpoint accepts the original owner ID from the preview token
 */
router.post("/exit", async (req, res) => {
	try {
		// Get the original owner ID from the request
		// The frontend should pass this, or we can try to decode from the token
		let ownerId = req.body.ownerId;

		// If not provided in body, try to get from the current token's metadata
		if (!ownerId) {
			const authHeader = req.headers.authorization;
			if (authHeader) {
				const token = authHeader.split(" ")[1];
				const decoded = jwt.decode(token);
				if (decoded && decoded.originalOwnerId) {
					ownerId = decoded.originalOwnerId;
				}
			}
		}

		// If still no owner ID, use the current user (if they're already an owner)
		if (!ownerId) {
			ownerId = req.ownerId;
		}

		const session = await DemoAccountService.endPreviewSession(ownerId);
		res.json(session);
	} catch (error) {
		console.error("Error exiting preview mode:", error);
		res.status(500).json({ error: error.message });
	}
});

/**
 * GET /demo-accounts/check/:role
 * Check if a demo account exists for the specified role
 */
router.get("/check/:role", async (req, res) => {
	try {
		const { role } = req.params;
		const account = await DemoAccountService.getDemoAccountByRole(role);

		res.json({
			exists: !!account,
			role,
			account: account
				? {
						id: account.id,
						username: account.username,
						name: `${account.firstName} ${account.lastName}`,
				  }
				: null,
		});
	} catch (error) {
		console.error("Error checking demo account:", error);
		res.status(500).json({ error: error.message });
	}
});

module.exports = router;
