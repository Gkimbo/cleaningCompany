/**
 * Tests for demoAccountRouter
 * Tests the API endpoints for the owner's "Preview as Role" feature.
 */

const request = require("supertest");
const express = require("express");
const jwt = require("jsonwebtoken");

// Mock jwt
jest.mock("jsonwebtoken", () => ({
	sign: jest.fn(() => "mock_jwt_token"),
	verify: jest.fn(),
	decode: jest.fn(),
}));

// Mock DemoAccountService
jest.mock("../../services/DemoAccountService", () => ({
	getDemoAccounts: jest.fn(),
	getDemoAccountByRole: jest.fn(),
	getAvailableRoles: jest.fn(),
	createPreviewSession: jest.fn(),
	endPreviewSession: jest.fn(),
}));

// Mock User model
const mockUserFindByPk = jest.fn();
jest.mock("../../models", () => ({
	User: {
		findByPk: (...args) => mockUserFindByPk(...args),
	},
}));

const DemoAccountService = require("../../services/DemoAccountService");

describe("Demo Account Router", () => {
	let app;
	const secretKey = process.env.SESSION_SECRET || "test-secret";

	const mockOwner = {
		id: 100,
		username: "platform_owner",
		type: "owner",
	};

	const mockOwnerToken = "valid_owner_token";

	beforeAll(() => {
		// Set environment variable for tests
		process.env.SESSION_SECRET = secretKey;

		app = express();
		app.use(express.json());

		const demoAccountRouter = require("../../routes/api/v1/demoAccountRouter");
		app.use("/api/v1/demo-accounts", demoAccountRouter);
	});

	beforeEach(() => {
		jest.clearAllMocks();

		// Default mock for verifying owner
		jwt.verify.mockImplementation((token, secret) => {
			if (token === mockOwnerToken) {
				return { userId: 100 };
			}
			throw new Error("Invalid token");
		});

		mockUserFindByPk.mockResolvedValue(mockOwner);
	});

	describe("Authorization", () => {
		it("should reject requests without authorization header", async () => {
			const response = await request(app).get("/api/v1/demo-accounts");

			expect(response.status).toBe(401);
			expect(response.body.error).toBe("Authorization token required");
		});

		it("should reject requests with invalid token format", async () => {
			const response = await request(app)
				.get("/api/v1/demo-accounts")
				.set("Authorization", "InvalidFormat");

			expect(response.status).toBe(401);
			expect(response.body.error).toBe("Authorization token required");
		});

		it("should reject requests with invalid token", async () => {
			const jwtError = new Error("Invalid token");
			jwtError.name = "JsonWebTokenError";
			jwt.verify.mockImplementation(() => {
				throw jwtError;
			});

			const response = await request(app)
				.get("/api/v1/demo-accounts")
				.set("Authorization", "Bearer invalid_token");

			expect(response.status).toBe(401);
			expect(response.body.error).toBe("Invalid or expired token");
		});

		it("should reject non-owner users", async () => {
			mockUserFindByPk.mockResolvedValue({
				id: 50,
				username: "regular_user",
				type: "cleaner",
			});

			const response = await request(app)
				.get("/api/v1/demo-accounts")
				.set("Authorization", `Bearer ${mockOwnerToken}`);

			expect(response.status).toBe(403);
			expect(response.body.error).toBe("Owner access required");
		});

		it("should reject when user not found", async () => {
			mockUserFindByPk.mockResolvedValue(null);

			const response = await request(app)
				.get("/api/v1/demo-accounts")
				.set("Authorization", `Bearer ${mockOwnerToken}`);

			expect(response.status).toBe(401);
			expect(response.body.error).toBe("User not found");
		});
	});

	describe("GET /api/v1/demo-accounts", () => {
		it("should return list of demo accounts for owner", async () => {
			const mockAccounts = [
				{ id: 1, username: "demo_cleaner", role: "cleaner" },
				{ id: 2, username: "demo_homeowner", role: "homeowner" },
			];
			const mockRoles = [
				{ role: "cleaner", label: "Cleaner" },
				{ role: "homeowner", label: "Homeowner" },
			];

			DemoAccountService.getDemoAccounts.mockResolvedValue(mockAccounts);
			DemoAccountService.getAvailableRoles.mockReturnValue(mockRoles);

			const response = await request(app)
				.get("/api/v1/demo-accounts")
				.set("Authorization", `Bearer ${mockOwnerToken}`);

			expect(response.status).toBe(200);
			expect(response.body.success).toBe(true);
			expect(response.body.demoAccounts).toEqual(mockAccounts);
			expect(response.body.availableRoles).toEqual(mockRoles);
		});

		it("should handle service errors", async () => {
			DemoAccountService.getDemoAccounts.mockRejectedValue(new Error("Service error"));

			const response = await request(app)
				.get("/api/v1/demo-accounts")
				.set("Authorization", `Bearer ${mockOwnerToken}`);

			expect(response.status).toBe(500);
			expect(response.body.error).toBe("Service error");
		});
	});

	describe("GET /api/v1/demo-accounts/roles", () => {
		it("should return available preview roles", async () => {
			const mockRoles = [
				{ role: "cleaner", label: "Cleaner", description: "See jobs and earnings" },
				{ role: "homeowner", label: "Homeowner", description: "See homes and bills" },
				{ role: "businessOwner", label: "Business Owner", description: "See employees" },
				{ role: "employee", label: "Employee", description: "See assigned jobs" },
			];

			DemoAccountService.getAvailableRoles.mockReturnValue(mockRoles);

			const response = await request(app)
				.get("/api/v1/demo-accounts/roles")
				.set("Authorization", `Bearer ${mockOwnerToken}`);

			expect(response.status).toBe(200);
			expect(response.body.success).toBe(true);
			expect(response.body.roles).toEqual(mockRoles);
		});
	});

	describe("POST /api/v1/demo-accounts/enter/:role", () => {
		it("should enter preview mode as cleaner", async () => {
			const mockSession = {
				success: true,
				token: "demo_token",
				user: { id: 1, username: "demo_cleaner" },
				previewRole: "cleaner",
				originalOwnerId: 100,
			};

			DemoAccountService.createPreviewSession.mockResolvedValue(mockSession);

			const response = await request(app)
				.post("/api/v1/demo-accounts/enter/cleaner")
				.set("Authorization", `Bearer ${mockOwnerToken}`);

			expect(response.status).toBe(200);
			expect(response.body.success).toBe(true);
			expect(response.body.token).toBe("demo_token");
			expect(response.body.previewRole).toBe("cleaner");

			expect(DemoAccountService.createPreviewSession).toHaveBeenCalledWith(100, "cleaner");
		});

		it("should enter preview mode as homeowner", async () => {
			const mockSession = {
				success: true,
				token: "demo_token",
				user: { id: 2, username: "demo_homeowner" },
				previewRole: "homeowner",
				originalOwnerId: 100,
			};

			DemoAccountService.createPreviewSession.mockResolvedValue(mockSession);

			const response = await request(app)
				.post("/api/v1/demo-accounts/enter/homeowner")
				.set("Authorization", `Bearer ${mockOwnerToken}`);

			expect(response.status).toBe(200);
			expect(response.body.previewRole).toBe("homeowner");
		});

		it("should enter preview mode as businessOwner", async () => {
			const mockSession = {
				success: true,
				token: "demo_token",
				user: { id: 3, username: "demo_business_owner" },
				previewRole: "businessOwner",
				originalOwnerId: 100,
			};

			DemoAccountService.createPreviewSession.mockResolvedValue(mockSession);

			const response = await request(app)
				.post("/api/v1/demo-accounts/enter/businessOwner")
				.set("Authorization", `Bearer ${mockOwnerToken}`);

			expect(response.status).toBe(200);
			expect(response.body.previewRole).toBe("businessOwner");
		});

		it("should enter preview mode as employee", async () => {
			const mockSession = {
				success: true,
				token: "demo_token",
				user: { id: 4, username: "demo_employee" },
				previewRole: "employee",
				originalOwnerId: 100,
			};

			DemoAccountService.createPreviewSession.mockResolvedValue(mockSession);

			const response = await request(app)
				.post("/api/v1/demo-accounts/enter/employee")
				.set("Authorization", `Bearer ${mockOwnerToken}`);

			expect(response.status).toBe(200);
			expect(response.body.previewRole).toBe("employee");
		});

		it("should reject invalid role", async () => {
			const response = await request(app)
				.post("/api/v1/demo-accounts/enter/invalid_role")
				.set("Authorization", `Bearer ${mockOwnerToken}`);

			expect(response.status).toBe(400);
			expect(response.body.error).toContain("Invalid role");
		});

		it("should handle service errors", async () => {
			DemoAccountService.createPreviewSession.mockRejectedValue(
				new Error("Demo account not found")
			);

			const response = await request(app)
				.post("/api/v1/demo-accounts/enter/cleaner")
				.set("Authorization", `Bearer ${mockOwnerToken}`);

			expect(response.status).toBe(500);
			expect(response.body.error).toBe("Demo account not found");
		});
	});

	describe("POST /api/v1/demo-accounts/exit", () => {
		it("should exit preview mode with ownerId in body", async () => {
			const mockSession = {
				success: true,
				token: "owner_token",
				user: { id: 100, username: "platform_owner", type: "owner" },
			};

			DemoAccountService.endPreviewSession.mockResolvedValue(mockSession);

			const response = await request(app)
				.post("/api/v1/demo-accounts/exit")
				.set("Authorization", `Bearer ${mockOwnerToken}`)
				.send({ ownerId: 100 });

			expect(response.status).toBe(200);
			expect(response.body.success).toBe(true);
			expect(response.body.user.type).toBe("owner");

			expect(DemoAccountService.endPreviewSession).toHaveBeenCalledWith(100);
		});

		it("should exit preview mode using token originalOwnerId", async () => {
			jwt.decode.mockReturnValue({ originalOwnerId: 100 });

			const mockSession = {
				success: true,
				token: "owner_token",
				user: { id: 100, type: "owner" },
			};

			DemoAccountService.endPreviewSession.mockResolvedValue(mockSession);

			const response = await request(app)
				.post("/api/v1/demo-accounts/exit")
				.set("Authorization", `Bearer ${mockOwnerToken}`)
				.send({});

			expect(response.status).toBe(200);
			expect(response.body.success).toBe(true);
		});

		it("should handle service errors", async () => {
			DemoAccountService.endPreviewSession.mockRejectedValue(
				new Error("Invalid owner ID")
			);

			const response = await request(app)
				.post("/api/v1/demo-accounts/exit")
				.set("Authorization", `Bearer ${mockOwnerToken}`)
				.send({ ownerId: 999 });

			expect(response.status).toBe(500);
			expect(response.body.error).toBe("Invalid owner ID");
		});
	});

	describe("GET /api/v1/demo-accounts/check/:role", () => {
		it("should return true when demo account exists", async () => {
			DemoAccountService.getDemoAccountByRole.mockResolvedValue({
				id: 1,
				username: "demo_cleaner",
				firstName: "Demo",
				lastName: "Cleaner",
			});

			const response = await request(app)
				.get("/api/v1/demo-accounts/check/cleaner")
				.set("Authorization", `Bearer ${mockOwnerToken}`);

			expect(response.status).toBe(200);
			expect(response.body.exists).toBe(true);
			expect(response.body.role).toBe("cleaner");
			expect(response.body.account).toBeDefined();
			expect(response.body.account.username).toBe("demo_cleaner");
		});

		it("should return false when demo account does not exist", async () => {
			DemoAccountService.getDemoAccountByRole.mockResolvedValue(null);

			const response = await request(app)
				.get("/api/v1/demo-accounts/check/cleaner")
				.set("Authorization", `Bearer ${mockOwnerToken}`);

			expect(response.status).toBe(200);
			expect(response.body.exists).toBe(false);
			expect(response.body.role).toBe("cleaner");
			expect(response.body.account).toBeNull();
		});

		it("should handle service errors", async () => {
			DemoAccountService.getDemoAccountByRole.mockRejectedValue(
				new Error("Invalid role")
			);

			const response = await request(app)
				.get("/api/v1/demo-accounts/check/invalid")
				.set("Authorization", `Bearer ${mockOwnerToken}`);

			expect(response.status).toBe(500);
			expect(response.body.error).toBe("Invalid role");
		});
	});
});
