import FetchData from "../../src/services/fetchRequests/fetchData";

// Mock global fetch
global.fetch = jest.fn();

describe("Employee Service", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("makeNewEmployee", () => {
    const validEmployeeData = {
      firstName: "John",
      lastName: "Doe",
      userName: "johndoe",
      password: "password123",
      email: "john@test.com",
      type: "cleaner",
    };

    it("should create a new employee successfully", async () => {
      const mockUser = {
        id: 1,
        username: "johndoe",
        email: "john@test.com",
        type: "cleaner",
        firstName: "John",
        lastName: "Doe",
      };

      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ user: mockUser }),
      });

      const result = await FetchData.makeNewEmployee(validEmployeeData);

      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining("/api/v1/users/new-employee"),
        expect.objectContaining({
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            username: "johndoe",
            password: "password123",
            email: "john@test.com",
            type: "cleaner",
            firstName: "John",
            lastName: "Doe",
          }),
        })
      );
      expect(result.user).toEqual(mockUser);
    });

    it("should return error message when email already exists", async () => {
      global.fetch.mockResolvedValueOnce({
        ok: false,
        status: 409,
      });

      const result = await FetchData.makeNewEmployee(validEmployeeData);

      expect(result).toBe("An account already has this email");
    });

    it("should return error message when username already exists", async () => {
      global.fetch.mockResolvedValueOnce({
        ok: false,
        status: 410,
      });

      const result = await FetchData.makeNewEmployee(validEmployeeData);

      expect(result).toBe("Username already exists");
    });

    it("should handle network errors", async () => {
      global.fetch.mockRejectedValueOnce(new Error("Network error"));

      const result = await FetchData.makeNewEmployee(validEmployeeData);

      expect(result).toBeInstanceOf(Error);
    });

    it("should handle other error status codes", async () => {
      global.fetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
      });

      const result = await FetchData.makeNewEmployee(validEmployeeData);

      expect(result).toBeInstanceOf(Error);
    });

    it("should send correct data format to backend", async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ user: { id: 1 } }),
      });

      await FetchData.makeNewEmployee({
        firstName: "Jane",
        lastName: "Smith",
        userName: "janesmith",
        password: "securepass",
        email: "jane@example.com",
        type: "cleaner",
      });

      const callBody = JSON.parse(fetch.mock.calls[0][1].body);
      expect(callBody).toEqual({
        username: "janesmith",
        password: "securepass",
        email: "jane@example.com",
        type: "cleaner",
        firstName: "Jane",
        lastName: "Smith",
      });
    });
  });

  describe("editEmployee", () => {
    const updateData = {
      id: 1,
      userName: "updateduser",
      password: "newpassword",
      email: "updated@test.com",
      type: "cleaner",
    };

    it("should update an employee successfully", async () => {
      const mockUser = {
        id: 1,
        username: "updateduser",
        email: "updated@test.com",
        type: "cleaner",
      };

      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ user: mockUser }),
      });

      const result = await FetchData.editEmployee(updateData);

      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining("/api/v1/users/employee"),
        expect.objectContaining({
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: 1,
            username: "updateduser",
            password: "newpassword",
            email: "updated@test.com",
            type: "cleaner",
          }),
        })
      );
      expect(result.user).toEqual(mockUser);
    });

    it("should return error message when email already exists", async () => {
      global.fetch.mockResolvedValueOnce({
        ok: false,
        status: 409,
      });

      const result = await FetchData.editEmployee(updateData);

      expect(result).toBe("An account already has this email");
    });

    it("should return error message when username already exists", async () => {
      global.fetch.mockResolvedValueOnce({
        ok: false,
        status: 410,
      });

      const result = await FetchData.editEmployee(updateData);

      expect(result).toBe("Username already exists");
    });

    it("should handle network errors", async () => {
      global.fetch.mockRejectedValueOnce(new Error("Network error"));

      const result = await FetchData.editEmployee(updateData);

      expect(result).toBeInstanceOf(Error);
    });

    it("should handle other error status codes", async () => {
      global.fetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
      });

      const result = await FetchData.editEmployee(updateData);

      expect(result).toBeInstanceOf(Error);
    });

    it("should change employee type to manager", async () => {
      const promoteData = {
        id: 1,
        userName: "promoteduser",
        password: "password",
        email: "promoted@test.com",
        type: "manager",
      };

      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ user: { id: 1, type: "manager" } }),
      });

      await FetchData.editEmployee(promoteData);

      const callBody = JSON.parse(fetch.mock.calls[0][1].body);
      expect(callBody.type).toBe("manager");
    });
  });

  describe("deleteEmployee", () => {
    it("should delete an employee successfully", async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ message: "Employee Deleted from DB" }),
      });

      const result = await FetchData.deleteEmployee(1);

      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining("/api/v1/users/employee"),
        expect.objectContaining({
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: 1 }),
        })
      );
      expect(result).toBe(true);
    });

    it("should handle deletion failure", async () => {
      global.fetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
      });

      const result = await FetchData.deleteEmployee(1);

      expect(result).toBeInstanceOf(Error);
    });

    it("should handle network errors during deletion", async () => {
      global.fetch.mockRejectedValueOnce(new Error("Network error"));

      const result = await FetchData.deleteEmployee(1);

      expect(result).toBeInstanceOf(Error);
    });

    it("should send employee ID as number", async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ message: "Deleted" }),
      });

      await FetchData.deleteEmployee(42);

      const callBody = JSON.parse(fetch.mock.calls[0][1].body);
      expect(callBody.id).toBe(42);
    });

    it("should handle string ID", async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ message: "Deleted" }),
      });

      await FetchData.deleteEmployee("5");

      const callBody = JSON.parse(fetch.mock.calls[0][1].body);
      expect(callBody.id).toBe("5");
    });
  });

  describe("getStaffingConfig", () => {
    it("should fetch staffing config successfully", async () => {
      const mockResponse = {
        source: "config",
        pricing: { basePrice: 150 },
        staffing: { minCleanersForAssignment: 1 },
      };

      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await FetchData.getStaffingConfig();

      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining("/api/v1/pricing/current")
      );
      expect(result).toEqual({ minCleanersForAssignment: 1 });
    });

    it("should return default value when staffing is missing from response", async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ source: "config", pricing: {} }),
      });

      const result = await FetchData.getStaffingConfig();

      expect(result).toEqual({ minCleanersForAssignment: 1 });
    });

    it("should return default value on fetch error", async () => {
      global.fetch.mockRejectedValueOnce(new Error("Network error"));

      const result = await FetchData.getStaffingConfig();

      expect(result).toEqual({ minCleanersForAssignment: 1 });
    });

    it("should return default value when response is not ok", async () => {
      global.fetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
      });

      const result = await FetchData.getStaffingConfig();

      expect(result).toEqual({ minCleanersForAssignment: 1 });
    });

    it("should handle different minCleanersForAssignment values", async () => {
      const mockResponse = {
        source: "config",
        staffing: { minCleanersForAssignment: 2 },
      };

      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await FetchData.getStaffingConfig();

      expect(result.minCleanersForAssignment).toBe(2);
    });
  });

  describe("get (for fetching employees)", () => {
    const mockToken = "test-token";

    it("should fetch employees list successfully", async () => {
      const mockEmployees = [
        { id: 1, username: "cleaner1", email: "c1@test.com", type: "cleaner" },
        { id: 2, username: "cleaner2", email: "c2@test.com", type: "cleaner" },
      ];

      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ users: mockEmployees }),
      });

      const result = await FetchData.get("/api/v1/users/employees", mockToken);

      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining("/api/v1/users/employees"),
        expect.objectContaining({
          headers: { Authorization: `Bearer ${mockToken}` },
        })
      );
      expect(result.users).toEqual(mockEmployees);
    });

    it("should return empty array when no employees exist", async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ users: [] }),
      });

      const result = await FetchData.get("/api/v1/users/employees", mockToken);

      expect(result.users).toEqual([]);
    });

    it("should handle unauthorized error", async () => {
      global.fetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
      });

      const result = await FetchData.get("/api/v1/users/employees", mockToken);

      // The get method throws an error when response is not ok
      expect(result).toBeInstanceOf(Error);
      expect(result.message).toBe("No data received");
    });
  });
});
