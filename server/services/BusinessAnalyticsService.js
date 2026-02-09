/**
 * BusinessAnalyticsService
 *
 * Provides comprehensive analytics for business owners including:
 * - Revenue and booking metrics
 * - Employee performance rankings
 * - Client insights and retention
 * - Financial breakdowns
 *
 * Premium analytics are gated by volume tier (50+ cleanings/month)
 */

const { Op, fn, col, literal } = require("sequelize");
const BusinessVolumeService = require("./BusinessVolumeService");

class BusinessAnalyticsService {
	/**
	 * Check if a business owner has access to premium analytics
	 * @param {number} businessOwnerId - Business owner user ID
	 * @returns {Promise<Object>} Access tier and features
	 */
	static async getAnalyticsAccess(businessOwnerId) {
		const qualification = await BusinessVolumeService.qualifiesForLargeBusinessFee(businessOwnerId);
		const monthlyHistory = await BusinessVolumeService.getMonthlyQualificationHistory(businessOwnerId, 6);

		return {
			tier: qualification.qualifies ? "premium" : "standard",
			isLargeBusiness: qualification.qualifies,
			features: {
				basicMetrics: true,
				employeeAnalytics: qualification.qualifies,
				clientInsights: qualification.qualifies,
				advancedFinancials: qualification.qualifies,
				exportReports: qualification.qualifies,
			},
			qualification: {
				currentCleanings: qualification.totalCleanings,
				threshold: qualification.threshold,
				cleaningsNeeded: qualification.cleaningsNeeded,
				qualifies: qualification.qualifies,
			},
			monthlyHistory,
		};
	}

