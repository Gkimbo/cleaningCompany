// Mock HttpClient
jest.mock("../../src/services/HttpClient", () => ({
  __esModule: true,
  default: {
    get: jest.fn(),
    post: jest.fn(),
    put: jest.fn(),
    patch: jest.fn(),
    delete: jest.fn(),
    request: jest.fn(),
  },
}));

import HttpClient from "../../src/services/HttpClient";

// Mock the config
jest.mock("../../src/services/config", () => ({
  API_BASE: "http://localhost:3000/api/v1",
}));

// Create mock functions we can reference
const mockHandleTokenExpired = jest.fn();

// Mock AuthEventService
jest.mock("../../src/services/AuthEventService", () => ({
  __esModule: true,
  default: {
    handleTokenExpired: mockHandleTokenExpired,
    setLogoutCallback: jest.fn(),
    clearLogoutCallback: jest.fn(),
  },
}));

const FetchData = require("../../src/services/fetchRequests/fetchData").default;

describe("FetchData - Token Expiry Handling", () => {
  const mockToken = "test_token_12345";

  beforeEach(() => {
    jest.clearAllMocks();
    mockHandleTokenExpired.mockClear();
  });

  describe("get method", () => {
    it("should throw 'Session expired' on 401 response", async () => {
      HttpClient.request.mockResolvedValueOnce({
        success: false,
        status: 401,
        error: "Session expired",
      });

      await expect(FetchData.get("/api/v1/test", mockToken)).rejects.toThrow("Session expired");
    });

    it("should not throw on successful response", async () => {
      HttpClient.request.mockResolvedValueOnce({ data: "test" });

      const result = await FetchData.get("/api/v1/test", mockToken);

      expect(result.data).toBe("test");
    });

    it("should throw 'No data received' on other error status codes", async () => {
      HttpClient.request.mockResolvedValueOnce({
        success: false,
        status: 500,
        error: "Internal Server Error",
      });

      await expect(FetchData.get("/api/v1/test", mockToken)).rejects.toThrow("No data received");
    });

    it("should throw 'No data received' on 404 response", async () => {
      HttpClient.request.mockResolvedValueOnce({
        success: false,
        status: 404,
        error: "Not Found",
      });

      await expect(FetchData.get("/api/v1/test", mockToken)).rejects.toThrow("No data received");
    });
  });

  describe("post method", () => {
    it("should throw 'Session expired' on 401 response", async () => {
      HttpClient.post.mockResolvedValueOnce({
        success: false,
        status: 401,
        error: "Session expired",
      });

      await expect(
        FetchData.post("/api/v1/test", { data: "test" }, mockToken)
      ).rejects.toThrow("Session expired");
    });

    it("should return data on successful response", async () => {
      HttpClient.post.mockResolvedValueOnce({ success: true });

      const result = await FetchData.post(
        "/api/v1/test",
        { data: "test" },
        mockToken
      );

      expect(result.success).toBe(true);
    });
  });

  describe("getApplicationsFromBackend method", () => {
    it("should throw on 401 response", async () => {
      HttpClient.get.mockResolvedValueOnce({
        success: false,
        status: 401,
        error: "Session expired",
      });

      await expect(FetchData.getApplicationsFromBackend(mockToken)).rejects.toThrow("Session expired");
    });

    it("should return data on successful response", async () => {
      HttpClient.get.mockResolvedValueOnce({ applications: [] });

      const result = await FetchData.getApplicationsFromBackend(mockToken);

      expect(result.applications).toEqual([]);
    });
  });

  describe("getBookingInfo method", () => {
    it("should return error object on 401 response", async () => {
      HttpClient.get.mockResolvedValueOnce({
        success: false,
        status: 401,
        error: "Session expired",
      });

      const result = await FetchData.getBookingInfo(123, mockToken);

      expect(result.error).toBe("Session expired");
    });

    it("should return data on successful response", async () => {
      HttpClient.get.mockResolvedValueOnce({ booking: { id: 123 } });

      const result = await FetchData.getBookingInfo(123, mockToken);

      expect(result.booking.id).toBe(123);
    });
  });

  describe("getRequestCountsByHome method", () => {
    it("should return empty object on 401 response", async () => {
      HttpClient.get.mockResolvedValueOnce({
        success: false,
        status: 401,
        error: "Session expired",
      });

      const result = await FetchData.getRequestCountsByHome(mockToken);

      expect(result).toEqual({ requestCountsByHome: {} });
    });

    it("should return data on successful response", async () => {
      HttpClient.get.mockResolvedValueOnce({ requestCountsByHome: { 1: 5 } });

      const result = await FetchData.getRequestCountsByHome(mockToken);

      expect(result.requestCountsByHome).toEqual({ 1: 5 });
    });

    it("should return empty object when no token provided", async () => {
      const result = await FetchData.getRequestCountsByHome(null);

      expect(HttpClient.get).not.toHaveBeenCalled();
      expect(result).toEqual({ requestCountsByHome: {} });
    });
  });

  describe("login method (unauthenticated endpoint)", () => {
    it("should not trigger handleTokenExpired on 401 for invalid password", async () => {
      HttpClient.post.mockResolvedValueOnce({
        success: false,
        status: 401,
        error: "Invalid credentials",
      });

      const result = await FetchData.login({
        userName: "test",
        password: "wrong",
      });

      // Login endpoint returns "Invalid password" for 401, not session expired
      expect(mockHandleTokenExpired).not.toHaveBeenCalled();
      expect(result).toBe("Invalid password");
    });
  });
});
