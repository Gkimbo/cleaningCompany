/**
 * LowStorageWarning Component Tests
 *
 * Tests for the low storage warning component that alerts users
 * when device storage is running low in offline mode.
 */

import React from "react";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react-native";

// Mock react-router-native
const mockNavigate = jest.fn();
jest.mock("react-router-native", () => ({
  useNavigate: () => mockNavigate,
}));

// Mock OfflineContext
let mockIsOnline = true;
let mockPendingSyncCount = 3;
const mockUpdateSyncStatus = jest.fn();

jest.mock("../../../src/services/offline/OfflineContext", () => ({
  useOffline: jest.fn(() => ({
    isOnline: mockIsOnline,
    pendingSyncCount: mockPendingSyncCount,
    updateSyncStatus: mockUpdateSyncStatus,
  })),
}));

// Mock PhotoStorage
jest.mock("../../../src/services/offline/PhotoStorage", () => ({
  __esModule: true,
  default: {
    checkStorageSpace: jest.fn().mockResolvedValue({
      freeBytes: 200 * 1024 * 1024,
      hasMinimumSpace: true,
      isLowSpace: false,
      canSavePhoto: true,
      formattedFree: "200 MB",
    }),
  },
}));

// Mock StorageManager
jest.mock("../../../src/services/offline/StorageManager", () => ({
  __esModule: true,
  default: {
    runCleanup: jest.fn().mockResolvedValue({
      cleanedJobs: 2,
      cleanedPhotos: 5,
      cleanedSyncQueue: 3,
      cleanedConflicts: 1,
      errors: [],
    }),
    subscribe: jest.fn(() => jest.fn()),
  },
}));

// Mock SyncEngine
jest.mock("../../../src/services/offline/SyncEngine", () => ({
  __esModule: true,
  default: {
    startSync: jest.fn().mockResolvedValue({ success: true }),
  },
}));

// Mock database
jest.mock("../../../src/services/offline/database", () => ({
  isOfflineAvailable: true,
}));

// Import after mocks
import LowStorageWarning from "../../../src/components/offline/LowStorageWarning";
import { useOffline } from "../../../src/services/offline/OfflineContext";
import PhotoStorage from "../../../src/services/offline/PhotoStorage";
import StorageManager from "../../../src/services/offline/StorageManager";
import SyncEngine from "../../../src/services/offline/SyncEngine";

