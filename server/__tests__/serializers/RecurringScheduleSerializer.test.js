const RecurringScheduleSerializer = require("../../serializers/RecurringScheduleSerializer");
const EncryptionService = require("../../services/EncryptionService");

// Mock EncryptionService
jest.mock("../../services/EncryptionService", () => ({
  decrypt: jest.fn((value) => `decrypted_${value}`),
}));

describe("RecurringScheduleSerializer", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("serializeOne", () => {
    it("should serialize basic schedule fields from dataValues", () => {
      const mockSchedule = {
        dataValues: {
          id: 1,
          cleanerClientId: 10,
          homeId: 5,
          cleanerId: 20,
          clientId: 30,
          frequency: "weekly",
          dayOfWeek: 1,
          timeWindow: "10-3",
          price: "250.00",
          startDate: "2026-01-01",
          endDate: null,
          nextScheduledDate: "2026-01-08",
          lastGeneratedDate: "2026-01-01",
          isActive: true,
          isPaused: false,
          pausedUntil: null,
          pauseReason: null,
          createdAt: new Date("2026-01-01"),
          updatedAt: new Date("2026-01-01"),
        },
      };

      const result = RecurringScheduleSerializer.serializeOne(mockSchedule);

      expect(result.id).toBe(1);
      expect(result.cleanerClientId).toBe(10);
      expect(result.homeId).toBe(5);
      expect(result.cleanerId).toBe(20);
      expect(result.clientId).toBe(30);
      expect(result.frequency).toBe("weekly");
      expect(result.dayOfWeek).toBe(1);
      expect(result.timeWindow).toBe("10-3");
      expect(result.startDate).toBe("2026-01-01");
      expect(result.nextScheduledDate).toBe("2026-01-08");
      expect(result.isActive).toBe(true);
      expect(result.isPaused).toBe(false);
    });

    it("should parse price decimal field as number", () => {
      const mockSchedule = {
        dataValues: {
          id: 1,
          price: "250.00",
        },
      };

      const result = RecurringScheduleSerializer.serializeOne(mockSchedule);

      expect(result.price).toBe(250);
      expect(typeof result.price).toBe("number");
    });

    it("should handle null price field", () => {
      const mockSchedule = {
        dataValues: {
          id: 1,
          price: null,
        },
      };

      const result = RecurringScheduleSerializer.serializeOne(mockSchedule);

      expect(result.price).toBeNull();
    });

    it("should add day name based on dayOfWeek", () => {
      const testCases = [
        { dayOfWeek: 0, expectedDayName: "Sunday" },
        { dayOfWeek: 1, expectedDayName: "Monday" },
        { dayOfWeek: 2, expectedDayName: "Tuesday" },
        { dayOfWeek: 3, expectedDayName: "Wednesday" },
        { dayOfWeek: 4, expectedDayName: "Thursday" },
        { dayOfWeek: 5, expectedDayName: "Friday" },
        { dayOfWeek: 6, expectedDayName: "Saturday" },
      ];

      testCases.forEach(({ dayOfWeek, expectedDayName }) => {
        const mockSchedule = {
          dataValues: {
            id: 1,
            dayOfWeek,
          },
        };

        const result = RecurringScheduleSerializer.serializeOne(mockSchedule);

        expect(result.dayName).toBe(expectedDayName);
      });
    });

    it("should handle invalid dayOfWeek", () => {
      const mockSchedule = {
        dataValues: {
          id: 1,
          dayOfWeek: 7, // Invalid
        },
      };

      const result = RecurringScheduleSerializer.serializeOne(mockSchedule);

      expect(result.dayName).toBeNull();
    });

    it("should serialize cleaner with decrypted fields when included", () => {
      const mockSchedule = {
        dataValues: {
          id: 1,
        },
        cleaner: {
          dataValues: {
            id: 20,
            firstName: "iv:cleanerfirst",
            lastName: "iv:cleanerlast",
            email: "iv:cleaneremail",
            phone: "iv:cleanerphone",
          },
        },
      };

      const result = RecurringScheduleSerializer.serializeOne(mockSchedule);

      expect(result.cleaner).toBeDefined();
      expect(result.cleaner.id).toBe(20);
      expect(result.cleaner.firstName).toBe("decrypted_iv:cleanerfirst");
      expect(result.cleaner.lastName).toBe("decrypted_iv:cleanerlast");
      expect(result.cleaner.email).toBe("decrypted_iv:cleaneremail");
      expect(result.cleaner.phone).toBe("decrypted_iv:cleanerphone");
    });

    it("should serialize client with decrypted fields when included", () => {
      const mockSchedule = {
        dataValues: {
          id: 1,
        },
        client: {
          dataValues: {
            id: 30,
            firstName: "iv:clientfirst",
            lastName: "iv:clientlast",
            email: "iv:clientemail",
            phone: "iv:clientphone",
          },
        },
      };

      const result = RecurringScheduleSerializer.serializeOne(mockSchedule);

      expect(result.client).toBeDefined();
      expect(result.client.id).toBe(30);
      expect(result.client.firstName).toBe("decrypted_iv:clientfirst");
      expect(result.client.lastName).toBe("decrypted_iv:clientlast");
    });

    it("should serialize home with decrypted fields when included", () => {
      const mockSchedule = {
        dataValues: {
          id: 1,
        },
        home: {
          dataValues: {
            id: 5,
            address: "iv:homeaddress",
            city: "iv:homecity",
            state: "iv:homestate",
            zipcode: "iv:homezipcode",
            numBeds: 3,
            numBaths: 2,
          },
        },
      };

      const result = RecurringScheduleSerializer.serializeOne(mockSchedule);

      expect(result.home).toBeDefined();
      expect(result.home.id).toBe(5);
      expect(result.home.address).toBe("decrypted_iv:homeaddress");
      expect(result.home.city).toBe("decrypted_iv:homecity");
      expect(result.home.numBeds).toBe(3);
      expect(result.home.numBaths).toBe(2);
    });

    it("should access values directly if dataValues not present", () => {
      const mockSchedule = {
        id: 1,
        frequency: "biweekly",
        dayOfWeek: 3,
        price: "300.00",
      };

      const result = RecurringScheduleSerializer.serializeOne(mockSchedule);

      expect(result.id).toBe(1);
      expect(result.frequency).toBe("biweekly");
      expect(result.dayOfWeek).toBe(3);
      expect(result.dayName).toBe("Wednesday");
      expect(result.price).toBe(300);
    });
  });

  describe("serializeArray", () => {
    it("should serialize an array of schedules", () => {
      const mockSchedules = [
        {
          dataValues: {
            id: 1,
            frequency: "weekly",
            dayOfWeek: 1,
            price: "200.00",
          },
        },
        {
          dataValues: {
            id: 2,
            frequency: "biweekly",
            dayOfWeek: 5,
            price: "250.00",
          },
        },
      ];

      const result = RecurringScheduleSerializer.serializeArray(mockSchedules);

      expect(result).toHaveLength(2);
      expect(result[0].id).toBe(1);
      expect(result[0].frequency).toBe("weekly");
      expect(result[0].dayName).toBe("Monday");
      expect(result[0].price).toBe(200);
      expect(result[1].id).toBe(2);
      expect(result[1].frequency).toBe("biweekly");
      expect(result[1].dayName).toBe("Friday");
      expect(result[1].price).toBe(250);
    });

    it("should handle empty array", () => {
      const result = RecurringScheduleSerializer.serializeArray([]);
      expect(result).toEqual([]);
    });
  });

  describe("serializeForList", () => {
    it("should return minimal list view data", () => {
      const mockSchedule = {
        dataValues: {
          id: 1,
          frequency: "weekly",
          dayOfWeek: 2,
          timeWindow: "anytime",
          price: "175.00",
          nextScheduledDate: "2026-01-14",
          isActive: true,
          isPaused: false,
          // Fields NOT included in list view
          cleanerClientId: 10,
          homeId: 5,
          startDate: "2026-01-01",
        },
      };

      const result = RecurringScheduleSerializer.serializeForList(mockSchedule);

      expect(result.id).toBe(1);
      expect(result.frequency).toBe("weekly");
      expect(result.dayOfWeek).toBe(2);
      expect(result.dayName).toBe("Tuesday");
      expect(result.timeWindow).toBe("anytime");
      expect(result.price).toBe(175);
      expect(result.nextScheduledDate).toBe("2026-01-14");
      expect(result.isActive).toBe(true);
      expect(result.isPaused).toBe(false);

      // Should NOT include
      expect(result.cleanerClientId).toBeUndefined();
      expect(result.homeId).toBeUndefined();
      expect(result.startDate).toBeUndefined();
    });

    it("should parse price as number in list view", () => {
      const mockSchedule = {
        dataValues: {
          id: 1,
          price: "225.50",
          dayOfWeek: 0,
        },
      };

      const result = RecurringScheduleSerializer.serializeForList(mockSchedule);

      expect(result.price).toBe(225.5);
      expect(typeof result.price).toBe("number");
    });

    it("should handle null price in list view", () => {
      const mockSchedule = {
        dataValues: {
          id: 1,
          price: null,
          dayOfWeek: 0,
        },
      };

      const result = RecurringScheduleSerializer.serializeForList(mockSchedule);

      expect(result.price).toBeNull();
    });
  });

  describe("serializeArrayForList", () => {
    it("should serialize array for list view", () => {
      const mockSchedules = [
        {
          dataValues: {
            id: 1,
            frequency: "weekly",
            dayOfWeek: 1,
            price: "200.00",
            isActive: true,
          },
        },
        {
          dataValues: {
            id: 2,
            frequency: "monthly",
            dayOfWeek: 4,
            price: "300.00",
            isActive: false,
          },
        },
      ];

      const result = RecurringScheduleSerializer.serializeArrayForList(mockSchedules);

      expect(result).toHaveLength(2);
      expect(result[0].id).toBe(1);
      expect(result[0].price).toBe(200);
      expect(result[1].id).toBe(2);
      expect(result[1].price).toBe(300);
    });

    it("should handle empty array", () => {
      const result = RecurringScheduleSerializer.serializeArrayForList([]);
      expect(result).toEqual([]);
    });
  });

  describe("serializeUser", () => {
    it("should return null for null input", () => {
      const result = RecurringScheduleSerializer.serializeUser(null);
      expect(result).toBeNull();
    });

    it("should decrypt user PII fields", () => {
      const mockUser = {
        dataValues: {
          id: 1,
          firstName: "iv:first",
          lastName: "iv:last",
          email: "iv:email",
          phone: "iv:phone",
        },
      };

      const result = RecurringScheduleSerializer.serializeUser(mockUser);

      expect(EncryptionService.decrypt).toHaveBeenCalledWith("iv:first");
      expect(EncryptionService.decrypt).toHaveBeenCalledWith("iv:last");
      expect(EncryptionService.decrypt).toHaveBeenCalledWith("iv:email");
      expect(EncryptionService.decrypt).toHaveBeenCalledWith("iv:phone");

      expect(result.firstName).toBe("decrypted_iv:first");
      expect(result.lastName).toBe("decrypted_iv:last");
      expect(result.email).toBe("decrypted_iv:email");
      expect(result.phone).toBe("decrypted_iv:phone");
    });
  });

  describe("serializeHome", () => {
    it("should return null for null input", () => {
      const result = RecurringScheduleSerializer.serializeHome(null);
      expect(result).toBeNull();
    });

    it("should decrypt home PII fields", () => {
      const mockHome = {
        dataValues: {
          id: 1,
          address: "iv:address",
          city: "iv:city",
          state: "iv:state",
          zipcode: "iv:zipcode",
          numBeds: 3,
          numBaths: 2,
        },
      };

      const result = RecurringScheduleSerializer.serializeHome(mockHome);

      expect(EncryptionService.decrypt).toHaveBeenCalledWith("iv:address");
      expect(EncryptionService.decrypt).toHaveBeenCalledWith("iv:city");
      expect(EncryptionService.decrypt).toHaveBeenCalledWith("iv:state");
      expect(EncryptionService.decrypt).toHaveBeenCalledWith("iv:zipcode");

      expect(result.address).toBe("decrypted_iv:address");
      expect(result.city).toBe("decrypted_iv:city");
      expect(result.numBeds).toBe(3);
      expect(result.numBaths).toBe(2);
    });
  });
});
