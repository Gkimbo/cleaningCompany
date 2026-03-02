// Mock fetch
global.fetch = jest.fn();

// Mock AsyncStorage
jest.mock("@react-native-async-storage/async-storage", () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
}));

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

const AsyncStorage = require("@react-native-async-storage/async-storage");
const getCurrentUser = require("../../src/services/fetchRequests/getCurrentUser").default;

describe("getCurrentUser - Token Expiry Handling", () => {
  const mockToken = "test_token_12345";
  const mockUser = {
    id: 1,
    firstName: "John",
    lastName: "Doe",
    email: "john@example.com",
    type: "cleaner",
  };

  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch.mockReset();
    AsyncStorage.getItem.mockReset();
    mockHandleTokenExpired.mockClear();
  });

  describe("successful responses", () => {
    it("should return user data on successful response", async () => {
      AsyncStorage.getItem.mockResolvedValue(mockToken);
      global.fetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve(mockUser),
      });

      const result = await getCurrentUser();

      expect(result).toEqual(mockUser);
      expect(mockHandleTokenExpired).not.toHaveBeenCalled();
    });

    it("should use provided token instead of AsyncStorage", async () => {
      const providedToken = "provided_token_789";
      global.fetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve(mockUser),
      });

      await getCurrentUser(providedToken);

      expect(AsyncStorage.getItem).not.toHaveBeenCalled();
      expect(global.fetch).toHaveBeenCalledWith(
        "http://localhost:3000/api/v1/user-sessions/current",
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: `Bearer ${providedToken}`,
          }),
        })
      );
    });
  });

  describe("token expiry (401 responses)", () => {
    it("should trigger handleTokenExpired on 401 response", async () => {
      AsyncStorage.getItem.mockResolvedValue(mockToken);
      global.fetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        statusText: "Unauthorized",
      });

      const result = await getCurrentUser();

      expect(mockHandleTokenExpired).toHaveBeenCalledTimes(1);
      expect(result).toBeNull();
    });

    it("should trigger handleTokenExpired with provided token on 401", async () => {
      global.fetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        statusText: "Unauthorized",
      });

      const result = await getCurrentUser(mockToken);

      expect(mockHandleTokenExpired).toHaveBeenCalledTimes(1);
      expect(result).toBeNull();
    });

    it("should return null instead of throwing on 401", async () => {
      AsyncStorage.getItem.mockResolvedValue(mockToken);
      global.fetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        statusText: "Unauthorized",
      });

      // Should not throw
      const result = await getCurrentUser();

      expect(result).toBeNull();
    });
  });

  describe("no token scenarios", () => {
    it("should return null when no token in AsyncStorage", async () => {
      AsyncStorage.getItem.mockResolvedValue(null);

      const result = await getCurrentUser();

      expect(result).toBeNull();
      expect(global.fetch).not.toHaveBeenCalled();
      expect(mockHandleTokenExpired).not.toHaveBeenCalled();
    });

    it("should not trigger handleTokenExpired when no token exists", async () => {
      AsyncStorage.getItem.mockResolvedValue(null);

      await getCurrentUser();

      expect(mockHandleTokenExpired).not.toHaveBeenCalled();
    });
  });

  describe("other error responses", () => {
    it("should throw on 500 error (not trigger token expiry)", async () => {
      AsyncStorage.getItem.mockResolvedValue(mockToken);
      global.fetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: "Internal Server Error",
      });

      await expect(getCurrentUser()).rejects.toThrow("500 (Internal Server Error)");
      expect(mockHandleTokenExpired).not.toHaveBeenCalled();
    });

    it("should throw on 403 error (not trigger token expiry)", async () => {
      AsyncStorage.getItem.mockResolvedValue(mockToken);
      global.fetch.mockResolvedValueOnce({
        ok: false,
        status: 403,
        statusText: "Forbidden",
      });

      await expect(getCurrentUser()).rejects.toThrow("403 (Forbidden)");
      expect(mockHandleTokenExpired).not.toHaveBeenCalled();
    });

    it("should throw on 404 error (not trigger token expiry)", async () => {
      AsyncStorage.getItem.mockResolvedValue(mockToken);
      global.fetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: "Not Found",
      });

      await expect(getCurrentUser()).rejects.toThrow("404 (Not Found)");
      expect(mockHandleTokenExpired).not.toHaveBeenCalled();
    });
  });

  describe("request headers", () => {
    it("should include correct headers in request", async () => {
      AsyncStorage.getItem.mockResolvedValue(mockToken);
      global.fetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve(mockUser),
      });

      await getCurrentUser();

      expect(global.fetch).toHaveBeenCalledWith(
        "http://localhost:3000/api/v1/user-sessions/current",
        {
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${mockToken}`,
          },
        }
      );
    });
  });
});
