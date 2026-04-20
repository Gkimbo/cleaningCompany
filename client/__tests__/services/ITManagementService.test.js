/**
 * Tests for ITManagementService
 * Tests all API methods for IT employee management (CRUD operations).
 */

import ITManagementService from "../../src/services/fetchRequests/ITManagementService";

// Mock HttpClient
jest.mock("../../src/services/HttpClient", () => ({
  __esModule: true,
  default: {
    get: jest.fn(),
    post: jest.fn(),
    put: jest.fn(),
    patch: jest.fn(),
    delete: jest.fn(),
  },
}));
import HttpClient from "../../src/services/HttpClient";

describe("ITManagementService", () => {
  const mockToken = "test-token";

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("getITStaff", () => {
    it("should fetch IT staff successfully", async () => {
      const mockStaff = [
        { id: 1, firstName: "Alex", lastName: "IT", username: "alexIT" },
        { id: 2, firstName: "Sam", lastName: "Tech", username: "samtech" },
      ];
      HttpClient.get.mockResolvedValueOnce({ itStaff: mockStaff });

      const result = await ITManagementService.getITStaff(mockToken);

      expect(HttpClient.get).toHaveBeenCalledWith(
        "/users/it-staff",
        { token: "test-token" }
      );
      expect(result.success).toBe(true);
      expect(result.itStaff).toEqual(mockStaff);
    });

    it("should return empty array when no IT staff", async () => {
      HttpClient.get.mockResolvedValueOnce({});

      const result = await ITManagementService.getITStaff(mockToken);

      expect(result.success).toBe(true);
      expect(result.itStaff).toEqual([]);
    });

    it("should return error when fetch fails", async () => {
      HttpClient.get.mockResolvedValueOnce({ success: false, error: "Unauthorized" });

      const result = await ITManagementService.getITStaff(mockToken);

      expect(result.success).toBe(false);
      expect(result.error).toBe("Unauthorized");
    });

    it("should return error on network failure", async () => {
      HttpClient.get.mockResolvedValueOnce({ success: false, error: "Network request failed" });

      const consoleSpy = jest.spyOn(console, "warn").mockImplementation(() => {});
      const result = await ITManagementService.getITStaff(mockToken);

      expect(result.success).toBe(false);
      expect(result.error).toBe("Network request failed");
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
      HttpClient.post.mockResolvedValueOnce({ user: mockUser });

      const employeeData = {
        firstName: "John",
        lastName: "Doe",
        username: "johndoe",
        email: "john@example.com",
        password: "SecurePass123!",
      };

      const result = await ITManagementService.createITEmployee(mockToken, employeeData);

      expect(HttpClient.post).toHaveBeenCalledWith(
        "/users/new-it",
        employeeData,
        { token: "test-token" }
      );
      expect(result.success).toBe(true);
      expect(result.user).toEqual(mockUser);
    });

    it("should return error for duplicate username", async () => {
      HttpClient.post.mockResolvedValueOnce({ success: false, error: "Username already exists" });

      const result = await ITManagementService.createITEmployee(mockToken, {
        username: "existing",
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe("Username already exists");
    });

    it("should return error for duplicate email", async () => {
      HttpClient.post.mockResolvedValueOnce({ success: false, error: "Email already in use" });

      const result = await ITManagementService.createITEmployee(mockToken, {
        email: "existing@example.com",
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe("Email already in use");
    });

    it("should return error for weak password", async () => {
      HttpClient.post.mockResolvedValueOnce({ success: false, error: "Password must be at least 8 characters" });

      const result = await ITManagementService.createITEmployee(mockToken, {
        password: "weak",
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe("Password must be at least 8 characters");
    });

    it("should handle network error", async () => {
      HttpClient.post.mockResolvedValueOnce({ success: false, error: "Network request failed" });

      const consoleSpy = jest.spyOn(console, "warn").mockImplementation(() => {});
      const result = await ITManagementService.createITEmployee(mockToken, {});

      expect(result.success).toBe(false);
      expect(result.error).toBe("Network request failed");
      consoleSpy.mockRestore();
    });

    it("should include phone in request if provided", async () => {
      HttpClient.post.mockResolvedValueOnce({ user: { id: 1 } });

      const employeeData = {
        firstName: "John",
        lastName: "Doe",
        username: "johndoe",
        email: "john@example.com",
        phone: "1234567890",
        password: "SecurePass123!",
      };

      await ITManagementService.createITEmployee(mockToken, employeeData);

      expect(HttpClient.post).toHaveBeenCalledWith(
        "/users/new-it",
        expect.objectContaining({ phone: "1234567890" }),
        { token: "test-token" }
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
      HttpClient.patch.mockResolvedValueOnce({ user: mockUser, message: "Updated successfully" });

      const updates = {
        firstName: "Jane",
        lastName: "Doe",
        email: "jane@example.com",
      };

      const result = await ITManagementService.updateITEmployee(mockToken, 10, updates);

      expect(HttpClient.patch).toHaveBeenCalledWith(
        "/users/it-staff/10",
        updates,
        { token: "test-token" }
      );
      expect(result.success).toBe(true);
      expect(result.user).toEqual(mockUser);
      expect(result.message).toBe("Updated successfully");
    });

    it("should return error for duplicate email", async () => {
      HttpClient.patch.mockResolvedValueOnce({ success: false, error: "Email already in use" });

      const result = await ITManagementService.updateITEmployee(mockToken, 10, {
        email: "existing@example.com",
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe("Email already in use");
    });

    it("should return error when employee not found", async () => {
      HttpClient.patch.mockResolvedValueOnce({ success: false, error: "IT employee not found" });

      const result = await ITManagementService.updateITEmployee(mockToken, 999, {});

      expect(result.success).toBe(false);
      expect(result.error).toBe("IT employee not found");
    });

    it("should handle network error", async () => {
      HttpClient.patch.mockResolvedValueOnce({ success: false, error: "Network request failed" });

      const consoleSpy = jest.spyOn(console, "warn").mockImplementation(() => {});
      const result = await ITManagementService.updateITEmployee(mockToken, 10, {});

      expect(result.success).toBe(false);
      expect(result.error).toBe("Network request failed");
      consoleSpy.mockRestore();
    });
  });

  describe("removeITEmployee", () => {
    it("should remove IT employee successfully", async () => {
      HttpClient.delete.mockResolvedValueOnce({ message: "IT employee removed successfully" });

      const result = await ITManagementService.removeITEmployee(mockToken, 10);

      expect(HttpClient.delete).toHaveBeenCalledWith(
        "/users/it-staff/10",
        { token: "test-token" }
      );
      expect(result.success).toBe(true);
      expect(result.message).toBe("IT employee removed successfully");
    });

    it("should return error when employee not found", async () => {
      HttpClient.delete.mockResolvedValueOnce({ success: false, error: "IT employee not found" });

      const result = await ITManagementService.removeITEmployee(mockToken, 999);

      expect(result.success).toBe(false);
      expect(result.error).toBe("IT employee not found");
    });

    it("should return error when not authorized", async () => {
      HttpClient.delete.mockResolvedValueOnce({ success: false, error: "Not authorized to remove IT employees" });

      const result = await ITManagementService.removeITEmployee(mockToken, 10);

      expect(result.success).toBe(false);
      expect(result.error).toBe("Not authorized to remove IT employees");
    });

    it("should handle network error", async () => {
      HttpClient.delete.mockResolvedValueOnce({ success: false, error: "Network request failed" });

      const consoleSpy = jest.spyOn(console, "warn").mockImplementation(() => {});
      const result = await ITManagementService.removeITEmployee(mockToken, 10);

      expect(result.success).toBe(false);
      expect(result.error).toBe("Network request failed");
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
  });

  describe("Full CRUD workflow", () => {
    it("should complete a full create-read-update-delete cycle", async () => {
      // Create
      HttpClient.post.mockResolvedValueOnce({
        user: { id: 100, firstName: "Test", lastName: "User", username: "testuser" },
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
      HttpClient.get.mockResolvedValueOnce({
        itStaff: [{ id: 100, firstName: "Test", lastName: "User" }],
      });

      const readResult = await ITManagementService.getITStaff(mockToken);
      expect(readResult.success).toBe(true);
      expect(readResult.itStaff).toContainEqual(
        expect.objectContaining({ id: 100 })
      );

      // Update
      HttpClient.patch.mockResolvedValueOnce({
        user: { id: 100, firstName: "Updated", lastName: "User" },
        message: "Updated",
      });

      const updateResult = await ITManagementService.updateITEmployee(mockToken, 100, {
        firstName: "Updated",
      });
      expect(updateResult.success).toBe(true);
      expect(updateResult.user.firstName).toBe("Updated");

      // Delete
      HttpClient.delete.mockResolvedValueOnce({ message: "Removed" });

      const deleteResult = await ITManagementService.removeITEmployee(mockToken, 100);
      expect(deleteResult.success).toBe(true);
    });
  });

  describe("Error recovery scenarios", () => {
    it("should handle temporary network failure and retry", async () => {
      // First call fails
      HttpClient.get.mockResolvedValueOnce({ success: false, error: "Network request failed" });

      const consoleSpy = jest.spyOn(console, "warn").mockImplementation(() => {});
      const firstResult = await ITManagementService.getITStaff(mockToken);
      expect(firstResult.success).toBe(false);

      // Retry succeeds
      HttpClient.get.mockResolvedValueOnce({ itStaff: [] });

      const retryResult = await ITManagementService.getITStaff(mockToken);
      expect(retryResult.success).toBe(true);

      consoleSpy.mockRestore();
    });
  });
});
