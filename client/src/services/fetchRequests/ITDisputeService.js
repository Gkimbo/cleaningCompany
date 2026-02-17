import { API_BASE } from "../config";

const baseURL = API_BASE.replace("/api/v1", "");

class ITDisputeService {
  // Submit a new IT dispute (all authenticated users can submit)
  static async submitDispute(token, disputeData) {
    try {
      const response = await fetch(`${baseURL}/api/v1/it-disputes/submit`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(disputeData),
      });

      const data = await response.json();

      if (!response.ok) {
        return { success: false, error: data.error || "Failed to submit dispute" };
      }

      return { success: true, dispute: data.dispute };
    } catch (error) {
      console.error("[ITDispute] submitDispute failed:", error.message);
      return { success: false, error: "Network error. Please try again." };
    }
  }

  // Get user's submitted disputes
  static async getMyDisputes(token) {
    try {
      const response = await fetch(`${baseURL}/api/v1/it-disputes/my-disputes`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) {
        const errorData = await response.json();
        return { success: false, error: errorData.error || "Failed to fetch disputes" };
      }

      const data = await response.json();
      return { success: true, disputes: data.disputes || [] };
    } catch (error) {
      console.error("[ITDispute] getMyDisputes failed:", error.message);
      return { success: false, error: "Network error. Please try again." };
    }
  }

  // Get a specific dispute's details
  static async getDispute(token, disputeId) {
    try {
      const response = await fetch(`${baseURL}/api/v1/it-disputes/${disputeId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) {
        const errorData = await response.json();
        return { success: false, error: errorData.error || "Failed to fetch dispute" };
      }

      const data = await response.json();
      return { success: true, dispute: data.dispute };
    } catch (error) {
      console.error("[ITDispute] getDispute failed:", error.message);
      return { success: false, error: "Network error. Please try again." };
    }
  }

  // Add additional information to a dispute
  static async addInfo(token, disputeId, info) {
    try {
      const response = await fetch(`${baseURL}/api/v1/it-disputes/${disputeId}/add-info`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(info),
      });

      const data = await response.json();

      if (!response.ok) {
        return { success: false, error: data.error || "Failed to add information" };
      }

      return { success: true, dispute: data.dispute };
    } catch (error) {
      console.error("[ITDispute] addInfo failed:", error.message);
      return { success: false, error: "Network error. Please try again." };
    }
  }

  // Get available categories
  static async getCategories(token) {
    try {
      const response = await fetch(`${baseURL}/api/v1/it-disputes/categories/list`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) {
        const errorData = await response.json();
        return { success: false, error: errorData.error || "Failed to fetch categories" };
      }

      const data = await response.json();
      return { success: true, categories: data.categories };
    } catch (error) {
      console.error("[ITDispute] getCategories failed:", error.message);
      return { success: false, error: "Network error. Please try again." };
    }
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
