import HRDashboardService from "../../src/services/fetchRequests/HRDashboardService";

// Mock HttpClient
jest.mock("../../src/services/HttpClient", () => ({
  __esModule: true,
  default: {
    get: jest.fn(),
    post: jest.fn(),
    put: jest.fn(),
    patch: jest.fn(),
    delete: jest.fn(),
  },
}));
import HttpClient from "../../src/services/HttpClient";

describe("HRDashboardService", () => {
  const mockToken = "test-hr-token";

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("getPendingDisputes", () => {
    const mockDisputes = {
      disputes: [
        {
          id: 1,
          status: "pending_owner",
          originalNumBeds: "3",
          originalNumBaths: "2",
          reportedNumBeds: "4",
          reportedNumBaths: "3",
          priceDifference: 2500,
          home: {
            id: 10,
            address: "123 Main St",
            city: "Boston",
          },
          cleaner: {
            id: 2,
            firstName: "Jane",
            lastName: "Cleaner",
            falseClaimCount: 0,
          },
          homeowner: {
            id: 3,
            firstName: "John",
            lastName: "Homeowner",
            falseHomeSizeCount: 0,
          },
        },
        {
          id: 2,
          status: "expired",
          originalNumBeds: "2",
          originalNumBaths: "1",
          reportedNumBeds: "3",
          reportedNumBaths: "2",
          priceDifference: 2000,
        },
      ],
    };

    it("should fetch pending disputes successfully", async () => {
      HttpClient.get.mockResolvedValueOnce(mockDisputes);

      const result = await HRDashboardService.getPendingDisputes(mockToken);

      expect(HttpClient.get).toHaveBeenCalledWith(
        "/api/v1/hr-dashboard/disputes/pending",
        { token: mockToken, useBaseUrl: true }
      );
      expect(result.disputes).toHaveLength(2);
      expect(result.disputes[0].status).toBe("pending_owner");
    });

    it("should return fallback on API error", async () => {
      HttpClient.get.mockResolvedValueOnce({ success: false, error: "Server error" });

      const result = await HRDashboardService.getPendingDisputes(mockToken);

      expect(result.disputes).toEqual([]);
    });

    it("should return fallback on network error", async () => {
      HttpClient.get.mockResolvedValueOnce({ success: false, error: "Network request failed" });

      const result = await HRDashboardService.getPendingDisputes(mockToken);

      expect(result.disputes).toEqual([]);
    });

    it("should include home, cleaner, and homeowner data", async () => {
      HttpClient.get.mockResolvedValueOnce(mockDisputes);

      const result = await HRDashboardService.getPendingDisputes(mockToken);

      expect(result.disputes[0].home).toBeDefined();
      expect(result.disputes[0].home.address).toBe("123 Main St");
      expect(result.disputes[0].cleaner).toBeDefined();
      expect(result.disputes[0].cleaner.firstName).toBe("Jane");
      expect(result.disputes[0].homeowner).toBeDefined();
      expect(result.disputes[0].homeowner.firstName).toBe("John");
    });

    it("should include falseClaimCount and falseHomeSizeCount", async () => {
      HttpClient.get.mockResolvedValueOnce(mockDisputes);

      const result = await HRDashboardService.getPendingDisputes(mockToken);

      expect(result.disputes[0].cleaner.falseClaimCount).toBeDefined();
      expect(result.disputes[0].homeowner.falseHomeSizeCount).toBeDefined();
    });
  });

  describe("getDispute", () => {
    const mockDispute = {
      dispute: {
        id: 1,
        status: "pending_owner",
        originalNumBeds: "3",
        originalNumBaths: "2",
        reportedNumBeds: "4",
        reportedNumBaths: "3",
        priceDifference: 2500,
        cleanerNotes: "Home is larger than listed",
        homeownerNotes: "This is inaccurate",
        home: {
          id: 10,
          address: "123 Main St",
          city: "Boston",
          state: "MA",
          zipcode: "02101",
          numBeds: "3",
          numBaths: "2",
          numHalfBaths: "0",
        },
        photos: [
          {
            id: 1,
            roomType: "bedroom",
            roomNumber: 4,
            photoUrl: "https://example.com/photo.jpg",
          },
        ],
      },
    };

    it("should fetch single dispute successfully", async () => {
      HttpClient.get.mockResolvedValueOnce(mockDispute);

      const result = await HRDashboardService.getDispute(mockToken, 1);

      expect(HttpClient.get).toHaveBeenCalledWith(
        "/api/v1/hr-dashboard/disputes/1",
        { token: mockToken, useBaseUrl: true }
      );
      expect(result.dispute).toBeDefined();
      expect(result.dispute.id).toBe(1);
    });

    it("should return fallback on API error", async () => {
      HttpClient.get.mockResolvedValueOnce({ success: false, error: "Not found" });

      const result = await HRDashboardService.getDispute(mockToken, 999);

      expect(result.dispute).toBeNull();
    });

    it("should include photos in response", async () => {
      HttpClient.get.mockResolvedValueOnce(mockDispute);

      const result = await HRDashboardService.getDispute(mockToken, 1);

      expect(result.dispute.photos).toBeDefined();
      expect(result.dispute.photos).toHaveLength(1);
      expect(result.dispute.photos[0].photoUrl).toBe("https://example.com/photo.jpg");
    });

    it("should include home details with current size", async () => {
      HttpClient.get.mockResolvedValueOnce(mockDispute);

      const result = await HRDashboardService.getDispute(mockToken, 1);

      expect(result.dispute.home.numBeds).toBe("3");
      expect(result.dispute.home.numBaths).toBe("2");
    });
  });

  describe("getSupportConversations", () => {
    const mockConversations = {
      conversations: [
        {
          id: 1,
          title: "Support - testuser",
          updatedAt: "2025-01-15T10:00:00Z",
          lastMessage: "I need help",
          lastMessageSender: "Test User",
          customer: {
            id: 4,
            name: "Test User",
            type: "homeowner",
          },
        },
        {
          id: 2,
          title: "Support - cleaner1",
          updatedAt: "2025-01-14T08:00:00Z",
          lastMessage: "Question about payment",
          lastMessageSender: "Cleaner One",
          customer: {
            id: 5,
            name: "Cleaner One",
            type: "cleaner",
          },
        },
      ],
    };

    it("should fetch support conversations successfully", async () => {
      HttpClient.get.mockResolvedValueOnce(mockConversations);

      const result = await HRDashboardService.getSupportConversations(mockToken);

      expect(HttpClient.get).toHaveBeenCalledWith(
        "/api/v1/hr-dashboard/support-conversations",
        { token: mockToken, useBaseUrl: true }
      );
      expect(result.conversations).toHaveLength(2);
    });

    it("should return fallback on API error", async () => {
      HttpClient.get.mockResolvedValueOnce({ success: false, error: "Server error" });

      const result = await HRDashboardService.getSupportConversations(mockToken);

      expect(result.conversations).toEqual([]);
    });

    it("should return fallback on network error", async () => {
      HttpClient.get.mockResolvedValueOnce({ success: false, error: "Network request failed" });

      const result = await HRDashboardService.getSupportConversations(mockToken);

      expect(result.conversations).toEqual([]);
    });

    it("should include customer type (cleaner or homeowner)", async () => {
      HttpClient.get.mockResolvedValueOnce(mockConversations);

      const result = await HRDashboardService.getSupportConversations(mockToken);

      expect(result.conversations[0].customer.type).toBe("homeowner");
      expect(result.conversations[1].customer.type).toBe("cleaner");
    });

    it("should include last message preview", async () => {
      HttpClient.get.mockResolvedValueOnce(mockConversations);

      const result = await HRDashboardService.getSupportConversations(mockToken);

      expect(result.conversations[0].lastMessage).toBe("I need help");
      expect(result.conversations[0].lastMessageSender).toBe("Test User");
    });
  });

  describe("getQuickStats", () => {
    const mockStats = {
      pendingDisputes: 5,
      supportConversations: 10,
      disputesResolvedThisWeek: 3,
    };

    it("should fetch quick stats successfully", async () => {
      HttpClient.get.mockResolvedValueOnce(mockStats);

      const result = await HRDashboardService.getQuickStats(mockToken);

      expect(HttpClient.get).toHaveBeenCalledWith(
        "/api/v1/hr-dashboard/quick-stats",
        { token: mockToken, useBaseUrl: true }
      );
      expect(result.pendingDisputes).toBe(5);
      expect(result.supportConversations).toBe(10);
      expect(result.disputesResolvedThisWeek).toBe(3);
    });

    it("should return fallback on API error", async () => {
      HttpClient.get.mockResolvedValueOnce({ success: false, error: "Server error" });

      const result = await HRDashboardService.getQuickStats(mockToken);

      expect(result.pendingDisputes).toBe(0);
      expect(result.supportConversations).toBe(0);
      expect(result.disputesResolvedThisWeek).toBe(0);
    });

    it("should return fallback on network error", async () => {
      HttpClient.get.mockResolvedValueOnce({ success: false, error: "Network request failed" });

      const result = await HRDashboardService.getQuickStats(mockToken);

      expect(result.pendingDisputes).toBe(0);
      expect(result.supportConversations).toBe(0);
      expect(result.disputesResolvedThisWeek).toBe(0);
    });
  });

  describe("resolveDispute", () => {
    const resolveData = {
      decision: "approve",
      finalNumBeds: "4",
      finalNumBaths: "3",
      finalNumHalfBaths: "0",
      ownerNote: "Verified home is larger",
    };

    it("should resolve dispute successfully", async () => {
      HttpClient.post.mockResolvedValueOnce({
        message: "Dispute resolved successfully",
        adjustment: { id: 1, status: "owner_approved" },
      });

      const result = await HRDashboardService.resolveDispute(mockToken, 1, resolveData);

      expect(HttpClient.post).toHaveBeenCalledWith(
        "/api/v1/home-size-adjustment/${disputeId}/owner-resolve".replace("${disputeId}", "1"),
        resolveData,
        { token: mockToken, useBaseUrl: true }
      );
      expect(result.success).toBe(true);
    });

    it("should handle resolve error gracefully", async () => {
      HttpClient.post.mockResolvedValueOnce({ success: false, error: "Dispute already resolved" });

      const result = await HRDashboardService.resolveDispute(mockToken, 1, resolveData);

      expect(result.success).toBe(false);
      expect(result.error).toBe("Dispute already resolved");
    });

    it("should handle network error", async () => {
      HttpClient.post.mockResolvedValueOnce({ success: false, error: "Network request failed" });

      const result = await HRDashboardService.resolveDispute(mockToken, 1, resolveData);

      expect(result.success).toBe(false);
      expect(result.error).toBe("Network request failed");
    });

    it("should handle deny decision", async () => {
      const denyData = {
        ...resolveData,
        decision: "deny",
        ownerNote: "Cleaner's claim was incorrect",
      };

      HttpClient.post.mockResolvedValueOnce({
        message: "Dispute resolved successfully",
        adjustment: { id: 1, status: "owner_denied" },
      });

      const result = await HRDashboardService.resolveDispute(mockToken, 1, denyData);

      expect(result.success).toBe(true);
      expect(HttpClient.post).toHaveBeenCalledWith(
        expect.any(String),
        denyData,
        { token: mockToken, useBaseUrl: true }
      );
    });
  });

  describe("fetchWithFallback helper", () => {
    it("should log warning on API error", async () => {
      const consoleSpy = jest.spyOn(console, "warn").mockImplementation(() => {});

      HttpClient.get.mockResolvedValueOnce({ success: false, error: "Forbidden" });

      await HRDashboardService.getPendingDisputes(mockToken);

      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    it("should log warning on network error", async () => {
      const consoleSpy = jest.spyOn(console, "warn").mockImplementation(() => {});

      HttpClient.get.mockResolvedValueOnce({ success: false, error: "Connection refused" });

      await HRDashboardService.getPendingDisputes(mockToken);

      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });

  describe("Authorization header", () => {
    it("should include token in all requests", async () => {
      HttpClient.get.mockResolvedValue({});

      await HRDashboardService.getPendingDisputes(mockToken);
      await HRDashboardService.getSupportConversations(mockToken);
      await HRDashboardService.getQuickStats(mockToken);

      expect(HttpClient.get).toHaveBeenCalledTimes(3);

      const calls = HttpClient.get.mock.calls;
      calls.forEach((call) => {
        expect(call[1].token).toBe(mockToken);
      });
    });
  });
});
