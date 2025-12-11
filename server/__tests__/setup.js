// Test setup file
require("dotenv").config();

// Mock node-cron to prevent scheduled tasks from keeping Jest open
jest.mock("node-cron", () => ({
  schedule: jest.fn(() => ({
    stop: jest.fn(),
    start: jest.fn(),
  })),
}));

// Mock environment variables for testing
process.env.SESSION_SECRET = process.env.SESSION_SECRET || "test-secret-key";
process.env.STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || "sk_test_mock";
process.env.STRIPE_PUBLISHABLE_KEY = process.env.STRIPE_PUBLISHABLE_KEY || "pk_test_mock";
process.env.STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET || "whsec_test_mock";

// Increase timeout for database operations
jest.setTimeout(30000);

// Clean up after all tests
afterAll(async () => {
  // Clear all timers and mocks
  jest.clearAllTimers();
  jest.clearAllMocks();
  jest.useRealTimers();

  // Allow pending HTTP requests to complete
  await new Promise((resolve) => setTimeout(resolve, 100));
});
