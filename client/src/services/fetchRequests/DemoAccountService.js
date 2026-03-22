/**
 * DemoAccountService (Frontend)
 *
 * Client-side service for the owner's "Preview as Role" feature.
 * Handles API calls to demo account endpoints.
 */

import HttpClient from "../HttpClient";

class DemoAccountService {
  /**
   * Get list of available demo accounts
   * @param {string} token - Owner's auth token
   * @returns {Object} { success, demoAccounts, availableRoles }
   */
  static async getDemoAccounts(token) {
    const result = await HttpClient.get("/demo-accounts", { token });

    if (result.success === false) {
      __DEV__ && console.warn("[DemoAccountService] getDemoAccounts failed:", result.error);
      return {
        success: false,
        error: result.error || "Failed to fetch demo accounts",
      };
    }

    return result;
  }

  /**
   * Get available preview roles
   * @param {string} token - Owner's auth token
   * @returns {Object} { success, roles }
   */
  static async getAvailableRoles(token) {
    const result = await HttpClient.get("/demo-accounts/roles", { token });

    if (result.success === false) {
      __DEV__ && console.warn("[DemoAccountService] getAvailableRoles failed:", result.error);
      return {
        success: false,
        error: result.error || "Failed to fetch roles",
      };
    }

    return result;
  }

  /**
   * Enter preview mode for a specific role
   * @param {string} token - Owner's auth token
   * @param {string} role - Role to preview: 'cleaner', 'homeowner', 'businessOwner', 'employee'
   * @returns {Object} { success, token, user, previewRole, originalOwnerId }
   */
  static async enterPreviewMode(token, role) {
    const result = await HttpClient.post(`/demo-accounts/enter/${role}`, {}, { token });

    if (result.success === false) {
      __DEV__ && console.warn("[DemoAccountService] enterPreviewMode failed:", result.error);
      return {
        success: false,
        error: result.error || "Failed to enter preview mode",
      };
    }

    return result;
  }

  /**
   * Exit preview mode and return to owner
   * @param {string} token - Current session token (could be demo account token)
   * @param {number} ownerId - Original owner's user ID
   * @returns {Object} { success, token, user }
   */
  static async exitPreviewMode(token, ownerId) {
    const result = await HttpClient.post("/demo-accounts/exit", { ownerId }, { token });

    if (result.success === false) {
      __DEV__ && console.warn("[DemoAccountService] exitPreviewMode failed:", result.error);
      return {
        success: false,
        error: result.error || "Failed to exit preview mode",
      };
    }

    return result;
  }

  /**
   * Check if a demo account exists for a role
   * @param {string} token - Owner's auth token
   * @param {string} role - Role to check
   * @returns {Object} { exists, role, account }
   */
  static async checkDemoAccount(token, role) {
    const result = await HttpClient.get(`/demo-accounts/check/${role}`, { token });

    if (result.success === false) {
      __DEV__ && console.warn("[DemoAccountService] checkDemoAccount failed:", result.error);
      return {
        exists: false,
        error: result.error || "Failed to check demo account",
      };
    }

    return result;
  }

  /**
   * Reset all demo data back to original seeder state
   * @param {string} token - Owner's auth token (can be demo account token during preview)
   * @param {string} currentRole - Current preview role (optional, used to get new session after reset)
   * @returns {Object} { success, message, deleted, created, newSession }
   */
  static async resetDemoData(token, currentRole = null) {
    const result = await HttpClient.post("/demo-accounts/reset", { currentRole }, { token });

    if (result.success === false) {
      __DEV__ && console.warn("[DemoAccountService] resetDemoData failed:", result.error);
      return {
        success: false,
        error: result.error || "Failed to reset demo data",
      };
    }

    return result;
  }

  /**
   * Switch to a different demo role without exiting preview mode
   * @param {string} token - Current session token (demo account token)
   * @param {string} role - Target role to switch to
   * @param {number} ownerId - Original owner's user ID
   * @returns {Object} { success, token, user, previewRole, switched }
   */
  static async switchPreviewRole(token, role, ownerId) {
    const result = await HttpClient.post(`/demo-accounts/switch/${role}`, { ownerId }, { token });

    if (result.success === false) {
      __DEV__ && console.warn("[DemoAccountService] switchPreviewRole failed:", result.error);
      return {
        success: false,
        error: result.error || "Failed to switch preview role",
      };
    }

    return result;
  }
}

export default DemoAccountService;
