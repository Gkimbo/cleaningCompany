/**
 * ManualSyncButton Component Tests
 *
 * Tests for the manual sync button UI component.
 */

import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react-native";

// Mock dependencies
jest.mock("../../../src/services/offline/SyncEngine", () => ({
  __esModule: true,
  default: {
    startSync: jest.fn().mockResolvedValue({ success: true, synced: 5 }),
    retryFailed: jest.fn().mockResolvedValue({ success: true, synced: 3 }),
  },
}));

jest.mock("../../../src/services/offline/constants", () => ({
  SYNC_STATUS: {
    IDLE: "idle",
    SYNCING: "syncing",
    COMPLETED: "completed",
    ERROR: "error",
  },
}));

const mockUpdateSyncStatus = jest.fn();
let mockSyncStatus = "idle";
let mockPendingSyncCount = 5;
let mockIsOffline = false;

jest.mock("../../../src/services/offline/OfflineContext", () => ({
  useNetworkStatus: jest.fn(() => ({
    isOnline: !mockIsOffline,
    isOffline: mockIsOffline,
  })),
  useSyncStatus: jest.fn(() => ({
    syncStatus: mockSyncStatus,
    pendingSyncCount: mockPendingSyncCount,
    updateSyncStatus: mockUpdateSyncStatus,
  })),
}));

// Import after mocks
import ManualSyncButton from "../../../src/components/offline/ManualSyncButton";
import SyncEngine from "../../../src/services/offline/SyncEngine";
import { useNetworkStatus, useSyncStatus } from "../../../src/services/offline/OfflineContext";

describe("ManualSyncButton", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSyncStatus = "idle";
    mockPendingSyncCount = 5;
    mockIsOffline = false;

    // Reset hook mocks with current values
    useNetworkStatus.mockImplementation(() => ({
      isOnline: !mockIsOffline,
      isOffline: mockIsOffline,
    }));
    useSyncStatus.mockImplementation(() => ({
      syncStatus: mockSyncStatus,
      pendingSyncCount: mockPendingSyncCount,
      updateSyncStatus: mockUpdateSyncStatus,
    }));
  });

  describe("rendering", () => {
    it("should render sync button when items pending", async () => {
      render(<ManualSyncButton />);

      await waitFor(() => {
        expect(screen.getByText(/Sync Now/i)).toBeTruthy();
      });
    });

    it("should show pending count", async () => {
      render(<ManualSyncButton />);

      await waitFor(() => {
        expect(screen.getByText(/5 items/)).toBeTruthy();
      });
    });
  });

  describe("sync functionality", () => {
    it("should call startSync when pressed", async () => {
      render(<ManualSyncButton />);

      await waitFor(() => {
        expect(screen.getByText(/Sync Now/i)).toBeTruthy();
      });

      fireEvent.press(screen.getByText(/Sync Now/i));

      await waitFor(() => {
        expect(SyncEngine.startSync).toHaveBeenCalled();
      });
    });

    it("should disable button while syncing", async () => {
      mockSyncStatus = "syncing";
      useSyncStatus.mockImplementation(() => ({
        syncStatus: mockSyncStatus,
        pendingSyncCount: mockPendingSyncCount,
        updateSyncStatus: mockUpdateSyncStatus,
      }));

      render(<ManualSyncButton />);

      await waitFor(() => {
        expect(screen.getByText(/Syncing/i)).toBeTruthy();
      });
    });

    it("should disable button when offline", async () => {
      mockIsOffline = true;
      useNetworkStatus.mockImplementation(() => ({
        isOnline: false,
        isOffline: true,
      }));

      render(<ManualSyncButton />);

      await waitFor(() => {
        expect(screen.getByText(/Offline/i)).toBeTruthy();
      });
    });
  });

  describe("retry functionality", () => {
    it("should show retry option when sync has error status", async () => {
      mockSyncStatus = "error";
      mockPendingSyncCount = 0;
      useSyncStatus.mockImplementation(() => ({
        syncStatus: mockSyncStatus,
        pendingSyncCount: mockPendingSyncCount,
        updateSyncStatus: mockUpdateSyncStatus,
      }));

      render(<ManualSyncButton />);

      await waitFor(() => {
        expect(screen.getByText(/Retry Sync/i)).toBeTruthy();
      });
    });

    it("should call retryFailed when retry pressed", async () => {
      mockSyncStatus = "error";
      mockPendingSyncCount = 3;
      useSyncStatus.mockImplementation(() => ({
        syncStatus: mockSyncStatus,
        pendingSyncCount: mockPendingSyncCount,
        updateSyncStatus: mockUpdateSyncStatus,
      }));

      render(<ManualSyncButton />);

      await waitFor(() => {
        expect(screen.getByText(/Retry Sync/i)).toBeTruthy();
      });

      fireEvent.press(screen.getByText(/Retry Sync/i));

      await waitFor(() => {
        expect(SyncEngine.retryFailed).toHaveBeenCalled();
      });
    });
  });

  describe("success/error states", () => {
    it("should show success message after sync", async () => {
      SyncEngine.startSync.mockResolvedValue({ success: true, synced: 5 });

      render(<ManualSyncButton />);

      await waitFor(() => {
        expect(screen.getByText(/Sync Now/i)).toBeTruthy();
      });

      fireEvent.press(screen.getByText(/Sync Now/i));

      await waitFor(() => {
        // Should show success feedback
        expect(screen.getByText(/Synced 5 items/i)).toBeTruthy();
      });
    });

    it("should show error message when sync fails", async () => {
      SyncEngine.startSync.mockResolvedValue({ success: false, error: "Network error" });

      render(<ManualSyncButton />);

      await waitFor(() => {
        expect(screen.getByText(/Sync Now/i)).toBeTruthy();
      });

      fireEvent.press(screen.getByText(/Sync Now/i));

      await waitFor(() => {
        expect(screen.getByText(/Network error/i)).toBeTruthy();
      });
    });
  });
});
