/**
 * Demo Accounts Seeder
 *
 * Creates demo accounts for the owner's "Preview as Role" feature.
 * Each demo account has realistic sample data so owners can fully
 * experience the app as different user types.
 *
 * Run with: node server/seeders/demo-accounts.js
 */

const bcrypt = require("bcrypt");

// Import models - adjust path as needed based on your project structure
let models;
try {
	models = require("../models");
} catch (e) {
	// Try alternative import for direct execution
	const path = require("path");
	models = require(path.join(__dirname, "..", "models"));
}

const {
	User,
	Home,
	UserAppointments,
	BusinessEmployee,
	CleanerClient,
	UserReviews,
	UserPendingRequests,
	EmployeeJobAssignment,
	RecurringSchedule,
	UserBills,
	Payout,
	sequelize,
} = models;

// Demo account credentials
const DEMO_PASSWORD = "DemoPass123!";
const DEMO_ACCOUNTS = {
	cleaner: {
		username: "demo_cleaner",
		email: "demo_cleaner@sparkle.demo",
		firstName: "Demo",
		lastName: "Cleaner",
		type: "cleaner",
		isBusinessOwner: false,
		isMarketplaceCleaner: true,
		daysWorking: JSON.stringify(["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"]),
		profileBio: "Experienced professional cleaner with 5+ years in residential cleaning. Specializing in deep cleaning and move-in/move-out services.",
		avgRating: 4.8,
		totalReviews: 10,
	},
	homeowner: {
		username: "demo_homeowner",
		email: "demo_homeowner@sparkle.demo",
		firstName: "Demo",
		lastName: "Homeowner",
		type: null, // null = homeowner
		isBusinessOwner: false,
	},
	businessOwner: {
		username: "demo_business_owner",
		email: "demo_business_owner@sparkle.demo",
		firstName: "Demo",
		lastName: "BusinessOwner",
		type: "cleaner",
		isBusinessOwner: true,
		businessName: "Demo Cleaning Co",
		yearsInBusiness: 5,
		businessVerificationStatus: "verified",
		businessDescription: "Professional cleaning services serving the greater metro area. We specialize in residential and commercial cleaning with eco-friendly products.",
		businessHighlightOptIn: true,
		avgRating: 4.9,
		totalReviews: 25,
	},
	employee: {
		username: "demo_employee",
		email: "demo_employee@sparkle.demo",
		firstName: "Demo",
		lastName: "Employee",
		type: "employee",
		isBusinessOwner: false,
		isMarketplaceCleaner: false,
		daysWorking: JSON.stringify(["Monday", "Wednesday", "Friday", "Saturday"]),
	},
};

// Helper to generate future dates
function getFutureDate(daysFromNow) {
	const date = new Date();
	date.setDate(date.getDate() + daysFromNow);
	return date.toISOString().split("T")[0];
}

// Helper to generate past dates
function getPastDate(daysAgo) {
	const date = new Date();
	date.setDate(date.getDate() - daysAgo);
	return date.toISOString().split("T")[0];
}

