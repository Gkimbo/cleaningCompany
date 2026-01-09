const AppointmentSerializer = require("../../serializers/AppointmentSerializer");
const EncryptionService = require("../../services/EncryptionService");

// Mock EncryptionService
jest.mock("../../services/EncryptionService", () => ({
  decrypt: jest.fn((value) => `decrypted_${value}`),
}));

describe("AppointmentSerializer", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("serializeOne", () => {
    it("should serialize basic appointment fields from dataValues", () => {
      const mockAppointment = {
        dataValues: {
          id: 1,
          date: "2026-01-15",
          price: "250.00",
          userId: 10,
          homeId: 5,
          paid: true,
          bringTowels: "yes",
          bringSheets: "no",
          completed: false,
          hasBeenAssigned: true,
          employeesAssigned: ["1", "2"],
          empoyeesNeeded: 2,
          timeToBeCompleted: "10-3",
        },
      };

      const result = AppointmentSerializer.serializeOne(mockAppointment);

      expect(result.id).toBe(1);
      expect(result.date).toBe("2026-01-15");
      expect(result.price).toBe("250.00");
      expect(result.userId).toBe(10);
      expect(result.homeId).toBe(5);
      expect(result.paid).toBe(true);
      expect(result.bringTowels).toBe("yes");
      expect(result.bringSheets).toBe("no");
      expect(result.completed).toBe(false);
      expect(result.hasBeenAssigned).toBe(true);
      expect(result.employeesAssigned).toEqual(["1", "2"]);
      expect(result.empoyeesNeeded).toBe(2);
      expect(result.timeToBeCompleted).toBe("10-3");
    });

    it("should decrypt encrypted keyPadCode field", () => {
      const mockAppointment = {
        dataValues: {
          id: 1,
          keyPadCode: "iv123:encryptedcode",
        },
      };

      const result = AppointmentSerializer.serializeOne(mockAppointment);

      expect(EncryptionService.decrypt).toHaveBeenCalledWith("iv123:encryptedcode");
      expect(result.keyPadCode).toBe("decrypted_iv123:encryptedcode");
    });

    it("should decrypt encrypted keyLocation field", () => {
      const mockAppointment = {
        dataValues: {
          id: 1,
          keyLocation: "iv456:encryptedlocation",
        },
      };

      const result = AppointmentSerializer.serializeOne(mockAppointment);

      expect(EncryptionService.decrypt).toHaveBeenCalledWith("iv456:encryptedlocation");
      expect(result.keyLocation).toBe("decrypted_iv456:encryptedlocation");
    });

    it("should decrypt encrypted contact field", () => {
      const mockAppointment = {
        dataValues: {
          id: 1,
          contact: "iv789:encryptedcontact",
        },
      };

      const result = AppointmentSerializer.serializeOne(mockAppointment);

      expect(EncryptionService.decrypt).toHaveBeenCalledWith("iv789:encryptedcontact");
      expect(result.contact).toBe("decrypted_iv789:encryptedcontact");
    });

    it("should not call decrypt for null encrypted fields", () => {
      const mockAppointment = {
        dataValues: {
          id: 1,
          keyPadCode: null,
          keyLocation: null,
          contact: null,
        },
      };

      const result = AppointmentSerializer.serializeOne(mockAppointment);

      expect(EncryptionService.decrypt).not.toHaveBeenCalled();
      expect(result.keyPadCode).toBeNull();
      expect(result.keyLocation).toBeNull();
      expect(result.contact).toBeNull();
    });

    it("should parse decimal discountPercent field as float", () => {
      const mockAppointment = {
        dataValues: {
          id: 1,
          discountPercent: "0.15",
          discountApplied: true,
          originalPrice: "300.00",
        },
      };

      const result = AppointmentSerializer.serializeOne(mockAppointment);

      expect(result.discountPercent).toBe(0.15);
      expect(typeof result.discountPercent).toBe("number");
      expect(result.discountApplied).toBe(true);
      expect(result.originalPrice).toBe("300.00");
    });

    it("should handle null discountPercent field", () => {
      const mockAppointment = {
        dataValues: {
          id: 1,
          discountPercent: null,
        },
      };

      const result = AppointmentSerializer.serializeOne(mockAppointment);

      expect(result.discountPercent).toBeNull();
    });

    it("should handle undefined discountPercent field", () => {
      const mockAppointment = {
        dataValues: {
          id: 1,
        },
      };

      const result = AppointmentSerializer.serializeOne(mockAppointment);

      expect(result.discountPercent).toBeUndefined();
    });

    it("should include last-minute booking fields", () => {
      const mockAppointment = {
        dataValues: {
          id: 1,
          isLastMinuteBooking: true,
          lastMinuteFeeApplied: 50,
          lastMinuteNotificationsSentAt: new Date("2026-01-10T10:00:00Z"),
        },
      };

      const result = AppointmentSerializer.serializeOne(mockAppointment);

      expect(result.isLastMinuteBooking).toBe(true);
      expect(result.lastMinuteFeeApplied).toBe(50);
      expect(result.lastMinuteNotificationsSentAt).toEqual(new Date("2026-01-10T10:00:00Z"));
    });

    it("should include review status fields", () => {
      const mockAppointment = {
        dataValues: {
          id: 1,
          hasClientReview: true,
          hasCleanerReview: false,
        },
      };

      const result = AppointmentSerializer.serializeOne(mockAppointment);

      expect(result.hasClientReview).toBe(true);
      expect(result.hasCleanerReview).toBe(false);
    });

    it("should include sheet and towel configurations", () => {
      const sheetConfigs = [
        { bedNumber: 1, bedType: "queen", needsSheets: true },
        { bedNumber: 2, bedType: "twin", needsSheets: false },
      ];
      const towelConfigs = [
        { bathroom: 1, towels: 2, faceCloths: 1 },
        { bathroom: 2, towels: 1, faceCloths: 0 },
      ];

      const mockAppointment = {
        dataValues: {
          id: 1,
          sheetConfigurations: sheetConfigs,
          towelConfigurations: towelConfigs,
        },
      };

      const result = AppointmentSerializer.serializeOne(mockAppointment);

      expect(result.sheetConfigurations).toEqual(sheetConfigs);
      expect(result.towelConfigurations).toEqual(towelConfigs);
    });

    it("should access values directly if dataValues not present", () => {
      const mockAppointment = {
        id: 1,
        date: "2026-01-15",
        price: "200.00",
      };

      const result = AppointmentSerializer.serializeOne(mockAppointment);

      expect(result.id).toBe(1);
      expect(result.date).toBe("2026-01-15");
      expect(result.price).toBe("200.00");
    });
  });

  describe("serializeArray", () => {
    it("should serialize an array of appointments", () => {
      const mockAppointments = [
        {
          dataValues: {
            id: 1,
            date: "2026-01-15",
            price: "250.00",
          },
        },
        {
          dataValues: {
            id: 2,
            date: "2026-01-16",
            price: "300.00",
          },
        },
      ];

      const result = AppointmentSerializer.serializeArray(mockAppointments);

      expect(result).toHaveLength(2);
      expect(result[0].id).toBe(1);
      expect(result[0].date).toBe("2026-01-15");
      expect(result[1].id).toBe(2);
      expect(result[1].date).toBe("2026-01-16");
    });

    it("should decrypt encrypted fields in array", () => {
      const mockAppointments = [
        {
          dataValues: {
            id: 1,
            keyPadCode: "iv1:enc1",
          },
        },
        {
          dataValues: {
            id: 2,
            keyPadCode: "iv2:enc2",
          },
        },
      ];

      const result = AppointmentSerializer.serializeArray(mockAppointments);

      expect(EncryptionService.decrypt).toHaveBeenCalledWith("iv1:enc1");
      expect(EncryptionService.decrypt).toHaveBeenCalledWith("iv2:enc2");
      expect(result[0].keyPadCode).toBe("decrypted_iv1:enc1");
      expect(result[1].keyPadCode).toBe("decrypted_iv2:enc2");
    });

    it("should parse decimal fields in array", () => {
      const mockAppointments = [
        {
          dataValues: {
            id: 1,
            discountPercent: "0.10",
          },
        },
        {
          dataValues: {
            id: 2,
            discountPercent: "0.25",
          },
        },
      ];

      const result = AppointmentSerializer.serializeArray(mockAppointments);

      expect(result[0].discountPercent).toBe(0.1);
      expect(result[1].discountPercent).toBe(0.25);
      expect(typeof result[0].discountPercent).toBe("number");
      expect(typeof result[1].discountPercent).toBe("number");
    });

    it("should handle empty array", () => {
      const result = AppointmentSerializer.serializeArray([]);
      expect(result).toEqual([]);
    });

    it("should include last-minute booking fields in array serialization", () => {
      const mockAppointments = [
        {
          dataValues: {
            id: 1,
            isLastMinuteBooking: true,
            lastMinuteFeeApplied: 50,
          },
        },
        {
          dataValues: {
            id: 2,
            isLastMinuteBooking: false,
            lastMinuteFeeApplied: 0,
          },
        },
      ];

      const result = AppointmentSerializer.serializeArray(mockAppointments);

      expect(result[0].isLastMinuteBooking).toBe(true);
      expect(result[0].lastMinuteFeeApplied).toBe(50);
      expect(result[1].isLastMinuteBooking).toBe(false);
      expect(result[1].lastMinuteFeeApplied).toBe(0);
    });
  });

  describe("encryptedFields", () => {
    it("should list all PII fields that need decryption", () => {
      const expectedEncryptedFields = ["keyPadCode", "keyLocation", "contact"];

      expectedEncryptedFields.forEach((field) => {
        expect(AppointmentSerializer.encryptedFields).toContain(field);
      });
    });
  });

  describe("decimalFields", () => {
    it("should list all DECIMAL fields that need parseFloat", () => {
      expect(AppointmentSerializer.decimalFields).toContain("discountPercent");
    });
  });
});
