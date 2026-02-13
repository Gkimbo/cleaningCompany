// Mock BusinessVolumeService
jest.mock("../../services/BusinessVolumeService", () => ({
	qualifiesForLargeBusinessFee: jest.fn(),
	getBusinessFee: jest.fn(),
	getMonthlyQualificationHistory: jest.fn(),
}));

// Mock models
jest.mock("../../models", () => {
	const { Op } = require("sequelize");
	return {
		EmployeeJobAssignment: {
			findAll: jest.fn(),
			count: jest.fn(),
		},
		UserAppointments: {
			findAll: jest.fn(),
		},
		BusinessEmployee: {
			findAll: jest.fn(),
			count: jest.fn(),
		},
		CleanerClient: {
			findAll: jest.fn(),
			count: jest.fn(),
		},
		UserReviews: {
			findAll: jest.fn(),
			findOne: jest.fn(),
		},
		User: {
			findByPk: jest.fn(),
		},
		PricingConfig: {
			getActive: jest.fn(),
		},
		sequelize: {
			fn: jest.fn(),
			col: jest.fn(),
			Sequelize: { Op },
		},
	};
});

const BusinessAnalyticsService = require("../../services/BusinessAnalyticsService");
const BusinessVolumeService = require("../../services/BusinessVolumeService");
const {
	EmployeeJobAssignment,
	BusinessEmployee,
	CleanerClient,
	UserReviews,
	PricingConfig,
	UserAppointments,
} = require("../../models");

