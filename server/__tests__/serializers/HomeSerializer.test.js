const HomeSerializer = require("../../serializers/homesSerializer");
const EncryptionService = require("../../services/EncryptionService");

// Mock EncryptionService
jest.mock("../../services/EncryptionService", () => ({
  decrypt: jest.fn((value) => `decrypted_${value}`),
}));

describe("HomeSerializer", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("serializeOne", () => {
    it("should return null for null input", () => {
      const result = HomeSerializer.serializeOne(null);
      expect(result).toBeNull();
    });

    it("should serialize basic home fields from dataValues", () => {
      const mockHome = {
        dataValues: {
          id: 1,
          nickName: "Beach House",
          numBeds: 3,
          numBaths: 2,
          sheetsProvided: true,
          towelsProvided: false,
          specialNotes: "Please use back entrance",
        },
      };

      const result = HomeSerializer.serializeOne(mockHome);

      expect(result.id).toBe(1);
      expect(result.nickName).toBe("Beach House");
      expect(result.numBeds).toBe(3);
      expect(result.numBaths).toBe(2);
      expect(result.sheetsProvided).toBe(true);
      expect(result.towelsProvided).toBe(false);
      expect(result.specialNotes).toBe("Please use back entrance");
    });

    it("should serialize linen location fields", () => {
      const mockHome = {
        dataValues: {
          id: 1,
          cleanSheetsLocation: "Hall closet",
          dirtySheetsLocation: "Laundry room",
          cleanTowelsLocation: "Bathroom cabinet",
          dirtyTowelsLocation: "Hamper in bathroom",
        },
      };

      const result = HomeSerializer.serializeOne(mockHome);

      expect(result.cleanSheetsLocation).toBe("Hall closet");
      expect(result.dirtySheetsLocation).toBe("Laundry room");
      expect(result.cleanTowelsLocation).toBe("Bathroom cabinet");
      expect(result.dirtyTowelsLocation).toBe("Hamper in bathroom");
    });

    it("should decrypt encrypted address field", () => {
      const mockHome = {
        dataValues: {
          id: 1,
          address: "iv123:encryptedaddress",
        },
      };

      const result = HomeSerializer.serializeOne(mockHome);

      expect(EncryptionService.decrypt).toHaveBeenCalledWith("iv123:encryptedaddress");
      expect(result.address).toBe("decrypted_iv123:encryptedaddress");
    });

    it("should decrypt encrypted city field", () => {
      const mockHome = {
        dataValues: {
          id: 1,
          city: "iv456:encryptedcity",
        },
      };

      const result = HomeSerializer.serializeOne(mockHome);

      expect(EncryptionService.decrypt).toHaveBeenCalledWith("iv456:encryptedcity");
      expect(result.city).toBe("decrypted_iv456:encryptedcity");
    });

    it("should decrypt encrypted state field", () => {
      const mockHome = {
        dataValues: {
          id: 1,
          state: "iv789:encryptedstate",
        },
      };

      const result = HomeSerializer.serializeOne(mockHome);

      expect(EncryptionService.decrypt).toHaveBeenCalledWith("iv789:encryptedstate");
    });

    it("should decrypt encrypted zipcode field", () => {
      const mockHome = {
        dataValues: {
          id: 1,
          zipcode: "ivabc:encryptedzip",
        },
      };

      const result = HomeSerializer.serializeOne(mockHome);

      expect(EncryptionService.decrypt).toHaveBeenCalledWith("ivabc:encryptedzip");
    });

    it("should decrypt encrypted keyPadCode field", () => {
      const mockHome = {
        dataValues: {
          id: 1,
          keyPadCode: "ivdef:encryptedcode",
        },
      };

      const result = HomeSerializer.serializeOne(mockHome);

      expect(EncryptionService.decrypt).toHaveBeenCalledWith("ivdef:encryptedcode");
    });

    it("should decrypt encrypted keyLocation field", () => {
      const mockHome = {
        dataValues: {
          id: 1,
          keyLocation: "ivghi:encryptedlocation",
        },
      };

      const result = HomeSerializer.serializeOne(mockHome);

      expect(EncryptionService.decrypt).toHaveBeenCalledWith("ivghi:encryptedlocation");
    });

    it("should decrypt encrypted contact field", () => {
      const mockHome = {
        dataValues: {
          id: 1,
          contact: "ivjkl:encryptedcontact",
        },
      };

      const result = HomeSerializer.serializeOne(mockHome);

      expect(EncryptionService.decrypt).toHaveBeenCalledWith("ivjkl:encryptedcontact");
    });

    it("should pass non-encrypted values through decrypt (which returns them as-is)", () => {
      // EncryptionService.decrypt() handles non-encrypted values by returning them unchanged
      // Mock the real behavior: return original value for non-encrypted data (no colon)
      EncryptionService.decrypt.mockImplementation((value) => {
        if (!value.includes(":")) return value;
        return `decrypted_${value}`;
      });

      const mockHome = {
        dataValues: {
          id: 1,
          address: "123 Main Street",
          city: "Boston",
        },
      };

      const result = HomeSerializer.serializeOne(mockHome);

      // Decrypt is called but returns original value for non-encrypted data
      expect(EncryptionService.decrypt).toHaveBeenCalledWith("123 Main Street");
      expect(EncryptionService.decrypt).toHaveBeenCalledWith("Boston");
      expect(result.address).toBe("123 Main Street");
      expect(result.city).toBe("Boston");
    });

    it("should pass values with multiple colons through decrypt (which returns them as-is)", () => {
      // EncryptionService.decrypt() handles values with multiple colons by returning them unchanged
      // Mock the real behavior: return original value when not in iv:ciphertext format
      EncryptionService.decrypt.mockImplementation((value) => {
        const parts = value.split(":");
        if (parts.length !== 2) return value;
        return `decrypted_${value}`;
      });

      const mockHome = {
        dataValues: {
          id: 1,
          address: "10:30:00 AM timezone",
        },
      };

      const result = HomeSerializer.serializeOne(mockHome);

      // Decrypt is called but returns original value for non-encrypted format
      expect(EncryptionService.decrypt).toHaveBeenCalledWith("10:30:00 AM timezone");
      expect(result.address).toBe("10:30:00 AM timezone");
    });

    it("should handle decryption errors gracefully", () => {
      // EncryptionService.decrypt() handles errors internally and returns original value
      EncryptionService.decrypt.mockImplementation((value) => {
        // Simulate EncryptionService behavior: return original value on error
        return value;
      });

      const mockHome = {
        dataValues: {
          id: 1,
          address: "iv123:encrypted",
        },
      };

      const result = HomeSerializer.serializeOne(mockHome);

      // Should return original value when decryption fails
      expect(result.address).toBe("iv123:encrypted");
    });

    it("should handle null encrypted field values", () => {
      const mockHome = {
        dataValues: {
          id: 1,
          address: null,
          city: null,
        },
      };

      const result = HomeSerializer.serializeOne(mockHome);

      expect(EncryptionService.decrypt).not.toHaveBeenCalled();
      expect(result.address).toBeNull();
      expect(result.city).toBeNull();
    });

    it("should access values directly if dataValues not present", () => {
      const mockHome = {
        id: 1,
        nickName: "Direct Access Home",
        address: "456 Oak Ave",
      };

      const result = HomeSerializer.serializeOne(mockHome);

      expect(result.id).toBe(1);
      expect(result.nickName).toBe("Direct Access Home");
      expect(result.address).toBe("456 Oak Ave");
    });
  });

  describe("serializeArray", () => {
    it("should serialize an array of homes", () => {
      const mockHomes = [
        {
          dataValues: {
            id: 1,
            nickName: "Home 1",
            numBeds: 2,
            numBaths: 1,
          },
        },
        {
          dataValues: {
            id: 2,
            nickName: "Home 2",
            numBeds: 4,
            numBaths: 3,
          },
        },
      ];

      const result = HomeSerializer.serializeArray(mockHomes);

      expect(result).toHaveLength(2);
      expect(result[0].nickName).toBe("Home 1");
      expect(result[1].nickName).toBe("Home 2");
    });

    it("should decrypt encrypted fields in array", () => {
      // Restore the mock implementation (it may have been changed by previous tests)
      EncryptionService.decrypt.mockImplementation((value) => `decrypted_${value}`);

      const mockHomes = [
        {
          dataValues: {
            id: 1,
            address: "iv1:enc1",
          },
        },
        {
          dataValues: {
            id: 2,
            address: "iv2:enc2",
          },
        },
      ];

      const result = HomeSerializer.serializeArray(mockHomes);

      // The decrypt function should have been called for each address
      expect(EncryptionService.decrypt).toHaveBeenCalled();
      expect(result[0].address).toBe("decrypted_iv1:enc1");
      expect(result[1].address).toBe("decrypted_iv2:enc2");
    });

    it("should handle empty array", () => {
      const result = HomeSerializer.serializeArray([]);
      expect(result).toEqual([]);
    });
  });

  describe("allowedAttributes", () => {
    it("should include all required fields", () => {
      const expectedFields = [
        "id",
        "nickName",
        "address",
        "city",
        "state",
        "zipcode",
        "numBeds",
        "numBaths",
        "sheetsProvided",
        "towelsProvided",
        "keyPadCode",
        "keyLocation",
        "recyclingLocation",
        "compostLocation",
        "trashLocation",
        "contact",
        "specialNotes",
        "cleanersNeeded",
        "timeToBeCompleted",
        "outsideServiceArea",
        "bedConfigurations",
        "bathroomConfigurations",
        "cleanSheetsLocation",
        "dirtySheetsLocation",
        "cleanTowelsLocation",
        "dirtyTowelsLocation",
      ];

      expectedFields.forEach((field) => {
        expect(HomeSerializer.allowedAttributes).toContain(field);
      });
    });
  });

  describe("encryptedFields", () => {
    it("should list all PII fields that need decryption", () => {
      const expectedEncryptedFields = [
        "address",
        "city",
        "state",
        "zipcode",
        "keyPadCode",
        "keyLocation",
        "contact",
      ];

      expectedEncryptedFields.forEach((field) => {
        expect(HomeSerializer.encryptedFields).toContain(field);
      });
    });
  });
});
