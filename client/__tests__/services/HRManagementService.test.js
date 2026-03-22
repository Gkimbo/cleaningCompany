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
import HRManagementService from "../../src/services/fetchRequests/HRManagementService";

describe("HRManagementService", () => {
  const mockToken = "test-owner-token";

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("getHRStaff", () => {
    const mockHRStaff = {
      hrStaff: [
        {
          id: 10,
          firstName: "Jane",
          lastName: "HR",
          username: "janehr",
          email: "jane.hr@example.com",
          phone: "555-123-4567",
          createdAt: "2025-01-01T00:00:00Z",
        },
        {
          id: 11,
          firstName: "John",
          lastName: "Staff",
          username: "johnstaff",
          email: "john.staff@example.com",
          phone: "555-987-6543",
          createdAt: "2025-01-02T00:00:00Z",
        },
      ],
    };

    it("should fetch HR staff successfully", async () => {
      HttpClient.get.mockResolvedValueOnce(mockHRStaff);

      const result = await HRManagementService.getHRStaff(mockToken);

      expect(HttpClient.get).toHaveBeenCalledWith(
        "/users/hr-staff",
        { token: mockToken }
      );
      expect(result.hrStaff).toHaveLength(2);
      expect(result.hrStaff[0].firstName).toBe("Jane");
    });

    it("should return fallback on API error", async () => {
      HttpClient.get.mockResolvedValueOnce({ success: false, error: "Server error" });

      const result = await HRManagementService.getHRStaff(mockToken);

      expect(result.hrStaff).toEqual([]);
    });

    it("should return fallback on network error", async () => {
      HttpClient.get.mockResolvedValueOnce({ success: false, error: "Network request failed" });

      const result = await HRManagementService.getHRStaff(mockToken);

      expect(result.hrStaff).toEqual([]);
    });

    it("should return fallback on 403 Forbidden", async () => {
      HttpClient.get.mockResolvedValueOnce({ success: false, error: "Forbidden" });

      const result = await HRManagementService.getHRStaff(mockToken);

      expect(result.hrStaff).toEqual([]);
    });

    it("should include all employee details in response", async () => {
      HttpClient.get.mockResolvedValueOnce(mockHRStaff);

      const result = await HRManagementService.getHRStaff(mockToken);

      const employee = result.hrStaff[0];
      expect(employee.id).toBe(10);
      expect(employee.username).toBe("janehr");
      expect(employee.email).toBe("jane.hr@example.com");
      expect(employee.phone).toBe("555-123-4567");
      expect(employee.createdAt).toBeDefined();
    });
  });

  describe("createHREmployee", () => {
    const newEmployeeData = {
      firstName: "New",
      lastName: "Employee",
      username: "newemployee",
      email: "new@example.com",
      phone: "555-000-0000",
      password: "SecurePass123!",
    };

    const mockCreatedUser = {
      user: {
        id: 20,
        firstName: "New",
        lastName: "Employee",
        username: "newemployee",
        email: "new@example.com",
        type: "humanResources",
      },
    };

    it("should create HR employee successfully", async () => {
      HttpClient.post.mockResolvedValueOnce(mockCreatedUser);

      const result = await HRManagementService.createHREmployee(mockToken, newEmployeeData);

      expect(HttpClient.post).toHaveBeenCalledWith(
        "/users/new-hr",
        newEmployeeData,
        { token: mockToken }
      );
      expect(result.success).toBe(true);
      expect(result.user).toBeDefined();
      expect(result.user.id).toBe(20);
    });

    it("should handle validation error", async () => {
      HttpClient.post.mockResolvedValueOnce({ success: false, error: "Password must contain special character" });

      const result = await HRManagementService.createHREmployee(mockToken, {
        ...newEmployeeData,
        password: "WeakPassword",
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe("Password must contain special character");
    });

    it("should handle duplicate email error", async () => {
      HttpClient.post.mockResolvedValueOnce({ success: false, error: "Email already exists" });

      const result = await HRManagementService.createHREmployee(mockToken, newEmployeeData);

      expect(result.success).toBe(false);
      expect(result.error).toBe("Email already exists");
    });

    it("should handle duplicate username error", async () => {
      HttpClient.post.mockResolvedValueOnce({ success: false, error: "Username already exists" });

      const result = await HRManagementService.createHREmployee(mockToken, newEmployeeData);

      expect(result.success).toBe(false);
      expect(result.error).toBe("Username already exists");
    });

    it("should handle network error", async () => {
      HttpClient.post.mockResolvedValueOnce({ success: false, error: "Network request failed" });

      const result = await HRManagementService.createHREmployee(mockToken, newEmployeeData);

      expect(result.success).toBe(false);
      expect(result.error).toBe("Network request failed");
    });

    it("should handle server error", async () => {
      HttpClient.post.mockResolvedValueOnce({ success: false, error: "Internal server error" });

      const result = await HRManagementService.createHREmployee(mockToken, newEmployeeData);

      expect(result.success).toBe(false);
      expect(result.error).toBe("Internal server error");
    });

    it("should provide default error message when none returned", async () => {
      HttpClient.post.mockResolvedValueOnce({ success: false });

      const result = await HRManagementService.createHREmployee(mockToken, newEmployeeData);

      expect(result.success).toBe(false);
      expect(result.error).toBe("Failed to create HR employee");
    });
  });

  describe("updateHREmployee", () => {
    const updateData = {
      firstName: "Updated",
      lastName: "Name",
      email: "updated@example.com",
      phone: "555-111-2222",
    };

    const mockUpdatedUser = {
      message: "HR employee updated successfully",
      user: {
        id: 10,
        firstName: "Updated",
        lastName: "Name",
        email: "updated@example.com",
      },
    };

    it("should update HR employee successfully", async () => {
      HttpClient.patch.mockResolvedValueOnce(mockUpdatedUser);

      const result = await HRManagementService.updateHREmployee(mockToken, 10, updateData);

      expect(HttpClient.patch).toHaveBeenCalledWith(
        "/users/hr-staff/10",
        updateData,
        { token: mockToken }
      );
      expect(result.success).toBe(true);
      expect(result.message).toBe("HR employee updated successfully");
    });

    it("should handle partial updates", async () => {
      HttpClient.patch.mockResolvedValueOnce({
        message: "HR employee updated successfully",
        user: { id: 10, firstName: "OnlyFirst" },
      });

      const result = await HRManagementService.updateHREmployee(mockToken, 10, {
        firstName: "OnlyFirst",
      });

      expect(result.success).toBe(true);
      expect(HttpClient.patch).toHaveBeenCalledWith(
        "/users/hr-staff/10",
        { firstName: "OnlyFirst" },
        { token: mockToken }
      );
    });

    it("should handle employee not found error", async () => {
      HttpClient.patch.mockResolvedValueOnce({ success: false, error: "HR employee not found" });

      const result = await HRManagementService.updateHREmployee(mockToken, 999, updateData);

      expect(result.success).toBe(false);
      expect(result.error).toBe("HR employee not found");
    });

    it("should handle email conflict error", async () => {
      HttpClient.patch.mockResolvedValueOnce({ success: false, error: "Email is already in use" });

      const result = await HRManagementService.updateHREmployee(mockToken, 10, updateData);

      expect(result.success).toBe(false);
      expect(result.error).toBe("Email is already in use");
    });

    it("should handle invalid email format error", async () => {
      HttpClient.patch.mockResolvedValueOnce({ success: false, error: "Please provide a valid email address" });

      const result = await HRManagementService.updateHREmployee(mockToken, 10, {
        email: "invalid-email",
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("valid email");
    });

    it("should handle network error", async () => {
      HttpClient.patch.mockResolvedValueOnce({ success: false, error: "Network request failed" });

      const result = await HRManagementService.updateHREmployee(mockToken, 10, updateData);

      expect(result.success).toBe(false);
      expect(result.error).toBe("Network request failed");
    });

    it("should provide default error message when none returned", async () => {
      HttpClient.patch.mockResolvedValueOnce({ success: false });

      const result = await HRManagementService.updateHREmployee(mockToken, 10, updateData);

      expect(result.success).toBe(false);
      expect(result.error).toBe("Failed to update HR employee");
    });
  });

  describe("deleteHREmployee", () => {
    it("should delete HR employee successfully", async () => {
      HttpClient.delete.mockResolvedValueOnce({ message: "HR employee removed successfully" });

      const result = await HRManagementService.deleteHREmployee(mockToken, 10);

      expect(HttpClient.delete).toHaveBeenCalledWith(
        "/users/hr-staff/10",
        { token: mockToken }
      );
      expect(result.success).toBe(true);
      expect(result.message).toBe("HR employee removed successfully");
    });

    it("should handle employee not found error", async () => {
      HttpClient.delete.mockResolvedValueOnce({ success: false, error: "HR employee not found" });

      const result = await HRManagementService.deleteHREmployee(mockToken, 999);

      expect(result.success).toBe(false);
      expect(result.error).toBe("HR employee not found");
    });

    it("should handle non-HR user error", async () => {
      HttpClient.delete.mockResolvedValueOnce({ success: false, error: "User is not an HR employee" });

      const result = await HRManagementService.deleteHREmployee(mockToken, 10);

      expect(result.success).toBe(false);
      expect(result.error).toBe("User is not an HR employee");
    });

    it("should handle authorization error", async () => {
      HttpClient.delete.mockResolvedValueOnce({ success: false, error: "Only owner can remove HR staff" });

      const result = await HRManagementService.deleteHREmployee(mockToken, 10);

      expect(result.success).toBe(false);
      expect(result.error).toBe("Only owner can remove HR staff");
    });

    it("should handle network error", async () => {
      HttpClient.delete.mockResolvedValueOnce({ success: false, error: "Network request failed" });

      const result = await HRManagementService.deleteHREmployee(mockToken, 10);

      expect(result.success).toBe(false);
      expect(result.error).toBe("Network request failed");
    });

    it("should provide default error message when none returned", async () => {
      HttpClient.delete.mockResolvedValueOnce({ success: false });

      const result = await HRManagementService.deleteHREmployee(mockToken, 10);

      expect(result.success).toBe(false);
      expect(result.error).toBe("Failed to delete HR employee");
    });
  });

  describe("fetchWithFallback helper", () => {
    it("should log warning on API error", async () => {
      const consoleSpy = jest.spyOn(console, "warn").mockImplementation(() => {});

      HttpClient.get.mockResolvedValueOnce({ success: false, error: "Forbidden" });

      await HRManagementService.getHRStaff(mockToken);

      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    it("should log warning on network error", async () => {
      const consoleSpy = jest.spyOn(console, "warn").mockImplementation(() => {});

      HttpClient.get.mockResolvedValueOnce({ success: false, error: "Connection refused" });

      await HRManagementService.getHRStaff(mockToken);

      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });

  describe("Authorization header", () => {
    it("should include token in all GET requests", async () => {
      HttpClient.get.mockResolvedValue({ hrStaff: [] });

      await HRManagementService.getHRStaff(mockToken);

      expect(HttpClient.get).toHaveBeenCalledWith(
        "/users/hr-staff",
        { token: mockToken }
      );
    });

    it("should include token in POST requests", async () => {
      HttpClient.post.mockResolvedValue({ user: {} });

      await HRManagementService.createHREmployee(mockToken, {});

      expect(HttpClient.post).toHaveBeenCalledWith(
        "/users/new-hr",
        {},
        { token: mockToken }
      );
    });

    it("should include token in PATCH requests", async () => {
      HttpClient.patch.mockResolvedValue({ user: {} });

      await HRManagementService.updateHREmployee(mockToken, 10, {});

      expect(HttpClient.patch).toHaveBeenCalledWith(
        "/users/hr-staff/10",
        {},
        { token: mockToken }
      );
    });

    it("should include token in DELETE requests", async () => {
      HttpClient.delete.mockResolvedValue({ message: "Deleted" });

      await HRManagementService.deleteHREmployee(mockToken, 10);

      expect(HttpClient.delete).toHaveBeenCalledWith(
        "/users/hr-staff/10",
        { token: mockToken }
      );
    });
  });

  describe("URL construction", () => {
    beforeEach(() => {
      HttpClient.get.mockResolvedValue({});
      HttpClient.post.mockResolvedValue({});
      HttpClient.patch.mockResolvedValue({});
      HttpClient.delete.mockResolvedValue({});
    });

    it("should construct correct URL for getHRStaff", async () => {
      await HRManagementService.getHRStaff(mockToken);

      expect(HttpClient.get).toHaveBeenCalledWith(
        "/users/hr-staff",
        expect.any(Object)
      );
    });

    it("should construct correct URL for createHREmployee", async () => {
      await HRManagementService.createHREmployee(mockToken, {});

      expect(HttpClient.post).toHaveBeenCalledWith(
        "/users/new-hr",
        expect.any(Object),
        expect.any(Object)
      );
    });

    it("should construct correct URL for updateHREmployee with ID", async () => {
      await HRManagementService.updateHREmployee(mockToken, 42, {});

      expect(HttpClient.patch).toHaveBeenCalledWith(
        "/users/hr-staff/42",
        expect.any(Object),
        expect.any(Object)
      );
    });

    it("should construct correct URL for deleteHREmployee with ID", async () => {
      await HRManagementService.deleteHREmployee(mockToken, 99);

      expect(HttpClient.delete).toHaveBeenCalledWith(
        "/users/hr-staff/99",
        expect.any(Object)
      );
    });
  });
});
