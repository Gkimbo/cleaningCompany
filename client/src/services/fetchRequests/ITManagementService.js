import HttpClient from "../HttpClient";

class ITManagementService {
  static async getITStaff(token) {
    const result = await HttpClient.get("/users/it-staff", { token });

    if (result.success === false) {
      __DEV__ && console.warn("[ITManagementService] getITStaff failed:", result.error);
      return { success: false, error: result.error };
    }

    return { success: true, itStaff: result.itStaff || [] };
  }

  static async createITEmployee(token, employeeData) {
    const result = await HttpClient.post(
      "/users/new-it",
      employeeData,
      { token }
    );

    if (result.success === false) {
      __DEV__ && console.warn("[ITManagementService] createITEmployee failed:", result.error);
      return { success: false, error: result.error };
    }

    return { success: true, user: result.user };
  }

  static async updateITEmployee(token, employeeId, updates) {
    const result = await HttpClient.patch(
      `/users/it-staff/${employeeId}`,
      updates,
      { token }
    );

    if (result.success === false) {
      __DEV__ && console.warn("[ITManagementService] updateITEmployee failed:", result.error);
      return { success: false, error: result.error };
    }

    return { success: true, user: result.user, message: result.message };
  }

  static async removeITEmployee(token, employeeId) {
    const result = await HttpClient.delete(
      `/users/it-staff/${employeeId}`,
      { token }
    );

    if (result.success === false) {
      __DEV__ && console.warn("[ITManagementService] removeITEmployee failed:", result.error);
      return { success: false, error: result.error };
    }

    return { success: true, message: result.message };
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
