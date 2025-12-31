/**
 * Tests for EncryptionService
 * Tests encryption, decryption, hashing, and edge cases for PII data protection
 */

const EncryptionService = require("../../services/EncryptionService");

describe("EncryptionService", () => {
  const TEST_KEY = "12345678901234567890123456789012"; // 32 chars

  beforeEach(() => {
    // Set up test encryption key
    process.env.PII_ENCRYPTION_KEY = TEST_KEY;
  });

  afterEach(() => {
    delete process.env.PII_ENCRYPTION_KEY;
  });

  describe("isEnabled", () => {
    it("should return true when key is set and valid", () => {
      expect(EncryptionService.isEnabled()).toBe(true);
    });

    it("should return falsy when key is not set", () => {
      delete process.env.PII_ENCRYPTION_KEY;
      expect(EncryptionService.isEnabled()).toBeFalsy();
    });

    it("should return falsy when key is too short", () => {
      process.env.PII_ENCRYPTION_KEY = "short";
      expect(EncryptionService.isEnabled()).toBeFalsy();
    });

    it("should return true for key exactly 32 characters", () => {
      process.env.PII_ENCRYPTION_KEY = "12345678901234567890123456789012";
      expect(EncryptionService.isEnabled()).toBe(true);
    });

    it("should return true for key longer than 32 characters", () => {
      process.env.PII_ENCRYPTION_KEY = "123456789012345678901234567890123456";
      expect(EncryptionService.isEnabled()).toBe(true);
    });
  });

  describe("encrypt", () => {
    it("should encrypt a string and return iv:ciphertext format", () => {
      const plainText = "test@example.com";
      const encrypted = EncryptionService.encrypt(plainText);

      expect(encrypted).toContain(":");
      expect(encrypted).not.toBe(plainText);

      const parts = encrypted.split(":");
      expect(parts.length).toBe(2);
      expect(parts[0].length).toBe(32); // IV is 16 bytes = 32 hex chars
    });

    it("should return null for null input", () => {
      expect(EncryptionService.encrypt(null)).toBeNull();
    });

    it("should return null for undefined input", () => {
      expect(EncryptionService.encrypt(undefined)).toBeNull();
    });

    it("should return null for empty string", () => {
      expect(EncryptionService.encrypt("")).toBeNull();
    });

    it("should encrypt different values differently", () => {
      const encrypted1 = EncryptionService.encrypt("value1");
      const encrypted2 = EncryptionService.encrypt("value2");

      expect(encrypted1).not.toBe(encrypted2);
    });

    it("should produce different ciphertext for same value (due to random IV)", () => {
      const value = "same-value";
      const encrypted1 = EncryptionService.encrypt(value);
      const encrypted2 = EncryptionService.encrypt(value);

      // IVs should be different
      const iv1 = encrypted1.split(":")[0];
      const iv2 = encrypted2.split(":")[0];
      expect(iv1).not.toBe(iv2);
    });

    it("should handle special characters", () => {
      const specialChars = "Test!@#$%^&*()_+-=[]{}|;':\",./<>?";
      const encrypted = EncryptionService.encrypt(specialChars);

      expect(encrypted).toContain(":");
      expect(EncryptionService.decrypt(encrypted)).toBe(specialChars);
    });

    it("should handle unicode characters", () => {
      const unicode = "Test unicode: \u00e9\u00e0\u00fc\u00f1 \u4e2d\u6587 \ud83d\ude00";
      const encrypted = EncryptionService.encrypt(unicode);

      expect(encrypted).toContain(":");
      expect(EncryptionService.decrypt(encrypted)).toBe(unicode);
    });

    it("should handle long strings", () => {
      const longString = "a".repeat(10000);
      const encrypted = EncryptionService.encrypt(longString);

      expect(encrypted).toContain(":");
      expect(EncryptionService.decrypt(encrypted)).toBe(longString);
    });

    it("should return plain text when encryption is disabled", () => {
      delete process.env.PII_ENCRYPTION_KEY;
      process.env.NODE_ENV = "development";

      const plainText = "test@example.com";
      const result = EncryptionService.encrypt(plainText);

      expect(result).toBe(plainText);

      process.env.NODE_ENV = "test";
    });
  });

  describe("decrypt", () => {
    it("should decrypt encrypted text back to original", () => {
      const original = "test@example.com";
      const encrypted = EncryptionService.encrypt(original);
      const decrypted = EncryptionService.decrypt(encrypted);

      expect(decrypted).toBe(original);
    });

    it("should return null for null input", () => {
      expect(EncryptionService.decrypt(null)).toBeNull();
    });

    it("should return null for undefined input", () => {
      expect(EncryptionService.decrypt(undefined)).toBeNull();
    });

    it("should return null for empty string", () => {
      expect(EncryptionService.decrypt("")).toBeNull();
    });

    it("should return unencrypted text as-is (backwards compatibility)", () => {
      const plainText = "unencrypted@example.com";
      const result = EncryptionService.decrypt(plainText);

      expect(result).toBe(plainText);
    });

    it("should handle malformed encrypted data gracefully", () => {
      const malformed = "not-valid-hex:also-invalid";
      const result = EncryptionService.decrypt(malformed);

      // Should return original on failure
      expect(result).toBe(malformed);
    });

    it("should handle invalid IV length gracefully", () => {
      const invalidIV = "abc:someciphertext";
      const result = EncryptionService.decrypt(invalidIV);

      expect(result).toBe(invalidIV);
    });

    it("should decrypt various data types correctly", () => {
      const testCases = [
        "simple text",
        "123-456-7890",
        "john.doe@example.com",
        "123 Main St, Apt 4B",
        "John Doe",
      ];

      testCases.forEach((testCase) => {
        const encrypted = EncryptionService.encrypt(testCase);
        const decrypted = EncryptionService.decrypt(encrypted);
        expect(decrypted).toBe(testCase);
      });
    });
  });

  describe("hash", () => {
    it("should create a deterministic hash", () => {
      const value = "test@example.com";
      const hash1 = EncryptionService.hash(value);
      const hash2 = EncryptionService.hash(value);

      expect(hash1).toBe(hash2);
    });

    it("should return null for null input", () => {
      expect(EncryptionService.hash(null)).toBeNull();
    });

    it("should return null for undefined input", () => {
      expect(EncryptionService.hash(undefined)).toBeNull();
    });

    it("should return null for empty string", () => {
      expect(EncryptionService.hash("")).toBeNull();
    });

    it("should be case insensitive (normalizes to lowercase)", () => {
      const hash1 = EncryptionService.hash("Test@Example.com");
      const hash2 = EncryptionService.hash("test@example.com");

      expect(hash1).toBe(hash2);
    });

    it("should trim whitespace before hashing", () => {
      const hash1 = EncryptionService.hash("  test@example.com  ");
      const hash2 = EncryptionService.hash("test@example.com");

      expect(hash1).toBe(hash2);
    });

    it("should produce different hashes for different values", () => {
      const hash1 = EncryptionService.hash("value1@example.com");
      const hash2 = EncryptionService.hash("value2@example.com");

      expect(hash1).not.toBe(hash2);
    });

    it("should return hex string of correct length", () => {
      const hash = EncryptionService.hash("test@example.com");

      expect(hash.length).toBe(64); // SHA-256 produces 64 hex chars
      expect(/^[0-9a-f]+$/.test(hash)).toBe(true);
    });
  });

  describe("encryptEmail", () => {
    it("should return encrypted email and hash", () => {
      const email = "test@example.com";
      const result = EncryptionService.encryptEmail(email);

      expect(result).toHaveProperty("encrypted");
      expect(result).toHaveProperty("hash");
      expect(result.encrypted).toContain(":");
      expect(result.hash.length).toBe(64);
    });

    it("should return null values for null input", () => {
      const result = EncryptionService.encryptEmail(null);

      expect(result.encrypted).toBeNull();
      expect(result.hash).toBeNull();
    });

    it("should return null values for empty string", () => {
      const result = EncryptionService.encryptEmail("");

      expect(result.encrypted).toBeNull();
      expect(result.hash).toBeNull();
    });

    it("should allow searching by hash", () => {
      const email = "user@example.com";
      const result = EncryptionService.encryptEmail(email);
      const searchHash = EncryptionService.hash(email);

      expect(result.hash).toBe(searchHash);
    });
  });

  describe("encryptPhone", () => {
    it("should encrypt phone number", () => {
      const phone = "123-456-7890";
      const encrypted = EncryptionService.encryptPhone(phone);

      expect(encrypted).toContain(":");
      expect(EncryptionService.decrypt(encrypted)).toBe(phone);
    });

    it("should return null for null input", () => {
      expect(EncryptionService.encryptPhone(null)).toBeNull();
    });

    it("should handle various phone formats", () => {
      const phones = [
        "1234567890",
        "(123) 456-7890",
        "+1-123-456-7890",
        "123.456.7890",
      ];

      phones.forEach((phone) => {
        const encrypted = EncryptionService.encryptPhone(phone);
        expect(EncryptionService.decrypt(encrypted)).toBe(phone);
      });
    });
  });

  describe("encryptAddress", () => {
    it("should encrypt address", () => {
      const address = "123 Main St, Apt 4B, City, State 12345";
      const encrypted = EncryptionService.encryptAddress(address);

      expect(encrypted).toContain(":");
      expect(EncryptionService.decrypt(encrypted)).toBe(address);
    });

    it("should return null for null input", () => {
      expect(EncryptionService.encryptAddress(null)).toBeNull();
    });

    it("should handle multi-line addresses", () => {
      const address = "123 Main Street\nApartment 4B\nCity, State 12345";
      const encrypted = EncryptionService.encryptAddress(address);
      expect(EncryptionService.decrypt(encrypted)).toBe(address);
    });
  });

  describe("getKey", () => {
    it("should return null in development when key is not set", () => {
      delete process.env.PII_ENCRYPTION_KEY;
      process.env.NODE_ENV = "development";

      // Suppress console.warn for this test
      const consoleSpy = jest.spyOn(console, "warn").mockImplementation();

      const key = EncryptionService.getKey();
      expect(key).toBeNull();

      consoleSpy.mockRestore();
      process.env.NODE_ENV = "test";
    });

    it("should return first 32 bytes of key when key is longer", () => {
      process.env.PII_ENCRYPTION_KEY =
        "123456789012345678901234567890123456789012345678";

      const key = EncryptionService.getKey();
      expect(key.length).toBe(32);
    });
  });

  describe("Round-trip encryption for PII data types", () => {
    const testData = {
      firstName: "John",
      lastName: "Doe",
      email: "john.doe@example.com",
      phone: "+1 (555) 123-4567",
      address: "123 Main St",
      city: "Boston",
      state: "MA",
      zipCode: "02101",
      ssnLast4: "1234",
      driversLicense: "DL123456789",
      emergencyContact: "Jane Doe",
      emergencyPhone: "(555) 987-6543",
    };

    Object.entries(testData).forEach(([field, value]) => {
      it(`should correctly encrypt and decrypt ${field}`, () => {
        const encrypted = EncryptionService.encrypt(value);
        const decrypted = EncryptionService.decrypt(encrypted);

        expect(encrypted).not.toBe(value);
        expect(encrypted).toContain(":");
        expect(decrypted).toBe(value);
      });
    });
  });

  describe("Security properties", () => {
    it("should not expose original value in encrypted output", () => {
      const sensitiveData = "secret-password-123";
      const encrypted = EncryptionService.encrypt(sensitiveData);

      expect(encrypted).not.toContain(sensitiveData);
      expect(encrypted).not.toContain("secret");
      expect(encrypted).not.toContain("password");
    });

    it("should produce ciphertext longer than plaintext due to IV", () => {
      const plainText = "short";
      const encrypted = EncryptionService.encrypt(plainText);

      expect(encrypted.length).toBeGreaterThan(plainText.length);
    });
  });
});
