/**
 * DemoAccountService
 *
 * Manages demo accounts for the owner's "Preview as Role" feature.
 * Allows platform owners to preview the app as different role types
 * (Cleaner, Homeowner, Business Owner, Employee) with full functionality.
 */

const jwt = require("jsonwebtoken");
const {
	User,
	UserAppointments,
	UserCleanerAppointments,
	EmployeeJobAssignment,
	RecurringSchedule,
	UserHomes,
	UserReviews,
	UserBills,
	Payout,
	BusinessEmployee,
	CleanerClient,
	CancellationAppeal,
	HomeSizeAdjustmentRequest,
	CancellationAuditLog,
	MultiCleanerJob,
	CleanerJobOffer,
} = require("../models");

// Alias for cleaner code
const Home = UserHomes;
const { Op } = require("sequelize");

const secretKey = process.env.SESSION_SECRET;

// Role type to user type mapping
const ROLE_TYPE_MAP = {
	cleaner: "cleaner",
	homeowner: null, // null type = homeowner
	businessOwner: "cleaner", // Business owners are cleaners with isBusinessOwner=true
	employee: "employee",
	humanResources: "humanResources",
	largeBusinessOwner: "cleaner", // Large business owners are cleaners with isBusinessOwner=true and high volume
	preferredCleaner: "cleaner", // Preferred cleaners are cleaners with platinum tier perks
};

// Demo account email prefixes for identification
const DEMO_EMAIL_PREFIX = "demo_";
const DEMO_USERNAMES = {
	cleaner: "demo_cleaner",
	homeowner: "demo_homeowner",
	businessOwner: "demo_business_owner",
	employee: "demo_employee",
	businessClient: "demo_business_client",
	humanResources: "demo_hr",
	largeBusinessOwner: "demo_large_business",
	preferredCleaner: "demo_preferred_cleaner",
};

