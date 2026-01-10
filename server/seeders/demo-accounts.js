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
	CancellationAppeal,
	HomeSizeAdjustmentRequest,
	CancellationAuditLog,
	BusinessVolumeStats,
	HomePreferredCleaner,
	CleanerPreferredPerks,
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
		daysWorking: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
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
		daysWorking: ["Monday", "Wednesday", "Friday", "Saturday"],
	},
	businessClient: {
		username: "demo_business_client",
		email: "demo_business_client@sparkle.demo",
		firstName: "Demo",
		lastName: "BusinessClient",
		type: null, // homeowner
		isBusinessOwner: false,
	},
	humanResources: {
		username: "demo_hr",
		email: "demo_hr@sparkle.demo",
		firstName: "Sarah",
		lastName: "Manager",
		type: "humanResources",
		isBusinessOwner: false,
	},
	largeBusinessOwner: {
		username: "demo_large_business",
		email: "demo_large_business@sparkle.demo",
		firstName: "Marcus",
		lastName: "Sterling",
		type: "cleaner",
		isBusinessOwner: true,
		businessName: "Sterling Cleaning Enterprise",
		yearsInBusiness: 12,
		businessVerificationStatus: "verified",
		businessVerifiedAt: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000), // Verified 1 year ago
		businessDescription: "Premier commercial and residential cleaning services with over a decade of experience. Serving 100+ satisfied clients with a team of professional cleaners. Specializing in eco-friendly cleaning solutions and premium service quality.",
		businessHighlightOptIn: true,
		avgRating: 4.95,
		totalReviews: 250,
	},
	preferredCleaner: {
		username: "demo_preferred_cleaner",
		email: "demo_preferred_cleaner@sparkle.demo",
		firstName: "Jessica",
		lastName: "Martinez",
		type: "cleaner",
		isBusinessOwner: false,
		isMarketplaceCleaner: true,
		daysWorking: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
		profileBio: "Top-rated cleaner with 8+ years of experience. Platinum-tier preferred cleaner trusted by 20+ homes. Known for exceptional attention to detail, reliability, and building lasting relationships with clients. Specializing in deep cleaning, move-in/move-out, and eco-friendly products.",
		avgRating: 4.95,
		totalReviews: 150,
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
					hasPaymentMethod: role === "homeowner" || role === "businessClient", // Homeowners have payment method
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

	// ============================================
	// DEMO BUSINESS CLIENT DATA
	// - Homeowner who is a client of Demo Business Owner
	// - 1 home registered
	// - 3 upcoming appointments (with business owner's employee)
	// - 2 past cleanings
	// - $100 bill balance
	// - Separate from the independent demo_homeowner
	// ============================================
	if (createdAccounts.businessClient && createdAccounts.businessOwner && createdAccounts.employee) {
		console.log("\n--- Creating Demo Business Client Data ---");

		// Create home for business client
		console.log("Creating home for demo business client...");
		const businessClientHome = {
			nickName: "Client Home",
			address: "789 Business Client Ave",
			city: "Demo City",
			state: "CA",
			zipcode: "90211",
			numBeds: "3",
			numBaths: "2",
			numHalfBaths: "1",
			sqft: 2200,
			hasGate: false,
			hasDog: false,
			hasCat: true,
			catName: "Luna",
			accessNotes: "Lockbox code is 4321. Please text before arriving.",
			latitude: 34.0722,
			longitude: -118.4012,
		};

		let clientHome;
		try {
			clientHome = await Home.findOne({
				where: { userId: createdAccounts.businessClient.id, nickName: businessClientHome.nickName },
			});

			if (!clientHome) {
				clientHome = await Home.create({
					...businessClientHome,
					userId: createdAccounts.businessClient.id,
				});
				console.log(`  - Created home: ${businessClientHome.nickName}`);
			} else {
				console.log(`  - Home already exists: ${businessClientHome.nickName}`);
			}
		} catch (error) {
			console.error(`  - Error creating home:`, error.message);
		}

		// Link business client to business owner
		console.log("Linking business client to demo business owner...");
		try {
			const existingClient = await CleanerClient.findOne({
				where: {
					cleanerId: createdAccounts.businessOwner.id,
					clientId: createdAccounts.businessClient.id,
				},
			});

			if (!existingClient) {
				await CleanerClient.create({
					cleanerId: createdAccounts.businessOwner.id,
					clientId: createdAccounts.businessClient.id,
					status: "active",
					preferredDays: JSON.stringify(["Tuesday", "Friday"]),
					notes: "VIP client - prefers morning appointments, eco-friendly products only",
				});
				console.log("  - Linked as client of Demo Business Owner");
			}
		} catch (error) {
			console.error("  - Error linking client:", error.message);
		}

		// Create 2 past appointments (completed) with business owner
		if (clientHome) {
			console.log("Creating past appointments for demo business client...");
			for (let i = 1; i <= 2; i++) {
				try {
					const pastDate = getPastDate(i * 7); // Weekly in the past
					const existingAppt = await UserAppointments.findOne({
						where: { userId: createdAccounts.businessClient.id, date: pastDate },
					});

					if (!existingAppt) {
						const appointment = await UserAppointments.create({
							userId: createdAccounts.businessClient.id,
							homeId: clientHome.id,
							date: pastDate,
							price: "160",
							paid: true,
							bringTowels: "yes",
							bringSheets: "no",
							completed: true,
							hasBeenAssigned: true,
							employeesAssigned: [createdAccounts.employee.id.toString()],
							empoyeesNeeded: 1,
							timeToBeCompleted: "2.5",
							paymentStatus: "paid",
							amountPaid: 16000,
							completionStatus: "approved",
							cleanerId: createdAccounts.businessOwner.id,
						});

						// Create job assignment for past appointments
						await EmployeeJobAssignment.create({
							businessOwnerId: createdAccounts.businessOwner.id,
							employeeId: createdAccounts.employee.id,
							appointmentId: appointment.id,
							homeId: clientHome.id,
							clientId: createdAccounts.businessClient.id,
							scheduledDate: pastDate,
							scheduledTime: "10:00",
							status: "completed",
							payType: "percentage",
							payRate: 70,
							estimatedPay: Math.round(160 * 0.7 * 100),
						});
					}
				} catch (error) {
					// Ignore duplicates
				}
			}
			console.log("  - Created 2 past completed appointments");

			// Create 3 upcoming appointments (today, 3 days, 1 week)
			console.log("Creating upcoming appointments for demo business client...");
			const upcomingDays = [0, 3, 7]; // Today, 3 days, 1 week
			for (let i = 0; i < 3; i++) {
				try {
					const futureDate = getFutureDate(upcomingDays[i]);
					const existingAppt = await UserAppointments.findOne({
						where: { userId: createdAccounts.businessClient.id, date: futureDate },
					});

					if (!existingAppt) {
						const appointment = await UserAppointments.create({
							userId: createdAccounts.businessClient.id,
							homeId: clientHome.id,
							date: futureDate,
							price: "160",
							paid: false,
							bringTowels: "yes",
							bringSheets: i === 0 ? "yes" : "no",
							completed: false,
							hasBeenAssigned: true,
							employeesAssigned: [createdAccounts.employee.id.toString()],
							empoyeesNeeded: 1,
							timeToBeCompleted: "2.5",
							paymentStatus: "pending",
							amountPaid: 0,
							cleanerId: createdAccounts.businessOwner.id,
						});

						// Create job assignment for upcoming appointments
						await EmployeeJobAssignment.create({
							businessOwnerId: createdAccounts.businessOwner.id,
							employeeId: createdAccounts.employee.id,
							appointmentId: appointment.id,
							homeId: clientHome.id,
							clientId: createdAccounts.businessClient.id,
							scheduledDate: futureDate,
							scheduledTime: ["09:00", "11:00", "14:00"][i],
							status: "assigned",
							payType: "percentage",
							payRate: 70,
							estimatedPay: Math.round(160 * 0.7 * 100),
						});
					}
				} catch (error) {
					// Ignore duplicates
				}
			}
			console.log("  - Created 3 upcoming appointments (today, 3 days, 1 week)");
		}

		// Create bill balance ($100)
		console.log("Setting up bill for demo business client...");
		try {
			let bill = await UserBills.findOne({
				where: { userId: createdAccounts.businessClient.id },
			});

			if (!bill) {
				await UserBills.create({
					userId: createdAccounts.businessClient.id,
					appointmentDue: 10000, // $100
					cancellationFee: 0,
					totalDue: 10000,
					totalPaid: 32000, // $320 total paid historically (2 past cleanings)
				});
				console.log("  - Created bill with $100 balance");
			} else {
				await bill.update({ totalDue: 10000 });
				console.log("  - Updated existing bill");
			}
		} catch (error) {
			console.error("  - Error creating bill:", error.message);
		}

		// Create reviews for business owner from this client
		console.log("Creating reviews for demo business owner...");
		const clientReviews = [
			{ rating: 5, comment: "Demo Cleaning Co always does an amazing job! Very professional team." },
			{ rating: 5, comment: "Love working with this company. The employee assigned to my home is wonderful." },
		];

		for (let i = 0; i < clientReviews.length; i++) {
			try {
				const existingReview = await UserReviews.findOne({
					where: {
						reviewerId: createdAccounts.businessClient.id,
						reviewedId: createdAccounts.businessOwner.id,
						comment: clientReviews[i].comment,
					},
				});

				if (!existingReview) {
					await UserReviews.create({
						reviewerId: createdAccounts.businessClient.id,
						reviewedId: createdAccounts.businessOwner.id,
						rating: clientReviews[i].rating,
						comment: clientReviews[i].comment,
						reviewType: "homeowner_to_cleaner",
						createdAt: new Date(Date.now() - ((i + 1) * 7 * 24 * 60 * 60 * 1000)),
					});
				}
			} catch (error) {
				// Ignore duplicates
			}
		}
		console.log("  - Created 2 reviews for business owner");
	}

	// ============================================
	// DEMO HR DATA
	// - HR user account
	// - Cancellation appeals with various scenarios
	// - Home size adjustment disputes
	// - Audit trail entries
	// ============================================
	if (createdAccounts.humanResources && createdAccounts.homeowner && createdAccounts.cleaner) {
		console.log("\n--- Creating Demo HR Data ---");

		const demoHR = createdAccounts.humanResources;
		const demoCleaner = createdAccounts.cleaner;
		const demoHomeowner = createdAccounts.homeowner;

		// Get demo homeowner's home
		const homeownerHome = await Home.findOne({
			where: { userId: demoHomeowner.id },
		});

		if (homeownerHome) {
			// ===== SCENARIO 1: Medical Emergency Appeal (Homeowner) - Under Review =====
			console.log("Creating Scenario 1: Medical Emergency Appeal...");
			try {
				// Create a cancelled appointment
				const cancelledAppt1 = await UserAppointments.create({
					userId: demoHomeowner.id,
					homeId: homeownerHome.id,
					date: getPastDate(3),
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

				// Create the appeal
				const appeal1 = await CancellationAppeal.create({
					appointmentId: cancelledAppt1.id,
					appealerId: demoHomeowner.id,
					appealerType: "homeowner",
					category: "medical_emergency",
					severity: "high",
					description: "I had to cancel because my elderly mother fell and broke her hip. I had to rush her to the emergency room and stayed with her for surgery. I have hospital admission documents showing the date and time. This was completely unexpected and I had no way to give more notice.",
					supportingDocuments: [
						{ type: "hospital_admission", filename: "hospital_admission.pdf", uploadedAt: new Date().toISOString() },
						{ type: "emergency_room_record", filename: "er_record.pdf", uploadedAt: new Date().toISOString() },
					],
					contestingItems: { cancellationFee: true, rating: false },
					originalPenaltyAmount: 5000, // $50 fee
					originalRefundWithheld: 0,
					requestedRelief: "Full waiver of the $50 cancellation fee due to medical emergency",
					status: "under_review",
					priority: "high",
					assignedTo: demoHR.id,
					assignedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
					submittedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
					slaDeadline: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000), // Due tomorrow
					lastActivityAt: new Date(),
				});

				// Update appointment with appeal ID
				await cancelledAppt1.update({ appealId: appeal1.id });

				// Create audit log entries
				await CancellationAuditLog.create({
					eventType: "appeal_submitted",
					userId: demoHomeowner.id,
					appointmentId: cancelledAppt1.id,
					appealId: appeal1.id,
					details: { category: "medical_emergency", severity: "high" },
					ipAddress: "192.168.1.100",
				});

				await CancellationAuditLog.create({
					eventType: "appeal_assigned",
					userId: demoHR.id,
					appointmentId: cancelledAppt1.id,
					appealId: appeal1.id,
					details: { assignedTo: demoHR.id, assignedBy: "system" },
				});

				console.log("  - Created medical emergency appeal (under_review, assigned to HR)");
			} catch (error) {
				console.error("  - Error creating Scenario 1:", error.message);
			}

			// ===== SCENARIO 2: Transportation Issue Appeal (Cleaner) - Awaiting Documents =====
			console.log("Creating Scenario 2: Transportation Issue Appeal...");
			try {
				const cancelledAppt2 = await UserAppointments.create({
					userId: demoHomeowner.id,
					homeId: homeownerHome.id,
					date: getPastDate(5),
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

				const appeal2 = await CancellationAppeal.create({
					appointmentId: cancelledAppt2.id,
					appealerId: demoCleaner.id,
					appealerType: "cleaner",
					category: "transportation",
					severity: "medium",
					description: "My car's transmission failed while I was driving to the appointment. I was stranded on the highway and had to wait 2 hours for a tow truck. I called the client to let them know but couldn't make it. I can provide the tow truck receipt and mechanic's report.",
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
					slaDeadline: new Date(Date.now() + 20 * 60 * 60 * 1000), // Due in 20 hours
					lastActivityAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
					reviewDecision: "Requested documentation: tow truck receipt, mechanic's repair invoice, and photos of the breakdown if available.",
				});

				await cancelledAppt2.update({ appealId: appeal2.id });

				console.log("  - Created transportation issue appeal (awaiting_documents)");
			} catch (error) {
				console.error("  - Error creating Scenario 2:", error.message);
			}

			// ===== SCENARIO 3: Scheduling Error Appeal - Approved (Historical) =====
			console.log("Creating Scenario 3: Approved Appeal (Historical)...");
			try {
				const cancelledAppt3 = await UserAppointments.create({
					userId: demoHomeowner.id,
					homeId: homeownerHome.id,
					date: getPastDate(14),
					price: "180",
					paid: false,
					bringTowels: "yes",
					bringSheets: "yes",
					completed: false,
					hasBeenAssigned: true,
					employeesAssigned: [demoCleaner.id.toString()],
					empoyeesNeeded: 1,
					timeToBeCompleted: "3",
					wasCancelled: true,
					cancellationType: "homeowner",
					cancellationReason: "Scheduling conflict - double booked",
					cancellationInitiatedAt: new Date(Date.now() - 12 * 24 * 60 * 60 * 1000),
					cancellationConfirmedAt: new Date(Date.now() - 12 * 24 * 60 * 60 * 1000),
					cancellationConfirmationId: "CXL-DEMO-003",
					hasActiveAppeal: false,
				});

				const appeal3 = await CancellationAppeal.create({
					appointmentId: cancelledAppt3.id,
					appealerId: demoHomeowner.id,
					appealerType: "homeowner",
					category: "scheduling_error",
					severity: "low",
					description: "The app allowed me to book two appointments for the same time slot. This appears to be a system bug. I cancelled one of them but was charged a fee for both. Please review the booking logs.",
					supportingDocuments: [
						{ type: "screenshot", filename: "double_booking_screenshot.png", uploadedAt: new Date(Date.now() - 11 * 24 * 60 * 60 * 1000).toISOString() },
					],
					contestingItems: { cancellationFee: true },
					originalPenaltyAmount: 5000,
					originalRefundWithheld: 0,
					requestedRelief: "Full refund of cancellation fee",
					status: "approved",
					priority: "normal",
					assignedTo: demoHR.id,
					assignedAt: new Date(Date.now() - 11 * 24 * 60 * 60 * 1000),
					reviewedBy: demoHR.id,
					reviewedAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
					reviewDecision: "Verified system bug in booking flow. Fee waived.",
					submittedAt: new Date(Date.now() - 12 * 24 * 60 * 60 * 1000),
					slaDeadline: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
					closedAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
					resolution: { feeWaived: true, amountRefunded: 5000, notes: "System bug confirmed" },
					resolutionNotes: "Bug confirmed in booking system. Full fee refunded. Engineering team notified.",
				});

				await cancelledAppt3.update({ appealId: appeal3.id });

				console.log("  - Created approved appeal (historical reference)");
			} catch (error) {
				console.error("  - Error creating Scenario 3:", error.message);
			}

			// ===== SCENARIO 4: Overdue Appeal - Past SLA =====
			console.log("Creating Scenario 4: Overdue Appeal (Past SLA)...");
			try {
				const cancelledAppt4 = await UserAppointments.create({
					userId: demoHomeowner.id,
					homeId: homeownerHome.id,
					date: getPastDate(7),
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

				const appeal4 = await CancellationAppeal.create({
					appointmentId: cancelledAppt4.id,
					appealerId: demoHomeowner.id,
					appealerType: "homeowner",
					category: "family_emergency",
					severity: "critical",
					description: "My father passed away unexpectedly and I had to fly out of state immediately for the funeral arrangements. I was not able to give advance notice due to the sudden nature of this tragedy. I can provide the death certificate and flight confirmation if needed.",
					supportingDocuments: [
						{ type: "flight_confirmation", filename: "flight_booking.pdf", uploadedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString() },
					],
					contestingItems: { cancellationFee: true, rating: true },
					originalPenaltyAmount: 6000, // $60 fee
					originalRefundWithheld: 0,
					requestedRelief: "Full waiver of fee and removal of rating impact",
					status: "submitted",
					priority: "urgent",
					submittedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
					slaDeadline: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000), // Past due by 3 days
					lastActivityAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
				});

				await cancelledAppt4.update({ appealId: appeal4.id });

				console.log("  - Created overdue appeal (past SLA - urgent)");
			} catch (error) {
				console.error("  - Error creating Scenario 4:", error.message);
			}

			// ===== SCENARIO 5: Home Size Adjustment Dispute =====
			console.log("Creating Scenario 5: Home Size Adjustment Dispute...");
			try {
				// Create a completed appointment where cleaner reported different home size
				const disputeAppt = await UserAppointments.create({
					userId: demoHomeowner.id,
					homeId: homeownerHome.id,
					date: getPastDate(2),
					price: "150", // Price for 3 bed/2 bath
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
					cleanerNote: "This home is much larger than listed. It has 5 bedrooms including a converted basement with 2 bedrooms, and 3 full bathrooms. The upstairs has a master suite with its own bathroom that wasn't mentioned. I took photos of each room.",
					homeownerResponse: "I disagree - the basement rooms are storage, not bedrooms. But I acknowledge the third bathroom was added recently.",
					expiresAt: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000), // Expires in 5 days
				});

				console.log("  - Created home size adjustment dispute (pending_owner review)");
			} catch (error) {
				console.error("  - Error creating Scenario 5:", error.message);
			}

			// ===== SCENARIO 6: Denied Appeal (Historical) =====
			console.log("Creating Scenario 6: Denied Appeal (Historical)...");
			try {
				const cancelledAppt6 = await UserAppointments.create({
					userId: demoHomeowner.id,
					homeId: homeownerHome.id,
					date: getPastDate(21),
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
					cancellationType: "homeowner",
					cancellationReason: "Changed my mind",
					cancellationInitiatedAt: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000),
					cancellationConfirmedAt: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000),
					cancellationConfirmationId: "CXL-DEMO-006",
					hasActiveAppeal: false,
				});

				const appeal6 = await CancellationAppeal.create({
					appointmentId: cancelledAppt6.id,
					appealerId: demoHomeowner.id,
					appealerType: "homeowner",
					category: "other",
					severity: "low",
					description: "I just didn't feel like having the cleaning that day. The fee is too high for just changing my mind.",
					supportingDocuments: [],
					contestingItems: { cancellationFee: true },
					originalPenaltyAmount: 5000,
					originalRefundWithheld: 0,
					requestedRelief: "Refund of cancellation fee",
					status: "denied",
					priority: "normal",
					assignedTo: demoHR.id,
					assignedAt: new Date(Date.now() - 19 * 24 * 60 * 60 * 1000),
					reviewedBy: demoHR.id,
					reviewedAt: new Date(Date.now() - 18 * 24 * 60 * 60 * 1000),
					reviewDecision: "Appeal does not meet criteria for fee waiver. Cancellation was voluntary without extenuating circumstances.",
					submittedAt: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000),
					slaDeadline: new Date(Date.now() - 18 * 24 * 60 * 60 * 1000),
					closedAt: new Date(Date.now() - 18 * 24 * 60 * 60 * 1000),
					resolution: { feeWaived: false, notes: "Does not meet waiver criteria" },
					resolutionNotes: "Voluntary cancellation without qualifying circumstances. Fee stands per cancellation policy.",
				});

				await cancelledAppt6.update({ appealId: appeal6.id });

				console.log("  - Created denied appeal (historical reference)");
			} catch (error) {
				console.error("  - Error creating Scenario 6:", error.message);
			}
		}

		console.log("  - HR demo scenarios complete");
	}

	// ============================================
	// DEMO LARGE BUSINESS OWNER DATA
	// - Business: "Sterling Cleaning Enterprise"
	// - 100 clients
	// - 110+ cleanings last month (qualifies for 7% fee)
	// - 5 employees
	// - Verified business status
	// ============================================
	if (createdAccounts.largeBusinessOwner) {
		console.log("\n--- Creating Demo Large Business Owner Data ---");

		const largeBizOwner = createdAccounts.largeBusinessOwner;

		// Create 5 employees for the large business
		console.log("Creating employees for large business...");
		const largeBusinessEmployees = [
			{ firstName: "Carlos", lastName: "Rodriguez", email: "carlos.lb@sparkle.demo", payType: "percentage", payRate: 70 },
			{ firstName: "Aisha", lastName: "Patel", email: "aisha.lb@sparkle.demo", payType: "percentage", payRate: 70 },
			{ firstName: "James", lastName: "Chen", email: "james.lb@sparkle.demo", payType: "hourly", payRate: 22 },
			{ firstName: "Maria", lastName: "Santos", email: "maria.lb@sparkle.demo", payType: "percentage", payRate: 65 },
			{ firstName: "Robert", lastName: "Kim", email: "robert.lb@sparkle.demo", payType: "hourly", payRate: 20 },
		];

		const createdEmployees = [];
		for (const empData of largeBusinessEmployees) {
			try {
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
						employeeOfBusinessId: largeBizOwner.id,
						daysWorking: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
					});
				}

				const existingBizEmp = await BusinessEmployee.findOne({
					where: {
						businessOwnerId: largeBizOwner.id,
						email: empData.email,
					},
				});

				if (!existingBizEmp) {
					await BusinessEmployee.create({
						businessOwnerId: largeBizOwner.id,
						cleanerId: empUser.id,
						firstName: empData.firstName,
						lastName: empData.lastName,
						email: empData.email,
						status: "active",
						payType: empData.payType,
						payRate: empData.payRate,
						canSeeFullSchedule: true,
						invitationAcceptedAt: new Date(),
					});
				}
				createdEmployees.push(empUser);
			} catch (error) {
				console.error(`  - Error creating employee ${empData.firstName}:`, error.message);
			}
		}
		console.log(`  - Created ${largeBusinessEmployees.length} employees`);

		// Create 100 clients for the large business
		console.log("Creating 100 clients for large business...");
		const clientFirstNames = [
			"Olivia", "Noah", "Emma", "Liam", "Ava", "William", "Sophia", "James", "Isabella", "Benjamin",
			"Mia", "Lucas", "Charlotte", "Henry", "Amelia", "Alexander", "Harper", "Sebastian", "Evelyn", "Jack",
			"Luna", "Owen", "Camila", "Theodore", "Gianna", "Aiden", "Abigail", "Samuel", "Emily", "Leo",
			"Elizabeth", "Matthew", "Mila", "Joseph", "Ella", "Daniel", "Avery", "Michael", "Sofia", "Ethan",
			"Scarlett", "David", "Eleanor", "Carter", "Madison", "Luke", "Layla", "Jackson", "Penelope", "Gabriel",
			"Riley", "Anthony", "Chloe", "Isaac", "Grace", "Dylan", "Ellie", "Jayden", "Nora", "Levi",
			"Lily", "Christopher", "Hazel", "Joshua", "Violet", "Andrew", "Aurora", "Lincoln", "Zoey", "Nathan",
			"Stella", "Caleb", "Hannah", "Ryan", "Lillian", "Adrian", "Addison", "Asher", "Leah", "Christian",
			"Savannah", "Thomas", "Brooklyn", "Hunter", "Eliana", "Connor", "Audrey", "Eli", "Claire", "Aaron",
			"Skylar", "Charles", "Bella", "Nicholas", "Lucy", "Jonathan", "Anna", "Julian", "Aaliyah", "Austin",
		];
		const clientLastNames = [
			"Smith", "Johnson", "Williams", "Brown", "Jones", "Garcia", "Miller", "Davis", "Rodriguez", "Martinez",
			"Hernandez", "Lopez", "Gonzalez", "Wilson", "Anderson", "Thomas", "Taylor", "Moore", "Jackson", "Martin",
			"Lee", "Perez", "Thompson", "White", "Harris", "Sanchez", "Clark", "Ramirez", "Lewis", "Robinson",
			"Walker", "Young", "Allen", "King", "Wright", "Scott", "Torres", "Nguyen", "Hill", "Flores",
			"Green", "Adams", "Nelson", "Baker", "Hall", "Rivera", "Campbell", "Mitchell", "Carter", "Roberts",
			"Gomez", "Phillips", "Evans", "Turner", "Diaz", "Parker", "Cruz", "Edwards", "Collins", "Reyes",
			"Stewart", "Morris", "Morales", "Murphy", "Cook", "Rogers", "Gutierrez", "Ortiz", "Morgan", "Cooper",
			"Peterson", "Bailey", "Reed", "Kelly", "Howard", "Ramos", "Kim", "Cox", "Ward", "Richardson",
			"Watson", "Brooks", "Chavez", "Wood", "James", "Bennett", "Gray", "Mendoza", "Ruiz", "Hughes",
			"Price", "Alvarez", "Castillo", "Sanders", "Patel", "Myers", "Long", "Ross", "Foster", "Jimenez",
		];

		const createdClients = [];
		for (let i = 0; i < 100; i++) {
			try {
				const clientEmail = `lb_client_${i + 1}@sparkle.demo`;
				let clientUser = await User.findOne({ where: { email: clientEmail } });

				if (!clientUser) {
					clientUser = await User.create({
						username: `lb_client_${i + 1}`,
						email: clientEmail,
						firstName: clientFirstNames[i],
						lastName: clientLastNames[i],
						password: hashedPassword,
						type: null, // homeowner
						isDemoAccount: true,
						hasPaymentMethod: true,
					});

					// Create a home for each client with varied sizes
					const bedrooms = 2 + (i % 4); // 2-5 bedrooms
					const bathrooms = 1 + (i % 3); // 1-3 bathrooms
					await Home.create({
						userId: clientUser.id,
						nickName: `${clientFirstNames[i]}'s Home`,
						address: `${1000 + i * 10} Sterling Avenue, Unit ${i + 1}`,
						city: ["Beverly Hills", "Santa Monica", "Pasadena", "Glendale", "Burbank"][i % 5],
						state: "CA",
						zipcode: String(90210 + (i % 50)),
						numBeds: String(bedrooms),
						numBaths: String(bathrooms),
						numHalfBaths: String(i % 2),
						sqft: 1500 + (i * 30),
					});
				}

				// Link as cleaner client
				const existingClient = await CleanerClient.findOne({
					where: {
						cleanerId: largeBizOwner.id,
						clientId: clientUser.id,
					},
				});

				if (!existingClient) {
					await CleanerClient.create({
						cleanerId: largeBizOwner.id,
						clientId: clientUser.id,
						status: "active",
						preferredDays: JSON.stringify(["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"][i % 5]),
						notes: `Regular client #${i + 1} - ${["weekly", "biweekly", "monthly"][i % 3]} service`,
					});
				}

				createdClients.push(clientUser);
			} catch (error) {
				// Ignore duplicates
			}
		}
		console.log("  - Created 100 clients for large business");

		// Create BusinessVolumeStats to show 110 cleanings last month
		console.log("Creating volume stats for large business (110 cleanings last month)...");
		try {
			const now = new Date();
			const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
			const lastMonthNum = lastMonth.getMonth() + 1;
			const lastMonthYear = lastMonth.getFullYear();

			// Check if stats exist
			let volumeStats = await BusinessVolumeStats.findOne({
				where: {
					businessOwnerId: largeBizOwner.id,
					month: lastMonthNum,
					year: lastMonthYear,
				},
			});

			if (!volumeStats) {
				volumeStats = await BusinessVolumeStats.create({
					businessOwnerId: largeBizOwner.id,
					month: lastMonthNum,
					year: lastMonthYear,
					completedCleanings: 110,
					totalRevenue: 2200000, // $22,000 (110 cleanings * ~$200 avg)
					lastUpdatedAt: now,
				});
				console.log(`  - Created volume stats: 110 cleanings for ${lastMonthNum}/${lastMonthYear}`);
			} else {
				await volumeStats.update({
					completedCleanings: 110,
					totalRevenue: 2200000,
					lastUpdatedAt: now,
				});
				console.log(`  - Updated volume stats: 110 cleanings for ${lastMonthNum}/${lastMonthYear}`);
			}

			// Also add stats for this month (showing ongoing volume)
			const thisMonthNum = now.getMonth() + 1;
			const thisYear = now.getFullYear();
			let thisMonthStats = await BusinessVolumeStats.findOne({
				where: {
					businessOwnerId: largeBizOwner.id,
					month: thisMonthNum,
					year: thisYear,
				},
			});

			if (!thisMonthStats) {
				const dayOfMonth = now.getDate();
				const cleaningsThisMonth = Math.round((dayOfMonth / 30) * 100); // Pro-rated based on day
				await BusinessVolumeStats.create({
					businessOwnerId: largeBizOwner.id,
					month: thisMonthNum,
					year: thisYear,
					completedCleanings: cleaningsThisMonth,
					totalRevenue: cleaningsThisMonth * 20000, // ~$200 per cleaning
					lastUpdatedAt: now,
				});
				console.log(`  - Created current month stats: ${cleaningsThisMonth} cleanings so far`);
			}
		} catch (error) {
			console.error("  - Error creating volume stats:", error.message);
		}

		// Create some reviews for the large business owner
		console.log("Creating reviews for large business...");
		const reviewComments = [
			"Sterling Cleaning Enterprise is absolutely top-notch! My home has never been cleaner.",
			"Professional service every single time. Highly recommend!",
			"Their team is efficient and thorough. Worth every penny.",
			"Best cleaning service I've ever used. The attention to detail is remarkable.",
			"Marcus and his team go above and beyond. 5 stars!",
			"Consistent quality month after month. Couldn't be happier.",
			"The eco-friendly products they use are a huge plus for my family.",
			"Reliable, punctual, and excellent work. What more could you ask for?",
			"Sterling sets the gold standard for cleaning services.",
			"My go-to cleaning company for over 2 years now. Never disappointed.",
		];

		for (let i = 0; i < 10 && i < createdClients.length; i++) {
			try {
				const existingReview = await UserReviews.findOne({
					where: {
						reviewerId: createdClients[i].id,
						reviewedId: largeBizOwner.id,
						comment: reviewComments[i],
					},
				});

				if (!existingReview) {
					await UserReviews.create({
						reviewerId: createdClients[i].id,
						reviewedId: largeBizOwner.id,
						rating: i < 9 ? 5 : 4, // 9 five-star reviews, 1 four-star
						comment: reviewComments[i],
						reviewType: "homeowner_to_cleaner",
						createdAt: new Date(Date.now() - (i * 7 * 24 * 60 * 60 * 1000)),
					});
				}
			} catch (error) {
				// Ignore duplicates
			}
		}
		console.log("  - Created 10 sample reviews");

		// Update the business owner stats
		await largeBizOwner.update({
			avgRating: 4.95,
			totalReviews: 250, // Shows historical review count
		});

		console.log("  - Large business owner setup complete (qualifies for 7% platform fee)");
	}

	// ============================================
	// DEMO PREFERRED CLEANER DATA
	// - Cleaner: "Jessica Martinez"
	// - Preferred on 20+ homes (Platinum tier)
	// - 7% bonus, 24h payouts, early access
	// - 150 reviews, 4.95 rating
	// ============================================
	if (createdAccounts.preferredCleaner) {
		console.log("\n--- Creating Demo Preferred Cleaner Data ---");

		const prefCleaner = createdAccounts.preferredCleaner;

		// Create 20 homeowner clients who have this cleaner as preferred
		console.log("Creating 20 homeowners with preferred cleaner...");
		const preferredHomeownerNames = [
			{ first: "Patricia", last: "Williams" },
			{ first: "Michael", last: "Brown" },
			{ first: "Jennifer", last: "Jones" },
			{ first: "Robert", last: "Garcia" },
			{ first: "Linda", last: "Miller" },
			{ first: "David", last: "Davis" },
			{ first: "Elizabeth", last: "Rodriguez" },
			{ first: "William", last: "Martinez" },
			{ first: "Barbara", last: "Hernandez" },
			{ first: "Richard", last: "Lopez" },
			{ first: "Susan", last: "Gonzalez" },
			{ first: "Joseph", last: "Wilson" },
			{ first: "Margaret", last: "Anderson" },
			{ first: "Charles", last: "Thomas" },
			{ first: "Dorothy", last: "Taylor" },
			{ first: "Thomas", last: "Moore" },
			{ first: "Lisa", last: "Jackson" },
			{ first: "Christopher", last: "Martin" },
			{ first: "Nancy", last: "Lee" },
			{ first: "Daniel", last: "Perez" },
		];

		const createdPreferredHomes = [];
		for (let i = 0; i < 20; i++) {
			try {
				const ownerEmail = `pref_owner_${i + 1}@sparkle.demo`;
				let homeowner = await User.findOne({ where: { email: ownerEmail } });

				if (!homeowner) {
					homeowner = await User.create({
						username: `pref_owner_${i + 1}`,
						email: ownerEmail,
						firstName: preferredHomeownerNames[i].first,
						lastName: preferredHomeownerNames[i].last,
						password: hashedPassword,
						type: null, // homeowner
						isDemoAccount: true,
						hasPaymentMethod: true,
					});

					// Create a home for each
					const bedrooms = 2 + (i % 4);
					const bathrooms = 1 + (i % 3);
					const home = await Home.create({
						userId: homeowner.id,
						nickName: `${preferredHomeownerNames[i].first}'s Residence`,
						address: `${2000 + i * 15} Preferred Lane`,
						city: ["Los Angeles", "Pasadena", "Santa Monica", "Glendale", "Burbank"][i % 5],
						state: "CA",
						zipcode: String(90001 + (i * 10)),
						numBeds: String(bedrooms),
						numBaths: String(bathrooms),
						numHalfBaths: String(i % 2),
						sqft: 1800 + (i * 50),
						usePreferredCleaners: true,
					});

					createdPreferredHomes.push(home);

					// Create HomePreferredCleaner record
					await HomePreferredCleaner.create({
						homeId: home.id,
						cleanerId: prefCleaner.id,
						setAt: new Date(Date.now() - (i * 30 * 24 * 60 * 60 * 1000)), // Staggered over time
						setBy: ["review", "settings", "invitation"][i % 3],
						preferenceLevel: i < 15 ? "preferred" : "favorite", // Most are preferred, some favorite
						priority: 1,
					});

					// Create a review from this homeowner
					const reviewRatings = [5, 5, 5, 5, 5, 5, 5, 5, 5, 4, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5];
					const reviewComments = [
						"Jessica is absolutely amazing! She treats my home like her own.",
						"Best cleaner I've ever had. So thorough and professional.",
						"Always goes above and beyond. My home sparkles after every visit!",
						"Reliable, trustworthy, and does incredible work.",
						"Jessica is a gem! She notices things I never would.",
						"Consistently excellent service. Highly recommended!",
						"My preferred cleaner for a reason - she's simply the best.",
						"Attention to detail is unmatched. Worth every penny.",
						"So glad I found Jessica. My home has never been cleaner!",
						"Great work overall, very satisfied with the service.",
						"Jessica has been cleaning my home for 2 years. Wouldn't use anyone else!",
						"Professional, punctual, and pleasant. Perfect!",
						"The eco-friendly products she uses are a big plus.",
						"My family loves coming home to a Jessica-cleaned house!",
						"She remembers our preferences every time. True professional.",
						"Outstanding quality and reliability. 5 stars!",
						"Jessica makes house cleaning stress-free. Highly recommend!",
						"Incredible attention to detail. My bathrooms have never been cleaner.",
						"Trustworthy and efficient. Perfect for our busy family.",
						"The best investment for our home. Jessica is wonderful!",
					];

					await UserReviews.create({
						reviewerId: homeowner.id,
						reviewedId: prefCleaner.id,
						rating: reviewRatings[i],
						comment: reviewComments[i],
						reviewType: "homeowner_to_cleaner",
						createdAt: new Date(Date.now() - ((i + 1) * 14 * 24 * 60 * 60 * 1000)), // Spread over time
					});
				} else {
					// Find existing home
					const existingHome = await Home.findOne({ where: { userId: homeowner.id } });
					if (existingHome) {
						createdPreferredHomes.push(existingHome);
					}
				}
			} catch (error) {
				// Ignore duplicates
			}
		}
		console.log("  - Created 20 homeowners with preferred cleaner relationships");

		// Create CleanerPreferredPerks record (Platinum tier)
		console.log("Creating Platinum tier perks for preferred cleaner...");
		try {
			let perks = await CleanerPreferredPerks.findOne({
				where: { cleanerId: prefCleaner.id },
			});

			if (!perks) {
				perks = await CleanerPreferredPerks.create({
					cleanerId: prefCleaner.id,
					tierLevel: "platinum",
					preferredHomeCount: 20,
					bonusPercent: 7.00,
					fasterPayouts: true,
					payoutHours: 24,
					earlyAccess: true,
					lastCalculatedAt: new Date(),
				});
				console.log("  - Created Platinum tier perks (7% bonus, 24h payouts, early access)");
			} else {
				await perks.update({
					tierLevel: "platinum",
					preferredHomeCount: 20,
					bonusPercent: 7.00,
					fasterPayouts: true,
					payoutHours: 24,
					earlyAccess: true,
					lastCalculatedAt: new Date(),
				});
				console.log("  - Updated to Platinum tier perks");
			}
		} catch (error) {
			console.error("  - Error creating perks:", error.message);
		}

		// Create some past completed appointments
		console.log("Creating completed appointments for preferred cleaner...");
		if (createdPreferredHomes.length > 0) {
			for (let i = 0; i < 5 && i < createdPreferredHomes.length; i++) {
				try {
					const home = createdPreferredHomes[i];
					const pastDate = getPastDate((i + 1) * 7);

					const existingAppt = await UserAppointments.findOne({
						where: { homeId: home.id, date: pastDate },
					});

					if (!existingAppt) {
						await UserAppointments.create({
							userId: home.userId,
							homeId: home.id,
							date: pastDate,
							price: String(160 + (i * 10)),
							paid: true,
							bringTowels: "yes",
							bringSheets: i % 2 === 0 ? "yes" : "no",
							completed: true,
							hasBeenAssigned: true,
							employeesAssigned: [prefCleaner.id.toString()],
							empoyeesNeeded: 1,
							timeToBeCompleted: "3",
							paymentStatus: "paid",
							amountPaid: (160 + (i * 10)) * 100,
							completionStatus: "approved",
						});
					}
				} catch (error) {
					// Ignore duplicates
				}
			}
			console.log("  - Created 5 past completed appointments");

			// Create some upcoming appointments
			for (let i = 0; i < 3 && i < createdPreferredHomes.length; i++) {
				try {
					const home = createdPreferredHomes[i];
					const futureDate = getFutureDate((i + 1) * 7);

					const existingAppt = await UserAppointments.findOne({
						where: { homeId: home.id, date: futureDate },
					});

					if (!existingAppt) {
						await UserAppointments.create({
							userId: home.userId,
							homeId: home.id,
							date: futureDate,
							price: String(160 + (i * 10)),
							paid: false,
							bringTowels: "yes",
							bringSheets: "no",
							completed: false,
							hasBeenAssigned: true,
							employeesAssigned: [prefCleaner.id.toString()],
							empoyeesNeeded: 1,
							timeToBeCompleted: "3",
							paymentStatus: "pending",
						});
					}
				} catch (error) {
					// Ignore duplicates
				}
			}
			console.log("  - Created 3 upcoming appointments");
		}

		// Update cleaner stats
		await prefCleaner.update({
			avgRating: 4.95,
			totalReviews: 150,
		});

		console.log("  - Preferred cleaner setup complete (Platinum tier: 20 homes, 7% bonus)");
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
	console.log("  - Demo Homeowner: 2 homes, 3 upcoming + 5 past appointments, $150 bill, biweekly schedule (INDEPENDENT - uses marketplace)");
	console.log("  - Demo Business Owner: 3 employees, 11 clients, verified business");
	console.log("  - Demo Employee: 5+ assigned jobs, $800 pending earnings");
	console.log("  - Demo Business Client: 1 home, 3 upcoming + 2 past appointments, $100 bill (CLIENT OF BUSINESS OWNER)");
	console.log("  - Demo HR: 6 scenarios - 2 active appeals, 1 overdue appeal, 1 home size dispute, 2 resolved appeals");
	console.log("  - Demo Large Business: 100 clients, 5 employees, 110 cleanings/month (7% FEE TIER), verified status");
	console.log("  - Demo Preferred Cleaner: 20 preferred homes, PLATINUM tier (7% bonus, 24h payouts, early access)");
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
