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
 * Middleware to verify the user is a platform owner or in preview mode
 * Allows:
 * - Direct owner access (user.type === "owner")
 * - Preview mode access (token contains originalOwnerId from a preview session)
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

		// Check if this is a direct owner or a preview session
		if (user.type === "owner") {
			// Direct owner access
			req.user = user;
			req.ownerId = user.id;
			req.isPreviewMode = false;
		} else if (decoded.originalOwnerId) {
			// This is a preview session token - verify the original owner exists
			const originalOwner = await User.findByPk(decoded.originalOwnerId);
			if (!originalOwner || originalOwner.type !== "owner") {
				return res.status(403).json({ error: "Invalid preview session" });
			}
			req.user = user;
			req.ownerId = decoded.originalOwnerId;
			req.isPreviewMode = true;
			req.previewRole = decoded.previewRole;
		} else {
			return res.status(403).json({ error: "Owner access required" });
		}

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
		const validRoles = DemoAccountService.getAvailableRoles().map(r => r.role);

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
 * POST /demo-accounts/switch/:role
 * Switch from current demo role to another without exiting preview mode
 * Preserves demo data - only changes which demo account is active
 */
router.post("/switch/:role", async (req, res) => {
	try {
		const { role } = req.params;
		const validRoles = DemoAccountService.getAvailableRoles().map(r => r.role);

		if (!validRoles.includes(role)) {
			return res.status(400).json({
				error: `Invalid role: ${role}. Valid roles: ${validRoles.join(", ")}`,
			});
		}

		// Get the original owner ID from the request body or token
		let ownerId = req.body.ownerId;

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

		// Fallback to current owner if still not found
		if (!ownerId) {
			ownerId = req.ownerId;
		}

		// Create new session for the target role (same as entering preview mode)
		const session = await DemoAccountService.createPreviewSession(
			ownerId,
			role
		);

		res.json({
			...session,
			switched: true,
			message: `Switched to ${role} demo account`,
		});
	} catch (error) {
		console.error("Error switching preview role:", error);
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

/**
 * POST /demo-accounts/reset
 * Reset all demo data back to original seeder state
 * This allows owners to restore demo accounts after testing
 * If currentRole is provided, returns a new session token for that role
 */
router.post("/reset", async (req, res) => {
	try {
		console.log(`[demoAccountRouter] Reset demo data requested by owner ${req.ownerId}`);

		// Get the current preview role from request body or token
		let currentRole = req.body.currentRole;
		if (!currentRole && req.previewRole) {
			currentRole = req.previewRole;
		}

		const result = await DemoAccountService.resetDemoData();

		if (!result.success) {
			return res.status(400).json({
				success: false,
				error: result.error || "Failed to reset demo data",
			});
		}

		// If we're in preview mode, create a new session for the current role
		let newSession = null;
		if (currentRole && req.isPreviewMode) {
			try {
				newSession = await DemoAccountService.createPreviewSession(
					req.ownerId,
					currentRole
				);
				console.log(`[demoAccountRouter] Created new session for role: ${currentRole}`);
			} catch (sessionError) {
				console.error("[demoAccountRouter] Failed to create new session:", sessionError);
				// Don't fail the whole request, just note that session creation failed
			}
		}

		res.json({
			success: true,
			message: result.message,
			deleted: result.deleted,
			created: result.accounts,
			// Include new session data if available
			...(newSession && {
				newSession: {
					token: newSession.token,
					user: newSession.user,
					previewRole: newSession.previewRole,
				},
			}),
		});
	} catch (error) {
		console.error("Error resetting demo data:", error);
		res.status(500).json({ error: error.message });
	}
});

module.exports = router;
