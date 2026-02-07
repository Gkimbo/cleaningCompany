/**
 * Comprehensive tests for the check-accounts endpoint and linkedAccounts functionality
 *
 * Tests cover:
 * 1. GET /check-accounts - Pre-login check for multiple accounts
 * 2. POST /login - LinkedAccounts returned after successful login
 * 3. Account switching scenarios
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
		isBusinessOwner: user.isBusinessOwner,
		businessName: user.businessName,
		yearsInBusiness: user.yearsInBusiness,
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
const { Op } = require("sequelize");
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

describe("Check Accounts and Linked Accounts Tests", () => {
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
		type: null,
		isMarketplaceCleaner: false,
		employeeOfBusinessId: null,
		lockedUntil: null,
		failedLoginAttempts: 0,
		expoPushToken: null,
		update: jest.fn().mockResolvedValue(true),
		...overrides,
	});

	// ==========================================
	// GET /check-accounts TESTS
	// ==========================================
	describe("GET /check-accounts", () => {
		describe("Input validation", () => {
			it("should return multipleAccounts: false when no email provided", async () => {
				const response = await request(app)
					.get("/api/v1/user-sessions/check-accounts");

				expect(response.status).toBe(200);
				expect(response.body.multipleAccounts).toBe(false);
			});

			it("should return multipleAccounts: false for empty email", async () => {
				const response = await request(app)
					.get("/api/v1/user-sessions/check-accounts?email=");

				expect(response.status).toBe(200);
				expect(response.body.multipleAccounts).toBe(false);
			});

			it("should return multipleAccounts: false for non-email string", async () => {
				const response = await request(app)
					.get("/api/v1/user-sessions/check-accounts?email=notanemail");

				expect(response.status).toBe(200);
				expect(response.body.multipleAccounts).toBe(false);
				expect(User.findAll).not.toHaveBeenCalled();
			});
		});

		describe("Single account scenarios", () => {
			it("should return multipleAccounts: false when no accounts exist", async () => {
				User.findAll.mockResolvedValue([]);

				const response = await request(app)
					.get("/api/v1/user-sessions/check-accounts?email=test@example.com");

				expect(response.status).toBe(200);
				expect(response.body.multipleAccounts).toBe(false);
			});

			it("should return multipleAccounts: false when only one account exists", async () => {
				User.findAll.mockResolvedValue([createMockUser()]);

				const response = await request(app)
					.get("/api/v1/user-sessions/check-accounts?email=test@example.com");

				expect(response.status).toBe(200);
				expect(response.body.multipleAccounts).toBe(false);
			});
		});

		describe("Multiple account scenarios", () => {
			it("should return multipleAccounts: true with account options for 2 accounts", async () => {
				User.findAll.mockResolvedValue([
					createMockUser({ id: 1, type: "employee" }),
					createMockUser({ id: 2, type: "cleaner", isMarketplaceCleaner: true }),
				]);

				const response = await request(app)
					.get("/api/v1/user-sessions/check-accounts?email=test@example.com");

				expect(response.status).toBe(200);
				expect(response.body.multipleAccounts).toBe(true);
				expect(response.body.accountOptions).toHaveLength(2);
			});

			it("should return multipleAccounts: true with account options for 3+ accounts", async () => {
				User.findAll.mockResolvedValue([
					createMockUser({ id: 1, type: "employee" }),
					createMockUser({ id: 2, type: "cleaner", isMarketplaceCleaner: true }),
					createMockUser({ id: 3, type: null }), // homeowner
				]);

				const response = await request(app)
					.get("/api/v1/user-sessions/check-accounts?email=test@example.com");

				expect(response.status).toBe(200);
				expect(response.body.multipleAccounts).toBe(true);
				expect(response.body.accountOptions).toHaveLength(3);
			});

			it("should correctly identify Business Employee account type", async () => {
				User.findAll.mockResolvedValue([
					createMockUser({ id: 1, type: "employee" }),
					createMockUser({ id: 2, type: null }),
				]);

				const response = await request(app)
					.get("/api/v1/user-sessions/check-accounts?email=test@example.com");

				expect(response.body.accountOptions).toContainEqual(
					expect.objectContaining({
						accountType: "employee",
						displayName: "Business Employee",
					})
				);
			});

			it("should correctly identify Marketplace Cleaner account type", async () => {
				User.findAll.mockResolvedValue([
					createMockUser({ id: 1, type: "cleaner", isMarketplaceCleaner: true }),
					createMockUser({ id: 2, type: null }),
				]);

				const response = await request(app)
					.get("/api/v1/user-sessions/check-accounts?email=test@example.com");

				expect(response.body.accountOptions).toContainEqual(
					expect.objectContaining({
						accountType: "marketplace_cleaner",
						displayName: "Marketplace Cleaner",
					})
				);
			});

			it("should correctly identify regular Cleaner account type", async () => {
				User.findAll.mockResolvedValue([
					createMockUser({ id: 1, type: "cleaner", isMarketplaceCleaner: false }),
					createMockUser({ id: 2, type: null }),
				]);

				const response = await request(app)
					.get("/api/v1/user-sessions/check-accounts?email=test@example.com");

				expect(response.body.accountOptions).toContainEqual(
					expect.objectContaining({
						accountType: "cleaner",
						displayName: "Cleaner",
					})
				);
			});

			it("should correctly identify Owner account type", async () => {
				User.findAll.mockResolvedValue([
					createMockUser({ id: 1, type: "owner" }),
					createMockUser({ id: 2, type: null }),
				]);

				const response = await request(app)
					.get("/api/v1/user-sessions/check-accounts?email=test@example.com");

				expect(response.body.accountOptions).toContainEqual(
					expect.objectContaining({
						accountType: "owner",
						displayName: "Owner",
					})
				);
			});

			it("should correctly identify HR Staff account type", async () => {
				User.findAll.mockResolvedValue([
					createMockUser({ id: 1, type: "humanResources" }),
					createMockUser({ id: 2, type: null }),
				]);

				const response = await request(app)
					.get("/api/v1/user-sessions/check-accounts?email=test@example.com");

				expect(response.body.accountOptions).toContainEqual(
					expect.objectContaining({
						accountType: "hr",
						displayName: "HR Staff",
					})
				);
			});

			it("should correctly identify Homeowner account type", async () => {
				User.findAll.mockResolvedValue([
					createMockUser({ id: 1, type: "employee" }),
					createMockUser({ id: 2, type: null }),
				]);

				const response = await request(app)
					.get("/api/v1/user-sessions/check-accounts?email=test@example.com");

				expect(response.body.accountOptions).toContainEqual(
					expect.objectContaining({
						accountType: "homeowner",
						displayName: "Homeowner",
					})
				);
			});
		});

		describe("Error handling", () => {
			it("should return multipleAccounts: false on database error", async () => {
				User.findAll.mockRejectedValue(new Error("Database error"));

				const response = await request(app)
					.get("/api/v1/user-sessions/check-accounts?email=test@example.com");

				expect(response.status).toBe(200);
				expect(response.body.multipleAccounts).toBe(false);
			});
		});

		describe("URL encoding", () => {
			it("should handle URL-encoded email addresses", async () => {
				User.findAll.mockResolvedValue([createMockUser()]);

				const response = await request(app)
					.get("/api/v1/user-sessions/check-accounts?email=test%40example.com");

				expect(response.status).toBe(200);
				// Email is hashed before querying for privacy
				expect(User.findAll).toHaveBeenCalledWith(
					expect.objectContaining({
						where: expect.objectContaining({
							emailHash: expect.any(String),
						}),
					})
				);
			});

			it("should handle email addresses with special characters", async () => {
				User.findAll.mockResolvedValue([createMockUser()]);

				const response = await request(app)
					.get("/api/v1/user-sessions/check-accounts?email=test%2Bsuffix%40example.com");

				expect(response.status).toBe(200);
				// Email is hashed before querying for privacy
				expect(User.findAll).toHaveBeenCalledWith(
					expect.objectContaining({
						where: expect.objectContaining({
							emailHash: expect.any(String),
						}),
					})
				);
			});
		});
	});

	// ==========================================
	// POST /login - LinkedAccounts TESTS
	// ==========================================
	describe("POST /login - LinkedAccounts in response", () => {
		describe("No linked accounts", () => {
			it("should return empty linkedAccounts when user has no other accounts", async () => {
				const mockUser = createMockUser();
				User.findOne.mockResolvedValue(mockUser);
				User.findAll.mockResolvedValue([]); // No linked accounts

				const response = await request(app)
					.post("/api/v1/user-sessions/login")
					.send({ username: "testuser", password: "SecurePass1!" });

				expect(response.status).toBe(201);
				expect(response.body.linkedAccounts).toEqual([]);
			});

			it("should return empty linkedAccounts when user has no email", async () => {
				const mockUser = createMockUser({ email: null });
				User.findOne.mockResolvedValue(mockUser);
				User.findAll.mockResolvedValue([]);

				const response = await request(app)
					.post("/api/v1/user-sessions/login")
					.send({ username: "testuser", password: "SecurePass1!" });

				expect(response.status).toBe(201);
				expect(response.body.linkedAccounts).toEqual([]);
			});
		});

		describe("With linked accounts", () => {
			it("should return linkedAccounts with other accounts sharing same email", async () => {
				const currentUser = createMockUser({ id: 1, type: "employee" });
				const linkedUser = createMockUser({ id: 2, type: "cleaner", isMarketplaceCleaner: true });

				User.findOne.mockResolvedValue(currentUser);
				// First findAll for email login check (if applicable)
				// Second findAll for linked accounts
				User.findAll.mockResolvedValue([linkedUser]);

				const response = await request(app)
					.post("/api/v1/user-sessions/login")
					.send({ username: "testuser", password: "SecurePass1!" });

				expect(response.status).toBe(201);
				expect(response.body.linkedAccounts).toHaveLength(1);
				expect(response.body.linkedAccounts[0]).toEqual(
					expect.objectContaining({
						accountType: "marketplace_cleaner",
						displayName: "Marketplace Cleaner",
					})
				);
			});

			it("should return multiple linkedAccounts when user has 2+ other accounts", async () => {
				const currentUser = createMockUser({ id: 1, type: "employee" });

				User.findOne.mockResolvedValue(currentUser);
				User.findAll.mockResolvedValue([
					createMockUser({ id: 2, type: "cleaner", isMarketplaceCleaner: true }),
					createMockUser({ id: 3, type: null }), // homeowner
				]);

				const response = await request(app)
					.post("/api/v1/user-sessions/login")
					.send({ username: "testuser", password: "SecurePass1!" });

				expect(response.status).toBe(201);
				expect(response.body.linkedAccounts).toHaveLength(2);
			});

			it("should not include current user in linkedAccounts", async () => {
				const currentUser = createMockUser({ id: 1, type: "employee", email: "test@example.com" });

				User.findOne.mockResolvedValue(currentUser);
				// findAll should exclude current user (id !== 1)
				User.findAll.mockResolvedValue([
					createMockUser({ id: 2, type: "cleaner", isMarketplaceCleaner: true }),
				]);

				const response = await request(app)
					.post("/api/v1/user-sessions/login")
					.send({ username: "testuser", password: "SecurePass1!" });

				expect(response.status).toBe(201);
				// Verify the findAll was called with correct where clause
				expect(User.findAll).toHaveBeenCalledWith(
					expect.objectContaining({
						where: expect.objectContaining({
							email: "test@example.com",
						}),
					})
				);
			});

			it("should correctly map all account types in linkedAccounts", async () => {
				const currentUser = createMockUser({ id: 1, type: "owner" });

				User.findOne.mockResolvedValue(currentUser);
				User.findAll.mockResolvedValue([
					createMockUser({ id: 2, type: "employee" }),
					createMockUser({ id: 3, type: "cleaner", isMarketplaceCleaner: true }),
					createMockUser({ id: 4, type: "cleaner", isMarketplaceCleaner: false }),
					createMockUser({ id: 5, type: "humanResources" }),
					createMockUser({ id: 6, type: null }),
				]);

				const response = await request(app)
					.post("/api/v1/user-sessions/login")
					.send({ username: "testuser", password: "SecurePass1!" });

				expect(response.status).toBe(201);
				expect(response.body.linkedAccounts).toHaveLength(5);

				const accountTypes = response.body.linkedAccounts.map((a) => a.accountType);
				expect(accountTypes).toContain("employee");
				expect(accountTypes).toContain("marketplace_cleaner");
				expect(accountTypes).toContain("cleaner");
				expect(accountTypes).toContain("hr");
				expect(accountTypes).toContain("homeowner");
			});
		});

		describe("Account switching via login", () => {
			it("should allow switching to a linked account with correct password", async () => {
				const targetUser = createMockUser({
					id: 2,
					type: "cleaner",
					isMarketplaceCleaner: true,
					username: "marketplacecleaner",
				});
				const otherUser = createMockUser({ id: 1, type: "employee" });

				// Email login returns both users
				User.findAll
					.mockResolvedValueOnce([targetUser, otherUser]) // First call for email login
					.mockResolvedValueOnce([otherUser]); // Second call for linked accounts

				const response = await request(app)
					.post("/api/v1/user-sessions/login")
					.send({
						username: "test@example.com",
						password: "SecurePass1!",
						accountType: "marketplace_cleaner",
					});

				expect(response.status).toBe(201);
				expect(response.body.user.type).toBe("cleaner");
				expect(response.body.user.isMarketplaceCleaner).toBe(true);
				expect(response.body.linkedAccounts).toHaveLength(1);
				expect(response.body.linkedAccounts[0].accountType).toBe("employee");
			});

			it("should return 300 requiring account selection when switching without accountType", async () => {
				const user1 = createMockUser({ id: 1, type: "employee" });
				const user2 = createMockUser({ id: 2, type: "cleaner", isMarketplaceCleaner: true });

				User.findAll.mockResolvedValue([user1, user2]);

				const response = await request(app)
					.post("/api/v1/user-sessions/login")
					.send({
						username: "test@example.com",
						password: "SecurePass1!",
						// No accountType provided
					});

				expect(response.status).toBe(300);
				expect(response.body.requiresAccountSelection).toBe(true);
				expect(response.body.accountOptions).toHaveLength(2);
			});
		});
	});

	// ==========================================
	// Edge cases and security
	// ==========================================
	describe("Edge cases and security", () => {
		it("should handle case-insensitive email matching", async () => {
			User.findAll.mockResolvedValue([
				createMockUser({ id: 1, email: "Test@Example.com" }),
				createMockUser({ id: 2, email: "test@example.com" }),
			]);

			const response = await request(app)
				.get("/api/v1/user-sessions/check-accounts?email=TEST@EXAMPLE.COM");

			// Note: The actual case sensitivity depends on database collation
			// This test verifies the endpoint handles the query correctly
			expect(response.status).toBe(200);
		});

		it("should not leak information about which accounts exist for an email", async () => {
			// When check-accounts is called, it should only reveal account types
			// if the user knows the email - it shouldn't reveal if email exists at all
			User.findAll.mockResolvedValue([]);

			const response = await request(app)
				.get("/api/v1/user-sessions/check-accounts?email=nonexistent@example.com");

			expect(response.status).toBe(200);
			expect(response.body.multipleAccounts).toBe(false);
			// No error message that reveals email doesn't exist
		});

		it("should handle concurrent account checks gracefully", async () => {
			User.findAll.mockResolvedValue([
				createMockUser({ id: 1, type: "employee" }),
				createMockUser({ id: 2, type: null }),
			]);

			// Simulate multiple concurrent requests
			const promises = Array(5)
				.fill()
				.map(() =>
					request(app).get("/api/v1/user-sessions/check-accounts?email=test@example.com")
				);

			const responses = await Promise.all(promises);

			responses.forEach((response) => {
				expect(response.status).toBe(200);
				expect(response.body.multipleAccounts).toBe(true);
			});
		});
	});
});
