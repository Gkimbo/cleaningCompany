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

// Mock SecureStorage (replaces AsyncStorage for getCurrentUser)
jest.mock("../../src/services/SecureStorage", () => ({
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

const SecureStorage = require("../../src/services/SecureStorage");
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
    SecureStorage.getItem.mockReset();
    mockHandleTokenExpired.mockClear();
  });

  describe("successful responses", () => {
    it("should return user data on successful response", async () => {
      SecureStorage.getItem.mockResolvedValue(mockToken);
      HttpClient.get.mockResolvedValueOnce(mockUser);

      const result = await getCurrentUser();

      expect(result).toEqual(mockUser);
      expect(mockHandleTokenExpired).not.toHaveBeenCalled();
    });

    it("should use provided token instead of SecureStorage", async () => {
      const providedToken = "provided_token_789";
      HttpClient.get.mockResolvedValueOnce(mockUser);

      await getCurrentUser(providedToken);

      expect(SecureStorage.getItem).not.toHaveBeenCalled();
      expect(HttpClient.get).toHaveBeenCalledWith(
        "/user-sessions/current",
        { token: providedToken }
      );
    });
  });

  describe("token expiry (401 responses)", () => {
    it("should return null on 401 response", async () => {
      SecureStorage.getItem.mockResolvedValue(mockToken);
      HttpClient.get.mockResolvedValueOnce({
        success: false,
        status: 401,
        error: "Session expired",
      });

      const result = await getCurrentUser();

      // HttpClient handles the 401 internally, getCurrentUser just returns null
      expect(result).toBeNull();
    });

    it("should return null with provided token on 401", async () => {
      HttpClient.get.mockResolvedValueOnce({
        success: false,
        status: 401,
        error: "Session expired",
      });

      const result = await getCurrentUser(mockToken);

      expect(result).toBeNull();
    });

    it("should return null instead of throwing on 401", async () => {
      SecureStorage.getItem.mockResolvedValue(mockToken);
      HttpClient.get.mockResolvedValueOnce({
        success: false,
        status: 401,
        error: "Unauthorized",
      });

      // Should not throw
      const result = await getCurrentUser();

      expect(result).toBeNull();
    });
  });

  describe("no token scenarios", () => {
    it("should return null when no token in SecureStorage", async () => {
      SecureStorage.getItem.mockResolvedValue(null);

      const result = await getCurrentUser();

      expect(result).toBeNull();
      expect(HttpClient.get).not.toHaveBeenCalled();
      expect(mockHandleTokenExpired).not.toHaveBeenCalled();
    });

    it("should not trigger handleTokenExpired when no token exists", async () => {
      SecureStorage.getItem.mockResolvedValue(null);

      await getCurrentUser();

      expect(mockHandleTokenExpired).not.toHaveBeenCalled();
    });
  });

  describe("other error responses", () => {
    it("should throw on 500 error (not trigger token expiry)", async () => {
      SecureStorage.getItem.mockResolvedValue(mockToken);
      HttpClient.get.mockResolvedValueOnce({
        success: false,
        status: 500,
        error: "Internal Server Error",
      });

      await expect(getCurrentUser()).rejects.toThrow("Internal Server Error");
      expect(mockHandleTokenExpired).not.toHaveBeenCalled();
    });

    it("should throw on 403 error (not trigger token expiry)", async () => {
      SecureStorage.getItem.mockResolvedValue(mockToken);
      HttpClient.get.mockResolvedValueOnce({
        success: false,
        status: 403,
        error: "Forbidden",
      });

      await expect(getCurrentUser()).rejects.toThrow("Forbidden");
      expect(mockHandleTokenExpired).not.toHaveBeenCalled();
    });

    it("should throw on 404 error (not trigger token expiry)", async () => {
      SecureStorage.getItem.mockResolvedValue(mockToken);
      HttpClient.get.mockResolvedValueOnce({
        success: false,
        status: 404,
        error: "Not Found",
      });

      await expect(getCurrentUser()).rejects.toThrow("Not Found");
      expect(mockHandleTokenExpired).not.toHaveBeenCalled();
    });
  });

  describe("request configuration", () => {
    it("should call HttpClient.get with correct URL and config", async () => {
      SecureStorage.getItem.mockResolvedValue(mockToken);
      HttpClient.get.mockResolvedValueOnce(mockUser);

      await getCurrentUser();

      expect(HttpClient.get).toHaveBeenCalledWith(
        "/user-sessions/current",
        { token: mockToken }
      );
    });
  });
});
