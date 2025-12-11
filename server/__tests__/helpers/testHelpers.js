const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");
const { User, UserBills, UserHomes, UserAppointments } = require("../../models");

const secretKey = process.env.SESSION_SECRET;

/**
 * Create a test user
 */
async function createTestUser(overrides = {}) {
  const hashedPassword = await bcrypt.hash("testpassword123", 10);
  const userData = {
    username: `testuser_${Date.now()}`,
    password: hashedPassword,
    email: `test_${Date.now()}@example.com`,
    notifications: ["email"],
    ...overrides,
  };

  const user = await User.create(userData);

  // Create associated bill
  await UserBills.create({
    userId: user.id,
    appointmentDue: 0,
    cancellationFee: 0,
    totalDue: 0,
  });

  return user;
}

/**
 * Create a test cleaner/employee
 */
async function createTestCleaner(overrides = {}) {
  return createTestUser({
    type: "cleaner",
    daysWorking: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
    ...overrides,
  });
}

/**
 * Create a test home
 */
async function createTestHome(userId, overrides = {}) {
  const homeData = {
    userId,
    nickName: "Test Home",
    address: "123 Test Street",
    city: "Test City",
    state: "TS",
    zipcode: "12345",
    numBeds: 3,
    numBaths: 2,
    sheetsProvided: "yes",
    towelsProvided: "yes",
    keyPadCode: "1234",
    keyLocation: "Under mat",
    recyclingLocation: "Garage",
    compostLocation: "Backyard",
    trashLocation: "Side yard",
    contact: "555-123-4567",
    specialNotes: "Test notes",
    cleanersNeeded: 1,
    timeToBeCompleted: "3",
    ...overrides,
  };

  return UserHomes.create(homeData);
}

/**
 * Create a test appointment
 */
async function createTestAppointment(userId, homeId, overrides = {}) {
  const appointmentData = {
    userId,
    homeId,
    date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
    price: "150",
    paid: false,
    bringTowels: "no",
    bringSheets: "no",
    keyPadCode: "1234",
    keyLocation: "Under mat",
    completed: false,
    hasBeenAssigned: false,
    empoyeesNeeded: 1,
    timeToBeCompleted: "3",
    paymentStatus: "pending",
    ...overrides,
  };

  return UserAppointments.create(appointmentData);
}

/**
 * Generate a JWT token for a user
 */
function generateToken(userId) {
  return jwt.sign({ userId }, secretKey);
}

/**
 * Clean up test data
 */
async function cleanupTestData(userId) {
  try {
    await UserAppointments.destroy({ where: { userId } });
    await UserHomes.destroy({ where: { userId } });
    await UserBills.destroy({ where: { userId } });
    await User.destroy({ where: { id: userId } });
  } catch (error) {
    console.error("Cleanup error:", error);
  }
}

/**
 * Create mock Stripe payment intent response
 */
function mockStripePaymentIntent(overrides = {}) {
  return {
    id: `pi_test_${Date.now()}`,
    client_secret: `pi_test_${Date.now()}_secret_mock`,
    amount: 15000,
    currency: "usd",
    status: "requires_payment_method",
    ...overrides,
  };
}

module.exports = {
  createTestUser,
  createTestCleaner,
  createTestHome,
  createTestAppointment,
  generateToken,
  cleanupTestData,
  mockStripePaymentIntent,
};
