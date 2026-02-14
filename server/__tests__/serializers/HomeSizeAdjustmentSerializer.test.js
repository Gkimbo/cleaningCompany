/**
 * Tests for HomeSizeAdjustmentSerializer
 * Ensures proper serialization and PII decryption
 */

// Mock EncryptionService
jest.mock("../../services/EncryptionService", () => ({
  decrypt: jest.fn((val) => {
    if (!val) return null;
    // Simulate decryption by removing "encrypted_" prefix if present
    if (val.startsWith("encrypted_")) {
      return val.replace("encrypted_", "");
    }
    return val;
  }),
}));

const HomeSizeAdjustmentSerializer = require("../../serializers/HomeSizeAdjustmentSerializer");
const EncryptionService = require("../../services/EncryptionService");

describe("HomeSizeAdjustmentSerializer", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("serializeUser", () => {
    it("should decrypt user PII fields", () => {
      const encryptedUser = {
        dataValues: {
          id: 1,
          firstName: "encrypted_John",
          lastName: "encrypted_Doe",
          email: "encrypted_john@example.com",
          falseClaimCount: 0,
          falseHomeSizeCount: 1,
        },
      };

      const result = HomeSizeAdjustmentSerializer.serializeUser(encryptedUser);

      expect(result.id).toBe(1);
      expect(result.firstName).toBe("John");
      expect(result.lastName).toBe("Doe");
      expect(result.email).toBe("john@example.com");
      expect(EncryptionService.decrypt).toHaveBeenCalledWith("encrypted_John");
      expect(EncryptionService.decrypt).toHaveBeenCalledWith("encrypted_Doe");
      expect(EncryptionService.decrypt).toHaveBeenCalledWith("encrypted_john@example.com");
    });

    it("should handle null user", () => {
      const result = HomeSizeAdjustmentSerializer.serializeUser(null);
      expect(result).toBeNull();
    });

    it("should handle plain object (not Sequelize instance)", () => {
      const plainUser = {
        id: 2,
        firstName: "encrypted_Jane",
        lastName: "encrypted_Smith",
        email: null,
      };

      const result = HomeSizeAdjustmentSerializer.serializeUser(plainUser);

      expect(result.id).toBe(2);
      expect(result.firstName).toBe("Jane");
      expect(result.lastName).toBe("Smith");
      expect(result.email).toBeNull();
    });
  });

  describe("serializeHome", () => {
    it("should decrypt home address fields", () => {
      const encryptedHome = {
        dataValues: {
          id: 1,
          address: "encrypted_123 Main St",
          city: "encrypted_Boston",
          state: "encrypted_MA",
          zipcode: "encrypted_02101",
          numBeds: "3",
          numBaths: "2",
        },
      };

      const result = HomeSizeAdjustmentSerializer.serializeHome(encryptedHome);

      expect(result.id).toBe(1);
      expect(result.address).toBe("123 Main St");
      expect(result.city).toBe("Boston");
      expect(result.state).toBe("MA");
      expect(result.zipcode).toBe("02101");
      expect(result.numBeds).toBe("3");
      expect(result.numBaths).toBe("2");
    });

    it("should handle null home", () => {
      const result = HomeSizeAdjustmentSerializer.serializeHome(null);
      expect(result).toBeNull();
    });
  });

  describe("serializeOne", () => {
    it("should serialize all request fields correctly", () => {
      const request = {
        dataValues: {
          id: 1,
          appointmentId: 10,
          homeId: 5,
          cleanerId: 2,
          homeownerId: 1,
          originalNumBeds: "3",
          originalNumBaths: "2",
          originalPrice: "150.00",
          reportedNumBeds: "4",
          reportedNumBaths: "3",
          calculatedNewPrice: "200.00",
          priceDifference: "50.00",
          status: "pending_homeowner",
          cleanerNote: "Home is larger",
          homeownerResponse: null,
          ownerNote: null,
          ownerId: null,
          chargeStatus: "pending",
          homeownerRespondedAt: null,
          ownerResolvedAt: null,
          expiresAt: new Date("2025-02-15T12:00:00Z"),
          createdAt: new Date("2025-02-14T12:00:00Z"),
          updatedAt: new Date("2025-02-14T12:00:00Z"),
        },
      };

      const result = HomeSizeAdjustmentSerializer.serializeOne(request);

      expect(result.id).toBe(1);
      expect(result.appointmentId).toBe(10);
      expect(result.originalPrice).toBe(150.0);
      expect(result.calculatedNewPrice).toBe(200.0);
      expect(result.priceDifference).toBe(50.0);
      expect(result.status).toBe("pending_homeowner");
    });

    it("should compute isExpired correctly", () => {
      const expiredRequest = {
        dataValues: {
          id: 1,
          expiresAt: new Date(Date.now() - 1000), // Past
        },
      };

      const notExpiredRequest = {
        dataValues: {
          id: 2,
          expiresAt: new Date(Date.now() + 100000), // Future
        },
      };

      const expiredResult = HomeSizeAdjustmentSerializer.serializeOne(expiredRequest);
      const notExpiredResult = HomeSizeAdjustmentSerializer.serializeOne(notExpiredRequest);

      expect(expiredResult.isExpired).toBe(true);
      expect(notExpiredResult.isExpired).toBe(false);
    });

    it("should serialize nested cleaner with decryption", () => {
      const request = {
        dataValues: { id: 1 },
        cleaner: {
          dataValues: {
            id: 2,
            firstName: "encrypted_Bob",
            lastName: "encrypted_Builder",
            email: "encrypted_bob@test.com",
          },
        },
      };

      const result = HomeSizeAdjustmentSerializer.serializeOne(request);

      expect(result.cleaner).toBeDefined();
      expect(result.cleaner.firstName).toBe("Bob");
      expect(result.cleaner.lastName).toBe("Builder");
    });

    it("should serialize nested homeowner with decryption", () => {
      const request = {
        dataValues: { id: 1 },
        homeowner: {
          dataValues: {
            id: 1,
            firstName: "encrypted_Alice",
            lastName: "encrypted_Owner",
            email: "encrypted_alice@test.com",
          },
        },
      };

      const result = HomeSizeAdjustmentSerializer.serializeOne(request);

      expect(result.homeowner).toBeDefined();
      expect(result.homeowner.firstName).toBe("Alice");
      expect(result.homeowner.lastName).toBe("Owner");
    });

    it("should serialize nested home with decryption", () => {
      const request = {
        dataValues: { id: 1 },
        home: {
          dataValues: {
            id: 5,
            address: "encrypted_456 Oak Ave",
            city: "encrypted_Cambridge",
            state: "encrypted_MA",
            zipcode: "encrypted_02139",
          },
        },
      };

      const result = HomeSizeAdjustmentSerializer.serializeOne(request);

      expect(result.home).toBeDefined();
      expect(result.home.address).toBe("456 Oak Ave");
      expect(result.home.city).toBe("Cambridge");
    });
  });

  describe("serializeArray", () => {
    it("should serialize array of requests", () => {
      const requests = [
        { dataValues: { id: 1, status: "pending_homeowner" } },
        { dataValues: { id: 2, status: "approved" } },
        { dataValues: { id: 3, status: "pending_owner" } },
      ];

      const result = HomeSizeAdjustmentSerializer.serializeArray(requests);

      expect(result).toHaveLength(3);
      expect(result[0].id).toBe(1);
      expect(result[1].id).toBe(2);
      expect(result[2].id).toBe(3);
    });

    it("should handle empty array", () => {
      const result = HomeSizeAdjustmentSerializer.serializeArray([]);
      expect(result).toHaveLength(0);
    });
  });

  describe("serializeForList", () => {
    it("should return minimal fields for list view", () => {
      const request = {
        dataValues: {
          id: 1,
          appointmentId: 10,
          originalNumBeds: "3",
          originalNumBaths: "2",
          reportedNumBeds: "4",
          reportedNumBaths: "3",
          priceDifference: "50.00",
          status: "pending_homeowner",
          expiresAt: new Date("2025-02-15"),
          createdAt: new Date("2025-02-14"),
          // Fields that should NOT be included in list view
          cleanerNote: "Some note",
          homeownerResponse: "Some response",
        },
        cleaner: {
          dataValues: {
            id: 2,
            firstName: "encrypted_John",
            lastName: "encrypted_Doe",
          },
        },
      };

      const result = HomeSizeAdjustmentSerializer.serializeForList(request);

      expect(result.id).toBe(1);
      expect(result.priceDifference).toBe(50.0);
      expect(result.cleaner.firstName).toBe("John");
      // Should not include detailed fields
      expect(result.cleanerNote).toBeUndefined();
      expect(result.homeownerResponse).toBeUndefined();
    });
  });

  describe("serializeForHomeowner", () => {
    it("should include photos for homeowner view", () => {
      const request = {
        dataValues: {
          id: 1,
          originalNumBeds: "3",
          originalNumBaths: "2",
          originalPrice: "150.00",
          reportedNumBeds: "4",
          reportedNumBaths: "3",
          calculatedNewPrice: "200.00",
          priceDifference: "50.00",
          cleanerNote: "The home has 4 bedrooms",
        },
        photos: [
          { id: 1, photoUrl: "https://example.com/photo1.jpg", roomType: "bedroom", roomNumber: 4 },
          { id: 2, photoUrl: "https://example.com/photo2.jpg", roomType: "bathroom", roomNumber: 3 },
        ],
        cleaner: {
          dataValues: {
            id: 2,
            firstName: "encrypted_Cleaner",
            lastName: "encrypted_Name",
          },
        },
      };

      const result = HomeSizeAdjustmentSerializer.serializeForHomeowner(request);

      expect(result.photos).toHaveLength(2);
      expect(result.photos[0].photoUrl).toBe("https://example.com/photo1.jpg");
      expect(result.photos[0].roomType).toBe("bedroom");
      expect(result.cleanerNote).toBe("The home has 4 bedrooms");
      expect(result.cleaner.firstName).toBe("Cleaner");
    });
  });

  describe("Edge cases", () => {
    it("should handle mixed encrypted and unencrypted data", () => {
      const user = {
        dataValues: {
          id: 1,
          firstName: "PlainJohn", // Not encrypted
          lastName: "encrypted_Doe", // Encrypted
          email: null,
        },
      };

      const result = HomeSizeAdjustmentSerializer.serializeUser(user);

      expect(result.firstName).toBe("PlainJohn");
      expect(result.lastName).toBe("Doe");
      expect(result.email).toBeNull();
    });

    it("should not expose sensitive fields", () => {
      const request = {
        dataValues: {
          id: 1,
          status: "approved",
        },
        cleaner: {
          dataValues: {
            id: 2,
            firstName: "encrypted_John",
            lastName: "encrypted_Doe",
            email: "encrypted_john@test.com",
            password: "hashedPassword123", // Should not be included
            stripeCustomerId: "cus_secret", // Should not be included
          },
        },
      };

      const result = HomeSizeAdjustmentSerializer.serializeOne(request);

      expect(result.cleaner.password).toBeUndefined();
      expect(result.cleaner.stripeCustomerId).toBeUndefined();
    });
  });
});
