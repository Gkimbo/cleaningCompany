/**
 * Tests for DemoAccountService
 * Tests the demo account management for the owner's "Preview as Role" feature.
 */

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

jest.mock("../../models", () => ({
	User: {
		findAll: (...args) => mockUserFindAll(...args),
		findOne: (...args) => mockUserFindOne(...args),
		findByPk: (...args) => mockUserFindByPk(...args),
	},
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

			expect(result).toHaveLength(4);
			expect(result[0].role).toBe("cleaner");
			expect(result[1].role).toBe("homeowner");
			expect(result[2].role).toBe("businessOwner");
			expect(result[3].role).toBe("employee");
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
		};

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

		it("should return false for null token", () => {
			expect(DemoAccountService.isPreviewSession(null)).toBe(false);
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
		it("should return all 4 preview roles", () => {
			const roles = DemoAccountService.getAvailableRoles();

			expect(roles).toHaveLength(4);
			expect(roles.map(r => r.role)).toEqual([
				"cleaner",
				"homeowner",
				"businessOwner",
				"employee",
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
		});
	});
});
