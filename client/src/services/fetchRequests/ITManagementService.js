import { API_BASE } from "../config";

const baseURL = API_BASE.replace("/api/v1", "");

class ITManagementService {
  static async getITStaff(token) {
    try {
      const response = await fetch(`${baseURL}/api/v1/users/it-staff`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) {
        const errorData = await response.json();
        return { success: false, error: errorData.error || "Failed to fetch IT staff" };
      }

      const data = await response.json();
      return { success: true, itStaff: data.itStaff || [] };
    } catch (error) {
      console.error("[ITManagement] getITStaff failed:", error.message);
      return { success: false, error: "Network error. Please try again." };
    }
  }

  static async createITEmployee(token, employeeData) {
    try {
      const response = await fetch(`${baseURL}/api/v1/users/new-it`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(employeeData),
      });

      const data = await response.json();

      if (!response.ok) {
        return { success: false, error: data.error || "Failed to create IT employee" };
      }

      return { success: true, user: data.user };
    } catch (error) {
      console.error("[ITManagement] createITEmployee failed:", error.message);
      return { success: false, error: "Network error. Please try again." };
    }
  }

  static async updateITEmployee(token, employeeId, updates) {
    try {
      const response = await fetch(`${baseURL}/api/v1/users/it-staff/${employeeId}`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(updates),
      });

      const data = await response.json();

      if (!response.ok) {
        return { success: false, error: data.error || "Failed to update IT employee" };
      }

      return { success: true, user: data.user, message: data.message };
    } catch (error) {
      console.error("[ITManagement] updateITEmployee failed:", error.message);
      return { success: false, error: "Network error. Please try again." };
    }
  }

  static async removeITEmployee(token, employeeId) {
    try {
      const response = await fetch(`${baseURL}/api/v1/users/it-staff/${employeeId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });

      const data = await response.json();

      if (!response.ok) {
        return { success: false, error: data.error || "Failed to remove IT employee" };
      }

      return { success: true, message: data.message };
    } catch (error) {
      console.error("[ITManagement] removeITEmployee failed:", error.message);
      return { success: false, error: "Network error. Please try again." };
    }
  }

  // Generate a secure random password
  static generatePassword() {
    const length = 12;
    const lowercase = "abcdefghijklmnopqrstuvwxyz";
    const uppercase = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    const numbers = "0123456789";
    const special = "!@#$%^&*";
    const all = lowercase + uppercase + numbers + special;

    let password = "";
    // Ensure at least one of each type
    password += lowercase[Math.floor(Math.random() * lowercase.length)];
    password += uppercase[Math.floor(Math.random() * uppercase.length)];
    password += numbers[Math.floor(Math.random() * numbers.length)];
    password += special[Math.floor(Math.random() * special.length)];

    // Fill the rest
    for (let i = password.length; i < length; i++) {
      password += all[Math.floor(Math.random() * all.length)];
    }

    // Shuffle the password
    return password.split("").sort(() => Math.random() - 0.5).join("");
  }
}

export default ITManagementService;