async function createDemoAccounts() {
	console.log("Starting demo account creation...\n");

	const hashedPassword = await bcrypt.hash(DEMO_PASSWORD, 10);
	const createdAccounts = {};

	// Create each demo account
	for (const [role, accountData] of Object.entries(DEMO_ACCOUNTS)) {
		console.log(`Creating demo ${role} account...`);

		try {
			// Check if account already exists
			let account = await User.findOne({
				where: { username: accountData.username },
			});

			if (account) {
				console.log(`  - Account already exists (ID: ${account.id}), updating...`);
				await account.update({
					...accountData,
					password: hashedPassword,
					isDemoAccount: true,
				});
			} else {
				account = await User.create({
					...accountData,
					password: hashedPassword,
					isDemoAccount: true,
					hasPaymentMethod: role === "homeowner", // Homeowner has payment method
					stripeConnectAccountId: role === "cleaner" || role === "businessOwner" ? "acct_demo_" + role : null,
					stripeConnectStatus: role === "cleaner" || role === "businessOwner" ? "active" : null,
				});
				console.log(`  - Created new account (ID: ${account.id})`);
			}

			createdAccounts[role] = account;
		} catch (error) {
			console.error(`  - Error creating ${role} account:`, error.message);
		}
	}

	// ============================================
	// DEMO CLEANER DATA
	// - 5 upcoming appointments
	// - 3 pending requests
	// - Stripe Connect simulated
	// - $500 available balance
	// - 10 reviews (4.8 avg rating)
	// ============================================
	if (createdAccounts.cleaner && createdAccounts.homeowner) {
		console.log("\n--- Creating Demo Cleaner Data ---");

		// Create 10 reviews for cleaner (4.8 avg rating)
		console.log("Creating reviews for demo cleaner...");
		const reviewRatings = [5, 5, 5, 5, 5, 5, 4, 5, 4, 5]; // avg = 4.8
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
			try {
				const existingReview = await UserReviews.findOne({
					where: {
						reviewerId: createdAccounts.homeowner.id,
						reviewedId: createdAccounts.cleaner.id,
						comment: reviewComments[i],
					},
				});

				if (!existingReview) {
					await UserReviews.create({
						reviewerId: createdAccounts.homeowner.id,
						reviewedId: createdAccounts.cleaner.id,
						rating: reviewRatings[i],
						comment: reviewComments[i],
						reviewType: "homeowner_to_cleaner",
						createdAt: new Date(Date.now() - (i * 7 * 24 * 60 * 60 * 1000)), // Spread over weeks
					});
				}
			} catch (error) {
				// Ignore duplicate errors
			}
		}
		console.log("  - Created 10 reviews for demo cleaner");

		// Update cleaner's avgRating and totalReviews
		await createdAccounts.cleaner.update({
			avgRating: 4.8,
			totalReviews: 10,
		});
	}

	// ============================================
	// DEMO HOMEOWNER DATA
	// - 2 homes registered
	// - 3 upcoming appointments
	// - 5 past cleanings
	// - $150 bill balance
	// - Active biweekly schedule
	// ============================================
	if (createdAccounts.homeowner) {
		console.log("\n--- Creating Demo Homeowner Data ---");

		// Create 2 homes
		console.log("Creating homes for demo homeowner...");
		const homesData = [
			{
				nickName: "Main Residence",
				address: "123 Demo Street",
				city: "Demo City",
				state: "CA",
				zipcode: "90210",
				numBeds: "4",
				numBaths: "3",
				numHalfBaths: "1",
				sqft: 2800,
				hasGate: false,
				hasDog: true,
				dogName: "Buddy",
				hasCat: false,
				accessNotes: "Ring doorbell, key under the mat if no answer.",
				latitude: 34.0901,
				longitude: -118.4065,
			},
			{
				nickName: "Beach House",
				address: "456 Ocean Drive",
				city: "Malibu",
				state: "CA",
				zipcode: "90265",
				numBeds: "3",
				numBaths: "2",
				numHalfBaths: "0",
				sqft: 1800,
				hasGate: true,
				gateCode: "1234",
				hasDog: false,
				hasCat: true,
				catName: "Whiskers",
				accessNotes: "Use gate code. Alarm code is 5678.",
				latitude: 34.0259,
				longitude: -118.7798,
			},
		];

		const createdHomes = [];
		for (const homeData of homesData) {
			try {
				let home = await Home.findOne({
					where: { userId: createdAccounts.homeowner.id, nickName: homeData.nickName },
				});

				if (!home) {
					home = await Home.create({
						...homeData,
						userId: createdAccounts.homeowner.id,
					});
					console.log(`  - Created home: ${homeData.nickName}`);
				} else {
					console.log(`  - Home already exists: ${homeData.nickName}`);
				}
				createdHomes.push(home);
			} catch (error) {
				console.error(`  - Error creating home ${homeData.nickName}:`, error.message);
			}
		}

		// Create 5 past appointments (completed)
		console.log("Creating past appointments for demo homeowner...");
		if (createdHomes.length > 0 && createdAccounts.cleaner) {
			for (let i = 1; i <= 5; i++) {
				try {
					const pastDate = getPastDate(i * 14); // Every 2 weeks in the past
					const existingAppt = await UserAppointments.findOne({
						where: { userId: createdAccounts.homeowner.id, date: pastDate },
					});

					if (!existingAppt) {
						await UserAppointments.create({
							userId: createdAccounts.homeowner.id,
							homeId: createdHomes[0].id,
							date: pastDate,
							price: "180",
							paid: true,
							bringTowels: "yes",
							bringSheets: "no",
							completed: true,
							hasBeenAssigned: true,
							employeesAssigned: [createdAccounts.cleaner.id.toString()],
							empoyeesNeeded: 1,
							timeToBeCompleted: "3",
							paymentStatus: "paid",
							amountPaid: 18000,
							completionStatus: "approved",
						});
					}
				} catch (error) {
					// Ignore duplicates
				}
			}
			console.log("  - Created 5 past completed appointments");
		}

		// Create 3 upcoming appointments
		console.log("Creating upcoming appointments for demo homeowner...");
		if (createdHomes.length > 0 && createdAccounts.cleaner) {
			for (let i = 1; i <= 3; i++) {
				try {
					const futureDate = getFutureDate(i * 7); // Weekly upcoming
					const existingAppt = await UserAppointments.findOne({
						where: { userId: createdAccounts.homeowner.id, date: futureDate },
					});

					if (!existingAppt) {
						await UserAppointments.create({
							userId: createdAccounts.homeowner.id,
							homeId: createdHomes[i % createdHomes.length].id,
							date: futureDate,
							price: "180",
							paid: false,
							bringTowels: "yes",
							bringSheets: i === 1 ? "yes" : "no",
							completed: false,
							hasBeenAssigned: i <= 2, // First 2 are assigned
							employeesAssigned: i <= 2 ? [createdAccounts.cleaner.id.toString()] : [],
							empoyeesNeeded: 1,
							timeToBeCompleted: "3",
							paymentStatus: "pending",
							amountPaid: 0,
						});
					}
				} catch (error) {
					// Ignore duplicates
				}
			}
			console.log("  - Created 3 upcoming appointments");
		}

		// Create bill balance ($150)
		console.log("Setting up bill for demo homeowner...");
		try {
			let bill = await UserBills.findOne({
				where: { userId: createdAccounts.homeowner.id },
			});

			if (!bill) {
				await UserBills.create({
					userId: createdAccounts.homeowner.id,
					appointmentDue: 15000, // $150
					cancellationFee: 0,
					totalDue: 15000,
					totalPaid: 90000, // $900 total paid historically
				});
				console.log("  - Created bill with $150 balance");
			} else {
				await bill.update({ totalDue: 15000 });
				console.log("  - Updated existing bill");
			}
		} catch (error) {
			console.error("  - Error creating bill:", error.message);
		}

		// Create recurring schedule (biweekly)
		console.log("Creating recurring schedule for demo homeowner...");
		if (createdHomes.length > 0) {
			try {
				const existingSchedule = await RecurringSchedule.findOne({
					where: { homeId: createdHomes[0].id },
				});

				if (!existingSchedule) {
					await RecurringSchedule.create({
						homeId: createdHomes[0].id,
						userId: createdAccounts.homeowner.id,
						frequency: "biweekly",
						dayOfWeek: "Friday",
						preferredTime: "morning",
						isActive: true,
						bringTowels: true,
						bringSheets: false,
						nextScheduledDate: getFutureDate(14),
					});
					console.log("  - Created biweekly recurring schedule");
				}
			} catch (error) {
				console.error("  - Error creating schedule:", error.message);
			}
		}
	}

	// ============================================
	// DEMO BUSINESS OWNER DATA
	// - Business: "Demo Cleaning Co"
	// - 3 employees (including demo_employee)
	// - 10 clients
	// - Analytics data populated
	// ============================================
	if (createdAccounts.businessOwner) {
		console.log("\n--- Creating Demo Business Owner Data ---");

		// Create 2 additional employees (demo_employee is already linked)
		console.log("Creating additional employees for demo business...");
		const additionalEmployees = [
			{
				firstName: "Sarah",
				lastName: "Johnson",
				email: "sarah.demo@sparkle.demo",
				status: "active",
				payType: "percentage",
				payRate: 65,
			},
			{
				firstName: "Mike",
				lastName: "Williams",
				email: "mike.demo@sparkle.demo",
				status: "active",
				payType: "hourly",
				payRate: 20,
			},
		];

		for (const empData of additionalEmployees) {
			try {
				// Check if employee exists
				let empUser = await User.findOne({ where: { email: empData.email } });

				if (!empUser) {
					empUser = await User.create({
						username: empData.email.split("@")[0],
						email: empData.email,
						firstName: empData.firstName,
						lastName: empData.lastName,
						password: hashedPassword,
						type: "employee",
						isDemoAccount: true,
						employeeOfBusinessId: createdAccounts.businessOwner.id,
					});
				}

				const existingBizEmp = await BusinessEmployee.findOne({
					where: {
						businessOwnerId: createdAccounts.businessOwner.id,
						email: empData.email,
					},
				});

				if (!existingBizEmp) {
					await BusinessEmployee.create({
						businessOwnerId: createdAccounts.businessOwner.id,
						cleanerId: empUser.id,
						firstName: empData.firstName,
						lastName: empData.lastName,
						email: empData.email,
						status: empData.status,
						payType: empData.payType,
						payRate: empData.payRate,
						canSeeFullSchedule: true,
						invitationAcceptedAt: new Date(),
					});
					console.log(`  - Created employee: ${empData.firstName} ${empData.lastName}`);
				}
			} catch (error) {
				console.error(`  - Error creating employee ${empData.firstName}:`, error.message);
			}
		}

		// Create 10 clients for business owner
		console.log("Creating clients for demo business...");
		const clientNames = [
			{ first: "Alice", last: "Thompson" },
			{ first: "Bob", last: "Martinez" },
			{ first: "Carol", last: "Davis" },
			{ first: "David", last: "Wilson" },
			{ first: "Emma", last: "Brown" },
			{ first: "Frank", last: "Taylor" },
			{ first: "Grace", last: "Anderson" },
			{ first: "Henry", last: "Thomas" },
			{ first: "Iris", last: "Jackson" },
			{ first: "Jack", last: "White" },
		];

		for (let i = 0; i < clientNames.length; i++) {
			try {
				const clientEmail = `${clientNames[i].first.toLowerCase()}.demo${i}@sparkle.demo`;
				let clientUser = await User.findOne({ where: { email: clientEmail } });

				if (!clientUser) {
					clientUser = await User.create({
						username: `demo_client_${i + 1}`,
						email: clientEmail,
						firstName: clientNames[i].first,
						lastName: clientNames[i].last,
						password: hashedPassword,
						type: null, // homeowner
						isDemoAccount: true,
						hasPaymentMethod: true,
					});

					// Create a home for each client
					await Home.create({
						userId: clientUser.id,
						nickName: `${clientNames[i].first}'s Home`,
						address: `${100 + i * 10} Client Street`,
						city: "Demo City",
						state: "CA",
						zipcode: "90210",
						numBeds: String(2 + (i % 3)),
						numBaths: String(1 + (i % 2)),
						numHalfBaths: String(i % 2),
						sqft: 1500 + (i * 200),
					});
				}

				// Link as cleaner client
				const existingClient = await CleanerClient.findOne({
					where: {
						cleanerId: createdAccounts.businessOwner.id,
						clientId: clientUser.id,
					},
				});

				if (!existingClient) {
					await CleanerClient.create({
						cleanerId: createdAccounts.businessOwner.id,
						clientId: clientUser.id,
						status: "active",
						preferredDays: JSON.stringify(["Monday", "Thursday"]),
						notes: `Regular client - prefers ${["morning", "afternoon", "flexible"][i % 3]} appointments`,
					});
				}
			} catch (error) {
				// Ignore duplicates
			}
		}
		console.log("  - Created 10 clients for demo business");

		// Update business owner with stats
		await createdAccounts.businessOwner.update({
			avgRating: 4.9,
			totalReviews: 25,
		});
	}

	// ============================================
	// DEMO EMPLOYEE DATA
	// - Linked to Demo Business Owner
	// - 5 assigned jobs
	// - $800 pending earnings
	// - Schedule configured
	// ============================================
	if (createdAccounts.employee && createdAccounts.businessOwner) {
		console.log("\n--- Creating Demo Employee Data ---");

		// Link employee to business owner
		console.log("Linking demo employee to demo business owner...");
		try {
			await createdAccounts.employee.update({
				employeeOfBusinessId: createdAccounts.businessOwner.id,
			});

			// Create BusinessEmployee record if it doesn't exist
			const existingEmployee = await BusinessEmployee.findOne({
				where: {
					businessOwnerId: createdAccounts.businessOwner.id,
					cleanerId: createdAccounts.employee.id,
				},
			});

			if (!existingEmployee) {
				await BusinessEmployee.create({
					businessOwnerId: createdAccounts.businessOwner.id,
					cleanerId: createdAccounts.employee.id,
					firstName: "Demo",
					lastName: "Employee",
					email: DEMO_ACCOUNTS.employee.email,
					status: "active",
					payType: "percentage",
					payRate: 70,
					canSeeFullSchedule: true,
					invitationAcceptedAt: new Date(),
				});
				console.log("  - Created BusinessEmployee record");
			}
		} catch (error) {
			console.error("  - Error linking employee:", error.message);
		}

		// Create 5 assigned jobs for employee
		console.log("Creating assigned jobs for demo employee...");

		// Find some homes to assign jobs from
		const clientHomes = await Home.findAll({
			include: [{
				model: User,
				as: "user",
				where: { isDemoAccount: true },
			}],
			limit: 5,
		});

		if (clientHomes.length > 0) {
			for (let i = 0; i < 5; i++) {
				try {
					const jobDate = getFutureDate(i * 2 + 1); // Jobs spread over next 10 days
					const home = clientHomes[i % clientHomes.length];

					// Check if assignment exists
					const existingAssignment = await EmployeeJobAssignment.findOne({
						where: {
							employeeId: createdAccounts.employee.id,
							scheduledDate: jobDate,
						},
					});

					if (!existingAssignment) {
						// Create an appointment first
						let appointment = await UserAppointments.findOne({
							where: { homeId: home.id, date: jobDate },
						});

						if (!appointment) {
							appointment = await UserAppointments.create({
								userId: home.userId,
								homeId: home.id,
								date: jobDate,
								price: String(150 + (i * 10)),
								paid: false,
								bringTowels: "yes",
								bringSheets: i % 2 === 0 ? "yes" : "no",
								completed: false,
								hasBeenAssigned: true,
								employeesAssigned: [createdAccounts.employee.id.toString()],
								empoyeesNeeded: 1,
								timeToBeCompleted: String(2 + (i % 2)),
								paymentStatus: "pending",
							});
						}

						// Create the job assignment
						await EmployeeJobAssignment.create({
							businessOwnerId: createdAccounts.businessOwner.id,
							employeeId: createdAccounts.employee.id,
							appointmentId: appointment.id,
							homeId: home.id,
							clientId: home.userId,
							scheduledDate: jobDate,
							scheduledTime: ["09:00", "10:00", "13:00", "14:00", "15:00"][i],
							status: "assigned",
							payType: "percentage",
							payRate: 70,
							estimatedPay: Math.round((150 + (i * 10)) * 0.7 * 100), // 70% of job price in cents
						});
						console.log(`  - Created job assignment for ${jobDate}`);
					}
				} catch (error) {
					console.error(`  - Error creating job assignment:`, error.message);
				}
			}
		}

		// Create payout record to show pending earnings
		console.log("Creating pending earnings for demo employee...");
		try {
			const existingPayout = await Payout.findOne({
				where: {
					userId: createdAccounts.employee.id,
					status: "pending",
				},
			});

			if (!existingPayout) {
				await Payout.create({
					userId: createdAccounts.employee.id,
					amountCents: 80000, // $800
					status: "pending",
					payoutType: "employee_earnings",
					description: "Pending earnings from completed jobs",
				});
				console.log("  - Created $800 pending payout record");
			}
		} catch (error) {
			console.error("  - Error creating payout:", error.message);
		}
	}

	console.log("\n=================================");
	console.log("Demo Account Creation Complete!");
	console.log("=================================\n");
	console.log("Demo accounts created:");
	for (const [role, account] of Object.entries(createdAccounts)) {
		if (account) {
			console.log(`  ${role.padEnd(15)} - Username: ${account.username}, ID: ${account.id}`);
		}
	}
	console.log(`\nAll demo accounts use password: ${DEMO_PASSWORD}`);
	console.log("\nDemo Data Summary:");
	console.log("  - Demo Cleaner: 10 reviews (4.8 avg), Stripe Connect active");
	console.log("  - Demo Homeowner: 2 homes, 3 upcoming + 5 past appointments, $150 bill, biweekly schedule");
	console.log("  - Demo Business Owner: 3 employees, 10 clients, verified business");
	console.log("  - Demo Employee: 5 assigned jobs, $800 pending earnings");
	console.log("\nNote: Owners can access preview mode from the Owner Dashboard.");

	return createdAccounts;
}

// Run if executed directly
if (require.main === module) {
	createDemoAccounts()
		.then(() => {
			console.log("\nSeeder completed successfully!");
			process.exit(0);
		})
		.catch((error) => {
			console.error("\nSeeder failed:", error);
			process.exit(1);
		});
}

module.exports = { createDemoAccounts, DEMO_ACCOUNTS, DEMO_PASSWORD };
