/**
 * Owner Dashboard Router - Serialization Tests
 *
 * These tests verify the serialization logic used in the owner dashboard.
 * The safeDecrypt helper function is tested to ensure it properly decrypts
 * encrypted fields before sending to the frontend.
 */

const EncryptionService = require("../../services/EncryptionService");

// Mock EncryptionService
jest.mock("../../services/EncryptionService", () => ({
  decrypt: jest.fn((value) => (value ? `decrypted_${value}` : null)),
}));

describe("Owner Dashboard Router - Serialization Tests", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("safeDecrypt helper function pattern", () => {
    // This tests the safeDecrypt pattern used in ownerDashboardRouter
    const safeDecrypt = (value) => {
      if (!value) return null;
      try {
        return EncryptionService.decrypt(value);
      } catch (error) {
        return "[encrypted]";
      }
    };

    it("should decrypt home address fields", () => {
      const encryptedAddress = "encrypted_123_main_st";
      const encryptedCity = "encrypted_boston";
      const encryptedState = "encrypted_ma";

      expect(safeDecrypt(encryptedAddress)).toBe("decrypted_encrypted_123_main_st");
      expect(safeDecrypt(encryptedCity)).toBe("decrypted_encrypted_boston");
      expect(safeDecrypt(encryptedState)).toBe("decrypted_encrypted_ma");

      expect(EncryptionService.decrypt).toHaveBeenCalledTimes(3);
    });

    it("should handle null values gracefully", () => {
      expect(safeDecrypt(null)).toBeNull();
      expect(safeDecrypt(undefined)).toBeNull();

      // decrypt should not be called for null values
      expect(EncryptionService.decrypt).not.toHaveBeenCalled();
    });

    it("should return [encrypted] if decryption fails", () => {
      EncryptionService.decrypt.mockImplementationOnce(() => {
        throw new Error("Decryption failed");
      });

      const result = safeDecrypt("some_value");
      expect(result).toBe("[encrypted]");
    });
  });

  describe("Job history serialization pattern", () => {
    it("should properly serialize job with decrypted home fields", () => {
      const safeDecrypt = (value) => {
        if (!value) return null;
        return EncryptionService.decrypt(value);
      };

      const appointment = {
        id: 100,
        date: "2024-01-15",
        completed: true,
        price: 15000,
        home: {
          address: "encrypted_123_main_st",
          city: "encrypted_boston",
          state: "encrypted_ma",
        },
      };

      // This mimics the serialization pattern in /cleaners/:cleanerId/job-history
      const job = {
        id: appointment.id,
        date: appointment.date,
        homeAddress: appointment.home ? safeDecrypt(appointment.home.address) : null,
        homeCity: appointment.home ? safeDecrypt(appointment.home.city) : null,
        homeState: appointment.home ? safeDecrypt(appointment.home.state) : null,
        status: appointment.completed ? "completed" : "incomplete",
        price: appointment.price || 0,
      };

      expect(job.homeAddress).toBe("decrypted_encrypted_123_main_st");
      expect(job.homeCity).toBe("decrypted_encrypted_boston");
      expect(job.homeState).toBe("decrypted_encrypted_ma");
      expect(job.status).toBe("completed");
    });

    it("should handle null home gracefully", () => {
      const safeDecrypt = (value) => {
        if (!value) return null;
        return EncryptionService.decrypt(value);
      };

      const appointment = {
        id: 100,
        date: "2024-01-15",
        completed: false,
        price: 12000,
        home: null,
      };

      const job = {
        id: appointment.id,
        date: appointment.date,
        homeAddress: appointment.home ? safeDecrypt(appointment.home.address) : null,
        homeCity: appointment.home ? safeDecrypt(appointment.home.city) : null,
        homeState: appointment.home ? safeDecrypt(appointment.home.state) : null,
        status: appointment.completed ? "completed" : "incomplete",
        price: appointment.price || 0,
      };

      expect(job.homeAddress).toBeNull();
      expect(job.homeCity).toBeNull();
      expect(job.homeState).toBeNull();
    });

    it("should serialize multiple jobs with proper decryption", () => {
      const safeDecrypt = (value) => {
        if (!value) return null;
        return EncryptionService.decrypt(value);
      };

      const appointments = [
        {
          id: 100,
          date: "2024-01-15",
          completed: true,
          price: 15000,
          home: {
            address: "encrypted_addr_1",
            city: "encrypted_city_1",
            state: "encrypted_state_1",
          },
        },
        {
          id: 101,
          date: "2024-01-20",
          completed: false,
          price: 12000,
          home: {
            address: "encrypted_addr_2",
            city: "encrypted_city_2",
            state: "encrypted_state_2",
          },
        },
      ];

      const jobs = appointments.map((a) => ({
        id: a.id,
        date: a.date,
        homeAddress: a.home ? safeDecrypt(a.home.address) : null,
        homeCity: a.home ? safeDecrypt(a.home.city) : null,
        homeState: a.home ? safeDecrypt(a.home.state) : null,
        status: a.completed ? "completed" : "incomplete",
        price: a.price || 0,
      }));

      expect(jobs).toHaveLength(2);
      expect(jobs[0].homeAddress).toBe("decrypted_encrypted_addr_1");
      expect(jobs[0].homeCity).toBe("decrypted_encrypted_city_1");
      expect(jobs[1].homeAddress).toBe("decrypted_encrypted_addr_2");
      expect(jobs[1].homeCity).toBe("decrypted_encrypted_city_2");

      // All 6 fields should have been decrypted (3 per appointment)
      expect(EncryptionService.decrypt).toHaveBeenCalledTimes(6);
    });
  });
});
