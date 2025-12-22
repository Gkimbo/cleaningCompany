/* eslint-disable no-console */
import { API_BASE } from "../config";

// Remove /api/v1 suffix since individual routes include it
const baseURL = API_BASE.replace("/api/v1", "");

class FetchData {
  static async get(url, user) {
    try {
      const response = await fetch(baseURL + url, {
        headers: {
          Authorization: `Bearer ${user}`,
        },
      });

      if (!response.ok) {
        throw new Error("No data received");
      }
      const responseData = await response.json();
      return responseData;
    } catch (error) {
      return error;
    }
  }

  static async getHome(id) {
    try {
      const response = await fetch(
        baseURL + `/api/v1/employee-info/home/${id}`
      );
      if (!response.ok) {
        throw new Error("No data received");
      }
      const responseData = await response.json();
      return responseData;
    } catch (error) {
      return error;
    }
  }
  static async getLatAndLong(id) {
    try {
      const response = await fetch(
        baseURL + `/api/v1/employee-info/home/LL/${id}`
      );
      if (!response.ok) {
        throw new Error("No data received");
      }
      const responseData = await response.json();
      return responseData;
    } catch (error) {
      return error;
    }
  }

  static async getEmployeesWorking() {
    try {
      const response = await fetch(
        baseURL + `/api/v1/employee-info/employeeSchedule`
      );
      if (!response.ok) {
        throw new Error("No data received");
      }
      const responseData = await response.json();
      return responseData;
    } catch (error) {
      return error;
    }
  }

  static async getApplicationsFromBackend() {
    try {
      const response = await fetch(
        baseURL + `/api/v1/applications/all-applications`
      );
      if (!response.ok) {
        throw new Error("No data received");
      }
      const responseData = await response.json();
      return responseData;
    } catch (error) {
      return error;
    }
  }

