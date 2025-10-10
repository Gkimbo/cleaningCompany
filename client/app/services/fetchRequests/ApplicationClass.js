/* eslint-disable no-console */
const baseURL = "http://localhost:3000";

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

}

export default Application;
