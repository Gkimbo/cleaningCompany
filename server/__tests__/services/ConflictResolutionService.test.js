/**
 * Comprehensive Tests for the ConflictResolutionService
 * Tests the unified conflict resolution workflow including queue retrieval,
 * case details, photo fetching, refunds, payouts, and resolution.
 */

// Mock Stripe
const mockStripeRefundsCreate = jest.fn().mockResolvedValue({
	id: "re_test_123",
	amount: 5000,
	status: "succeeded",
});
const mockStripeTransfersCreate = jest.fn().mockResolvedValue({
	id: "tr_test_123",
	amount: 3000,
	destination: "acct_test",
});

jest.mock("stripe", () => {
	return jest.fn(() => ({
		refunds: {
			create: mockStripeRefundsCreate,
		},
		transfers: {
			create: mockStripeTransfersCreate,
		},
	}));
});

// Mock notification services
jest.mock("../../services/sendNotifications/EmailClass", () => ({
	sendRefundConfirmation: jest.fn().mockResolvedValue(true),
	sendPayoutConfirmation: jest.fn().mockResolvedValue(true),
}));

jest.mock("../../services/sendNotifications/PushNotificationClass", () => ({
	sendRefundNotification: jest.fn().mockResolvedValue(true),
	sendPayoutNotification: jest.fn().mockResolvedValue(true),
}));

// Mock CancellationAuditService
jest.mock("../../services/CancellationAuditService", () => ({
	log: jest.fn().mockResolvedValue(true),
	logRefundProcessed: jest.fn().mockResolvedValue(true),
	logPayoutProcessed: jest.fn().mockResolvedValue(true),
	logNoteAdded: jest.fn().mockResolvedValue(true),
	logCaseResolved: jest.fn().mockResolvedValue(true),
}));

// Mock JobLedgerService
jest.mock("../../services/JobLedgerService", () => ({
	recordConflictRefund: jest.fn().mockResolvedValue([]),
	recordConflictPayout: jest.fn().mockResolvedValue([]),
}));

// Mock sequelize transaction
const mockTransaction = {
	commit: jest.fn(),
	rollback: jest.fn(),
};

// Mock models
const mockAppealFindAll = jest.fn();
const mockAppealFindByPk = jest.fn();
const mockAppealUpdate = jest.fn();
const mockAppealCount = jest.fn();
const mockAdjustmentFindAll = jest.fn();
const mockAdjustmentFindByPk = jest.fn();
const mockAdjustmentUpdate = jest.fn();
const mockAdjustmentCount = jest.fn();
const mockAppointmentFindByPk = jest.fn();
const mockJobPhotoFindAll = jest.fn();
const mockUserFindByPk = jest.fn();
const mockConversationFindOne = jest.fn();
const mockMessageFindAll = jest.fn();
const mockAuditLogFindAll = jest.fn();
const mockAuditLogCreate = jest.fn().mockResolvedValue({ id: 1 });

jest.mock("../../models", () => ({
	CancellationAppeal: {
		findAll: (...args) => mockAppealFindAll(...args),
		findByPk: (...args) => mockAppealFindByPk(...args),
		update: (...args) => mockAppealUpdate(...args),
		count: (...args) => mockAppealCount(...args),
	},
	HomeSizeAdjustmentRequest: {
		findAll: (...args) => mockAdjustmentFindAll(...args),
		findByPk: (...args) => mockAdjustmentFindByPk(...args),
		update: (...args) => mockAdjustmentUpdate(...args),
		count: (...args) => mockAdjustmentCount(...args),
	},
	UserAppointments: {
		findByPk: (...args) => mockAppointmentFindByPk(...args),
	},
	JobPhoto: {
		findAll: (...args) => mockJobPhotoFindAll(...args),
	},
	User: {
		findByPk: (...args) => mockUserFindByPk(...args),
	},
	Conversation: {
		findOne: (...args) => mockConversationFindOne(...args),
	},
	Message: {
		findAll: (...args) => mockMessageFindAll(...args),
	},
	CancellationAuditLog: {
		findAll: (...args) => mockAuditLogFindAll(...args),
		create: (...args) => mockAuditLogCreate(...args),
	},
	sequelize: {
		transaction: jest.fn(() => mockTransaction),
		fn: jest.fn(),
		col: jest.fn(),
		Sequelize: {
			Op: {
				in: Symbol("in"),
				gte: Symbol("gte"),
				lt: Symbol("lt"),
				ne: Symbol("ne"),
				or: Symbol("or"),
				like: Symbol("like"),
			},
		},
	},
	Op: {
		in: Symbol("in"),
		gte: Symbol("gte"),
		lt: Symbol("lt"),
		ne: Symbol("ne"),
		or: Symbol("or"),
		like: Symbol("like"),
	},
}));

