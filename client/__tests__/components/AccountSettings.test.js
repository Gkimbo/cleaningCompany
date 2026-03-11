/**
 * AccountSettings Component Tests
 *
 * Tests for the Account Settings component, with focus on the
 * Clear Offline Data feature.
 */

import React from "react";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react-native";
import { Alert } from "react-native";

// Mock Alert
jest.spyOn(Alert, "alert");

// Mock fetch
global.fetch = jest.fn(() =>
  Promise.resolve({
    ok: true,
    json: () => Promise.resolve({}),
  })
);

// Mock expo-location
jest.mock("expo-location", () => ({
  requestForegroundPermissionsAsync: jest.fn().mockResolvedValue({ status: "granted" }),
  getCurrentPositionAsync: jest.fn().mockResolvedValue({
    coords: { latitude: 40.7128, longitude: -74.006 },
  }),
  reverseGeocodeAsync: jest.fn().mockResolvedValue([
    { city: "New York", region: "NY", postalCode: "10001" },
  ]),
  geocodeAsync: jest.fn().mockResolvedValue([
    { latitude: 40.7128, longitude: -74.006 },
  ]),
  Accuracy: { Balanced: 3 },
}));

// Mock expo-image-picker
jest.mock("expo-image-picker", () => ({
  requestMediaLibraryPermissionsAsync: jest.fn().mockResolvedValue({ status: "granted" }),
  launchImageLibraryAsync: jest.fn().mockResolvedValue({ canceled: true }),
  MediaTypeOptions: { Images: "images" },
}));

// Mock FetchData
jest.mock("../../src/services/fetchRequests/fetchData", () => ({
  updateUsername: jest.fn().mockResolvedValue({ success: true }),
  updateEmail: jest.fn().mockResolvedValue({ success: true }),
  updatePhone: jest.fn().mockResolvedValue({ success: true, phone: "555-555-5555" }),
  updatePassword: jest.fn().mockResolvedValue({ success: true }),
  getServiceArea: jest.fn().mockResolvedValue({ serviceArea: null }),
  updateServiceArea: jest.fn().mockResolvedValue({ success: true, serviceArea: {} }),
  post: jest.fn().mockResolvedValue({ success: true }),
}));

// Mock OwnerDashboardService
jest.mock("../../src/services/fetchRequests/OwnerDashboardService", () => ({
  getSettings: jest.fn().mockResolvedValue({
    notificationEmail: null,
    effectiveNotificationEmail: "owner@test.com",
  }),
  updateNotificationEmail: jest.fn().mockResolvedValue({ success: true }),
}));

// Mock getCurrentUser
jest.mock("../../src/services/fetchRequests/getCurrentUser", () =>
  jest.fn().mockResolvedValue({
    username: "testuser",
    email: "test@test.com",
    phone: "555-555-5555",
  })
);

// Mock offline database functions
jest.mock("../../src/services/offline/database", () => ({
  resetDatabase: jest.fn().mockResolvedValue(undefined),
  isOfflineAvailable: true,
}));

// Mock StorageManager
jest.mock("../../src/services/offline/StorageManager", () => ({
  __esModule: true,
  default: {
    getStorageStats: jest.fn().mockResolvedValue({
      health: "good",
      healthMessage: "Storage healthy (5.2MB)",
      photoStorageBytes: 5 * 1024 * 1024,
      photoStorageFormatted: "5.2 MB",
      totalPhotoCount: 25,
      pendingPhotoCount: 5,
      uploadedPhotoCount: 20,
      jobCount: 10,
      checklistItemCount: 50,
      syncQueueCount: 8,
      pendingSyncCount: 3,
      conflictCount: 1,
      unresolvedConflictCount: 0,
    }),
    subscribe: jest.fn(() => () => {}),
  },
}));

// Import after mocks
import AccountSettings from "../../src/components/account/AccountSettings";
import { resetDatabase, isOfflineAvailable } from "../../src/services/offline/database";
import StorageManager from "../../src/services/offline/StorageManager";