class DemoAccountService {
	/**
	 * Get all demo accounts
	 * @returns {Promise<Array>} List of demo accounts with their role types
	 */
	static async getDemoAccounts() {
		try {
			const demoAccounts = await User.findAll({
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

			return demoAccounts.map((account) => ({
				id: account.id,
				username: account.username,
				name: `${account.firstName} ${account.lastName}`,
				role: this.getUserRole(account),
				type: account.type,
				isBusinessOwner: account.isBusinessOwner,
				businessName: account.businessName,
			}));
		} catch (error) {
			console.error("[DemoAccountService] Error fetching demo accounts:", error);
			throw error;
		}
	}

	/**
	 * Get a specific demo account by role
	 * @param {string} role - Role type: 'cleaner', 'homeowner', 'businessOwner', 'employee'
	 * @returns {Promise<Object|null>} Demo account or null
	 */
	static async getDemoAccountByRole(role) {
		try {
			const username = DEMO_USERNAMES[role];
			if (!username) {
				throw new Error(`Invalid role: ${role}`);
			}

			const account = await User.findOne({
				where: {
					isDemoAccount: true,
					username,
				},
			});

			return account;
		} catch (error) {
			console.error(`[DemoAccountService] Error fetching demo account for role ${role}:`, error);
			throw error;
		}
	}

	/**
	 * Create a preview session - generates a token for the demo account
	 * @param {number} ownerId - The owner's user ID (for audit logging)
	 * @param {string} role - Role to preview: 'cleaner', 'homeowner', 'businessOwner', 'employee'
	 * @returns {Promise<Object>} Preview session data with token and user info
	 */
	static async createPreviewSession(ownerId, role) {
		try {
			// Verify the owner is actually an owner
			const owner = await User.findByPk(ownerId);
			if (!owner || owner.type !== "owner") {
				throw new Error("Only platform owners can create preview sessions");
			}

			// Get the demo account for this role
			const demoAccount = await this.getDemoAccountByRole(role);
			if (!demoAccount) {
				throw new Error(`Demo account not found for role: ${role}. Please run the demo account seeder.`);
			}

			// Refresh demo appointment dates to be relative to today
			// This ensures the demo data feels current
			const refreshResult = await this.refreshDemoAppointmentDates();
			console.log(`[DemoAccountService] Demo data refreshed: ${refreshResult.updated} records updated`);

			// Clear any previous preview owner ID from other demo accounts for this owner
			// (in case they're switching roles)
			await User.update(
				{ currentPreviewOwnerId: null },
				{ where: { currentPreviewOwnerId: ownerId, isDemoAccount: true } }
			);

			// Set the current preview owner on this demo account
			// This allows email redirection to the owner's email
			await demoAccount.update({ currentPreviewOwnerId: ownerId });
			console.log(`[DemoAccountService] Demo account ${demoAccount.id} now linked to owner ${ownerId} for email redirection`);

			// Generate a token for the demo account
			// Mark it as a preview session with metadata
			const token = jwt.sign(
				{
					userId: demoAccount.id,
					isPreviewSession: true,
					originalOwnerId: ownerId,
					previewRole: role,
				},
				secretKey,
				{ expiresIn: "4h" } // Preview sessions expire after 4 hours
			);

			// Log the preview session start
			console.log(`[DemoAccountService] Preview session started: Owner ${ownerId} -> ${role} (Demo account ${demoAccount.id})`);

			return {
				success: true,
				token,
				user: {
					id: demoAccount.id,
					username: demoAccount.username,
					firstName: demoAccount.firstName,
					lastName: demoAccount.lastName,
					email: demoAccount.email,
					type: demoAccount.type,
					isBusinessOwner: demoAccount.isBusinessOwner,
					businessName: demoAccount.businessName,
					isDemoAccount: true,
				},
				previewRole: role,
				originalOwnerId: ownerId,
			};
		} catch (error) {
			console.error("[DemoAccountService] Error creating preview session:", error);
			throw error;
		}
	}

	/**
	 * End a preview session - returns the owner's token
	 * @param {number} ownerId - The original owner's user ID
	 * @returns {Promise<Object>} Owner session data with new token
	 */
	static async endPreviewSession(ownerId) {
		try {
			const owner = await User.findByPk(ownerId);
			if (!owner || owner.type !== "owner") {
				throw new Error("Invalid owner ID for ending preview session");
			}

			// Clear the currentPreviewOwnerId from all demo accounts for this owner
			// This stops email redirection
			const [clearedCount] = await User.update(
				{ currentPreviewOwnerId: null },
				{ where: { currentPreviewOwnerId: ownerId, isDemoAccount: true } }
			);
			if (clearedCount > 0) {
				console.log(`[DemoAccountService] Cleared email redirection from ${clearedCount} demo account(s) for owner ${ownerId}`);
			}

			// Generate a fresh token for the owner
			const token = jwt.sign(
				{ userId: owner.id },
				secretKey,
				{ expiresIn: "24h" }
			);

			// Log the preview session end
			console.log(`[DemoAccountService] Preview session ended: Owner ${ownerId} returned to owner mode`);

			return {
				success: true,
				token,
				user: {
					id: owner.id,
					username: owner.username,
					firstName: owner.firstName,
					lastName: owner.lastName,
					email: owner.email,
					type: owner.type,
				},
			};
		} catch (error) {
			console.error("[DemoAccountService] Error ending preview session:", error);
			throw error;
		}
	}

	/**
	 * Check if a token is from a preview session
	 * @param {Object} decodedToken - Decoded JWT token
	 * @returns {boolean} True if this is a preview session token
	 */
	static isPreviewSession(decodedToken) {
		return decodedToken && decodedToken.isPreviewSession === true;
	}

	/**
	 * Get the user role from a User model instance
	 * @param {Object} user - User model instance
	 * @returns {string} Role type
	 */
	static getUserRole(user) {
		if (user.type === "employee") return "employee";
		if (user.type === "cleaner" && user.isBusinessOwner) return "businessOwner";
		if (user.type === "cleaner") return "cleaner";
		if (user.type === "owner") return "owner";
		if (user.type === "humanResources") return "humanResources";
		return "homeowner";
	}

	/**
	 * Get available preview roles
	 * @returns {Array} List of available roles with descriptions
	 */
	static getAvailableRoles() {
		return [
			{
				role: "cleaner",
				label: "Cleaner",
				description: "See the marketplace, jobs, and earnings",
				icon: "broom",
			},
			{
				role: "homeowner",
				label: "Homeowner",
				description: "See booking, homes, and bills",
				icon: "home",
			},
			{
				role: "businessOwner",
				label: "Business Owner",
				description: "See employees, clients, and analytics",
				icon: "briefcase",
			},
			{
				role: "employee",
				label: "Employee",
				description: "See assigned jobs and schedule",
				icon: "user-tie",
			},
			{
				role: "humanResources",
				label: "HR Manager",
				description: "Review disputes, appeals, and conflicts",
				icon: "gavel",
			},
			{
				role: "largeBusinessOwner",
				label: "Large Business",
				description: "100+ clients, 7% platform fee tier",
				icon: "building",
			},
			{
				role: "preferredCleaner",
				label: "Preferred Cleaner",
				description: "Platinum tier, 20 homes, 7% bonus",
				icon: "star",
			},
		];
	}

	/**
	 * Helper to generate a future date string (YYYY-MM-DD)
	 * @param {number} daysFromNow - Number of days from today
	 * @returns {string} Date string
	 */
	static getFutureDate(daysFromNow) {
		const date = new Date();
		date.setDate(date.getDate() + daysFromNow);
		return date.toISOString().split("T")[0];
	}

	/**
	 * Helper to generate a past date string (YYYY-MM-DD)
	 * @param {number} daysAgo - Number of days ago
	 * @returns {string} Date string
	 */
	static getPastDate(daysAgo) {
		const date = new Date();
		date.setDate(date.getDate() - daysAgo);
		return date.toISOString().split("T")[0];
	}

	/**
	 * Refresh all demo appointment dates to be relative to today
	 * This makes the demo data feel current whenever preview mode is entered
	 * @returns {Promise<Object>} Summary of updates
	 */
	static async refreshDemoAppointmentDates() {
		try {
			console.log("[DemoAccountService] Refreshing demo appointment dates...");

			// Get all demo accounts
			const demoAccounts = await User.findAll({
				where: { isDemoAccount: true },
			});

			if (demoAccounts.length === 0) {
				console.log("[DemoAccountService] No demo accounts found");
				return { updated: 0 };
			}

			const demoUserIds = demoAccounts.map(u => u.id);
			let updatedCount = 0;

			// Find demo homeowner
			const demoHomeowner = demoAccounts.find(u => u.username === "demo_homeowner");
			// Find demo employee
			const demoEmployee = demoAccounts.find(u => u.username === "demo_employee");
			// Find demo cleaner
			const demoCleaner = demoAccounts.find(u => u.username === "demo_cleaner");
			// Find demo business client
			const demoBusinessClient = demoAccounts.find(u => u.username === "demo_business_client");
			// Find demo business owner
			const demoBusinessOwner = demoAccounts.find(u => u.username === "demo_business_owner");

			// Get BusinessEmployee record for demo employee (needed for job assignments)
			let demoBusinessEmployee = null;
			if (demoEmployee && demoBusinessOwner) {
				demoBusinessEmployee = await BusinessEmployee.findOne({
					where: { userId: demoEmployee.id, businessOwnerId: demoBusinessOwner.id }
				});
			}

			// ===== UPDATE HOMEOWNER APPOINTMENTS =====
			if (demoHomeowner) {
				// Get all appointments for demo homeowner
				const homeownerAppointments = await UserAppointments.findAll({
					where: { userId: demoHomeowner.id },
					order: [["date", "ASC"]],
				});

				// Separate completed (past) and upcoming appointments
				const completedAppts = homeownerAppointments.filter(a => a.completed);
				const upcomingAppts = homeownerAppointments.filter(a => !a.completed);

				// Update past appointments - spread over past weeks
				for (let i = 0; i < completedAppts.length; i++) {
					const newDate = this.getPastDate((i + 1) * 14); // Every 2 weeks in the past
					await completedAppts[i].update({ date: newDate });
					updatedCount++;
				}

				// Update upcoming appointments - today, tomorrow, and future days
				const upcomingSchedule = [0, 1, 3, 7, 14, 21]; // Today, tomorrow, 3 days, 1 week, 2 weeks, 3 weeks
				for (let i = 0; i < upcomingAppts.length; i++) {
					const daysFromNow = upcomingSchedule[i] || (7 * (i + 1)); // Fall back to weekly
					const newDate = this.getFutureDate(daysFromNow);
					await upcomingAppts[i].update({ date: newDate });
					updatedCount++;
				}

				console.log(`[DemoAccountService] Updated ${completedAppts.length} past + ${upcomingAppts.length} upcoming homeowner appointments`);
			}

			// ===== UPDATE EMPLOYEE JOB ASSIGNMENTS =====
			if (demoBusinessEmployee) {
				const employeeAssignments = await EmployeeJobAssignment.findAll({
					where: { businessEmployeeId: demoBusinessEmployee.id },
					include: [{
						model: UserAppointments,
						as: "appointment",
					}],
				});

				// Spread assignments over the next 10 days (today, tomorrow, etc.)
				const assignmentSchedule = [0, 1, 2, 4, 6]; // Today, tomorrow, 2 days, 4 days, 6 days
				for (let i = 0; i < employeeAssignments.length; i++) {
					const daysFromNow = assignmentSchedule[i] || (i * 2 + 1);
					const newDate = this.getFutureDate(daysFromNow);

					// Update the linked appointment date (assignments don't have their own date)
					if (employeeAssignments[i].appointmentId) {
						await UserAppointments.update(
							{ date: newDate },
							{ where: { id: employeeAssignments[i].appointmentId } }
						);
					}
					updatedCount++;
				}

				console.log(`[DemoAccountService] Updated ${employeeAssignments.length} employee job assignments`);
			}

			// ===== UPDATE RECURRING SCHEDULE =====
			if (demoHomeowner) {
				const homeIds = await Home.findAll({
					where: { userId: demoHomeowner.id },
					attributes: ["id"],
				});

				if (homeIds.length > 0) {
					const homeIdList = homeIds.map(h => h.id);
					await RecurringSchedule.update(
						{ nextScheduledDate: this.getFutureDate(14) },
						{ where: { homeId: { [Op.in]: homeIdList } } }
					);
					console.log("[DemoAccountService] Updated recurring schedule dates");
					updatedCount++;
				}
			}

			// ===== UPDATE CLEANER APPOINTMENTS (from homeowner assignments) =====
			if (demoCleaner) {
				// Find appointments where the cleaner is assigned
				const cleanerAppointments = await UserAppointments.findAll({
					where: {
						userId: { [Op.in]: demoUserIds },
						completed: false,
					},
				});

				// These are updated via homeowner section, but ensure cleaner sees current dates
				console.log(`[DemoAccountService] Verified ${cleanerAppointments.length} cleaner-visible appointments`);
			}

			// ===== UPDATE BUSINESS CLIENT APPOINTMENTS =====
			if (demoBusinessClient) {
				const businessClientAppointments = await UserAppointments.findAll({
					where: { userId: demoBusinessClient.id },
					order: [["date", "ASC"]],
				});

				// Separate completed (past) and upcoming appointments
				const completedAppts = businessClientAppointments.filter(a => a.completed);
				const upcomingAppts = businessClientAppointments.filter(a => !a.completed);

				// Update past appointments - spread over past weeks
				for (let i = 0; i < completedAppts.length; i++) {
					const newDate = this.getPastDate((i + 1) * 7); // Weekly in the past
					await completedAppts[i].update({ date: newDate });

					// Update corresponding job assignment if exists
					await EmployeeJobAssignment.update(
						{ scheduledDate: newDate },
						{ where: { appointmentId: completedAppts[i].id } }
					);
					updatedCount++;
				}

				// Update upcoming appointments - today, 3 days, 1 week
				const upcomingSchedule = [0, 3, 7]; // Today, 3 days from now, 1 week from now
				for (let i = 0; i < upcomingAppts.length; i++) {
					const daysFromNow = upcomingSchedule[i] || (7 * (i + 1));
					const newDate = this.getFutureDate(daysFromNow);
					await upcomingAppts[i].update({ date: newDate });

					// Update corresponding job assignment if exists
					await EmployeeJobAssignment.update(
						{ scheduledDate: newDate },
						{ where: { appointmentId: upcomingAppts[i].id } }
					);
					updatedCount++;
				}

				console.log(`[DemoAccountService] Updated ${completedAppts.length} past + ${upcomingAppts.length} upcoming business client appointments`);
			}

			console.log(`[DemoAccountService] Demo appointment date refresh complete. Total updates: ${updatedCount}`);

			return {
				success: true,
				updated: updatedCount,
			};
		} catch (error) {
			console.error("[DemoAccountService] Error refreshing demo appointment dates:", error);
			// Don't throw - this is a non-critical enhancement
			return {
				success: false,
				error: error.message,
				updated: 0,
			};
		}
	}

	/**
	 * Reset all demo data back to original seeder state
	 * This deletes all demo-related data and recreates it fresh
	 * @returns {Promise<Object>} Summary of reset operation
	 */
	static async resetDemoData() {
		try {
			console.log("[DemoAccountService] Starting demo data reset...");

			// Get all demo accounts
			const demoAccounts = await User.findAll({
				where: { isDemoAccount: true },
			});

			if (demoAccounts.length === 0) {
				console.log("[DemoAccountService] No demo accounts found");
				return {
					success: false,
					error: "No demo accounts found. Please run the demo account seeder first.",
				};
			}

			const demoUserIds = demoAccounts.map(u => u.id);

			// Find specific demo accounts
			const demoCleaner = demoAccounts.find(u => u.username === "demo_cleaner");
			const demoHomeowner = demoAccounts.find(u => u.username === "demo_homeowner");
			const demoBusinessOwner = demoAccounts.find(u => u.username === "demo_business_owner");
			const demoEmployee = demoAccounts.find(u => u.username === "demo_employee");
			const demoBusinessClient = demoAccounts.find(u => u.username === "demo_business_client");
			const demoHR = demoAccounts.find(u => u.username === "demo_hr");

			// Get BusinessEmployee record for demo employee
			let demoBusinessEmployee = null;
			if (demoEmployee && demoBusinessOwner) {
				demoBusinessEmployee = await BusinessEmployee.findOne({
					where: { userId: demoEmployee.id, businessOwnerId: demoBusinessOwner.id }
				});
			}

			let deletedCount = 0;
			let createdCount = 0;

			// ===== STEP 1: DELETE EXISTING DEMO DATA =====
			console.log("[DemoAccountService] Deleting existing demo data...");

			// Delete employee job assignments for demo employee
			if (demoBusinessEmployee) {
				const deleted = await EmployeeJobAssignment.destroy({
					where: { businessEmployeeId: demoBusinessEmployee.id },
				});
				deletedCount += deleted;
				console.log(`  - Deleted ${deleted} employee job assignments`);
			}

			// Also delete job assignments for demo business owner (self-assignments and marketplace)
			if (demoBusinessOwner) {
				const deletedOwnerAssignments = await EmployeeJobAssignment.destroy({
					where: { businessOwnerId: demoBusinessOwner.id },
				});
				deletedCount += deletedOwnerAssignments;
				console.log(`  - Deleted ${deletedOwnerAssignments} business owner job assignments`);
			}

			// Delete reviews involving demo users (must be before appointments due to FK constraint)
			const deletedReviews = await UserReviews.destroy({
				where: {
					[Op.or]: [
						{ reviewerId: { [Op.in]: demoUserIds } },
						{ userId: { [Op.in]: demoUserIds } },
					],
				},
			});
			deletedCount += deletedReviews;
			console.log(`  - Deleted ${deletedReviews} reviews`);

			// Delete cleaner-appointment assignments for demo users (must be before appointments)
			// First get all appointment IDs for demo users
			const demoAppointments = await UserAppointments.findAll({
				where: { userId: { [Op.in]: demoUserIds } },
				attributes: ["id"],
			});
			const demoApptIds = demoAppointments.map(a => a.id);

			if (demoApptIds.length > 0) {
				const deletedCleanerAppts = await UserCleanerAppointments.destroy({
					where: {
						[Op.or]: [
							{ appointmentId: { [Op.in]: demoApptIds } },
							{ employeeId: { [Op.in]: demoUserIds } },
						],
					},
				});
				deletedCount += deletedCleanerAppts;
				console.log(`  - Deleted ${deletedCleanerAppts} cleaner-appointment assignments`);
			}

			// Delete appointments for demo users
			const deletedAppts = await UserAppointments.destroy({
				where: { userId: { [Op.in]: demoUserIds } },
			});
			deletedCount += deletedAppts;
			console.log(`  - Deleted ${deletedAppts} appointments`);

			// Delete payouts for demo users
			const deletedPayouts = await Payout.destroy({
				where: {
					[Op.or]: [
						{ cleanerId: { [Op.in]: demoUserIds } },
						{ businessOwnerId: { [Op.in]: demoUserIds } },
					],
				},
			});
			deletedCount += deletedPayouts;
			console.log(`  - Deleted ${deletedPayouts} payouts`);

			// Delete cancellation appeals for demo users
			const deletedAppeals = await CancellationAppeal.destroy({
				where: { appealerId: { [Op.in]: demoUserIds } },
			});
			deletedCount += deletedAppeals;
			console.log(`  - Deleted ${deletedAppeals} cancellation appeals`);

			// Delete home size adjustment requests for demo users
			const deletedAdjustments = await HomeSizeAdjustmentRequest.destroy({
				where: {
					[Op.or]: [
						{ cleanerId: { [Op.in]: demoUserIds } },
						{ homeownerId: { [Op.in]: demoUserIds } },
					],
				},
			});
			deletedCount += deletedAdjustments;
			console.log(`  - Deleted ${deletedAdjustments} home size adjustment requests`);

			// Delete cancellation audit logs for demo users
			const deletedAuditLogs = await CancellationAuditLog.destroy({
				where: { actorId: { [Op.in]: demoUserIds } },
			});
			deletedCount += deletedAuditLogs;
			console.log(`  - Deleted ${deletedAuditLogs} cancellation audit logs`);

			// Delete cleaner job offers for demo users
			const deletedOffers = await CleanerJobOffer.destroy({
				where: { cleanerId: { [Op.in]: demoUserIds } },
			});
			deletedCount += deletedOffers;
			console.log(`  - Deleted ${deletedOffers} cleaner job offers`);

			// Delete multi-cleaner jobs for demo homeowner appointments
			const demoLargeHomeOwner = await User.findOne({
				where: { username: "demo_large_home_owner" },
			});
			if (demoLargeHomeOwner) {
				const largeHomeAppts = await UserAppointments.findAll({
					where: { userId: demoLargeHomeOwner.id },
					attributes: ["id"],
				});
				if (largeHomeAppts.length > 0) {
					const deletedMultiJobs = await MultiCleanerJob.destroy({
						where: { appointmentId: { [Op.in]: largeHomeAppts.map(a => a.id) } },
					});
					deletedCount += deletedMultiJobs;
					console.log(`  - Deleted ${deletedMultiJobs} multi-cleaner jobs`);

					// Delete the appointments for large home owner
					const deletedLargeHomeAppts = await UserAppointments.destroy({
						where: { userId: demoLargeHomeOwner.id },
					});
					deletedCount += deletedLargeHomeAppts;
					console.log(`  - Deleted ${deletedLargeHomeAppts} large home owner appointments`);
				}
			}

			// Reset bills for demo homeowner
			if (demoHomeowner) {
				await UserBills.update(
					{ totalDue: 15000, appointmentDue: 15000, cancellationFee: 0 },
					{ where: { userId: demoHomeowner.id } }
				);
				console.log("  - Reset demo homeowner bills");
			}

			// Reset bills for demo business client
			if (demoBusinessClient) {
				await UserBills.update(
					{ totalDue: 10000, appointmentDue: 10000, cancellationFee: 0 },
					{ where: { userId: demoBusinessClient.id } }
				);
				console.log("  - Reset demo business client bills");
			}

			// Reset recurring schedules
			if (demoHomeowner) {
				const homeIds = await Home.findAll({
					where: { userId: demoHomeowner.id },
					attributes: ["id"],
				});
				if (homeIds.length > 0) {
					await RecurringSchedule.update(
						{ nextScheduledDate: this.getFutureDate(14), isActive: true },
						{ where: { homeId: { [Op.in]: homeIds.map(h => h.id) } } }
					);
					console.log("  - Reset recurring schedules");
				}
			}

			// ===== STEP 2: RECREATE DEMO DATA =====
			console.log("[DemoAccountService] Creating fresh demo data...");

			// Get demo homeowner's homes
			let homeownerHomes = [];
			if (demoHomeowner) {
				homeownerHomes = await Home.findAll({
					where: { userId: demoHomeowner.id },
				});
			}

			// --- RECREATE HOMEOWNER APPOINTMENTS AND REVIEWS ---
			const pastAppointmentIds = [];
			if (demoHomeowner && homeownerHomes.length > 0 && demoCleaner) {
				console.log("  - Creating appointments for demo homeowner...");

				// Create 10 past appointments (completed) for reviews
				for (let i = 1; i <= 10; i++) {
					const pastDate = this.getPastDate(i * 7);
					const appt = await UserAppointments.create({
						userId: demoHomeowner.id,
						homeId: homeownerHomes[0].id,
						date: pastDate,
						price: "180",
						paid: true,
						bringTowels: "yes",
						bringSheets: "no",
						completed: true,
						hasBeenAssigned: true,
						employeesAssigned: [demoCleaner.id.toString()],
						empoyeesNeeded: 1,
						timeToBeCompleted: "3",
						paymentStatus: "paid",
						amountPaid: 18000,
						completionStatus: "approved",
					});
					pastAppointmentIds.push(appt.id);
					createdCount++;
				}
				console.log("    Created 10 past appointments");

				// Create reviews linked to past appointments
				console.log("  - Creating reviews for demo cleaner...");
				const reviewRatings = [5, 5, 5, 5, 5, 5, 4, 5, 4, 5];
				const reviewComments = [
					"Absolutely fantastic cleaning! My house has never looked better.",
					"Very thorough and professional. Highly recommend!",
					"Great attention to detail, especially in the kitchen.",
					"Always on time and does an amazing job.",
					"Best cleaner we've ever hired!",
					"Very friendly and efficient. Will book again!",
					"Good job overall, a few spots missed but still satisfied.",
					"Incredible work! My bathrooms are sparkling.",
					"Reliable and trustworthy. Been using for months.",
					"Exceeded expectations every single time!",
				];

				for (let i = 0; i < reviewRatings.length; i++) {
					await UserReviews.create({
						userId: demoCleaner.id,
						reviewerId: demoHomeowner.id,
						appointmentId: pastAppointmentIds[i],
						review: reviewRatings[i],
						reviewComment: reviewComments[i],
						reviewType: "homeowner_to_cleaner",
						createdAt: new Date(Date.now() - (i * 7 * 24 * 60 * 60 * 1000)),
					});
					createdCount++;
				}

				// Update cleaner stats
				await demoCleaner.update({ avgRating: 4.8, totalReviews: 10 });
				console.log("    Created 10 cleaner reviews");

				// Create 3 upcoming appointments (today, tomorrow, future)
				// The 3rd appointment (i=2) will be a multi-cleaner job in Find Jobs
				const upcomingDays = [0, 1, 7]; // Today, tomorrow, next week
				for (let i = 0; i < 3; i++) {
					const futureDate = this.getFutureDate(upcomingDays[i]);
					const home = homeownerHomes[i % homeownerHomes.length];
					const numBeds = parseInt(home.numBeds) || 3;
					const numBaths = parseInt(home.numBaths) || 2;
					const bringSheets = i === 0 ? "yes" : "no";
					const bringTowels = "yes";

					// Calculate correct price based on home size
					// Base $150 + extra beds ($50 each) + extra baths ($50 each) + towels ($13 per bathroom)
					let price = 150; // Base price
					price += Math.max(0, numBeds - 1) * 50; // Extra beds
					price += Math.max(0, numBaths - 1) * 50; // Extra baths
					if (bringTowels === "yes") {
						price += numBaths * 13; // Towels: $13 per bathroom
					}
					if (bringSheets === "yes") {
						price += numBeds * 30; // Sheets: $30 per bed
					}

					// 3rd appointment (i=2) is a multi-cleaner job for Find Jobs
					const isMultiCleaner = i === 2;

					const appt = await UserAppointments.create({
						userId: demoHomeowner.id,
						homeId: home.id,
						date: futureDate,
						price: String(price),
						paid: false,
						bringTowels,
						bringSheets,
						completed: false,
						hasBeenAssigned: i <= 1,
						employeesAssigned: i <= 1 ? [demoCleaner.id.toString()] : [],
						empoyeesNeeded: isMultiCleaner ? 2 : 1,
						timeToBeCompleted: isMultiCleaner ? "4" : "3",
						paymentStatus: "pending",
						amountPaid: 0,
						isMultiCleanerJob: isMultiCleaner,
					});
					createdCount++;

					// Create MultiCleanerJob and offer for the unassigned multi-cleaner job
					if (isMultiCleaner) {
						const multiCleanerJob = await MultiCleanerJob.create({
							appointmentId: appt.id,
							totalCleanersRequired: 2,
							cleanersConfirmed: 0,
							status: "open",
							isAutoGenerated: true,
							totalEstimatedMinutes: 240, // 4 hours
							openedToMarketAt: new Date(),
						});
						createdCount++;

						// Update appointment with multi-cleaner job ID
						await appt.update({ multiCleanerJobId: multiCleanerJob.id });

						// Calculate per-cleaner earnings: price * 87% (13% platform fee) / 2 cleaners
						const perCleanerEarnings = Math.round((price * 100 * 0.87) / 2);

						// Create offer for demo cleaner
						await CleanerJobOffer.create({
							multiCleanerJobId: multiCleanerJob.id,
							cleanerId: demoCleaner.id,
							appointmentId: appt.id,
							offerType: "market_open",
							status: "pending",
							earningsOffered: perCleanerEarnings,
							offeredAt: new Date(),
							expiresAt: new Date(Date.now() + 48 * 60 * 60 * 1000),
						});
						createdCount++;
						console.log(`    Created multi-cleaner job for Find Jobs: $${price} (${numBeds} bed, ${numBaths} bath)`);
					}
				}
				console.log("    Created 3 upcoming appointments");
			}

			// --- CREATE SOLO JOBS FOR FIND JOBS ---
			console.log("  - Creating solo jobs for Find Jobs...");
			try {
				// Create a few different homeowners with homes for solo job variety
				const soloJobHomeowners = [
					{ username: "demo_solo_homeowner_1", beds: 2, baths: 1, city: "Denver" },
					{ username: "demo_solo_homeowner_2", beds: 3, baths: 2, city: "Boulder" },
					{ username: "demo_solo_homeowner_3", beds: 2, baths: 2, city: "Aurora" },
				];

				for (let i = 0; i < soloJobHomeowners.length; i++) {
					const config = soloJobHomeowners[i];

					// Find or create homeowner
					let soloHomeowner = await User.findOne({
						where: { username: config.username },
					});

					if (!soloHomeowner) {
						soloHomeowner = await User.create({
							username: config.username,
							email: `${config.username}@sparkle.demo`,
							password: "$2b$10$demohashedpassword",
							firstName: "Solo",
							lastName: `Homeowner${i + 1}`,
							type: null,
							isDemoAccount: true,
						});
						createdCount++;
					}

					// Find or create home
					let soloHome = await Home.findOne({
						where: { userId: soloHomeowner.id },
					});

					if (!soloHome) {
						soloHome = await Home.create({
							userId: soloHomeowner.id,
							nickName: `${config.city} Home`,
							address: `${100 + i * 100} Demo Street`,
							city: config.city,
							state: "CO",
							zipcode: "80202",
							numBeds: String(config.beds),
							numBaths: String(config.baths),
							sheetsProvided: "yes",
							towelsProvided: "yes",
							keyPadCode: "1234",
							keyLocation: "Under the mat",
							trashLocation: "Garage",
							contact: `555-555-000${i}`,
							cleanersNeeded: 1,
							timeToBeCompleted: "2",
							isSetupComplete: true,
						});
						createdCount++;
					}

					// Calculate price for this home
					let soloPrice = 150; // Base
					soloPrice += Math.max(0, config.beds - 1) * 50; // Extra beds
					soloPrice += Math.max(0, config.baths - 1) * 50; // Extra baths
					// Add towels
					soloPrice += config.baths * 13;

					// Create unassigned appointment (shows in Find Jobs)
					const soloJobDate = this.getFutureDate(3 + i * 2); // 3, 5, 7 days from now

					// Check if appointment already exists for this home on this date
					const existingSoloAppt = await UserAppointments.findOne({
						where: {
							userId: soloHomeowner.id,
							homeId: soloHome.id,
							date: soloJobDate,
							hasBeenAssigned: false,
						},
					});

					if (!existingSoloAppt) {
						await UserAppointments.create({
							userId: soloHomeowner.id,
							homeId: soloHome.id,
							date: soloJobDate,
							price: String(soloPrice),
							paid: false,
							bringTowels: "yes",
							bringSheets: "no",
							completed: false,
							hasBeenAssigned: false,
							employeesAssigned: [],
							empoyeesNeeded: 1,
							timeToBeCompleted: "2",
							paymentStatus: "pending",
							amountPaid: 0,
							isMultiCleanerJob: false,
						});
						createdCount++;
						console.log(`    Created solo job: $${soloPrice} (${config.beds} bed, ${config.baths} bath) in ${config.city}`);
					}
				}
				console.log("    Created solo jobs for Find Jobs");
			} catch (error) {
				console.error("  - Error creating solo jobs:", error.message);
			}

			// --- RECREATE EMPLOYEE JOB ASSIGNMENTS ---
			if (demoBusinessEmployee && demoBusinessOwner) {
				console.log("  - Creating job assignments for demo employee...");

				// Find client homes
				const clientHomes = await Home.findAll({
					include: [{
						model: User,
						as: "user",
						where: { isDemoAccount: true },
					}],
					limit: 5,
				});

				if (clientHomes.length > 0) {
					const assignmentDays = [0, 1, 2, 4, 6]; // Today, tomorrow, etc.

					for (let i = 0; i < 5; i++) {
						const jobDate = this.getFutureDate(assignmentDays[i]);
						const home = clientHomes[i % clientHomes.length];
						const jobPrice = 150 + (i * 10);

						// Create appointment
						const appointment = await UserAppointments.create({
							userId: home.userId,
							homeId: home.id,
							date: jobDate,
							price: String(jobPrice),
							paid: false,
							bringTowels: "yes",
							bringSheets: i % 2 === 0 ? "yes" : "no",
							completed: false,
							hasBeenAssigned: true,
							employeesAssigned: [demoEmployee.id.toString()],
							empoyeesNeeded: 1,
							timeToBeCompleted: String(2 + (i % 2)),
							paymentStatus: "pending",
						});
						createdCount++;

						// Create job assignment
						await EmployeeJobAssignment.create({
							businessOwnerId: demoBusinessOwner.id,
							businessEmployeeId: demoBusinessEmployee.id,
							appointmentId: appointment.id,
							assignedBy: demoBusinessOwner.id,
							status: "assigned",
							payAmount: Math.round(jobPrice * 0.7 * 100),
							payType: "flat_rate",
						});
						createdCount++;
					}
					console.log("    Created 5 job assignments");
				}

				// Note: Employee earnings are tracked via EmployeeJobAssignment.payAmount, not Payouts
				// The job assignments above already include payAmount for the employee
			}

			// --- RECREATE BUSINESS CLIENT APPOINTMENTS AND DATA ---
			if (demoBusinessClient && demoBusinessOwner && demoEmployee) {
				console.log("  - Creating data for demo business client...");

				// Get business client's home
				const businessClientHomes = await Home.findAll({
					where: { userId: demoBusinessClient.id },
				});

				const clientPastAppointmentIds = [];
				if (businessClientHomes.length > 0) {
					const clientHome = businessClientHomes[0];

					// Create 2 past completed appointments
					for (let i = 1; i <= 2; i++) {
						const pastDate = this.getPastDate(i * 7);
						const appointment = await UserAppointments.create({
							userId: demoBusinessClient.id,
							homeId: clientHome.id,
							date: pastDate,
							price: "160",
							paid: true,
							bringTowels: "yes",
							bringSheets: "no",
							completed: true,
							hasBeenAssigned: true,
							employeesAssigned: [demoEmployee.id.toString()],
							empoyeesNeeded: 1,
							timeToBeCompleted: "2.5",
							paymentStatus: "paid",
							amountPaid: 16000,
							completionStatus: "approved",
							cleanerId: demoBusinessOwner.id,
						});
						clientPastAppointmentIds.push(appointment.id);
						createdCount++;

						// Create job assignment for past appointment
						await EmployeeJobAssignment.create({
							businessOwnerId: demoBusinessOwner.id,
							businessEmployeeId: demoBusinessEmployee.id,
							appointmentId: appointment.id,
							assignedBy: demoBusinessOwner.id,
							status: "completed",
							payAmount: Math.round(160 * 0.7 * 100),
							payType: "flat_rate",
							completedAt: pastDate,
						});
						createdCount++;
					}
					console.log("    Created 2 past appointments for business client");

					// Create 3 upcoming appointments (today, 3 days, 1 week)
					const upcomingDays = [0, 3, 7];
					const times = ["09:00", "11:00", "14:00"];
					for (let i = 0; i < 3; i++) {
						const futureDate = this.getFutureDate(upcomingDays[i]);
						const appointment = await UserAppointments.create({
							userId: demoBusinessClient.id,
							homeId: clientHome.id,
							date: futureDate,
							price: "160",
							paid: false,
							bringTowels: "yes",
							bringSheets: i === 0 ? "yes" : "no",
							completed: false,
							hasBeenAssigned: true,
							employeesAssigned: [demoEmployee.id.toString()],
							empoyeesNeeded: 1,
							timeToBeCompleted: "2.5",
							paymentStatus: "pending",
							amountPaid: 0,
							cleanerId: demoBusinessOwner.id,
						});
						createdCount++;

						// Create job assignment for upcoming appointment
						await EmployeeJobAssignment.create({
							businessOwnerId: demoBusinessOwner.id,
							businessEmployeeId: demoBusinessEmployee.id,
							appointmentId: appointment.id,
							assignedBy: demoBusinessOwner.id,
							status: "assigned",
							payAmount: Math.round(160 * 0.7 * 100),
							payType: "flat_rate",
						});
						createdCount++;
					}
					console.log("    Created 3 upcoming appointments for business client");
				}

				// Create reviews from business client to business owner
				const clientReviews = [
					{ rating: 5, comment: "Demo Cleaning Co always does an amazing job! Very professional team." },
					{ rating: 5, comment: "Love working with this company. The employee assigned to my home is wonderful." },
				];

				for (let i = 0; i < clientReviews.length && i < clientPastAppointmentIds.length; i++) {
					await UserReviews.create({
						userId: demoBusinessOwner.id,
						reviewerId: demoBusinessClient.id,
						appointmentId: clientPastAppointmentIds[i],
						review: clientReviews[i].rating,
						reviewComment: clientReviews[i].comment,
						reviewType: "homeowner_to_cleaner",
						createdAt: new Date(Date.now() - ((i + 1) * 7 * 24 * 60 * 60 * 1000)),
					});
					createdCount++;
				}
				console.log("    Created 2 reviews for business owner from business client");
			}

			// Update business owner stats
			if (demoBusinessOwner) {
				await demoBusinessOwner.update({ avgRating: 4.9, totalReviews: 25 });
			}

			// --- RECREATE HR DEMO SCENARIOS ---
			if (demoHR && demoHomeowner && demoCleaner) {
				console.log("  - Creating HR demo scenarios...");

				const homeownerHome = await Home.findOne({
					where: { userId: demoHomeowner.id },
				});

				if (homeownerHome) {
					// SCENARIO 1: Medical Emergency Appeal (Homeowner) - Under Review
					const cancelledAppt1 = await UserAppointments.create({
						userId: demoHomeowner.id,
						homeId: homeownerHome.id,
						date: this.getPastDate(3),
						price: "180",
						paid: false,
						bringTowels: "yes",
						bringSheets: "no",
						completed: false,
						hasBeenAssigned: true,
						employeesAssigned: [demoCleaner.id.toString()],
						empoyeesNeeded: 1,
						timeToBeCompleted: "3",
						wasCancelled: true,
						cancellationType: "homeowner",
						cancellationReason: "Medical emergency - had to rush to hospital",
						cancellationInitiatedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
						cancellationConfirmedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
						cancellationConfirmationId: "CXL-DEMO-001",
						hasActiveAppeal: true,
					});
					createdCount++;

					const appeal1 = await CancellationAppeal.create({
						appointmentId: cancelledAppt1.id,
						appealerId: demoHomeowner.id,
						appealerType: "homeowner",
						category: "medical_emergency",
						severity: "high",
						description: "I had to cancel because my elderly mother fell and broke her hip. I had to rush her to the emergency room and stayed with her for surgery.",
						supportingDocuments: [
							{ type: "hospital_admission", filename: "hospital_admission.pdf", uploadedAt: new Date().toISOString() },
						],
						contestingItems: { cancellationFee: true, rating: false },
						originalPenaltyAmount: 5000,
						originalRefundWithheld: 0,
						requestedRelief: "Full waiver of the $50 cancellation fee due to medical emergency",
						status: "under_review",
						priority: "high",
						assignedTo: demoHR.id,
						assignedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
						submittedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
						slaDeadline: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000),
						lastActivityAt: new Date(),
					});
					await cancelledAppt1.update({ appealId: appeal1.id });
					createdCount++;

					// SCENARIO 2: Transportation Issue (Cleaner) - Awaiting Documents
					const cancelledAppt2 = await UserAppointments.create({
						userId: demoHomeowner.id,
						homeId: homeownerHome.id,
						date: this.getPastDate(5),
						price: "180",
						paid: false,
						bringTowels: "no",
						bringSheets: "no",
						completed: false,
						hasBeenAssigned: true,
						employeesAssigned: [demoCleaner.id.toString()],
						empoyeesNeeded: 1,
						timeToBeCompleted: "3",
						wasCancelled: true,
						cancellationType: "cleaner",
						cancellationReason: "Car broke down on the way to appointment",
						cancellationInitiatedAt: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000),
						cancellationConfirmedAt: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000),
						cancellationConfirmationId: "CXL-DEMO-002",
						hasActiveAppeal: true,
					});
					createdCount++;

					const appeal2 = await CancellationAppeal.create({
						appointmentId: cancelledAppt2.id,
						appealerId: demoCleaner.id,
						appealerType: "cleaner",
						category: "transportation",
						severity: "medium",
						description: "My car's transmission failed while I was driving to the appointment. I was stranded on the highway.",
						supportingDocuments: [],
						contestingItems: { penaltyRating: true, restrictionFromJobs: true },
						originalPenaltyAmount: 0,
						originalRefundWithheld: 0,
						requestedRelief: "Remove the penalty rating impact and job restriction",
						status: "awaiting_documents",
						priority: "normal",
						assignedTo: demoHR.id,
						assignedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
						submittedAt: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000),
						slaDeadline: new Date(Date.now() + 20 * 60 * 60 * 1000),
						lastActivityAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
						reviewDecision: "Requested documentation: tow truck receipt and mechanic's invoice.",
					});
					await cancelledAppt2.update({ appealId: appeal2.id });
					createdCount++;

					// SCENARIO 3: Overdue Appeal (Past SLA)
					const cancelledAppt4 = await UserAppointments.create({
						userId: demoHomeowner.id,
						homeId: homeownerHome.id,
						date: this.getPastDate(7),
						price: "200",
						paid: false,
						bringTowels: "no",
						bringSheets: "no",
						completed: false,
						hasBeenAssigned: true,
						employeesAssigned: [demoCleaner.id.toString()],
						empoyeesNeeded: 1,
						timeToBeCompleted: "4",
						wasCancelled: true,
						cancellationType: "homeowner",
						cancellationReason: "Family emergency - death in family",
						cancellationInitiatedAt: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000),
						cancellationConfirmedAt: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000),
						cancellationConfirmationId: "CXL-DEMO-004",
						hasActiveAppeal: true,
					});
					createdCount++;