  static async login(loginData) {
    try {
      const response = await fetch(baseURL + "/api/v1/user-sessions/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          username: loginData.userName,
          password: loginData.password,
        }),
      });
      if (!response.ok) {
        if (response.status === 401) {
          return "Invalid password";
        } else if (response.status === 404) {
          return "No account found with that email or username.";
        } else {
          throw new Error("Failed to login");
        }
      }
      const responseData = await response.json();
      return responseData;
    } catch (error) {
      return error;
    }
  }

  static async makeNewUser(data) {
    try {
      const response = await fetch(baseURL + "/api/v1/users", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          firstName: data.firstName,
          lastName: data.lastName,
          username: data.userName,
          password: data.password,
          email: data.email,
        }),
      });
      if (!response.ok) {
        if (response.status === 409) {
          return "An account already has this email";
        } else if (response.status === 410) {
          return "Username already exists";
        } else {
          throw new Error("Failed to create user");
        }
      }
      const responseData = await response.json();
      return responseData;
    } catch (error) {
      return error;
    }
  }

  static async makeNewEmployee(data) {
    try {
      const response = await fetch(baseURL + "/api/v1/users/new-employee", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          username: data.userName,
          password: data.password,
          email: data.email,
          type: data.type,
          firstName: data.firstName,
          lastName: data.lastName,
        }),
      });
      if (!response.ok) {
        if (response.status === 409) {
          return "An account already has this email";
        } else if (response.status === 410) {
          return "Username already exists";
        } else {
          throw new Error("Failed to create user");
        }
      }
      const responseData = await response.json();
      return responseData;
    } catch (error) {
      return error;
    }
  }
  
  static async editEmployee(data) {
    try {
      const response = await fetch(baseURL + "/api/v1/users/employee", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          id: data.id,
          username: data.userName,
          password: data.password,
          email: data.email,
          type: data.type,
        }),
      });
      if (!response.ok) {
        if (response.status === 409) {
          return "An account already has this email";
        } else if (response.status === 410) {
          return "Username already exists";
        } else {
          throw new Error("Failed to create user");
        }
      }
      const responseData = await response.json();
      return responseData;
    } catch (error) {
      return error;
    }
  }

  static async updateTimestamp(data) {
    try {
      const response = await fetch(
        baseURL + "/api/v1/user-info/collect-rewards",
        {
          method: "post",
          body: JSON.stringify(data),
          headers: {
            "Content-Type": "application/json",
          },
        }
      );
      if (!response.ok) {
        if (response.status === 401) {
          const responseData = await response.json();
          return responseData;
        }
        const error = new Error(`${response.status}(${response.statusText})`);
        throw error;
      }
      const responseData = await response.json();
      return responseData;
    } catch (err) {
      return err;
    }
  }
  static async addHomeInfo(data) {
    try {
      const response = await fetch(baseURL + "/api/v1/user-info/home", {
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
      return responseData;
    } catch (err) {
      return err;
    }
  }

  static async editHomeInfo(data) {
    try {
      const response = await fetch(baseURL + "/api/v1/user-info/home", {
        method: "PATCH",
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
      return responseData;
    } catch (err) {
      return err;
    }
  }

  static async deleteHome(id) {
    try {
      const response = await fetch(baseURL + "/api/v1/user-info/home", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          id,
        }),
      });
      if (!response.ok) {
        throw new Error("Failed to delete");
      }

      const responseData = await response.json();
      return true;
    } catch (error) {
      return error;
    }
  }
  static async deleteEmployee(id) {
    try {
      const response = await fetch(baseURL + "/api/v1/users/employee", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          id,
        }),
      });
      if (!response.ok) {
        throw new Error("Failed to delete");
      }

      const responseData = await response.json();
      return true;
    } catch (error) {
      return error;
    }
  }

  static async addEmployeeShiftsInfo(data) {
    try {
      const response = await fetch(baseURL + "/api/v1/employee-info/shifts", {
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
      return responseData;
    } catch (err) {
      return err;
    }
  }

  static async getBookingInfo(appointmentId, token) {
    try {
      const response = await fetch(
        baseURL + `/api/v1/appointments/booking-info/${appointmentId}`,
        {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const responseData = await response.json();

      if (!response.ok) {
        return { error: responseData.error || "Failed to get booking info" };
      }

      return responseData;
    } catch (error) {
      console.error("Error getting booking info:", error);
      return { error: "Failed to get booking info" };
    }
  }

  static async addEmployee(id, appointmentId, acknowledged = false) {
    try {
      const response = await fetch(
        baseURL + "/api/v1/appointments/request-employee",
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            id,
            appointmentId,
            acknowledged,
          }),
        }
      );

      const responseData = await response.json();

      if (!response.ok) {
        return {
          error: responseData.error || "Failed to request appointment",
          requiresAcknowledgment: responseData.requiresAcknowledgment,
          isLargeHome: responseData.isLargeHome,
          hasTimeConstraint: responseData.hasTimeConstraint,
          message: responseData.message,
        };
      }

      return { success: true, message: responseData.message };
    } catch (error) {
      console.error("Error requesting appointment:", error);
      return { error: "Failed to request appointment" };
    }
  }

  static async removeEmployee(id, appointmentId) {
    try {
      const response = await fetch(
        baseURL + "/api/v1/appointments/remove-employee",
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            id,
            appointmentId,
          }),
        }
      );
      if (!response.ok) {
        throw new Error("Failed to delete");
      }

      const responseData = await response.json();
      return true;
    } catch (error) {
      return error;
    }
  }

  static async removeRequest(id, appointmentId) {
    try {
      const response = await fetch(
        baseURL + "/api/v1/appointments/remove-request",
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            id,
            appointmentId,
          }),
        }
      );
      if (!response.ok) {
        throw new Error("Failed to delete");
      }

      const responseData = await response.json();
      return true;
    } catch (error) {
      return error;
    }
  }

  static async approveRequest(requestId, approve) {
    try {
      const response = await fetch(
        baseURL + "/api/v1/appointments/approve-request",
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            requestId,
            approve,
          }),
        }
      );
      if (!response.ok) {
        throw new Error("Failed to delete");
      }
      const responseData = await response.json();
      return true;
    } catch (error) {
      return error;
    }
  }

  static async denyRequest(id, appointmentId) {
    try {
      const response = await fetch(
        baseURL + "/api/v1/appointments/deny-request",
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            id,
            appointmentId,
          }),
        }
      );
      if (!response.ok) {
        throw new Error("Failed to delete");
      }

      const responseData = await response.json();
      console.log(responseData);
      return true;
    } catch (error) {
      return error;
    }
  }

  static async undoRequest(id, appointmentId) {
    try {
      const response = await fetch(
        baseURL + "/api/v1/appointments/undo-request-choice",
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            id,
            appointmentId,
          }),
        }
      );
      if (!response.ok) {
        throw new Error("Failed to delete");
      }

      const responseData = await response.json();
      console.log(responseData);
      return true;
    } catch (error) {
      return error;
    }
  }

  static async updateUsername(token, username) {
    try {
      const response = await fetch(baseURL + "/api/v1/users/update-username", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ username }),
      });

      const responseData = await response.json();

      if (!response.ok) {
        return { error: responseData.error || "Failed to update username" };
      }

      return responseData;
    } catch (error) {
      console.error("Error updating username:", error);
      return { error: "Failed to update username" };
    }
  }

  static async updatePassword(token, currentPassword, newPassword) {
    try {
      const response = await fetch(baseURL + "/api/v1/users/update-password", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ currentPassword, newPassword }),
      });

      const responseData = await response.json();

      if (!response.ok) {
        return { error: responseData.error || "Failed to update password" };
      }

      return responseData;
    } catch (error) {
      console.error("Error updating password:", error);
      return { error: "Failed to update password" };
    }
  }

  static async updateEmail(token, email) {
    try {
      const response = await fetch(baseURL + "/api/v1/users/update-email", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ email }),
      });

      const responseData = await response.json();

      if (!response.ok) {
        return { error: responseData.error || "Failed to update email" };
      }

      return responseData;
    } catch (error) {
      console.error("Error updating email:", error);
      return { error: "Failed to update email" };
    }
  }

  static async forgotUsername(email) {
    try {
      const response = await fetch(baseURL + "/api/v1/user-sessions/forgot-username", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email }),
      });

      const responseData = await response.json();

      if (!response.ok) {
        return { error: responseData.error || "Failed to process request" };
      }

      return responseData;
    } catch (error) {
      console.error("Error in forgot username:", error);
      return { error: "Failed to process request. Please try again." };
    }
  }

  static async forgotPassword(email) {
    try {
      const response = await fetch(baseURL + "/api/v1/user-sessions/forgot-password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email }),
      });

      const responseData = await response.json();

      if (!response.ok) {
        return { error: responseData.error || "Failed to process request" };
      }

      return responseData;
    } catch (error) {
      console.error("Error in forgot password:", error);
      return { error: "Failed to process request. Please try again." };
    }
  }

  static async getRequestCountsByHome(token) {
    try {
      const response = await fetch(baseURL + "/api/v1/appointments/requests-by-home", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error("Failed to fetch request counts");
      }

      const responseData = await response.json();
      return responseData;
    } catch (error) {
      console.error("Error fetching request counts:", error);
      return { requestCountsByHome: {} };
    }
  }

  static async getRequestsForHome(token, homeId) {
    try {
      const response = await fetch(baseURL + `/api/v1/appointments/requests-for-home/${homeId}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error("Failed to fetch requests for home");
      }

      const responseData = await response.json();
      return responseData;
    } catch (error) {
      console.error("Error fetching requests for home:", error);
      return { requests: [] };
    }
  }

  static async getCleanerProfile(cleanerId) {
    try {
      const response = await fetch(baseURL + `/api/v1/employee-info/cleaner/${cleanerId}`);

      if (!response.ok) {
        throw new Error("Failed to fetch cleaner profile");
      }

      const responseData = await response.json();
      return responseData;
    } catch (error) {
      console.error("Error fetching cleaner profile:", error);
      return { cleaner: null };
    }
  }

  // Cancellation API methods
  static async getCancellationInfo(appointmentId, token) {
    try {
      const response = await fetch(
        baseURL + `/api/v1/appointments/cancellation-info/${appointmentId}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        return { error: errorData.error || "Failed to get cancellation info" };
      }

      const responseData = await response.json();
      return responseData;
    } catch (error) {
      console.error("Error getting cancellation info:", error);
      return { error: "Failed to get cancellation info" };
    }
  }

  static async cancelAsHomeowner(appointmentId, token) {
    try {
      const response = await fetch(
        baseURL + `/api/v1/appointments/${appointmentId}/cancel-homeowner`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const responseData = await response.json();

      if (!response.ok) {
        return { error: responseData.error || "Failed to cancel appointment" };
      }

      return responseData;
    } catch (error) {
      console.error("Error cancelling appointment as homeowner:", error);
      return { error: "Failed to cancel appointment" };
    }
  }

  static async cancelAsCleaner(appointmentId, token, acknowledged = false) {
    try {
      const response = await fetch(
        baseURL + `/api/v1/appointments/${appointmentId}/cancel-cleaner`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ acknowledged }),
        }
      );

      const responseData = await response.json();

      if (!response.ok) {
        return {
          error: responseData.error || "Failed to cancel job",
          requiresAcknowledgment: responseData.requiresAcknowledgment,
          message: responseData.message,
        };
      }

      return responseData;
    } catch (error) {
      console.error("Error cancelling job as cleaner:", error);
      return { error: "Failed to cancel job" };
    }
  }
}

export default FetchData;
