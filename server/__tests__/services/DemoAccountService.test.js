/**
 * Tests for DemoAccountService
 * Tests the demo account management for the owner's "Preview as Role" feature.
 */

// Set environment variable before any requires
process.env.SESSION_SECRET = "test-secret";

// Mock jwt
jest.mock("jsonwebtoken", () => ({
	sign: jest.fn(() => "mock_jwt_token"),
	verify: jest.fn(),
	decode: jest.fn(),
}));

// Mock models
const mockUserFindAll = jest.fn();
const mockUserFindOne = jest.fn();
const mockUserFindByPk = jest.fn();
const mockUserUpdate = jest.fn();
const mockAppointmentsFindAll = jest.fn();
const mockAppointmentsUpdate = jest.fn();
const mockAppointmentsCreate = jest.fn();
const mockAppointmentsDestroy = jest.fn();
const mockEmployeeJobAssignmentFindAll = jest.fn();
const mockEmployeeJobAssignmentCreate = jest.fn();
const mockEmployeeJobAssignmentDestroy = jest.fn();
const mockEmployeeJobAssignmentUpdate = jest.fn();
const mockRecurringScheduleUpdate = jest.fn();
const mockHomeFindAll = jest.fn();
const mockHomeFindOne = jest.fn();
const mockReviewsCreate = jest.fn();
const mockReviewsDestroy = jest.fn();
const mockBillsUpdate = jest.fn();
const mockPayoutCreate = jest.fn();
const mockPayoutDestroy = jest.fn();
const mockCancellationAppealCreate = jest.fn();
const mockCancellationAppealDestroy = jest.fn();
const mockHomeSizeAdjustmentRequestCreate = jest.fn();
const mockHomeSizeAdjustmentRequestDestroy = jest.fn();
const mockCancellationAuditLogCreate = jest.fn();
const mockCancellationAuditLogDestroy = jest.fn();

jest.mock("../../models", () => ({
	User: {
		findAll: (...args) => mockUserFindAll(...args),
		findOne: (...args) => mockUserFindOne(...args),
		findByPk: (...args) => mockUserFindByPk(...args),
		update: (...args) => mockUserUpdate(...args),
	},
	UserAppointments: {
		findAll: (...args) => mockAppointmentsFindAll(...args),
		update: (...args) => mockAppointmentsUpdate(...args),
		create: (...args) => mockAppointmentsCreate(...args),
		destroy: (...args) => mockAppointmentsDestroy(...args),
	},
	EmployeeJobAssignment: {
		findAll: (...args) => mockEmployeeJobAssignmentFindAll(...args),
		create: (...args) => mockEmployeeJobAssignmentCreate(...args),
		destroy: (...args) => mockEmployeeJobAssignmentDestroy(...args),
		update: (...args) => mockEmployeeJobAssignmentUpdate(...args),
	},
	RecurringSchedule: {
		update: (...args) => mockRecurringScheduleUpdate(...args),
	},
	Home: {
		findAll: (...args) => mockHomeFindAll(...args),
		findOne: (...args) => mockHomeFindOne(...args),
	},
	UserReviews: {
		create: (...args) => mockReviewsCreate(...args),
		destroy: (...args) => mockReviewsDestroy(...args),
	},
	UserBills: {
		update: (...args) => mockBillsUpdate(...args),
	},
	Payout: {
		create: (...args) => mockPayoutCreate(...args),
		destroy: (...args) => mockPayoutDestroy(...args),
	},
	CancellationAppeal: {
		create: (...args) => mockCancellationAppealCreate(...args),
		destroy: (...args) => mockCancellationAppealDestroy(...args),
	},
	HomeSizeAdjustmentRequest: {
		create: (...args) => mockHomeSizeAdjustmentRequestCreate(...args),
		destroy: (...args) => mockHomeSizeAdjustmentRequestDestroy(...args),
	},
	CancellationAuditLog: {
		create: (...args) => mockCancellationAuditLogCreate(...args),
		destroy: (...args) => mockCancellationAuditLogDestroy(...args),
	},
	BusinessEmployee: {},
	CleanerClient: {},
}));

const jwt = require("jsonwebtoken");
const DemoAccountService = require("../../services/DemoAccountService");

