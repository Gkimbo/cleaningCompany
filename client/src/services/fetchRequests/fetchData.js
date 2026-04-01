/* eslint-disable no-console */
import HttpClient from "../HttpClient";

class FetchData {
  static async get(url, user) {
    // Note: url should include /api/v1 prefix since this is a generic helper
    const result = await HttpClient.request(url.replace("/api/v1", ""), { method: "GET" }, { token: user, useFullUrl: true });

    if (result.success === false) {
      if (result.status === 401) {
        throw new Error("Session expired");
      }
      throw new Error("No data received");
    }

    return result;
  }

  static async post(url, data, token) {
    // Note: url should include /api/v1 prefix since this is a generic helper
    const result = await HttpClient.post(url.replace("/api/v1", ""), data, { token });

    if (result.success === false) {
      if (result.status === 401) {
        throw new Error("Session expired");
      }
      throw new Error(result.error || "Request failed");
    }

    return result;
  }

  static async getHome(id) {
    const result = await HttpClient.get(`/employee-info/home/${id}`, { skipAuth: true });

    if (result.success === false) {
      throw new Error("No data received");
    }

    return result;
  }

  static async getLatAndLong(id) {
    const result = await HttpClient.get(`/employee-info/home/LL/${id}`, { skipAuth: true });

    if (result.success === false) {
      throw new Error("No data received");
    }

    return result;
  }

  static async getEmployeesWorking(token) {
    const result = await HttpClient.get("/employee-info/employeeSchedule", { token });

    if (result.success === false) {
      throw new Error("No data received");
    }

    return result;
  }

  static async getApplicationsFromBackend(token) {
    const result = await HttpClient.get("/applications/all-applications", { token });

    if (result.success === false) {
      if (result.status === 401) {
        throw new Error("Session expired");
      }
      throw new Error("No data received");
    }

    return result;
  }

  static async login(loginData) {
    const result = await HttpClient.post(
      "/user-sessions/login",
      {
        username: loginData.userName,
        password: loginData.password,
        accountType: loginData.accountType || undefined,
      },
      { skipAuth: true }
    );

    // Handle 300 - Multiple accounts require selection
    if (result.status === 300) {
      return {
        requiresAccountSelection: true,
        accountOptions: result.accountOptions,
        message: result.message,
      };
    }

    if (result.success === false) {
      if (result.status === 401) {
        return "Invalid password";
      } else if (result.status === 404) {
        return "No account found with that email or username.";
      } else if (result.status === 423) {
        return result.error || "Account temporarily locked";
      } else {
        throw new Error("Failed to login");
      }
    }

    return result;
  }

  static async checkAccountsByEmail(email) {
    const result = await HttpClient.get(
      `/user-sessions/check-accounts?email=${encodeURIComponent(email)}`,
      { skipAuth: true }
    );

    if (result.success === false) {
      return { multipleAccounts: false };
    }

    return result;
  }

  static async makeNewUser(data) {
    const result = await HttpClient.post(
      "/users",
      {
        firstName: data.firstName,
        lastName: data.lastName,
        username: data.userName,
        password: data.password,
        email: data.email,
        termsId: data.termsId,
        privacyPolicyId: data.privacyPolicyId,
        referralCode: data.referralCode,
      },
      { skipAuth: true }
    );

    if (result.success === false) {
      if (result.status === 409) {
        return "An account already has this email";
      } else if (result.status === 410) {
        return "Username already exists";
      } else {
        throw new Error("Failed to create user");
      }
    }

    return result;
  }

  static async makeNewEmployee(data) {
    const result = await HttpClient.post(
      "/users/new-employee",
      {
        username: data.userName,
        password: data.password,
        email: data.email,
        type: data.type,
        firstName: data.firstName,
        lastName: data.lastName,
        phone: data.phone,
      },
      { skipAuth: true }
    );

    if (result.success === false) {
      if (result.status === 409) {
        return "An account already has this email";
      } else if (result.status === 410) {
        return "Username already exists";
      } else {
        throw new Error("Failed to create user");
      }
    }

    return result;
  }

  static async editEmployee(data) {
    const result = await HttpClient.patch(
      "/users/employee",
      {
        id: data.id,
        username: data.userName,
        password: data.password,
        email: data.email,
        type: data.type,
        firstName: data.firstName,
        lastName: data.lastName,
        phone: data.phone,
      },
      { skipAuth: true }
    );

    if (result.success === false) {
      if (result.status === 409) {
        return "An account already has this email";
      } else if (result.status === 410) {
        return "Username already exists";
      } else {
        throw new Error("Failed to create user");
      }
    }

    return result;
  }

