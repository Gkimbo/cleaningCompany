const { Op } = require("sequelize");

// Mock models
jest.mock("../../models", () => ({
	User: {
		findByPk: jest.fn(),
		findAll: jest.fn(),
	},
	CleanerClient: {
		count: jest.fn(),
	},
	UserReviews: {
		findOne: jest.fn(),
	},
	EmployeeJobAssignment: {
		count: jest.fn(),
	},
	sequelize: {
		fn: jest.fn((name) => `fn:${name}`),
		col: jest.fn((name) => `col:${name}`),
		Sequelize: { Op },
	},
}));

const BusinessVerificationService = require("../../services/BusinessVerificationService");
const {
	User,
	CleanerClient,
	UserReviews,
	EmployeeJobAssignment,
} = require("../../models");

describe("BusinessVerificationService", () => {
	beforeEach(() => {
		jest.clearAllMocks();
	});

	// =============================================
	// checkVerificationEligibility
	// =============================================
	describe("checkVerificationEligibility", () => {
		const mockBusinessOwner = {
			id: 1,
			firstName: "Jane",
			lastName: "Owner",
			isBusinessOwner: true,
			businessName: "CleanPro Services",
			yearsInBusiness: 5,
			accountFrozen: false,
			businessVerificationStatus: "none",
			businessVerifiedAt: null,
		};

		it("should return eligible for qualifying business", async () => {
			User.findByPk.mockResolvedValue(mockBusinessOwner);
			CleanerClient.count.mockResolvedValue(15); // Above 10 threshold
			UserReviews.findOne.mockResolvedValue({ avgRating: 4.5, reviewCount: 20 });
			EmployeeJobAssignment.count.mockResolvedValue(25); // Above 20 threshold

			const result = await BusinessVerificationService.checkVerificationEligibility(1);

			expect(result.eligible).toBe(true);
			expect(result.criteria.activeClients.met).toBe(true);
			expect(result.criteria.averageRating.met).toBe(true);
			expect(result.criteria.accountStanding.met).toBe(true);
			expect(result.criteria.completedJobs.met).toBe(true);
			expect(result.businessName).toBe("CleanPro Services");
		});

		it("should return ineligible for insufficient clients", async () => {
			User.findByPk.mockResolvedValue(mockBusinessOwner);
			CleanerClient.count.mockResolvedValue(5); // Below 10 threshold
			UserReviews.findOne.mockResolvedValue({ avgRating: 4.5, reviewCount: 20 });
			EmployeeJobAssignment.count.mockResolvedValue(25);

			const result = await BusinessVerificationService.checkVerificationEligibility(1);

			expect(result.eligible).toBe(false);
			expect(result.criteria.activeClients.met).toBe(false);
			expect(result.criteria.activeClients.current).toBe(5);
			expect(result.criteria.activeClients.required).toBe(10);
			expect(result.reason).toContain("more active clients");
		});

		it("should return ineligible for low rating", async () => {
			User.findByPk.mockResolvedValue(mockBusinessOwner);
			CleanerClient.count.mockResolvedValue(15);
			UserReviews.findOne.mockResolvedValue({ avgRating: 3.5, reviewCount: 20 }); // Below 4.0
			EmployeeJobAssignment.count.mockResolvedValue(25);

			const result = await BusinessVerificationService.checkVerificationEligibility(1);

			expect(result.eligible).toBe(false);
			expect(result.criteria.averageRating.met).toBe(false);
			expect(result.reason).toContain("below");
		});

		it("should return ineligible for no reviews", async () => {
			User.findByPk.mockResolvedValue(mockBusinessOwner);
			CleanerClient.count.mockResolvedValue(15);
			UserReviews.findOne.mockResolvedValue({ avgRating: null, reviewCount: 0 });
			EmployeeJobAssignment.count.mockResolvedValue(25);

			const result = await BusinessVerificationService.checkVerificationEligibility(1);

			expect(result.eligible).toBe(false);
			expect(result.criteria.averageRating.met).toBe(false);
			expect(result.reason).toContain("Not enough reviews");
		});

		it("should return ineligible for frozen account", async () => {
			User.findByPk.mockResolvedValue({ ...mockBusinessOwner, accountFrozen: true });
			CleanerClient.count.mockResolvedValue(15);
			UserReviews.findOne.mockResolvedValue({ avgRating: 4.5, reviewCount: 20 });
			EmployeeJobAssignment.count.mockResolvedValue(25);

			const result = await BusinessVerificationService.checkVerificationEligibility(1);

			expect(result.eligible).toBe(false);
			expect(result.reason).toBe("Account is frozen");
		});

		it("should return ineligible for insufficient completed jobs", async () => {
			User.findByPk.mockResolvedValue(mockBusinessOwner);
			CleanerClient.count.mockResolvedValue(15);
			UserReviews.findOne.mockResolvedValue({ avgRating: 4.5, reviewCount: 20 });
			EmployeeJobAssignment.count.mockResolvedValue(10); // Below 20 threshold

			const result = await BusinessVerificationService.checkVerificationEligibility(1);

			expect(result.eligible).toBe(false);
			expect(result.criteria.completedJobs.met).toBe(false);
			expect(result.reason).toContain("more completed jobs");
		});

		it("should return error if user not found", async () => {
			User.findByPk.mockResolvedValue(null);

			const result = await BusinessVerificationService.checkVerificationEligibility(999);

			expect(result.eligible).toBe(false);
			expect(result.reason).toBe("User not found");
		});

		it("should return error if user is not business owner", async () => {
			User.findByPk.mockResolvedValue({ ...mockBusinessOwner, isBusinessOwner: false });

			const result = await BusinessVerificationService.checkVerificationEligibility(1);

			expect(result.eligible).toBe(false);
			expect(result.reason).toBe("User is not a business owner");
		});

		it("should indicate if already verified", async () => {
			User.findByPk.mockResolvedValue({
				...mockBusinessOwner,
				businessVerificationStatus: "verified",
			});
			CleanerClient.count.mockResolvedValue(15);
			UserReviews.findOne.mockResolvedValue({ avgRating: 4.5, reviewCount: 20 });
			EmployeeJobAssignment.count.mockResolvedValue(25);

			const result = await BusinessVerificationService.checkVerificationEligibility(1);

			expect(result.alreadyVerified).toBe(true);
		});
	});

	// =============================================
	// getVerificationStatus
	// =============================================
	describe("getVerificationStatus", () => {
		it("should return verification status for business owner", async () => {
			User.findByPk.mockResolvedValue({
				id: 1,
				firstName: "Jane",
				lastName: "Owner",
				isBusinessOwner: true,
				businessName: "CleanPro",
				yearsInBusiness: 5,
				businessVerificationStatus: "verified",
				businessVerifiedAt: new Date("2024-01-01"),
				businessDescription: "Professional cleaning",
				businessHighlightOptIn: true,
			});
			CleanerClient.count.mockResolvedValue(15);

			const result = await BusinessVerificationService.getVerificationStatus(1);

			expect(result.found).toBe(true);
			expect(result.isVerified).toBe(true);
			expect(result.verificationStatus).toBe("verified");
			expect(result.businessName).toBe("CleanPro");
			expect(result.activeClientCount).toBe(15);
			expect(result.highlightOptIn).toBe(true);
		});

		it("should return found: false for non-existent user", async () => {
			User.findByPk.mockResolvedValue(null);

			const result = await BusinessVerificationService.getVerificationStatus(999);

			expect(result.found).toBe(false);
		});

		it("should handle null verification status", async () => {
			User.findByPk.mockResolvedValue({
				id: 1,
				isBusinessOwner: true,
				businessVerificationStatus: null,
				businessVerifiedAt: null,
				businessHighlightOptIn: null,
			});
			CleanerClient.count.mockResolvedValue(0);

			const result = await BusinessVerificationService.getVerificationStatus(1);

			expect(result.verificationStatus).toBe("none");
			expect(result.verifiedAt).toBeNull();
			expect(result.highlightOptIn).toBe(false);
		});
	});

	// =============================================
	// requestVerification
	// =============================================
	describe("requestVerification", () => {
		const mockUser = {
			id: 1,
			isBusinessOwner: true,
			businessVerificationStatus: "none",
			accountFrozen: false,
			update: jest.fn().mockResolvedValue(true),
		};

		it("should submit verification request for eligible business", async () => {
			User.findByPk.mockResolvedValue(mockUser);
			CleanerClient.count.mockResolvedValue(15);
			UserReviews.findOne.mockResolvedValue({ avgRating: 4.5, reviewCount: 20 });
			EmployeeJobAssignment.count.mockResolvedValue(25);

			const result = await BusinessVerificationService.requestVerification(1);

			expect(result.success).toBe(true);
			expect(result.status).toBe("pending");
			expect(mockUser.update).toHaveBeenCalledWith({
				businessVerificationStatus: "pending",
			});
		});

		it("should reject if already verified", async () => {
			User.findByPk.mockResolvedValue({
				...mockUser,
				businessVerificationStatus: "verified",
			});
			CleanerClient.count.mockResolvedValue(15);
			UserReviews.findOne.mockResolvedValue({ avgRating: 4.5, reviewCount: 20 });
			EmployeeJobAssignment.count.mockResolvedValue(25);

			const result = await BusinessVerificationService.requestVerification(1);

			expect(result.success).toBe(false);
			expect(result.error).toBe("Business is already verified");
		});

		it("should reject if not eligible", async () => {
			User.findByPk.mockResolvedValue(mockUser);
			CleanerClient.count.mockResolvedValue(5); // Not enough clients

			const result = await BusinessVerificationService.requestVerification(1);

			expect(result.success).toBe(false);
			expect(result.error).toBe("Business does not meet verification criteria");
			expect(result.criteria).toBeDefined();
		});
	});

	// =============================================
	// updateVerificationStatus
	// =============================================
	describe("updateVerificationStatus", () => {
		const mockUser = {
			id: 1,
			isBusinessOwner: true,
			update: jest.fn().mockResolvedValue(true),
		};

		it("should update status to verified", async () => {
			User.findByPk.mockResolvedValue(mockUser);

			const result = await BusinessVerificationService.updateVerificationStatus(
				1,
				"verified",
				100,
				"Approved after review"
			);

			expect(result.success).toBe(true);
			expect(result.newStatus).toBe("verified");
			expect(mockUser.update).toHaveBeenCalledWith(
				expect.objectContaining({
					businessVerificationStatus: "verified",
					businessVerifiedAt: expect.any(Date),
				})
			);
		});

		it("should update status to none (revoke)", async () => {
			User.findByPk.mockResolvedValue(mockUser);

			const result = await BusinessVerificationService.updateVerificationStatus(
				1,
				"none",
				100,
				"Revoked due to policy violation"
			);

			expect(result.success).toBe(true);
			expect(result.newStatus).toBe("none");
			expect(mockUser.update).toHaveBeenCalledWith(
				expect.objectContaining({
					businessVerificationStatus: "none",
					businessVerifiedAt: null,
				})
			);
		});

		it("should throw error for invalid status", async () => {
			await expect(
				BusinessVerificationService.updateVerificationStatus(1, "invalid", 100)
			).rejects.toThrow("Invalid status");
		});

		it("should throw error if user not found", async () => {
			User.findByPk.mockResolvedValue(null);

			await expect(
				BusinessVerificationService.updateVerificationStatus(999, "verified", 100)
			).rejects.toThrow("User not found");
		});

		it("should throw error if user is not business owner", async () => {
			User.findByPk.mockResolvedValue({ id: 1, isBusinessOwner: false });

			await expect(
				BusinessVerificationService.updateVerificationStatus(1, "verified", 100)
			).rejects.toThrow("User is not a business owner");
		});
	});

	// =============================================
	// isVerifiedBusiness
	// =============================================
	describe("isVerifiedBusiness", () => {
		it("should return true for verified business", async () => {
			User.findByPk.mockResolvedValue({
				isBusinessOwner: true,
				businessVerificationStatus: "verified",
				accountFrozen: false,
			});

			const result = await BusinessVerificationService.isVerifiedBusiness(1);

			expect(result).toBe(true);
		});

		it("should return false for unverified business", async () => {
			User.findByPk.mockResolvedValue({
				isBusinessOwner: true,
				businessVerificationStatus: "none",
				accountFrozen: false,
			});

			const result = await BusinessVerificationService.isVerifiedBusiness(1);

			expect(result).toBe(false);
		});

		it("should return false for frozen account", async () => {
			User.findByPk.mockResolvedValue({
				isBusinessOwner: true,
				businessVerificationStatus: "verified",
				accountFrozen: true,
			});

			const result = await BusinessVerificationService.isVerifiedBusiness(1);

			expect(result).toBe(false);
		});

		it("should return false for non-business owner", async () => {
			User.findByPk.mockResolvedValue({
				isBusinessOwner: false,
				businessVerificationStatus: "verified",
				accountFrozen: false,
			});

			const result = await BusinessVerificationService.isVerifiedBusiness(1);

			expect(result).toBe(false);
		});

		it("should return false for non-existent user", async () => {
			User.findByPk.mockResolvedValue(null);

			const result = await BusinessVerificationService.isVerifiedBusiness(999);

			expect(result).toBe(false);
		});
	});

	// =============================================
	// getVerifiedBusinesses
	// =============================================
	describe("getVerifiedBusinesses", () => {
		const mockBusinesses = [
			{
				id: 1,
				firstName: "Jane",
				lastName: "Owner",
				businessName: "CleanPro",
				yearsInBusiness: 5,
				businessDescription: "Pro cleaning",
				businessVerifiedAt: new Date("2024-01-01"),
				serviceAreaLatitude: 40.7128,
				serviceAreaLongitude: -74.006,
				serviceAreaRadiusMiles: 25,
			},
			{
				id: 2,
				firstName: "John",
				lastName: "Boss",
				businessName: "SparkleClean",
				yearsInBusiness: 3,
				businessDescription: null,
				businessVerifiedAt: new Date("2024-02-01"),
				serviceAreaLatitude: 34.0522,
				serviceAreaLongitude: -118.2437,
				serviceAreaRadiusMiles: null,
			},
		];

		it("should return list of verified businesses", async () => {
			User.findAll.mockResolvedValue(mockBusinesses);
			CleanerClient.count.mockResolvedValue(12);

			const result = await BusinessVerificationService.getVerifiedBusinesses();

			expect(result.length).toBe(2);
			expect(result[0]).toHaveProperty("userId");
			expect(result[0]).toHaveProperty("businessName");
			expect(result[0]).toHaveProperty("activeClientCount");
			expect(result[0]).toHaveProperty("serviceArea");
		});

		it("should enrich with client counts", async () => {
			User.findAll.mockResolvedValue([mockBusinesses[0]]);
			CleanerClient.count.mockResolvedValue(15);

			const result = await BusinessVerificationService.getVerifiedBusinesses();

			expect(result[0].activeClientCount).toBe(15);
		});

		it("should respect limit option", async () => {
			User.findAll.mockResolvedValue(mockBusinesses);
			CleanerClient.count.mockResolvedValue(10);

			await BusinessVerificationService.getVerifiedBusinesses({ limit: 10 });

			expect(User.findAll).toHaveBeenCalledWith(
				expect.objectContaining({ limit: 10 })
			);
		});

		it("should handle null service area radius", async () => {
			User.findAll.mockResolvedValue([mockBusinesses[1]]);
			CleanerClient.count.mockResolvedValue(10);

			const result = await BusinessVerificationService.getVerifiedBusinesses();

			expect(result[0].serviceArea.radiusMiles).toBe(30); // Default
		});
	});

	// =============================================
	// updateBusinessProfile
	// =============================================
	describe("updateBusinessProfile", () => {
		const mockUser = {
			id: 1,
			isBusinessOwner: true,
			businessDescription: "Old description",
			businessHighlightOptIn: true,
			update: jest.fn().mockResolvedValue(true),
		};

		it("should update business description", async () => {
			User.findByPk.mockResolvedValue(mockUser);

			const result = await BusinessVerificationService.updateBusinessProfile(1, {
				businessDescription: "New description",
			});

			expect(result.success).toBe(true);
			expect(mockUser.update).toHaveBeenCalledWith({
				businessDescription: "New description",
			});
		});

		it("should update highlight opt-in", async () => {
			User.findByPk.mockResolvedValue(mockUser);

			const result = await BusinessVerificationService.updateBusinessProfile(1, {
				businessHighlightOptIn: false,
			});

			expect(result.success).toBe(true);
			expect(mockUser.update).toHaveBeenCalledWith({
				businessHighlightOptIn: false,
			});
		});

		it("should update both fields", async () => {
			User.findByPk.mockResolvedValue(mockUser);

			await BusinessVerificationService.updateBusinessProfile(1, {
				businessDescription: "New description",
				businessHighlightOptIn: false,
			});

			expect(mockUser.update).toHaveBeenCalledWith({
				businessDescription: "New description",
				businessHighlightOptIn: false,
			});
		});

		it("should throw error if user not found", async () => {
			User.findByPk.mockResolvedValue(null);

			await expect(
				BusinessVerificationService.updateBusinessProfile(999, {
					businessDescription: "Test",
				})
			).rejects.toThrow("User not found");
		});

		it("should throw error if not business owner", async () => {
			User.findByPk.mockResolvedValue({ id: 1, isBusinessOwner: false });

			await expect(
				BusinessVerificationService.updateBusinessProfile(1, {
					businessDescription: "Test",
				})
			).rejects.toThrow("User is not a business owner");
		});
	});

	// =============================================
	// getVerificationConfig
	// =============================================
	describe("getVerificationConfig", () => {
		it("should return verification configuration", () => {
			const config = BusinessVerificationService.getVerificationConfig();

			expect(config).toHaveProperty("minActiveClients");
			expect(config).toHaveProperty("minAverageRating");
			expect(config).toHaveProperty("minCompletedJobs");
			expect(config).toHaveProperty("ratingLookbackMonths");
			expect(config.minActiveClients).toBe(10);
			expect(config.minAverageRating).toBe(4.0);
		});

		it("should return a copy, not the original object", () => {
			const config1 = BusinessVerificationService.getVerificationConfig();
			const config2 = BusinessVerificationService.getVerificationConfig();

			config1.minActiveClients = 999;
			expect(config2.minActiveClients).toBe(10);
		});
	});
});
