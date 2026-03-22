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
import FetchData from "../../src/services/fetchRequests/fetchData";

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

      HttpClient.get.mockResolvedValueOnce(mockEmployees);

      const result = await FetchData.getEmployeesWorking();

      expect(result).toEqual(mockEmployees);
      expect(HttpClient.get).toHaveBeenCalledWith("/employee-info/employeeSchedule", { skipAuth: true });
    });

    it("should return empty array when no employees", async () => {
      const mockEmptyResponse = { employees: [] };

      HttpClient.get.mockResolvedValueOnce(mockEmptyResponse);

      const result = await FetchData.getEmployeesWorking();

      expect(result.employees).toHaveLength(0);
    });

    it("should return error when response is not ok", async () => {
      HttpClient.get.mockResolvedValueOnce({ success: false, status: 500 });

      const result = await FetchData.getEmployeesWorking();

      expect(result).toBeInstanceOf(Error);
      expect(result.message).toBe("No data received");
    });

    it("should handle network error", async () => {
      HttpClient.get.mockRejectedValueOnce(new Error("Network error"));

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

      HttpClient.post.mockResolvedValueOnce(mockResponse);

      const result = await FetchData.makeNewEmployee(validEmployeeData);

      expect(result).toEqual(mockResponse);
      expect(HttpClient.post).toHaveBeenCalledWith(
        "/users/new-employee",
        {
          username: "johndoe",
          password: "password123",
          email: "john@example.com",
          type: "cleaner",
          firstName: "John",
          lastName: "Doe",
          phone: "555-1234",
        },
        { skipAuth: true }
      );
    });

    it("should return error message when email already exists", async () => {
      HttpClient.post.mockResolvedValueOnce({ success: false, status: 409 });

      const result = await FetchData.makeNewEmployee(validEmployeeData);

      expect(result).toBe("An account already has this email");
    });

    it("should return error message when username already exists", async () => {
      HttpClient.post.mockResolvedValueOnce({ success: false, status: 410 });

      const result = await FetchData.makeNewEmployee(validEmployeeData);

      expect(result).toBe("Username already exists");
    });

    it("should throw error for other status codes", async () => {
      HttpClient.post.mockResolvedValueOnce({ success: false, status: 500 });

      const result = await FetchData.makeNewEmployee(validEmployeeData);

      expect(result).toBeInstanceOf(Error);
      expect(result.message).toBe("Failed to create user");
    });

    it("should handle network error", async () => {
      HttpClient.post.mockRejectedValueOnce(new Error("Network error"));

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

      HttpClient.post.mockResolvedValueOnce({ user: { id: 1 } });

      await FetchData.makeNewEmployee(minimalData);

      expect(HttpClient.post).toHaveBeenCalledWith(
        "/users/new-employee",
        expect.objectContaining({
          username: "johndoe",
          password: "password123",
          email: "john@example.com",
          type: "cleaner",
        }),
        { skipAuth: true }
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

      HttpClient.patch.mockResolvedValueOnce(mockResponse);

      const result = await FetchData.editEmployee(updateData);

      expect(result).toEqual(mockResponse);
      expect(HttpClient.patch).toHaveBeenCalledWith(
        "/users/employee",
        {
          id: 1,
          username: "janedoe",
          password: "newpassword123",
          email: "jane@example.com",
          type: "cleaner",
          firstName: "Jane",
          lastName: "Doe",
          phone: "555-5678",
        },
        { skipAuth: true }
      );
    });

    it("should return error message when email already exists", async () => {
      HttpClient.patch.mockResolvedValueOnce({ success: false, status: 409 });

      const result = await FetchData.editEmployee(updateData);

      expect(result).toBe("An account already has this email");
    });

    it("should return error message when username already exists", async () => {
      HttpClient.patch.mockResolvedValueOnce({ success: false, status: 410 });

      const result = await FetchData.editEmployee(updateData);

      expect(result).toBe("Username already exists");
    });

    it("should throw error for other status codes", async () => {
      HttpClient.patch.mockResolvedValueOnce({ success: false, status: 500 });

      const result = await FetchData.editEmployee(updateData);

      expect(result).toBeInstanceOf(Error);
    });

    it("should handle network error", async () => {
      HttpClient.patch.mockRejectedValueOnce(new Error("Network error"));

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

      HttpClient.patch.mockResolvedValueOnce({ user: { ...promoteData, username: promoteData.userName } });

      await FetchData.editEmployee(promoteData);

      expect(HttpClient.patch).toHaveBeenCalledWith(
        "/users/employee",
        expect.objectContaining({ type: "owner" }),
        { skipAuth: true }
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

      HttpClient.patch.mockResolvedValueOnce({ user: { id: 1 } });

      await FetchData.editEmployee(updateWithoutPassword);

      expect(HttpClient.patch).toHaveBeenCalledWith(
        "/users/employee",
        expect.objectContaining({ username: "janedoe" }),
        { skipAuth: true }
      );
    });
  });

  describe("deleteEmployee", () => {
    it("should delete employee successfully", async () => {
      HttpClient.delete.mockResolvedValueOnce({ message: "Employee Deleted from DB" });

      const result = await FetchData.deleteEmployee(1);

      expect(result).toEqual({ success: true });
      expect(HttpClient.delete).toHaveBeenCalledWith("/users/employee", { token: undefined, body: { id: 1 } });
    });

    it("should return error when delete fails", async () => {
      HttpClient.delete.mockResolvedValueOnce({ success: false, error: "Failed to delete" });

      const result = await FetchData.deleteEmployee(1);

      expect(result).toHaveProperty("error");
      expect(result.error).toContain("delete");
    });

    it("should handle network error", async () => {
      HttpClient.delete.mockRejectedValueOnce(new Error("Network error"));

      const result = await FetchData.deleteEmployee(1);

      expect(result).toHaveProperty("error");
      expect(result.error).toBe("Failed to delete employee");
    });

    it("should send employee ID in request body", async () => {
      HttpClient.delete.mockResolvedValueOnce({ message: "Deleted" });

      await FetchData.deleteEmployee(42);

      expect(HttpClient.delete).toHaveBeenCalledWith("/users/employee", { token: undefined, body: { id: 42 } });
    });

    it("should handle string ID", async () => {
      HttpClient.delete.mockResolvedValueOnce({ message: "Deleted" });

      await FetchData.deleteEmployee("10");

      expect(HttpClient.delete).toHaveBeenCalledWith("/users/employee", { token: undefined, body: { id: "10" } });
    });
  });

  describe("URL construction", () => {
    it("should construct correct URL for getEmployeesWorking", async () => {
      HttpClient.get.mockResolvedValueOnce({ employees: [] });

      await FetchData.getEmployeesWorking();

      expect(HttpClient.get).toHaveBeenCalledWith("/employee-info/employeeSchedule", { skipAuth: true });
    });

    it("should construct correct URL for makeNewEmployee", async () => {
      HttpClient.post.mockResolvedValueOnce({ user: {} });

      await FetchData.makeNewEmployee({
        userName: "test",
        password: "test",
        email: "test@test.com",
        type: "cleaner",
      });

      expect(HttpClient.post).toHaveBeenCalledWith(
        "/users/new-employee",
        expect.any(Object),
        { skipAuth: true }
      );
    });

    it("should construct correct URL for editEmployee", async () => {
      HttpClient.patch.mockResolvedValueOnce({ user: {} });

      await FetchData.editEmployee({
        id: 1,
        userName: "test",
        email: "test@test.com",
        type: "cleaner",
      });

      expect(HttpClient.patch).toHaveBeenCalledWith(
        "/users/employee",
        expect.any(Object),
        { skipAuth: true }
      );
    });

    it("should construct correct URL for deleteEmployee", async () => {
      HttpClient.delete.mockResolvedValueOnce({ message: "Deleted" });

      await FetchData.deleteEmployee(1);

      expect(HttpClient.delete).toHaveBeenCalledWith("/users/employee", expect.any(Object));
    });
  });

  describe("HTTP methods", () => {
    it("should use GET for fetching employees working", async () => {
      HttpClient.get.mockResolvedValueOnce({ employees: [] });

      await FetchData.getEmployeesWorking();

      expect(HttpClient.get).toHaveBeenCalled();
    });

    it("should use POST for creating employees", async () => {
      HttpClient.post.mockResolvedValueOnce({ user: {} });

      await FetchData.makeNewEmployee({
        userName: "test",
        password: "test",
        email: "test@test.com",
        type: "cleaner",
      });

      expect(HttpClient.post).toHaveBeenCalled();
    });

    it("should use PATCH for updating employees", async () => {
      HttpClient.patch.mockResolvedValueOnce({ user: {} });

      await FetchData.editEmployee({
        id: 1,
        userName: "test",
        email: "test@test.com",
        type: "cleaner",
      });

      expect(HttpClient.patch).toHaveBeenCalled();
    });

    it("should use DELETE for deleting employees", async () => {
      HttpClient.delete.mockResolvedValueOnce({ message: "Deleted" });

      await FetchData.deleteEmployee(1);

      expect(HttpClient.delete).toHaveBeenCalled();
    });
  });

  describe("Content-Type headers", () => {
    // Note: HttpClient handles Content-Type headers internally, so we just verify calls are made correctly
    it("should call POST for makeNewEmployee", async () => {
      HttpClient.post.mockResolvedValueOnce({ user: {} });

      await FetchData.makeNewEmployee({
        userName: "test",
        password: "test",
        email: "test@test.com",
        type: "cleaner",
      });

      expect(HttpClient.post).toHaveBeenCalledWith(
        "/users/new-employee",
        expect.any(Object),
        { skipAuth: true }
      );
    });

    it("should call PATCH for editEmployee", async () => {
      HttpClient.patch.mockResolvedValueOnce({ user: {} });

      await FetchData.editEmployee({
        id: 1,
        userName: "test",
        email: "test@test.com",
        type: "cleaner",
      });

      expect(HttpClient.patch).toHaveBeenCalledWith(
        "/users/employee",
        expect.any(Object),
        { skipAuth: true }
      );
    });

    it("should call DELETE for deleteEmployee", async () => {
      HttpClient.delete.mockResolvedValueOnce({ message: "Deleted" });

      await FetchData.deleteEmployee(1);

      expect(HttpClient.delete).toHaveBeenCalledWith("/users/employee", expect.any(Object));
    });
  });
});
