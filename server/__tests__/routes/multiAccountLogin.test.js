/**
 * Tests for multi-account login flow
 *
 * When a user has multiple accounts with the same email (e.g., business employee
 * and marketplace cleaner), the login flow should ask which account to log into.
 */

const request = require("supertest");
const express = require("express");
const bcrypt = require("bcrypt");

// Mock all dependencies before requiring the router
jest.mock("../../models", () => ({
	User: {
		findOne: jest.fn(),
		findAll: jest.fn(),
	},
	TermsAndConditions: {
		findOne: jest.fn(),
	},
}));

jest.mock("../../serializers/userSerializer", () => ({
	login: jest.fn((user) => ({
		id: user.id,
		username: user.username,
		email: user.email,
		type: user.type,
		isMarketplaceCleaner: user.isMarketplaceCleaner,
	})),
}));

jest.mock("jsonwebtoken", () => ({
	sign: jest.fn(() => "mock-jwt-token"),
	verify: jest.fn(),
}));

jest.mock("passport", () => ({
	authenticate: jest.fn(() => (req, res, next) => next()),
}));

const { User, TermsAndConditions } = require("../../models");
const sessionRouter = require("../../routes/api/v1/userSessionsRouter");

// Create Express app for testing
const app = express();
app.use(express.json());

// Mock session and passport
app.use((req, res, next) => {
	req.session = { destroy: jest.fn() };
	req.login = (user, callback) => callback(null);
	next();
});

app.use("/api/v1/user-sessions", sessionRouter);

