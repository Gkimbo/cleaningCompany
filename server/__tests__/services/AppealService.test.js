/**
 * Tests for the AppealService
 * Tests the cancellation appeal workflow including submission,
 * assignment, status updates, and resolution.
 */

// Mock Stripe
jest.mock("stripe", () => {
	return jest.fn(() => ({
		refunds: {
			create: jest.fn().mockResolvedValue({
				id: "re_test_123",
			}),
		},
	}));
});

// Mock notification services
jest.mock("../../services/NotificationService", () => ({
	createNotification: jest.fn().mockResolvedValue({ id: 1 }),
}));

jest.mock("../../services/sendNotifications/EmailClass", () => ({
	sendAppealSubmittedConfirmation: jest.fn().mockResolvedValue(true),
	sendAppealResolved: jest.fn().mockResolvedValue(true),
}));

// Mock CancellationAuditService
jest.mock("../../services/CancellationAuditService", () => ({
	log: jest.fn().mockResolvedValue(true),
	logAppealSubmitted: jest.fn().mockResolvedValue(true),
	logAppealAssigned: jest.fn().mockResolvedValue(true),
	logAppealStatusChanged: jest.fn().mockResolvedValue(true),
	logAppealResolved: jest.fn().mockResolvedValue(true),
}));

// Mock JobLedgerService
jest.mock("../../services/JobLedgerService", () => ({
	recordAppealResolution: jest.fn().mockResolvedValue([]),
}));

// Mock sequelize transaction
const mockTransaction = {
	commit: jest.fn(),
	rollback: jest.fn(),
};

// Mock models
const mockAppealCreate = jest.fn();
const mockAppealUpdate = jest.fn();
const mockAppealFindByPk = jest.fn();
const mockAppealFindOne = jest.fn();
const mockAppealFindAll = jest.fn();
const mockAppealCount = jest.fn();
const mockAppointmentFindByPk = jest.fn();
const mockAppointmentUpdate = jest.fn();
const mockUserFindByPk = jest.fn();
const mockUserFindAll = jest.fn();
const mockUserUpdate = jest.fn();

jest.mock("../../models", () => ({
	CancellationAppeal: {
		create: (...args) => mockAppealCreate(...args),
		findByPk: (...args) => mockAppealFindByPk(...args),
		findOne: (...args) => mockAppealFindOne(...args),
		findAll: (...args) => mockAppealFindAll(...args),
		findAndCountAll: jest.fn(),
		count: (...args) => mockAppealCount(...args),
		update: (...args) => mockAppealUpdate(...args),
	},
	UserAppointments: {
		findByPk: (...args) => mockAppointmentFindByPk(...args),
		update: (...args) => mockAppointmentUpdate(...args),
	},
	User: {
		findByPk: (...args) => mockUserFindByPk(...args),
		findAll: (...args) => mockUserFindAll(...args),
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
			},
		},
	},
	Op: {
		in: Symbol("in"),
		gte: Symbol("gte"),
		lt: Symbol("lt"),
		ne: Symbol("ne"),
	},
}));

const AppealService = require("../../services/AppealService");
const CancellationAuditService = require("../../services/CancellationAuditService");
const JobLedgerService = require("../../services/JobLedgerService");

