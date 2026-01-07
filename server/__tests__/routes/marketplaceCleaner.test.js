/**
 * Tests for POST /api/v1/users/marketplace-cleaner
 *
 * This endpoint allows business employees to create a separate marketplace
 * cleaner account, optionally using the same email as their employee account.
 */

const request = require("supertest");
const express = require("express");
const bcrypt = require("bcrypt");

// Mock all dependencies before requiring the router
jest.mock("../../models", () => ({
	User: {
		findOne: jest.fn(),
		findAll: jest.fn(),
		create: jest.fn(),
	},
	UserBills: {
		create: jest.fn(),
	},
	TermsAndConditions: {
		findByPk: jest.fn(),
	},
	UserTermsAcceptance: {
		create: jest.fn(),
	},
}));

jest.mock("../../services/ReferralService", () => ({
	validateReferralCode: jest.fn(),
	generateReferralCode: jest.fn(),
	createReferral: jest.fn(),
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

const { User, UserBills, TermsAndConditions, UserTermsAcceptance } = require("../../models");
const ReferralService = require("../../services/ReferralService");
const usersRouter = require("../../routes/api/v1/usersRouter");

// Create Express app for testing
const app = express();
app.use(express.json());
app.use("/api/v1/users", usersRouter);

describe("POST /api/v1/users/marketplace-cleaner", () => {
	beforeEach(() => {
		jest.clearAllMocks();
	});

	const validSignupData = {
		firstName: "John",
		lastName: "Doe",
		username: "johndoe123",
		password: "SecurePass1!",
		email: "john@example.com",
	};

	describe("Successful signup scenarios", () => {
		it("should create a marketplace cleaner account with new email", async () => {
			// No existing users with this email
			User.findAll.mockResolvedValue([]);
			User.findOne.mockResolvedValue(null);
			User.create.mockResolvedValue({
				id: 1,
				...validSignupData,
				type: "cleaner",
				isMarketplaceCleaner: true,
				employeeOfBusinessId: null,
				update: jest.fn().mockResolvedValue(true),
				dataValues: {
					id: 1,
					...validSignupData,
					type: "cleaner",
					isMarketplaceCleaner: true,
				},
			});
			UserBills.create.mockResolvedValue({ id: 1 });
			ReferralService.generateReferralCode.mockResolvedValue("JOHN1234");

			const response = await request(app)
				.post("/api/v1/users/marketplace-cleaner")
				.send(validSignupData);

			expect(response.status).toBe(201);
			expect(response.body.user).toBeDefined();
			expect(response.body.token).toBe("mock-jwt-token");
			expect(User.create).toHaveBeenCalledWith(
				expect.objectContaining({
					type: "cleaner",
					isMarketplaceCleaner: true,
					employeeOfBusinessId: null,
				})
			);
		});

		it("should allow signup with email already used by employee account", async () => {
			// Existing employee account with same email
			const existingEmployee = {
				id: 1,
				email: "john@example.com",
				type: "employee",
				isMarketplaceCleaner: false,
				employeeOfBusinessId: 5,
			};

			User.findAll.mockResolvedValue([existingEmployee]);
			User.findOne.mockResolvedValue(null); // No username conflict
			User.create.mockResolvedValue({
				id: 2,
				...validSignupData,
				type: "cleaner",
				isMarketplaceCleaner: true,
				employeeOfBusinessId: null,
				update: jest.fn().mockResolvedValue(true),
				dataValues: {
					id: 2,
					...validSignupData,
					type: "cleaner",
					isMarketplaceCleaner: true,
				},
			});
			UserBills.create.mockResolvedValue({ id: 1 });
			ReferralService.generateReferralCode.mockResolvedValue("JOHN1234");

			const response = await request(app)
				.post("/api/v1/users/marketplace-cleaner")
				.send(validSignupData);

			expect(response.status).toBe(201);
			expect(response.body.user).toBeDefined();
			expect(response.body.user.isMarketplaceCleaner).toBe(true);
		});

		it("should allow signup with email used by homeowner account", async () => {
			// Existing homeowner account with same email
			const existingHomeowner = {
				id: 1,
				email: "john@example.com",
				type: null,
				isMarketplaceCleaner: false,
			};

			User.findAll.mockResolvedValue([existingHomeowner]);
			User.findOne.mockResolvedValue(null);
			User.create.mockResolvedValue({
				id: 2,
				...validSignupData,
				type: "cleaner",
				isMarketplaceCleaner: true,
				update: jest.fn().mockResolvedValue(true),
				dataValues: {
					id: 2,
					...validSignupData,
					type: "cleaner",
					isMarketplaceCleaner: true,
				},
			});
			UserBills.create.mockResolvedValue({ id: 1 });
			ReferralService.generateReferralCode.mockResolvedValue("JOHN1234");

			const response = await request(app)
				.post("/api/v1/users/marketplace-cleaner")
				.send(validSignupData);

			expect(response.status).toBe(201);
		});

		it("should process referral code when provided", async () => {
			User.findAll.mockResolvedValue([]);
			User.findOne.mockResolvedValue(null);
			User.create.mockResolvedValue({
				id: 1,
				...validSignupData,
				type: "cleaner",
				isMarketplaceCleaner: true,
				update: jest.fn().mockResolvedValue(true),
				dataValues: { id: 1, ...validSignupData, type: "cleaner", isMarketplaceCleaner: true },
			});
			UserBills.create.mockResolvedValue({ id: 1 });
			ReferralService.validateReferralCode.mockResolvedValue({
				valid: true,
				programType: "cleaner",
				rewards: { referrer: 50, referred: 25 },
			});
			ReferralService.generateReferralCode.mockResolvedValue("JOHN1234");
			ReferralService.createReferral.mockResolvedValue({ id: 1 });

			const response = await request(app)
				.post("/api/v1/users/marketplace-cleaner")
				.send({ ...validSignupData, referralCode: "REFER123" });

			expect(response.status).toBe(201);
			expect(ReferralService.validateReferralCode).toHaveBeenCalledWith(
				"REFER123",
				"cleaner",
				expect.anything()
			);
			expect(ReferralService.createReferral).toHaveBeenCalled();
		});

		it("should record terms acceptance when termsId provided", async () => {
			User.findAll.mockResolvedValue([]);
			User.findOne.mockResolvedValue(null);
			TermsAndConditions.findByPk.mockResolvedValue({
				id: 1,
				version: 2,
				contentType: "text",
				content: "Terms content here",
			});
			User.create.mockResolvedValue({
				id: 1,
				...validSignupData,
				type: "cleaner",
				isMarketplaceCleaner: true,
				update: jest.fn().mockResolvedValue(true),
				dataValues: { id: 1, ...validSignupData, type: "cleaner", isMarketplaceCleaner: true },
			});
			UserBills.create.mockResolvedValue({ id: 1 });
			UserTermsAcceptance.create.mockResolvedValue({ id: 1 });
			ReferralService.generateReferralCode.mockResolvedValue("JOHN1234");

			const response = await request(app)
				.post("/api/v1/users/marketplace-cleaner")
				.send({ ...validSignupData, termsId: 1 });

			expect(response.status).toBe(201);
			expect(UserTermsAcceptance.create).toHaveBeenCalled();
		});
	});

	describe("Validation errors", () => {
		it("should reject signup when email already has marketplace cleaner account", async () => {
			const existingMarketplaceCleaner = {
				id: 1,
				email: "john@example.com",
				type: "cleaner",
				isMarketplaceCleaner: true,
			};

			User.findAll.mockResolvedValue([existingMarketplaceCleaner]);

			const response = await request(app)
				.post("/api/v1/users/marketplace-cleaner")
				.send(validSignupData);

			expect(response.status).toBe(409);
			expect(response.body.error).toContain("marketplace cleaner account already exists");
		});

		it("should reject signup when username already exists", async () => {
			User.findAll.mockResolvedValue([]);
			User.findOne.mockResolvedValue({ id: 1, username: "johndoe123" });

			const response = await request(app)
				.post("/api/v1/users/marketplace-cleaner")
				.send(validSignupData);

			expect(response.status).toBe(410);
			expect(response.body.error).toContain("Username already exists");
		});

		it("should reject signup with missing required fields", async () => {
			const incompleteData = {
				firstName: "John",
				lastName: "Doe",
				// Missing username, password, email
			};

			const response = await request(app)
				.post("/api/v1/users/marketplace-cleaner")
				.send(incompleteData);

			expect(response.status).toBe(400);
			expect(response.body.error).toContain("required");
		});

		it("should reject signup with weak password", async () => {
			const response = await request(app)
				.post("/api/v1/users/marketplace-cleaner")
				.send({ ...validSignupData, password: "weak" });

			expect(response.status).toBe(400);
			expect(response.body.error).toContain("Password");
		});

		it("should reject username containing 'owner'", async () => {
			User.findAll.mockResolvedValue([]);

			const response = await request(app)
				.post("/api/v1/users/marketplace-cleaner")
				.send({ ...validSignupData, username: "johnowner123" });

			expect(response.status).toBe(400);
			expect(response.body.error).toContain("owner");
		});
	});

	describe("Edge cases", () => {
		it("should handle multiple existing accounts (employee + homeowner) with same email", async () => {
			// Both an employee and homeowner account exist with same email
			const existingAccounts = [
				{ id: 1, email: "john@example.com", type: "employee", isMarketplaceCleaner: false },
				{ id: 2, email: "john@example.com", type: null, isMarketplaceCleaner: false },
			];

			User.findAll.mockResolvedValue(existingAccounts);
			User.findOne.mockResolvedValue(null);
			User.create.mockResolvedValue({
				id: 3,
				...validSignupData,
				type: "cleaner",
				isMarketplaceCleaner: true,
				update: jest.fn().mockResolvedValue(true),
				dataValues: { id: 3, ...validSignupData, type: "cleaner", isMarketplaceCleaner: true },
			});
			UserBills.create.mockResolvedValue({ id: 1 });
			ReferralService.generateReferralCode.mockResolvedValue("JOHN1234");

			const response = await request(app)
				.post("/api/v1/users/marketplace-cleaner")
				.send(validSignupData);

			// Should still allow signup since none are marketplace cleaners
			expect(response.status).toBe(201);
		});

		it("should continue signup even if referral processing fails", async () => {
			User.findAll.mockResolvedValue([]);
			User.findOne.mockResolvedValue(null);
			User.create.mockResolvedValue({
				id: 1,
				...validSignupData,
				type: "cleaner",
				isMarketplaceCleaner: true,
				update: jest.fn().mockResolvedValue(true),
				dataValues: { id: 1, ...validSignupData, type: "cleaner", isMarketplaceCleaner: true },
			});
			UserBills.create.mockResolvedValue({ id: 1 });
			ReferralService.validateReferralCode.mockRejectedValue(new Error("Referral error"));

			const response = await request(app)
				.post("/api/v1/users/marketplace-cleaner")
				.send({ ...validSignupData, referralCode: "INVALID" });

			// Should still succeed
			expect(response.status).toBe(201);
		});

		it("should handle database error gracefully", async () => {
			User.findAll.mockResolvedValue([]);
			User.findOne.mockResolvedValue(null);
			User.create.mockRejectedValue(new Error("Database connection failed"));

			const response = await request(app)
				.post("/api/v1/users/marketplace-cleaner")
				.send(validSignupData);

			expect(response.status).toBe(500);
			expect(response.body.error).toContain("Failed to create account");
		});
	});
});
