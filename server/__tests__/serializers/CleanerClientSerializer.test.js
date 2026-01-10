const CleanerClientSerializer = require("../../serializers/CleanerClientSerializer");
const EncryptionService = require("../../services/EncryptionService");

// Mock EncryptionService
jest.mock("../../services/EncryptionService", () => ({
  decrypt: jest.fn((value) => `decrypted_${value}`),
}));

describe("CleanerClientSerializer", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("decryptField", () => {
    it("should return null for null value", () => {
      const result = CleanerClientSerializer.decryptField(null);
      expect(result).toBeNull();
      expect(EncryptionService.decrypt).not.toHaveBeenCalled();
    });

    it("should decrypt non-null value", () => {
      const result = CleanerClientSerializer.decryptField("encrypted_value");
      expect(EncryptionService.decrypt).toHaveBeenCalledWith("encrypted_value");
      expect(result).toBe("decrypted_encrypted_value");
    });
  });

  describe("serializeOne", () => {
    it("should serialize basic cleaner client fields", () => {
      const mockCleanerClient = {
        dataValues: {
          id: 1,
          cleanerId: 10,
          clientId: 20,
          homeId: 30,
          inviteToken: "abc123token",
          status: "active",
          autoPayEnabled: true,
          autoScheduleEnabled: false,
          createdAt: new Date("2026-01-01"),
          updatedAt: new Date("2026-01-01"),
        },
      };

      const result = CleanerClientSerializer.serializeOne(mockCleanerClient);

      expect(result.id).toBe(1);
      expect(result.cleanerId).toBe(10);
      expect(result.clientId).toBe(20);
      expect(result.homeId).toBe(30);
      expect(result.inviteToken).toBe("abc123token");
      expect(result.status).toBe("active");
      expect(result.autoPayEnabled).toBe(true);
      expect(result.autoScheduleEnabled).toBe(false);
    });

    it("should decrypt PII fields", () => {
      const mockCleanerClient = {
        dataValues: {
          id: 1,
          invitedEmail: "iv:email",
          invitedName: "iv:name",
          invitedPhone: "iv:phone",
        },
      };

      const result = CleanerClientSerializer.serializeOne(mockCleanerClient);

      expect(EncryptionService.decrypt).toHaveBeenCalledWith("iv:email");
      expect(EncryptionService.decrypt).toHaveBeenCalledWith("iv:name");
      expect(EncryptionService.decrypt).toHaveBeenCalledWith("iv:phone");

      expect(result.invitedEmail).toBe("decrypted_iv:email");
      expect(result.invitedName).toBe("decrypted_iv:name");
      expect(result.invitedPhone).toBe("decrypted_iv:phone");
    });

    it("should parse invitedBaths decimal field as number", () => {
      const mockCleanerClient = {
        dataValues: {
          id: 1,
          invitedBaths: "2.5",
        },
      };

      const result = CleanerClientSerializer.serializeOne(mockCleanerClient);

      expect(result.invitedBaths).toBe(2.5);
      expect(typeof result.invitedBaths).toBe("number");
    });

    it("should handle null invitedBaths", () => {
      const mockCleanerClient = {
        dataValues: {
          id: 1,
          invitedBaths: null,
        },
      };

      const result = CleanerClientSerializer.serializeOne(mockCleanerClient);

      expect(result.invitedBaths).toBeNull();
    });

    it("should parse defaultPrice decimal field as number", () => {
      const mockCleanerClient = {
        dataValues: {
          id: 1,
          defaultPrice: "250.00",
        },
      };

      const result = CleanerClientSerializer.serializeOne(mockCleanerClient);

      expect(result.defaultPrice).toBe(250);
      expect(typeof result.defaultPrice).toBe("number");
    });

    it("should handle null defaultPrice", () => {
      const mockCleanerClient = {
        dataValues: {
          id: 1,
          defaultPrice: null,
        },
      };

      const result = CleanerClientSerializer.serializeOne(mockCleanerClient);

      expect(result.defaultPrice).toBeNull();
    });

    it("should add day name based on defaultDayOfWeek", () => {
      const testCases = [
        { defaultDayOfWeek: 0, expectedDayName: "Sunday" },
        { defaultDayOfWeek: 1, expectedDayName: "Monday" },
        { defaultDayOfWeek: 2, expectedDayName: "Tuesday" },
        { defaultDayOfWeek: 3, expectedDayName: "Wednesday" },
        { defaultDayOfWeek: 4, expectedDayName: "Thursday" },
        { defaultDayOfWeek: 5, expectedDayName: "Friday" },
        { defaultDayOfWeek: 6, expectedDayName: "Saturday" },
      ];

      testCases.forEach(({ defaultDayOfWeek, expectedDayName }) => {
        const mockCleanerClient = {
          dataValues: {
            id: 1,
            defaultDayOfWeek,
          },
        };

        const result = CleanerClientSerializer.serializeOne(mockCleanerClient);

        expect(result.defaultDayName).toBe(expectedDayName);
      });
    });

    it("should not add day name when defaultDayOfWeek is null", () => {
      const mockCleanerClient = {
        dataValues: {
          id: 1,
          defaultDayOfWeek: null,
        },
      };

      const result = CleanerClientSerializer.serializeOne(mockCleanerClient);

      expect(result.defaultDayName).toBeUndefined();
    });

    it("should parse invitedAddress JSON string", () => {
      const mockCleanerClient = {
        dataValues: {
          id: 1,
          invitedAddress: JSON.stringify({
            street: "123 Main St",
            city: "Boston",
            state: "MA",
          }),
        },
      };

      const result = CleanerClientSerializer.serializeOne(mockCleanerClient);

      expect(result.invitedAddress).toEqual({
        street: "123 Main St",
        city: "Boston",
        state: "MA",
      });
    });

    it("should pass through invitedAddress when already an object", () => {
      const addressObj = {
        street: "456 Oak Ave",
        city: "Newton",
        state: "MA",
      };

      const mockCleanerClient = {
        dataValues: {
          id: 1,
          invitedAddress: addressObj,
        },
      };

      const result = CleanerClientSerializer.serializeOne(mockCleanerClient);

      expect(result.invitedAddress).toEqual(addressObj);
    });

    it("should handle invalid JSON in invitedAddress", () => {
      const mockCleanerClient = {
        dataValues: {
          id: 1,
          invitedAddress: "invalid json string",
        },
      };

      const result = CleanerClientSerializer.serializeOne(mockCleanerClient);

      expect(result.invitedAddress).toBe("invalid json string");
    });

    it("should serialize cleaner with decrypted fields when included", () => {
      const mockCleanerClient = {
        dataValues: {
          id: 1,
        },
        cleaner: {
          dataValues: {
            id: 10,
            firstName: "iv:cleanerfirst",
            lastName: "iv:cleanerlast",
            email: "iv:cleaneremail",
            phone: "iv:cleanerphone",
          },
        },
      };

      const result = CleanerClientSerializer.serializeOne(mockCleanerClient);

      expect(result.cleaner).toBeDefined();
      expect(result.cleaner.id).toBe(10);
      expect(result.cleaner.firstName).toBe("decrypted_iv:cleanerfirst");
      expect(result.cleaner.lastName).toBe("decrypted_iv:cleanerlast");
    });

    it("should serialize client with decrypted fields when included", () => {
      const mockCleanerClient = {
        dataValues: {
          id: 1,
        },
        client: {
          dataValues: {
            id: 20,
            firstName: "iv:clientfirst",
            lastName: "iv:clientlast",
            email: "iv:clientemail",
            phone: "iv:clientphone",
          },
        },
      };

      const result = CleanerClientSerializer.serializeOne(mockCleanerClient);

      expect(result.client).toBeDefined();
      expect(result.client.id).toBe(20);
      expect(result.client.firstName).toBe("decrypted_iv:clientfirst");
    });

    it("should serialize home with decrypted fields when included", () => {
      const mockCleanerClient = {
        dataValues: {
          id: 1,
        },
        home: {
          dataValues: {
            id: 30,
            address: "iv:homeaddress",
            city: "iv:homecity",
            state: "iv:homestate",
            zipcode: "iv:homezipcode",
            numBeds: 3,
            numBaths: 2,
          },
        },
      };

      const result = CleanerClientSerializer.serializeOne(mockCleanerClient);

      expect(result.home).toBeDefined();
      expect(result.home.id).toBe(30);
      expect(result.home.address).toBe("decrypted_iv:homeaddress");
      expect(result.home.numBeds).toBe(3);
    });

    it("should serialize recurring schedules with parsed price", () => {
      const mockCleanerClient = {
        dataValues: {
          id: 1,
        },
        recurringSchedules: [
          {
            id: 100,
            frequency: "weekly",
            dayOfWeek: 1,
            price: "200.00",
            isActive: true,
            isPaused: false,
          },
          {
            id: 101,
            frequency: "biweekly",
            dayOfWeek: 4,
            price: "225.50",
            isActive: true,
            isPaused: false,
          },
        ],
      };

      const result = CleanerClientSerializer.serializeOne(mockCleanerClient);

      expect(result.recurringSchedules).toHaveLength(2);
      expect(result.recurringSchedules[0].id).toBe(100);
      expect(result.recurringSchedules[0].price).toBe(200);
      expect(typeof result.recurringSchedules[0].price).toBe("number");
      expect(result.recurringSchedules[1].price).toBe(225.5);
      expect(typeof result.recurringSchedules[1].price).toBe("number");
    });

    it("should handle null price in recurring schedules", () => {
      const mockCleanerClient = {
        dataValues: {
          id: 1,
        },
        recurringSchedules: [
          {
            id: 100,
            frequency: "weekly",
            dayOfWeek: 1,
            price: null,
            isActive: true,
            isPaused: false,
          },
        ],
      };

      const result = CleanerClientSerializer.serializeOne(mockCleanerClient);

      expect(result.recurringSchedules[0].price).toBeNull();
    });
  });

  describe("serializeArray", () => {
    it("should serialize an array of cleaner clients", () => {
      const mockCleanerClients = [
        {
          dataValues: {
            id: 1,
            invitedName: "iv:name1",
            defaultPrice: "200.00",
          },
        },
        {
          dataValues: {
            id: 2,
            invitedName: "iv:name2",
            defaultPrice: "250.00",
          },
        },
      ];

      const result = CleanerClientSerializer.serializeArray(mockCleanerClients);

      expect(result).toHaveLength(2);
      expect(result[0].invitedName).toBe("decrypted_iv:name1");
      expect(result[0].defaultPrice).toBe(200);
      expect(result[1].invitedName).toBe("decrypted_iv:name2");
      expect(result[1].defaultPrice).toBe(250);
    });

    it("should handle empty array", () => {
      const result = CleanerClientSerializer.serializeArray([]);
      expect(result).toEqual([]);
    });
  });

  describe("serializeForList", () => {
    it("should return minimal list view data", () => {
      const mockCleanerClient = {
        dataValues: {
          id: 1,
          invitedName: "iv:name",
          invitedEmail: "iv:email",
          status: "active",
          defaultFrequency: "weekly",
          defaultPrice: "200.00",
          invitedAt: new Date("2026-01-01"),
          acceptedAt: new Date("2026-01-05"),
          // Fields NOT included in list view
          inviteToken: "abc123",
          autoPayEnabled: true,
        },
      };

      const result = CleanerClientSerializer.serializeForList(mockCleanerClient);

      expect(result.id).toBe(1);
      expect(result.invitedName).toBe("decrypted_iv:name");
      expect(result.invitedEmail).toBe("decrypted_iv:email");
      expect(result.status).toBe("active");
      expect(result.defaultFrequency).toBe("weekly");
      expect(result.defaultPrice).toBe(200);

      // Should NOT include
      expect(result.inviteToken).toBeUndefined();
      expect(result.autoPayEnabled).toBeUndefined();
    });

    it("should parse defaultPrice as number in list view", () => {
      const mockCleanerClient = {
        dataValues: {
          id: 1,
          defaultPrice: "175.50",
        },
      };

      const result = CleanerClientSerializer.serializeForList(mockCleanerClient);

      expect(result.defaultPrice).toBe(175.5);
      expect(typeof result.defaultPrice).toBe("number");
    });

    it("should include client data if present", () => {
      const mockCleanerClient = {
        dataValues: {
          id: 1,
        },
        client: {
          dataValues: {
            id: 20,
            firstName: "iv:first",
            lastName: "iv:last",
            email: "iv:email",
            phone: "iv:phone",
          },
        },
      };

      const result = CleanerClientSerializer.serializeForList(mockCleanerClient);

      expect(result.client).toBeDefined();
      expect(result.client.firstName).toBe("decrypted_iv:first");
    });

    it("should include home data if present", () => {
      const mockCleanerClient = {
        dataValues: {
          id: 1,
        },
        home: {
          dataValues: {
            id: 30,
            address: "iv:address",
            city: "iv:city",
            state: "iv:state",
            zipcode: "iv:zipcode",
            numBeds: 3,
            numBaths: 2,
          },
        },
      };

      const result = CleanerClientSerializer.serializeForList(mockCleanerClient);

      expect(result.home).toBeDefined();
      expect(result.home.address).toBe("decrypted_iv:address");
    });
  });

  describe("serializeArrayForList", () => {
    it("should serialize array for list view", () => {
      const mockCleanerClients = [
        {
          dataValues: {
            id: 1,
            invitedName: "iv:name1",
            defaultPrice: "200.00",
          },
        },
        {
          dataValues: {
            id: 2,
            invitedName: "iv:name2",
            defaultPrice: "250.00",
          },
        },
      ];

      const result = CleanerClientSerializer.serializeArrayForList(mockCleanerClients);

      expect(result).toHaveLength(2);
      expect(result[0].defaultPrice).toBe(200);
      expect(result[1].defaultPrice).toBe(250);
    });
  });

  describe("serializeInvitation", () => {
    it("should serialize invitation data with decrypted fields", () => {
      const mockCleanerClient = {
        dataValues: {
          id: 1,
          inviteToken: "token123",
          invitedName: "iv:invname",
          invitedEmail: "iv:invemail",
          invitedPhone: "iv:invphone",
          invitedAddress: JSON.stringify({ street: "123 Main" }),
          invitedBeds: 3,
          invitedBaths: "2.5",
          invitedNotes: "Special instructions",
          defaultFrequency: "weekly",
          defaultPrice: "225.00",
          status: "pending",
          invitedAt: new Date("2026-01-01"),
        },
      };

      const result = CleanerClientSerializer.serializeInvitation(mockCleanerClient);

      expect(result.id).toBe(1);
      expect(result.inviteToken).toBe("token123");
      expect(result.invitedName).toBe("decrypted_iv:invname");
      expect(result.invitedEmail).toBe("decrypted_iv:invemail");
      expect(result.invitedPhone).toBe("decrypted_iv:invphone");
      expect(result.invitedAddress).toEqual({ street: "123 Main" });
      expect(result.invitedBeds).toBe(3);
      expect(result.invitedBaths).toBe(2.5);
      expect(result.defaultFrequency).toBe("weekly");
      expect(result.defaultPrice).toBe(225);
      expect(result.status).toBe("pending");
    });

    it("should parse decimal fields in invitation", () => {
      const mockCleanerClient = {
        dataValues: {
          id: 1,
          invitedBaths: "3.5",
          defaultPrice: "275.00",
        },
      };

      const result = CleanerClientSerializer.serializeInvitation(mockCleanerClient);

      expect(result.invitedBaths).toBe(3.5);
      expect(typeof result.invitedBaths).toBe("number");
      expect(result.defaultPrice).toBe(275);
      expect(typeof result.defaultPrice).toBe("number");
    });
  });

  describe("parseAddress", () => {
    it("should return null for null input", () => {
      const result = CleanerClientSerializer.parseAddress(null);
      expect(result).toBeNull();
    });

    it("should return object as-is", () => {
      const addressObj = { street: "123 Main", city: "Boston" };
      const result = CleanerClientSerializer.parseAddress(addressObj);
      expect(result).toEqual(addressObj);
    });

    it("should parse valid JSON string", () => {
      const result = CleanerClientSerializer.parseAddress('{"street":"123 Main"}');
      expect(result).toEqual({ street: "123 Main" });
    });

    it("should return original string for invalid JSON", () => {
      const result = CleanerClientSerializer.parseAddress("not valid json");
      expect(result).toBe("not valid json");
    });
  });
});