const ConflictResolutionService = require("../../services/ConflictResolutionService");
const CancellationAuditService = require("../../services/CancellationAuditService");
const JobLedgerService = require("../../services/JobLedgerService");

describe("ConflictResolutionService", () => {
	beforeEach(() => {
		jest.clearAllMocks();
	});

	describe("getConflictQueue", () => {
		const createMockAppeal = (overrides = {}) => ({
			id: 1,
			status: "submitted",
			priority: "high",
			category: "payment",
			description: "Test appeal",
			submittedAt: new Date(),
			slaDeadline: new Date(Date.now() + 86400000),
			appointmentId: 100,
			isPastSLA: jest.fn().mockReturnValue(false),
			getTimeUntilSLA: jest.fn().mockReturnValue(86400),
			appointment: {
				id: 100,
				date: new Date(),
				cleaner: { id: 2, firstName: "John", lastName: "Doe", email: "john@test.com" },
			},
			appealer: { id: 1, firstName: "Jane", lastName: "Smith", email: "jane@test.com", type: "homeowner" },
			assignee: null,
			...overrides,
		});

		const createMockAdjustment = (overrides = {}) => ({
			id: 1,
			status: "pending_owner",
			originalNumBeds: 2,
			originalNumBaths: 1,
			reportedNumBeds: 3,
			reportedNumBaths: 2,
			priceDifference: 50,
			createdAt: new Date(),
			appointmentId: 101,
			appointment: {
				id: 101,
				date: new Date(),
				home: { id: 1, address: "123 Main St", city: "Test City" },
			},
			cleaner: { id: 3, firstName: "Bob", lastName: "Worker", email: "bob@test.com" },
			homeowner: { id: 4, firstName: "Alice", lastName: "Owner", email: "alice@test.com" },
			...overrides,
		});

		it("should return combined queue of appeals and adjustments", async () => {
			mockAppealFindAll.mockResolvedValue([createMockAppeal()]);
			mockAdjustmentFindAll.mockResolvedValue([createMockAdjustment()]);

			const result = await ConflictResolutionService.getConflictQueue();

			expect(result.cases).toHaveLength(2);
			expect(result.cases[0].caseType).toBe("appeal");
			expect(result.cases[1].caseType).toBe("adjustment");
			expect(result.total).toBe(2);
		});

		it("should filter by case type 'appeal' only", async () => {
			mockAppealFindAll.mockResolvedValue([]);

			await ConflictResolutionService.getConflictQueue({ caseType: "appeal" });

			expect(mockAppealFindAll).toHaveBeenCalled();
			expect(mockAdjustmentFindAll).not.toHaveBeenCalled();
		});

		it("should filter by case type 'adjustment' only", async () => {
			mockAdjustmentFindAll.mockResolvedValue([]);

			await ConflictResolutionService.getConflictQueue({ caseType: "adjustment" });

			expect(mockAdjustmentFindAll).toHaveBeenCalled();
			expect(mockAppealFindAll).not.toHaveBeenCalled();
		});

		it("should return empty queue when no conflicts exist", async () => {
			mockAppealFindAll.mockResolvedValue([]);
			mockAdjustmentFindAll.mockResolvedValue([]);

			const result = await ConflictResolutionService.getConflictQueue();

			expect(result.cases).toHaveLength(0);
			expect(result.total).toBe(0);
		});

		it("should respect limit and offset parameters", async () => {
			mockAppealFindAll.mockResolvedValue([]);
			mockAdjustmentFindAll.mockResolvedValue([]);

			const result = await ConflictResolutionService.getConflictQueue({
				limit: 10,
				offset: 5,
			});

			expect(result.limit).toBe(10);
			expect(result.offset).toBe(5);
		});

		it("should identify past SLA cases correctly", async () => {
			const pastSLAAppeal = createMockAppeal({
				slaDeadline: new Date(Date.now() - 86400000),
				isPastSLA: jest.fn().mockReturnValue(true),
			});
			mockAppealFindAll.mockResolvedValue([pastSLAAppeal]);
			mockAdjustmentFindAll.mockResolvedValue([]);

			const result = await ConflictResolutionService.getConflictQueue();

			expect(result.cases[0].isPastSLA).toBe(true);
		});

		it("should handle cleaner as appealer type", async () => {
			const cleanerAppeal = createMockAppeal({
				appealer: { id: 2, firstName: "John", lastName: "Cleaner", email: "cleaner@test.com", type: "cleaner" },
			});
			mockAppealFindAll.mockResolvedValue([cleanerAppeal]);
			mockAdjustmentFindAll.mockResolvedValue([]);

			const result = await ConflictResolutionService.getConflictQueue();

			expect(result.cases[0].cleaner.email).toBe("cleaner@test.com");
		});
	});

	describe("getConflictCase", () => {
		it("should return full appeal case details", async () => {
			const mockAppeal = {
				id: 1,
				status: "under_review",
				category: "quality",
				description: "Test case",
				toJSON: jest.fn().mockReturnThis(),
				appointment: {
					id: 100,
					date: new Date(),
					price: 15000,
					home: { id: 1, address: "123 Main St" },
				},
				appealer: { id: 1, firstName: "Test", lastName: "User" },
			};

			mockAppealFindByPk.mockResolvedValue(mockAppeal);

			const result = await ConflictResolutionService.getConflictCase(1, "appeal");

			expect(result).toBeDefined();
			expect(mockAppealFindByPk).toHaveBeenCalledWith(1, expect.any(Object));
		});

		it("should return full adjustment case details", async () => {
			const mockAdjustment = {
				id: 1,
				status: "pending_owner",
				toJSON: jest.fn().mockReturnThis(),
				appointment: { id: 100 },
				cleaner: { id: 2 },
				homeowner: { id: 3 },
				home: { id: 1 },
			};

			mockAdjustmentFindByPk.mockResolvedValue(mockAdjustment);

			const result = await ConflictResolutionService.getConflictCase(1, "adjustment");

			expect(result).toBeDefined();
			expect(mockAdjustmentFindByPk).toHaveBeenCalledWith(1, expect.any(Object));
		});

		it("should throw error for invalid case type", async () => {
			await expect(
				ConflictResolutionService.getConflictCase(1, "invalid")
			).rejects.toThrow();
		});

		it("should throw error when case not found", async () => {
			mockAppealFindByPk.mockResolvedValue(null);

			await expect(
				ConflictResolutionService.getConflictCase(999, "appeal")
			).rejects.toThrow("Appeal not found");
		});
	});

	describe("getAppointmentPhotos", () => {
		it("should return categorized photos for an appointment", async () => {
			const mockPhotos = [
				{ id: 1, photoData: "base64...", photoType: "before", room: "Kitchen" },
				{ id: 2, photoData: "base64...", photoType: "after", room: "Kitchen" },
				{ id: 3, photoData: "base64...", photoType: "pass", room: "Bathroom" },
			];

			mockJobPhotoFindAll.mockResolvedValue(mockPhotos);

			const result = await ConflictResolutionService.getAppointmentPhotos(100);

			expect(result).toHaveProperty("before");
			expect(result).toHaveProperty("after");
			expect(result).toHaveProperty("passes");
		});

		it("should return empty arrays when no photos exist", async () => {
			mockJobPhotoFindAll.mockResolvedValue([]);

			const result = await ConflictResolutionService.getAppointmentPhotos(100);

			expect(result.before).toHaveLength(0);
			expect(result.after).toHaveLength(0);
			expect(result.passes).toHaveLength(0);
		});

		it("should correctly categorize multiple photos", async () => {
			const mockPhotos = [
				{ id: 1, photoData: "base64...", photoType: "before", room: "Kitchen" },
				{ id: 2, photoData: "base64...", photoType: "before", room: "Bathroom" },
				{ id: 3, photoData: "base64...", photoType: "after", room: "Kitchen" },
				{ id: 4, photoData: "base64...", photoType: "after", room: "Bathroom" },
				{ id: 5, photoData: "base64...", photoType: "passes", room: "Living Room" },
			];

			mockJobPhotoFindAll.mockResolvedValue(mockPhotos);

			const result = await ConflictResolutionService.getAppointmentPhotos(100);

			expect(result.before).toHaveLength(2);
			expect(result.after).toHaveLength(2);
			expect(result.passes).toHaveLength(1);
		});
	});

	describe("getAppointmentChecklist", () => {
		it("should return checklist data for an appointment", async () => {
			const mockAppointment = {
				id: 100,
				completionChecklistData: {
					items: [
						{ name: "Kitchen", completed: true },
						{ name: "Bathroom", completed: false },
					],
				},
				completionNotes: "Test notes",
			};

			mockAppointmentFindByPk.mockResolvedValue(mockAppointment);

			const result = await ConflictResolutionService.getAppointmentChecklist(100);

			expect(result).toBeDefined();
			expect(result.checklistData).toBeDefined();
			expect(result.completionNotes).toBe("Test notes");
		});

		it("should throw error when appointment not found", async () => {
			mockAppointmentFindByPk.mockResolvedValue(null);

			await expect(
				ConflictResolutionService.getAppointmentChecklist(999)
			).rejects.toThrow("Appointment not found");
		});

		it("should handle empty checklist data", async () => {
			const mockAppointment = {
				id: 100,
				completionChecklistData: null,
				completionNotes: null,
			};

			mockAppointmentFindByPk.mockResolvedValue(mockAppointment);

			const result = await ConflictResolutionService.getAppointmentChecklist(100);

			expect(result.checklistData).toEqual({});
		});
	});

	describe("getAppointmentMessages", () => {
		it("should return messages for an appointment conversation", async () => {
			// The service gets messages from the conversation include
			const mockConversation = {
				id: 1,
				appointmentId: 100,
				messages: [
					{ id: 1, content: "Hello", createdAt: new Date(), sender: { firstName: "John" } },
					{ id: 2, content: "Hi there", createdAt: new Date(), sender: { firstName: "Jane" } },
				],
			};

			mockConversationFindOne.mockResolvedValue(mockConversation);

			const result = await ConflictResolutionService.getAppointmentMessages(100);

			expect(result.messages).toHaveLength(2);
		});

		it("should return empty messages when no conversation exists", async () => {
			mockConversationFindOne.mockResolvedValue(null);

			const result = await ConflictResolutionService.getAppointmentMessages(100);

			expect(result.messages).toHaveLength(0);
		});
	});

	describe("getAuditTrail", () => {
		it("should return audit trail for a case", async () => {
			const mockAuditLogs = [
				{
					id: 1,
					action: "case_created",
					details: "{}",
					createdAt: new Date(),
					actor: { id: 1, firstName: "Test", lastName: "User" },
				},
				{
					id: 2,
					action: "status_changed",
					details: '{"from": "submitted", "to": "under_review"}',
					createdAt: new Date(),
					actor: { id: 5, firstName: "Admin", lastName: "User" },
				},
			];

			mockAuditLogFindAll.mockResolvedValue(mockAuditLogs);

			const result = await ConflictResolutionService.getAuditTrail(1, "appeal", 100);

			expect(result).toHaveLength(2);
			expect(mockAuditLogFindAll).toHaveBeenCalled();
		});

		it("should return empty array when no audit logs exist", async () => {
			mockAuditLogFindAll.mockResolvedValue([]);

			const result = await ConflictResolutionService.getAuditTrail(1, "appeal", 100);

			expect(result).toHaveLength(0);
		});
	});

	describe("addNote", () => {
		it("should add a note to an appeal case", async () => {
			const mockAppeal = {
				id: 1,
				appointmentId: 100,
				reviewerNotes: "",
				toJSON: jest.fn().mockReturnValue({ id: 1 }),
				update: jest.fn().mockResolvedValue(true),
			};

			mockAppealFindByPk.mockResolvedValue(mockAppeal);

			const result = await ConflictResolutionService.addNote({
				caseId: 1,
				caseType: "appeal",
				note: "Test note",
				reviewerId: 5,
			});

			expect(result.success).toBe(true);
		});

		it("should add a note to an adjustment case", async () => {
			const mockAdjustment = {
				id: 1,
				appointmentId: 100,
				adminNotes: "",
				toJSON: jest.fn().mockReturnValue({ id: 1 }),
				update: jest.fn().mockResolvedValue(true),
			};

			mockAdjustmentFindByPk.mockResolvedValue(mockAdjustment);

			const result = await ConflictResolutionService.addNote({
				caseId: 1,
				caseType: "adjustment",
				note: "Test adjustment note",
				reviewerId: 5,
			});

			expect(result.success).toBe(true);
		});

		it("should throw error when case not found", async () => {
			mockAppealFindByPk.mockResolvedValue(null);

			await expect(
				ConflictResolutionService.addNote({
					caseId: 999,
					caseType: "appeal",
					note: "Test",
					reviewerId: 5,
				})
			).rejects.toThrow();
		});
	});

	describe("resolveCase", () => {
		it("should resolve an adjustment case with owner_approved", async () => {
			const mockAdjustment = {
				id: 1,
				status: "pending_owner",
				update: jest.fn().mockResolvedValue(true),
				cleaner: { id: 2 },
				homeowner: { id: 3 },
			};

			mockAdjustmentFindByPk.mockResolvedValue(mockAdjustment);

			const result = await ConflictResolutionService.resolveCase({
				caseId: 1,
				caseType: "adjustment",
				resolution: "owner_approved",
				notes: "Adjustment approved",
				reviewerId: 5,
			});

			expect(result.success).toBe(true);
		});

		it("should resolve an adjustment case with owner_denied", async () => {
			const mockAdjustment = {
				id: 1,
				status: "pending_owner",
				update: jest.fn().mockResolvedValue(true),
				cleaner: { id: 2 },
				homeowner: { id: 3 },
			};

			mockAdjustmentFindByPk.mockResolvedValue(mockAdjustment);

			const result = await ConflictResolutionService.resolveCase({
				caseId: 1,
				caseType: "adjustment",
				resolution: "owner_denied",
				notes: "Adjustment denied",
				reviewerId: 5,
			});

			expect(result.success).toBe(true);
		});

		it("should throw error when case not found", async () => {
			mockAdjustmentFindByPk.mockResolvedValue(null);

			await expect(
				ConflictResolutionService.resolveCase({
					caseId: 999,
					caseType: "adjustment",
					resolution: "owner_approved",
					notes: "Test",
					reviewerId: 5,
				})
			).rejects.toThrow();
		});
	});

	describe("getQueueStats", () => {
		it("should return queue statistics", async () => {
			mockAppealFindAll.mockResolvedValue([
				{ id: 1, status: "submitted", priority: "urgent", isPastSLA: () => true },
				{ id: 2, status: "under_review", priority: "high", isPastSLA: () => false },
			]);
			mockAdjustmentFindAll.mockResolvedValue([
				{ id: 1, status: "pending_owner" },
			]);
			mockAppealCount.mockResolvedValue(5);
			mockAdjustmentCount.mockResolvedValue(3);

			const result = await ConflictResolutionService.getQueueStats();

			expect(result).toHaveProperty("totalPending");
			expect(result).toHaveProperty("appeals");
			expect(result).toHaveProperty("adjustments");
		});
	});

	describe("Error Handling", () => {
		it("should handle database errors gracefully in getConflictQueue", async () => {
			mockAppealFindAll.mockRejectedValue(new Error("Database connection failed"));

			await expect(
				ConflictResolutionService.getConflictQueue()
			).rejects.toThrow("Database connection failed");
		});

		it("should handle database errors gracefully in getConflictCase", async () => {
			mockAppealFindByPk.mockRejectedValue(new Error("Database error"));

			await expect(
				ConflictResolutionService.getConflictCase(1, "appeal")
			).rejects.toThrow("Database error");
		});
	});
});
