// Mock fetch
global.fetch = jest.fn();

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
    global.fetch.mockReset();
    mockHandleTokenExpired.mockClear();
  });

  describe("get method", () => {
    it("should trigger handleTokenExpired on 401 response", async () => {
      global.fetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        statusText: "Unauthorized",
      });

      const result = await FetchData.get("/api/v1/test", mockToken);

      expect(mockHandleTokenExpired).toHaveBeenCalledTimes(1);
      expect(result).toBeInstanceOf(Error);
      expect(result.message).toBe("Session expired");
    });

    it("should not trigger handleTokenExpired on successful response", async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ data: "test" }),
      });

      const result = await FetchData.get("/api/v1/test", mockToken);

      expect(mockHandleTokenExpired).not.toHaveBeenCalled();
      expect(result.data).toBe("test");
    });

    it("should not trigger handleTokenExpired on other error status codes", async () => {
      global.fetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: "Internal Server Error",
      });

      await FetchData.get("/api/v1/test", mockToken);

      expect(mockHandleTokenExpired).not.toHaveBeenCalled();
    });

    it("should not trigger handleTokenExpired on 404 response", async () => {
      global.fetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: "Not Found",
      });

      await FetchData.get("/api/v1/test", mockToken);

      expect(mockHandleTokenExpired).not.toHaveBeenCalled();
    });
  });

  describe("post method", () => {
    it("should trigger handleTokenExpired on 401 response", async () => {
      global.fetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        statusText: "Unauthorized",
      });

      await expect(
        FetchData.post("/api/v1/test", { data: "test" }, mockToken)
      ).rejects.toThrow("Session expired");

      expect(mockHandleTokenExpired).toHaveBeenCalledTimes(1);
    });

    it("should not trigger handleTokenExpired on successful response", async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ success: true }),
      });

      const result = await FetchData.post(
        "/api/v1/test",
        { data: "test" },
        mockToken
      );

      expect(mockHandleTokenExpired).not.toHaveBeenCalled();
      expect(result.success).toBe(true);
    });
  });

  describe("getApplicationsFromBackend method", () => {
    it("should trigger handleTokenExpired on 401 response", async () => {
      global.fetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        statusText: "Unauthorized",
      });

      const result = await FetchData.getApplicationsFromBackend(mockToken);

      expect(mockHandleTokenExpired).toHaveBeenCalledTimes(1);
      expect(result).toBeInstanceOf(Error);
    });

    it("should not trigger handleTokenExpired on successful response", async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ applications: [] }),
      });

      const result = await FetchData.getApplicationsFromBackend(mockToken);

      expect(mockHandleTokenExpired).not.toHaveBeenCalled();
      expect(result.applications).toEqual([]);
    });
  });

  describe("getBookingInfo method", () => {
    it("should trigger handleTokenExpired on 401 response", async () => {
      global.fetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        statusText: "Unauthorized",
      });

      const result = await FetchData.getBookingInfo(123, mockToken);

      expect(mockHandleTokenExpired).toHaveBeenCalledTimes(1);
      expect(result.error).toBe("Session expired");
    });

    it("should not trigger handleTokenExpired on successful response", async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ booking: { id: 123 } }),
      });

      const result = await FetchData.getBookingInfo(123, mockToken);

      expect(mockHandleTokenExpired).not.toHaveBeenCalled();
      expect(result.booking.id).toBe(123);
    });
  });

  describe("getRequestCountsByHome method", () => {
    it("should trigger handleTokenExpired on 401 response", async () => {
      global.fetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        statusText: "Unauthorized",
      });

      const result = await FetchData.getRequestCountsByHome(mockToken);

      expect(mockHandleTokenExpired).toHaveBeenCalledTimes(1);
      expect(result).toEqual({ requestCountsByHome: {} });
    });

    it("should not trigger handleTokenExpired on successful response", async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ requestCountsByHome: { 1: 5 } }),
      });

      const result = await FetchData.getRequestCountsByHome(mockToken);

      expect(mockHandleTokenExpired).not.toHaveBeenCalled();
      expect(result.requestCountsByHome).toEqual({ 1: 5 });
    });

    it("should return empty object when no token provided", async () => {
      const result = await FetchData.getRequestCountsByHome(null);

      expect(global.fetch).not.toHaveBeenCalled();
      expect(result).toEqual({ requestCountsByHome: {} });
    });
  });

  describe("login method (unauthenticated endpoint)", () => {
    it("should not trigger handleTokenExpired on 401 for invalid password", async () => {
      global.fetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        statusText: "Unauthorized",
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
