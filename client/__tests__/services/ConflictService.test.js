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

  // ==================
  // Support Ticket Tests
  // ==================

  describe("createSupportTicket", () => {
    const ticketData = {
      category: "account_issue",
      description: "User having login issues",
      priority: "normal",
      conversationId: 5,
      subjectUserId: 10,
      subjectType: "homeowner",
    };

    it("should create support ticket successfully", async () => {
      const mockResponse = {
        success: true,
        ticket: {
          id: 1,
          caseNumber: "SUP-000001",
          status: "submitted",
          priority: "normal",
        },
      };

      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const result = await ConflictService.createSupportTicket(mockToken, ticketData);

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining("/api/v1/conflicts/support/create"),
        expect.objectContaining({
          method: "POST",
          headers: expect.objectContaining({
            Authorization: `Bearer ${mockToken}`,
          }),
        })
      );
      expect(result.success).toBe(true);
      expect(result.ticket.caseNumber).toBe("SUP-000001");
    });

    it("should send all ticket data in request body", async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: true, ticket: { id: 1 } }),
      });

      await ConflictService.createSupportTicket(mockToken, ticketData);

      expect(global.fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: JSON.stringify(ticketData),
        })
      );
    });

    it("should handle all valid categories", async () => {
      const categories = [
        "account_issue",
        "behavior_concern",
        "service_complaint",
        "billing_question",
        "technical_issue",
        "policy_violation",
        "other",
      ];

      for (const category of categories) {
        global.fetch.mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ success: true, ticket: { id: 1 } }),
        });

        await ConflictService.createSupportTicket(mockToken, { ...ticketData, category });

        expect(global.fetch).toHaveBeenLastCalledWith(
          expect.any(String),
          expect.objectContaining({
            body: expect.stringContaining(category),
          })
        );
      }
    });

    it("should handle all valid priorities", async () => {
      const priorities = ["normal", "high", "urgent"];

      for (const priority of priorities) {
        global.fetch.mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ success: true, ticket: { id: 1 } }),
        });

        await ConflictService.createSupportTicket(mockToken, { ...ticketData, priority });

        expect(global.fetch).toHaveBeenLastCalledWith(
          expect.any(String),
          expect.objectContaining({
            body: expect.stringContaining(priority),
          })
        );
      }
    });

    it("should handle validation error", async () => {
      global.fetch.mockResolvedValueOnce({
        ok: false,
        json: () => Promise.resolve({ error: "Category and description are required" }),
      });

      const result = await ConflictService.createSupportTicket(mockToken, {});

      expect(result.success).toBe(false);
      expect(result.error).toBe("Category and description are required");
    });

    it("should handle network error", async () => {
      global.fetch.mockRejectedValueOnce(new Error("Network error"));

      const result = await ConflictService.createSupportTicket(mockToken, ticketData);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe("getLinkedConversation", () => {
    it("should fetch linked conversation messages", async () => {
      const mockMessages = [
        { id: 1, content: "Hello", sender: { firstName: "John" } },
        { id: 2, content: "Hi there", sender: { firstName: "Jane" } },
      ];

      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          success: true,
          messages: mockMessages,
          conversationId: 5,
        }),
      });

      const result = await ConflictService.getLinkedConversation(mockToken, 1);

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining("/api/v1/conflicts/support/1/conversation"),
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: `Bearer ${mockToken}`,
          }),
        })
      );
      expect(result.success).toBe(true);
      expect(result.messages).toHaveLength(2);
      expect(result.conversationId).toBe(5);
    });

    it("should handle empty messages for ticket without conversation", async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          success: true,
          messages: [],
          conversationId: null,
        }),
      });

      const result = await ConflictService.getLinkedConversation(mockToken, 1);

      expect(result.success).toBe(true);
      expect(result.messages).toHaveLength(0);
      expect(result.conversationId).toBeNull();
    });

    it("should handle ticket not found", async () => {
      global.fetch.mockResolvedValueOnce({
        ok: false,
        json: () => Promise.resolve({ error: "Support ticket not found" }),
      });

      const result = await ConflictService.getLinkedConversation(mockToken, 999);

      expect(result.success).toBe(false);
      expect(result.error).toBe("Support ticket not found");
    });

    it("should handle network error", async () => {
      global.fetch.mockRejectedValueOnce(new Error("Network error"));

      const result = await ConflictService.getLinkedConversation(mockToken, 1);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe("getQueue with support filter", () => {
    it("should filter queue by support case type", async () => {
      const mockCases = [
        { id: 1, caseType: "support", caseNumber: "SUP-000001" },
        { id: 2, caseType: "support", caseNumber: "SUP-000002" },
      ];

      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: true, cases: mockCases, total: 2 }),
      });

      await ConflictService.getQueue(mockToken, { caseType: "support" });

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining("caseType=support"),
        expect.any(Object)
      );
    });
  });

  describe("getCase for support type", () => {
    it("should fetch support ticket case details", async () => {
      const mockCase = {
        id: 1,
        caseNumber: "SUP-000001",
        category: "account_issue",
        description: "User having login issues",
        status: "submitted",
        conversationId: 5,
      };

      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: true, case: mockCase }),
      });

      const result = await ConflictService.getCase(mockToken, "support", 1);

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining("/api/v1/conflicts/support/1"),
        expect.any(Object)
      );
      expect(result.success).toBe(true);
      expect(result.case.caseNumber).toBe("SUP-000001");
      expect(result.case.category).toBe("account_issue");
    });
  });

  describe("getStats including support tickets", () => {
    it("should return support ticket stats in queue stats", async () => {
      const mockStats = {
        success: true,
        totalPending: 15,
        appeals: { total: 5, urgent: 2 },
        adjustments: { total: 3 },
        payments: { total: 4 },
        support: { total: 3, urgent: 1 },
      };

      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockStats),
      });

      const result = await ConflictService.getStats(mockToken);

      expect(result.support).toBeDefined();
      expect(result.support.total).toBe(3);
      expect(result.support.urgent).toBe(1);
    });
  });
});