	/**
	 * Get overview analytics (available to all tiers)
	 * @param {number} businessOwnerId - Business owner user ID
	 * @param {Object} options - Date range options
	 * @returns {Promise<Object>} Overview metrics
	 */
	static async getOverviewAnalytics(businessOwnerId, options = {}) {
		const {
			EmployeeJobAssignment,
			UserAppointments,
			BusinessEmployee,
			CleanerClient,
		} = require("../models");

		const now = new Date();
		const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
		const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
		const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);
		const startOfWeek = new Date(now);
		startOfWeek.setDate(now.getDate() - now.getDay());
		const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());

		try {
			// Get assignments with appointment data for metrics
			const [
				thisMonthAssignments,
				lastMonthAssignments,
				thisWeekAssignments,
				todayAssignments,
				activeEmployees,
				activeClients,
			] = await Promise.all([
				// This month's assignments
				EmployeeJobAssignment.findAll({
					where: {
						businessOwnerId,
						status: "completed",
					},
					include: [{
						model: UserAppointments,
						as: "appointment",
						where: {
							date: { [Op.gte]: startOfMonth.toISOString().split("T")[0] },
						},
						attributes: ["id", "date", "price"],
					}],
				}),
				// Last month's assignments (for comparison)
				EmployeeJobAssignment.findAll({
					where: {
						businessOwnerId,
						status: "completed",
					},
					include: [{
						model: UserAppointments,
						as: "appointment",
						where: {
							date: {
								[Op.gte]: startOfLastMonth.toISOString().split("T")[0],
								[Op.lte]: endOfLastMonth.toISOString().split("T")[0],
							},
						},
						attributes: ["id", "date", "price"],
					}],
				}),
				// This week's assignments
				EmployeeJobAssignment.findAll({
					where: {
						businessOwnerId,
						status: "completed",
					},
					include: [{
						model: UserAppointments,
						as: "appointment",
						where: {
							date: { [Op.gte]: startOfWeek.toISOString().split("T")[0] },
						},
						attributes: ["id", "date", "price"],
					}],
				}),
				// Today's assignments
				EmployeeJobAssignment.findAll({
					where: {
						businessOwnerId,
						status: "completed",
					},
					include: [{
						model: UserAppointments,
						as: "appointment",
						where: {
							date: startOfDay.toISOString().split("T")[0],
						},
						attributes: ["id", "date", "price"],
					}],
				}),
				// Active employees count
				BusinessEmployee.count({
					where: {
						businessOwnerId,
						status: "active",
					},
				}),
				// Active clients count
				CleanerClient.count({
					where: {
						cleanerId: businessOwnerId,
						status: "active",
					},
				}),
			]);

			// Calculate metrics
			const thisMonthRevenue = thisMonthAssignments.reduce(
				(sum, a) => sum + Math.round(parseFloat(a.appointment.price || 0) * 100),
				0
			);
			const lastMonthRevenue = lastMonthAssignments.reduce(
				(sum, a) => sum + Math.round(parseFloat(a.appointment.price || 0) * 100),
				0
			);
			const thisWeekRevenue = thisWeekAssignments.reduce(
				(sum, a) => sum + Math.round(parseFloat(a.appointment.price || 0) * 100),
				0
			);
			const todayRevenue = todayAssignments.reduce(
				(sum, a) => sum + Math.round(parseFloat(a.appointment.price || 0) * 100),
				0
			);

			// Calculate percentage changes
			const revenueChange = lastMonthRevenue > 0
				? ((thisMonthRevenue - lastMonthRevenue) / lastMonthRevenue * 100).toFixed(1)
				: thisMonthRevenue > 0 ? 100 : 0;
			const bookingsChange = lastMonthAssignments.length > 0
				? ((thisMonthAssignments.length - lastMonthAssignments.length) / lastMonthAssignments.length * 100).toFixed(1)
				: thisMonthAssignments.length > 0 ? 100 : 0;

			// Calculate average job value
			const avgJobValue = thisMonthAssignments.length > 0
				? Math.round(thisMonthRevenue / thisMonthAssignments.length)
				: 0;

			return {
				bookings: {
					today: todayAssignments.length,
					thisWeek: thisWeekAssignments.length,
					thisMonth: thisMonthAssignments.length,
					lastMonth: lastMonthAssignments.length,
					changePercent: parseFloat(bookingsChange),
				},
				revenue: {
					today: todayRevenue,
					todayFormatted: `$${(todayRevenue / 100).toFixed(2)}`,
					thisWeek: thisWeekRevenue,
					thisWeekFormatted: `$${(thisWeekRevenue / 100).toFixed(2)}`,
					thisMonth: thisMonthRevenue,
					thisMonthFormatted: `$${(thisMonthRevenue / 100).toFixed(2)}`,
					lastMonth: lastMonthRevenue,
					lastMonthFormatted: `$${(lastMonthRevenue / 100).toFixed(2)}`,
					changePercent: parseFloat(revenueChange),
				},
				averageJobValue: avgJobValue,
				averageJobValueFormatted: `$${(avgJobValue / 100).toFixed(2)}`,
				activeEmployees,
				activeClients,
				generatedAt: new Date().toISOString(),
			};
		} catch (error) {
			console.error("[BusinessAnalyticsService] Overview analytics error:", error);
			throw error;
		}
	}

	/**
	 * Get employee performance analytics (premium feature)
	 * @param {number} businessOwnerId - Business owner user ID
	 * @param {Object} options - Date range and limit options
	 * @returns {Promise<Object>} Employee performance metrics
	 */
	static async getEmployeeAnalytics(businessOwnerId, options = {}) {
		const {
			EmployeeJobAssignment,
			BusinessEmployee,
			UserAppointments,
			UserReviews,
		} = require("../models");

		const { months = 3, limit = 20 } = options;
		const startDate = new Date();
		startDate.setMonth(startDate.getMonth() - months);

		try {
			// Get all employees
			const employees = await BusinessEmployee.findAll({
				where: {
					businessOwnerId,
					status: { [Op.in]: ["active", "inactive"] },
				},
				attributes: ["id", "userId", "firstName", "lastName", "status", "maxJobsPerDay"],
			});

			const employeeStats = await Promise.all(
				employees.map(async (employee) => {
					// Get assignments for this employee
					const assignments = await EmployeeJobAssignment.findAll({
						where: {
							businessEmployeeId: employee.id,
							status: { [Op.in]: ["completed", "cancelled", "no_show"] },
						},
						include: [{
							model: UserAppointments,
							as: "appointment",
							where: {
								date: { [Op.gte]: startDate.toISOString().split("T")[0] },
							},
							attributes: ["id", "date", "price", "userId"],
						}],
					});

					const completedAssignments = assignments.filter(a => a.status === "completed");
					const totalRevenue = completedAssignments.reduce(
						(sum, a) => sum + Math.round(parseFloat(a.appointment?.price || 0) * 100),
						0
					);
					const totalPay = completedAssignments.reduce(
						(sum, a) => sum + (a.payAmount || 0),
						0
					);

					// Get reviews for appointments this employee completed
					const appointmentIds = completedAssignments.map(a => a.appointmentId);
					let avgRating = null;
					let reviewCount = 0;

					if (appointmentIds.length > 0) {
						const reviews = await UserReviews.findAll({
							where: {
								appointmentId: { [Op.in]: appointmentIds },
							},
							attributes: ["rating"],
						});
						reviewCount = reviews.length;
						if (reviewCount > 0) {
							avgRating = reviews.reduce((sum, r) => sum + r.rating, 0) / reviewCount;
						}
					}

					// Calculate completion rate
					const totalAssignments = assignments.length;
					const completionRate = totalAssignments > 0
						? (completedAssignments.length / totalAssignments * 100).toFixed(1)
						: 0;

					// Calculate on-time rate (jobs completed without no-shows)
					const noShowCount = assignments.filter(a => a.status === "no_show").length;
					const onTimeRate = totalAssignments > 0
						? ((totalAssignments - noShowCount) / totalAssignments * 100).toFixed(1)
						: 100;

					// Calculate utilization (avg jobs per week vs capacity)
					const weeksInPeriod = months * 4.33;
					const avgJobsPerWeek = completedAssignments.length / weeksInPeriod;
					const weeklyCapacity = (employee.maxJobsPerDay || 3) * 5; // Assume 5 work days
					const utilization = weeklyCapacity > 0
						? Math.min((avgJobsPerWeek / weeklyCapacity * 100).toFixed(1), 100)
						: 0;

					return {
						employeeId: employee.userId, // User ID - needed for bonuses
						businessEmployeeId: employee.id, // BusinessEmployee record ID
						name: `${employee.firstName} ${employee.lastName}`,
						status: employee.status,
						jobsCompleted: completedAssignments.length,
						totalRevenue,
						totalRevenueFormatted: `$${(totalRevenue / 100).toFixed(2)}`,
						totalPay,
						totalPayFormatted: `$${(totalPay / 100).toFixed(2)}`,
						avgRating: avgRating ? parseFloat(avgRating.toFixed(2)) : null,
						reviewCount,
						completionRate: parseFloat(completionRate),
						onTimeRate: parseFloat(onTimeRate),
						utilization: parseFloat(utilization),
						avgJobsPerWeek: parseFloat(avgJobsPerWeek.toFixed(1)),
					};
				})
			);

			// Sort by jobs completed and limit
			const rankedEmployees = employeeStats
				.sort((a, b) => b.jobsCompleted - a.jobsCompleted)
				.slice(0, limit);

			// Calculate team totals
			const teamTotals = {
				totalJobs: employeeStats.reduce((sum, e) => sum + e.jobsCompleted, 0),
				totalRevenue: employeeStats.reduce((sum, e) => sum + e.totalRevenue, 0),
				totalPay: employeeStats.reduce((sum, e) => sum + e.totalPay, 0),
				avgCompletionRate: employeeStats.length > 0
					? (employeeStats.reduce((sum, e) => sum + e.completionRate, 0) / employeeStats.length).toFixed(1)
					: 0,
				avgRating: employeeStats.filter(e => e.avgRating).length > 0
					? (employeeStats.filter(e => e.avgRating).reduce((sum, e) => sum + e.avgRating, 0) /
					   employeeStats.filter(e => e.avgRating).length).toFixed(2)
					: null,
			};

			return {
				employees: rankedEmployees,
				teamTotals: {
					...teamTotals,
					totalRevenueFormatted: `$${(teamTotals.totalRevenue / 100).toFixed(2)}`,
					totalPayFormatted: `$${(teamTotals.totalPay / 100).toFixed(2)}`,
				},
				periodMonths: months,
				generatedAt: new Date().toISOString(),
			};
		} catch (error) {
			console.error("[BusinessAnalyticsService] Employee analytics error:", error);
			throw error;
		}
	}

	/**
	 * Get client analytics (premium feature)
	 * @param {number} businessOwnerId - Business owner user ID
	 * @param {Object} options - Options
	 * @returns {Promise<Object>} Client insights
	 */
	static async getClientAnalytics(businessOwnerId, options = {}) {
		const {
			CleanerClient,
			UserAppointments,
			User,
		} = require("../models");

		const { topClientsLimit = 10, churnDays = 60 } = options;
		const now = new Date();
		const churnThreshold = new Date(now);
		churnThreshold.setDate(churnThreshold.getDate() - churnDays);
		const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

		try {
			// Get all clients
			const clients = await CleanerClient.findAll({
				where: {
					cleanerId: businessOwnerId,
				},
				include: [{
					model: User,
					as: "client",
					attributes: ["id", "firstName", "lastName"],
				}],
			});

			// Client status breakdown
			const statusBreakdown = {
				active: clients.filter(c => c.status === "active").length,
				pending: clients.filter(c => c.status === "pending_invite").length,
				inactive: clients.filter(c => c.status === "inactive").length,
				declined: clients.filter(c => c.status === "declined").length,
				cancelled: clients.filter(c => c.status === "cancelled").length,
			};

			// New clients this month
			const newClientsThisMonth = clients.filter(
				c => c.acceptedAt && new Date(c.acceptedAt) >= startOfMonth
			).length;

			// Get booking data for active clients
			const activeClients = clients.filter(c => c.status === "active" && c.clientId);
			const clientBookingData = await Promise.all(
				activeClients.map(async (client) => {
					const appointments = await UserAppointments.findAll({
						where: {
							userId: client.clientId,
							bookedByCleanerId: businessOwnerId,
							completed: true,
						},
						attributes: ["id", "date", "price"],
						order: [["date", "DESC"]],
					});

					const totalRevenue = appointments.reduce(
						(sum, a) => sum + Math.round(parseFloat(a.price || 0) * 100),
						0
					);
					const lastBookingDate = appointments.length > 0 ? appointments[0].date : null;
					const isAtRisk = lastBookingDate && new Date(lastBookingDate) < churnThreshold;

					return {
						clientId: client.clientId,
						cleanerClientId: client.id,
						name: client.client
							? `${client.client.firstName} ${client.client.lastName}`
							: client.invitedName,
						bookingCount: appointments.length,
						totalRevenue,
						totalRevenueFormatted: `$${(totalRevenue / 100).toFixed(2)}`,
						lastBookingDate,
						isAtRisk,
						avgBookingValue: appointments.length > 0
							? Math.round(totalRevenue / appointments.length)
							: 0,
					};
				})
			);

			// Top clients by revenue
			const topClients = [...clientBookingData]
				.sort((a, b) => b.totalRevenue - a.totalRevenue)
				.slice(0, topClientsLimit);

			// Clients at churn risk
			const atRiskClients = clientBookingData
				.filter(c => c.isAtRisk)
				.sort((a, b) => new Date(a.lastBookingDate) - new Date(b.lastBookingDate));

			// Calculate retention metrics
			const clientsWithBookings = clientBookingData.filter(c => c.bookingCount > 0);
			const repeatClients = clientBookingData.filter(c => c.bookingCount > 1);
			const retentionRate = clientsWithBookings.length > 0
				? (repeatClients.length / clientsWithBookings.length * 100).toFixed(1)
				: 0;

			// Average lifetime value
			const avgLifetimeValue = clientsWithBookings.length > 0
				? Math.round(
						clientsWithBookings.reduce((sum, c) => sum + c.totalRevenue, 0) /
						clientsWithBookings.length
				  )
				: 0;

			// Booking frequency analysis
			const bookingFrequency = {
				oneTime: clientBookingData.filter(c => c.bookingCount === 1).length,
				occasional: clientBookingData.filter(c => c.bookingCount >= 2 && c.bookingCount <= 4).length,
				regular: clientBookingData.filter(c => c.bookingCount >= 5 && c.bookingCount <= 11).length,
				frequent: clientBookingData.filter(c => c.bookingCount >= 12).length,
			};

			return {
				totalClients: clients.length,
				statusBreakdown,
				newClientsThisMonth,
				topClients,
				atRiskClients: atRiskClients.slice(0, 10),
				atRiskCount: atRiskClients.length,
				metrics: {
					retentionRate: parseFloat(retentionRate),
					avgLifetimeValue,
					avgLifetimeValueFormatted: `$${(avgLifetimeValue / 100).toFixed(2)}`,
					bookingFrequency,
				},
				churnThresholdDays: churnDays,
				generatedAt: new Date().toISOString(),
			};
		} catch (error) {
			console.error("[BusinessAnalyticsService] Client analytics error:", error);
			throw error;
		}
	}

	/**
	 * Get financial analytics
	 * @param {number} businessOwnerId - Business owner user ID
	 * @param {Object} options - Date range options
	 * @returns {Promise<Object>} Financial breakdown with pending and completed data
	 */
	static async getFinancialAnalytics(businessOwnerId, options = {}) {
		const {
			EmployeeJobAssignment,
			UserAppointments,
			PricingConfig,
		} = require("../models");

		const now = new Date();
		const today = now.toISOString().split("T")[0];
		const { months = 6 } = options;
		const startDate = new Date(now.getFullYear(), now.getMonth() - months + 1, 1);

		// Calculate time period boundaries
		const thisWeekStart = new Date(now);
		thisWeekStart.setDate(now.getDate() - now.getDay());
		thisWeekStart.setHours(0, 0, 0, 0);

		const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
		const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
		const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);

		try {
			const config = await PricingConfig.getActive();
			const businessFee = await BusinessVolumeService.getBusinessFee(businessOwnerId);

			// Get all completed assignments in period
			const completedAssignments = await EmployeeJobAssignment.findAll({
				where: {
					businessOwnerId,
					status: "completed",
				},
				include: [{
					model: UserAppointments,
					as: "appointment",
					where: {
						date: { [Op.gte]: startDate.toISOString().split("T")[0] },
					},
					attributes: ["id", "date", "price", "paymentStatus"],
				}],
			});

			// Get pending/upcoming assignments (assigned but not completed)
			const pendingAssignments = await EmployeeJobAssignment.findAll({
				where: {
					businessOwnerId,
					status: { [Op.in]: ["assigned", "in_progress"] },
				},
				include: [{
					model: UserAppointments,
					as: "appointment",
					where: {
						date: { [Op.gte]: today },
					},
					attributes: ["id", "date", "price", "paymentStatus"],
				}],
			});

			// Helper to calculate financials for a set of assignments
			const calculateFinancials = (assignments) => {
				const grossRevenue = assignments.reduce(
					(sum, a) => sum + Math.round(parseFloat(a.appointment?.price || 0) * 100),
					0
				);
				const totalPayroll = assignments.reduce(
					(sum, a) => sum + (a.payAmount || 0),
					0
				);
				const platformFees = Math.round(grossRevenue * businessFee.feePercent);
				const netRevenue = grossRevenue - platformFees;
				const netProfit = netRevenue - totalPayroll;
				const profitMargin = grossRevenue > 0 ? (netProfit / grossRevenue * 100).toFixed(1) : 0;

				return {
					grossRevenue,
					grossRevenueFormatted: `$${(grossRevenue / 100).toFixed(2)}`,
					platformFees,
					platformFeesFormatted: `$${(platformFees / 100).toFixed(2)}`,
					totalPayroll,
					totalPayrollFormatted: `$${(totalPayroll / 100).toFixed(2)}`,
					netProfit,
					netProfitFormatted: `$${(netProfit / 100).toFixed(2)}`,
					profitMargin: parseFloat(profitMargin),
					jobCount: assignments.length,
				};
			};

			// Filter assignments by time period
			const filterByPeriod = (assignments, startDate, endDate = null) => {
				return assignments.filter(a => {
					const date = new Date(a.appointment.date);
					if (endDate) {
						return date >= startDate && date <= endDate;
					}
					return date >= startDate;
				});
			};

			// Calculate period-specific data
			const thisWeekCompleted = filterByPeriod(completedAssignments, thisWeekStart);
			const thisMonthCompleted = filterByPeriod(completedAssignments, thisMonthStart);
			const lastMonthCompleted = filterByPeriod(completedAssignments, lastMonthStart, lastMonthEnd);

			// Use completedAssignments for the legacy 'assignments' variable
			const assignments = completedAssignments;

			// Calculate totals
			const grossRevenue = assignments.reduce(
				(sum, a) => sum + Math.round(parseFloat(a.appointment?.price || 0) * 100),
				0
			);
			const totalPayroll = assignments.reduce(
				(sum, a) => sum + (a.payAmount || 0),
				0
			);
			const platformFees = Math.round(grossRevenue * businessFee.feePercent);
			const netRevenue = grossRevenue - platformFees;
			const netProfit = netRevenue - totalPayroll;
			const profitMargin = grossRevenue > 0
				? (netProfit / grossRevenue * 100).toFixed(1)
				: 0;

			// Monthly breakdown
			const monthlyData = {};
			for (let i = 0; i < months; i++) {
				const targetDate = new Date(now.getFullYear(), now.getMonth() - i, 1);
				const monthKey = `${targetDate.getFullYear()}-${String(targetDate.getMonth() + 1).padStart(2, "0")}`;
				monthlyData[monthKey] = {
					month: targetDate.getMonth() + 1,
					year: targetDate.getFullYear(),
					grossRevenue: 0,
					payroll: 0,
					platformFees: 0,
					netProfit: 0,
					jobCount: 0,
				};
			}

			// Populate monthly data
			assignments.forEach(a => {
				const date = new Date(a.appointment.date);
				const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
				if (monthlyData[monthKey]) {
					const jobRevenue = Math.round(parseFloat(a.appointment.price || 0) * 100);
					const jobFees = Math.round(jobRevenue * businessFee.feePercent);
					monthlyData[monthKey].grossRevenue += jobRevenue;
					monthlyData[monthKey].payroll += a.payAmount || 0;
					monthlyData[monthKey].platformFees += jobFees;
					monthlyData[monthKey].netProfit += (jobRevenue - jobFees - (a.payAmount || 0));
					monthlyData[monthKey].jobCount += 1;
				}
			});

			// Convert to array and sort by date
			const monthlyBreakdown = Object.values(monthlyData)
				.sort((a, b) => {
					if (a.year !== b.year) return a.year - b.year;
					return a.month - b.month;
				})
				.map(m => ({
					...m,
					monthLabel: new Date(m.year, m.month - 1, 1).toLocaleDateString("en-US", {
						month: "short",
						year: "numeric",
					}),
					grossRevenueFormatted: `$${(m.grossRevenue / 100).toFixed(2)}`,
					payrollFormatted: `$${(m.payroll / 100).toFixed(2)}`,
					platformFeesFormatted: `$${(m.platformFees / 100).toFixed(2)}`,
					netProfitFormatted: `$${(m.netProfit / 100).toFixed(2)}`,
				}));

			// Payroll breakdown by status
			const paidPayrollAssignments = assignments.filter(
				a => a.payoutStatus === "paid" || a.payoutStatus === "paid_outside_platform"
			);
			const unpaidPayrollAssignments = assignments.filter(a => a.payoutStatus === "pending");

			// Client payment status
			const paidByClients = assignments.filter(a => a.appointment?.paymentStatus === "paid");
			const unpaidByClients = assignments.filter(
				a => a.appointment?.paymentStatus !== "paid" && a.appointment?.paymentStatus !== "not_required"
			);

			return {
				// Overall summary for the period
				summary: {
					grossRevenue,
					grossRevenueFormatted: `$${(grossRevenue / 100).toFixed(2)}`,
					platformFees,
					platformFeesFormatted: `$${(platformFees / 100).toFixed(2)}`,
					platformFeePercent: businessFee.feePercent * 100,
					netRevenue,
					netRevenueFormatted: `$${(netRevenue / 100).toFixed(2)}`,
					totalPayroll,
					totalPayrollFormatted: `$${(totalPayroll / 100).toFixed(2)}`,
					netProfit,
					netProfitFormatted: `$${(netProfit / 100).toFixed(2)}`,
					profitMargin: parseFloat(profitMargin),
					totalJobs: assignments.length,
					avgJobRevenue: assignments.length > 0 ? Math.round(grossRevenue / assignments.length) : 0,
				},
				// Time period breakdowns
				periods: {
					thisWeek: calculateFinancials(thisWeekCompleted),
					thisMonth: calculateFinancials(thisMonthCompleted),
					lastMonth: calculateFinancials(lastMonthCompleted),
					allTime: calculateFinancials(assignments),
				},
				// Pending/upcoming jobs
				pending: {
					...calculateFinancials(pendingAssignments),
					jobs: pendingAssignments.map(a => ({
						id: a.id,
						appointmentId: a.appointmentId,
						date: a.appointment?.date,
						estimatedRevenue: Math.round(parseFloat(a.appointment?.price || 0) * 100),
						estimatedPayout: a.payAmount || 0,
					})),
				},
				// Payroll status
				payrollStatus: {
					paid: paidPayrollAssignments.reduce((sum, a) => sum + (a.payAmount || 0), 0),
					paidFormatted: `$${(paidPayrollAssignments.reduce((sum, a) => sum + (a.payAmount || 0), 0) / 100).toFixed(2)}`,
					paidCount: paidPayrollAssignments.length,
					pending: unpaidPayrollAssignments.reduce((sum, a) => sum + (a.payAmount || 0), 0),
					pendingFormatted: `$${(unpaidPayrollAssignments.reduce((sum, a) => sum + (a.payAmount || 0), 0) / 100).toFixed(2)}`,
					pendingCount: unpaidPayrollAssignments.length,
				},
				// Client payment status
				clientPayments: {
					collected: paidByClients.reduce((sum, a) => sum + Math.round(parseFloat(a.appointment?.price || 0) * 100), 0),
					collectedFormatted: `$${(paidByClients.reduce((sum, a) => sum + Math.round(parseFloat(a.appointment?.price || 0) * 100), 0) / 100).toFixed(2)}`,
					collectedCount: paidByClients.length,
					outstanding: unpaidByClients.reduce((sum, a) => sum + Math.round(parseFloat(a.appointment?.price || 0) * 100), 0),
					outstandingFormatted: `$${(unpaidByClients.reduce((sum, a) => sum + Math.round(parseFloat(a.appointment?.price || 0) * 100), 0) / 100).toFixed(2)}`,
					outstandingCount: unpaidByClients.length,
				},
				// Fee tier info
				feeTier: {
					current: businessFee.feeTier,
					feePercent: businessFee.feePercent * 100,
					qualifiesForDiscount: businessFee.qualifies,
					cleaningsToQualify: businessFee.cleaningsNeeded,
				},
				monthlyBreakdown,
				periodMonths: months,
				generatedAt: new Date().toISOString(),
			};
		} catch (error) {
			console.error("[BusinessAnalyticsService] Financial analytics error:", error);
			throw error;
		}
	}

	/**
	 * Get trend data for charts
	 * @param {number} businessOwnerId - Business owner user ID
	 * @param {Object} options - Period and type options
	 * @returns {Promise<Object>} Trend data for visualization
	 */
	static async getTrends(businessOwnerId, options = {}) {
		const { EmployeeJobAssignment, UserAppointments } = require("../models");

		const { period = "monthly", months = 12 } = options;
		const now = new Date();
		const startDate = new Date(now.getFullYear(), now.getMonth() - months + 1, 1);

		try {
			// Get all completed assignments in period
			const assignments = await EmployeeJobAssignment.findAll({
				where: {
					businessOwnerId,
					status: "completed",
				},
				include: [{
					model: UserAppointments,
					as: "appointment",
					where: {
						date: { [Op.gte]: startDate.toISOString().split("T")[0] },
					},
					attributes: ["id", "date", "price"],
				}],
			});

			// Build trend data based on period
			const trendData = [];

			if (period === "monthly") {
				for (let i = months - 1; i >= 0; i--) {
					const targetDate = new Date(now.getFullYear(), now.getMonth() - i, 1);
					const monthStart = new Date(targetDate.getFullYear(), targetDate.getMonth(), 1);
					const monthEnd = new Date(targetDate.getFullYear(), targetDate.getMonth() + 1, 0);

					const monthAssignments = assignments.filter(a => {
						const date = new Date(a.appointment.date);
						return date >= monthStart && date <= monthEnd;
					});

					const revenue = monthAssignments.reduce(
						(sum, a) => sum + Math.round(parseFloat(a.appointment?.price || 0) * 100),
						0
					);

					trendData.push({
						period: targetDate.toLocaleDateString("en-US", { month: "short", year: "numeric" }),
						periodKey: `${targetDate.getFullYear()}-${String(targetDate.getMonth() + 1).padStart(2, "0")}`,
						bookings: monthAssignments.length,
						revenue,
						revenueFormatted: `$${(revenue / 100).toFixed(2)}`,
					});
				}
			} else if (period === "weekly") {
				const weeks = Math.min(months * 4, 52);
				for (let i = weeks - 1; i >= 0; i--) {
					const weekStart = new Date(now);
					weekStart.setDate(now.getDate() - (i * 7) - now.getDay());
					const weekEnd = new Date(weekStart);
					weekEnd.setDate(weekStart.getDate() + 6);

					const weekAssignments = assignments.filter(a => {
						const date = new Date(a.appointment.date);
						return date >= weekStart && date <= weekEnd;
					});

					const revenue = weekAssignments.reduce(
						(sum, a) => sum + Math.round(parseFloat(a.appointment?.price || 0) * 100),
						0
					);

					trendData.push({
						period: `Week of ${weekStart.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`,
						periodKey: weekStart.toISOString().split("T")[0],
						bookings: weekAssignments.length,
						revenue,
						revenueFormatted: `$${(revenue / 100).toFixed(2)}`,
					});
				}
			}

			return {
				period,
				data: trendData,
				generatedAt: new Date().toISOString(),
			};
		} catch (error) {
			console.error("[BusinessAnalyticsService] Trends error:", error);
			throw error;
		}
	}

	/**
	 * Get all analytics in one call (respects tier access)
	 * @param {number} businessOwnerId - Business owner user ID
	 * @param {Object} options - Options for various analytics
	 * @returns {Promise<Object>} Complete analytics package
	 */
	static async getAllAnalytics(businessOwnerId, options = {}) {
		const access = await this.getAnalyticsAccess(businessOwnerId);

		const result = {
			access,
			overview: await this.getOverviewAnalytics(businessOwnerId, options),
		};

		// Add premium features if qualified
		if (access.features.employeeAnalytics) {
			result.employees = await this.getEmployeeAnalytics(businessOwnerId, options);
		}

		if (access.features.clientInsights) {
			result.clients = await this.getClientAnalytics(businessOwnerId, options);
		}

		// Financial summary is available to all business owners
		result.financials = await this.getFinancialAnalytics(businessOwnerId, options);

		// Trends are available to all (basic version)
		result.trends = await this.getTrends(businessOwnerId, {
			period: "monthly",
			months: access.tier === "premium" ? 12 : 6,
		});

		return result;
	}
}

module.exports = BusinessAnalyticsService;
