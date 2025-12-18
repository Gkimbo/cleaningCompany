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

  static async deleteApplication(id) {
    try {
      const response = await fetch(baseURL + `/api/v1/applications/${id}`, {
        method: "delete",
        headers: {
          "Content-Type": "application/json",
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
      console.log(responseData)
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

  static async updateApplicationStatus(id, status) {
    try {
      const response = await fetch(baseURL + `/api/v1/applications/${id}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
        headers: {
          "Content-Type": "application/json",
        },
      });
      if (!response.ok) {
        throw new Error(`${response.status} (${response.statusText})`);
      }
      const responseData = await response.json();
      return responseData;
    } catch (err) {
      console.error("Failed to update application status:", err);
      throw err;
    }
  }

  static async updateApplicationNotes(id, adminNotes) {
    try {
      const response = await fetch(baseURL + `/api/v1/applications/${id}/notes`, {
        method: "PATCH",
        body: JSON.stringify({ adminNotes }),
        headers: {
          "Content-Type": "application/json",
        },
      });
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
}

export default Application;
