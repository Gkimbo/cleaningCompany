/**
 * DemoAccountService
 *
 * Manages demo accounts for the owner's "Preview as Role" feature.
 * Allows platform owners to preview the app as different role types
 * (Cleaner, Homeowner, Business Owner, Employee) with full functionality.
 */

const jwt = require("jsonwebtoken");
const { User } = require("../models");

const secretKey = process.env.SESSION_SECRET;

// Role type to user type mapping
const ROLE_TYPE_MAP = {
	cleaner: "cleaner",
	homeowner: null, // null type = homeowner
	businessOwner: "cleaner", // Business owners are cleaners with isBusinessOwner=true
	employee: "employee",
};

// Demo account email prefixes for identification
const DEMO_EMAIL_PREFIX = "demo_";
const DEMO_USERNAMES = {
	cleaner: "demo_cleaner",
	homeowner: "demo_homeowner",
	businessOwner: "demo_business_owner",
	employee: "demo_employee",
};

class DemoAccountService {
	/**
	 * Get all demo accounts
	 * @returns {Promise<Array>} List of demo accounts with their role types
	 */
	static async getDemoAccounts() {
		try {
			const demoAccounts = await User.findAll({
				where: { isDemoAccount: true },
				attributes: [
					"id",
					"username",
					"firstName",
					"lastName",
					"type",
					"isBusinessOwner",
					"businessName",
				],
			});

			return demoAccounts.map((account) => ({
				id: account.id,
				username: account.username,
				name: `${account.firstName} ${account.lastName}`,
				role: this.getUserRole(account),
				type: account.type,
				isBusinessOwner: account.isBusinessOwner,
				businessName: account.businessName,
			}));
		} catch (error) {
			console.error("[DemoAccountService] Error fetching demo accounts:", error);
			throw error;
		}
	}

	/**
	 * Get a specific demo account by role
	 * @param {string} role - Role type: 'cleaner', 'homeowner', 'businessOwner', 'employee'
	 * @returns {Promise<Object|null>} Demo account or null
	 */
	static async getDemoAccountByRole(role) {
		try {
			const username = DEMO_USERNAMES[role];
			if (!username) {
				throw new Error(`Invalid role: ${role}`);
			}

			const account = await User.findOne({
				where: {
					isDemoAccount: true,
					username,
				},
			});

			return account;
		} catch (error) {
			console.error(`[DemoAccountService] Error fetching demo account for role ${role}:`, error);
			throw error;
		}
	}

	/**
	 * Create a preview session - generates a token for the demo account
	 * @param {number} ownerId - The owner's user ID (for audit logging)
	 * @param {string} role - Role to preview: 'cleaner', 'homeowner', 'businessOwner', 'employee'
	 * @returns {Promise<Object>} Preview session data with token and user info
	 */
	static async createPreviewSession(ownerId, role) {
		try {
			// Verify the owner is actually an owner
			const owner = await User.findByPk(ownerId);
			if (!owner || owner.type !== "owner") {
				throw new Error("Only platform owners can create preview sessions");
			}

			// Get the demo account for this role
			const demoAccount = await this.getDemoAccountByRole(role);
			if (!demoAccount) {
				throw new Error(`Demo account not found for role: ${role}. Please run the demo account seeder.`);
			}

			// Generate a token for the demo account
			// Mark it as a preview session with metadata
			const token = jwt.sign(
				{
					userId: demoAccount.id,
					isPreviewSession: true,
					originalOwnerId: ownerId,
					previewRole: role,
				},
				secretKey,
				{ expiresIn: "4h" } // Preview sessions expire after 4 hours
			);

			// Log the preview session start
			console.log(`[DemoAccountService] Preview session started: Owner ${ownerId} -> ${role} (Demo account ${demoAccount.id})`);

			return {
				success: true,
				token,
				user: {
					id: demoAccount.id,
					username: demoAccount.username,
					firstName: demoAccount.firstName,
					lastName: demoAccount.lastName,
					email: demoAccount.email,
					type: demoAccount.type,
					isBusinessOwner: demoAccount.isBusinessOwner,
					businessName: demoAccount.businessName,
					isDemoAccount: true,
				},
				previewRole: role,
				originalOwnerId: ownerId,
			};
		} catch (error) {
			console.error("[DemoAccountService] Error creating preview session:", error);
			throw error;
		}
	}

	/**
	 * End a preview session - returns the owner's token
	 * @param {number} ownerId - The original owner's user ID
	 * @returns {Promise<Object>} Owner session data with new token
	 */
	static async endPreviewSession(ownerId) {
		try {
			const owner = await User.findByPk(ownerId);
			if (!owner || owner.type !== "owner") {
				throw new Error("Invalid owner ID for ending preview session");
			}

			// Generate a fresh token for the owner
			const token = jwt.sign(
				{ userId: owner.id },
				secretKey,
				{ expiresIn: "24h" }
			);

			// Log the preview session end
			console.log(`[DemoAccountService] Preview session ended: Owner ${ownerId} returned to owner mode`);

			return {
				success: true,
				token,
				user: {
					id: owner.id,
					username: owner.username,
					firstName: owner.firstName,
					lastName: owner.lastName,
					email: owner.email,
					type: owner.type,
				},
			};
		} catch (error) {
			console.error("[DemoAccountService] Error ending preview session:", error);
			throw error;
		}
	}

	/**
	 * Check if a token is from a preview session
	 * @param {Object} decodedToken - Decoded JWT token
	 * @returns {boolean} True if this is a preview session token
	 */
	static isPreviewSession(decodedToken) {
		return decodedToken && decodedToken.isPreviewSession === true;
	}

	/**
	 * Get the user role from a User model instance
	 * @param {Object} user - User model instance
	 * @returns {string} Role type
	 */
	static getUserRole(user) {
		if (user.type === "employee") return "employee";
		if (user.type === "cleaner" && user.isBusinessOwner) return "businessOwner";
		if (user.type === "cleaner") return "cleaner";
		if (user.type === "owner") return "owner";
		if (user.type === "humanResources") return "humanResources";
		return "homeowner";
	}

	/**
	 * Get available preview roles
	 * @returns {Array} List of available roles with descriptions
	 */
	static getAvailableRoles() {
		return [
			{
				role: "cleaner",
				label: "Cleaner",
				description: "See the marketplace, jobs, and earnings",
				icon: "broom",
			},
			{
				role: "homeowner",
				label: "Homeowner",
				description: "See booking, homes, and bills",
				icon: "home",
			},
			{
				role: "businessOwner",
				label: "Business Owner",
				description: "See employees, clients, and analytics",
				icon: "briefcase",
			},
			{
				role: "employee",
				label: "Employee",
				description: "See assigned jobs and schedule",
				icon: "user-tie",
			},
		];
	}
}

module.exports = DemoAccountService;
