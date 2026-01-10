/**
 * Comprehensive Tests for Business Owner Analytics & Verification Routes
 * Tests all API endpoints for business analytics and verification
 */

const request = require("supertest");
const express = require("express");

// Mock authentication middleware
jest.mock("../../middleware/verifyBusinessOwner", () => (req, res, next) => {
	req.user = { id: 1 };
	req.businessOwnerId = 1;
	next();
});

// Mock BusinessAnalyticsService
const mockGetAnalyticsAccess = jest.fn();
const mockGetOverviewAnalytics = jest.fn();
const mockGetEmployeeAnalytics = jest.fn();
const mockGetClientAnalytics = jest.fn();
const mockGetFinancialAnalytics = jest.fn();
const mockGetTrends = jest.fn();
const mockGetAllAnalytics = jest.fn();

jest.mock("../../services/BusinessAnalyticsService", () => ({
	getAnalyticsAccess: (...args) => mockGetAnalyticsAccess(...args),
	getOverviewAnalytics: (...args) => mockGetOverviewAnalytics(...args),
	getEmployeeAnalytics: (...args) => mockGetEmployeeAnalytics(...args),
	getClientAnalytics: (...args) => mockGetClientAnalytics(...args),
	getFinancialAnalytics: (...args) => mockGetFinancialAnalytics(...args),
	getTrends: (...args) => mockGetTrends(...args),
	getAllAnalytics: (...args) => mockGetAllAnalytics(...args),
}));

// Mock BusinessVerificationService
const mockGetVerificationStatus = jest.fn();
const mockCheckVerificationEligibility = jest.fn();
const mockRequestVerification = jest.fn();
const mockUpdateBusinessProfile = jest.fn();
const mockGetVerificationConfig = jest.fn();

jest.mock("../../services/BusinessVerificationService", () => ({
	getVerificationStatus: (...args) => mockGetVerificationStatus(...args),
	checkVerificationEligibility: (...args) => mockCheckVerificationEligibility(...args),
	requestVerification: (...args) => mockRequestVerification(...args),
	updateBusinessProfile: (...args) => mockUpdateBusinessProfile(...args),
	getVerificationConfig: (...args) => mockGetVerificationConfig(...args),
}));

// Mock BusinessVolumeService and other dependencies
jest.mock("../../services/BusinessVolumeService", () => ({}));
jest.mock("../../services/BusinessEmployeeService", () => ({}));
jest.mock("../../services/EmployeeJobAssignmentService", () => ({}));
jest.mock("../../models", () => ({
	User: { findByPk: jest.fn() },
	BusinessEmployee: { findAll: jest.fn() },
}));

const businessOwnerRouter = require("../../routes/api/v1/businessOwnerRouter");

// Create test app
const app = express();
app.use(express.json());
app.use("/api/v1/business-owner", businessOwnerRouter);