  static async updateTimestamp(data) {
    const result = await HttpClient.post("/user-info/collect-rewards", data, { skipAuth: true });

    if (result.success === false) {
      if (result.status === 401) {
        return result;
      }
      throw new Error(`${result.status}(${result.statusText || "Error"})`);
    }

    return result;
  }

  static async addHomeInfo(data) {
    const result = await HttpClient.post("/user-info/home", data, { skipAuth: true });

    if (result.success === false) {
      if (result.status === 400) {
        return result;
      }
      throw new Error(`${result.status}(${result.statusText || "Error"})`);
    }

    return result;
  }

  static async editHomeInfo(data, user) {
    const result = await HttpClient.patch("/user-info/home", data, { token: user?.token });

    if (result.success === false) {
      // Return the result with error info so the caller can display the server's error message
      return result;
    }

    return result;
  }

  static async completeHomeSetup(homeId, data, token) {
    const result = await HttpClient.patch(`/user-info/home/${homeId}/complete-setup`, data, { token });

    if (result.success === false) {
      return { error: result.error || "Failed to complete home setup" };
    }

    return result;
  }

  static async deleteHome(id, token) {
    const result = await HttpClient.delete("/user-info/home", { token, body: { id } });

    if (result.success === false) {
      throw new Error("Failed to delete");
    }

    return true;
  }

  static async deleteEmployee(id, token) {
    const result = await HttpClient.delete("/users/employee", { token, body: { id } });

    if (result.success === false) {
      return { error: result.error || "Failed to delete employee" };
    }

    return { success: true };
  }

  static async addEmployeeShiftsInfo(data) {
    const result = await HttpClient.post("/employee-info/shifts", data, { skipAuth: true });

    if (result.success === false) {
      if (result.status === 400) {
        return result;
      }
      throw new Error(`${result.status}(${result.statusText || "Error"})`);
    }

    return result;
  }

  static async getBookingInfo(appointmentId, token) {
    const result = await HttpClient.get(`/appointments/booking-info/${appointmentId}`, { token });

    if (result.success === false) {
      if (result.status === 401) {
        return { error: "Session expired" };
      }
      return { error: result.error || "Failed to get booking info" };
    }

    return result;
  }

  static async addEmployee(id, appointmentId, acknowledged = false) {
    const result = await HttpClient.patch(
      "/appointments/request-employee",
      { id, appointmentId, acknowledged },
      { skipAuth: true }
    );

    if (result.success === false) {
      return {
        error: result.error || "Failed to request appointment",
        requiresAcknowledgment: result.requiresAcknowledgment,
        isLargeHome: result.isLargeHome,
        hasTimeConstraint: result.hasTimeConstraint,
        requiresStripeSetup: result.requiresStripeSetup,
        stripeAccountStatus: result.stripeAccountStatus,
        message: result.message,
      };
    }

    return {
      success: true,
      message: result.message,
      directBooking: result.directBooking || false,
    };
  }

  static async removeEmployee(id, appointmentId, token) {
    const result = await HttpClient.patch(
      "/appointments/remove-employee",
      { id, appointmentId },
      { token }
    );

    if (result.success === false) {
      throw new Error("Failed to delete");
    }

    return true;
  }

  static async removeRequest(id, appointmentId, token) {
    const result = await HttpClient.patch(
      "/appointments/remove-request",
      { id, appointmentId },
      { token }
    );

    if (result.success === false) {
      throw new Error("Failed to delete");
    }

    return true;
  }

  static async approveRequest(requestId, approve, token) {
    const result = await HttpClient.patch(
      "/appointments/approve-request",
      { requestId, approve },
      { token }
    );

    // Handle 409 Conflict - another cleaner already assigned
    if (result.status === 409) {
      return { conflict: true, ...result };
    }

    if (result.success === false) {
      throw new Error(result.error || "Failed to approve request");
    }

    return result;
  }

  static async switchCleaner(appointmentId, newCleanerId, requestId) {
    const result = await HttpClient.post(
      "/appointments/switch-cleaner",
      { appointmentId, newCleanerId, requestId },
      { skipAuth: true }
    );

    if (result.success === false) {
      throw new Error(result.error || "Failed to switch cleaner");
    }

    return result;
  }

  static async denyRequest(id, appointmentId, token) {
    const result = await HttpClient.patch(
      "/appointments/deny-request",
      { id, appointmentId },
      { token }
    );

    if (result.success === false) {
      throw new Error(result.error || "Failed to deny request");
    }

    return result;
  }

