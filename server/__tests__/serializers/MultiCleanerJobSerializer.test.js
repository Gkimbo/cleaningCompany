const MultiCleanerJobSerializer = require("../../serializers/MultiCleanerJobSerializer");
const EncryptionService = require("../../services/EncryptionService");

// Mock EncryptionService
jest.mock("../../services/EncryptionService", () => ({
  decrypt: jest.fn((value) => (value ? `decrypted_${value}` : null)),
}));

describe("MultiCleanerJobSerializer", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset Date mock if any
    jest.useRealTimers();
  });

  // ============================================
  // isWithin48Hours Tests
  // ============================================
  describe("isWithin48Hours", () => {
    it("should return false for null date", () => {
      expect(MultiCleanerJobSerializer.isWithin48Hours(null)).toBe(false);
    });

    it("should return false for undefined date", () => {
      expect(MultiCleanerJobSerializer.isWithin48Hours(undefined)).toBe(false);
    });

    it("should return true for appointment today (before 10am)", () => {
      jest.useFakeTimers();
      // Set time to 8am today
      const now = new Date("2024-02-08T08:00:00");
      jest.setSystemTime(now);

      // Appointment today at 10am = 2 hours away
      const dateString = "2024-02-08";
      expect(MultiCleanerJobSerializer.isWithin48Hours(dateString)).toBe(true);
    });

    it("should return true for appointment tomorrow", () => {
      jest.useFakeTimers();
      const now = new Date("2024-02-08T10:00:00");
      jest.setSystemTime(now);

      // Appointment tomorrow at 10am = 24 hours away
      const dateString = "2024-02-09";
      expect(MultiCleanerJobSerializer.isWithin48Hours(dateString)).toBe(true);
    });

    it("should return true for appointment in exactly 47 hours", () => {
      jest.useFakeTimers();
      const now = new Date("2024-02-08T10:00:00");
      jest.setSystemTime(now);

      // Appointment at 10am on Feb 10 = 48 hours away, so 47 hours would be Feb 10 at 9am
      // But we're checking if within 48 hours, so Feb 10 at 10am should be exactly 48 hours
      const dateString = "2024-02-10"; // 10am on Feb 10 = exactly 48 hours
      expect(MultiCleanerJobSerializer.isWithin48Hours(dateString)).toBe(true);
    });

    it("should return false for appointment more than 48 hours away", () => {
      jest.useFakeTimers();
      const now = new Date("2024-02-08T09:00:00");
      jest.setSystemTime(now);

      // Appointment on Feb 11 at 10am = 49 hours away
      const dateString = "2024-02-11";
      expect(MultiCleanerJobSerializer.isWithin48Hours(dateString)).toBe(false);
    });

    it("should return false for appointment 3 days away", () => {
      jest.useFakeTimers();
      const now = new Date("2024-02-08T10:00:00");
      jest.setSystemTime(now);

      const dateString = "2024-02-12";
      expect(MultiCleanerJobSerializer.isWithin48Hours(dateString)).toBe(false);
    });

    it("should return false for past appointments", () => {
      jest.useFakeTimers();
      const now = new Date("2024-02-08T10:00:00");
      jest.setSystemTime(now);

      const dateString = "2024-02-06";
      expect(MultiCleanerJobSerializer.isWithin48Hours(dateString)).toBe(false);
    });
  });

  // ============================================
  // serializeHome Tests
  // ============================================
  describe("serializeHome", () => {
    const mockHome = {
      dataValues: {
        id: 1,
        nickName: "Beach House",
        address: "encrypted_address",
        city: "encrypted_city",
        state: "encrypted_state",
        zipcode: "encrypted_zip",
        numBeds: 3,
        numBaths: 2,
        numHalfBaths: 1,
        sqft: 2000,
        hasGate: true,
        gateCode: "encrypted_gate",
        hasDog: true,
        dogName: "Buddy",
        hasCat: false,
        catName: null,
        accessNotes: "encrypted_notes",
        contact: "encrypted_contact",
        timeToBeCompleted: "10-3",
        cleanersNeeded: 2,
      },
    };

    it("should return null for null input", () => {
      expect(MultiCleanerJobSerializer.serializeHome(null)).toBeNull();
    });

    it("should include full address when includeFullAddress is true", () => {
      const result = MultiCleanerJobSerializer.serializeHome(mockHome, true);

      expect(result.address).toBe("decrypted_encrypted_address");
      expect(result.zipcode).toBe("decrypted_encrypted_zip");
      expect(result.gateCode).toBe("decrypted_encrypted_gate");
      expect(result.accessNotes).toBe("decrypted_encrypted_notes");
      expect(result.contact).toBe("decrypted_encrypted_contact");
      expect(result.hasGate).toBe(true);
    });

    it("should exclude sensitive fields when includeFullAddress is false", () => {
      const result = MultiCleanerJobSerializer.serializeHome(mockHome, false);

      expect(result.address).toBeUndefined();
      expect(result.zipcode).toBeUndefined();
      expect(result.gateCode).toBeUndefined();
      expect(result.accessNotes).toBeUndefined();
      expect(result.contact).toBeUndefined();
      expect(result.hasGate).toBeUndefined();
    });

    it("should always include city and state", () => {
      const result = MultiCleanerJobSerializer.serializeHome(mockHome, false);

      expect(result.city).toBe("decrypted_encrypted_city");
      expect(result.state).toBe("decrypted_encrypted_state");
    });

    it("should always include non-sensitive fields", () => {
      const result = MultiCleanerJobSerializer.serializeHome(mockHome, false);

      expect(result.id).toBe(1);
      expect(result.nickName).toBe("Beach House");
      expect(result.numBeds).toBe(3);
      expect(result.numBaths).toBe(2);
      expect(result.numHalfBaths).toBe(1);
      expect(result.sqft).toBe(2000);
      expect(result.hasDog).toBe(true);
      expect(result.dogName).toBe("Buddy");
      expect(result.hasCat).toBe(false);
      expect(result.timeToBeCompleted).toBe("10-3");
      expect(result.cleanersNeeded).toBe(2);
    });

    it("should default to includeFullAddress=true when not specified", () => {
      const result = MultiCleanerJobSerializer.serializeHome(mockHome);

      expect(result.address).toBe("decrypted_encrypted_address");
      expect(result.zipcode).toBe("decrypted_encrypted_zip");
    });
  });

  // ============================================
  // serializeAppointment Tests
  // ============================================
  describe("serializeAppointment", () => {
    const mockAppointment = {
      dataValues: {
        id: 100,
        date: "2024-02-10",
        price: 150,
        bringTowels: "yes",
        bringSheets: "no",
        timeToBeCompleted: "10-3",
        completed: false,
        isMultiCleanerJob: true,
      },
      home: {
        dataValues: {
          id: 1,
          address: "encrypted_address",
          city: "encrypted_city",
          state: "encrypted_state",
          numBeds: 3,
          numBaths: 2,
        },
      },
    };

    it("should return null for null input", () => {
      expect(MultiCleanerJobSerializer.serializeAppointment(null)).toBeNull();
    });

    it("should serialize appointment with full address when includeFullAddress is true", () => {
      const result = MultiCleanerJobSerializer.serializeAppointment(mockAppointment, true);

      expect(result.id).toBe(100);
      expect(result.date).toBe("2024-02-10");
      expect(result.price).toBe(150);
      expect(result.home.address).toBe("decrypted_encrypted_address");
    });

    it("should serialize appointment without address when includeFullAddress is false", () => {
      const result = MultiCleanerJobSerializer.serializeAppointment(mockAppointment, false);

      expect(result.id).toBe(100);
      expect(result.home.city).toBe("decrypted_encrypted_city");
      expect(result.home.address).toBeUndefined();
    });

    it("should include all basic appointment fields", () => {
      const result = MultiCleanerJobSerializer.serializeAppointment(mockAppointment, false);

      expect(result.date).toBe("2024-02-10");
      expect(result.price).toBe(150);
      expect(result.bringTowels).toBe("yes");
      expect(result.bringSheets).toBe("no");
      expect(result.timeToBeCompleted).toBe("10-3");
      expect(result.completed).toBe(false);
      expect(result.isMultiCleanerJob).toBe(true);
    });
  });

  // ============================================
  // serializeOne Tests
  // ============================================
  describe("serializeOne", () => {
    const createMockJob = (appointmentDate) => ({
      dataValues: {
        id: 1,
        appointmentId: 100,
        totalCleanersRequired: 2,
        cleanersConfirmed: 1,
        status: "open",
        primaryCleanerId: 10,
        isAutoGenerated: false,
        totalEstimatedMinutes: 180,
        createdAt: "2024-02-01",
        updatedAt: "2024-02-01",
      },
      appointment: {
        dataValues: {
          id: 100,
          date: appointmentDate,
          price: 200,
        },
        date: appointmentDate,
        home: {
          dataValues: {
            id: 1,
            address: "encrypted_address",
            city: "encrypted_city",
            state: "encrypted_state",
            numBeds: 4,
            numBaths: 3,
          },
        },
      },
    });

    it("should auto-determine address visibility based on appointment date within 48 hours", () => {
      jest.useFakeTimers();
      const now = new Date("2024-02-08T10:00:00");
      jest.setSystemTime(now);

      // Appointment tomorrow at 10am = 24 hours away
      const mockJob = createMockJob("2024-02-09");
      const result = MultiCleanerJobSerializer.serializeOne(mockJob);

      expect(result.appointment.home.address).toBe("decrypted_encrypted_address");
    });

    it("should auto-determine address visibility based on appointment date beyond 48 hours", () => {
      jest.useFakeTimers();
      const now = new Date("2024-02-08T10:00:00");
      jest.setSystemTime(now);

      // Appointment in 3 days = 72 hours away
      const mockJob = createMockJob("2024-02-11");
      const result = MultiCleanerJobSerializer.serializeOne(mockJob);

      expect(result.appointment.home.address).toBeUndefined();
      expect(result.appointment.home.city).toBe("decrypted_encrypted_city");
    });

    it("should respect explicit includeFullAddress=true", () => {
      jest.useFakeTimers();
      const now = new Date("2024-02-08T10:00:00");
      jest.setSystemTime(now);

      const mockJob = createMockJob("2024-02-15"); // Far in future
      const result = MultiCleanerJobSerializer.serializeOne(mockJob, true);

      expect(result.appointment.home.address).toBe("decrypted_encrypted_address");
    });

    it("should respect explicit includeFullAddress=false", () => {
      jest.useFakeTimers();
      const now = new Date("2024-02-08T10:00:00");
      jest.setSystemTime(now);

      const mockJob = createMockJob("2024-02-08"); // Today
      const result = MultiCleanerJobSerializer.serializeOne(mockJob, false);

      expect(result.appointment.home.address).toBeUndefined();
    });

    it("should include all job fields", () => {
      const mockJob = createMockJob("2024-02-10");
      const result = MultiCleanerJobSerializer.serializeOne(mockJob, false);

      expect(result.id).toBe(1);
      expect(result.appointmentId).toBe(100);
      expect(result.totalCleanersRequired).toBe(2);
      expect(result.cleanersConfirmed).toBe(1);
      expect(result.status).toBe("open");
      expect(result.isFilled).toBe(false);
      expect(result.remainingSlots).toBe(1);
    });
  });

  // ============================================
  // serializeOffer Tests
  // ============================================
  describe("serializeOffer", () => {
    const mockOffer = {
      dataValues: {
        id: 1,
        multiCleanerJobId: 10,
        cleanerId: 5,
        appointmentId: 100,
        offerType: "marketplace",
        status: "pending",
        earningsOffered: 75,
        roomsOffered: ["bedroom1", "bathroom1"],
        expiresAt: "2024-02-10T12:00:00",
      },
      multiCleanerJob: {
        dataValues: {
          id: 10,
          appointmentId: 100,
          totalCleanersRequired: 2,
          cleanersConfirmed: 1,
          status: "open",
        },
        appointment: {
          dataValues: {
            id: 100,
            date: "2024-02-15",
            price: 200,
          },
          date: "2024-02-15",
          home: {
            dataValues: {
              id: 1,
              address: "encrypted_address",
              city: "encrypted_city",
              state: "encrypted_state",
              numBeds: 4,
              numBaths: 3,
            },
          },
        },
      },
    };

    it("should never include full address for offers (unconfirmed cleaners)", () => {
      const result = MultiCleanerJobSerializer.serializeOffer(mockOffer);

      expect(result.multiCleanerJob.appointment.home.address).toBeUndefined();
      expect(result.multiCleanerJob.appointment.home.city).toBe("decrypted_encrypted_city");
      expect(result.multiCleanerJob.appointment.home.state).toBe("decrypted_encrypted_state");
    });

    it("should include all offer fields", () => {
      const result = MultiCleanerJobSerializer.serializeOffer(mockOffer);

      expect(result.id).toBe(1);
      expect(result.multiCleanerJobId).toBe(10);
      expect(result.cleanerId).toBe(5);
      expect(result.offerType).toBe("marketplace");
      expect(result.status).toBe("pending");
      expect(result.earningsOffered).toBe(75);
      expect(result.roomsOffered).toEqual(["bedroom1", "bathroom1"]);
      expect(result.expiresAt).toBe("2024-02-10T12:00:00");
    });
  });

  // ============================================
  // serializeOffersResponse Tests
  // ============================================
  describe("serializeOffersResponse", () => {
    it("should never include full address for available jobs", () => {
      jest.useFakeTimers();
      const now = new Date("2024-02-08T10:00:00");
      jest.setSystemTime(now);

      const availableJobs = [
        {
          dataValues: {
            id: 1,
            appointmentId: 100,
            totalCleanersRequired: 2,
            cleanersConfirmed: 0,
            status: "open",
          },
          appointment: {
            dataValues: { id: 100, date: "2024-02-09", price: 150 },
            date: "2024-02-09", // Tomorrow - within 48 hours
            home: {
              dataValues: {
                id: 1,
                address: "encrypted_address",
                city: "encrypted_city",
                state: "encrypted_state",
              },
            },
          },
        },
      ];

      const result = MultiCleanerJobSerializer.serializeOffersResponse([], availableJobs);

      // Even though within 48 hours, available jobs should never show full address
      expect(result.availableJobs[0].appointment.home.address).toBeUndefined();
      expect(result.availableJobs[0].appointment.home.city).toBe("decrypted_encrypted_city");
    });

    it("should never include full address for personal offers", () => {
      const personalOffers = [
        {
          dataValues: {
            id: 1,
            multiCleanerJobId: 10,
            cleanerId: 5,
            status: "pending",
          },
          multiCleanerJob: {
            dataValues: {
              id: 10,
              appointmentId: 100,
              totalCleanersRequired: 2,
              cleanersConfirmed: 1,
              status: "open",
            },
            appointment: {
              dataValues: { id: 100, date: "2024-02-09", price: 150 },
              date: "2024-02-09",
              home: {
                dataValues: {
                  id: 1,
                  address: "encrypted_address",
                  city: "encrypted_city",
                  state: "encrypted_state",
                },
              },
            },
          },
        },
      ];

      const result = MultiCleanerJobSerializer.serializeOffersResponse(personalOffers, []);

      expect(result.personalOffers[0].multiCleanerJob.appointment.home.address).toBeUndefined();
    });

    it("should return both personalOffers and availableJobs arrays", () => {
      const result = MultiCleanerJobSerializer.serializeOffersResponse([], []);

      expect(result).toHaveProperty("personalOffers");
      expect(result).toHaveProperty("availableJobs");
      expect(Array.isArray(result.personalOffers)).toBe(true);
      expect(Array.isArray(result.availableJobs)).toBe(true);
    });
  });

  // ============================================
  // serializeArray Tests
  // ============================================
  describe("serializeArray", () => {
    it("should pass includeFullAddress to each job", () => {
      const jobs = [
        {
          dataValues: {
            id: 1,
            appointmentId: 100,
            totalCleanersRequired: 2,
            cleanersConfirmed: 1,
            status: "open",
          },
          appointment: {
            dataValues: { id: 100, date: "2024-02-15", price: 150 },
            date: "2024-02-15",
            home: {
              dataValues: {
                id: 1,
                address: "encrypted_address",
                city: "encrypted_city",
                state: "encrypted_state",
              },
            },
          },
        },
      ];

      // Explicit false should hide address
      const resultFalse = MultiCleanerJobSerializer.serializeArray(jobs, false);
      expect(resultFalse[0].appointment.home.address).toBeUndefined();

      // Explicit true should show address
      const resultTrue = MultiCleanerJobSerializer.serializeArray(jobs, true);
      expect(resultTrue[0].appointment.home.address).toBe("decrypted_encrypted_address");
    });
  });
});
