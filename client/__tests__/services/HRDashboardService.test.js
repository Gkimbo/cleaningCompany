import HRDashboardService from "../../src/services/fetchRequests/HRDashboardService";

// Mock global fetch
global.fetch = jest.fn();

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
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockDisputes,
      });

      const result = await HRDashboardService.getPendingDisputes(mockToken);

      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining("/api/v1/hr-dashboard/disputes/pending"),
        expect.objectContaining({
          headers: { Authorization: `Bearer ${mockToken}` },
        })
      );
      expect(result.disputes).toHaveLength(2);
      expect(result.disputes[0].status).toBe("pending_owner");
    });

    it("should return fallback on API error", async () => {
      global.fetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
      });

      const result = await HRDashboardService.getPendingDisputes(mockToken);

      expect(result.disputes).toEqual([]);
    });

    it("should return fallback on network error", async () => {
      global.fetch.mockRejectedValueOnce(new Error("Network error"));

      const result = await HRDashboardService.getPendingDisputes(mockToken);

      expect(result.disputes).toEqual([]);
    });

    it("should include home, cleaner, and homeowner data", async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockDisputes,
      });

      const result = await HRDashboardService.getPendingDisputes(mockToken);

      expect(result.disputes[0].home).toBeDefined();
      expect(result.disputes[0].home.address).toBe("123 Main St");
      expect(result.disputes[0].cleaner).toBeDefined();
      expect(result.disputes[0].cleaner.firstName).toBe("Jane");
      expect(result.disputes[0].homeowner).toBeDefined();
      expect(result.disputes[0].homeowner.firstName).toBe("John");
    });

    it("should include falseClaimCount and falseHomeSizeCount", async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockDisputes,
      });

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
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockDispute,
      });

      const result = await HRDashboardService.getDispute(mockToken, 1);

      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining("/api/v1/hr-dashboard/disputes/1"),
        expect.objectContaining({
          headers: { Authorization: `Bearer ${mockToken}` },
        })
      );
      expect(result.dispute).toBeDefined();
      expect(result.dispute.id).toBe(1);
    });

    it("should return fallback on API error", async () => {
      global.fetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
      });

      const result = await HRDashboardService.getDispute(mockToken, 999);

      expect(result.dispute).toBeNull();
    });

    it("should include photos in response", async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockDispute,
      });

      const result = await HRDashboardService.getDispute(mockToken, 1);

      expect(result.dispute.photos).toBeDefined();
      expect(result.dispute.photos).toHaveLength(1);
      expect(result.dispute.photos[0].photoUrl).toBe("https://example.com/photo.jpg");
    });

    it("should include home details with current size", async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockDispute,
      });

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
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockConversations,
      });

      const result = await HRDashboardService.getSupportConversations(mockToken);

      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining("/api/v1/hr-dashboard/support-conversations"),
        expect.objectContaining({
          headers: { Authorization: `Bearer ${mockToken}` },
        })
      );
      expect(result.conversations).toHaveLength(2);
    });

    it("should return fallback on API error", async () => {
      global.fetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
      });

      const result = await HRDashboardService.getSupportConversations(mockToken);

      expect(result.conversations).toEqual([]);
    });

    it("should return fallback on network error", async () => {
      global.fetch.mockRejectedValueOnce(new Error("Network error"));

      const result = await HRDashboardService.getSupportConversations(mockToken);

      expect(result.conversations).toEqual([]);
    });

    it("should include customer type (cleaner or homeowner)", async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockConversations,
      });

      const result = await HRDashboardService.getSupportConversations(mockToken);

      expect(result.conversations[0].customer.type).toBe("homeowner");
      expect(result.conversations[1].customer.type).toBe("cleaner");
    });

    it("should include last message preview", async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockConversations,
      });

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
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockStats,
      });

      const result = await HRDashboardService.getQuickStats(mockToken);

      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining("/api/v1/hr-dashboard/quick-stats"),
        expect.objectContaining({
          headers: { Authorization: `Bearer ${mockToken}` },
        })
      );
      expect(result.pendingDisputes).toBe(5);
      expect(result.supportConversations).toBe(10);
      expect(result.disputesResolvedThisWeek).toBe(3);
    });

    it("should return fallback on API error", async () => {
      global.fetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
      });

      const result = await HRDashboardService.getQuickStats(mockToken);

      expect(result.pendingDisputes).toBe(0);
      expect(result.supportConversations).toBe(0);
      expect(result.disputesResolvedThisWeek).toBe(0);
    });

    it("should return fallback on network error", async () => {
      global.fetch.mockRejectedValueOnce(new Error("Network error"));

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
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          message: "Dispute resolved successfully",
          adjustment: { id: 1, status: "owner_approved" },
        }),
      });

      const result = await HRDashboardService.resolveDispute(mockToken, 1, resolveData);

      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining("/api/v1/home-size-adjustment/1/owner-resolve"),
        expect.objectContaining({
          method: "POST",
          headers: {
            Authorization: `Bearer ${mockToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(resolveData),
        })
      );
      expect(result.success).toBe(true);
    });

    it("should handle resolve error gracefully", async () => {
      global.fetch.mockResolvedValueOnce({
        ok: false,
        json: async () => ({ error: "Dispute already resolved" }),
      });

      const result = await HRDashboardService.resolveDispute(mockToken, 1, resolveData);

      expect(result.success).toBe(false);
      expect(result.error).toBe("Dispute already resolved");
    });

    it("should handle network error", async () => {
      global.fetch.mockRejectedValueOnce(new Error("Network error"));

      const result = await HRDashboardService.resolveDispute(mockToken, 1, resolveData);

      expect(result.success).toBe(false);
      expect(result.error).toBe("Network error. Please try again.");
    });

    it("should handle deny decision", async () => {
      const denyData = {
        ...resolveData,
        decision: "deny",
        ownerNote: "Cleaner's claim was incorrect",
      };

      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          message: "Dispute resolved successfully",
          adjustment: { id: 1, status: "owner_denied" },
        }),
      });

      const result = await HRDashboardService.resolveDispute(mockToken, 1, denyData);

      expect(result.success).toBe(true);
      expect(fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: JSON.stringify(denyData),
        })
      );
    });
  });

  describe("fetchWithFallback helper", () => {
    it("should log warning on API error", async () => {
      const consoleSpy = jest.spyOn(console, "warn").mockImplementation(() => {});

      global.fetch.mockResolvedValueOnce({
        ok: false,
        status: 403,
      });

      await HRDashboardService.getPendingDisputes(mockToken);

      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    it("should log warning on network error", async () => {
      const consoleSpy = jest.spyOn(console, "warn").mockImplementation(() => {});

      global.fetch.mockRejectedValueOnce(new Error("Connection refused"));

      await HRDashboardService.getPendingDisputes(mockToken);

      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });

  describe("Authorization header", () => {
    it("should include Bearer token in all requests", async () => {
      global.fetch.mockResolvedValue({
        ok: true,
        json: async () => ({}),
      });

      await HRDashboardService.getPendingDisputes(mockToken);
      await HRDashboardService.getSupportConversations(mockToken);
      await HRDashboardService.getQuickStats(mockToken);

      expect(fetch).toHaveBeenCalledTimes(3);

      const calls = fetch.mock.calls;
      calls.forEach((call) => {
        expect(call[1].headers.Authorization).toBe(`Bearer ${mockToken}`);
      });
    });
  });
});
