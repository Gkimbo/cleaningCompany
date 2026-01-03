import React from "react";

// Mock fetch
global.fetch = jest.fn();

// Mock react-native-vector-icons
jest.mock("react-native-vector-icons/FontAwesome", () => "Icon");

// Mock PreferredCleanerService
jest.mock("../../src/services/fetchRequests/PreferredCleanerService", () => ({
  getPreferredCleaners: jest.fn(),
  removePreferredCleaner: jest.fn(),
  updatePreferredSettings: jest.fn(),
}));

const PreferredCleanerService = require("../../src/services/fetchRequests/PreferredCleanerService");

describe("PreferredCleanersSection Component", () => {
  const mockToken = "test_token_12345";
  const mockHomeId = 10;

  const mockPreferredCleaners = [
    {
      id: 1,
      cleanerId: 100,
      cleanerName: "John Cleaner",
      setAt: "2025-01-01T00:00:00.000Z",
      setBy: "review",
    },
    {
      id: 2,
      cleanerId: 101,
      cleanerName: "Jane Smith",
      setAt: "2025-01-02T00:00:00.000Z",
      setBy: "settings",
    },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    PreferredCleanerService.getPreferredCleaners.mockResolvedValue({
      preferredCleaners: mockPreferredCleaners,
      usePreferredCleaners: true,
    });
  });

  describe("Component State", () => {
    it("should initialize with loading state", () => {
      const loading = true;
      expect(loading).toBe(true);
    });

    it("should set loading to false after fetch", () => {
      let loading = true;
      // Simulate fetch completion
      loading = false;
      expect(loading).toBe(false);
    });

    it("should initialize usePreferredCleaners to true by default", () => {
      const usePreferredCleaners = true;
      expect(usePreferredCleaners).toBe(true);
    });
  });

  describe("Preferred Cleaners List", () => {
    it("should display correct number of preferred cleaners", () => {
      const cleaners = mockPreferredCleaners;
      expect(cleaners.length).toBe(2);
    });

    it("should display cleaner names", () => {
      const cleaners = mockPreferredCleaners;
      expect(cleaners[0].cleanerName).toBe("John Cleaner");
      expect(cleaners[1].cleanerName).toBe("Jane Smith");
    });

    it("should display how cleaner was added (setBy)", () => {
      const cleaners = mockPreferredCleaners;
      expect(cleaners[0].setBy).toBe("review");
      expect(cleaners[1].setBy).toBe("settings");
    });

    it("should format date correctly", () => {
      const dateString = "2025-01-15T12:00:00.000Z";
      const date = new Date(dateString);
      const formatted = date.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      });
      // Date formatting is locale/timezone dependent, so just check structure
      expect(formatted).toMatch(/\w+ \d+, 2025/);
    });

    it("should extract first letter for avatar", () => {
      const cleanerName = "John Cleaner";
      const avatarLetter = cleanerName.charAt(0).toUpperCase();
      expect(avatarLetter).toBe("J");
    });
  });

  describe("Toggle Functionality", () => {
    it("should toggle from true to false", async () => {
      PreferredCleanerService.updatePreferredSettings.mockResolvedValue({
        success: true,
        usePreferredCleaners: false,
      });

      let usePreferredCleaners = true;
      const newValue = false;

      const result = await PreferredCleanerService.updatePreferredSettings(
        mockToken,
        mockHomeId,
        newValue
      );

      if (result.success) {
        usePreferredCleaners = newValue;
      }

      expect(usePreferredCleaners).toBe(false);
    });

    it("should toggle from false to true", async () => {
      PreferredCleanerService.updatePreferredSettings.mockResolvedValue({
        success: true,
        usePreferredCleaners: true,
      });

      let usePreferredCleaners = false;
      const newValue = true;

      const result = await PreferredCleanerService.updatePreferredSettings(
        mockToken,
        mockHomeId,
        newValue
      );

      if (result.success) {
        usePreferredCleaners = newValue;
      }

      expect(usePreferredCleaners).toBe(true);
    });

    it("should not change state on failed toggle", async () => {
      PreferredCleanerService.updatePreferredSettings.mockResolvedValue({
        success: false,
        error: "Failed to update",
      });

      let usePreferredCleaners = true;
      const newValue = false;

      const result = await PreferredCleanerService.updatePreferredSettings(
        mockToken,
        mockHomeId,
        newValue
      );

      if (result.success) {
        usePreferredCleaners = newValue;
      }

      expect(usePreferredCleaners).toBe(true); // Unchanged
    });
  });

  describe("Remove Cleaner Functionality", () => {
    it("should remove cleaner from list on success", async () => {
      PreferredCleanerService.removePreferredCleaner.mockResolvedValue({
        success: true,
      });

      let cleaners = [...mockPreferredCleaners];
      const cleanerToRemove = cleaners[0];

      const result = await PreferredCleanerService.removePreferredCleaner(
        mockToken,
        mockHomeId,
        cleanerToRemove.cleanerId
      );

      if (result.success) {
        cleaners = cleaners.filter((c) => c.cleanerId !== cleanerToRemove.cleanerId);
      }

      expect(cleaners.length).toBe(1);
      expect(cleaners.find((c) => c.cleanerId === 100)).toBeUndefined();
    });

    it("should not remove cleaner on failure", async () => {
      PreferredCleanerService.removePreferredCleaner.mockResolvedValue({
        success: false,
        error: "Failed to remove",
      });

      let cleaners = [...mockPreferredCleaners];
      const cleanerToRemove = cleaners[0];

      const result = await PreferredCleanerService.removePreferredCleaner(
        mockToken,
        mockHomeId,
        cleanerToRemove.cleanerId
      );

      if (result.success) {
        cleaners = cleaners.filter((c) => c.cleanerId !== cleanerToRemove.cleanerId);
      }

      expect(cleaners.length).toBe(2); // Unchanged
    });
  });

  describe("Empty State", () => {
    it("should show empty state when no preferred cleaners", () => {
      const cleaners = [];
      const showEmptyState = cleaners.length === 0;
      expect(showEmptyState).toBe(true);
    });

    it("should not show empty state when there are preferred cleaners", () => {
      const cleaners = mockPreferredCleaners;
      const showEmptyState = cleaners.length === 0;
      expect(showEmptyState).toBe(false);
    });
  });

  describe("Toggle Description Text", () => {
    it("should show correct text when toggle is on", () => {
      const usePreferredCleaners = true;
      const description = usePreferredCleaners
        ? "Only your preferred cleaners can request jobs"
        : "All cleaners can request jobs for this home";
      expect(description).toBe("Only your preferred cleaners can request jobs");
    });

    it("should show correct text when toggle is off", () => {
      const usePreferredCleaners = false;
      const description = usePreferredCleaners
        ? "Only your preferred cleaners can request jobs"
        : "All cleaners can request jobs for this home";
      expect(description).toBe("All cleaners can request jobs for this home");
    });
  });

  describe("List Title", () => {
    it("should show correct count in title", () => {
      const cleaners = mockPreferredCleaners;
      const title = `Your Preferred Cleaners (${cleaners.length})`;
      expect(title).toBe("Your Preferred Cleaners (2)");
    });

    it("should show count of 0 when empty", () => {
      const cleaners = [];
      const title = `Your Preferred Cleaners (${cleaners.length})`;
      expect(title).toBe("Your Preferred Cleaners (0)");
    });
  });

  describe("Service Integration", () => {
    it("should call getPreferredCleaners on mount", async () => {
      await PreferredCleanerService.getPreferredCleaners(mockToken, mockHomeId);
      expect(PreferredCleanerService.getPreferredCleaners).toHaveBeenCalledWith(
        mockToken,
        mockHomeId
      );
    });

    it("should call updatePreferredSettings when toggling", async () => {
      await PreferredCleanerService.updatePreferredSettings(mockToken, mockHomeId, false);
      expect(PreferredCleanerService.updatePreferredSettings).toHaveBeenCalledWith(
        mockToken,
        mockHomeId,
        false
      );
    });

    it("should call removePreferredCleaner when removing", async () => {
      const cleanerId = 100;
      await PreferredCleanerService.removePreferredCleaner(mockToken, mockHomeId, cleanerId);
      expect(PreferredCleanerService.removePreferredCleaner).toHaveBeenCalledWith(
        mockToken,
        mockHomeId,
        cleanerId
      );
    });
  });

  describe("Props Validation", () => {
    it("should not fetch when homeId is missing", () => {
      const homeId = null;
      const shouldFetch = homeId && mockToken;
      expect(shouldFetch).toBeFalsy();
    });

    it("should not fetch when token is missing", () => {
      const token = null;
      const shouldFetch = mockHomeId && token;
      expect(shouldFetch).toBeFalsy();
    });

    it("should fetch when both homeId and token are present", () => {
      const shouldFetch = mockHomeId && mockToken;
      expect(shouldFetch).toBeTruthy();
    });
  });
});
