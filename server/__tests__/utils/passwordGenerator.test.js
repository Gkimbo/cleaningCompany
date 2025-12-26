/**
 * Tests for Password Generator Utility
 * Tests secure password generation and unique username generation
 */

jest.mock("../../models", () => ({
  User: {
    findOne: jest.fn(),
  },
}));

const { User } = require("../../models");
const { generateSecurePassword, generateUniqueUsername } = require("../../utils/passwordGenerator");

describe("Password Generator Utility", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ============================================
  // generateSecurePassword TESTS
  // ============================================
  describe("generateSecurePassword", () => {
    it("should generate a password of default length (12 characters)", () => {
      const password = generateSecurePassword();
      expect(password.length).toBe(12);
    });

    it("should generate a password of custom length", () => {
      const password = generateSecurePassword(16);
      expect(password.length).toBe(16);
    });

    it("should contain at least one uppercase letter", () => {
      const password = generateSecurePassword();
      expect(/[A-Z]/.test(password)).toBe(true);
    });

    it("should contain at least one lowercase letter", () => {
      const password = generateSecurePassword();
      expect(/[a-z]/.test(password)).toBe(true);
    });

    it("should contain at least one number", () => {
      const password = generateSecurePassword();
      expect(/[0-9]/.test(password)).toBe(true);
    });

    it("should contain at least one special character", () => {
      const password = generateSecurePassword();
      expect(/[!@#$%&*]/.test(password)).toBe(true);
    });

    it("should generate different passwords on each call", () => {
      const passwords = new Set();
      for (let i = 0; i < 100; i++) {
        passwords.add(generateSecurePassword());
      }
      // With 100 generations, we should have many unique passwords
      expect(passwords.size).toBeGreaterThan(90);
    });

    it("should meet all password validation requirements", () => {
      // Run multiple times to ensure consistency
      for (let i = 0; i < 50; i++) {
        const password = generateSecurePassword();

        // Check length
        expect(password.length).toBeGreaterThanOrEqual(8);

        // Check all required character types
        expect(/[A-Z]/.test(password)).toBe(true);
        expect(/[a-z]/.test(password)).toBe(true);
        expect(/[0-9]/.test(password)).toBe(true);
        expect(/[!@#$%&*]/.test(password)).toBe(true);
      }
    });

    it("should only contain allowed characters", () => {
      const password = generateSecurePassword();
      const allowedPattern = /^[A-Za-z0-9!@#$%&*]+$/;
      expect(allowedPattern.test(password)).toBe(true);
    });
  });

  // ============================================
  // generateUniqueUsername TESTS
  // ============================================
  describe("generateUniqueUsername", () => {
    it("should generate username from first and last name", async () => {
      User.findOne.mockResolvedValue(null); // Username available

      const username = await generateUniqueUsername("John", "Doe");

      expect(username).toBe("john_doe");
    });

    it("should handle first name only", async () => {
      User.findOne.mockResolvedValue(null);

      const username = await generateUniqueUsername("John", "");

      expect(username).toBe("john");
    });

    it("should handle null last name", async () => {
      User.findOne.mockResolvedValue(null);

      const username = await generateUniqueUsername("Jane", null);

      expect(username).toBe("jane");
    });

    it("should convert to lowercase", async () => {
      User.findOne.mockResolvedValue(null);

      const username = await generateUniqueUsername("JOHN", "DOE");

      expect(username).toBe("john_doe");
    });

    it("should remove special characters", async () => {
      User.findOne.mockResolvedValue(null);

      const username = await generateUniqueUsername("John-Paul", "O'Brien");

      expect(username).toBe("johnpaul_obrien");
    });

    it("should remove spaces", async () => {
      User.findOne.mockResolvedValue(null);

      const username = await generateUniqueUsername("Mary Jane", "Watson");

      expect(username).toBe("maryjane_watson");
    });

    it("should truncate long names", async () => {
      User.findOne.mockResolvedValue(null);

      const username = await generateUniqueUsername(
        "Bartholomew",
        "Christopherson"
      );

      // Both should be truncated to 10 chars max
      expect(username.length).toBeLessThanOrEqual(21); // 10 + 1 + 10
    });

    it("should add suffix if username is taken", async () => {
      // First call: username taken, second call: available
      User.findOne
        .mockResolvedValueOnce({ id: 1 }) // john_doe taken
        .mockResolvedValueOnce(null); // john_doe123 available

      const username = await generateUniqueUsername("John", "Doe");

      expect(username).toMatch(/^john_doe\d{3}$/);
    });

    it("should try multiple suffixes if needed", async () => {
      // Multiple calls: keep returning taken until null
      User.findOne
        .mockResolvedValueOnce({ id: 1 })
        .mockResolvedValueOnce({ id: 2 })
        .mockResolvedValueOnce({ id: 3 })
        .mockResolvedValueOnce(null);

      const username = await generateUniqueUsername("John", "Doe");

      expect(username).toMatch(/^john_doe\d{3}$/);
      expect(User.findOne).toHaveBeenCalledTimes(4);
    });

    it("should handle empty first name", async () => {
      User.findOne.mockResolvedValue(null);

      const username = await generateUniqueUsername("", "Doe");

      // Should use default "user" and pad to minimum length
      expect(username).toBe("user_doe");
    });

    it("should handle both names empty", async () => {
      User.findOne.mockResolvedValue(null);

      const username = await generateUniqueUsername("", "");

      // Should use default and pad
      expect(username).toBe("user");
    });

    it("should pad short usernames to minimum 4 characters", async () => {
      User.findOne.mockResolvedValue(null);

      const username = await generateUniqueUsername("Jo", "");

      expect(username.length).toBeGreaterThanOrEqual(4);
    });

    it("should handle unicode characters by removing them", async () => {
      User.findOne.mockResolvedValue(null);

      const username = await generateUniqueUsername("José", "García");

      // Should only contain alphanumeric and underscore
      expect(/^[a-z0-9_]+$/.test(username)).toBe(true);
    });

    it("should handle numbers in names", async () => {
      User.findOne.mockResolvedValue(null);

      const username = await generateUniqueUsername("John3", "Doe2");

      expect(username).toBe("john3_doe2");
    });
  });
});
