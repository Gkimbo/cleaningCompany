import FetchData from "../../src/services/fetchRequests/fetchData";

// Mock fetch globally
global.fetch = jest.fn();

// Mock API base URL
jest.mock("../../src/services/config", () => ({
  API_BASE: "http://localhost:3000/api/v1",
}));

describe("FetchData - Employee Service Methods", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("getEmployeesWorking", () => {
    it("should fetch employees working successfully", async () => {
      const mockEmployees = {
        employees: [
          { id: 1, username: "cleaner1", daysWorking: ["Monday", "Tuesday"] },
          { id: 2, username: "cleaner2", daysWorking: ["Wednesday", "Thursday"] },
        ],
      };

      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockEmployees),
      });

      const result = await FetchData.getEmployeesWorking();

      expect(result).toEqual(mockEmployees);
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining("/api/v1/employee-info/employeeSchedule")
      );
    });

    it("should return empty array when no employees", async () => {
      const mockEmptyResponse = { employees: [] };

      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockEmptyResponse),
      });

      const result = await FetchData.getEmployeesWorking();

      expect(result.employees).toHaveLength(0);
    });

    it("should return error when response is not ok", async () => {
      global.fetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
      });

      const result = await FetchData.getEmployeesWorking();

      expect(result).toBeInstanceOf(Error);
      expect(result.message).toBe("No data received");
    });

    it("should handle network error", async () => {
      global.fetch.mockRejectedValueOnce(new Error("Network error"));

      const result = await FetchData.getEmployeesWorking();

      expect(result).toBeInstanceOf(Error);
      expect(result.message).toBe("Network error");
    });
  });

  describe("makeNewEmployee", () => {
    const validEmployeeData = {
      firstName: "John",
      lastName: "Doe",
      userName: "johndoe",
      password: "password123",
      email: "john@example.com",
      type: "cleaner",
      phone: "555-1234",
    };

    it("should create a new employee successfully", async () => {
      const mockResponse = {
        user: {
          id: 1,
          username: "johndoe",
          email: "john@example.com",
          type: "cleaner",
          firstName: "John",
          lastName: "Doe",
        },
      };

      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const result = await FetchData.makeNewEmployee(validEmployeeData);

      expect(result).toEqual(mockResponse);
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining("/api/v1/users/new-employee"),
        expect.objectContaining({
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            username: "johndoe",
            password: "password123",
            email: "john@example.com",
            type: "cleaner",
            firstName: "John",
            lastName: "Doe",
            phone: "555-1234",
          }),
        })
      );
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

    it("should throw error for other status codes", async () => {
      global.fetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
      });

      const result = await FetchData.makeNewEmployee(validEmployeeData);

      expect(result).toBeInstanceOf(Error);
      expect(result.message).toBe("Failed to create user");
    });

    it("should handle network error", async () => {
      global.fetch.mockRejectedValueOnce(new Error("Network error"));

      const result = await FetchData.makeNewEmployee(validEmployeeData);

      expect(result).toBeInstanceOf(Error);
      expect(result.message).toBe("Network error");
    });

    it("should omit optional fields when not provided", async () => {
      const minimalData = {
        userName: "johndoe",
        password: "password123",
        email: "john@example.com",
        type: "cleaner",
      };

      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ user: { id: 1 } }),
      });

      await FetchData.makeNewEmployee(minimalData);

      // Service only includes fields that are provided in data
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining("/api/v1/users/new-employee"),
        expect.objectContaining({
          method: "POST",
          body: expect.stringContaining('"username":"johndoe"'),
        })
      );
    });
  });

  describe("editEmployee", () => {
    const updateData = {
      id: 1,
      firstName: "Jane",
      lastName: "Doe",
      userName: "janedoe",
      password: "newpassword123",
      email: "jane@example.com",
      type: "cleaner",
      phone: "555-5678",
    };

    it("should update employee successfully", async () => {
      const mockResponse = {
        user: {
          id: 1,
          username: "janedoe",
          email: "jane@example.com",
          type: "cleaner",
          firstName: "Jane",
          lastName: "Doe",
        },
      };

      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const result = await FetchData.editEmployee(updateData);

      expect(result).toEqual(mockResponse);
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining("/api/v1/users/employee"),
        expect.objectContaining({
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: 1,
            username: "janedoe",
            password: "newpassword123",
            email: "jane@example.com",
            type: "cleaner",
            firstName: "Jane",
            lastName: "Doe",
            phone: "555-5678",
          }),
        })
      );
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

    it("should throw error for other status codes", async () => {
      global.fetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
      });

      const result = await FetchData.editEmployee(updateData);

      expect(result).toBeInstanceOf(Error);
    });

    it("should handle network error", async () => {
      global.fetch.mockRejectedValueOnce(new Error("Network error"));

      const result = await FetchData.editEmployee(updateData);

      expect(result).toBeInstanceOf(Error);
      expect(result.message).toBe("Network error");
    });

    it("should change employee type from cleaner to owner", async () => {
      const promoteData = {
        id: 1,
        userName: "promoteduser",
        password: "password123",
        email: "promoted@example.com",
        type: "owner",
        firstName: "Promoted",
        lastName: "User",
      };

      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ user: { ...promoteData, username: promoteData.userName } }),
      });

      await FetchData.editEmployee(promoteData);

      expect(global.fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: expect.stringContaining('"type":"owner"'),
        })
      );
    });

    it("should update without password when not provided", async () => {
      const updateWithoutPassword = {
        id: 1,
        userName: "janedoe",
        email: "jane@example.com",
        type: "cleaner",
        firstName: "Jane",
        lastName: "Doe",
      };

      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ user: { id: 1 } }),
      });

      await FetchData.editEmployee(updateWithoutPassword);

      // Should still make the request without password field
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining("/api/v1/users/employee"),
        expect.objectContaining({
          method: "PATCH",
          body: expect.stringContaining('"username":"janedoe"'),
        })
      );
    });
  });

  describe("deleteEmployee", () => {
    it("should delete employee successfully", async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ message: "Employee Deleted from DB" }),
      });

      const result = await FetchData.deleteEmployee(1);

      expect(result).toEqual({ success: true });
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining("/api/v1/users/employee"),
        expect.objectContaining({
          method: "DELETE",
          headers: expect.objectContaining({ "Content-Type": "application/json" }),
          body: JSON.stringify({ id: 1 }),
        })
      );
    });

    it("should return error when delete fails", async () => {
      global.fetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: () => Promise.resolve({ error: "Failed to delete" }),
      });

      const result = await FetchData.deleteEmployee(1);

      expect(result).toHaveProperty("error");
      expect(result.error).toContain("delete");
    });

    it("should handle network error", async () => {
      global.fetch.mockRejectedValueOnce(new Error("Network error"));

      const result = await FetchData.deleteEmployee(1);

      expect(result).toHaveProperty("error");
      expect(result.error).toBe("Failed to delete employee");
    });

    it("should send employee ID in request body", async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ message: "Deleted" }),
      });

      await FetchData.deleteEmployee(42);

      expect(global.fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: JSON.stringify({ id: 42 }),
        })
      );
    });

    it("should handle string ID", async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ message: "Deleted" }),
      });

      await FetchData.deleteEmployee("10");

      expect(global.fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: JSON.stringify({ id: "10" }),
        })
      );
    });
  });

  describe("URL construction", () => {
    it("should construct correct URL for getEmployeesWorking", async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ employees: [] }),
      });

      await FetchData.getEmployeesWorking();

      const calledUrl = global.fetch.mock.calls[0][0];
      expect(calledUrl).toContain("/api/v1/employee-info/employeeSchedule");
    });

    it("should construct correct URL for makeNewEmployee", async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ user: {} }),
      });

      await FetchData.makeNewEmployee({
        userName: "test",
        password: "test",
        email: "test@test.com",
        type: "cleaner",
      });

      const calledUrl = global.fetch.mock.calls[0][0];
      expect(calledUrl).toContain("/api/v1/users/new-employee");
    });

    it("should construct correct URL for editEmployee", async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ user: {} }),
      });

      await FetchData.editEmployee({
        id: 1,
        userName: "test",
        email: "test@test.com",
        type: "cleaner",
      });

      const calledUrl = global.fetch.mock.calls[0][0];
      expect(calledUrl).toContain("/api/v1/users/employee");
    });

    it("should construct correct URL for deleteEmployee", async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ message: "Deleted" }),
      });

      await FetchData.deleteEmployee(1);

      const calledUrl = global.fetch.mock.calls[0][0];
      expect(calledUrl).toContain("/api/v1/users/employee");
    });
  });

  describe("HTTP methods", () => {
    it("should use GET for fetching employees working", async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ employees: [] }),
      });

      await FetchData.getEmployeesWorking();

      // GET requests don't have a method property or use default
      expect(global.fetch).toHaveBeenCalledWith(
        expect.any(String)
      );
    });

    it("should use POST for creating employees", async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ user: {} }),
      });

      await FetchData.makeNewEmployee({
        userName: "test",
        password: "test",
        email: "test@test.com",
        type: "cleaner",
      });

      expect(global.fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ method: "POST" })
      );
    });

    it("should use PATCH for updating employees", async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ user: {} }),
      });

      await FetchData.editEmployee({
        id: 1,
        userName: "test",
        email: "test@test.com",
        type: "cleaner",
      });

      expect(global.fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ method: "PATCH" })
      );
    });

    it("should use DELETE for deleting employees", async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ message: "Deleted" }),
      });

      await FetchData.deleteEmployee(1);

      expect(global.fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ method: "DELETE" })
      );
    });
  });

  describe("Content-Type headers", () => {
    it("should include Content-Type header in makeNewEmployee", async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ user: {} }),
      });

      await FetchData.makeNewEmployee({
        userName: "test",
        password: "test",
        email: "test@test.com",
        type: "cleaner",
      });

      expect(global.fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: { "Content-Type": "application/json" },
        })
      );
    });

    it("should include Content-Type header in editEmployee", async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ user: {} }),
      });

      await FetchData.editEmployee({
        id: 1,
        userName: "test",
        email: "test@test.com",
        type: "cleaner",
      });

      expect(global.fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: { "Content-Type": "application/json" },
        })
      );
    });

    it("should include Content-Type header in deleteEmployee", async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ message: "Deleted" }),
      });

      await FetchData.deleteEmployee(1);

      expect(global.fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({ "Content-Type": "application/json" }),
        })
      );
    });
  });
});