describe("DemoAccountService", () => {
	beforeEach(() => {
		jest.clearAllMocks();
	});

	describe("getDemoAccounts", () => {
		it("should return all demo accounts with their roles", async () => {
			const mockDemoAccounts = [
				{
					id: 1,
					username: "demo_cleaner",
					firstName: "Demo",
					lastName: "Cleaner",
					type: "cleaner",
					isBusinessOwner: false,
					businessName: null,
				},
				{
					id: 2,
					username: "demo_homeowner",
					firstName: "Demo",
					lastName: "Homeowner",
					type: null,
					isBusinessOwner: false,
					businessName: null,
				},
				{
					id: 3,
					username: "demo_business_owner",
					firstName: "Demo",
					lastName: "BusinessOwner",
					type: "cleaner",
					isBusinessOwner: true,
					businessName: "Demo Cleaning Co",
				},
				{
					id: 4,
					username: "demo_employee",
					firstName: "Demo",
					lastName: "Employee",
					type: "employee",
					isBusinessOwner: false,
					businessName: null,
				},
				{
					id: 5,
					username: "demo_business_client",
					firstName: "Demo",
					lastName: "BusinessClient",
					type: null,
					isBusinessOwner: false,
					businessName: null,
				},
			];

			mockUserFindAll.mockResolvedValue(mockDemoAccounts);

			const result = await DemoAccountService.getDemoAccounts();

			expect(mockUserFindAll).toHaveBeenCalledWith({
				where: { isDemoAccount: true },
				attributes: [
					"id",
					"username",
					"firstName",
					"lastName",
					"type",
					"isBusinessOwner",
					"businessName",
				],
			});

			expect(result).toHaveLength(5);
			expect(result[0].role).toBe("cleaner");
			expect(result[1].role).toBe("homeowner");
			expect(result[2].role).toBe("businessOwner");
			expect(result[3].role).toBe("employee");
			expect(result[4].role).toBe("homeowner"); // business client is also a homeowner
		});

		it("should return empty array when no demo accounts exist", async () => {
			mockUserFindAll.mockResolvedValue([]);

			const result = await DemoAccountService.getDemoAccounts();

			expect(result).toHaveLength(0);
		});

		it("should throw error on database failure", async () => {
			mockUserFindAll.mockRejectedValue(new Error("Database error"));

			await expect(DemoAccountService.getDemoAccounts()).rejects.toThrow("Database error");
		});
	});

	describe("getDemoAccountByRole", () => {
		it("should return demo cleaner account", async () => {
			const mockCleaner = {
				id: 1,
				username: "demo_cleaner",
				type: "cleaner",
			};

			mockUserFindOne.mockResolvedValue(mockCleaner);

			const result = await DemoAccountService.getDemoAccountByRole("cleaner");

			expect(mockUserFindOne).toHaveBeenCalledWith({
				where: {
					isDemoAccount: true,
					username: "demo_cleaner",
				},
			});
			expect(result).toEqual(mockCleaner);
		});

		it("should return demo homeowner account", async () => {
			const mockHomeowner = {
				id: 2,
				username: "demo_homeowner",
				type: null,
			};

			mockUserFindOne.mockResolvedValue(mockHomeowner);

			const result = await DemoAccountService.getDemoAccountByRole("homeowner");

			expect(mockUserFindOne).toHaveBeenCalledWith({
				where: {
					isDemoAccount: true,
					username: "demo_homeowner",
				},
			});
			expect(result).toEqual(mockHomeowner);
		});

		it("should return demo business owner account", async () => {
			const mockBizOwner = {
				id: 3,
				username: "demo_business_owner",
				type: "cleaner",
				isBusinessOwner: true,
			};

			mockUserFindOne.mockResolvedValue(mockBizOwner);

			const result = await DemoAccountService.getDemoAccountByRole("businessOwner");

			expect(mockUserFindOne).toHaveBeenCalledWith({
				where: {
					isDemoAccount: true,
					username: "demo_business_owner",
				},
			});
			expect(result).toEqual(mockBizOwner);
		});

		it("should return demo employee account", async () => {
			const mockEmployee = {
				id: 4,
				username: "demo_employee",
				type: "employee",
			};

			mockUserFindOne.mockResolvedValue(mockEmployee);

			const result = await DemoAccountService.getDemoAccountByRole("employee");

			expect(mockUserFindOne).toHaveBeenCalledWith({
				where: {
					isDemoAccount: true,
					username: "demo_employee",
				},
			});
			expect(result).toEqual(mockEmployee);
		});

		it("should return demo business client account", async () => {
			const mockBusinessClient = {
				id: 5,
				username: "demo_business_client",
				type: null,
			};

			mockUserFindOne.mockResolvedValue(mockBusinessClient);

			const result = await DemoAccountService.getDemoAccountByRole("businessClient");

			expect(mockUserFindOne).toHaveBeenCalledWith({
				where: {
					isDemoAccount: true,
					username: "demo_business_client",
				},
			});
			expect(result).toEqual(mockBusinessClient);
		});

		it("should throw error for invalid role", async () => {
			await expect(DemoAccountService.getDemoAccountByRole("invalid_role")).rejects.toThrow(
				"Invalid role: invalid_role"
			);
		});

		it("should return null when demo account not found", async () => {
			mockUserFindOne.mockResolvedValue(null);

			const result = await DemoAccountService.getDemoAccountByRole("cleaner");

			expect(result).toBeNull();
		});
	});

	describe("createPreviewSession", () => {
		const mockOwner = {
			id: 100,
			username: "platform_owner",
			type: "owner",
		};

		const mockDemoAccount = {
			id: 1,
			username: "demo_cleaner",
			firstName: "Demo",
			lastName: "Cleaner",
			email: "demo_cleaner@sparkle.demo",
			type: "cleaner",
			isBusinessOwner: false,
			businessName: null,
			update: jest.fn().mockResolvedValue(true),
		};

		beforeEach(() => {
			// Mock the refresh call to return empty (no demo accounts found scenario for simplicity)
			mockUserFindAll.mockResolvedValue([]);
			mockAppointmentsFindAll.mockResolvedValue([]);
			mockEmployeeJobAssignmentFindAll.mockResolvedValue([]);
			mockHomeFindAll.mockResolvedValue([]);
			// Mock User.update for clearing previous preview owner
			mockUserUpdate.mockResolvedValue([0]);
		});

		it("should create preview session for valid owner and role", async () => {
			mockUserFindByPk.mockResolvedValue(mockOwner);
			mockUserFindOne.mockResolvedValue(mockDemoAccount);

			const result = await DemoAccountService.createPreviewSession(100, "cleaner");

			expect(result.success).toBe(true);
			expect(result.token).toBe("mock_jwt_token");
			expect(result.user.id).toBe(1);
			expect(result.user.username).toBe("demo_cleaner");
			expect(result.user.isDemoAccount).toBe(true);
			expect(result.previewRole).toBe("cleaner");
			expect(result.originalOwnerId).toBe(100);

			expect(jwt.sign).toHaveBeenCalledWith(
				{
					userId: 1,
					isPreviewSession: true,
					originalOwnerId: 100,
					previewRole: "cleaner",
				},
				expect.any(String),
				{ expiresIn: "4h" }
			);
		});

		it("should refresh demo appointment dates when creating preview session", async () => {
			const mockDemoAccounts = [
				{ id: 1, username: "demo_homeowner" },
				{ id: 2, username: "demo_cleaner" },
			];

			mockUserFindByPk.mockResolvedValue(mockOwner);
			mockUserFindOne.mockResolvedValue(mockDemoAccount);
			mockUserFindAll.mockResolvedValue(mockDemoAccounts);
			mockAppointmentsFindAll.mockResolvedValue([]);

			const result = await DemoAccountService.createPreviewSession(100, "cleaner");

			expect(result.success).toBe(true);
			// Verify that refreshDemoAppointmentDates was called (it uses User.findAll)
			expect(mockUserFindAll).toHaveBeenCalledWith({
				where: { isDemoAccount: true },
			});
		});

		it("should reject non-owner users", async () => {
			mockUserFindByPk.mockResolvedValue({
				id: 50,
				username: "regular_user",
				type: "cleaner",
			});

			await expect(DemoAccountService.createPreviewSession(50, "cleaner")).rejects.toThrow(
				"Only platform owners can create preview sessions"
			);
		});

		it("should reject when owner not found", async () => {
			mockUserFindByPk.mockResolvedValue(null);

			await expect(DemoAccountService.createPreviewSession(999, "cleaner")).rejects.toThrow(
				"Only platform owners can create preview sessions"
			);
		});

		it("should reject when demo account not found", async () => {
			mockUserFindByPk.mockResolvedValue(mockOwner);
			mockUserFindOne.mockResolvedValue(null);

			await expect(DemoAccountService.createPreviewSession(100, "cleaner")).rejects.toThrow(
				"Demo account not found for role: cleaner"
			);
		});

		it("should create preview session for all role types", async () => {
			mockUserFindByPk.mockResolvedValue(mockOwner);

			const roles = ["cleaner", "homeowner", "businessOwner", "employee"];

			for (const role of roles) {
				mockUserFindOne.mockResolvedValue({
					...mockDemoAccount,
					username: `demo_${role}`,
				});

				const result = await DemoAccountService.createPreviewSession(100, role);

				expect(result.success).toBe(true);
				expect(result.previewRole).toBe(role);
			}
		});
	});

	describe("endPreviewSession", () => {
		const mockOwner = {
			id: 100,
			username: "platform_owner",
			firstName: "Platform",
			lastName: "Owner",
			email: "owner@sparkle.com",
			type: "owner",
		};

		beforeEach(() => {
			// Mock User.update for clearing currentPreviewOwnerId
			mockUserUpdate.mockResolvedValue([0]);
		});

		it("should end preview session and return owner token", async () => {
			mockUserFindByPk.mockResolvedValue(mockOwner);

			const result = await DemoAccountService.endPreviewSession(100);

			expect(result.success).toBe(true);
			expect(result.token).toBe("mock_jwt_token");
			expect(result.user.id).toBe(100);
			expect(result.user.username).toBe("platform_owner");
			expect(result.user.type).toBe("owner");

			expect(jwt.sign).toHaveBeenCalledWith(
				{ userId: 100 },
				expect.any(String),
				{ expiresIn: "24h" }
			);
		});

		it("should reject invalid owner ID", async () => {
			mockUserFindByPk.mockResolvedValue(null);

			await expect(DemoAccountService.endPreviewSession(999)).rejects.toThrow(
				"Invalid owner ID for ending preview session"
			);
		});

		it("should reject non-owner user ID", async () => {
			mockUserFindByPk.mockResolvedValue({
				id: 50,
				type: "cleaner",
			});

			await expect(DemoAccountService.endPreviewSession(50)).rejects.toThrow(
				"Invalid owner ID for ending preview session"
			);
		});
	});

	describe("isPreviewSession", () => {
		it("should return true for preview session token", () => {
			const decodedToken = {
				userId: 1,
				isPreviewSession: true,
				originalOwnerId: 100,
				previewRole: "cleaner",
			};

			expect(DemoAccountService.isPreviewSession(decodedToken)).toBe(true);
		});

		it("should return false for regular session token", () => {
			const decodedToken = {
				userId: 100,
			};

			expect(DemoAccountService.isPreviewSession(decodedToken)).toBe(false);
		});

		it("should return falsy for null token", () => {
			expect(DemoAccountService.isPreviewSession(null)).toBeFalsy();
		});

		it("should return false when isPreviewSession is false", () => {
			const decodedToken = {
				userId: 1,
				isPreviewSession: false,
			};

			expect(DemoAccountService.isPreviewSession(decodedToken)).toBe(false);
		});
	});

	describe("getUserRole", () => {
		it("should return cleaner for cleaner type", () => {
			const user = { type: "cleaner", isBusinessOwner: false };
			expect(DemoAccountService.getUserRole(user)).toBe("cleaner");
		});

		it("should return businessOwner for cleaner with isBusinessOwner true", () => {
			const user = { type: "cleaner", isBusinessOwner: true };
			expect(DemoAccountService.getUserRole(user)).toBe("businessOwner");
		});

		it("should return employee for employee type", () => {
			const user = { type: "employee" };
			expect(DemoAccountService.getUserRole(user)).toBe("employee");
		});

		it("should return owner for owner type", () => {
			const user = { type: "owner" };
			expect(DemoAccountService.getUserRole(user)).toBe("owner");
		});

		it("should return humanResources for humanResources type", () => {
			const user = { type: "humanResources" };
			expect(DemoAccountService.getUserRole(user)).toBe("humanResources");
		});

		it("should return homeowner for null type", () => {
			const user = { type: null };
			expect(DemoAccountService.getUserRole(user)).toBe("homeowner");
		});

		it("should return homeowner for undefined type", () => {
			const user = {};
			expect(DemoAccountService.getUserRole(user)).toBe("homeowner");
		});
	});

	describe("getAvailableRoles", () => {
		it("should return all 7 preview roles", () => {
			const roles = DemoAccountService.getAvailableRoles();

			expect(roles).toHaveLength(7);
			expect(roles.map(r => r.role)).toEqual([
				"cleaner",
				"homeowner",
				"businessOwner",
				"employee",
				"humanResources",
				"largeBusinessOwner",
				"preferredCleaner",
			]);
		});

		it("should include labels and descriptions for each role", () => {
			const roles = DemoAccountService.getAvailableRoles();

			roles.forEach(role => {
				expect(role).toHaveProperty("role");
				expect(role).toHaveProperty("label");
				expect(role).toHaveProperty("description");
				expect(role).toHaveProperty("icon");
			});
		});

		it("should have correct labels", () => {
			const roles = DemoAccountService.getAvailableRoles();

			expect(roles.find(r => r.role === "cleaner").label).toBe("Cleaner");
			expect(roles.find(r => r.role === "homeowner").label).toBe("Homeowner");
			expect(roles.find(r => r.role === "businessOwner").label).toBe("Business Owner");
			expect(roles.find(r => r.role === "employee").label).toBe("Employee");
			expect(roles.find(r => r.role === "humanResources").label).toBe("HR Manager");
			expect(roles.find(r => r.role === "largeBusinessOwner").label).toBe("Large Business");
			expect(roles.find(r => r.role === "preferredCleaner").label).toBe("Preferred Cleaner");
		});
	});

	describe("getFutureDate", () => {
		it("should return today for 0 days from now", () => {
			const result = DemoAccountService.getFutureDate(0);
			const expected = new Date().toISOString().split("T")[0];
			expect(result).toBe(expected);
		});

		it("should return tomorrow for 1 day from now", () => {
			const result = DemoAccountService.getFutureDate(1);
			const tomorrow = new Date();
			tomorrow.setDate(tomorrow.getDate() + 1);
			const expected = tomorrow.toISOString().split("T")[0];
			expect(result).toBe(expected);
		});

		it("should return correct date for 7 days from now", () => {
			const result = DemoAccountService.getFutureDate(7);
			const futureDate = new Date();
			futureDate.setDate(futureDate.getDate() + 7);
			const expected = futureDate.toISOString().split("T")[0];
			expect(result).toBe(expected);
		});

		it("should return date in YYYY-MM-DD format", () => {
			const result = DemoAccountService.getFutureDate(5);
			expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
		});
	});

	describe("getPastDate", () => {
		it("should return today for 0 days ago", () => {
			const result = DemoAccountService.getPastDate(0);
			const expected = new Date().toISOString().split("T")[0];
			expect(result).toBe(expected);
		});

		it("should return yesterday for 1 day ago", () => {
			const result = DemoAccountService.getPastDate(1);
			const yesterday = new Date();
			yesterday.setDate(yesterday.getDate() - 1);
			const expected = yesterday.toISOString().split("T")[0];
			expect(result).toBe(expected);
		});

		it("should return correct date for 14 days ago", () => {
			const result = DemoAccountService.getPastDate(14);
			const pastDate = new Date();
			pastDate.setDate(pastDate.getDate() - 14);
			const expected = pastDate.toISOString().split("T")[0];
			expect(result).toBe(expected);
		});

		it("should return date in YYYY-MM-DD format", () => {
			const result = DemoAccountService.getPastDate(10);
			expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
		});
	});

	describe("refreshDemoAppointmentDates", () => {
		beforeEach(() => {
			mockUserFindAll.mockReset();
			mockAppointmentsFindAll.mockReset();
			mockEmployeeJobAssignmentFindAll.mockReset();
			mockHomeFindAll.mockReset();
			mockRecurringScheduleUpdate.mockReset();
			mockAppointmentsUpdate.mockReset();
		});

		it("should return updated count of 0 when no demo accounts exist", async () => {
			mockUserFindAll.mockResolvedValue([]);

			const result = await DemoAccountService.refreshDemoAppointmentDates();

			expect(result.updated).toBe(0);
		});

		it("should refresh homeowner appointments", async () => {
			const mockHomeowner = { id: 1, username: "demo_homeowner" };
			const mockAppointments = [
				{ id: 101, completed: true, update: jest.fn().mockResolvedValue(true) },
				{ id: 102, completed: false, update: jest.fn().mockResolvedValue(true) },
				{ id: 103, completed: false, update: jest.fn().mockResolvedValue(true) },
			];

			mockUserFindAll.mockResolvedValue([mockHomeowner]);
			mockAppointmentsFindAll.mockResolvedValue(mockAppointments);
			mockHomeFindAll.mockResolvedValue([]);

			const result = await DemoAccountService.refreshDemoAppointmentDates();

			expect(result.success).toBe(true);
			expect(result.updated).toBeGreaterThan(0);
			// Check that appointments were updated
			expect(mockAppointments[0].update).toHaveBeenCalled();
			expect(mockAppointments[1].update).toHaveBeenCalled();
			expect(mockAppointments[2].update).toHaveBeenCalled();
		});

		it("should refresh employee job assignments", async () => {
			const mockEmployee = { id: 2, username: "demo_employee" };
			const mockAssignments = [
				{ id: 201, appointmentId: 101, update: jest.fn().mockResolvedValue(true) },
				{ id: 202, appointmentId: 102, update: jest.fn().mockResolvedValue(true) },
			];

			mockUserFindAll.mockResolvedValue([mockEmployee]);
			mockAppointmentsFindAll.mockResolvedValue([]);
			mockEmployeeJobAssignmentFindAll.mockResolvedValue(mockAssignments);
			mockAppointmentsUpdate.mockResolvedValue([1]);
			mockHomeFindAll.mockResolvedValue([]);

			const result = await DemoAccountService.refreshDemoAppointmentDates();

			expect(result.success).toBe(true);
			// Check that assignments were updated
			expect(mockAssignments[0].update).toHaveBeenCalled();
			expect(mockAssignments[1].update).toHaveBeenCalled();
		});

		it("should refresh recurring schedule dates", async () => {
			const mockHomeowner = { id: 1, username: "demo_homeowner" };
			const mockHomes = [{ id: 10 }, { id: 11 }];

			mockUserFindAll.mockResolvedValue([mockHomeowner]);
			mockAppointmentsFindAll.mockResolvedValue([]);
			mockHomeFindAll.mockResolvedValue(mockHomes);
			mockRecurringScheduleUpdate.mockResolvedValue([1]);

			const result = await DemoAccountService.refreshDemoAppointmentDates();

			expect(result.success).toBe(true);
			expect(mockRecurringScheduleUpdate).toHaveBeenCalled();
		});

		it("should handle errors gracefully and return success false", async () => {
			mockUserFindAll.mockRejectedValue(new Error("Database error"));

			const result = await DemoAccountService.refreshDemoAppointmentDates();

			expect(result.success).toBe(false);
			expect(result.error).toBe("Database error");
			expect(result.updated).toBe(0);
		});

		it("should update appointments with relative dates", async () => {
			const mockHomeowner = { id: 1, username: "demo_homeowner" };
			const mockUpcomingAppointment = {
				id: 102,
				completed: false,
				update: jest.fn().mockResolvedValue(true),
			};

			mockUserFindAll.mockResolvedValue([mockHomeowner]);
			mockAppointmentsFindAll.mockResolvedValue([mockUpcomingAppointment]);
			mockHomeFindAll.mockResolvedValue([]);

			await DemoAccountService.refreshDemoAppointmentDates();

			// Check that the appointment was updated with a date
			expect(mockUpcomingAppointment.update).toHaveBeenCalledWith({
				date: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
			});
		});

		it("should refresh business client appointments", async () => {
			const mockBusinessClient = { id: 5, username: "demo_business_client" };
			const mockClientAppointments = [
				{ id: 201, completed: true, update: jest.fn().mockResolvedValue(true) },
				{ id: 202, completed: false, update: jest.fn().mockResolvedValue(true) },
				{ id: 203, completed: false, update: jest.fn().mockResolvedValue(true) },
			];

			mockUserFindAll.mockResolvedValue([mockBusinessClient]);
			mockAppointmentsFindAll.mockResolvedValue(mockClientAppointments);
			mockHomeFindAll.mockResolvedValue([]);
			mockEmployeeJobAssignmentUpdate.mockResolvedValue([1]);

			const result = await DemoAccountService.refreshDemoAppointmentDates();

			expect(result.success).toBe(true);
			expect(result.updated).toBeGreaterThan(0);
			// Check that business client appointments were updated
			expect(mockClientAppointments[0].update).toHaveBeenCalled();
			expect(mockClientAppointments[1].update).toHaveBeenCalled();
			expect(mockClientAppointments[2].update).toHaveBeenCalled();
		});
	});

	describe("resetDemoData", () => {
		beforeEach(() => {
			mockUserFindAll.mockReset();
			mockAppointmentsFindAll.mockReset();
			mockAppointmentsDestroy.mockReset();
			mockAppointmentsCreate.mockReset();
			mockEmployeeJobAssignmentFindAll.mockReset();
			mockEmployeeJobAssignmentDestroy.mockReset();
			mockEmployeeJobAssignmentCreate.mockReset();
			mockEmployeeJobAssignmentUpdate.mockReset();
			mockHomeFindAll.mockReset();
			mockHomeFindOne.mockReset();
			mockRecurringScheduleUpdate.mockReset();
			mockReviewsCreate.mockReset();
			mockReviewsDestroy.mockReset();
			mockBillsUpdate.mockReset();
			mockPayoutCreate.mockReset();
			mockPayoutDestroy.mockReset();
			mockCancellationAppealCreate.mockReset();
			mockCancellationAppealDestroy.mockReset();
			mockHomeSizeAdjustmentRequestCreate.mockReset();
			mockHomeSizeAdjustmentRequestDestroy.mockReset();
			mockCancellationAuditLogCreate.mockReset();
			mockCancellationAuditLogDestroy.mockReset();
		});

		it("should return error when no demo accounts exist", async () => {
			mockUserFindAll.mockResolvedValue([]);

			const result = await DemoAccountService.resetDemoData();

			expect(result.success).toBe(false);
			expect(result.error).toContain("No demo accounts found");
		});

		it("should delete existing demo data", async () => {
			const mockDemoAccounts = [
				{ id: 1, username: "demo_cleaner", update: jest.fn() },
				{ id: 2, username: "demo_homeowner", update: jest.fn() },
				{ id: 3, username: "demo_employee", update: jest.fn() },
				{ id: 4, username: "demo_business_owner", update: jest.fn() },
			];

			mockUserFindAll.mockResolvedValue(mockDemoAccounts);
			mockEmployeeJobAssignmentDestroy.mockResolvedValue(5);
			mockAppointmentsDestroy.mockResolvedValue(8);
			mockReviewsDestroy.mockResolvedValue(10);
			mockPayoutDestroy.mockResolvedValue(1);
			mockCancellationAppealDestroy.mockResolvedValue(2);
			mockHomeSizeAdjustmentRequestDestroy.mockResolvedValue(1);
			mockCancellationAuditLogDestroy.mockResolvedValue(3);
			mockBillsUpdate.mockResolvedValue([1]);
			mockHomeFindAll.mockResolvedValue([]);
			mockHomeFindOne.mockResolvedValue(null);
			mockAppointmentsFindAll.mockResolvedValue([]);

			const result = await DemoAccountService.resetDemoData();

			expect(result.success).toBe(true);
			expect(mockEmployeeJobAssignmentDestroy).toHaveBeenCalled();
			expect(mockAppointmentsDestroy).toHaveBeenCalled();
			expect(mockReviewsDestroy).toHaveBeenCalled();
			expect(mockPayoutDestroy).toHaveBeenCalled();
			expect(mockCancellationAppealDestroy).toHaveBeenCalled();
			expect(mockHomeSizeAdjustmentRequestDestroy).toHaveBeenCalled();
			expect(mockCancellationAuditLogDestroy).toHaveBeenCalled();
		});

		it("should create fresh demo data after deletion", async () => {
			const mockDemoAccounts = [
				{ id: 1, username: "demo_cleaner", update: jest.fn().mockResolvedValue(true) },
				{ id: 2, username: "demo_homeowner", update: jest.fn().mockResolvedValue(true) },
				{ id: 3, username: "demo_employee", update: jest.fn().mockResolvedValue(true) },
				{ id: 4, username: "demo_business_owner", update: jest.fn().mockResolvedValue(true) },
				{ id: 6, username: "demo_hr", update: jest.fn().mockResolvedValue(true) },
			];
			const mockHomes = [{ id: 10, userId: 2 }];

			mockUserFindAll.mockResolvedValue(mockDemoAccounts);
			mockEmployeeJobAssignmentDestroy.mockResolvedValue(0);
			mockAppointmentsDestroy.mockResolvedValue(0);
			mockReviewsDestroy.mockResolvedValue(0);
			mockPayoutDestroy.mockResolvedValue(0);
			mockCancellationAppealDestroy.mockResolvedValue(0);
			mockHomeSizeAdjustmentRequestDestroy.mockResolvedValue(0);
			mockCancellationAuditLogDestroy.mockResolvedValue(0);
			mockBillsUpdate.mockResolvedValue([1]);
			mockHomeFindAll.mockResolvedValue(mockHomes);
			mockHomeFindOne.mockResolvedValue({ id: 10, userId: 2 });
			mockReviewsCreate.mockResolvedValue({});
			mockAppointmentsCreate.mockResolvedValue({ id: 100, update: jest.fn().mockResolvedValue(true) });
			mockEmployeeJobAssignmentCreate.mockResolvedValue({});
			mockPayoutCreate.mockResolvedValue({});
			mockRecurringScheduleUpdate.mockResolvedValue([1]);
			mockCancellationAppealCreate.mockResolvedValue({ id: 1 });
			mockHomeSizeAdjustmentRequestCreate.mockResolvedValue({ id: 1 });

			const result = await DemoAccountService.resetDemoData();

			expect(result.success).toBe(true);
			expect(result.deleted).toBeDefined();
			expect(result.created).toBeDefined();
			expect(result.message).toBe("Demo data has been reset to original state");
		});

		it("should handle errors gracefully", async () => {
			mockUserFindAll.mockRejectedValue(new Error("Database error"));

			const result = await DemoAccountService.resetDemoData();

			expect(result.success).toBe(false);
			expect(result.error).toBe("Database error");
		});

		it("should reset bills for demo homeowner", async () => {
			const mockDemoAccounts = [
				{ id: 2, username: "demo_homeowner", update: jest.fn() },
			];

			mockUserFindAll.mockResolvedValue(mockDemoAccounts);
			mockEmployeeJobAssignmentDestroy.mockResolvedValue(0);
			mockAppointmentsDestroy.mockResolvedValue(0);
			mockReviewsDestroy.mockResolvedValue(0);
			mockPayoutDestroy.mockResolvedValue(0);
			mockCancellationAppealDestroy.mockResolvedValue(0);
			mockHomeSizeAdjustmentRequestDestroy.mockResolvedValue(0);
			mockCancellationAuditLogDestroy.mockResolvedValue(0);
			mockBillsUpdate.mockResolvedValue([1]);
			mockHomeFindAll.mockResolvedValue([]);
			mockHomeFindOne.mockResolvedValue(null);

			await DemoAccountService.resetDemoData();

			expect(mockBillsUpdate).toHaveBeenCalledWith(
				{ totalDue: 15000, appointmentDue: 15000, cancellationFee: 0 },
				{ where: { userId: 2 } }
			);
		});

		it("should create 10 reviews for demo cleaner", async () => {
			const mockDemoAccounts = [
				{ id: 1, username: "demo_cleaner", update: jest.fn().mockResolvedValue(true) },
				{ id: 2, username: "demo_homeowner", update: jest.fn() },
			];

			mockUserFindAll.mockResolvedValue(mockDemoAccounts);
			mockEmployeeJobAssignmentDestroy.mockResolvedValue(0);
			mockAppointmentsDestroy.mockResolvedValue(0);
			mockReviewsDestroy.mockResolvedValue(0);
			mockPayoutDestroy.mockResolvedValue(0);
			mockCancellationAppealDestroy.mockResolvedValue(0);
			mockHomeSizeAdjustmentRequestDestroy.mockResolvedValue(0);
			mockCancellationAuditLogDestroy.mockResolvedValue(0);
			mockBillsUpdate.mockResolvedValue([1]);
			mockHomeFindAll.mockResolvedValue([]);
			mockHomeFindOne.mockResolvedValue(null);
			mockReviewsCreate.mockResolvedValue({});

			await DemoAccountService.resetDemoData();

			// Should create 10 reviews
			expect(mockReviewsCreate).toHaveBeenCalledTimes(10);
		});

		it("should reset bills for demo business client", async () => {
			const mockDemoAccounts = [
				{ id: 5, username: "demo_business_client", update: jest.fn() },
			];

			mockUserFindAll.mockResolvedValue(mockDemoAccounts);
			mockEmployeeJobAssignmentDestroy.mockResolvedValue(0);
			mockAppointmentsDestroy.mockResolvedValue(0);
			mockReviewsDestroy.mockResolvedValue(0);
			mockPayoutDestroy.mockResolvedValue(0);
			mockBillsUpdate.mockResolvedValue([1]);
			mockHomeFindAll.mockResolvedValue([]);

			await DemoAccountService.resetDemoData();

			expect(mockBillsUpdate).toHaveBeenCalledWith(
				{ totalDue: 10000, appointmentDue: 10000, cancellationFee: 0 },
				{ where: { userId: 5 } }
			);
		});

		it("should create business client appointments and reviews", async () => {
			const mockDemoAccounts = [
				{ id: 3, username: "demo_employee", update: jest.fn().mockResolvedValue(true) },
				{ id: 4, username: "demo_business_owner", update: jest.fn().mockResolvedValue(true) },
				{ id: 5, username: "demo_business_client", update: jest.fn() },
			];
			const mockClientHome = { id: 50, userId: 5 };

			mockUserFindAll.mockResolvedValue(mockDemoAccounts);
			mockEmployeeJobAssignmentDestroy.mockResolvedValue(0);
			mockAppointmentsDestroy.mockResolvedValue(0);
			mockReviewsDestroy.mockResolvedValue(0);
			mockPayoutDestroy.mockResolvedValue(0);
			mockBillsUpdate.mockResolvedValue([1]);
			mockHomeFindAll.mockResolvedValue([mockClientHome]);
			mockAppointmentsCreate.mockResolvedValue({ id: 100 });
			mockEmployeeJobAssignmentCreate.mockResolvedValue({});
			mockReviewsCreate.mockResolvedValue({});
			mockPayoutCreate.mockResolvedValue({});

			const result = await DemoAccountService.resetDemoData();

			expect(result.success).toBe(true);
			// Should create 5 appointments for business client (2 past + 3 upcoming)
			// Plus payout for employee
			expect(mockAppointmentsCreate).toHaveBeenCalled();
			// Should create 5 job assignments for business client appointments
			expect(mockEmployeeJobAssignmentCreate).toHaveBeenCalled();
			// Should create 2 reviews from business client to business owner
			expect(mockReviewsCreate).toHaveBeenCalled();
		});

		it("should delete business client job assignments", async () => {
			const mockDemoAccounts = [
				{ id: 3, username: "demo_employee", update: jest.fn() },
				{ id: 5, username: "demo_business_client", update: jest.fn() },
			];

			mockUserFindAll.mockResolvedValue(mockDemoAccounts);
			mockEmployeeJobAssignmentDestroy.mockResolvedValue(3);
			mockAppointmentsDestroy.mockResolvedValue(0);
			mockReviewsDestroy.mockResolvedValue(0);
			mockPayoutDestroy.mockResolvedValue(0);
			mockBillsUpdate.mockResolvedValue([1]);
			mockHomeFindAll.mockResolvedValue([]);

			await DemoAccountService.resetDemoData();

			// Should call destroy for both demo employee and business client
			expect(mockEmployeeJobAssignmentDestroy).toHaveBeenCalledWith({
				where: { employeeId: 3 },
			});
			expect(mockEmployeeJobAssignmentDestroy).toHaveBeenCalledWith({
				where: { clientId: 5 },
			});
		});
	});
});
