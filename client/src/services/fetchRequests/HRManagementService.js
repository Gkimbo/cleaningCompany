import { API_BASE } from "../config";

const baseURL = API_BASE.replace("/api/v1", "");

class HRManagementService {
  static async fetchWithFallback(url, token, fallback = {}) {
    try {
      const response = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) {
        console.warn(`[HRManagement] ${url} returned ${response.status}`);
        return fallback;
      }
      return await response.json();
    } catch (error) {
      console.warn(`[HRManagement] ${url} failed:`, error.message);
      return fallback;
    }
  }

  static async getHRStaff(token) {
    return this.fetchWithFallback(
      `${baseURL}/api/v1/users/hr-staff`,
      token,
      { hrStaff: [] }
    );
  }

  static async createHREmployee(token, data) {
    try {
      const response = await fetch(`${baseURL}/api/v1/users/new-hr`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      });

      const result = await response.json();

      if (!response.ok) {
        return {
          success: false,
          error: result.error || "Failed to create HR employee",
        };
      }

      return {
        success: true,
        user: result.user,
      };
    } catch (error) {
      console.error("[HRManagement] createHREmployee failed:", error.message);
      return { success: false, error: "Network error. Please try again." };
    }
  }

  static async updateHREmployee(token, id, data) {
    try {
      const response = await fetch(`${baseURL}/api/v1/users/hr-staff/${id}`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      });

      const result = await response.json();

      if (!response.ok) {
        return {
          success: false,
          error: result.error || "Failed to update HR employee",
        };
      }

      return {
        success: true,
        user: result.user,
        message: result.message,
      };
    } catch (error) {
      console.error("[HRManagement] updateHREmployee failed:", error.message);
      return { success: false, error: "Network error. Please try again." };
    }
  }

  static async deleteHREmployee(token, id) {
    try {
      const response = await fetch(`${baseURL}/api/v1/users/hr-staff/${id}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const result = await response.json();

      if (!response.ok) {
        return {
          success: false,
          error: result.error || "Failed to delete HR employee",
        };
      }

      return {
        success: true,
        message: result.message,
      };
    } catch (error) {
      console.error("[HRManagement] deleteHREmployee failed:", error.message);
      return { success: false, error: "Network error. Please try again." };
    }
  }
}

export default HRManagementService;