describe("AccountSettings", () => {
  const mockDispatch = jest.fn();
  const defaultState = {
    currentUser: {
      token: "test-token",
      user: {
        id: 1,
        username: "testuser",
        email: "test@test.com",
        phone: "555-555-5555",
      },
    },
    account: "cleaner",
    isBusinessOwner: false,
    businessName: "",
    businessLogo: null,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    Alert.alert.mockClear();

    // Reset storage stats mock to default
    StorageManager.getStorageStats.mockResolvedValue({
      health: "good",
      healthMessage: "Storage healthy (5.2MB)",
      photoStorageBytes: 5 * 1024 * 1024,
      photoStorageFormatted: "5.2 MB",
      totalPhotoCount: 25,
      pendingPhotoCount: 5,
      uploadedPhotoCount: 20,
      jobCount: 10,
      checklistItemCount: 50,
      syncQueueCount: 8,
      pendingSyncCount: 3,
      conflictCount: 1,
      unresolvedConflictCount: 0,
    });
  });

  describe("Offline Data Storage Section", () => {
    describe("rendering", () => {
      it("should render the offline data storage section", async () => {
        render(<AccountSettings state={defaultState} dispatch={mockDispatch} />);

        await waitFor(() => {
          expect(screen.getByText("Offline Data Storage")).toBeTruthy();
        });
      });

      it("should show section description", async () => {
        render(<AccountSettings state={defaultState} dispatch={mockDispatch} />);

        await waitFor(() => {
          expect(
            screen.getByText(/The app stores data locally for offline use/i)
          ).toBeTruthy();
        });
      });

      it("should show the clear button", async () => {
        render(<AccountSettings state={defaultState} dispatch={mockDispatch} />);

        await waitFor(() => {
          expect(screen.getByText("Clear All Offline Data")).toBeTruthy();
        });
      });

      it("should show warning message about data loss", async () => {
        render(<AccountSettings state={defaultState} dispatch={mockDispatch} />);

        await waitFor(() => {
          expect(
            screen.getByText(/Clearing offline data will remove all cached information/i)
          ).toBeTruthy();
        });
      });
    });

    describe("storage statistics display", () => {
      it("should fetch and display storage stats on mount", async () => {
        render(<AccountSettings state={defaultState} dispatch={mockDispatch} />);

        await waitFor(() => {
          expect(StorageManager.getStorageStats).toHaveBeenCalled();
        });

        await waitFor(() => {
          // Storage is displayed as "5.2 MB (25 files)"
          expect(screen.getByText(/5\.2 MB/)).toBeTruthy();
        });
      });

      it("should display photo count", async () => {
        render(<AccountSettings state={defaultState} dispatch={mockDispatch} />);

        await waitFor(() => {
          expect(screen.getByText(/25 files/)).toBeTruthy();
        });
      });

      it("should display cached jobs count", async () => {
        render(<AccountSettings state={defaultState} dispatch={mockDispatch} />);

        await waitFor(() => {
          // Look for the job count in the stats
          const jobCountText = screen.getByText("10");
          expect(jobCountText).toBeTruthy();
        });
      });

      it("should display pending sync operations", async () => {
        render(<AccountSettings state={defaultState} dispatch={mockDispatch} />);

        await waitFor(() => {
          expect(screen.getByText(/3 operations/)).toBeTruthy();
        });
      });

      it("should display storage health status - good", async () => {
        render(<AccountSettings state={defaultState} dispatch={mockDispatch} />);

        await waitFor(() => {
          expect(screen.getByText(/Storage healthy/i)).toBeTruthy();
        });
      });

      it("should display storage health status - warning", async () => {
        StorageManager.getStorageStats.mockResolvedValue({
          health: "warning",
          healthMessage: "Storage high (150MB). Consider syncing soon.",
          photoStorageBytes: 150 * 1024 * 1024,
          photoStorageFormatted: "150 MB",
          totalPhotoCount: 100,
          pendingPhotoCount: 50,
          uploadedPhotoCount: 50,
          jobCount: 30,
          pendingSyncCount: 10,
        });

        render(<AccountSettings state={defaultState} dispatch={mockDispatch} />);

        await waitFor(() => {
          expect(screen.getByText(/Storage high/i)).toBeTruthy();
        });
      });

      it("should display storage health status - critical", async () => {
        StorageManager.getStorageStats.mockResolvedValue({
          health: "critical",
          healthMessage: "Storage critical (250MB). Please sync and cleanup.",
          photoStorageBytes: 250 * 1024 * 1024,
          photoStorageFormatted: "250 MB",
          totalPhotoCount: 200,
          pendingPhotoCount: 100,
          uploadedPhotoCount: 100,
          jobCount: 50,
          pendingSyncCount: 25,
        });

        render(<AccountSettings state={defaultState} dispatch={mockDispatch} />);

        await waitFor(() => {
          expect(screen.getByText(/Storage critical/i)).toBeTruthy();
        });
      });
    });

    describe("clear data confirmation", () => {
      it("should show confirmation alert when clear button is pressed", async () => {
        render(<AccountSettings state={defaultState} dispatch={mockDispatch} />);

        await waitFor(() => {
          expect(screen.getByText("Clear All Offline Data")).toBeTruthy();
        });

        fireEvent.press(screen.getByText("Clear All Offline Data"));

        expect(Alert.alert).toHaveBeenCalledWith(
          "Clear Offline Data",
          expect.stringContaining("This will permanently delete all offline data"),
          expect.arrayContaining([
            expect.objectContaining({ text: "Cancel", style: "cancel" }),
            expect.objectContaining({ text: "Clear All Data", style: "destructive" }),
          ])
        );
      });

      it("should mention cached jobs in confirmation message", async () => {
        render(<AccountSettings state={defaultState} dispatch={mockDispatch} />);

        await waitFor(() => {
          expect(screen.getByText("Clear All Offline Data")).toBeTruthy();
        });

        fireEvent.press(screen.getByText("Clear All Offline Data"));

        expect(Alert.alert).toHaveBeenCalledWith(
          expect.any(String),
          expect.stringContaining("Cached jobs and assignments"),
          expect.any(Array)
        );
      });

      it("should mention photos in confirmation message", async () => {
        render(<AccountSettings state={defaultState} dispatch={mockDispatch} />);

        await waitFor(() => {
          expect(screen.getByText("Clear All Offline Data")).toBeTruthy();
        });

        fireEvent.press(screen.getByText("Clear All Offline Data"));

        expect(Alert.alert).toHaveBeenCalledWith(
          expect.any(String),
          expect.stringContaining("Photos not yet uploaded"),
          expect.any(Array)
        );
      });

      it("should mention pending sync operations in confirmation message", async () => {
        render(<AccountSettings state={defaultState} dispatch={mockDispatch} />);

        await waitFor(() => {
          expect(screen.getByText("Clear All Offline Data")).toBeTruthy();
        });

        fireEvent.press(screen.getByText("Clear All Offline Data"));

        expect(Alert.alert).toHaveBeenCalledWith(
          expect.any(String),
          expect.stringContaining("Pending sync operations"),
          expect.any(Array)
        );
      });

      it("should mention offline messages in confirmation message", async () => {
        render(<AccountSettings state={defaultState} dispatch={mockDispatch} />);

        await waitFor(() => {
          expect(screen.getByText("Clear All Offline Data")).toBeTruthy();
        });

        fireEvent.press(screen.getByText("Clear All Offline Data"));

        expect(Alert.alert).toHaveBeenCalledWith(
          expect.any(String),
          expect.stringContaining("Offline messages"),
          expect.any(Array)
        );
      });

      it("should warn that action cannot be undone", async () => {
        render(<AccountSettings state={defaultState} dispatch={mockDispatch} />);

        await waitFor(() => {
          expect(screen.getByText("Clear All Offline Data")).toBeTruthy();
        });

        fireEvent.press(screen.getByText("Clear All Offline Data"));

        expect(Alert.alert).toHaveBeenCalledWith(
          expect.any(String),
          expect.stringContaining("cannot be undone"),
          expect.any(Array)
        );
      });
    });

    describe("clear data functionality", () => {
      it("should call resetDatabase when user confirms", async () => {
        render(<AccountSettings state={defaultState} dispatch={mockDispatch} />);

        await waitFor(() => {
          expect(screen.getByText("Clear All Offline Data")).toBeTruthy();
        });

        fireEvent.press(screen.getByText("Clear All Offline Data"));

        // Get the "Clear All Data" button callback from Alert.alert
        const alertCalls = Alert.alert.mock.calls;
        expect(alertCalls.length).toBe(1);

        const [, , buttons] = alertCalls[0];
        const clearButton = buttons.find((b) => b.text === "Clear All Data");
        expect(clearButton).toBeDefined();

        // Call the onPress callback
        await act(async () => {
          await clearButton.onPress();
        });

        expect(resetDatabase).toHaveBeenCalled();
      });

      it("should NOT call resetDatabase when user cancels", async () => {
        render(<AccountSettings state={defaultState} dispatch={mockDispatch} />);

        await waitFor(() => {
          expect(screen.getByText("Clear All Offline Data")).toBeTruthy();
        });

        fireEvent.press(screen.getByText("Clear All Offline Data"));

        // Get the Cancel button callback
        const [, , buttons] = Alert.alert.mock.calls[0];
        const cancelButton = buttons.find((b) => b.text === "Cancel");

        // Cancel button should not have an onPress or it should do nothing
        if (cancelButton.onPress) {
          cancelButton.onPress();
        }

        expect(resetDatabase).not.toHaveBeenCalled();
      });

      it("should show success message after clearing data", async () => {
        render(<AccountSettings state={defaultState} dispatch={mockDispatch} />);

        await waitFor(() => {
          expect(screen.getByText("Clear All Offline Data")).toBeTruthy();
        });

        fireEvent.press(screen.getByText("Clear All Offline Data"));

        const [, , buttons] = Alert.alert.mock.calls[0];
        const clearButton = buttons.find((b) => b.text === "Clear All Data");

        await act(async () => {
          await clearButton.onPress();
        });

        await waitFor(() => {
          expect(
            screen.getByText(/All offline data has been cleared successfully/i)
          ).toBeTruthy();
        });
      });

      it("should refresh storage stats after clearing", async () => {
        render(<AccountSettings state={defaultState} dispatch={mockDispatch} />);

        await waitFor(() => {
          expect(screen.getByText("Clear All Offline Data")).toBeTruthy();
        });

        // Record initial call count
        const initialCallCount = StorageManager.getStorageStats.mock.calls.length;
        expect(initialCallCount).toBeGreaterThanOrEqual(1);

        fireEvent.press(screen.getByText("Clear All Offline Data"));

        const [, , buttons] = Alert.alert.mock.calls[0];
        const clearButton = buttons.find((b) => b.text === "Clear All Data");

        await act(async () => {
          await clearButton.onPress();
        });

        // Wait for the refresh (has a setTimeout)
        await waitFor(
          () => {
            // Should be called at least once more after clearing
            expect(StorageManager.getStorageStats.mock.calls.length).toBeGreaterThan(initialCallCount);
          },
          { timeout: 1000 }
        );
      });

      it("should show error message when clearing fails", async () => {
        resetDatabase.mockRejectedValueOnce(new Error("Database error"));

        render(<AccountSettings state={defaultState} dispatch={mockDispatch} />);

        await waitFor(() => {
          expect(screen.getByText("Clear All Offline Data")).toBeTruthy();
        });

        fireEvent.press(screen.getByText("Clear All Offline Data"));

        const [, , buttons] = Alert.alert.mock.calls[0];
        const clearButton = buttons.find((b) => b.text === "Clear All Data");

        await act(async () => {
          await clearButton.onPress();
        });

        await waitFor(() => {
          expect(
            screen.getByText(/Failed to clear offline data/i)
          ).toBeTruthy();
        });
      });
    });

    describe("availability across user types", () => {
      it("should show offline section for cleaner users", async () => {
        const cleanerState = { ...defaultState, account: "cleaner" };
        render(<AccountSettings state={cleanerState} dispatch={mockDispatch} />);

        await waitFor(() => {
          expect(screen.getByText("Offline Data Storage")).toBeTruthy();
        });
      });

      it("should show offline section for owner users", async () => {
        const ownerState = { ...defaultState, account: "owner" };
        render(<AccountSettings state={ownerState} dispatch={mockDispatch} />);

        await waitFor(() => {
          expect(screen.getByText("Offline Data Storage")).toBeTruthy();
        });
      });

      it("should show offline section for business owner users", async () => {
        const businessOwnerState = {
          ...defaultState,
          account: "cleaner",
          isBusinessOwner: true,
          businessName: "Test Cleaning Co",
        };
        render(<AccountSettings state={businessOwnerState} dispatch={mockDispatch} />);

        await waitFor(() => {
          expect(screen.getByText("Offline Data Storage")).toBeTruthy();
        });
      });

      it("should show offline section for client users", async () => {
        const clientState = { ...defaultState, account: "client" };
        render(<AccountSettings state={clientState} dispatch={mockDispatch} />);

        await waitFor(() => {
          expect(screen.getByText("Offline Data Storage")).toBeTruthy();
        });
      });
    });
  });

  describe("Other AccountSettings sections", () => {
    it("should render username section for non-owner users", async () => {
      render(<AccountSettings state={defaultState} dispatch={mockDispatch} />);

      await waitFor(() => {
        expect(screen.getByText("Change Username")).toBeTruthy();
      });
    });

    it("should not render username section for owner users", async () => {
      const ownerState = { ...defaultState, account: "owner" };
      render(<AccountSettings state={ownerState} dispatch={mockDispatch} />);

      await waitFor(() => {
        expect(screen.queryByText("Change Username")).toBeNull();
      });
    });

    it("should render password section", async () => {
      render(<AccountSettings state={defaultState} dispatch={mockDispatch} />);

      await waitFor(() => {
        expect(screen.getByText("Change Password")).toBeTruthy();
      });
    });

    it("should render phone section", async () => {
      render(<AccountSettings state={defaultState} dispatch={mockDispatch} />);

      await waitFor(() => {
        expect(screen.getByText("Change Phone Number")).toBeTruthy();
      });
    });

    it("should render security tips section", async () => {
      render(<AccountSettings state={defaultState} dispatch={mockDispatch} />);

      await waitFor(() => {
        expect(screen.getByText("Security Tips")).toBeTruthy();
      });
    });
  });
});