  static async undoRequest(id, appointmentId, token) {
    const result = await HttpClient.patch(
      "/appointments/undo-request-choice",
      { id, appointmentId },
      { token }
    );

    if (result.success === false) {
      throw new Error("Failed to delete");
    }

    if (__DEV__) console.log(result);
    return true;
  }

  static async updateUsername(token, username) {
    const result = await HttpClient.patch("/users/update-username", { username }, { token });

    if (result.success === false) {
      return { error: result.error || "Failed to update username" };
    }

    return result;
  }

  static async updatePassword(token, currentPassword, newPassword) {
    const result = await HttpClient.patch(
      "/users/update-password",
      { currentPassword, newPassword },
      { token }
    );

    if (result.success === false) {
      return { error: result.error || "Failed to update password" };
    }

    return result;
  }

  static async updateEmail(token, email) {
    const result = await HttpClient.patch("/users/update-email", { email }, { token });

    if (result.success === false) {
      return { error: result.error || "Failed to update email" };
    }

    return result;
  }

  static async updatePhone(token, phone) {
    const result = await HttpClient.patch("/users/update-phone", { phone }, { token });

    if (result.success === false) {
      return { error: result.error || "Failed to update phone number" };
    }

    return result;
  }

  static async upgradeToBusinessOwner(token, businessName = null, yearsInBusiness = null) {
    const result = await HttpClient.patch(
      "/users/upgrade-to-business",
      { businessName, yearsInBusiness },
      { token }
    );

    if (result.success === false) {
      return { error: result.error || "Failed to upgrade account" };
    }

    return result;
  }

  static async forgotUsername(email) {
    const result = await HttpClient.post(
      "/user-sessions/forgot-username",
      { email },
      { skipAuth: true }
    );

    if (result.success === false) {
      return { error: result.error || "Failed to process request" };
    }

    return result;
  }

  static async forgotPassword(email) {
    const result = await HttpClient.post(
      "/user-sessions/forgot-password",
      { email },
      { skipAuth: true }
    );

    if (result.success === false) {
      return { error: result.error || "Failed to process request" };
    }

    return result;
  }

  static async getRequestCountsByHome(token) {
    if (!token) {
      return { requestCountsByHome: {} };
    }

    const result = await HttpClient.get("/appointments/requests-by-home", { token });

    if (result.success === false) {
      if (result.status === 401) {
        return { requestCountsByHome: {} };
      }
      if (__DEV__) console.error("Error fetching request counts:", result.error);
      return { requestCountsByHome: {} };
    }

    return result;
  }

  static async getRequestsForHome(token, homeId) {
    if (!token) {
      return { requests: [] };
    }

    const result = await HttpClient.get(`/appointments/requests-for-home/${homeId}`, { token });

    if (result.success === false) {
      if (__DEV__) console.error("Error fetching requests for home:", result.error);
      return { requests: [] };
    }

    return result;
  }

  static async getCleanerProfile(cleanerId) {
    const result = await HttpClient.get(`/employee-info/cleaner/${cleanerId}`, { skipAuth: true });

    if (result.success === false) {
      if (__DEV__) console.error("Error fetching cleaner profile:", result.error);
      return { cleaner: null };
    }

    return result;
  }

  // Get staffing configuration (includes minCleanersForAssignment)
  static async getStaffingConfig() {
    const result = await HttpClient.get("/pricing/current", { skipAuth: true });

    if (result.success === false) {
      if (__DEV__) console.error("Error fetching staffing config:", result.error);
      // Return default if fetch fails
      return { minCleanersForAssignment: 1 };
    }

    return result.staffing || { minCleanersForAssignment: 1 };
  }

  // Cancellation API methods
  static async getCancellationInfo(appointmentId, token) {
    const result = await HttpClient.get(`/appointments/cancellation-info/${appointmentId}`, { token });

    if (result.success === false) {
      return { error: result.error || "Failed to get cancellation info" };
    }

    return result;
  }

  static async cancelAsHomeowner(appointmentId, token) {
    const result = await HttpClient.post(`/appointments/${appointmentId}/cancel-homeowner`, {}, { token });

    if (result.success === false) {
      return { error: result.error || "Failed to cancel appointment" };
    }

    return result;
  }

  static async cancelAsCleaner(appointmentId, token, acknowledged = false) {
    const result = await HttpClient.post(
      `/appointments/${appointmentId}/cancel-cleaner`,
      { acknowledged },
      { token }
    );

    if (result.success === false) {
      return {
        error: result.error || "Failed to cancel job",
        requiresAcknowledgment: result.requiresAcknowledgment,
        message: result.message,
      };
    }

    return result;
  }

