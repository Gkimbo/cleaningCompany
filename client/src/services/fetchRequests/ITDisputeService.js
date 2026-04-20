import HttpClient from "../HttpClient";

class ITDisputeService {
  // Submit a new IT dispute (all authenticated users can submit)
  static async submitDispute(token, disputeData) {
    const result = await HttpClient.post(
      "/it-disputes/submit",
      disputeData,
      { token }
    );

    if (result.success === false) {
      __DEV__ && console.warn("[ITDisputeService] submitDispute failed:", result.error);
      return { success: false, error: result.error };
    }

    return { success: true, dispute: result.dispute };
  }

  // Get user's submitted disputes
  static async getMyDisputes(token) {
    const result = await HttpClient.get("/it-disputes/my-disputes", { token });

    if (result.success === false) {
      __DEV__ && console.warn("[ITDisputeService] getMyDisputes failed:", result.error);
      return { success: false, error: result.error };
    }

    return { success: true, disputes: result.disputes || [] };
  }

  // Get a specific dispute's details
  static async getDispute(token, disputeId) {
    const result = await HttpClient.get(
      `/it-disputes/${disputeId}`,
      { token }
    );

    if (result.success === false) {
      __DEV__ && console.warn("[ITDisputeService] getDispute failed:", result.error);
      return { success: false, error: result.error };
    }

    return { success: true, dispute: result.dispute };
  }

  // Add additional information to a dispute
  static async addInfo(token, disputeId, info) {
    const result = await HttpClient.post(
      `/it-disputes/${disputeId}/add-info`,
      info,
      { token }
    );

    if (result.success === false) {
      __DEV__ && console.warn("[ITDisputeService] addInfo failed:", result.error);
      return { success: false, error: result.error };
    }

    return { success: true, dispute: result.dispute };
  }

  // Get available categories
  static async getCategories(token) {
    const result = await HttpClient.get(
      "/it-disputes/categories/list",
      { token }
    );

    if (result.success === false) {
      __DEV__ && console.warn("[ITDisputeService] getCategories failed:", result.error);
      return { success: false, error: result.error };
    }

    return { success: true, categories: result.categories };
  }

  // Helper to get category groups for display
  static getCategoryGroups() {
    return {
      technical: {
        label: "Technical Issues",
        icon: "laptop",
        categories: [
          { value: "app_crash", label: "App Crash" },
          { value: "login_problem", label: "Login Problem" },
          { value: "system_outage", label: "System Outage" },
          { value: "performance_issue", label: "Performance Issue" },
        ],
      },
      profile: {
        label: "Profile & Account",
        icon: "user",
        categories: [
          { value: "profile_change", label: "Profile Change Request" },
          { value: "account_access", label: "Account Access Issue" },
          { value: "password_reset", label: "Password Reset" },
          { value: "data_correction", label: "Data Correction" },
        ],
      },
      billing: {
        label: "Billing & Payments",
        icon: "credit-card",
        categories: [
          { value: "billing_error", label: "Billing Error" },
          { value: "payment_system_error", label: "Payment System Error" },
        ],
      },
      security: {
        label: "Security",
        icon: "shield",
        categories: [
          { value: "security_issue", label: "Security Issue" },
          { value: "suspicious_activity", label: "Suspicious Activity" },
        ],
      },
      data: {
        label: "Data Requests",
        icon: "database",
        categories: [
          { value: "data_request", label: "Data Export/GDPR Request" },
        ],
      },
    };
  }

  // Helper to get priority options
  static getPriorityOptions() {
    return [
      { value: "low", label: "Low", description: "Non-urgent issue, can wait" },
      { value: "normal", label: "Normal", description: "Standard priority" },
      { value: "high", label: "High", description: "Needs attention soon" },
      { value: "critical", label: "Critical", description: "Urgent - blocking work" },
    ];
  }

  // Helper to get status display info
  static getStatusInfo(status) {
    const statuses = {
      submitted: { label: "Submitted", color: "#6366f1", bgColor: "#eef2ff" },
      in_progress: { label: "In Progress", color: "#f59e0b", bgColor: "#fffbeb" },
      awaiting_info: { label: "Awaiting Info", color: "#8b5cf6", bgColor: "#f5f3ff" },
      resolved: { label: "Resolved", color: "#10b981", bgColor: "#ecfdf5" },
      closed: { label: "Closed", color: "#6b7280", bgColor: "#f3f4f6" },
    };
    return statuses[status] || { label: status, color: "#6b7280", bgColor: "#f3f4f6" };
  }

  // Helper to get priority display info
  static getPriorityInfo(priority) {
    const priorities = {
      low: { label: "Low", color: "#6b7280", bgColor: "#f3f4f6" },
      normal: { label: "Normal", color: "#3b82f6", bgColor: "#eff6ff" },
      high: { label: "High", color: "#f59e0b", bgColor: "#fffbeb" },
      critical: { label: "Critical", color: "#ef4444", bgColor: "#fef2f2" },
    };
    return priorities[priority] || { label: priority, color: "#6b7280", bgColor: "#f3f4f6" };
  }
}

export default ITDisputeService;