describe("POST /api/v1/user-sessions/login - Multi-account handling", () => {
	let hashedPassword;

	beforeAll(async () => {
		hashedPassword = await bcrypt.hash("SecurePass1!", 10);
	});

	beforeEach(() => {
		jest.clearAllMocks();
		TermsAndConditions.findOne.mockResolvedValue(null);
	});

	const createMockUser = (overrides = {}) => ({
		id: 1,
		username: "testuser",
		email: "test@example.com",
		password: hashedPassword,
		type: "cleaner",
		isMarketplaceCleaner: true,
		employeeOfBusinessId: null,
		lockedUntil: null,
		failedLoginAttempts: 0,
		update: jest.fn().mockResolvedValue(true),
		...overrides,
	});

	describe("Single account login (existing behavior)", () => {
		it("should login successfully with username", async () => {
			const mockUser = createMockUser();
			User.findOne.mockResolvedValue(mockUser);
			User.findAll.mockResolvedValue([]); // No linked accounts

			const response = await request(app)
				.post("/api/v1/user-sessions/login")
				.send({ username: "testuser", password: "SecurePass1!" });

			expect(response.status).toBe(201);
			expect(response.body.user).toBeDefined();
			expect(response.body.token).toBe("mock-jwt-token");
			expect(response.body.linkedAccounts).toEqual([]);
		});

		it("should login successfully with email when only one account exists", async () => {
			const mockUser = createMockUser();
			User.findAll.mockResolvedValue([mockUser]);

			const response = await request(app)
				.post("/api/v1/user-sessions/login")
				.send({ username: "test@example.com", password: "SecurePass1!" });

			expect(response.status).toBe(201);
			expect(response.body.user).toBeDefined();
		});

		it("should reject invalid password", async () => {
			const mockUser = createMockUser();
			User.findOne.mockResolvedValue(mockUser);

			const response = await request(app)
				.post("/api/v1/user-sessions/login")
				.send({ username: "testuser", password: "wrongpassword" });

			expect(response.status).toBe(401);
			expect(response.body.error).toContain("Invalid credentials");
		});

		it("should reject non-existent user", async () => {
			User.findOne.mockResolvedValue(null);
			User.findAll.mockResolvedValue([]);

			const response = await request(app)
				.post("/api/v1/user-sessions/login")
				.send({ username: "nonexistent", password: "SecurePass1!" });

			expect(response.status).toBe(401);
			expect(response.body.error).toContain("Invalid credentials");
		});
	});

	describe("Multiple accounts with same email", () => {
		it("should return 300 with account options when multiple accounts share email", async () => {
			const employeeAccount = createMockUser({
				id: 1,
				username: "employee_user",
				type: "employee",
				isMarketplaceCleaner: false,
				employeeOfBusinessId: 5,
			});

			const marketplaceAccount = createMockUser({
				id: 2,
				username: "marketplace_user",
				type: "cleaner",
				isMarketplaceCleaner: true,
				employeeOfBusinessId: null,
			});

			User.findAll.mockResolvedValue([employeeAccount, marketplaceAccount]);

			const response = await request(app)
				.post("/api/v1/user-sessions/login")
				.send({ username: "test@example.com", password: "SecurePass1!" });

			expect(response.status).toBe(300);
			expect(response.body.requiresAccountSelection).toBe(true);
			expect(response.body.accountOptions).toHaveLength(2);
			expect(response.body.accountOptions).toContainEqual(
				expect.objectContaining({ accountType: "employee", displayName: "Business Employee" })
			);
			expect(response.body.accountOptions).toContainEqual(
				expect.objectContaining({ accountType: "marketplace_cleaner", displayName: "Marketplace Cleaner" })
			);
		});

		it("should login to specific account when accountType provided", async () => {
			const employeeAccount = createMockUser({
				id: 1,
				username: "employee_user",
				type: "employee",
				isMarketplaceCleaner: false,
				employeeOfBusinessId: 5,
			});

			const marketplaceAccount = createMockUser({
				id: 2,
				username: "marketplace_user",
				type: "cleaner",
				isMarketplaceCleaner: true,
				employeeOfBusinessId: null,
			});

			User.findAll.mockResolvedValue([employeeAccount, marketplaceAccount]);

			const response = await request(app)
				.post("/api/v1/user-sessions/login")
				.send({
					username: "test@example.com",
					password: "SecurePass1!",
					accountType: "marketplace_cleaner",
				});

			expect(response.status).toBe(201);
			expect(response.body.user.username).toBe("marketplace_user");
			expect(response.body.user.isMarketplaceCleaner).toBe(true);
		});

		it("should login to employee account when accountType is employee", async () => {
			const employeeAccount = createMockUser({
				id: 1,
				username: "employee_user",
				type: "employee",
				isMarketplaceCleaner: false,
				employeeOfBusinessId: 5,
			});

			const marketplaceAccount = createMockUser({
				id: 2,
				username: "marketplace_user",
				type: "cleaner",
				isMarketplaceCleaner: true,
			});

			User.findAll.mockResolvedValue([employeeAccount, marketplaceAccount]);

			const response = await request(app)
				.post("/api/v1/user-sessions/login")
				.send({
					username: "test@example.com",
					password: "SecurePass1!",
					accountType: "employee",
				});

			expect(response.status).toBe(201);
			expect(response.body.user.username).toBe("employee_user");
			expect(response.body.user.type).toBe("employee");
		});

		it("should reject invalid accountType", async () => {
			const employeeAccount = createMockUser({
				id: 1,
				type: "employee",
				isMarketplaceCleaner: false,
			});

			const marketplaceAccount = createMockUser({
				id: 2,
				type: "cleaner",
				isMarketplaceCleaner: true,
			});

			User.findAll.mockResolvedValue([employeeAccount, marketplaceAccount]);

			const response = await request(app)
				.post("/api/v1/user-sessions/login")
				.send({
					username: "test@example.com",
					password: "SecurePass1!",
					accountType: "invalid_type",
				});

			expect(response.status).toBe(401);
			expect(response.body.error).toContain("Invalid credentials");
		});

		it("should handle three accounts with same email", async () => {
			const employeeAccount = createMockUser({
				id: 1,
				type: "employee",
				isMarketplaceCleaner: false,
				employeeOfBusinessId: 5,
			});

			const marketplaceAccount = createMockUser({
				id: 2,
				type: "cleaner",
				isMarketplaceCleaner: true,
			});

			const homeownerAccount = createMockUser({
				id: 3,
				type: null,
				isMarketplaceCleaner: false,
			});

			User.findAll.mockResolvedValue([employeeAccount, marketplaceAccount, homeownerAccount]);

			const response = await request(app)
				.post("/api/v1/user-sessions/login")
				.send({ username: "test@example.com", password: "SecurePass1!" });

			expect(response.status).toBe(300);
			expect(response.body.accountOptions).toHaveLength(3);
			expect(response.body.accountOptions).toContainEqual(
				expect.objectContaining({ accountType: "homeowner", displayName: "Homeowner" })
			);
		});
	});

	describe("Account type display names", () => {
		const testCases = [
			{ type: "employee", isMarketplaceCleaner: false, expectedType: "employee", expectedDisplay: "Business Employee" },
			{ type: "cleaner", isMarketplaceCleaner: true, expectedType: "marketplace_cleaner", expectedDisplay: "Marketplace Cleaner" },
			{ type: "cleaner", isMarketplaceCleaner: false, expectedType: "cleaner", expectedDisplay: "Cleaner" },
			{ type: "owner", isMarketplaceCleaner: false, expectedType: "owner", expectedDisplay: "Owner" },
			{ type: "humanResources", isMarketplaceCleaner: false, expectedType: "hr", expectedDisplay: "HR Staff" },
			{ type: null, isMarketplaceCleaner: false, expectedType: "homeowner", expectedDisplay: "Homeowner" },
		];

		testCases.forEach(({ type, isMarketplaceCleaner, expectedType, expectedDisplay }) => {
			it(`should correctly identify ${expectedDisplay} account type`, async () => {
				const account1 = createMockUser({
					id: 1,
					type,
					isMarketplaceCleaner,
				});

				const account2 = createMockUser({
					id: 2,
					type: "cleaner",
					isMarketplaceCleaner: true,
				});

				User.findAll.mockResolvedValue([account1, account2]);

				const response = await request(app)
					.post("/api/v1/user-sessions/login")
					.send({ username: "test@example.com", password: "SecurePass1!" });

				expect(response.status).toBe(300);
				expect(response.body.accountOptions).toContainEqual(
					expect.objectContaining({
						accountType: expectedType,
						displayName: expectedDisplay,
					})
				);
			});
		});
	});

	describe("Username login (bypass multi-account flow)", () => {
		it("should login directly with username even if email has multiple accounts", async () => {
			const mockUser = createMockUser({ username: "uniqueusername" });
			User.findOne.mockResolvedValue(mockUser);
			User.findAll.mockResolvedValue([]); // No linked accounts

			const response = await request(app)
				.post("/api/v1/user-sessions/login")
				.send({ username: "uniqueusername", password: "SecurePass1!" });

			expect(response.status).toBe(201);
			// findAll is called for linked accounts after login, but not for multi-account selection
			expect(response.body.linkedAccounts).toEqual([]);
		});
	});

	describe("Account lockout handling", () => {
		it("should respect account lockout for specific account", async () => {
			const lockedAccount = createMockUser({
				id: 1,
				type: "employee",
				lockedUntil: new Date(Date.now() + 15 * 60 * 1000), // 15 minutes from now
			});

			const unlockedAccount = createMockUser({
				id: 2,
				type: "cleaner",
				isMarketplaceCleaner: true,
				lockedUntil: null,
			});

			User.findAll.mockResolvedValue([lockedAccount, unlockedAccount]);

			// Try to login to locked account
			const response = await request(app)
				.post("/api/v1/user-sessions/login")
				.send({
					username: "test@example.com",
					password: "SecurePass1!",
					accountType: "employee",
				});

			expect(response.status).toBe(423);
			expect(response.body.error).toContain("locked");
		});
	});

	describe("Edge cases", () => {
		it("should handle email with no accounts by trying as username", async () => {
			User.findAll.mockResolvedValue([]);
			User.findOne.mockResolvedValue(null);

			const response = await request(app)
				.post("/api/v1/user-sessions/login")
				.send({ username: "notanemail@test.com", password: "SecurePass1!" });

			expect(response.status).toBe(401);
			// Should have tried findOne with email as username
			expect(User.findOne).toHaveBeenCalledWith({ where: { username: "notanemail@test.com" } });
		});

		it("should handle password verification correctly for selected account", async () => {
			const wrongPasswordHash = await bcrypt.hash("DifferentPass1!", 10);

			const employeeAccount = createMockUser({
				id: 1,
				type: "employee",
				password: wrongPasswordHash,
			});

			const marketplaceAccount = createMockUser({
				id: 2,
				type: "cleaner",
				isMarketplaceCleaner: true,
				password: hashedPassword, // Correct password
			});

			User.findAll.mockResolvedValue([employeeAccount, marketplaceAccount]);

			// Login to marketplace account with correct password
			const response = await request(app)
				.post("/api/v1/user-sessions/login")
				.send({
					username: "test@example.com",
					password: "SecurePass1!",
					accountType: "marketplace_cleaner",
				});

			expect(response.status).toBe(201);
		});
	});
});