					const appeal4 = await CancellationAppeal.create({
						appointmentId: cancelledAppt4.id,
						appealerId: demoHomeowner.id,
						appealerType: "homeowner",
						category: "family_emergency",
						severity: "critical",
						description: "My father passed away unexpectedly and I had to fly out of state immediately.",
						supportingDocuments: [
							{ type: "flight_confirmation", filename: "flight_booking.pdf", uploadedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString() },
						],
						contestingItems: { cancellationFee: true, rating: true },
						originalPenaltyAmount: 6000,
						originalRefundWithheld: 0,
						requestedRelief: "Full waiver of fee and removal of rating impact",
						status: "submitted",
						priority: "urgent",
						submittedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
						slaDeadline: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
						lastActivityAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
					});
					await cancelledAppt4.update({ appealId: appeal4.id });
					createdCount++;

					// SCENARIO 4: Home Size Adjustment Dispute
					const disputeAppt = await UserAppointments.create({
						userId: demoHomeowner.id,
						homeId: homeownerHome.id,
						date: this.getPastDate(2),
						price: "150",
						paid: true,
						bringTowels: "yes",
						bringSheets: "no",
						completed: true,
						hasBeenAssigned: true,
						employeesAssigned: [demoCleaner.id.toString()],
						empoyeesNeeded: 1,
						timeToBeCompleted: "3",
						paymentStatus: "paid",
						amountPaid: 15000,
						completionStatus: "approved",
					});
					createdCount++;

