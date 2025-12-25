import HRManagementService from "../../src/services/fetchRequests/HRManagementService";

// Mock global fetch
global.fetch = jest.fn();

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
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockHRStaff,
      });

      const result = await HRManagementService.getHRStaff(mockToken);

      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining("/api/v1/users/hr-staff"),
        expect.objectContaining({
          headers: { Authorization: `Bearer ${mockToken}` },
        })
      );
      expect(result.hrStaff).toHaveLength(2);
      expect(result.hrStaff[0].firstName).toBe("Jane");
    });

    it("should return fallback on API error", async () => {
      global.fetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
      });

      const result = await HRManagementService.getHRStaff(mockToken);

      expect(result.hrStaff).toEqual([]);
    });

    it("should return fallback on network error", async () => {
      global.fetch.mockRejectedValueOnce(new Error("Network error"));

      const result = await HRManagementService.getHRStaff(mockToken);

      expect(result.hrStaff).toEqual([]);
    });

    it("should return fallback on 403 Forbidden", async () => {
      global.fetch.mockResolvedValueOnce({
        ok: false,
        status: 403,
      });

      const result = await HRManagementService.getHRStaff(mockToken);

      expect(result.hrStaff).toEqual([]);
    });

    it("should include all employee details in response", async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockHRStaff,
      });

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
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockCreatedUser,
      });

      const result = await HRManagementService.createHREmployee(mockToken, newEmployeeData);

      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining("/api/v1/users/new-hr"),
        expect.objectContaining({
          method: "POST",
          headers: {
            Authorization: `Bearer ${mockToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(newEmployeeData),
        })
      );
      expect(result.success).toBe(true);
      expect(result.user).toBeDefined();
      expect(result.user.id).toBe(20);
    });

    it("should handle validation error", async () => {
      global.fetch.mockResolvedValueOnce({
        ok: false,
        json: async () => ({ error: "Password must contain special character" }),
      });

      const result = await HRManagementService.createHREmployee(mockToken, {
        ...newEmployeeData,
        password: "WeakPassword",
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe("Password must contain special character");
    });

    it("should handle duplicate email error", async () => {
      global.fetch.mockResolvedValueOnce({
        ok: false,
        status: 409,
        json: async () => ({ error: "Email already exists" }),
      });

      const result = await HRManagementService.createHREmployee(mockToken, newEmployeeData);

      expect(result.success).toBe(false);
      expect(result.error).toBe("Email already exists");
    });

    it("should handle duplicate username error", async () => {
      global.fetch.mockResolvedValueOnce({
        ok: false,
        status: 410,
        json: async () => ({ error: "Username already exists" }),
      });

      const result = await HRManagementService.createHREmployee(mockToken, newEmployeeData);

      expect(result.success).toBe(false);
      expect(result.error).toBe("Username already exists");
    });

    it("should handle network error", async () => {
      global.fetch.mockRejectedValueOnce(new Error("Network error"));

      const result = await HRManagementService.createHREmployee(mockToken, newEmployeeData);

      expect(result.success).toBe(false);
      expect(result.error).toBe("Network error. Please try again.");
    });

    it("should handle server error", async () => {
      global.fetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: async () => ({ error: "Internal server error" }),
      });

      const result = await HRManagementService.createHREmployee(mockToken, newEmployeeData);

      expect(result.success).toBe(false);
      expect(result.error).toBe("Internal server error");
    });

    it("should provide default error message when none returned", async () => {
      global.fetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: async () => ({}),
      });

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
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockUpdatedUser,
      });

      const result = await HRManagementService.updateHREmployee(mockToken, 10, updateData);

      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining("/api/v1/users/hr-staff/10"),
        expect.objectContaining({
          method: "PATCH",
          headers: {
            Authorization: `Bearer ${mockToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(updateData),
        })
      );
      expect(result.success).toBe(true);
      expect(result.message).toBe("HR employee updated successfully");
    });

    it("should handle partial updates", async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          message: "HR employee updated successfully",
          user: { id: 10, firstName: "OnlyFirst" },
        }),
      });

      const result = await HRManagementService.updateHREmployee(mockToken, 10, {
        firstName: "OnlyFirst",
      });

      expect(result.success).toBe(true);
      expect(fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: JSON.stringify({ firstName: "OnlyFirst" }),
        })
      );
    });

    it("should handle employee not found error", async () => {
      global.fetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        json: async () => ({ error: "HR employee not found" }),
      });

      const result = await HRManagementService.updateHREmployee(mockToken, 999, updateData);

      expect(result.success).toBe(false);
      expect(result.error).toBe("HR employee not found");
    });

    it("should handle email conflict error", async () => {
      global.fetch.mockResolvedValueOnce({
        ok: false,
        status: 409,
        json: async () => ({ error: "Email is already in use" }),
      });

      const result = await HRManagementService.updateHREmployee(mockToken, 10, updateData);

      expect(result.success).toBe(false);
      expect(result.error).toBe("Email is already in use");
    });

    it("should handle invalid email format error", async () => {
      global.fetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: async () => ({ error: "Please provide a valid email address" }),
      });

      const result = await HRManagementService.updateHREmployee(mockToken, 10, {
        email: "invalid-email",
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("valid email");
    });

    it("should handle network error", async () => {
      global.fetch.mockRejectedValueOnce(new Error("Network error"));

      const result = await HRManagementService.updateHREmployee(mockToken, 10, updateData);

      expect(result.success).toBe(false);
      expect(result.error).toBe("Network error. Please try again.");
    });

    it("should provide default error message when none returned", async () => {
      global.fetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: async () => ({}),
      });

      const result = await HRManagementService.updateHREmployee(mockToken, 10, updateData);

      expect(result.success).toBe(false);
      expect(result.error).toBe("Failed to update HR employee");
    });
  });

  describe("deleteHREmployee", () => {
    it("should delete HR employee successfully", async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ message: "HR employee removed successfully" }),
      });

      const result = await HRManagementService.deleteHREmployee(mockToken, 10);

      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining("/api/v1/users/hr-staff/10"),
        expect.objectContaining({
          method: "DELETE",
          headers: { Authorization: `Bearer ${mockToken}` },
        })
      );
      expect(result.success).toBe(true);
      expect(result.message).toBe("HR employee removed successfully");
    });

    it("should handle employee not found error", async () => {
      global.fetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        json: async () => ({ error: "HR employee not found" }),
      });

      const result = await HRManagementService.deleteHREmployee(mockToken, 999);

      expect(result.success).toBe(false);
      expect(result.error).toBe("HR employee not found");
    });

    it("should handle non-HR user error", async () => {
      global.fetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: async () => ({ error: "User is not an HR employee" }),
      });

      const result = await HRManagementService.deleteHREmployee(mockToken, 10);

      expect(result.success).toBe(false);
      expect(result.error).toBe("User is not an HR employee");
    });

    it("should handle authorization error", async () => {
      global.fetch.mockResolvedValueOnce({
        ok: false,
        status: 403,
        json: async () => ({ error: "Only owner can remove HR staff" }),
      });

      const result = await HRManagementService.deleteHREmployee(mockToken, 10);

      expect(result.success).toBe(false);
      expect(result.error).toBe("Only owner can remove HR staff");
    });

    it("should handle network error", async () => {
      global.fetch.mockRejectedValueOnce(new Error("Network error"));

      const result = await HRManagementService.deleteHREmployee(mockToken, 10);

      expect(result.success).toBe(false);
      expect(result.error).toBe("Network error. Please try again.");
    });

    it("should provide default error message when none returned", async () => {
      global.fetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: async () => ({}),
      });

      const result = await HRManagementService.deleteHREmployee(mockToken, 10);

      expect(result.success).toBe(false);
      expect(result.error).toBe("Failed to delete HR employee");
    });
  });

  describe("fetchWithFallback helper", () => {
    it("should log warning on API error", async () => {
      const consoleSpy = jest.spyOn(console, "warn").mockImplementation(() => {});

      global.fetch.mockResolvedValueOnce({
        ok: false,
        status: 403,
      });

      await HRManagementService.getHRStaff(mockToken);

      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    it("should log warning on network error", async () => {
      const consoleSpy = jest.spyOn(console, "warn").mockImplementation(() => {});

      global.fetch.mockRejectedValueOnce(new Error("Connection refused"));

      await HRManagementService.getHRStaff(mockToken);

      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });

  describe("Authorization header", () => {
    it("should include Bearer token in all GET requests", async () => {
      global.fetch.mockResolvedValue({
        ok: true,
        json: async () => ({ hrStaff: [] }),
      });

      await HRManagementService.getHRStaff(mockToken);

      expect(fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: { Authorization: `Bearer ${mockToken}` },
        })
      );
    });

    it("should include Bearer token and Content-Type in POST requests", async () => {
      global.fetch.mockResolvedValue({
        ok: true,
        json: async () => ({ user: {} }),
      });

      await HRManagementService.createHREmployee(mockToken, {});

      expect(fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: {
            Authorization: `Bearer ${mockToken}`,
            "Content-Type": "application/json",
          },
        })
      );
    });

    it("should include Bearer token and Content-Type in PATCH requests", async () => {
      global.fetch.mockResolvedValue({
        ok: true,
        json: async () => ({ user: {} }),
      });

      await HRManagementService.updateHREmployee(mockToken, 10, {});

      expect(fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: {
            Authorization: `Bearer ${mockToken}`,
            "Content-Type": "application/json",
          },
        })
      );
    });

    it("should include Bearer token in DELETE requests", async () => {
      global.fetch.mockResolvedValue({
        ok: true,
        json: async () => ({ message: "Deleted" }),
      });

      await HRManagementService.deleteHREmployee(mockToken, 10);

      expect(fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: { Authorization: `Bearer ${mockToken}` },
        })
      );
    });
  });

  describe("URL construction", () => {
    beforeEach(() => {
      global.fetch.mockResolvedValue({
        ok: true,
        json: async () => ({}),
      });
    });

    it("should construct correct URL for getHRStaff", async () => {
      await HRManagementService.getHRStaff(mockToken);

      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining("/api/v1/users/hr-staff"),
        expect.any(Object)
      );
    });

    it("should construct correct URL for createHREmployee", async () => {
      await HRManagementService.createHREmployee(mockToken, {});

      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining("/api/v1/users/new-hr"),
        expect.any(Object)
      );
    });

    it("should construct correct URL for updateHREmployee with ID", async () => {
      await HRManagementService.updateHREmployee(mockToken, 42, {});

      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining("/api/v1/users/hr-staff/42"),
        expect.any(Object)
      );
    });

    it("should construct correct URL for deleteHREmployee with ID", async () => {
      await HRManagementService.deleteHREmployee(mockToken, 99);

      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining("/api/v1/users/hr-staff/99"),
        expect.any(Object)
      );
    });
  });
});
