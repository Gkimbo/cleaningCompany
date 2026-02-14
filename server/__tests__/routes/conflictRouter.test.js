/**
 * Comprehensive Tests for the Conflict Resolution Router
 * Tests all API endpoints for conflict management
 */

const request = require("supertest");
const express = require("express");

// Mock authentication middleware
jest.mock("../../middleware/verifyHROrOwner", () => (req, res, next) => {
	req.user = { id: 1, type: "hr" };
	next();
});

// Mock ConflictResolutionService
const mockGetConflictQueue = jest.fn();
const mockGetQueueStats = jest.fn();
const mockGetConflictCase = jest.fn();
const mockGetAppointmentPhotos = jest.fn();
const mockGetAppointmentChecklist = jest.fn();
const mockGetAppointmentMessages = jest.fn();
const mockGetAuditTrail = jest.fn();
const mockProcessRefund = jest.fn();
const mockProcessCleanerPayout = jest.fn();
const mockAddNote = jest.fn();
const mockResolveCase = jest.fn();
const mockAssignCase = jest.fn();

jest.mock("../../services/ConflictResolutionService", () => ({
	getConflictQueue: (...args) => mockGetConflictQueue(...args),
	getQueueStats: (...args) => mockGetQueueStats(...args),
	getConflictCase: (...args) => mockGetConflictCase(...args),
	getAppointmentPhotos: (...args) => mockGetAppointmentPhotos(...args),
	getAppointmentChecklist: (...args) => mockGetAppointmentChecklist(...args),
	getAppointmentMessages: (...args) => mockGetAppointmentMessages(...args),
	getAuditTrail: (...args) => mockGetAuditTrail(...args),
	processRefund: (...args) => mockProcessRefund(...args),
	processCleanerPayout: (...args) => mockProcessCleanerPayout(...args),
	addNote: (...args) => mockAddNote(...args),
	resolveCase: (...args) => mockResolveCase(...args),
	assignCase: (...args) => mockAssignCase(...args),
}));

const conflictRouter = require("../../routes/api/v1/conflictRouter");

// Create test app
const app = express();
app.use(express.json());
app.use("/api/v1/conflicts", conflictRouter);

