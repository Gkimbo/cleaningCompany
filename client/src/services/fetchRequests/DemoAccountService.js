/**
 * DemoAccountService (Frontend)
 *
 * Client-side service for the owner's "Preview as Role" feature.
 * Handles API calls to demo account endpoints.
 */

import { API_BASE } from "../config";

class DemoAccountService {
	/**
	 * Get list of available demo accounts
	 * @param {string} token - Owner's auth token
	 * @returns {Object} { success, demoAccounts, availableRoles }
	 */
	static async getDemoAccounts(token) {
		try {
			const response = await fetch(`${API_BASE}/demo-accounts`, {
				headers: {
					Authorization: `Bearer ${token}`,
				},
			});

			const data = await response.json();

			if (!response.ok) {
				return {
					success: false,
					error: data.error || "Failed to fetch demo accounts",
				};
			}

			return data;
		} catch (error) {
			console.error("[DemoAccountService] Error fetching demo accounts:", error);
			return {
				success: false,
				error: "Network error. Please check your connection.",
			};
		}
	}

	/**
	 * Get available preview roles
	 * @param {string} token - Owner's auth token
	 * @returns {Object} { success, roles }
	 */
	static async getAvailableRoles(token) {
		try {
			const response = await fetch(`${API_BASE}/demo-accounts/roles`, {
				headers: {
					Authorization: `Bearer ${token}`,
				},
			});

			const data = await response.json();

			if (!response.ok) {
				return {
					success: false,
					error: data.error || "Failed to fetch roles",
				};
			}

			return data;
		} catch (error) {
			console.error("[DemoAccountService] Error fetching roles:", error);
			return {
				success: false,
				error: "Network error. Please check your connection.",
			};
		}
	}

	/**
	 * Enter preview mode for a specific role
	 * @param {string} token - Owner's auth token
	 * @param {string} role - Role to preview: 'cleaner', 'homeowner', 'businessOwner', 'employee'
	 * @returns {Object} { success, token, user, previewRole, originalOwnerId }
	 */
	static async enterPreviewMode(token, role) {
		try {
			const response = await fetch(`${API_BASE}/demo-accounts/enter/${role}`, {
				method: "POST",
				headers: {
					Authorization: `Bearer ${token}`,
					"Content-Type": "application/json",
				},
			});

			const data = await response.json();

			if (!response.ok) {
				return {
					success: false,
					error: data.error || "Failed to enter preview mode",
				};
			}

			return data;
		} catch (error) {
			console.error("[DemoAccountService] Error entering preview mode:", error);
			return {
				success: false,
				error: "Network error. Please check your connection.",
			};
		}
	}

	/**
	 * Exit preview mode and return to owner
	 * @param {string} token - Current session token (could be demo account token)
	 * @param {number} ownerId - Original owner's user ID
	 * @returns {Object} { success, token, user }
	 */
	static async exitPreviewMode(token, ownerId) {
		try {
			const response = await fetch(`${API_BASE}/demo-accounts/exit`, {
				method: "POST",
				headers: {
					Authorization: `Bearer ${token}`,
					"Content-Type": "application/json",
				},
				body: JSON.stringify({ ownerId }),
			});

			const data = await response.json();

			if (!response.ok) {
				return {
					success: false,
					error: data.error || "Failed to exit preview mode",
				};
			}

			return data;
		} catch (error) {
			console.error("[DemoAccountService] Error exiting preview mode:", error);
			return {
				success: false,
				error: "Network error. Please check your connection.",
			};
		}
	}

	/**
	 * Check if a demo account exists for a role
	 * @param {string} token - Owner's auth token
	 * @param {string} role - Role to check
	 * @returns {Object} { exists, role, account }
	 */
	static async checkDemoAccount(token, role) {
		try {
			const response = await fetch(`${API_BASE}/demo-accounts/check/${role}`, {
				headers: {
					Authorization: `Bearer ${token}`,
				},
			});

			const data = await response.json();

			if (!response.ok) {
				return {
					exists: false,
					error: data.error || "Failed to check demo account",
				};
			}

			return data;
		} catch (error) {
			console.error("[DemoAccountService] Error checking demo account:", error);
			return {
				exists: false,
				error: "Network error. Please check your connection.",
			};
		}
	}
}

export default DemoAccountService;