describe("BusinessAnalyticsService", () => {
	beforeEach(() => {
		jest.clearAllMocks();
	});

	// =============================================
	// getAnalyticsAccess
	// =============================================
	describe("getAnalyticsAccess", () => {
		it("should return premium tier for qualifying business", async () => {
			BusinessVolumeService.qualifiesForLargeBusinessFee.mockResolvedValue({
				qualifies: true,
				totalCleanings: 55,
				threshold: 50,
				cleaningsNeeded: 0,
			});
			BusinessVolumeService.getMonthlyQualificationHistory.mockResolvedValue([
				{ month: "2024-01", qualified: true, cleanings: 55 },
				{ month: "2024-02", qualified: true, cleanings: 60 },
			]);

			const result = await BusinessAnalyticsService.getAnalyticsAccess(1);

			expect(result.tier).toBe("premium");
			expect(result.features.basicMetrics).toBe(true);
			expect(result.features.employeeAnalytics).toBe(true);
			expect(result.features.clientInsights).toBe(true);
			expect(result.features.advancedFinancials).toBe(true);
			expect(result.features.exportReports).toBe(true);
			expect(result.qualification.currentCleanings).toBe(55);
		});

		it("should return standard tier for non-qualifying business", async () => {
			BusinessVolumeService.qualifiesForLargeBusinessFee.mockResolvedValue({
				qualifies: false,
				totalCleanings: 20,
				threshold: 50,
				cleaningsNeeded: 30,
			});
			BusinessVolumeService.getMonthlyQualificationHistory.mockResolvedValue([
				{ month: "2024-01", qualified: false, cleanings: 20 },
			]);

			const result = await BusinessAnalyticsService.getAnalyticsAccess(1);

			expect(result.tier).toBe("standard");
			expect(result.features.basicMetrics).toBe(true);
			expect(result.features.employeeAnalytics).toBe(false);
			expect(result.features.clientInsights).toBe(false);
			expect(result.features.advancedFinancials).toBe(false);
			expect(result.qualification.cleaningsNeeded).toBe(30);
		});
	});

	// =============================================
	// getOverviewAnalytics
	// =============================================
	describe("getOverviewAnalytics", () => {
		const mockAssignments = [
			{
				id: 1,
				status: "completed",
				appointment: { id: 1, date: "2024-01-15", price: "150.00" },
			},
			{
				id: 2,
				status: "completed",
				appointment: { id: 2, date: "2024-01-16", price: "200.00" },
			},
		];

		beforeEach(() => {
			EmployeeJobAssignment.findAll.mockResolvedValue(mockAssignments);
			BusinessEmployee.count.mockResolvedValue(5);
			CleanerClient.count.mockResolvedValue(10);
		});

		it("should return overview metrics", async () => {
			const result = await BusinessAnalyticsService.getOverviewAnalytics(1);

			expect(result).toHaveProperty("bookings");
			expect(result).toHaveProperty("revenue");
			expect(result).toHaveProperty("averageJobValue");
			expect(result).toHaveProperty("activeEmployees");
			expect(result).toHaveProperty("activeClients");
			expect(result).toHaveProperty("generatedAt");
		});

		it("should calculate booking counts correctly", async () => {
			EmployeeJobAssignment.findAll
				.mockResolvedValueOnce(mockAssignments) // this month
				.mockResolvedValueOnce([mockAssignments[0]]) // last month
				.mockResolvedValueOnce(mockAssignments) // this week
				.mockResolvedValueOnce([]); // today

			const result = await BusinessAnalyticsService.getOverviewAnalytics(1);

			expect(result.bookings.thisMonth).toBe(2);
			expect(result.bookings.lastMonth).toBe(1);
			expect(result.bookings.thisWeek).toBe(2);
			expect(result.bookings.today).toBe(0);
		});

		it("should calculate revenue correctly", async () => {
			EmployeeJobAssignment.findAll
				.mockResolvedValueOnce(mockAssignments) // this month: $350
				.mockResolvedValueOnce([mockAssignments[0]]) // last month: $150
				.mockResolvedValueOnce([]) // this week
				.mockResolvedValueOnce([]); // today

			const result = await BusinessAnalyticsService.getOverviewAnalytics(1);

			expect(result.revenue.thisMonth).toBe(35000); // $350 in cents
			expect(result.revenue.thisMonthFormatted).toBe("$350.00");
			expect(result.revenue.lastMonth).toBe(15000);
		});

		it("should calculate percentage change correctly", async () => {
			EmployeeJobAssignment.findAll
				.mockResolvedValueOnce(mockAssignments) // this month: 2 jobs, $350
				.mockResolvedValueOnce([mockAssignments[0]]) // last month: 1 job, $150
				.mockResolvedValueOnce([])
				.mockResolvedValueOnce([]);

			const result = await BusinessAnalyticsService.getOverviewAnalytics(1);

			// Booking change: (2-1)/1 * 100 = 100%
			expect(result.bookings.changePercent).toBe(100);
			// Revenue change: (35000-15000)/15000 * 100 = 133.3%
			expect(result.revenue.changePercent).toBeCloseTo(133.3, 0);
		});

		it("should handle zero values correctly", async () => {
			EmployeeJobAssignment.findAll.mockResolvedValue([]);

			const result = await BusinessAnalyticsService.getOverviewAnalytics(1);

			expect(result.bookings.thisMonth).toBe(0);
			expect(result.revenue.thisMonth).toBe(0);
			expect(result.averageJobValue).toBe(0);
		});
	});

	// =============================================
	// getEmployeeAnalytics
	// =============================================
	describe("getEmployeeAnalytics", () => {
		const mockEmployees = [
			{
				id: 1,
				userId: 101,
				firstName: "Jane",
				lastName: "Doe",
				status: "active",
				maxJobsPerDay: 3,
			},
			{
				id: 2,
				userId: 102,
				firstName: "John",
				lastName: "Smith",
				status: "active",
				maxJobsPerDay: 4,
			},
		];

		const mockAssignments = [
			{
				id: 1,
				businessEmployeeId: 1,
				status: "completed",
				payAmount: 5000,
				appointmentId: 100,
				appointment: { id: 100, date: "2024-01-15", price: "150.00", userId: 10 },
			},
			{
				id: 2,
				businessEmployeeId: 1,
				status: "completed",
				payAmount: 6000,
				appointmentId: 101,
				appointment: { id: 101, date: "2024-01-16", price: "200.00", userId: 11 },
			},
			{
				id: 3,
				businessEmployeeId: 2,
				status: "no_show",
				payAmount: 0,
				appointmentId: 102,
				appointment: { id: 102, date: "2024-01-17", price: "175.00", userId: 12 },
			},
		];

		beforeEach(() => {
			BusinessEmployee.findAll.mockResolvedValue(mockEmployees);
			// Mock findAll to filter by businessEmployeeId when present in where clause
			EmployeeJobAssignment.findAll.mockImplementation((options) => {
				if (options?.where?.businessEmployeeId) {
					return Promise.resolve(
						mockAssignments.filter(a => a.businessEmployeeId === options.where.businessEmployeeId)
					);
				}
				return Promise.resolve(mockAssignments);
			});
			UserReviews.findAll.mockResolvedValue([{ rating: 5 }, { rating: 4 }]);
		});

		it("should return employee performance data", async () => {
			const result = await BusinessAnalyticsService.getEmployeeAnalytics(1);

			expect(result).toHaveProperty("employees");
			expect(result).toHaveProperty("teamTotals");
			expect(result).toHaveProperty("periodMonths");
			expect(result.employees).toBeInstanceOf(Array);
		});

		it("should rank employees by jobs completed", async () => {
			const result = await BusinessAnalyticsService.getEmployeeAnalytics(1);

			// Employee 1 has 2 completed jobs, Employee 2 has 0 completed
			expect(result.employees[0].jobsCompleted).toBeGreaterThanOrEqual(
				result.employees[1]?.jobsCompleted || 0
			);
		});

		it("should calculate completion rate correctly", async () => {
			// Employee 1: 2 completed out of 2 = 100%
			// Employee 2: 0 completed out of 1 (no_show) = 0%
			const result = await BusinessAnalyticsService.getEmployeeAnalytics(1);

			const emp1 = result.employees.find(e => e.employeeId === 101);
			expect(emp1?.completionRate).toBe(100);
		});

		it("should calculate on-time rate correctly", async () => {
			// Employee 2 has 1 no_show out of 1 = 0% on-time
			const result = await BusinessAnalyticsService.getEmployeeAnalytics(1);

			const emp2 = result.employees.find(e => e.employeeId === 102);
			// On-time = (total - noShows) / total * 100
			expect(emp2?.onTimeRate).toBeDefined();
		});

		it("should include average ratings when available", async () => {
			UserReviews.findAll.mockResolvedValue([{ rating: 5 }, { rating: 4 }]);

			const result = await BusinessAnalyticsService.getEmployeeAnalytics(1);

			const empWithRating = result.employees.find(e => e.avgRating !== null);
			expect(empWithRating?.avgRating).toBeCloseTo(4.5, 1);
		});

		it("should calculate team totals", async () => {
			const result = await BusinessAnalyticsService.getEmployeeAnalytics(1);

			expect(result.teamTotals).toHaveProperty("totalJobs");
			expect(result.teamTotals).toHaveProperty("totalRevenue");
			expect(result.teamTotals).toHaveProperty("totalPay");
			expect(result.teamTotals).toHaveProperty("avgCompletionRate");
		});

		it("should respect limit option", async () => {
			const result = await BusinessAnalyticsService.getEmployeeAnalytics(1, { limit: 1 });

			expect(result.employees.length).toBeLessThanOrEqual(1);
		});
	});

	// =============================================
	// getClientAnalytics
	// =============================================
	describe("getClientAnalytics", () => {
		const mockClients = [
			{
				id: 1,
				cleanerId: 1,
				clientId: 10,
				status: "active",
				acceptedAt: new Date(),
				client: { id: 10, firstName: "Alice", lastName: "Client" },
			},
			{
				id: 2,
				cleanerId: 1,
				clientId: 11,
				status: "active",
				acceptedAt: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000), // 90 days ago
				client: { id: 11, firstName: "Bob", lastName: "Customer" },
			},
			{
				id: 3,
				cleanerId: 1,
				clientId: null,
				status: "pending_invite",
				invitedName: "Pending Client",
			},
		];

		beforeEach(() => {
			CleanerClient.findAll.mockResolvedValue(mockClients);
			// Mock appointments for each active client
			UserAppointments.findAll.mockResolvedValue([
				{ id: 1, date: new Date(), price: "100.00" },
				{ id: 2, date: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), price: "150.00" },
			]);
		});

		it("should return client analytics data", async () => {
			const result = await BusinessAnalyticsService.getClientAnalytics(1);

			expect(result).toHaveProperty("totalClients");
			expect(result).toHaveProperty("statusBreakdown");
			expect(result).toHaveProperty("newClientsThisMonth");
			expect(result).toHaveProperty("topClients");
			expect(result).toHaveProperty("atRiskClients");
			expect(result).toHaveProperty("metrics");
		});

		it("should calculate status breakdown correctly", async () => {
			const result = await BusinessAnalyticsService.getClientAnalytics(1);

			expect(result.statusBreakdown.active).toBe(2);
			expect(result.statusBreakdown.pending).toBe(1);
		});

		it("should identify at-risk clients", async () => {
			const result = await BusinessAnalyticsService.getClientAnalytics(1, { churnDays: 60 });

			expect(result.atRiskClients).toBeDefined();
			expect(result.churnThresholdDays).toBe(60);
		});

		it("should calculate retention rate", async () => {
			const result = await BusinessAnalyticsService.getClientAnalytics(1);

			expect(result.metrics.retentionRate).toBeDefined();
			expect(typeof result.metrics.retentionRate).toBe("number");
		});

		it("should calculate booking frequency distribution", async () => {
			const result = await BusinessAnalyticsService.getClientAnalytics(1);

			expect(result.metrics.bookingFrequency).toHaveProperty("oneTime");
			expect(result.metrics.bookingFrequency).toHaveProperty("occasional");
			expect(result.metrics.bookingFrequency).toHaveProperty("regular");
			expect(result.metrics.bookingFrequency).toHaveProperty("frequent");
		});

		it("should respect topClientsLimit option", async () => {
			const result = await BusinessAnalyticsService.getClientAnalytics(1, { topClientsLimit: 5 });

			expect(result.topClients.length).toBeLessThanOrEqual(5);
		});
	});

	// =============================================
	// getFinancialAnalytics
	// =============================================
	describe("getFinancialAnalytics", () => {
		const mockAssignments = [
			{
				id: 1,
				status: "completed",
				payAmount: 5000,
				payoutStatus: "paid",
				appointment: { id: 1, date: "2024-01-15", price: "150.00" },
			},
			{
				id: 2,
				status: "completed",
				payAmount: 6000,
				payoutStatus: "pending",
				appointment: { id: 2, date: "2024-01-16", price: "200.00" },
			},
		];

		beforeEach(() => {
			PricingConfig.getActive.mockResolvedValue({ platformFeePercent: 10 });
			BusinessVolumeService.getBusinessFee.mockResolvedValue({
				feePercent: 0.10,
				feeTier: "standard",
				qualifies: false,
				cleaningsNeeded: 30,
			});
			EmployeeJobAssignment.findAll.mockResolvedValue(mockAssignments);
		});

		it("should return financial summary", async () => {
			const result = await BusinessAnalyticsService.getFinancialAnalytics(1);

			expect(result).toHaveProperty("summary");
			expect(result).toHaveProperty("payrollStatus");
			expect(result).toHaveProperty("feeTier");
			expect(result).toHaveProperty("monthlyBreakdown");
		});

		it("should calculate gross revenue correctly", async () => {
			const result = await BusinessAnalyticsService.getFinancialAnalytics(1);

			// $150 + $200 = $350 = 35000 cents
			expect(result.summary.grossRevenue).toBe(35000);
			expect(result.summary.grossRevenueFormatted).toBe("$350.00");
		});

		it("should calculate platform fees correctly", async () => {
			const result = await BusinessAnalyticsService.getFinancialAnalytics(1);

			// 10% of $350 = $35 = 3500 cents
			expect(result.summary.platformFees).toBe(3500);
			expect(result.summary.platformFeePercent).toBe(10);
		});

		it("should calculate net profit correctly", async () => {
			const result = await BusinessAnalyticsService.getFinancialAnalytics(1);

			// Gross: 35000, Fees: 3500, Payroll: 11000
			// Net Profit = 35000 - 3500 - 11000 = 20500
			expect(result.summary.totalPayroll).toBe(11000);
			expect(result.summary.netProfit).toBe(20500);
		});

		it("should break down payroll by status", async () => {
			const result = await BusinessAnalyticsService.getFinancialAnalytics(1);

			expect(result.payrollStatus.paid).toBe(5000);
			expect(result.payrollStatus.pending).toBe(6000);
			expect(result.payrollStatus.pendingCount).toBe(1);
		});

		it("should include fee tier information", async () => {
			const result = await BusinessAnalyticsService.getFinancialAnalytics(1);

			expect(result.feeTier.current).toBe("standard");
			expect(result.feeTier.feePercent).toBe(10);
			expect(result.feeTier.qualifiesForDiscount).toBe(false);
		});

		it("should include monthly breakdown", async () => {
			const result = await BusinessAnalyticsService.getFinancialAnalytics(1, { months: 6 });

			expect(result.monthlyBreakdown).toBeInstanceOf(Array);
			expect(result.periodMonths).toBe(6);
		});
	});

	// =============================================
	// getTrends
	// =============================================
	describe("getTrends", () => {
		const mockAssignments = [
			{
				id: 1,
				status: "completed",
				appointment: { id: 1, date: "2024-01-15", price: "150.00" },
			},
			{
				id: 2,
				status: "completed",
				appointment: { id: 2, date: "2024-02-10", price: "200.00" },
			},
		];

		beforeEach(() => {
			EmployeeJobAssignment.findAll.mockResolvedValue(mockAssignments);
		});

		it("should return monthly trend data", async () => {
			const result = await BusinessAnalyticsService.getTrends(1, { period: "monthly", months: 6 });

			expect(result.period).toBe("monthly");
			expect(result.data).toBeInstanceOf(Array);
			expect(result.data.length).toBeLessThanOrEqual(6);
		});

		it("should return weekly trend data", async () => {
			const result = await BusinessAnalyticsService.getTrends(1, { period: "weekly", months: 3 });

			expect(result.period).toBe("weekly");
			expect(result.data).toBeInstanceOf(Array);
		});

		it("should include booking count and revenue per period", async () => {
			const result = await BusinessAnalyticsService.getTrends(1, { period: "monthly" });

			if (result.data.length > 0) {
				expect(result.data[0]).toHaveProperty("bookings");
				expect(result.data[0]).toHaveProperty("revenue");
				expect(result.data[0]).toHaveProperty("period");
				expect(result.data[0]).toHaveProperty("periodKey");
			}
		});

		it("should include formatted revenue", async () => {
			const result = await BusinessAnalyticsService.getTrends(1);

			if (result.data.length > 0) {
				expect(result.data[0]).toHaveProperty("revenueFormatted");
				expect(result.data[0].revenueFormatted).toMatch(/^\$[\d,]+\.\d{2}$/);
			}
		});
	});

	// =============================================
	// getAllAnalytics
	// =============================================
	describe("getAllAnalytics", () => {
		beforeEach(() => {
			BusinessVolumeService.qualifiesForLargeBusinessFee.mockResolvedValue({
				qualifies: true,
				totalCleanings: 55,
				threshold: 50,
				cleaningsNeeded: 0,
			});
			BusinessVolumeService.getMonthlyQualificationHistory.mockResolvedValue([
				{ month: "2024-01", qualified: true, cleanings: 55 },
			]);
			BusinessVolumeService.getBusinessFee.mockResolvedValue({
				feePercent: 0.07,
				feeTier: "large",
				qualifies: true,
			});
			EmployeeJobAssignment.findAll.mockResolvedValue([]);
			BusinessEmployee.findAll.mockResolvedValue([]);
			BusinessEmployee.count.mockResolvedValue(0);
			CleanerClient.findAll.mockResolvedValue([]);
			CleanerClient.count.mockResolvedValue(0);
			PricingConfig.getActive.mockResolvedValue({ platformFeePercent: 7 });
		});

		it("should return all analytics for premium tier", async () => {
			const result = await BusinessAnalyticsService.getAllAnalytics(1);

			expect(result).toHaveProperty("access");
			expect(result).toHaveProperty("overview");
			expect(result).toHaveProperty("employees");
			expect(result).toHaveProperty("clients");
			expect(result).toHaveProperty("financials");
			expect(result).toHaveProperty("trends");
			expect(result.access.tier).toBe("premium");
		});

		it("should return limited analytics for standard tier", async () => {
			BusinessVolumeService.qualifiesForLargeBusinessFee.mockResolvedValue({
				qualifies: false,
				totalCleanings: 20,
				threshold: 50,
				cleaningsNeeded: 30,
			});

			const result = await BusinessAnalyticsService.getAllAnalytics(1);

			expect(result).toHaveProperty("access");
			expect(result).toHaveProperty("overview");
			expect(result).toHaveProperty("trends");
			expect(result).not.toHaveProperty("employees");
			expect(result).not.toHaveProperty("clients");
			// Financials are now available to all tiers
			expect(result).toHaveProperty("financials");
			expect(result.access.tier).toBe("standard");
		});

		it("should limit trends months for standard tier", async () => {
			BusinessVolumeService.qualifiesForLargeBusinessFee.mockResolvedValue({
				qualifies: false,
				totalCleanings: 20,
				threshold: 50,
				cleaningsNeeded: 30,
			});

			const result = await BusinessAnalyticsService.getAllAnalytics(1);

			// Standard tier gets 6 months max
			expect(result.trends.data.length).toBeLessThanOrEqual(6);
		});
	});
});