describe("Conflict Router", () => {
	beforeEach(() => {
		jest.clearAllMocks();
	});

	describe("GET /api/v1/conflicts/queue", () => {
		it("should return conflict queue successfully", async () => {
			const mockQueue = {
				cases: [
					{ id: 1, caseType: "appeal", status: "submitted" },
					{ id: 2, caseType: "adjustment", status: "pending_owner" },
				],
				total: 2,
				limit: 50,
				offset: 0,
			};
			mockGetConflictQueue.mockResolvedValue(mockQueue);

			const response = await request(app)
				.get("/api/v1/conflicts/queue")
				.expect(200);

			expect(response.body.success).toBe(true);
			expect(response.body.cases).toHaveLength(2);
			expect(mockGetConflictQueue).toHaveBeenCalled();
		});

		it("should filter by case type", async () => {
			mockGetConflictQueue.mockResolvedValue({ cases: [], total: 0 });

			await request(app)
				.get("/api/v1/conflicts/queue?caseType=appeal")
				.expect(200);

			expect(mockGetConflictQueue).toHaveBeenCalledWith(
				expect.objectContaining({ caseType: "appeal" })
			);
		});

		it("should filter by status", async () => {
			mockGetConflictQueue.mockResolvedValue({ cases: [], total: 0 });

			await request(app)
				.get("/api/v1/conflicts/queue?status=submitted")
				.expect(200);

			expect(mockGetConflictQueue).toHaveBeenCalledWith(
				expect.objectContaining({ status: "submitted" })
			);
		});

		it("should handle pagination parameters", async () => {
			mockGetConflictQueue.mockResolvedValue({ cases: [], total: 0, limit: 10, offset: 20 });

			await request(app)
				.get("/api/v1/conflicts/queue?limit=10&offset=20")
				.expect(200);

			expect(mockGetConflictQueue).toHaveBeenCalledWith(
				expect.objectContaining({ limit: 10, offset: 20 })
			);
		});

		it("should include resolved cases when includeResolved=true", async () => {
			const mockQueue = {
				cases: [
					{ id: 1, caseType: "appeal", status: "submitted" },
					{ id: 2, caseType: "appeal", status: "approved" },
					{ id: 3, caseType: "adjustment", status: "denied" },
				],
				total: 3,
				limit: 50,
				offset: 0,
			};
			mockGetConflictQueue.mockResolvedValue(mockQueue);

			const response = await request(app)
				.get("/api/v1/conflicts/queue?includeResolved=true")
				.expect(200);

			expect(response.body.success).toBe(true);
			expect(response.body.cases).toHaveLength(3);
			expect(mockGetConflictQueue).toHaveBeenCalledWith(
				expect.objectContaining({ includeResolved: true })
			);
		});

		it("should exclude resolved cases by default (includeResolved=false)", async () => {
			const mockQueue = {
				cases: [
					{ id: 1, caseType: "appeal", status: "submitted" },
				],
				total: 1,
				limit: 50,
				offset: 0,
			};
			mockGetConflictQueue.mockResolvedValue(mockQueue);

			const response = await request(app)
				.get("/api/v1/conflicts/queue")
				.expect(200);

			expect(response.body.success).toBe(true);
			expect(response.body.cases).toHaveLength(1);
			expect(mockGetConflictQueue).toHaveBeenCalledWith(
				expect.objectContaining({ includeResolved: false })
			);
		});

		it("should handle includeResolved=false explicitly", async () => {
			mockGetConflictQueue.mockResolvedValue({ cases: [], total: 0 });

			await request(app)
				.get("/api/v1/conflicts/queue?includeResolved=false")
				.expect(200);

			expect(mockGetConflictQueue).toHaveBeenCalledWith(
				expect.objectContaining({ includeResolved: false })
			);
		});

		it("should return archived cases with proper status indicators", async () => {
			const mockQueue = {
				cases: [
					{ id: 1, caseType: "appeal", status: "approved", resolvedAt: new Date() },
					{ id: 2, caseType: "appeal", status: "denied", resolvedAt: new Date() },
					{ id: 3, caseType: "adjustment", status: "partial", resolvedAt: new Date() },
				],
				total: 3,
				limit: 50,
				offset: 0,
			};
			mockGetConflictQueue.mockResolvedValue(mockQueue);

			const response = await request(app)
				.get("/api/v1/conflicts/queue?includeResolved=true")
				.expect(200);

			expect(response.body.success).toBe(true);
			// Verify all resolved statuses are included
			const statuses = response.body.cases.map(c => c.status);
			expect(statuses).toContain("approved");
			expect(statuses).toContain("denied");
			expect(statuses).toContain("partial");
		});

		it("should handle errors gracefully", async () => {
			mockGetConflictQueue.mockRejectedValue(new Error("Database error"));

			const response = await request(app)
				.get("/api/v1/conflicts/queue")
				.expect(500);

			expect(response.body.success).toBe(false);
			expect(response.body.error).toBe("Database error");
		});
	});

	describe("GET /api/v1/conflicts/stats", () => {
		it("should return queue statistics", async () => {
			const mockStats = {
				totalPending: 10,
				slaBreachCount: 2,
				appeals: { pending: 5, urgent: 1 },
				adjustments: { pending: 5 },
			};
			mockGetQueueStats.mockResolvedValue(mockStats);

			const response = await request(app)
				.get("/api/v1/conflicts/stats")
				.expect(200);

			expect(response.body.success).toBe(true);
			expect(response.body.totalPending).toBe(10);
		});

		it("should handle errors gracefully", async () => {
			mockGetQueueStats.mockRejectedValue(new Error("Stats error"));

			const response = await request(app)
				.get("/api/v1/conflicts/stats")
				.expect(500);

			expect(response.body.success).toBe(false);
		});
	});

	describe("GET /api/v1/conflicts/:type/:id", () => {
		it("should return appeal case details", async () => {
			const mockCase = {
				id: 1,
				status: "under_review",
				description: "Test case",
				appointment: { id: 100 },
			};
			mockGetConflictCase.mockResolvedValue(mockCase);

			const response = await request(app)
				.get("/api/v1/conflicts/appeal/1")
				.expect(200);

			expect(response.body.success).toBe(true);
			expect(response.body.case).toBeDefined();
			expect(mockGetConflictCase).toHaveBeenCalledWith(1, "appeal");
		});

		it("should return adjustment case details", async () => {
			const mockCase = {
				id: 1,
				status: "pending_owner",
				priceDifference: 50,
			};
			mockGetConflictCase.mockResolvedValue(mockCase);

			const response = await request(app)
				.get("/api/v1/conflicts/adjustment/1")
				.expect(200);

			expect(response.body.success).toBe(true);
			expect(mockGetConflictCase).toHaveBeenCalledWith(1, "adjustment");
		});

		it("should return 404 when case not found", async () => {
			mockGetConflictCase.mockRejectedValue(new Error("Appeal not found"));

			const response = await request(app)
				.get("/api/v1/conflicts/appeal/999")
				.expect(404);

			expect(response.body.success).toBe(false);
			expect(response.body.error).toContain("not found");
		});

		it("should handle invalid case type", async () => {
			const response = await request(app)
				.get("/api/v1/conflicts/invalid/1")
				.expect(400);

			expect(response.body.success).toBe(false);
			expect(response.body.error).toContain("Invalid case type");
		});
	});

	describe("GET /api/v1/conflicts/:type/:id/photos", () => {
		it("should return appointment photos", async () => {
			const mockPhotos = {
				before: [{ id: 1, photoData: "base64..." }],
				after: [{ id: 2, photoData: "base64..." }],
				passes: [],
			};
			mockGetConflictCase.mockResolvedValue({ appointment: { id: 100 } });
			mockGetAppointmentPhotos.mockResolvedValue(mockPhotos);

			const response = await request(app)
				.get("/api/v1/conflicts/appeal/1/photos")
				.expect(200);

			expect(response.body.success).toBe(true);
			expect(response.body.before).toHaveLength(1);
			expect(response.body.after).toHaveLength(1);
		});

		it("should return 404 when no appointment associated", async () => {
			mockGetConflictCase.mockResolvedValue({ id: 1, appointment: null });

			const response = await request(app)
				.get("/api/v1/conflicts/appeal/999/photos")
				.expect(404);

			expect(response.body.success).toBe(false);
			expect(response.body.error).toContain("No appointment");
		});
	});

	describe("GET /api/v1/conflicts/:type/:id/checklist", () => {
		it("should return checklist data", async () => {
			const mockChecklist = {
				checklistData: { items: [{ name: "Kitchen", completed: true }] },
				completionNotes: "All done",
			};
			mockGetConflictCase.mockResolvedValue({ appointment: { id: 100 } });
			mockGetAppointmentChecklist.mockResolvedValue(mockChecklist);

			const response = await request(app)
				.get("/api/v1/conflicts/appeal/1/checklist")
				.expect(200);

			expect(response.body.success).toBe(true);
			expect(response.body.checklistData).toBeDefined();
		});
	});

	describe("GET /api/v1/conflicts/:type/:id/messages", () => {
		it("should return conversation messages", async () => {
			const mockMessages = {
				messages: [
					{ id: 1, content: "Hello", sender: { firstName: "John" } },
				],
			};
			mockGetConflictCase.mockResolvedValue({ appointment: { id: 100 } });
			mockGetAppointmentMessages.mockResolvedValue(mockMessages);

			const response = await request(app)
				.get("/api/v1/conflicts/appeal/1/messages")
				.expect(200);

			expect(response.body.success).toBe(true);
			expect(response.body.messages).toHaveLength(1);
		});
	});

	describe("GET /api/v1/conflicts/:type/:id/audit", () => {
		it("should return audit trail", async () => {
			const mockAuditTrail = [
				{ id: 1, action: "case_created", createdAt: new Date() },
				{ id: 2, action: "status_changed", createdAt: new Date() },
			];
			mockGetConflictCase.mockResolvedValue({ appointment: { id: 100 } });
			mockGetAuditTrail.mockResolvedValue(mockAuditTrail);

			const response = await request(app)
				.get("/api/v1/conflicts/appeal/1/audit")
				.expect(200);

			expect(response.body.success).toBe(true);
			expect(response.body.auditTrail).toHaveLength(2);
		});
	});

	describe("POST /api/v1/conflicts/:type/:id/refund", () => {
		it("should process refund successfully", async () => {
			// Mock getConflictCase to return case with appointment price for validation
			mockGetConflictCase.mockResolvedValue({
				id: 1,
				appointment: { id: 100, price: 100, refundAmount: 0 }, // $100 = 10000 cents max refundable
			});
			mockProcessRefund.mockResolvedValue({
				success: true,
				refundId: "re_test_123",
				amount: 5000,
			});

			const response = await request(app)
				.post("/api/v1/conflicts/appeal/1/refund")
				.send({
					amount: 5000,
					reason: "customer_request",
				})
				.expect(200);

			expect(response.body.success).toBe(true);
			expect(response.body.refundId).toBe("re_test_123");
		});

		it("should validate amount is required", async () => {
			const response = await request(app)
				.post("/api/v1/conflicts/appeal/1/refund")
				.send({ reason: "test" })
				.expect(400);

			expect(response.body.success).toBe(false);
			expect(response.body.error).toContain("Amount");
		});

		it("should handle refund errors", async () => {
			// Mock getConflictCase to return case with appointment price for validation
			mockGetConflictCase.mockResolvedValue({
				id: 1,
				appointment: { id: 100, price: 100, refundAmount: 0 }, // $100 = 10000 cents max refundable
			});
			mockProcessRefund.mockRejectedValue(new Error("No payment intent found"));

			const response = await request(app)
				.post("/api/v1/conflicts/appeal/1/refund")
				.send({ amount: 5000, reason: "test" })
				.expect(500);

			expect(response.body.success).toBe(false);
		});
	});

	describe("POST /api/v1/conflicts/:type/:id/payout", () => {
		it("should process payout successfully", async () => {
			mockProcessCleanerPayout.mockResolvedValue({
				success: true,
				transferId: "tr_test_123",
				amount: 3000,
			});

			const response = await request(app)
				.post("/api/v1/conflicts/appeal/1/payout")
				.send({
					amount: 3000,
					reason: "Compensation",
				})
				.expect(200);

			expect(response.body.success).toBe(true);
			expect(response.body.transferId).toBe("tr_test_123");
		});

		it("should validate amount is required", async () => {
			const response = await request(app)
				.post("/api/v1/conflicts/appeal/1/payout")
				.send({ reason: "test" })
				.expect(400);

			expect(response.body.success).toBe(false);
		});

		it("should handle payout errors", async () => {
			mockProcessCleanerPayout.mockRejectedValue(new Error("No Stripe account"));

			const response = await request(app)
				.post("/api/v1/conflicts/appeal/1/payout")
				.send({ amount: 3000, reason: "test" })
				.expect(500);

			expect(response.body.success).toBe(false);
		});
	});

	describe("POST /api/v1/conflicts/:type/:id/note", () => {
		it("should add note successfully", async () => {
			mockAddNote.mockResolvedValue({ success: true });

			const response = await request(app)
				.post("/api/v1/conflicts/appeal/1/note")
				.send({ note: "Test note" })
				.expect(200);

			expect(response.body.success).toBe(true);
		});

		it("should validate note is required", async () => {
			const response = await request(app)
				.post("/api/v1/conflicts/appeal/1/note")
				.send({})
				.expect(400);

			expect(response.body.success).toBe(false);
			expect(response.body.error).toContain("Note");
		});
	});

	describe("POST /api/v1/conflicts/:type/:id/resolve", () => {
		it("should resolve case successfully", async () => {
			mockResolveCase.mockResolvedValue({ success: true });

			const response = await request(app)
				.post("/api/v1/conflicts/appeal/1/resolve")
				.send({
					decision: "approve",
					notes: "Case approved",
				})
				.expect(200);

			expect(response.body.success).toBe(true);
		});

		it("should validate decision is required", async () => {
			const response = await request(app)
				.post("/api/v1/conflicts/appeal/1/resolve")
				.send({ notes: "test" })
				.expect(400);

			expect(response.body.success).toBe(false);
			expect(response.body.error).toContain("decision");
		});

		it("should validate decision value", async () => {
			const response = await request(app)
				.post("/api/v1/conflicts/appeal/1/resolve")
				.send({ decision: "invalid", notes: "test" })
				.expect(400);

			expect(response.body.success).toBe(false);
			expect(response.body.error).toContain("approve");
		});
	});

	describe("POST /api/v1/conflicts/:type/:id/assign", () => {
		it("should assign case successfully", async () => {
			mockAssignCase.mockResolvedValue({ success: true });

			const response = await request(app)
				.post("/api/v1/conflicts/appeal/1/assign")
				.send({ assigneeId: 5 })
				.expect(200);

			expect(response.body.success).toBe(true);
		});
	});
});