describe("LowStorageWarning", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockIsOnline = true;
    mockPendingSyncCount = 3;

    // Reset mock implementations
    useOffline.mockImplementation(() => ({
      isOnline: mockIsOnline,
      pendingSyncCount: mockPendingSyncCount,
      updateSyncStatus: mockUpdateSyncStatus,
    }));

    // Default: sufficient storage
    PhotoStorage.checkStorageSpace.mockResolvedValue({
      freeBytes: 200 * 1024 * 1024, // 200MB
      hasMinimumSpace: true,
      isLowSpace: false,
      canSavePhoto: true,
      formattedFree: "200 MB",
    });

    StorageManager.runCleanup.mockResolvedValue({
      cleanedJobs: 2,
      cleanedPhotos: 5,
      cleanedSyncQueue: 3,
      cleanedConflicts: 1,
      errors: [],
    });

    SyncEngine.startSync.mockResolvedValue({ success: true });
  });

  describe("rendering", () => {
    it("should not render when storage is sufficient", async () => {
      render(<LowStorageWarning />);

      // Wait for storage check
      await waitFor(() => {
        expect(PhotoStorage.checkStorageSpace).toHaveBeenCalled();
      });

      // Should not show any warning
      expect(screen.queryByText("Low Storage")).toBeNull();
      expect(screen.queryByText("Storage Critical")).toBeNull();
    });

    it("should render warning banner when storage is low", async () => {
      PhotoStorage.checkStorageSpace.mockResolvedValue({
        freeBytes: 80 * 1024 * 1024, // 80MB - below warning threshold
        hasMinimumSpace: true,
        isLowSpace: true,
        canSavePhoto: true,
        formattedFree: "80 MB",
      });

      render(<LowStorageWarning />);

      await waitFor(() => {
        expect(screen.getByText("Low Storage")).toBeTruthy();
      });

      expect(screen.getByText(/80 MB free/i)).toBeTruthy();
    });

    it("should render critical banner when storage is critically low", async () => {
      PhotoStorage.checkStorageSpace.mockResolvedValue({
        freeBytes: 30 * 1024 * 1024, // 30MB - below minimum
        hasMinimumSpace: false,
        isLowSpace: true,
        canSavePhoto: false,
        formattedFree: "30 MB",
      });

      render(<LowStorageWarning />);

      await waitFor(() => {
        expect(screen.getByText("Storage Critical")).toBeTruthy();
      });

      expect(screen.getByText(/Cannot save new photos/i)).toBeTruthy();
    });

    it("should show tap hint on banner", async () => {
      PhotoStorage.checkStorageSpace.mockResolvedValue({
        freeBytes: 80 * 1024 * 1024,
        hasMinimumSpace: true,
        isLowSpace: true,
        canSavePhoto: true,
        formattedFree: "80 MB",
      });

      render(<LowStorageWarning />);

      await waitFor(() => {
        expect(screen.getByText("Tap for options")).toBeTruthy();
      });
    });
  });

  describe("modal interaction", () => {
    beforeEach(() => {
      PhotoStorage.checkStorageSpace.mockResolvedValue({
        freeBytes: 80 * 1024 * 1024,
        hasMinimumSpace: true,
        isLowSpace: true,
        canSavePhoto: true,
        formattedFree: "80 MB",
      });
    });

    it("should open modal when banner is tapped", async () => {
      render(<LowStorageWarning />);

      await waitFor(() => {
        expect(screen.getByText("Low Storage")).toBeTruthy();
      });

      fireEvent.press(screen.getByText("Low Storage"));

      await waitFor(() => {
        expect(screen.getByText("Low Storage Warning")).toBeTruthy();
      });
    });

    it("should show pending sync count in modal", async () => {
      mockPendingSyncCount = 5;
      useOffline.mockImplementation(() => ({
        isOnline: mockIsOnline,
        pendingSyncCount: 5,
        updateSyncStatus: mockUpdateSyncStatus,
      }));

      render(<LowStorageWarning />);

      await waitFor(() => {
        expect(screen.getByText("Low Storage")).toBeTruthy();
      });

      fireEvent.press(screen.getByText("Low Storage"));

      await waitFor(() => {
        expect(screen.getByText(/5 items waiting to sync/i)).toBeTruthy();
      });
    });

    it("should show Sync Now button when online with pending items", async () => {
      render(<LowStorageWarning />);

      await waitFor(() => {
        expect(screen.getByText("Low Storage")).toBeTruthy();
      });

      fireEvent.press(screen.getByText("Low Storage"));

      await waitFor(() => {
        expect(screen.getByText("Sync Now")).toBeTruthy();
      });
    });

    it("should not show Sync Now button when offline", async () => {
      mockIsOnline = false;
      useOffline.mockImplementation(() => ({
        isOnline: false,
        pendingSyncCount: mockPendingSyncCount,
        updateSyncStatus: mockUpdateSyncStatus,
      }));

      render(<LowStorageWarning />);

      await waitFor(() => {
        expect(screen.getByText("Low Storage")).toBeTruthy();
      });

      fireEvent.press(screen.getByText("Low Storage"));

      await waitFor(() => {
        expect(screen.queryByText("Sync Now")).toBeNull();
        expect(screen.getByText(/Connect to the internet/i)).toBeTruthy();
      });
    });

    it("should show Clean Up Old Data button", async () => {
      render(<LowStorageWarning />);

      await waitFor(() => {
        expect(screen.getByText("Low Storage")).toBeTruthy();
      });

      fireEvent.press(screen.getByText("Low Storage"));

      await waitFor(() => {
        expect(screen.getByText("Clean Up Old Data")).toBeTruthy();
      });
    });

    it("should show Clear All Offline Data button", async () => {
      render(<LowStorageWarning />);

      await waitFor(() => {
        expect(screen.getByText("Low Storage")).toBeTruthy();
      });

      fireEvent.press(screen.getByText("Low Storage"));

      await waitFor(() => {
        expect(screen.getByText("Clear All Offline Data")).toBeTruthy();
      });
    });

    it("should close modal when Dismiss is pressed", async () => {
      render(<LowStorageWarning />);

      await waitFor(() => {
        expect(screen.getByText("Low Storage")).toBeTruthy();
      });

      fireEvent.press(screen.getByText("Low Storage"));

      await waitFor(() => {
        expect(screen.getByText("Low Storage Warning")).toBeTruthy();
      });

      fireEvent.press(screen.getByText("Dismiss"));

      await waitFor(() => {
        expect(screen.queryByText("Low Storage Warning")).toBeNull();
      });
    });
  });

  describe("sync functionality", () => {
    beforeEach(() => {
      PhotoStorage.checkStorageSpace.mockResolvedValue({
        freeBytes: 80 * 1024 * 1024,
        hasMinimumSpace: true,
        isLowSpace: true,
        canSavePhoto: true,
        formattedFree: "80 MB",
      });
    });

    it("should call SyncEngine.startSync when Sync Now is pressed", async () => {
      render(<LowStorageWarning />);

      await waitFor(() => {
        expect(screen.getByText("Low Storage")).toBeTruthy();
      });

      fireEvent.press(screen.getByText("Low Storage"));

      await waitFor(() => {
        expect(screen.getByText("Sync Now")).toBeTruthy();
      });

      fireEvent.press(screen.getByText("Sync Now"));

      await waitFor(() => {
        expect(SyncEngine.startSync).toHaveBeenCalled();
      });
    });

    it("should run cleanup after successful sync", async () => {
      render(<LowStorageWarning />);

      await waitFor(() => {
        expect(screen.getByText("Low Storage")).toBeTruthy();
      });

      fireEvent.press(screen.getByText("Low Storage"));
      fireEvent.press(screen.getByText("Sync Now"));

      await waitFor(() => {
        expect(StorageManager.runCleanup).toHaveBeenCalled();
      });
    });

    it("should update sync status during sync", async () => {
      render(<LowStorageWarning />);

      await waitFor(() => {
        expect(screen.getByText("Low Storage")).toBeTruthy();
      });

      fireEvent.press(screen.getByText("Low Storage"));
      fireEvent.press(screen.getByText("Sync Now"));

      await waitFor(() => {
        expect(mockUpdateSyncStatus).toHaveBeenCalledWith("syncing");
      });
    });
  });

  describe("cleanup functionality", () => {
    beforeEach(() => {
      PhotoStorage.checkStorageSpace.mockResolvedValue({
        freeBytes: 80 * 1024 * 1024,
        hasMinimumSpace: true,
        isLowSpace: true,
        canSavePhoto: true,
        formattedFree: "80 MB",
      });
    });

    it("should call StorageManager.runCleanup when Clean Up is pressed", async () => {
      render(<LowStorageWarning />);

      await waitFor(() => {
        expect(screen.getByText("Low Storage")).toBeTruthy();
      });

      fireEvent.press(screen.getByText("Low Storage"));

      await waitFor(() => {
        expect(screen.getByText("Clean Up Old Data")).toBeTruthy();
      });

      fireEvent.press(screen.getByText("Clean Up Old Data"));

      await waitFor(() => {
        expect(StorageManager.runCleanup).toHaveBeenCalled();
      });
    });

    it("should show cleanup result message", async () => {
      render(<LowStorageWarning />);

      await waitFor(() => {
        expect(screen.getByText("Low Storage")).toBeTruthy();
      });

      fireEvent.press(screen.getByText("Low Storage"));
      fireEvent.press(screen.getByText("Clean Up Old Data"));

      await waitFor(() => {
        // 2 + 5 + 3 + 1 = 11 items cleaned
        expect(screen.getByText("Cleaned 11 items")).toBeTruthy();
      });
    });

    it("should show 'No items to clean up' when nothing cleaned", async () => {
      StorageManager.runCleanup.mockResolvedValue({
        cleanedJobs: 0,
        cleanedPhotos: 0,
        cleanedSyncQueue: 0,
        cleanedConflicts: 0,
        errors: [],
      });

      render(<LowStorageWarning />);

      await waitFor(() => {
        expect(screen.getByText("Low Storage")).toBeTruthy();
      });

      fireEvent.press(screen.getByText("Low Storage"));
      fireEvent.press(screen.getByText("Clean Up Old Data"));

      await waitFor(() => {
        expect(screen.getByText("No items to clean up")).toBeTruthy();
      });
    });

    it("should show error message when cleanup fails", async () => {
      StorageManager.runCleanup.mockRejectedValue(new Error("Cleanup failed"));

      render(<LowStorageWarning />);

      await waitFor(() => {
        expect(screen.getByText("Low Storage")).toBeTruthy();
      });

      fireEvent.press(screen.getByText("Low Storage"));
      fireEvent.press(screen.getByText("Clean Up Old Data"));

      await waitFor(() => {
        expect(screen.getByText("Cleanup failed")).toBeTruthy();
      });
    });
  });

  describe("navigation to settings", () => {
    beforeEach(() => {
      PhotoStorage.checkStorageSpace.mockResolvedValue({
        freeBytes: 80 * 1024 * 1024,
        hasMinimumSpace: true,
        isLowSpace: true,
        canSavePhoto: true,
        formattedFree: "80 MB",
      });
    });

    it("should navigate to account settings when Clear All Offline Data is pressed", async () => {
      render(<LowStorageWarning />);

      await waitFor(() => {
        expect(screen.getByText("Low Storage")).toBeTruthy();
      });

      fireEvent.press(screen.getByText("Low Storage"));

      await waitFor(() => {
        expect(screen.getByText("Clear All Offline Data")).toBeTruthy();
      });

      fireEvent.press(screen.getByText("Clear All Offline Data"));

      expect(mockNavigate).toHaveBeenCalledWith("/account-settings");
    });

    it("should close modal when navigating to settings", async () => {
      render(<LowStorageWarning />);

      await waitFor(() => {
        expect(screen.getByText("Low Storage")).toBeTruthy();
      });

      fireEvent.press(screen.getByText("Low Storage"));
      fireEvent.press(screen.getByText("Clear All Offline Data"));

      await waitFor(() => {
        expect(screen.queryByText("Low Storage Warning")).toBeNull();
      });
    });
  });

  describe("critical storage modal", () => {
    it("should auto-open modal when storage is critically low", async () => {
      PhotoStorage.checkStorageSpace.mockResolvedValue({
        freeBytes: 30 * 1024 * 1024, // 30MB - critical
        hasMinimumSpace: false,
        isLowSpace: true,
        canSavePhoto: false,
        formattedFree: "30 MB",
      });

      render(<LowStorageWarning />);

      await waitFor(() => {
        expect(screen.getByText("Storage Full")).toBeTruthy();
      });

      expect(screen.getByText(/won't be able to take new photos/i)).toBeTruthy();
    });
  });

  describe("storage check failure handling", () => {
    it("should not show warning when storage check fails", async () => {
      PhotoStorage.checkStorageSpace.mockResolvedValue({
        freeBytes: null,
        hasMinimumSpace: false,
        isLowSpace: true,
        canSavePhoto: false,
        formattedFree: "Unknown",
        checkFailed: true,
        error: "Permission denied",
      });

      render(<LowStorageWarning />);

      await waitFor(() => {
        expect(PhotoStorage.checkStorageSpace).toHaveBeenCalled();
      });

      // Should not show warning when check failed (avoid false alarms)
      expect(screen.queryByText("Low Storage")).toBeNull();
      expect(screen.queryByText("Storage Critical")).toBeNull();
    });
  });

  describe("storage manager subscription", () => {
    it("should subscribe to StorageManager updates", async () => {
      render(<LowStorageWarning />);

      await waitFor(() => {
        expect(StorageManager.subscribe).toHaveBeenCalled();
      });
    });

    it("should unsubscribe on unmount", async () => {
      const mockUnsubscribe = jest.fn();
      StorageManager.subscribe.mockReturnValue(mockUnsubscribe);

      const { unmount } = render(<LowStorageWarning />);

      await waitFor(() => {
        expect(StorageManager.subscribe).toHaveBeenCalled();
      });

      unmount();

      expect(mockUnsubscribe).toHaveBeenCalled();
    });
  });
});
