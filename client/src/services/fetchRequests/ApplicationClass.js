/* eslint-disable no-console */
import HttpClient from "../HttpClient";

class Application {
  static async addApplicationToDb(data) {
    const result = await HttpClient.post("/applications/submitted", data, { skipAuth: true });

    if (result.success === false) {
      if (result.status === 400) {
        return result;
      }
      throw new Error(result.error || "Failed to submit application");
    }

    return true;
  }

  static async deleteApplication(id, token) {
    const result = await HttpClient.delete(`/applications/${id}`, { token });

    if (result.success === false) {
      throw new Error(result.error || "Failed to delete application");
    }

    return result;
  }

  static async getApplications(appID) {
    const result = await HttpClient.get(`/applications/${appID}`, { skipAuth: true });

    if (result.success === false) {
      throw new Error("No data received");
    }

    return result;
  }

  static async updateApplicationStatus(id, status, token) {
    const result = await HttpClient.patch(`/applications/${id}/status`, { status }, { token });

    if (result.success === false) {
      throw new Error(result.error || "Failed to update application status");
    }

    return result;
  }

  static async updateApplicationNotes(id, adminNotes, token) {
    const result = await HttpClient.patch(`/applications/${id}/notes`, { adminNotes }, { token });

    if (result.success === false) {
      throw new Error(result.error || "Failed to update application notes");
    }

    return result;
  }

  static async getPendingCount() {
    const result = await HttpClient.get("/applications/pending-count", { skipAuth: true });

    if (result.success === false) {
      return 0;
    }

    return result.count || 0;
  }

  static async hireApplicant(id, employeeData, token) {
    const result = await HttpClient.post(`/applications/${id}/hire`, employeeData, { token });

    if (result.status === 409) {
      return { error: "An account already has this email" };
    }
    if (result.status === 410) {
      return { error: "Username already exists" };
    }

    if (result.success === false) {
      throw new Error(result.error || "Failed to hire applicant");
    }

    return result;
  }
}

export default Application;
