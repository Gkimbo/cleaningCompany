import HttpClient from "../HttpClient";

class HRManagementService {
  static async getHRStaff(token) {
    const result = await HttpClient.get("/users/hr-staff", { token });

    if (result.success === false) {
      if (__DEV__) console.warn("[HRManagement] getHRStaff failed:", result.error);
      return { hrStaff: [] };
    }

    return result;
  }

  static async createHREmployee(token, data) {
    const result = await HttpClient.post("/users/new-hr", data, { token });

    if (result.success === false) {
      return {
        success: false,
        error: result.error || "Failed to create HR employee",
      };
    }

    return {
      success: true,
      user: result.user,
    };
  }

  static async updateHREmployee(token, id, data) {
    const result = await HttpClient.patch(`/users/hr-staff/${id}`, data, { token });

    if (result.success === false) {
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
  }

  static async deleteHREmployee(token, id) {
    const result = await HttpClient.delete(`/users/hr-staff/${id}`, { token });

    if (result.success === false) {
      return {
        success: false,
        error: result.error || "Failed to delete HR employee",
      };
    }

    return {
      success: true,
      message: result.message,
    };
  }
}

export default HRManagementService;