describe("Business Owner Analytics & Verification Router", () => {
	beforeEach(() => {
		jest.clearAllMocks();
	});

	// =============================================
	// Analytics Access Endpoint
	// =============================================
	describe("GET /api/v1/business-owner/analytics/access", () => {
		it("should return analytics access for premium tier", async () => {
			mockGetAnalyticsAccess.mockResolvedValue({
				tier: "premium",
				features: {
					basicMetrics: true,
					employeeAnalytics: true,
					clientInsights: true,
					advancedFinancials: true,
					exportReports: true,
				},
				qualification: {
					qualifies: true,
					totalCleanings: 55,
					threshold: 50,
				},
			});

			const response = await request(app)
				.get("/api/v1/business-owner/analytics/access")
				.expect(200);

			expect(response.body.tier).toBe("premium");
			expect(response.body.features.employeeAnalytics).toBe(true);
			expect(mockGetAnalyticsAccess).toHaveBeenCalledWith(1);
		});

		it("should return analytics access for standard tier", async () => {
			mockGetAnalyticsAccess.mockResolvedValue({
				tier: "standard",
				features: {
					basicMetrics: true,
					employeeAnalytics: false,
					clientInsights: false,
					advancedFinancials: false,
					exportReports: false,
				},
				qualification: {
					qualifies: false,
					totalCleanings: 25,
					threshold: 50,
					cleaningsNeeded: 25,
				},
			});

			const response = await request(app)
				.get("/api/v1/business-owner/analytics/access")
				.expect(200);

			expect(response.body.tier).toBe("standard");
			expect(response.body.features.employeeAnalytics).toBe(false);
		});

		it("should handle errors", async () => {
			mockGetAnalyticsAccess.mockRejectedValue(new Error("Database error"));

			const response = await request(app)
				.get("/api/v1/business-owner/analytics/access")
				.expect(500);

			expect(response.body.error).toBe("Database error");
		});
	});

	// =============================================
	// Analytics Overview Endpoint
	// =============================================
	describe("GET /api/v1/business-owner/analytics/overview", () => {
		it("should return overview analytics", async () => {
			mockGetOverviewAnalytics.mockResolvedValue({
				totalBookings: {
					total: 150,
					periodComparison: { current: 50, previous: 45, change: 11.1 },
				},
				totalRevenue: {
					totalCents: 750000,
					periodComparison: { current: 250000, previous: 220000, change: 13.6 },
				},
				averageJobValue: { averageCents: 5000 },
				completionRate: { rate: 96.5, completed: 145, total: 150 },
				teamSize: { totalEmployees: 5, activeEmployees: 4 },
			});

			const response = await request(app)
				.get("/api/v1/business-owner/analytics/overview")
				.expect(200);

			expect(response.body.totalBookings.total).toBe(150);
			expect(response.body.totalRevenue.totalCents).toBe(750000);
			expect(mockGetOverviewAnalytics).toHaveBeenCalledWith(1);
		});

		it("should handle errors", async () => {
			mockGetOverviewAnalytics.mockRejectedValue(new Error("Service unavailable"));

			const response = await request(app)
				.get("/api/v1/business-owner/analytics/overview")
				.expect(500);

			expect(response.body.error).toBe("Service unavailable");
		});
	});

	// =============================================
	// Employee Analytics Endpoint (Premium)
	// =============================================
	describe("GET /api/v1/business-owner/analytics/employees", () => {
		it("should return employee analytics for premium tier", async () => {
			mockGetAnalyticsAccess.mockResolvedValue({
				tier: "premium",
				features: { employeeAnalytics: true },
			});
			mockGetEmployeeAnalytics.mockResolvedValue({
				employees: [
					{
						employeeId: 1,
						name: "John Doe",
						jobsCompleted: 50,
						revenueGeneratedCents: 250000,
						averageRating: 4.8,
						completionRate: 98.5,
					},
				],
				summary: {
					totalEmployees: 5,
					avgJobsPerEmployee: 30,
					avgRevenuePerEmployee: 150000,
				},
			});

			const response = await request(app)
				.get("/api/v1/business-owner/analytics/employees")
				.expect(200);

			expect(response.body.employees).toHaveLength(1);
			expect(response.body.employees[0].name).toBe("John Doe");
			expect(mockGetEmployeeAnalytics).toHaveBeenCalledWith(1, expect.any(Object));
		});

		it("should return 403 for standard tier", async () => {
			mockGetAnalyticsAccess.mockResolvedValue({
				tier: "standard",
				features: { employeeAnalytics: false },
				qualification: { cleaningsNeeded: 25 },
			});

			const response = await request(app)
				.get("/api/v1/business-owner/analytics/employees")
				.expect(403);

			expect(response.body.error).toContain("premium tier");
			expect(response.body.tier).toBe("standard");
		});

		it("should respect query params", async () => {
			mockGetAnalyticsAccess.mockResolvedValue({
				tier: "premium",
				features: { employeeAnalytics: true },
			});
			mockGetEmployeeAnalytics.mockResolvedValue({ employees: [] });

			await request(app)
				.get("/api/v1/business-owner/analytics/employees?months=3&limit=10")
				.expect(200);

			expect(mockGetEmployeeAnalytics).toHaveBeenCalledWith(1, {
				months: 3,
				limit: 10,
			});
		});
	});

	// =============================================
	// Client Analytics Endpoint (Premium)
	// =============================================
	describe("GET /api/v1/business-owner/analytics/clients", () => {
		it("should return client analytics for premium tier", async () => {
			mockGetAnalyticsAccess.mockResolvedValue({
				tier: "premium",
				features: { clientInsights: true },
			});
			mockGetClientAnalytics.mockResolvedValue({
				totalActiveClients: 50,
				newClientsThisMonth: 8,
				retentionRate: 85.5,
				topClients: [
					{ id: 1, name: "Jane Smith", totalSpentCents: 150000, bookings: 25 },
				],
				churnRisk: [
					{ id: 2, name: "Bob Jones", daysSinceLastBooking: 45 },
				],
			});

			const response = await request(app)
				.get("/api/v1/business-owner/analytics/clients")
				.expect(200);

			expect(response.body.totalActiveClients).toBe(50);
			expect(response.body.topClients).toHaveLength(1);
			expect(mockGetClientAnalytics).toHaveBeenCalledWith(1, expect.any(Object));
		});

		it("should return 403 for standard tier", async () => {
			mockGetAnalyticsAccess.mockResolvedValue({
				tier: "standard",
				features: { clientInsights: false },
			});

			const response = await request(app)
				.get("/api/v1/business-owner/analytics/clients")
				.expect(403);

			expect(response.body.error).toContain("premium tier");
		});

		it("should respect query params", async () => {
			mockGetAnalyticsAccess.mockResolvedValue({
				tier: "premium",
				features: { clientInsights: true },
			});
			mockGetClientAnalytics.mockResolvedValue({});

			await request(app)
				.get("/api/v1/business-owner/analytics/clients?topClientsLimit=5&churnDays=30")
				.expect(200);

			expect(mockGetClientAnalytics).toHaveBeenCalledWith(1, {
				topClientsLimit: 5,
				churnDays: 30,
			});
		});
	});

	// =============================================
	// Financial Analytics Endpoint (Premium)
	// =============================================
	describe("GET /api/v1/business-owner/analytics/financials", () => {
		it("should return financial analytics for premium tier", async () => {
			mockGetAnalyticsAccess.mockResolvedValue({
				tier: "premium",
				features: { advancedFinancials: true },
			});
			mockGetFinancialAnalytics.mockResolvedValue({
				grossRevenueCents: 1000000,
				netRevenueCents: 900000,
				platformFeesCents: 100000,
				payrollCents: 500000,
				profitMargin: 40.0,
				outstandingPaymentsCents: 25000,
			});

			const response = await request(app)
				.get("/api/v1/business-owner/analytics/financials")
				.expect(200);

			expect(response.body.grossRevenueCents).toBe(1000000);
			expect(response.body.profitMargin).toBe(40.0);
		});

		it("should return 403 for standard tier", async () => {
			mockGetAnalyticsAccess.mockResolvedValue({
				tier: "standard",
				features: { advancedFinancials: false },
			});

			const response = await request(app)
				.get("/api/v1/business-owner/analytics/financials")
				.expect(403);

			expect(response.body.error).toContain("premium tier");
		});
	});

	// =============================================
	// Trends Endpoint
	// =============================================
	describe("GET /api/v1/business-owner/analytics/trends", () => {
		it("should return trends with default params", async () => {
			mockGetAnalyticsAccess.mockResolvedValue({
				tier: "standard",
			});
			mockGetTrends.mockResolvedValue({
				period: "monthly",
				months: 6,
				data: [
					{ month: "2024-01", revenue: 80000, bookings: 16 },
					{ month: "2024-02", revenue: 85000, bookings: 17 },
				],
			});

			const response = await request(app)
				.get("/api/v1/business-owner/analytics/trends")
				.expect(200);

			expect(response.body.access.tier).toBe("standard");
			expect(response.body.access.maxMonthsAllowed).toBe(6);
			expect(response.body.data).toHaveLength(2);
		});

		it("should limit months for standard tier", async () => {
			mockGetAnalyticsAccess.mockResolvedValue({ tier: "standard" });
			mockGetTrends.mockResolvedValue({ data: [] });

			await request(app)
				.get("/api/v1/business-owner/analytics/trends?months=24")
				.expect(200);

			// Should be capped at 6 for standard tier
			expect(mockGetTrends).toHaveBeenCalledWith(1, {
				period: "monthly",
				months: 6,
			});
		});

		it("should allow extended history for premium tier", async () => {
			mockGetAnalyticsAccess.mockResolvedValue({ tier: "premium" });
			mockGetTrends.mockResolvedValue({ data: [] });

			await request(app)
				.get("/api/v1/business-owner/analytics/trends?months=24")
				.expect(200);

			expect(mockGetTrends).toHaveBeenCalledWith(1, {
				period: "monthly",
				months: 24,
			});
		});

		it("should handle period param", async () => {
			mockGetAnalyticsAccess.mockResolvedValue({ tier: "premium" });
			mockGetTrends.mockResolvedValue({ data: [] });

			await request(app)
				.get("/api/v1/business-owner/analytics/trends?period=weekly&months=3")
				.expect(200);

			expect(mockGetTrends).toHaveBeenCalledWith(1, {
				period: "weekly",
				months: 3,
			});
		});
	});

	// =============================================
	// Verification Status Endpoint
	// =============================================
	describe("GET /api/v1/business-owner/verification/status", () => {
		it("should return verification status for verified business", async () => {
			mockGetVerificationStatus.mockResolvedValue({
				found: true,
				isVerified: true,
				verificationStatus: "verified",
				businessName: "CleanPro Services",
				yearsInBusiness: 5,
				activeClientCount: 15,
				verifiedAt: "2024-01-15T10:00:00.000Z",
				highlightOptIn: true,
			});

			const response = await request(app)
				.get("/api/v1/business-owner/verification/status")
				.expect(200);

			expect(response.body.isVerified).toBe(true);
			expect(response.body.businessName).toBe("CleanPro Services");
			expect(mockGetVerificationStatus).toHaveBeenCalledWith(1);
		});

		it("should return status for unverified business", async () => {
			mockGetVerificationStatus.mockResolvedValue({
				found: true,
				isVerified: false,
				verificationStatus: "none",
				businessName: "New Cleaning Co",
				activeClientCount: 5,
			});

			const response = await request(app)
				.get("/api/v1/business-owner/verification/status")
				.expect(200);

			expect(response.body.isVerified).toBe(false);
			expect(response.body.verificationStatus).toBe("none");
		});

		it("should handle errors", async () => {
			mockGetVerificationStatus.mockRejectedValue(new Error("Database error"));

			const response = await request(app)
				.get("/api/v1/business-owner/verification/status")
				.expect(500);

			expect(response.body.error).toBe("Database error");
		});
	});

	// =============================================
	// Verification Eligibility Endpoint
	// =============================================
	describe("GET /api/v1/business-owner/verification/eligibility", () => {
		it("should return eligible status", async () => {
			mockCheckVerificationEligibility.mockResolvedValue({
				eligible: true,
				criteria: {
					activeClients: { met: true, current: 15, required: 10 },
					averageRating: { met: true, current: 4.7, required: 4.0 },
					completedJobs: { met: true, current: 50, required: 20 },
					accountStanding: { met: true },
				},
				businessName: "CleanPro Services",
			});

			const response = await request(app)
				.get("/api/v1/business-owner/verification/eligibility")
				.expect(200);

			expect(response.body.eligible).toBe(true);
			expect(response.body.criteria.activeClients.met).toBe(true);
		});

		it("should return ineligible status with reasons", async () => {
			mockCheckVerificationEligibility.mockResolvedValue({
				eligible: false,
				criteria: {
					activeClients: { met: false, current: 5, required: 10 },
					averageRating: { met: true, current: 4.5, required: 4.0 },
					completedJobs: { met: false, current: 15, required: 20 },
					accountStanding: { met: true },
				},
				reason: "Need 5 more active clients and 5 more completed jobs",
			});

			const response = await request(app)
				.get("/api/v1/business-owner/verification/eligibility")
				.expect(200);

			expect(response.body.eligible).toBe(false);
			expect(response.body.reason).toContain("more active clients");
		});
	});

	// =============================================
	// Request Verification Endpoint
	// =============================================
	describe("POST /api/v1/business-owner/verification/request", () => {
		it("should submit verification request successfully", async () => {
			mockRequestVerification.mockResolvedValue({
				success: true,
				status: "pending",
				message: "Verification request submitted successfully",
			});

			const response = await request(app)
				.post("/api/v1/business-owner/verification/request")
				.expect(200);

			expect(response.body.success).toBe(true);
			expect(response.body.status).toBe("pending");
			expect(mockRequestVerification).toHaveBeenCalledWith(1);
		});

		it("should return 400 if already verified", async () => {
			mockRequestVerification.mockResolvedValue({
				success: false,
				error: "Business is already verified",
			});

			const response = await request(app)
				.post("/api/v1/business-owner/verification/request")
				.expect(400);

			expect(response.body.success).toBe(false);
			expect(response.body.error).toBe("Business is already verified");
		});

		it("should return 400 if not eligible", async () => {
			mockRequestVerification.mockResolvedValue({
				success: false,
				error: "Business does not meet verification criteria",
				criteria: {
					activeClients: { met: false, current: 5, required: 10 },
				},
			});

			const response = await request(app)
				.post("/api/v1/business-owner/verification/request")
				.expect(400);

			expect(response.body.success).toBe(false);
			expect(response.body.criteria).toBeDefined();
		});
	});

	// =============================================
	// Update Business Profile Endpoint
	// =============================================
	describe("PUT /api/v1/business-owner/verification/profile", () => {
		it("should update business description", async () => {
			mockUpdateBusinessProfile.mockResolvedValue({
				success: true,
				updated: { businessDescription: "Professional cleaning services" },
			});

			const response = await request(app)
				.put("/api/v1/business-owner/verification/profile")
				.send({ businessDescription: "Professional cleaning services" })
				.expect(200);

			expect(response.body.success).toBe(true);
			expect(mockUpdateBusinessProfile).toHaveBeenCalledWith(1, {
				businessDescription: "Professional cleaning services",
				businessHighlightOptIn: undefined,
			});
		});

		it("should update highlight opt-in", async () => {
			mockUpdateBusinessProfile.mockResolvedValue({
				success: true,
				updated: { businessHighlightOptIn: true },
			});

			const response = await request(app)
				.put("/api/v1/business-owner/verification/profile")
				.send({ businessHighlightOptIn: true })
				.expect(200);

			expect(response.body.success).toBe(true);
		});

		it("should update both fields", async () => {
			mockUpdateBusinessProfile.mockResolvedValue({
				success: true,
				updated: {
					businessDescription: "Best cleaners in town",
					businessHighlightOptIn: false,
				},
			});

			await request(app)
				.put("/api/v1/business-owner/verification/profile")
				.send({
					businessDescription: "Best cleaners in town",
					businessHighlightOptIn: false,
				})
				.expect(200);

			expect(mockUpdateBusinessProfile).toHaveBeenCalledWith(1, {
				businessDescription: "Best cleaners in town",
				businessHighlightOptIn: false,
			});
		});

		it("should handle errors", async () => {
			mockUpdateBusinessProfile.mockRejectedValue(new Error("Update failed"));

			const response = await request(app)
				.put("/api/v1/business-owner/verification/profile")
				.send({ businessDescription: "Test" })
				.expect(500);

			expect(response.body.error).toBe("Update failed");
		});
	});

	// =============================================
	// Verification Config Endpoint
	// =============================================
	describe("GET /api/v1/business-owner/verification/config", () => {
		it("should return verification configuration", async () => {
			mockGetVerificationConfig.mockReturnValue({
				minActiveClients: 10,
				minAverageRating: 4.0,
				minCompletedJobs: 20,
				ratingLookbackMonths: 6,
			});

			const response = await request(app)
				.get("/api/v1/business-owner/verification/config")
				.expect(200);

			expect(response.body.minActiveClients).toBe(10);
			expect(response.body.minAverageRating).toBe(4.0);
			expect(response.body.minCompletedJobs).toBe(20);
		});

		it("should handle errors", async () => {
			mockGetVerificationConfig.mockImplementation(() => {
				throw new Error("Config error");
			});

			const response = await request(app)
				.get("/api/v1/business-owner/verification/config")
				.expect(500);

			expect(response.body.error).toBe("Config error");
		});
	});
});
