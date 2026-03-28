/**
 * Comprehensive Tests for ConflictService
 * Tests all API methods for conflict resolution
 */

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

      HttpClient.get.mockResolvedValueOnce(mockResponse);

      const result = await ConflictService.getQueue(mockToken);

      expect(HttpClient.get).toHaveBeenCalledWith(
        "/api/v1/conflicts/queue",
        { token: mockToken, useBaseUrl: true }
      );
      expect(result.cases).toHaveLength(2);
    });

    it("should pass filter parameters", async () => {
      HttpClient.get.mockResolvedValueOnce({ success: true, cases: [] });

      await ConflictService.getQueue(mockToken, {
        caseType: "appeal",
        status: "submitted",
        priority: "high",
      });

      expect(HttpClient.get).toHaveBeenCalledWith(
        "/api/v1/conflicts/queue?caseType=appeal&status=submitted&priority=high",
        { token: mockToken, useBaseUrl: true }
      );
    });

    it("should handle network errors", async () => {
      HttpClient.get.mockResolvedValueOnce({ success: false, error: "Network request failed" });

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

      HttpClient.get.mockResolvedValueOnce(mockResponse);

      const result = await ConflictService.getStats(mockToken);

      expect(result.totalPending).toBe(10);
      expect(result.slaBreachCount).toBe(2);
    });

    it("should handle error response", async () => {
      HttpClient.get.mockResolvedValueOnce({ success: false, error: "Unauthorized" });

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

      HttpClient.get.mockResolvedValueOnce(mockCase);

      const result = await ConflictService.getCase(mockToken, "appeal", 1);

      expect(HttpClient.get).toHaveBeenCalledWith(
        "/api/v1/conflicts/appeal/1",
        { token: mockToken, useBaseUrl: true }
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

      HttpClient.get.mockResolvedValueOnce(mockCase);

      const result = await ConflictService.getCase(mockToken, "adjustment", 1);

      expect(HttpClient.get).toHaveBeenCalledWith(
        "/api/v1/conflicts/adjustment/1",
        { token: mockToken, useBaseUrl: true }
      );
    });

    it("should handle case not found", async () => {
      HttpClient.get.mockResolvedValueOnce({ success: false, error: "Case not found" });

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

      HttpClient.get.mockResolvedValueOnce(mockPhotos);

      const result = await ConflictService.getPhotos(mockToken, "appeal", 1);

      expect(result.before).toHaveLength(1);
      expect(result.after).toHaveLength(1);
    });

    it("should handle empty photos", async () => {
      HttpClient.get.mockResolvedValueOnce({ success: true, before: [], after: [], passes: [] });

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

      HttpClient.get.mockResolvedValueOnce(mockChecklist);

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

      HttpClient.get.mockResolvedValueOnce(mockMessages);

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

      HttpClient.get.mockResolvedValueOnce(mockAuditTrail);

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

      HttpClient.post.mockResolvedValueOnce(mockResponse);

      const result = await ConflictService.processRefund(
        mockToken,
        "appeal",
        1,
        5000,
        "customer_request"
      );

      expect(HttpClient.post).toHaveBeenCalledWith(
        "/api/v1/conflicts/appeal/1/refund",
        { amount: 5000, reason: "customer_request" },
        { token: mockToken, useBaseUrl: true }
      );
      expect(result.success).toBe(true);
      expect(result.refundId).toBe("re_test_123");
    });

    it("should handle refund failure", async () => {
      HttpClient.post.mockResolvedValueOnce({ success: false, error: "No payment intent" });

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

      HttpClient.post.mockResolvedValueOnce(mockResponse);

      const result = await ConflictService.processPayout(
        mockToken,
        "appeal",
        1,
        3000,
        "Compensation"
      );

      expect(HttpClient.post).toHaveBeenCalledWith(
        "/api/v1/conflicts/appeal/1/payout",
        { amount: 3000, reason: "Compensation" },
        { token: mockToken, useBaseUrl: true }
      );
      expect(result.success).toBe(true);
    });

    it("should handle payout failure", async () => {
      HttpClient.post.mockResolvedValueOnce({ success: false, error: "No Stripe account" });

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
      HttpClient.post.mockResolvedValueOnce({ success: true });

      const result = await ConflictService.addNote(
        mockToken,
        "appeal",
        1,
        "Test note"
      );

      expect(HttpClient.post).toHaveBeenCalledWith(
        "/api/v1/conflicts/appeal/1/note",
        { note: "Test note" },
        { token: mockToken, useBaseUrl: true }
      );
      expect(result.success).toBe(true);
    });
  });

  describe("resolveCase", () => {
    it("should resolve case successfully", async () => {
      HttpClient.post.mockResolvedValueOnce({ success: true });

      const result = await ConflictService.resolveCase(
        mockToken,
        "appeal",
        1,
        "approved",
        "Case approved"
      );

      expect(HttpClient.post).toHaveBeenCalledWith(
        "/api/v1/conflicts/appeal/1/resolve",
        { decision: "approved", resolution: "Case approved", notes: undefined },
        { token: mockToken, useBaseUrl: true }
      );
      expect(result.success).toBe(true);
    });

    it("should handle resolution failure", async () => {
      HttpClient.post.mockResolvedValueOnce({ success: false, error: "Already resolved" });

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
      HttpClient.post.mockResolvedValueOnce({ success: true });

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

      HttpClient.post.mockResolvedValueOnce(mockResponse);

      const result = await ConflictService.createSupportTicket(mockToken, ticketData);

      expect(HttpClient.post).toHaveBeenCalledWith(
        "/api/v1/conflicts/support/create",
        ticketData,
        { token: mockToken, useBaseUrl: true }
      );
      expect(result.success).toBe(true);
      expect(result.ticket.caseNumber).toBe("SUP-000001");
    });

    it("should send all ticket data in request body", async () => {
      HttpClient.post.mockResolvedValueOnce({ success: true, ticket: { id: 1 } });

      await ConflictService.createSupportTicket(mockToken, ticketData);

      expect(HttpClient.post).toHaveBeenCalledWith(
        "/api/v1/conflicts/support/create",
        ticketData,
        { token: mockToken, useBaseUrl: true }
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
        HttpClient.post.mockResolvedValueOnce({ success: true, ticket: { id: 1 } });

        await ConflictService.createSupportTicket(mockToken, { ...ticketData, category });

        expect(HttpClient.post).toHaveBeenLastCalledWith(
          "/api/v1/conflicts/support/create",
          expect.objectContaining({ category }),
          { token: mockToken, useBaseUrl: true }
        );
      }
    });

    it("should handle all valid priorities", async () => {
      const priorities = ["normal", "high", "urgent"];

      for (const priority of priorities) {
        HttpClient.post.mockResolvedValueOnce({ success: true, ticket: { id: 1 } });

        await ConflictService.createSupportTicket(mockToken, { ...ticketData, priority });

        expect(HttpClient.post).toHaveBeenLastCalledWith(
          "/api/v1/conflicts/support/create",
          expect.objectContaining({ priority }),
          { token: mockToken, useBaseUrl: true }
        );
      }
    });

    it("should handle validation error", async () => {
      HttpClient.post.mockResolvedValueOnce({ success: false, error: "Category and description are required" });

      const result = await ConflictService.createSupportTicket(mockToken, {});

      expect(result.success).toBe(false);
      expect(result.error).toBe("Category and description are required");
    });

    it("should handle network error", async () => {
      HttpClient.post.mockResolvedValueOnce({ success: false, error: "Network request failed" });

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

      HttpClient.get.mockResolvedValueOnce({
        success: true,
        messages: mockMessages,
        conversationId: 5,
      });

      const result = await ConflictService.getLinkedConversation(mockToken, 1);

      expect(HttpClient.get).toHaveBeenCalledWith(
        "/api/v1/conflicts/support/1/conversation",
        { token: mockToken, useBaseUrl: true }
      );
      expect(result.success).toBe(true);
      expect(result.messages).toHaveLength(2);
      expect(result.conversationId).toBe(5);
    });

    it("should handle empty messages for ticket without conversation", async () => {
      HttpClient.get.mockResolvedValueOnce({
        success: true,
        messages: [],
        conversationId: null,
      });

      const result = await ConflictService.getLinkedConversation(mockToken, 1);

      expect(result.success).toBe(true);
      expect(result.messages).toHaveLength(0);
      expect(result.conversationId).toBeNull();
    });

    it("should handle ticket not found", async () => {
      HttpClient.get.mockResolvedValueOnce({ success: false, error: "Support ticket not found" });

      const result = await ConflictService.getLinkedConversation(mockToken, 999);

      expect(result.success).toBe(false);
      expect(result.error).toBe("Support ticket not found");
    });

    it("should handle network error", async () => {
      HttpClient.get.mockResolvedValueOnce({ success: false, error: "Network request failed" });

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

      HttpClient.get.mockResolvedValueOnce({ success: true, cases: mockCases, total: 2 });

      await ConflictService.getQueue(mockToken, { caseType: "support" });

      expect(HttpClient.get).toHaveBeenCalledWith(
        "/api/v1/conflicts/queue?caseType=support",
        { token: mockToken, useBaseUrl: true }
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

      HttpClient.get.mockResolvedValueOnce({ success: true, case: mockCase });

      const result = await ConflictService.getCase(mockToken, "support", 1);

      expect(HttpClient.get).toHaveBeenCalledWith(
        "/api/v1/conflicts/support/1",
        { token: mockToken, useBaseUrl: true }
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

      HttpClient.get.mockResolvedValueOnce(mockStats);

      const result = await ConflictService.getStats(mockToken);

      expect(result.support).toBeDefined();
      expect(result.support.total).toBe(3);
      expect(result.support.urgent).toBe(1);
    });
  });
});
