module.exports = {
  testEnvironment: "node",
  testMatch: ["**/__tests__/**/*.test.js"],
  collectCoverageFrom: [
    "routes/**/*.js",
    "models/**/*.js",
    "services/**/*.js",
    "middleware/**/*.js",
    "!**/node_modules/**",
  ],
  coverageDirectory: "coverage",
  setupFilesAfterEnv: ["<rootDir>/__tests__/setup.js"],
  testTimeout: 30000,
  verbose: true,
  forceExit: true,
  detectOpenHandles: false,
};
