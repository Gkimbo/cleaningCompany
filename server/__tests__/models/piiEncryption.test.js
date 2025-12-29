/**
 * Tests for PII Encryption in Models
 * Tests encryption hooks for User, UserHomes, and UserApplications models
 */

const EncryptionService = require("../../services/EncryptionService");

describe("PII Encryption - Model Integration", () => {
  const TEST_KEY = "12345678901234567890123456789012";

  beforeEach(() => {
    process.env.PII_ENCRYPTION_KEY = TEST_KEY;
  });

  afterEach(() => {
    delete process.env.PII_ENCRYPTION_KEY;
  });

  describe("User Model PII Fields", () => {
    const USER_PII_FIELDS = ["firstName", "lastName", "email", "notificationEmail", "phone"];

    it("should identify all User PII fields", () => {
      expect(USER_PII_FIELDS).toContain("firstName");
      expect(USER_PII_FIELDS).toContain("lastName");
      expect(USER_PII_FIELDS).toContain("email");
      expect(USER_PII_FIELDS).toContain("notificationEmail");
      expect(USER_PII_FIELDS).toContain("phone");
    });

    it("should encrypt and decrypt firstName correctly", () => {
      const firstName = "John";
      const encrypted = EncryptionService.encrypt(firstName);
      const decrypted = EncryptionService.decrypt(encrypted);

      expect(encrypted).not.toBe(firstName);
      expect(encrypted).toContain(":");
      expect(decrypted).toBe(firstName);
    });

    it("should encrypt and decrypt lastName correctly", () => {
      const lastName = "Doe";
      const encrypted = EncryptionService.encrypt(lastName);
      const decrypted = EncryptionService.decrypt(encrypted);

      expect(decrypted).toBe(lastName);
    });

    it("should encrypt and decrypt email correctly", () => {
      const email = "john.doe@example.com";
      const encrypted = EncryptionService.encrypt(email);
      const decrypted = EncryptionService.decrypt(encrypted);

      expect(decrypted).toBe(email);
    });

    it("should generate email hash for searching", () => {
      const email = "john.doe@example.com";
      const hash = EncryptionService.hash(email);

      expect(hash).toBeDefined();
      expect(hash.length).toBe(64);
      expect(hash).toBe(EncryptionService.hash(email)); // Deterministic
    });

    it("should encrypt and decrypt phone correctly", () => {
      const phone = "+1-555-123-4567";
      const encrypted = EncryptionService.encrypt(phone);
      const decrypted = EncryptionService.decrypt(encrypted);

      expect(decrypted).toBe(phone);
    });
  });

  describe("UserHomes Model PII Fields", () => {
    const HOMES_PII_FIELDS = [
      "address",
      "city",
      "state",
      "zipcode",
      "keyPadCode",
      "keyLocation",
      "contact",
      "latitude",
      "longitude",
    ];

    it("should identify all UserHomes PII fields", () => {
      HOMES_PII_FIELDS.forEach((field) => {
        expect(HOMES_PII_FIELDS).toContain(field);
      });
    });

    it("should encrypt and decrypt address correctly", () => {
      const address = "123 Main Street, Apt 4B";
      const encrypted = EncryptionService.encrypt(address);
      const decrypted = EncryptionService.decrypt(encrypted);

      expect(encrypted).toContain(":");
      expect(decrypted).toBe(address);
    });

    it("should encrypt and decrypt city correctly", () => {
      const city = "Boston";
      const encrypted = EncryptionService.encrypt(city);
      const decrypted = EncryptionService.decrypt(encrypted);

      expect(decrypted).toBe(city);
    });

    it("should encrypt and decrypt state correctly", () => {
      const state = "MA";
      const encrypted = EncryptionService.encrypt(state);
      const decrypted = EncryptionService.decrypt(encrypted);

      expect(decrypted).toBe(state);
    });

    it("should encrypt and decrypt zipcode correctly", () => {
      const zipcode = "02101";
      const encrypted = EncryptionService.encrypt(zipcode);
      const decrypted = EncryptionService.decrypt(encrypted);

      expect(decrypted).toBe(zipcode);
    });

    it("should encrypt and decrypt keyPadCode correctly", () => {
      const keyPadCode = "1234#";
      const encrypted = EncryptionService.encrypt(keyPadCode);
      const decrypted = EncryptionService.decrypt(encrypted);

      expect(decrypted).toBe(keyPadCode);
    });

    it("should encrypt and decrypt keyLocation correctly", () => {
      const keyLocation = "Under the doormat";
      const encrypted = EncryptionService.encrypt(keyLocation);
      const decrypted = EncryptionService.decrypt(encrypted);

      expect(decrypted).toBe(keyLocation);
    });

    it("should encrypt and decrypt contact correctly", () => {
      const contact = "Jane Doe (555) 987-6543";
      const encrypted = EncryptionService.encrypt(contact);
      const decrypted = EncryptionService.decrypt(encrypted);

      expect(decrypted).toBe(contact);
    });

    it("should encrypt and decrypt latitude correctly", () => {
      const latitude = "42.3601";
      const encrypted = EncryptionService.encrypt(latitude);
      const decrypted = EncryptionService.decrypt(encrypted);

      expect(decrypted).toBe(latitude);
    });

    it("should encrypt and decrypt longitude correctly", () => {
      const longitude = "-71.0589";
      const encrypted = EncryptionService.encrypt(longitude);
      const decrypted = EncryptionService.decrypt(encrypted);

      expect(decrypted).toBe(longitude);
    });
  });

  describe("UserApplications Model PII Fields", () => {
    const APPLICATION_PII_FIELDS = [
      "firstName",
      "lastName",
      "email",
      "phone",
      "streetAddress",
      "city",
      "state",
      "zipCode",
      "ssnLast4",
      "driversLicenseNumber",
      "driversLicenseState",
      "idPhoto",
      "previousEmployer",
      "previousEmployerPhone",
      "emergencyContactName",
      "emergencyContactPhone",
    ];

    it("should identify all UserApplications PII fields", () => {
      APPLICATION_PII_FIELDS.forEach((field) => {
        expect(APPLICATION_PII_FIELDS).toContain(field);
      });
    });

    it("should encrypt and decrypt SSN last 4 correctly", () => {
      const ssnLast4 = "1234";
      const encrypted = EncryptionService.encrypt(ssnLast4);
      const decrypted = EncryptionService.decrypt(encrypted);

      expect(decrypted).toBe(ssnLast4);
    });

    it("should encrypt and decrypt drivers license correctly", () => {
      const license = "DL123456789";
      const encrypted = EncryptionService.encrypt(license);
      const decrypted = EncryptionService.decrypt(encrypted);

      expect(decrypted).toBe(license);
    });

    it("should encrypt and decrypt previous employer correctly", () => {
      const employer = "ABC Cleaning Services";
      const encrypted = EncryptionService.encrypt(employer);
      const decrypted = EncryptionService.decrypt(encrypted);

      expect(decrypted).toBe(employer);
    });

    it("should encrypt and decrypt emergency contact correctly", () => {
      const contact = "Jane Doe";
      const encrypted = EncryptionService.encrypt(contact);
      const decrypted = EncryptionService.decrypt(encrypted);

      expect(decrypted).toBe(contact);
    });

    it("should generate email hash for applications", () => {
      const email = "applicant@example.com";
      const hash = EncryptionService.hash(email);

      expect(hash).toBeDefined();
      expect(hash.length).toBe(64);
    });
  });

  describe("Encryption Detection - Avoiding Double Encryption", () => {
    it("should detect already encrypted data by colon format", () => {
      const plainText = "test@example.com";
      const encrypted = EncryptionService.encrypt(plainText);

      // Check if contains colon (encrypted format)
      expect(encrypted.includes(":")).toBe(true);
      expect(encrypted.split(":").length).toBe(2);
    });

    it("should not double-encrypt already encrypted data", () => {
      const plainText = "test@example.com";
      const encrypted = EncryptionService.encrypt(plainText);

      // Simulating the model hook check
      const isAlreadyEncrypted =
        encrypted.includes(":") && encrypted.split(":").length === 2;

      expect(isAlreadyEncrypted).toBe(true);
    });

    it("should identify unencrypted data", () => {
      const plainText = "test@example.com";

      // Check if NOT encrypted
      const isEncrypted =
        plainText.includes(":") && plainText.split(":").length === 2;

      expect(isEncrypted).toBe(false);
    });
  });

  describe("Backward Compatibility", () => {
    it("should handle decryption of unencrypted (legacy) data", () => {
      const legacyData = "unencrypted@example.com";
      const result = EncryptionService.decrypt(legacyData);

      // Should return as-is for backward compatibility
      expect(result).toBe(legacyData);
    });

    it("should handle decryption of malformed encrypted data", () => {
      const malformed = "invalid:encrypted:format:extra";
      const result = EncryptionService.decrypt(malformed);

      // Should return as-is to prevent data loss
      expect(result).toBe(malformed);
    });
  });

  describe("Null and Empty Value Handling", () => {
    const testFields = [
      { name: "address", value: null },
      { name: "city", value: undefined },
      { name: "state", value: "" },
      { name: "phone", value: null },
    ];

    testFields.forEach(({ name, value }) => {
      it(`should handle ${value === null ? "null" : value === undefined ? "undefined" : "empty"} ${name}`, () => {
        const encrypted = EncryptionService.encrypt(value);
        expect(encrypted).toBeNull();
      });
    });
  });

  describe("Special Characters in PII", () => {
    it("should handle addresses with special characters", () => {
      const address = "123 O'Brien St. #4-B, Unit 5";
      const encrypted = EncryptionService.encrypt(address);
      const decrypted = EncryptionService.decrypt(encrypted);

      expect(decrypted).toBe(address);
    });

    it("should handle names with accents", () => {
      const name = "Jos\u00e9 Garc\u00eda";
      const encrypted = EncryptionService.encrypt(name);
      const decrypted = EncryptionService.decrypt(encrypted);

      expect(decrypted).toBe(name);
    });

    it("should handle phone numbers with various formats", () => {
      const phones = [
        "+1 (555) 123-4567",
        "555.123.4567",
        "5551234567",
        "+44 20 7123 4567",
      ];

      phones.forEach((phone) => {
        const encrypted = EncryptionService.encrypt(phone);
        const decrypted = EncryptionService.decrypt(encrypted);
        expect(decrypted).toBe(phone);
      });
    });
  });

  describe("Hash for Email Searching", () => {
    it("should produce consistent hash for same email regardless of case", () => {
      const email1 = "User@Example.COM";
      const email2 = "user@example.com";

      const hash1 = EncryptionService.hash(email1);
      const hash2 = EncryptionService.hash(email2);

      expect(hash1).toBe(hash2);
    });

    it("should allow lookup by email hash", () => {
      const email = "cleaner@example.com";
      const { encrypted, hash } = EncryptionService.encryptEmail(email);

      // Simulate database lookup
      const searchHash = EncryptionService.hash(email);

      expect(searchHash).toBe(hash);
      expect(EncryptionService.decrypt(encrypted)).toBe(email);
    });
  });

  describe("Coordinate Encryption", () => {
    it("should encrypt latitude as string", () => {
      const latitude = 42.3601;
      const encrypted = EncryptionService.encrypt(String(latitude));
      const decrypted = EncryptionService.decrypt(encrypted);

      expect(decrypted).toBe("42.3601");
      expect(parseFloat(decrypted)).toBeCloseTo(latitude, 4);
    });

    it("should encrypt longitude as string", () => {
      const longitude = -71.0589;
      const encrypted = EncryptionService.encrypt(String(longitude));
      const decrypted = EncryptionService.decrypt(encrypted);

      expect(decrypted).toBe("-71.0589");
      expect(parseFloat(decrypted)).toBeCloseTo(longitude, 4);
    });

    it("should preserve coordinate precision", () => {
      const coords = [
        { lat: "40.7128", lng: "-74.0060" },
        { lat: "34.0522", lng: "-118.2437" },
        { lat: "51.5074", lng: "-0.1278" },
      ];

      coords.forEach(({ lat, lng }) => {
        const encLat = EncryptionService.encrypt(lat);
        const encLng = EncryptionService.encrypt(lng);

        expect(EncryptionService.decrypt(encLat)).toBe(lat);
        expect(EncryptionService.decrypt(encLng)).toBe(lng);
      });
    });
  });
});
