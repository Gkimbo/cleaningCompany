/**
 * Tests for ITDisputeService
 * Tests all API methods for IT dispute submission and management.
 */

import ITDisputeService from "../../src/services/fetchRequests/ITDisputeService";

// Mock fetch globally
global.fetch = jest.fn();

// Mock config
jest.mock("../../src/services/config", () => ({
  API_BASE: "http://localhost:3000/api/v1",
}));

describe("ITDisputeService", () => {
  const mockToken = "test-token";

  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch.mockClear();
  });

  describe("submitDispute", () => {
    it("should submit dispute successfully", async () => {
      const mockDispute = {
        id: 1,
        caseNumber: "IT-20250217-00001",
        category: "app_crash",
        status: "submitted",
      };
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ dispute: mockDispute }),
      });

      const disputeData = {
        category: "app_crash",
        description: "App crashed when opening settings",
        priority: "normal",
      };

      const result = await ITDisputeService.submitDispute(mockToken, disputeData);

      expect(global.fetch).toHaveBeenCalledWith(
        "http://localhost:3000/api/v1/it-disputes/submit",
        {
          method: "POST",
          headers: {
            Authorization: "Bearer test-token",
            "Content-Type": "application/json",
          },
          body: JSON.stringify(disputeData),
        }
      );
      expect(result.success).toBe(true);
      expect(result.dispute).toEqual(mockDispute);
    });

    it("should return error when submission fails", async () => {
      global.fetch.mockResolvedValueOnce({
        ok: false,
        json: async () => ({ error: "Invalid category" }),
      });

      const result = await ITDisputeService.submitDispute(mockToken, {
        category: "invalid",
        description: "Test",
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe("Invalid category");
    });

    it("should return error on network failure", async () => {
      global.fetch.mockRejectedValueOnce(new Error("Network error"));

      const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => {});
      const result = await ITDisputeService.submitDispute(mockToken, {});

      expect(result.success).toBe(false);
      expect(result.error).toBe("Network error. Please try again.");
      consoleSpy.mockRestore();
    });

    it("should include device info and platform in submission", async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ dispute: { id: 1 } }),
      });

      const disputeData = {
        category: "app_crash",
        description: "App crashed",
        priority: "normal",
        deviceInfo: { model: "iPhone 15" },
        appVersion: "1.0.0",
        platform: "ios",
      };

      await ITDisputeService.submitDispute(mockToken, disputeData);

      expect(global.fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: JSON.stringify(disputeData),
        })
      );
    });
  });

  describe("getMyDisputes", () => {
    it("should fetch user disputes successfully", async () => {
      const mockDisputes = [
        { id: 1, category: "app_crash", status: "submitted" },
        { id: 2, category: "billing_error", status: "resolved" },
      ];
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ disputes: mockDisputes }),
      });

      const result = await ITDisputeService.getMyDisputes(mockToken);

      expect(global.fetch).toHaveBeenCalledWith(
        "http://localhost:3000/api/v1/it-disputes/my-disputes",
        { headers: { Authorization: "Bearer test-token" } }
      );
      expect(result.success).toBe(true);
      expect(result.disputes).toEqual(mockDisputes);
    });

    it("should return error when fetch fails", async () => {
      global.fetch.mockResolvedValueOnce({
        ok: false,
        json: async () => ({ error: "Unauthorized" }),
      });

      const result = await ITDisputeService.getMyDisputes(mockToken);

      expect(result.success).toBe(false);
      expect(result.error).toBe("Unauthorized");
    });

    it("should return empty array on missing disputes", async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({}),
      });

      const result = await ITDisputeService.getMyDisputes(mockToken);

      expect(result.success).toBe(true);
      expect(result.disputes).toEqual([]);
    });

    it("should handle network error", async () => {
      global.fetch.mockRejectedValueOnce(new Error("Network error"));

      const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => {});
      const result = await ITDisputeService.getMyDisputes(mockToken);

      expect(result.success).toBe(false);
      expect(result.error).toBe("Network error. Please try again.");
      consoleSpy.mockRestore();
    });
  });

  describe("getDispute", () => {
    it("should fetch single dispute successfully", async () => {
      const mockDispute = {
        id: 1,
        caseNumber: "IT-20250217-00001",
        category: "app_crash",
        description: "App crashed",
        status: "submitted",
        priority: "normal",
      };
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ dispute: mockDispute }),
      });

      const result = await ITDisputeService.getDispute(mockToken, 1);

      expect(global.fetch).toHaveBeenCalledWith(
        "http://localhost:3000/api/v1/it-disputes/1",
        { headers: { Authorization: "Bearer test-token" } }
      );
      expect(result.success).toBe(true);
      expect(result.dispute).toEqual(mockDispute);
    });

    it("should return error when dispute not found", async () => {
      global.fetch.mockResolvedValueOnce({
        ok: false,
        json: async () => ({ error: "Dispute not found" }),
      });

      const result = await ITDisputeService.getDispute(mockToken, 999);

      expect(result.success).toBe(false);
      expect(result.error).toBe("Dispute not found");
    });

    it("should return error when not reporter", async () => {
      global.fetch.mockResolvedValueOnce({
        ok: false,
        json: async () => ({ error: "Not authorized to view this dispute" }),
      });

      const result = await ITDisputeService.getDispute(mockToken, 1);

      expect(result.success).toBe(false);
      expect(result.error).toBe("Not authorized to view this dispute");
    });
  });

  describe("addInfo", () => {
    it("should add additional info successfully", async () => {
      const mockDispute = {
        id: 1,
        description: "Original description\n\n--- Additional Info ---\nMore details",
      };
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ dispute: mockDispute }),
      });

      const result = await ITDisputeService.addInfo(mockToken, 1, {
        additionalInfo: "More details",
      });

      expect(global.fetch).toHaveBeenCalledWith(
        "http://localhost:3000/api/v1/it-disputes/1/add-info",
        {
          method: "POST",
          headers: {
            Authorization: "Bearer test-token",
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ additionalInfo: "More details" }),
        }
      );
      expect(result.success).toBe(true);
    });

    it("should return error when dispute is closed", async () => {
      global.fetch.mockResolvedValueOnce({
        ok: false,
        json: async () => ({ error: "Cannot add info to closed dispute" }),
      });

      const result = await ITDisputeService.addInfo(mockToken, 1, {
        additionalInfo: "More details",
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe("Cannot add info to closed dispute");
    });

    it("should handle network error", async () => {
      global.fetch.mockRejectedValueOnce(new Error("Network error"));

      const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => {});
      const result = await ITDisputeService.addInfo(mockToken, 1, {});

      expect(result.success).toBe(false);
      expect(result.error).toBe("Network error. Please try again.");
      consoleSpy.mockRestore();
    });
  });

  describe("getCategories", () => {
    it("should fetch categories successfully", async () => {
      const mockCategories = [
        { value: "app_crash", label: "App Crash", group: "technical" },
        { value: "billing_error", label: "Billing Error", group: "billing" },
      ];
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ categories: mockCategories }),
      });

      const result = await ITDisputeService.getCategories(mockToken);

      expect(global.fetch).toHaveBeenCalledWith(
        "http://localhost:3000/api/v1/it-disputes/categories/list",
        { headers: { Authorization: "Bearer test-token" } }
      );
      expect(result.success).toBe(true);
      expect(result.categories).toEqual(mockCategories);
    });

    it("should handle fetch failure", async () => {
      global.fetch.mockResolvedValueOnce({
        ok: false,
        json: async () => ({ error: "Failed to load" }),
      });

      const result = await ITDisputeService.getCategories(mockToken);

      expect(result.success).toBe(false);
      expect(result.error).toBe("Failed to load");
    });
  });

  describe("Static Helper Methods", () => {
    describe("getCategoryGroups", () => {
      it("should return all category groups", () => {
        const groups = ITDisputeService.getCategoryGroups();

        expect(groups).toHaveProperty("technical");
        expect(groups).toHaveProperty("profile");
        expect(groups).toHaveProperty("billing");
        expect(groups).toHaveProperty("security");
        expect(groups).toHaveProperty("data");
      });

      it("should have correct technical categories", () => {
        const groups = ITDisputeService.getCategoryGroups();

        expect(groups.technical.label).toBe("Technical Issues");
        expect(groups.technical.icon).toBe("laptop");
        expect(groups.technical.categories).toContainEqual({
          value: "app_crash",
          label: "App Crash",
        });
        expect(groups.technical.categories).toContainEqual({
          value: "login_problem",
          label: "Login Problem",
        });
        expect(groups.technical.categories).toContainEqual({
          value: "system_outage",
          label: "System Outage",
        });
        expect(groups.technical.categories).toContainEqual({
          value: "performance_issue",
          label: "Performance Issue",
        });
      });

      it("should have correct profile categories", () => {
        const groups = ITDisputeService.getCategoryGroups();

        expect(groups.profile.label).toBe("Profile & Account");
        expect(groups.profile.categories).toContainEqual({
          value: "profile_change",
          label: "Profile Change Request",
        });
        expect(groups.profile.categories).toContainEqual({
          value: "password_reset",
          label: "Password Reset",
        });
      });

      it("should have correct billing categories", () => {
        const groups = ITDisputeService.getCategoryGroups();

        expect(groups.billing.label).toBe("Billing & Payments");
        expect(groups.billing.categories).toContainEqual({
          value: "billing_error",
          label: "Billing Error",
        });
        expect(groups.billing.categories).toContainEqual({
          value: "payment_system_error",
          label: "Payment System Error",
        });
      });

      it("should have correct security categories", () => {
        const groups = ITDisputeService.getCategoryGroups();

        expect(groups.security.label).toBe("Security");
        expect(groups.security.categories).toContainEqual({
          value: "security_issue",
          label: "Security Issue",
        });
        expect(groups.security.categories).toContainEqual({
          value: "suspicious_activity",
          label: "Suspicious Activity",
        });
      });

      it("should have correct data categories", () => {
        const groups = ITDisputeService.getCategoryGroups();

        expect(groups.data.label).toBe("Data Requests");
        expect(groups.data.categories).toContainEqual({
          value: "data_request",
          label: "Data Export/GDPR Request",
        });
      });
    });

    describe("getPriorityOptions", () => {
      it("should return all priority options", () => {
        const options = ITDisputeService.getPriorityOptions();

        expect(options).toHaveLength(4);
        expect(options.map((o) => o.value)).toEqual(["low", "normal", "high", "critical"]);
      });

      it("should have correct low priority", () => {
        const options = ITDisputeService.getPriorityOptions();
        const low = options.find((o) => o.value === "low");

        expect(low.label).toBe("Low");
        expect(low.description).toBe("Non-urgent issue, can wait");
      });

      it("should have correct critical priority", () => {
        const options = ITDisputeService.getPriorityOptions();
        const critical = options.find((o) => o.value === "critical");

        expect(critical.label).toBe("Critical");
        expect(critical.description).toBe("Urgent - blocking work");
      });
    });

    describe("getStatusInfo", () => {
      it("should return correct info for submitted status", () => {
        const info = ITDisputeService.getStatusInfo("submitted");

        expect(info.label).toBe("Submitted");
        expect(info.color).toBe("#6366f1");
        expect(info.bgColor).toBe("#eef2ff");
      });

      it("should return correct info for in_progress status", () => {
        const info = ITDisputeService.getStatusInfo("in_progress");

        expect(info.label).toBe("In Progress");
        expect(info.color).toBe("#f59e0b");
        expect(info.bgColor).toBe("#fffbeb");
      });

      it("should return correct info for awaiting_info status", () => {
        const info = ITDisputeService.getStatusInfo("awaiting_info");

        expect(info.label).toBe("Awaiting Info");
        expect(info.color).toBe("#8b5cf6");
        expect(info.bgColor).toBe("#f5f3ff");
      });

      it("should return correct info for resolved status", () => {
        const info = ITDisputeService.getStatusInfo("resolved");

        expect(info.label).toBe("Resolved");
        expect(info.color).toBe("#10b981");
        expect(info.bgColor).toBe("#ecfdf5");
      });

      it("should return correct info for closed status", () => {
        const info = ITDisputeService.getStatusInfo("closed");

        expect(info.label).toBe("Closed");
        expect(info.color).toBe("#6b7280");
        expect(info.bgColor).toBe("#f3f4f6");
      });

      it("should return default info for unknown status", () => {
        const info = ITDisputeService.getStatusInfo("unknown");

        expect(info.label).toBe("unknown");
        expect(info.color).toBe("#6b7280");
      });
    });

    describe("getPriorityInfo", () => {
      it("should return correct info for low priority", () => {
        const info = ITDisputeService.getPriorityInfo("low");

        expect(info.label).toBe("Low");
        expect(info.color).toBe("#6b7280");
        expect(info.bgColor).toBe("#f3f4f6");
      });

      it("should return correct info for normal priority", () => {
        const info = ITDisputeService.getPriorityInfo("normal");

        expect(info.label).toBe("Normal");
        expect(info.color).toBe("#3b82f6");
        expect(info.bgColor).toBe("#eff6ff");
      });

      it("should return correct info for high priority", () => {
        const info = ITDisputeService.getPriorityInfo("high");

        expect(info.label).toBe("High");
        expect(info.color).toBe("#f59e0b");
        expect(info.bgColor).toBe("#fffbeb");
      });

      it("should return correct info for critical priority", () => {
        const info = ITDisputeService.getPriorityInfo("critical");

        expect(info.label).toBe("Critical");
        expect(info.color).toBe("#ef4444");
        expect(info.bgColor).toBe("#fef2f2");
      });

      it("should return default info for unknown priority", () => {
        const info = ITDisputeService.getPriorityInfo("unknown");

        expect(info.label).toBe("unknown");
        expect(info.color).toBe("#6b7280");
      });
    });
  });
});
