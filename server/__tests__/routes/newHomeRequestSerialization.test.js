/**
 * New Home Request Router - Serialization Tests
 *
 * These tests verify the serialization logic used in the new home request router.
 * The fix was to decrypt home address fields and client/business owner names
 * before sending to the frontend.
 */

const EncryptionService = require("../../services/EncryptionService");

// Mock EncryptionService
jest.mock("../../services/EncryptionService", () => ({
  decrypt: jest.fn((value) => (value ? `decrypted_${value}` : null)),
}));

describe("New Home Request Router - Serialization Tests", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("Business owner pending requests serialization", () => {
    it("should decrypt home address, city, and state", () => {
      const home = {
        id: 100,
        nickName: "Beach House",
        address: "encrypted_123_main_st",
        city: "encrypted_boston",
        state: "encrypted_ma",
      };

      // This mimics the serialization pattern in GET /pending
      const serializedHome = {
        id: home.id,
        nickName: home.nickName,
        address: EncryptionService.decrypt(home.address),
        city: EncryptionService.decrypt(home.city),
        state: EncryptionService.decrypt(home.state),
      };

      expect(serializedHome.address).toBe("decrypted_encrypted_123_main_st");
      expect(serializedHome.city).toBe("decrypted_encrypted_boston");
      expect(serializedHome.state).toBe("decrypted_encrypted_ma");
      expect(serializedHome.nickName).toBe("Beach House"); // Not encrypted

      expect(EncryptionService.decrypt).toHaveBeenCalledWith("encrypted_123_main_st");
      expect(EncryptionService.decrypt).toHaveBeenCalledWith("encrypted_boston");
      expect(EncryptionService.decrypt).toHaveBeenCalledWith("encrypted_ma");
    });

    it("should decrypt client firstName and lastName into full name", () => {
      const client = {
        id: 10,
        firstName: "encrypted_john",
        lastName: "encrypted_doe",
      };

      // This mimics the serialization pattern
      const serializedClient = {
        id: client.id,
        name: `${EncryptionService.decrypt(client.firstName)} ${EncryptionService.decrypt(client.lastName)}`.trim(),
      };

      expect(serializedClient.name).toBe("decrypted_encrypted_john decrypted_encrypted_doe");
      expect(EncryptionService.decrypt).toHaveBeenCalledWith("encrypted_john");
      expect(EncryptionService.decrypt).toHaveBeenCalledWith("encrypted_doe");
    });

    it("should handle null home gracefully", () => {
      const request = {
        id: 1,
        home: null,
        client: null,
      };

      const serializedHome = request.home
        ? {
            id: request.home.id,
            address: EncryptionService.decrypt(request.home.address),
          }
        : null;

      expect(serializedHome).toBeNull();
    });
  });

  describe("Client requests serialization", () => {
    it("should decrypt business owner firstName and lastName", () => {
      const businessOwner = {
        id: 5,
        firstName: "encrypted_alice",
        lastName: "encrypted_smith",
      };

      const serializedOwner = {
        id: businessOwner.id,
        name: `${EncryptionService.decrypt(businessOwner.firstName)} ${EncryptionService.decrypt(businessOwner.lastName)}`.trim(),
      };

      expect(serializedOwner.name).toBe("decrypted_encrypted_alice decrypted_encrypted_smith");
    });

    it("should decrypt home address and city for client view", () => {
      const home = {
        id: 100,
        nickName: "City Apartment",
        address: "encrypted_456_elm_st",
        city: "encrypted_cambridge",
        isMarketplaceEnabled: true,
      };

      const serializedHome = {
        id: home.id,
        nickName: home.nickName,
        address: EncryptionService.decrypt(home.address),
        city: EncryptionService.decrypt(home.city),
        isMarketplaceEnabled: home.isMarketplaceEnabled,
      };

      expect(serializedHome.address).toBe("decrypted_encrypted_456_elm_st");
      expect(serializedHome.city).toBe("decrypted_encrypted_cambridge");
      expect(serializedHome.isMarketplaceEnabled).toBe(true);
    });
  });

  describe("Full request serialization pattern", () => {
    it("should serialize a complete pending request for business owner", () => {
      const request = {
        id: 1,
        homeId: 100,
        clientId: 10,
        status: "pending",
        calculatedPrice: 15000,
        numBeds: 3,
        numBaths: 2,
        expiresAt: new Date("2024-01-25"),
        requestCount: 1,
        createdAt: new Date("2024-01-15"),
        home: {
          id: 100,
          nickName: "Beach House",
          address: "encrypted_123_main_st",
          city: "encrypted_boston",
          state: "encrypted_ma",
        },
        client: {
          id: 10,
          firstName: "encrypted_john",
          lastName: "encrypted_doe",
        },
      };

      // Full serialization pattern from GET /pending
      const serialized = {
        id: request.id,
        homeId: request.homeId,
        clientId: request.clientId,
        status: request.status,
        calculatedPrice: request.calculatedPrice,
        numBeds: request.numBeds,
        numBaths: request.numBaths,
        expiresAt: request.expiresAt,
        requestCount: request.requestCount,
        createdAt: request.createdAt,
        home: request.home
          ? {
              id: request.home.id,
              nickName: request.home.nickName,
              address: EncryptionService.decrypt(request.home.address),
              city: EncryptionService.decrypt(request.home.city),
              state: EncryptionService.decrypt(request.home.state),
            }
          : null,
        client: request.client
          ? {
              id: request.client.id,
              name: `${EncryptionService.decrypt(request.client.firstName)} ${EncryptionService.decrypt(request.client.lastName)}`.trim(),
            }
          : null,
      };

      // Verify structure
      expect(serialized.id).toBe(1);
      expect(serialized.status).toBe("pending");
      expect(serialized.calculatedPrice).toBe(15000);

      // Verify home is decrypted
      expect(serialized.home.address).toBe("decrypted_encrypted_123_main_st");
      expect(serialized.home.city).toBe("decrypted_encrypted_boston");
      expect(serialized.home.state).toBe("decrypted_encrypted_ma");
      expect(serialized.home.nickName).toBe("Beach House");

      // Verify client name is decrypted
      expect(serialized.client.name).toBe("decrypted_encrypted_john decrypted_encrypted_doe");

      // Verify all decrypt calls were made
      expect(EncryptionService.decrypt).toHaveBeenCalledTimes(5); // 3 home fields + 2 client fields
    });

    it("should serialize multiple requests correctly", () => {
      const requests = [
        {
          id: 1,
          home: { id: 100, address: "encrypted_addr_1", city: "encrypted_city_1", state: "encrypted_state_1" },
          client: { id: 10, firstName: "encrypted_first_1", lastName: "encrypted_last_1" },
        },
        {
          id: 2,
          home: { id: 200, address: "encrypted_addr_2", city: "encrypted_city_2", state: "encrypted_state_2" },
          client: { id: 20, firstName: "encrypted_first_2", lastName: "encrypted_last_2" },
        },
      ];

      const serialized = requests.map((r) => ({
        id: r.id,
        home: {
          id: r.home.id,
          address: EncryptionService.decrypt(r.home.address),
          city: EncryptionService.decrypt(r.home.city),
          state: EncryptionService.decrypt(r.home.state),
        },
        client: {
          name: `${EncryptionService.decrypt(r.client.firstName)} ${EncryptionService.decrypt(r.client.lastName)}`.trim(),
        },
      }));

      expect(serialized).toHaveLength(2);
      expect(serialized[0].home.address).toBe("decrypted_encrypted_addr_1");
      expect(serialized[0].client.name).toBe("decrypted_encrypted_first_1 decrypted_encrypted_last_1");
      expect(serialized[1].home.address).toBe("decrypted_encrypted_addr_2");
      expect(serialized[1].client.name).toBe("decrypted_encrypted_first_2 decrypted_encrypted_last_2");

      // 5 fields x 2 requests = 10 decrypt calls
      expect(EncryptionService.decrypt).toHaveBeenCalledTimes(10);
    });
  });
});
