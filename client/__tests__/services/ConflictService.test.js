/**
 * Comprehensive Tests for ConflictService
 * Tests all API methods for conflict resolution
 */

// Mock fetch globally
global.fetch = jest.fn();

// Mock config
jest.mock("../../src/services/config", () => ({
  API_BASE: "http://localhost:5000/api/v1",
}));

import ConflictService from "../../src/services/fetchRequests/ConflictService";

describe("ConflictService", () => {
  const mockToken = "test_token_123";

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("getQueue", () => {
    it("should fetch conflict queue successfully", async () => {
      const mockResponse = {
        success: true,
        cases: [
          { id: 1, caseType: "appeal", status: "submitted" },
          { id: 2, caseType: "adjustment", status: "pending_owner" },
        ],
        total: 2,
      };

      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const result = await ConflictService.getQueue(mockToken);

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining("/api/v1/conflicts/queue"),
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: `Bearer ${mockToken}`,
          }),
        })
      );
      expect(result.cases).toHaveLength(2);
    });

    it("should pass filter parameters", async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: true, cases: [] }),
      });

      await ConflictService.getQueue(mockToken, {
        caseType: "appeal",
        status: "submitted",
        priority: "high",
      });

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining("caseType=appeal"),
        expect.any(Object)
      );
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining("status=submitted"),
        expect.any(Object)
      );
    });

    it("should handle network errors", async () => {
      global.fetch.mockRejectedValueOnce(new Error("Network error"));

      const result = await ConflictService.getQueue(mockToken);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe("getStats", () => {
    it("should fetch queue statistics successfully", async () => {
      const mockResponse = {
        success: true,
        totalPending: 10,
        slaBreachCount: 2,
        appeals: { pending: 5 },
        adjustments: { pending: 5 },
      };

      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const result = await ConflictService.getStats(mockToken);

      expect(result.totalPending).toBe(10);
      expect(result.slaBreachCount).toBe(2);
    });

    it("should handle error response", async () => {
      global.fetch.mockResolvedValueOnce({
        ok: false,
        json: () => Promise.resolve({ error: "Unauthorized" }),
      });

      const result = await ConflictService.getStats(mockToken);

      expect(result.error).toBeDefined();
    });
  });

  describe("getCase", () => {
    it("should fetch appeal case details", async () => {
      const mockCase = {
        success: true,
        case: {
          id: 1,
          status: "under_review",
          description: "Test case",
          appointment: { id: 100 },
        },
      };

      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockCase),
      });

      const result = await ConflictService.getCase(mockToken, "appeal", 1);

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining("/api/v1/conflicts/appeal/1"),
        expect.any(Object)
      );
      expect(result.case.id).toBe(1);
    });

    it("should fetch adjustment case details", async () => {
      const mockCase = {
        success: true,
        case: {
          id: 1,
          status: "pending_owner",
          priceDifference: 50,
        },
      };

      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockCase),
      });

      const result = await ConflictService.getCase(mockToken, "adjustment", 1);

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining("/api/v1/conflicts/adjustment/1"),
        expect.any(Object)
      );
    });

    it("should handle case not found", async () => {
      global.fetch.mockResolvedValueOnce({
        ok: false,
        json: () => Promise.resolve({ success: false, error: "Case not found" }),
      });

      const result = await ConflictService.getCase(mockToken, "appeal", 999);

      expect(result.success).toBe(false);
      expect(result.error).toBe("Case not found");
    });
  });

  describe("getPhotos", () => {
    it("should fetch appointment photos", async () => {
      const mockPhotos = {
        success: true,
        before: [{ id: 1, photoData: "base64..." }],
        after: [{ id: 2, photoData: "base64..." }],
        passes: [],
      };

      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockPhotos),
      });

      const result = await ConflictService.getPhotos(mockToken, "appeal", 1);

      expect(result.before).toHaveLength(1);
      expect(result.after).toHaveLength(1);
    });

    it("should handle empty photos", async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: true, before: [], after: [], passes: [] }),
      });

      const result = await ConflictService.getPhotos(mockToken, "appeal", 1);

      expect(result.before).toHaveLength(0);
      expect(result.after).toHaveLength(0);
    });
  });

  describe("getChecklist", () => {
    it("should fetch checklist data", async () => {
      const mockChecklist = {
        success: true,
        checklistData: {
          items: [
            { name: "Kitchen", completed: true },
            { name: "Bathroom", completed: false },
          ],
        },
        completionNotes: "All done",
      };

      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockChecklist),
      });

      const result = await ConflictService.getChecklist(mockToken, "appeal", 1);

      expect(result.checklistData.items).toHaveLength(2);
    });
  });

  describe("getMessages", () => {
    it("should fetch conversation messages", async () => {
      const mockMessages = {
        success: true,
        messages: [
          { id: 1, content: "Hello", sender: { firstName: "John" } },
          { id: 2, content: "Hi there", sender: { firstName: "Jane" } },
        ],
      };

      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockMessages),
      });

      const result = await ConflictService.getMessages(mockToken, "appeal", 1);

      expect(result.messages).toHaveLength(2);
    });
  });

  describe("getAuditTrail", () => {
    it("should fetch audit trail", async () => {
      const mockAuditTrail = {
        success: true,
        auditTrail: [
          { id: 1, action: "case_created", createdAt: new Date().toISOString() },
          { id: 2, action: "status_changed", createdAt: new Date().toISOString() },
        ],
      };

      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockAuditTrail),
      });

      const result = await ConflictService.getAuditTrail(mockToken, "appeal", 1);

      expect(result.auditTrail).toHaveLength(2);
    });
  });

  describe("processRefund", () => {
    it("should process refund successfully", async () => {
      const mockResponse = {
        success: true,
        refundId: "re_test_123",
        amount: 5000,
      };

      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const result = await ConflictService.processRefund(
        mockToken,
        "appeal",
        1,
        5000,
        "customer_request"
      );

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining("/api/v1/conflicts/appeal/1/refund"),
        expect.objectContaining({
          method: "POST",
          body: expect.stringContaining('"amount":5000'),
        })
      );
      expect(result.success).toBe(true);
      expect(result.refundId).toBe("re_test_123");
    });

    it("should handle refund failure", async () => {
      global.fetch.mockResolvedValueOnce({
        ok: false,
        json: () => Promise.resolve({ success: false, error: "No payment intent" }),
      });

      const result = await ConflictService.processRefund(
        mockToken,
        "appeal",
        1,
        5000,
        "test"
      );

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe("processPayout", () => {
    it("should process payout successfully", async () => {
      const mockResponse = {
        success: true,
        transferId: "tr_test_123",
        amount: 3000,
      };

      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const result = await ConflictService.processPayout(
        mockToken,
        "appeal",
        1,
        3000,
        "Compensation"
      );

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining("/api/v1/conflicts/appeal/1/payout"),
        expect.objectContaining({
          method: "POST",
        })
      );
      expect(result.success).toBe(true);
    });

    it("should handle payout failure", async () => {
      global.fetch.mockResolvedValueOnce({
        ok: false,
        json: () => Promise.resolve({ success: false, error: "No Stripe account" }),
      });

      const result = await ConflictService.processPayout(
        mockToken,
        "appeal",
        1,
        3000,
        "test"
      );

      expect(result.success).toBe(false);
    });
  });

  describe("addNote", () => {
    it("should add note successfully", async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: true }),
      });

      const result = await ConflictService.addNote(
        mockToken,
        "appeal",
        1,
        "Test note"
      );

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining("/api/v1/conflicts/appeal/1/note"),
        expect.objectContaining({
          method: "POST",
          body: expect.stringContaining("Test note"),
        })
      );
      expect(result.success).toBe(true);
    });
  });

  describe("resolveCase", () => {
    it("should resolve case successfully", async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: true }),
      });

      const result = await ConflictService.resolveCase(
        mockToken,
        "appeal",
        1,
        "approved",
        "Case approved"
      );

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining("/api/v1/conflicts/appeal/1/resolve"),
        expect.objectContaining({
          method: "POST",
        })
      );
      expect(result.success).toBe(true);
    });

    it("should handle resolution failure", async () => {
      global.fetch.mockResolvedValueOnce({
        ok: false,
        json: () => Promise.resolve({ success: false, error: "Already resolved" }),
      });

      const result = await ConflictService.resolveCase(
        mockToken,
        "appeal",
        1,
        "approved",
        "test"
      );

      expect(result.success).toBe(false);
    });
  });

  describe("assignCase", () => {
    it("should assign case successfully", async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: true }),
      });

      const result = await ConflictService.assignCase(
        mockToken,
        "appeal",
        1,
        5
      );

      expect(result.success).toBe(true);
    });
  });
});
