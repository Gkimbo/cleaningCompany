/**
 * Tests for multi-account password and username recovery
 *
 * When a user has multiple accounts with the same email, the recovery flows
 * should handle this appropriately:
 * - forgot-password: Ask which account to reset
 * - forgot-username: Send all usernames for that email
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

jest.mock("../../services/sendNotifications/EmailClass", () => ({
	sendPasswordReset: jest.fn().mockResolvedValue(true),
	sendUsernameRecovery: jest.fn().mockResolvedValue(true),
}));

jest.mock("../../services/sendNotifications/PushNotificationClass", () => ({
	sendPushPasswordReset: jest.fn().mockResolvedValue(true),
	sendPushUsernameRecovery: jest.fn().mockResolvedValue(true),
}));

jest.mock("jsonwebtoken", () => ({
	sign: jest.fn(() => "mock-jwt-token"),
	verify: jest.fn(),
}));

jest.mock("passport", () => ({
	authenticate: jest.fn(() => (req, res, next) => next()),
}));

const { User } = require("../../models");
const Email = require("../../services/sendNotifications/EmailClass");
const PushNotification = require("../../services/sendNotifications/PushNotificationClass");
const sessionRouter = require("../../routes/api/v1/userSessionsRouter");

// Create Express app for testing
const app = express();
app.use(express.json());

// Mock session
app.use((req, res, next) => {
	req.session = { destroy: jest.fn() };
	req.login = (user, callback) => callback(null);
	next();
});

app.use("/api/v1/user-sessions", sessionRouter);

describe("Password and Username Recovery - Multi-account handling", () => {
	beforeEach(() => {
		jest.clearAllMocks();
	});

	const createMockUser = (overrides = {}) => ({
		id: 1,
		username: "testuser",
		email: "test@example.com",
		type: "cleaner",
		isMarketplaceCleaner: true,
		employeeOfBusinessId: null,
		expoPushToken: null,
		update: jest.fn().mockResolvedValue(true),
		...overrides,
	});

	describe("POST /api/v1/user-sessions/forgot-password", () => {
		describe("Single account", () => {
			it("should reset password for single account", async () => {
				const mockUser = createMockUser();
				User.findAll.mockResolvedValue([mockUser]);

				const response = await request(app)
					.post("/api/v1/user-sessions/forgot-password")
					.send({ email: "test@example.com" });

				expect(response.status).toBe(200);
				expect(mockUser.update).toHaveBeenCalled();
				expect(Email.sendPasswordReset).toHaveBeenCalledWith(
					"test@example.com",
					"testuser",
					expect.any(String)
				);
			});

			it("should return success even when no account found (security)", async () => {
				User.findAll.mockResolvedValue([]);

				const response = await request(app)
					.post("/api/v1/user-sessions/forgot-password")
					.send({ email: "nonexistent@example.com" });

				expect(response.status).toBe(200);
				expect(response.body.message).toContain("If an account with that email exists");
				expect(Email.sendPasswordReset).not.toHaveBeenCalled();
			});

			it("should require email field", async () => {
				const response = await request(app)
					.post("/api/v1/user-sessions/forgot-password")
					.send({});

				expect(response.status).toBe(400);
				expect(response.body.error).toContain("Email is required");
			});

			it("should send push notification if user has token", async () => {
				const mockUser = createMockUser({ expoPushToken: "ExponentPushToken[xxx]" });
				User.findAll.mockResolvedValue([mockUser]);

				await request(app)
					.post("/api/v1/user-sessions/forgot-password")
					.send({ email: "test@example.com" });

				expect(PushNotification.sendPushPasswordReset).toHaveBeenCalledWith(
					"ExponentPushToken[xxx]",
					"testuser"
				);
			});
		});

		describe("Multiple accounts with same email", () => {
			it("should return 300 with account options when multiple accounts exist", async () => {
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
					.post("/api/v1/user-sessions/forgot-password")
					.send({ email: "test@example.com" });

				expect(response.status).toBe(300);
				expect(response.body.requiresAccountSelection).toBe(true);
				expect(response.body.message).toContain("Multiple accounts found");
				expect(response.body.accountOptions).toHaveLength(2);
				expect(response.body.accountOptions).toContainEqual(
					expect.objectContaining({ accountType: "employee" })
				);
				expect(response.body.accountOptions).toContainEqual(
					expect.objectContaining({ accountType: "marketplace_cleaner" })
				);
			});

			it("should reset only the selected account when accountType provided", async () => {
				const employeeAccount = createMockUser({
					id: 1,
					username: "employee_user",
					type: "employee",
					isMarketplaceCleaner: false,
				});

				const marketplaceAccount = createMockUser({
					id: 2,
					username: "marketplace_user",
					type: "cleaner",
					isMarketplaceCleaner: true,
				});

				User.findAll.mockResolvedValue([employeeAccount, marketplaceAccount]);

				const response = await request(app)
					.post("/api/v1/user-sessions/forgot-password")
					.send({ email: "test@example.com", accountType: "marketplace_cleaner" });

				expect(response.status).toBe(200);
				expect(marketplaceAccount.update).toHaveBeenCalled();
				expect(employeeAccount.update).not.toHaveBeenCalled();
				expect(Email.sendPasswordReset).toHaveBeenCalledWith(
					"test@example.com",
					"marketplace_user",
					expect.any(String)
				);
			});

			it("should reset employee account when accountType is employee", async () => {
				const employeeAccount = createMockUser({
					id: 1,
					username: "employee_user",
					type: "employee",
					isMarketplaceCleaner: false,
				});

				const marketplaceAccount = createMockUser({
					id: 2,
					username: "marketplace_user",
					type: "cleaner",
					isMarketplaceCleaner: true,
				});

				User.findAll.mockResolvedValue([employeeAccount, marketplaceAccount]);

				const response = await request(app)
					.post("/api/v1/user-sessions/forgot-password")
					.send({ email: "test@example.com", accountType: "employee" });

				expect(response.status).toBe(200);
				expect(employeeAccount.update).toHaveBeenCalled();
				expect(marketplaceAccount.update).not.toHaveBeenCalled();
			});

			it("should reject invalid accountType", async () => {
				const employeeAccount = createMockUser({ id: 1, type: "employee" });
				const marketplaceAccount = createMockUser({ id: 2, type: "cleaner", isMarketplaceCleaner: true });

				User.findAll.mockResolvedValue([employeeAccount, marketplaceAccount]);

				const response = await request(app)
					.post("/api/v1/user-sessions/forgot-password")
					.send({ email: "test@example.com", accountType: "invalid_type" });

				expect(response.status).toBe(400);
				expect(response.body.error).toContain("Invalid account type");
			});

			it("should handle homeowner account type selection", async () => {
				const homeownerAccount = createMockUser({
					id: 1,
					username: "homeowner_user",
					type: null,
					isMarketplaceCleaner: false,
				});

				const marketplaceAccount = createMockUser({
					id: 2,
					username: "marketplace_user",
					type: "cleaner",
					isMarketplaceCleaner: true,
				});

				User.findAll.mockResolvedValue([homeownerAccount, marketplaceAccount]);

				const response = await request(app)
					.post("/api/v1/user-sessions/forgot-password")
					.send({ email: "test@example.com", accountType: "homeowner" });

				expect(response.status).toBe(200);
				expect(homeownerAccount.update).toHaveBeenCalled();
			});
		});
	});

	describe("POST /api/v1/user-sessions/forgot-username", () => {
		describe("Single account", () => {
			it("should send username for single account", async () => {
				const mockUser = createMockUser();
				User.findAll.mockResolvedValue([mockUser]);

				const response = await request(app)
					.post("/api/v1/user-sessions/forgot-username")
					.send({ email: "test@example.com" });

				expect(response.status).toBe(200);
				expect(Email.sendUsernameRecovery).toHaveBeenCalled();
			});

			it("should return success even when no account found (security)", async () => {
				User.findAll.mockResolvedValue([]);

				const response = await request(app)
					.post("/api/v1/user-sessions/forgot-username")
					.send({ email: "nonexistent@example.com" });

				expect(response.status).toBe(200);
				expect(Email.sendUsernameRecovery).not.toHaveBeenCalled();
			});

			it("should require email field", async () => {
				const response = await request(app)
					.post("/api/v1/user-sessions/forgot-username")
					.send({});

				expect(response.status).toBe(400);
				expect(response.body.error).toContain("Email is required");
			});
		});

		describe("Multiple accounts with same email", () => {
			it("should send ALL usernames when multiple accounts exist", async () => {
				const employeeAccount = createMockUser({
					id: 1,
					username: "employee_user",
					type: "employee",
					isMarketplaceCleaner: false,
				});

				const marketplaceAccount = createMockUser({
					id: 2,
					username: "marketplace_user",
					type: "cleaner",
					isMarketplaceCleaner: true,
				});

				User.findAll.mockResolvedValue([employeeAccount, marketplaceAccount]);

				const response = await request(app)
					.post("/api/v1/user-sessions/forgot-username")
					.send({ email: "test@example.com" });

				expect(response.status).toBe(200);
				expect(Email.sendUsernameRecovery).toHaveBeenCalledWith(
					"test@example.com",
					expect.stringContaining("employee_user (Business Employee)")
				);
				expect(Email.sendUsernameRecovery).toHaveBeenCalledWith(
					"test@example.com",
					expect.stringContaining("marketplace_user (Marketplace Cleaner)")
				);
			});

			it("should include account type in username list", async () => {
				const accounts = [
					createMockUser({ id: 1, username: "emp_user", type: "employee", isMarketplaceCleaner: false }),
					createMockUser({ id: 2, username: "mkt_user", type: "cleaner", isMarketplaceCleaner: true }),
					createMockUser({ id: 3, username: "home_user", type: null, isMarketplaceCleaner: false }),
				];

				User.findAll.mockResolvedValue(accounts);

				await request(app)
					.post("/api/v1/user-sessions/forgot-username")
					.send({ email: "test@example.com" });

				const emailCall = Email.sendUsernameRecovery.mock.calls[0];
				expect(emailCall[1]).toContain("Business Employee");
				expect(emailCall[1]).toContain("Marketplace Cleaner");
				expect(emailCall[1]).toContain("Homeowner");
			});

			it("should send push notifications to all accounts with tokens", async () => {
				const accounts = [
					createMockUser({ id: 1, username: "user1", expoPushToken: "token1" }),
					createMockUser({ id: 2, username: "user2", expoPushToken: "token2" }),
					createMockUser({ id: 3, username: "user3", expoPushToken: null }),
				];

				User.findAll.mockResolvedValue(accounts);

				await request(app)
					.post("/api/v1/user-sessions/forgot-username")
					.send({ email: "test@example.com" });

				expect(PushNotification.sendPushUsernameRecovery).toHaveBeenCalledTimes(2);
				expect(PushNotification.sendPushUsernameRecovery).toHaveBeenCalledWith("token1", "user1");
				expect(PushNotification.sendPushUsernameRecovery).toHaveBeenCalledWith("token2", "user2");
			});

			it("should handle three accounts with different types", async () => {
				const accounts = [
					createMockUser({ id: 1, username: "emp", type: "employee", isMarketplaceCleaner: false }),
					createMockUser({ id: 2, username: "mkt", type: "cleaner", isMarketplaceCleaner: true }),
					createMockUser({ id: 3, username: "owner", type: "owner", isMarketplaceCleaner: false }),
				];

				User.findAll.mockResolvedValue(accounts);

				const response = await request(app)
					.post("/api/v1/user-sessions/forgot-username")
					.send({ email: "test@example.com" });

				expect(response.status).toBe(200);
				const emailCall = Email.sendUsernameRecovery.mock.calls[0];
				expect(emailCall[1]).toContain("emp (Business Employee)");
				expect(emailCall[1]).toContain("mkt (Marketplace Cleaner)");
				expect(emailCall[1]).toContain("owner (Owner)");
			});
		});

		describe("Account type display names in recovery emails", () => {
			const testCases = [
				{ type: "employee", isMarketplaceCleaner: false, expectedDisplay: "Business Employee" },
				{ type: "cleaner", isMarketplaceCleaner: true, expectedDisplay: "Marketplace Cleaner" },
				{ type: "cleaner", isMarketplaceCleaner: false, expectedDisplay: "Cleaner" },
				{ type: "owner", isMarketplaceCleaner: false, expectedDisplay: "Owner" },
				{ type: "humanResources", isMarketplaceCleaner: false, expectedDisplay: "HR Staff" },
				{ type: null, isMarketplaceCleaner: false, expectedDisplay: "Homeowner" },
			];

			testCases.forEach(({ type, isMarketplaceCleaner, expectedDisplay }) => {
				it(`should show "${expectedDisplay}" for ${type || "null"} type`, async () => {
					const account1 = createMockUser({
						id: 1,
						username: "testuser",
						type,
						isMarketplaceCleaner,
					});

					const account2 = createMockUser({
						id: 2,
						username: "other",
						type: "cleaner",
						isMarketplaceCleaner: true,
					});

					User.findAll.mockResolvedValue([account1, account2]);

					await request(app)
						.post("/api/v1/user-sessions/forgot-username")
						.send({ email: "test@example.com" });

					const emailCall = Email.sendUsernameRecovery.mock.calls[0];
					expect(emailCall[1]).toContain(expectedDisplay);
				});
			});
		});
	});

	describe("Error handling", () => {
		it("should handle email service failure gracefully for password reset", async () => {
			const mockUser = createMockUser();
			User.findAll.mockResolvedValue([mockUser]);
			Email.sendPasswordReset.mockRejectedValue(new Error("Email service down"));

			const response = await request(app)
				.post("/api/v1/user-sessions/forgot-password")
				.send({ email: "test@example.com" });

			expect(response.status).toBe(500);
			expect(response.body.error).toContain("Failed to process request");
		});

		it("should handle email service failure gracefully for username recovery", async () => {
			const mockUser = createMockUser();
			User.findAll.mockResolvedValue([mockUser]);
			Email.sendUsernameRecovery.mockRejectedValue(new Error("Email service down"));

			const response = await request(app)
				.post("/api/v1/user-sessions/forgot-username")
				.send({ email: "test@example.com" });

			expect(response.status).toBe(500);
			expect(response.body.error).toContain("Failed to process request");
		});

		it("should handle database error gracefully", async () => {
			User.findAll.mockRejectedValue(new Error("Database connection failed"));

			const response = await request(app)
				.post("/api/v1/user-sessions/forgot-password")
				.send({ email: "test@example.com" });

			expect(response.status).toBe(500);
		});
	});
});
