/**
 * Tests for ITManagementService
 * Tests all API methods for IT employee management (CRUD operations).
 */

import ITManagementService from "../../src/services/fetchRequests/ITManagementService";

// Mock fetch globally
global.fetch = jest.fn();

// Mock config
jest.mock("../../src/services/config", () => ({
  API_BASE: "http://localhost:3000/api/v1",
}));

describe("ITManagementService", () => {
  const mockToken = "test-token";

  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch.mockClear();
  });

  describe("getITStaff", () => {
    it("should fetch IT staff successfully", async () => {
      const mockStaff = [
        { id: 1, firstName: "Alex", lastName: "IT", username: "alexIT" },
        { id: 2, firstName: "Sam", lastName: "Tech", username: "samtech" },
      ];
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ itStaff: mockStaff }),
      });

      const result = await ITManagementService.getITStaff(mockToken);

      expect(global.fetch).toHaveBeenCalledWith(
        "http://localhost:3000/api/v1/users/it-staff",
        { headers: { Authorization: "Bearer test-token" } }
      );
      expect(result.success).toBe(true);
      expect(result.itStaff).toEqual(mockStaff);
    });

    it("should return empty array when no IT staff", async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({}),
      });

      const result = await ITManagementService.getITStaff(mockToken);

      expect(result.success).toBe(true);
      expect(result.itStaff).toEqual([]);
    });

    it("should return error when fetch fails", async () => {
      global.fetch.mockResolvedValueOnce({
        ok: false,
        json: async () => ({ error: "Unauthorized" }),
      });

      const result = await ITManagementService.getITStaff(mockToken);

      expect(result.success).toBe(false);
      expect(result.error).toBe("Unauthorized");
    });

    it("should return error on network failure", async () => {
      global.fetch.mockRejectedValueOnce(new Error("Network error"));

      const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => {});
      const result = await ITManagementService.getITStaff(mockToken);

      expect(result.success).toBe(false);
      expect(result.error).toBe("Network error. Please try again.");
      consoleSpy.mockRestore();
    });
  });

  describe("createITEmployee", () => {
    it("should create IT employee successfully", async () => {
      const mockUser = {
        id: 10,
        firstName: "John",
        lastName: "Doe",
        username: "johndoe",
        email: "john@example.com",
      };
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ user: mockUser }),
      });

      const employeeData = {
        firstName: "John",
        lastName: "Doe",
        username: "johndoe",
        email: "john@example.com",
        password: "SecurePass123!",
      };

      const result = await ITManagementService.createITEmployee(mockToken, employeeData);

      expect(global.fetch).toHaveBeenCalledWith(
        "http://localhost:3000/api/v1/users/new-it",
        {
          method: "POST",
          headers: {
            Authorization: "Bearer test-token",
            "Content-Type": "application/json",
          },
          body: JSON.stringify(employeeData),
        }
      );
      expect(result.success).toBe(true);
      expect(result.user).toEqual(mockUser);
    });

    it("should return error for duplicate username", async () => {
      global.fetch.mockResolvedValueOnce({
        ok: false,
        json: async () => ({ error: "Username already exists" }),
      });

      const result = await ITManagementService.createITEmployee(mockToken, {
        username: "existing",
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe("Username already exists");
    });

    it("should return error for duplicate email", async () => {
      global.fetch.mockResolvedValueOnce({
        ok: false,
        json: async () => ({ error: "Email already in use" }),
      });

      const result = await ITManagementService.createITEmployee(mockToken, {
        email: "existing@example.com",
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe("Email already in use");
    });

    it("should return error for weak password", async () => {
      global.fetch.mockResolvedValueOnce({
        ok: false,
        json: async () => ({ error: "Password must be at least 8 characters" }),
      });

      const result = await ITManagementService.createITEmployee(mockToken, {
        password: "weak",
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe("Password must be at least 8 characters");
    });

    it("should handle network error", async () => {
      global.fetch.mockRejectedValueOnce(new Error("Network error"));

      const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => {});
      const result = await ITManagementService.createITEmployee(mockToken, {});

      expect(result.success).toBe(false);
      expect(result.error).toBe("Network error. Please try again.");
      consoleSpy.mockRestore();
    });

    it("should include phone in request if provided", async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ user: { id: 1 } }),
      });

      const employeeData = {
        firstName: "John",
        lastName: "Doe",
        username: "johndoe",
        email: "john@example.com",
        phone: "1234567890",
        password: "SecurePass123!",
      };

      await ITManagementService.createITEmployee(mockToken, employeeData);

      expect(global.fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: expect.stringContaining("1234567890"),
        })
      );
    });
  });

  describe("updateITEmployee", () => {
    it("should update IT employee successfully", async () => {
      const mockUser = {
        id: 10,
        firstName: "Jane",
        lastName: "Doe",
        email: "jane@example.com",
      };
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ user: mockUser, message: "Updated successfully" }),
      });

      const updates = {
        firstName: "Jane",
        lastName: "Doe",
        email: "jane@example.com",
      };

      const result = await ITManagementService.updateITEmployee(mockToken, 10, updates);

      expect(global.fetch).toHaveBeenCalledWith(
        "http://localhost:3000/api/v1/users/it-staff/10",
        {
          method: "PATCH",
          headers: {
            Authorization: "Bearer test-token",
            "Content-Type": "application/json",
          },
          body: JSON.stringify(updates),
        }
      );
      expect(result.success).toBe(true);
      expect(result.user).toEqual(mockUser);
      expect(result.message).toBe("Updated successfully");
    });

    it("should return error for duplicate email", async () => {
      global.fetch.mockResolvedValueOnce({
        ok: false,
        json: async () => ({ error: "Email already in use" }),
      });

      const result = await ITManagementService.updateITEmployee(mockToken, 10, {
        email: "existing@example.com",
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe("Email already in use");
    });

    it("should return error when employee not found", async () => {
      global.fetch.mockResolvedValueOnce({
        ok: false,
        json: async () => ({ error: "IT employee not found" }),
      });

      const result = await ITManagementService.updateITEmployee(mockToken, 999, {});

      expect(result.success).toBe(false);
      expect(result.error).toBe("IT employee not found");
    });

    it("should handle network error", async () => {
      global.fetch.mockRejectedValueOnce(new Error("Network error"));

      const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => {});
      const result = await ITManagementService.updateITEmployee(mockToken, 10, {});

      expect(result.success).toBe(false);
      expect(result.error).toBe("Network error. Please try again.");
      consoleSpy.mockRestore();
    });
  });

  describe("removeITEmployee", () => {
    it("should remove IT employee successfully", async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ message: "IT employee removed successfully" }),
      });

      const result = await ITManagementService.removeITEmployee(mockToken, 10);

      expect(global.fetch).toHaveBeenCalledWith(
        "http://localhost:3000/api/v1/users/it-staff/10",
        {
          method: "DELETE",
          headers: { Authorization: "Bearer test-token" },
        }
      );
      expect(result.success).toBe(true);
      expect(result.message).toBe("IT employee removed successfully");
    });

    it("should return error when employee not found", async () => {
      global.fetch.mockResolvedValueOnce({
        ok: false,
        json: async () => ({ error: "IT employee not found" }),
      });

      const result = await ITManagementService.removeITEmployee(mockToken, 999);

      expect(result.success).toBe(false);
      expect(result.error).toBe("IT employee not found");
    });

    it("should return error when not authorized", async () => {
      global.fetch.mockResolvedValueOnce({
        ok: false,
        json: async () => ({ error: "Not authorized to remove IT employees" }),
      });

      const result = await ITManagementService.removeITEmployee(mockToken, 10);

      expect(result.success).toBe(false);
      expect(result.error).toBe("Not authorized to remove IT employees");
    });

    it("should handle network error", async () => {
      global.fetch.mockRejectedValueOnce(new Error("Network error"));

      const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => {});
      const result = await ITManagementService.removeITEmployee(mockToken, 10);

      expect(result.success).toBe(false);
      expect(result.error).toBe("Network error. Please try again.");
      consoleSpy.mockRestore();
    });
  });

  describe("generatePassword", () => {
    it("should generate a password of exactly 12 characters", () => {
      const password = ITManagementService.generatePassword();
      expect(password.length).toBe(12);
    });

    it("should include at least one lowercase letter", () => {
      const password = ITManagementService.generatePassword();
      expect(/[a-z]/.test(password)).toBe(true);
    });

    it("should include at least one uppercase letter", () => {
      const password = ITManagementService.generatePassword();
      expect(/[A-Z]/.test(password)).toBe(true);
    });

    it("should include at least one number", () => {
      const password = ITManagementService.generatePassword();
      expect(/[0-9]/.test(password)).toBe(true);
    });

    it("should include at least one special character", () => {
      const password = ITManagementService.generatePassword();
      expect(/[!@#$%^&*]/.test(password)).toBe(true);
    });

    it("should generate different passwords on subsequent calls", () => {
      const passwords = new Set();
      for (let i = 0; i < 10; i++) {
        passwords.add(ITManagementService.generatePassword());
      }
      // Should have multiple unique passwords (very unlikely to have duplicates)
      expect(passwords.size).toBeGreaterThan(1);
    });

    it("should only use allowed characters", () => {
      const password = ITManagementService.generatePassword();
      const allowedChars = /^[a-zA-Z0-9!@#$%^&*]+$/;
      expect(allowedChars.test(password)).toBe(true);
    });
  });
});

describe("ITManagementService Integration Scenarios", () => {
  const mockToken = "test-token";

  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch.mockClear();
  });

  describe("Full CRUD workflow", () => {
    it("should complete a full create-read-update-delete cycle", async () => {
      // Create
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          user: { id: 100, firstName: "Test", lastName: "User", username: "testuser" },
        }),
      });

      const createResult = await ITManagementService.createITEmployee(mockToken, {
        firstName: "Test",
        lastName: "User",
        username: "testuser",
        email: "test@example.com",
        password: "SecurePass123!",
      });
      expect(createResult.success).toBe(true);
      expect(createResult.user.id).toBe(100);

      // Read
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          itStaff: [{ id: 100, firstName: "Test", lastName: "User" }],
        }),
      });

      const readResult = await ITManagementService.getITStaff(mockToken);
      expect(readResult.success).toBe(true);
      expect(readResult.itStaff).toContainEqual(
        expect.objectContaining({ id: 100 })
      );

      // Update
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          user: { id: 100, firstName: "Updated", lastName: "User" },
          message: "Updated",
        }),
      });

      const updateResult = await ITManagementService.updateITEmployee(mockToken, 100, {
        firstName: "Updated",
      });
      expect(updateResult.success).toBe(true);
      expect(updateResult.user.firstName).toBe("Updated");

      // Delete
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ message: "Removed" }),
      });

      const deleteResult = await ITManagementService.removeITEmployee(mockToken, 100);
      expect(deleteResult.success).toBe(true);
    });
  });

  describe("Error recovery scenarios", () => {
    it("should handle temporary network failure and retry", async () => {
      // First call fails
      global.fetch.mockRejectedValueOnce(new Error("Network error"));

      const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => {});
      const firstResult = await ITManagementService.getITStaff(mockToken);
      expect(firstResult.success).toBe(false);

      // Retry succeeds
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ itStaff: [] }),
      });

      const retryResult = await ITManagementService.getITStaff(mockToken);
      expect(retryResult.success).toBe(true);

      consoleSpy.mockRestore();
    });
  });
});