  // Home Size Adjustment API methods
  static async createHomeSizeAdjustment(token, data) {
    const result = await HttpClient.post("/home-size-adjustment", data, { token });

    if (result.success === false) {
      return { error: result.error || "Failed to create adjustment request" };
    }

    return result;
  }

  static async getPendingAdjustments(token) {
    const result = await HttpClient.get("/home-size-adjustment/pending", { token });

    if (result.success === false) {
      return { error: result.error || "Failed to fetch adjustments" };
    }

    return result;
  }

  static async getAdjustmentDetails(token, adjustmentId) {
    const result = await HttpClient.get(`/home-size-adjustment/${adjustmentId}`, { token });

    if (result.success === false) {
      return { error: result.error || "Failed to fetch adjustment details" };
    }

    return result;
  }

  static async respondToAdjustment(token, adjustmentId, approved, homeownerResponse = null) {
    const result = await HttpClient.post(
      `/home-size-adjustment/${adjustmentId}/homeowner-response`,
      { approved, homeownerResponse },
      { token }
    );

    if (result.success === false) {
      return { error: result.error || "Failed to respond to adjustment" };
    }

    return result;
  }

  static async ownerResolveAdjustment(token, adjustmentId, data) {
    const result = await HttpClient.post(
      `/home-size-adjustment/${adjustmentId}/owner-resolve`,
      data,
      { token }
    );

    if (result.success === false) {
      return { error: result.error || "Failed to resolve adjustment" };
    }

    return result;
  }

  static async getAdjustmentHistory(token, homeId) {
    const result = await HttpClient.get(`/home-size-adjustment/history/${homeId}`, { token });

    if (result.success === false) {
      return { error: result.error || "Failed to fetch adjustment history" };
    }

    return result;
  }

  // Service Area methods for cleaners
  static async getServiceArea(token) {
    const result = await HttpClient.get("/user-info/service-area", { token });

    if (__DEV__) {
      console.log("[getServiceArea] Result:", result);
    }

    if (result.success === false) {
      return { error: result.error || "Failed to fetch service area" };
    }

    return result;
  }

  static async updateServiceArea(token, { address, latitude, longitude, radiusMiles }) {
    const result = await HttpClient.put(
      "/user-info/service-area",
      { address, latitude, longitude, radiusMiles },
      { token }
    );

    if (result.success === false) {
      return { error: result.error || "Failed to update service area" };
    }

    return result;
  }

  // Multi-Cleaner Job methods
  static async getMultiCleanerOffers(token) {
    const result = await HttpClient.get("/multi-cleaner/offers", { token });

    if (result.success === false) {
      if (__DEV__) console.error("Error fetching multi-cleaner offers:", result.error);
      return { personalOffers: [], availableJobs: [] };
    }

    return result;
  }

  static async acceptMultiCleanerOffer(offerId, token) {
    const result = await HttpClient.post(`/multi-cleaner/offers/${offerId}/accept`, {}, { token });

    if (result.success === false) {
      return { error: result.error || "Failed to accept offer" };
    }

    return result;
  }

  static async declineMultiCleanerOffer(offerId, reason, token) {
    const result = await HttpClient.post(
      `/multi-cleaner/offers/${offerId}/decline`,
      { reason },
      { token }
    );

    if (result.success === false) {
      return { error: result.error || "Failed to decline offer" };
    }

    return result;
  }

  static async joinMultiCleanerJob(jobId, token) {
    const result = await HttpClient.post(`/multi-cleaner/join/${jobId}`, {}, { token });

    if (result.success === false) {
      return { error: result.error || "Failed to join job" };
    }

    return result;
  }

  // Get cleaner's pending multi-cleaner job requests
  static async getMyMultiCleanerRequests(token) {
    const result = await HttpClient.get("/cleaner-approval/my-requests", { token });

    if (result.success === false) {
      return { error: result.error || "Failed to fetch requests" };
    }

    return result;
  }

  // Get cleaner's confirmed multi-cleaner jobs (jobs they've been approved for)
  static async getMyConfirmedMultiCleanerJobs(token) {
    const result = await HttpClient.get("/multi-cleaner/my-confirmed-jobs", { token });

    if (result.success === false) {
      return { error: result.error || "Failed to fetch confirmed jobs" };
    }

    return result;
  }

  // Cancel a pending multi-cleaner job request
  static async cancelMultiCleanerRequest(requestId, token) {
    const result = await HttpClient.post(`/cleaner-approval/${requestId}/cancel`, {}, { token });

    if (result.success === false) {
      return { error: result.error || "Failed to cancel request" };
    }

    return result;
  }
}

export default FetchData;
