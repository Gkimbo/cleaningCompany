/* eslint-disable no-console */
import { API_BASE } from "../config";

const baseURL = API_BASE.replace("/api/v1", "");

class Application {
  static async addApplicationToDb(data) {
    try {
      const response = await fetch(baseURL + "/api/v1/applications/submitted", {
        method: "post",
        body: JSON.stringify(data),
        headers: {
          "Content-Type": "application/json",
        },
      });
      if (!response.ok) {
        if (response.status === 400) {
          const responseData = await response.json();
          return responseData;
        }
        const error = new Error(`${response.status}(${response.statusText})`);
        throw error;
      }
      const responseData = await response.json();
      return true;
    } catch (err) {
      return err;
    }
  }

  static async deleteApplication(id, token) {
    try {
      const response = await fetch(baseURL + `/api/v1/applications/${id}`, {
        method: "delete",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      });
      if (!response.ok) {
        if (response.status === 400) {
          const responseData = await response.json();
          throw new Error(`Bad Request: ${JSON.stringify(responseData)}`);
        }
        throw new Error(`${response.status} (${response.statusText})`);
      }
      const responseData = await response.json();
      return responseData;
    } catch (err) {
      console.log(err);
      throw new Error(`Failed to delete appointment: ${err.message}`);
    }
  }

  static async getApplications(appID) {
    try {
      const response = await fetch(baseURL + `/api/v1/applications/${appID}`);
      if (!response.ok) {
        throw new Error("No data received");
      }
      const responseData = await response.json();
      return responseData;
    } catch (error) {
      return error;
    }
  }

  static async updateApplicationStatus(id, status, token) {
    try {
      const response = await fetch(
        baseURL + `/api/v1/applications/${id}/status`,
        {
          method: "PATCH",
          body: JSON.stringify({ status }),
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
        }
      );
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const errorMessage = errorData.error || `${response.status} error`;
        throw new Error(errorMessage);
      }
      const responseData = await response.json();
      return responseData;
    } catch (err) {
      console.error("Failed to update application status:", err);
      throw err;
    }
  }

  static async updateApplicationNotes(id, adminNotes, token) {
    try {
      const response = await fetch(
        baseURL + `/api/v1/applications/${id}/notes`,
        {
          method: "PATCH",
          body: JSON.stringify({ adminNotes }),
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
        }
      );
      if (!response.ok) {
        throw new Error(`${response.status} (${response.statusText})`);
      }
      const responseData = await response.json();
      return responseData;
    } catch (err) {
      console.error("Failed to update application notes:", err);
      throw err;
    }
  }

  static async getPendingCount() {
    try {
      const response = await fetch(baseURL + "/api/v1/applications/pending-count");
      if (!response.ok) {
        return 0;
      }
      const responseData = await response.json();
      return responseData.count || 0;
    } catch (error) {
      console.error("Error fetching pending applications:", error);
      return 0;
    }
  }

  static async hireApplicant(id, employeeData, token) {
    try {
      const response = await fetch(
        baseURL + `/api/v1/applications/${id}/hire`,
        {
          method: "POST",
          body: JSON.stringify(employeeData),
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
        }
      );
      if (!response.ok) {
        if (response.status === 409) {
          return { error: "An account already has this email" };
        } else if (response.status === 410) {
          return { error: "Username already exists" };
        }
        const errorData = await response.json().catch(() => ({}));
        const errorMessage = errorData.error || `${response.status} error`;
        throw new Error(errorMessage);
      }
      const responseData = await response.json();
      return responseData;
    } catch (err) {
      console.error("Failed to hire applicant:", err);
      throw err;
    }
  }
}

export default Application;