describe("AppealService", () => {
	beforeEach(() => {
		jest.clearAllMocks();
	});

	describe("submitAppeal", () => {
		const createMockAppointment = (overrides = {}) => ({
			id: 1,
			userId: 100,
			wasCancelled: true,
			appealWindowExpiresAt: new Date(Date.now() + 72 * 60 * 60 * 1000), // 72 hours from now
			cancellationFeeCharged: 2500,
			refundWithheld: 5000,
			update: mockAppointmentUpdate,
			...overrides,
		});

		const createMockUser = (overrides = {}) => ({
			id: 100,
			firstName: "John",
			lastName: "Doe",
			email: "john@example.com",
			appealScrutinyLevel: "none",
			appealStats: { total: 0, approved: 0, denied: 0, pending: 0 },
			update: mockUserUpdate,
			...overrides,
		});

		it("should successfully submit an appeal", async () => {
			const mockAppointment = createMockAppointment();
			const mockUser = createMockUser();
			const mockAppeal = {
				id: 1,
				appointmentId: 1,
				appealerId: 100,
				status: "submitted",
				priority: "normal",
				slaDeadline: new Date(),
				submittedAt: new Date(),
			};

			mockAppointmentFindByPk.mockResolvedValue(mockAppointment);
			mockAppealFindOne.mockResolvedValue(null); // No existing appeal
			mockUserFindByPk.mockResolvedValue(mockUser);
			mockAppealCreate.mockResolvedValue(mockAppeal);
			mockUserFindAll.mockResolvedValue([]); // No HR users for auto-assign
			mockAppealCount.mockResolvedValue(0);
			mockAppealFindAll.mockResolvedValue([]); // For category counts in updateUserAppealStats

			const result = await AppealService.submitAppeal({
				appointmentId: 1,
				appealerId: 100,
				appealerType: "homeowner",
				category: "medical_emergency",
				description: "I had a medical emergency",
			});

			expect(result.success).toBe(true);
			expect(result.appeal).toBeDefined();
			expect(mockAppealCreate).toHaveBeenCalled();
			expect(mockTransaction.commit).toHaveBeenCalled();
			expect(CancellationAuditService.logAppealSubmitted).toHaveBeenCalled();
		});

		it("should fail if appointment not found", async () => {
			mockAppointmentFindByPk.mockResolvedValue(null);

			await expect(AppealService.submitAppeal({
				appointmentId: 999,
				appealerId: 100,
				appealerType: "homeowner",
				category: "medical_emergency",
				description: "Test",
			})).rejects.toThrow("Appointment not found");

			expect(mockTransaction.rollback).toHaveBeenCalled();
		});

		it("should fail if appointment was not cancelled", async () => {
			const mockAppointment = createMockAppointment({ wasCancelled: false });
			mockAppointmentFindByPk.mockResolvedValue(mockAppointment);

			await expect(AppealService.submitAppeal({
				appointmentId: 1,
				appealerId: 100,
				appealerType: "homeowner",
				category: "medical_emergency",
				description: "Test",
			})).rejects.toThrow("Appointment was not cancelled");
		});

		it("should fail if appeal window has expired", async () => {
			const mockAppointment = createMockAppointment({
				appealWindowExpiresAt: new Date(Date.now() - 1000), // Expired
			});
			mockAppointmentFindByPk.mockResolvedValue(mockAppointment);

			await expect(AppealService.submitAppeal({
				appointmentId: 1,
				appealerId: 100,
				appealerType: "homeowner",
				category: "medical_emergency",
				description: "Test",
			})).rejects.toThrow("Appeal window has expired");
		});

		it("should fail if there is already an open appeal", async () => {
			const mockAppointment = createMockAppointment();
			mockAppointmentFindByPk.mockResolvedValue(mockAppointment);
			mockAppealFindOne.mockResolvedValue({ id: 1, status: "submitted" });

			await expect(AppealService.submitAppeal({
				appointmentId: 1,
				appealerId: 100,
				appealerType: "homeowner",
				category: "medical_emergency",
				description: "Test",
			})).rejects.toThrow("An appeal is already pending");
		});

		it("should set higher priority for users under scrutiny", async () => {
			const mockAppointment = createMockAppointment();
			const mockUser = createMockUser({ appealScrutinyLevel: "high_risk" });
			const mockAppeal = {
				id: 1,
				status: "submitted",
				priority: "high",
				slaDeadline: new Date(),
				submittedAt: new Date(),
			};

			mockAppointmentFindByPk.mockResolvedValue(mockAppointment);
			mockAppealFindOne.mockResolvedValue(null);
			mockUserFindByPk.mockResolvedValue(mockUser);
			mockAppealCreate.mockResolvedValue(mockAppeal);
			mockUserFindAll.mockResolvedValue([]);
			mockAppealCount.mockResolvedValue(0);
			mockAppealFindAll.mockResolvedValue([]); // For category counts in updateUserAppealStats

			const result = await AppealService.submitAppeal({
				appointmentId: 1,
				appealerId: 100,
				appealerType: "homeowner",
				category: "medical_emergency",
				description: "Test",
			});

			expect(result.scrutinyLevel).toBe("high_risk");
		});
	});

	describe("assignAppeal", () => {
		it("should assign appeal to a reviewer", async () => {
			const mockAppeal = {
				id: 1,
				status: "submitted",
				appointmentId: 1,
				isClosed: () => false,
				update: mockAppealUpdate.mockResolvedValue(true),
			};
			const mockAssignee = {
				id: 200,
				type: "hr",
			};

			mockAppealFindByPk.mockResolvedValue(mockAppeal);
			mockUserFindByPk.mockResolvedValue(mockAssignee);

			const result = await AppealService.assignAppeal(1, 200, 300, {});

			expect(mockAppealUpdate).toHaveBeenCalledWith(expect.objectContaining({
				assignedTo: 200,
				status: "under_review",
			}));
			expect(CancellationAuditService.logAppealAssigned).toHaveBeenCalled();
		});

		it("should fail if appeal not found", async () => {
			mockAppealFindByPk.mockResolvedValue(null);

			await expect(AppealService.assignAppeal(999, 200, 300, {}))
				.rejects.toThrow("Appeal not found");
		});

		it("should fail if appeal is closed", async () => {
			const mockAppeal = {
				id: 1,
				status: "approved",
				isClosed: () => true,
			};
			mockAppealFindByPk.mockResolvedValue(mockAppeal);

			await expect(AppealService.assignAppeal(1, 200, 300, {}))
				.rejects.toThrow("Cannot assign a closed appeal");
		});

		it("should fail if assignee is not HR or Owner", async () => {
			const mockAppeal = {
				id: 1,
				status: "submitted",
				isClosed: () => false,
			};
			const mockAssignee = {
				id: 200,
				type: "cleaner",
			};

			mockAppealFindByPk.mockResolvedValue(mockAppeal);
			mockUserFindByPk.mockResolvedValue(mockAssignee);

			await expect(AppealService.assignAppeal(1, 200, 300, {}))
				.rejects.toThrow("Invalid assignee");
		});
	});

	describe("updateStatus", () => {
		it("should update appeal status", async () => {
			const mockAppeal = {
				id: 1,
				status: "submitted",
				appointmentId: 1,
				update: mockAppealUpdate.mockResolvedValue(true),
			};

			mockAppealFindByPk.mockResolvedValue(mockAppeal);

			const result = await AppealService.updateStatus(1, "under_review", 200, "Starting review", {});

			expect(mockAppealUpdate).toHaveBeenCalledWith(expect.objectContaining({
				status: "under_review",
			}));
			expect(CancellationAuditService.logAppealStatusChanged).toHaveBeenCalled();
		});

		it("should set escalation fields when escalating", async () => {
			const mockAppeal = {
				id: 1,
				status: "under_review",
				appointmentId: 1,
				update: mockAppealUpdate.mockResolvedValue(true),
			};

			mockAppealFindByPk.mockResolvedValue(mockAppeal);

			await AppealService.updateStatus(1, "escalated", 200, "Complex case", {});

			expect(mockAppealUpdate).toHaveBeenCalledWith(expect.objectContaining({
				status: "escalated",
				escalatedAt: expect.any(Date),
				escalationReason: "Complex case",
			}));
		});

		it("should fail for invalid status transition", async () => {
			const mockAppeal = {
				id: 1,
				status: "approved", // Already closed
				appointmentId: 1,
			};

			mockAppealFindByPk.mockResolvedValue(mockAppeal);

			await expect(AppealService.updateStatus(1, "under_review", 200, "", {}))
				.rejects.toThrow("Invalid status transition");
		});
	});

	describe("resolveAppeal", () => {
		it("should approve appeal and process resolution", async () => {
			const mockAppeal = {
				id: 1,
				status: "under_review",
				appealerId: 100,
				appointmentId: 1,
				isClosed: () => false,
				appointment: {
					id: 1,
					userId: 100,
					paymentIntentId: "pi_test",
				},
				update: mockAppealUpdate.mockResolvedValue(true),
			};
			const mockUser = {
				id: 100,
				appealStats: { total: 1, approved: 0, denied: 0, pending: 1 },
				update: mockUserUpdate,
			};

			mockAppealFindByPk.mockResolvedValue(mockAppeal);
			mockUserFindByPk.mockResolvedValue(mockUser);
			mockAppealCount.mockResolvedValue(1);
			mockAppealFindAll.mockResolvedValue([]);

			const result = await AppealService.resolveAppeal(
				1,
				"approve",
				{
					actions: { refundAmount: 2500, penaltyWaived: true },
					notes: "Approved due to valid documentation",
				},
				200,
				{}
			);

			expect(mockAppealUpdate).toHaveBeenCalledWith(
				expect.objectContaining({
					status: "approved",
					reviewedBy: 200,
				}),
				expect.any(Object)
			);
			expect(mockTransaction.commit).toHaveBeenCalled();
			expect(CancellationAuditService.logAppealResolved).toHaveBeenCalled();
		});

		it("should deny appeal", async () => {
			const mockAppeal = {
				id: 1,
				status: "under_review",
				appealerId: 100,
				appointmentId: 1,
				isClosed: () => false,
				appointment: { id: 1, userId: 100 },
				update: mockAppealUpdate.mockResolvedValue(true),
			};
			const mockUser = {
				id: 100,
				appealStats: { total: 1, approved: 0, denied: 0, pending: 1 },
				update: mockUserUpdate,
			};

			mockAppealFindByPk.mockResolvedValue(mockAppeal);
			mockUserFindByPk.mockResolvedValue(mockUser);
			mockAppealCount.mockResolvedValue(1);
			mockAppealFindAll.mockResolvedValue([]);

			await AppealService.resolveAppeal(
				1,
				"deny",
				{ notes: "Insufficient documentation" },
				200,
				{}
			);

			expect(mockAppealUpdate).toHaveBeenCalledWith(
				expect.objectContaining({
					status: "denied",
				}),
				expect.any(Object)
			);
		});

		it("should fail if appeal is already closed", async () => {
			const mockAppeal = {
				id: 1,
				status: "approved",
				isClosed: () => true,
			};

			mockAppealFindByPk.mockResolvedValue(mockAppeal);

			await expect(AppealService.resolveAppeal(1, "approve", {}, 200, {}))
				.rejects.toThrow("Appeal is already closed");
		});
	});

	describe("determinePriority", () => {
		it("should return high for high_risk scrutiny", () => {
			expect(AppealService.determinePriority("high_risk", "low")).toBe("high");
		});

		it("should return urgent for critical severity", () => {
			expect(AppealService.determinePriority("none", "critical")).toBe("urgent");
		});

		it("should return high for high severity", () => {
			expect(AppealService.determinePriority("none", "high")).toBe("high");
		});

		it("should return high for watch scrutiny", () => {
			expect(AppealService.determinePriority("watch", "low")).toBe("high");
		});

		it("should return normal for no scrutiny and low severity", () => {
			expect(AppealService.determinePriority("none", "low")).toBe("normal");
		});
	});

	describe("isValidStatusTransition", () => {
		it("should allow submitted -> under_review", () => {
			expect(AppealService.isValidStatusTransition("submitted", "under_review")).toBe(true);
		});

		it("should allow under_review -> approved", () => {
			expect(AppealService.isValidStatusTransition("under_review", "approved")).toBe(true);
		});

		it("should allow under_review -> denied", () => {
			expect(AppealService.isValidStatusTransition("under_review", "denied")).toBe(true);
		});

		it("should allow awaiting_documents -> approved", () => {
			expect(AppealService.isValidStatusTransition("awaiting_documents", "approved")).toBe(true);
		});

		it("should not allow approved -> under_review", () => {
			expect(AppealService.isValidStatusTransition("approved", "under_review")).toBe(false);
		});

		it("should not allow denied -> approved", () => {
			expect(AppealService.isValidStatusTransition("denied", "approved")).toBe(false);
		});
	});
});