					await HomeSizeAdjustmentRequest.create({
						appointmentId: disputeAppt.id,
						homeId: homeownerHome.id,
						cleanerId: demoCleaner.id,
						homeownerId: demoHomeowner.id,
						originalNumBeds: "3",
						originalNumBaths: "2",
						originalPrice: 150.00,
						reportedNumBeds: "5",
						reportedNumBaths: "3",
						calculatedNewPrice: 220.00,
						priceDifference: 70.00,
						status: "pending_owner",
						cleanerNote: "This home is much larger than listed. It has 5 bedrooms including a converted basement.",
						homeownerResponse: "I disagree - the basement rooms are storage, not bedrooms.",
						expiresAt: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
					});
					createdCount++;

					console.log("    Created 4 HR scenarios (2 active appeals, 1 overdue, 1 dispute)");
				}
			}

			// --- RECREATE MULTI-CLEANER JOB FOR DEMO CLEANER ---
			// Create an available multi-cleaner job that the demo cleaner can join
			console.log("  - Creating multi-cleaner job opportunity...");
			try {
				// Create a large home homeowner for the multi-cleaner job
				let multiCleanerHomeowner = await User.findOne({
					where: { username: "demo_large_home_owner" },
				});

				if (!multiCleanerHomeowner) {
					multiCleanerHomeowner = await User.create({
						username: "demo_large_home_owner",
						email: "demo_large_home@sparkle.demo",
						firstName: "Robert",
						lastName: "Mansion",
						password: "$2b$10$demo_password_hash", // Will be reset by seeder
						type: null, // homeowner
						isDemoAccount: true,
						hasPaymentMethod: true,
					});
				}

				// Create a large home that requires 2 cleaners
				let largeHome = await Home.findOne({
					where: { userId: multiCleanerHomeowner.id, nickName: "The Mansion" },
				});

				if (!largeHome) {
					largeHome = await Home.create({
						userId: multiCleanerHomeowner.id,
						nickName: "The Mansion",
						address: "1 Beverly Hills Drive",
						city: "Beverly Hills",
						state: "CA",
						zipcode: "90210",
						numBeds: "7",
						numBaths: "6",
						numHalfBaths: "2",
						sqft: 8500,
						hasGate: true,
						gateCode: "9999",
						hasDog: false,
						hasCat: false,
						accessNotes: "Large estate - use side entrance for service. Gate code is 9999.",
						latitude: 34.0901,
						longitude: -118.4065,
						contact: "555-999-0001",
						timeToBeCompleted: "6",
					});
				}

				// Create appointment for the multi-cleaner job (3 days from now)
				const multiCleanerDate = this.getFutureDate(3);
				let multiCleanerAppointment = await UserAppointments.findOne({
					where: {
						homeId: largeHome.id,
						isMultiCleanerJob: true,
						completed: false,
					},
				});

				if (!multiCleanerAppointment) {
					// Price for 7 bed, 6 bath, 2 half bath mansion with sheets and towels = $1,051
					// Base $150 + 6 extra beds ($300) + 5 extra baths ($250) + 2 half baths ($50) + 7 sheets ($210) + towels ($91) = $1,051
					const mansionPriceDollars = 1051;
					multiCleanerAppointment = await UserAppointments.create({
						userId: multiCleanerHomeowner.id,
						homeId: largeHome.id,
						date: multiCleanerDate,
						price: String(mansionPriceDollars),
						paid: false,
						bringTowels: "yes",
						bringSheets: "yes",
						completed: false,
						hasBeenAssigned: false,
						employeesAssigned: [],
						empoyeesNeeded: 2,
						timeToBeCompleted: "6",
						paymentStatus: "pending",
						amountPaid: 0,
						isMultiCleanerJob: true,
					});
					createdCount++;
				}

				// Create the MultiCleanerJob record
				let multiCleanerJob = await MultiCleanerJob.findOne({
					where: { appointmentId: multiCleanerAppointment.id },
				});

				if (!multiCleanerJob) {
					multiCleanerJob = await MultiCleanerJob.create({
						appointmentId: multiCleanerAppointment.id,
						totalCleanersRequired: 2,
						cleanersConfirmed: 0,
						status: "open",
						isAutoGenerated: true,
						totalEstimatedMinutes: 360, // 6 hours
						openedToMarketAt: new Date(),
					});
					createdCount++;

					// Update appointment with multi-cleaner job ID
					await multiCleanerAppointment.update({ multiCleanerJobId: multiCleanerJob.id });
				}

				// Create an offer for the demo cleaner so they can see and accept it
				if (demoCleaner && multiCleanerJob) {
					const existingOffer = await CleanerJobOffer.findOne({
						where: {
							multiCleanerJobId: multiCleanerJob.id,
							cleanerId: demoCleaner.id,
						},
					});

					if (!existingOffer) {
						// Per-cleaner earnings: $1,051 * 87% (13% platform fee) / 2 cleaners = $457.19 = 45719 cents
						const perCleanerEarnings = 45719;
						await CleanerJobOffer.create({
							multiCleanerJobId: multiCleanerJob.id,
							cleanerId: demoCleaner.id,
							appointmentId: multiCleanerAppointment.id,
							offerType: "market_open",
							status: "pending",
							earningsOffered: perCleanerEarnings,
							roomsOffered: JSON.stringify(["kitchen", "living_room", "dining_room", "3_bathrooms"]),
							offeredAt: new Date(),
							expiresAt: new Date(Date.now() + 48 * 60 * 60 * 1000), // 48 hours from now
						});
						createdCount++;
					}
				}

				console.log("    Created multi-cleaner job opportunity for demo cleaner");
			} catch (error) {
				console.error("  - Error creating multi-cleaner job:", error.message);
			}

			console.log(`[DemoAccountService] Demo data reset complete. Deleted: ${deletedCount}, Created: ${createdCount}`);

			return {
				success: true,
				deleted: deletedCount,
				created: createdCount,
				message: "Demo data has been reset to original state",
			};
		} catch (error) {
			console.error("[DemoAccountService] Error resetting demo data:", error);
			return {
				success: false,
				error: error.message,
			};
		}
	}
}

module.exports = DemoAccountService;
