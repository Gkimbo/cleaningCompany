/**
 * OfflineLimitWarning Component Tests
 *
 * Tests for the offline duration limit warning UI component.
 */

import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react-native";

// Mock dependencies
jest.mock("../../../src/services/offline/SyncEngine", () => ({
  __esModule: true,
  default: {
    startSync: jest.fn().mockResolvedValue({ success: true }),
  },
}));

jest.mock("../../../src/services/offline/constants", () => ({
  MAX_OFFLINE_DURATION_MS: 48 * 60 * 60 * 1000, // 48 hours
  SYNC_STATUS: {
    IDLE: "idle",
    SYNCING: "syncing",
    COMPLETED: "completed",
    ERROR: "error",
  },
}));

const mockUpdateSyncStatus = jest.fn();
let mockOfflineSince = new Date(Date.now() - 24 * 60 * 60 * 1000);
let mockIsOnline = false;
let mockGetOfflineDuration = () => 24 * 60 * 60 * 1000;
let mockPendingSyncCount = 5;

jest.mock("../../../src/services/offline/OfflineContext", () => ({
  useOffline: jest.fn(() => ({
    isOnline: mockIsOnline,
    isOffline: !mockIsOnline,
    offlineSince: mockOfflineSince,
    getOfflineDuration: mockGetOfflineDuration,
    updateSyncStatus: mockUpdateSyncStatus,
    pendingSyncCount: mockPendingSyncCount,
  })),
}));

// Import after mocks
import OfflineLimitWarning from "../../../src/components/offline/OfflineLimitWarning";
import { useOffline } from "../../../src/services/offline/OfflineContext";
import SyncEngine from "../../../src/services/offline/SyncEngine";

describe("OfflineLimitWarning", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockIsOnline = false;
    mockOfflineSince = new Date(Date.now() - 24 * 60 * 60 * 1000);
    mockGetOfflineDuration = () => 24 * 60 * 60 * 1000;
    mockPendingSyncCount = 5;
  });

  describe("visibility", () => {
    it("should not render when online", () => {
      useOffline.mockReturnValue({
        isOnline: true,
        isOffline: false,
        offlineSince: null,
        getOfflineDuration: () => 0,
        updateSyncStatus: mockUpdateSyncStatus,
        pendingSyncCount: 0,
      });

      const { toJSON } = render(<OfflineLimitWarning />);

      expect(toJSON()).toBeNull();
    });

    it("should not render when offline for short time", () => {
      useOffline.mockReturnValue({
        isOnline: false,
        isOffline: true,
        offlineSince: new Date(Date.now() - 60 * 60 * 1000), // 1 hour ago
        getOfflineDuration: () => 60 * 60 * 1000, // 1 hour
        updateSyncStatus: mockUpdateSyncStatus,
        pendingSyncCount: 5,
      });

      const { toJSON } = render(<OfflineLimitWarning />);

      expect(toJSON()).toBeNull();
    });
  });

  describe("warning tiers", () => {
    it("should show warning at 36 hours", () => {
      useOffline.mockReturnValue({
        isOnline: false,
        isOffline: true,
        offlineSince: new Date(Date.now() - 36 * 60 * 60 * 1000),
        getOfflineDuration: () => 36 * 60 * 60 * 1000,
        updateSyncStatus: mockUpdateSyncStatus,
        pendingSyncCount: 5,
      });

      render(<OfflineLimitWarning />);

      // Component shows "Offline Mode" at warning level with time remaining
      expect(screen.getByText(/Offline Mode/i)).toBeTruthy();
      expect(screen.getByText(/remaining/i)).toBeTruthy();
    });

    it("should show critical warning at 44 hours", () => {
      useOffline.mockReturnValue({
        isOnline: false,
        isOffline: true,
        offlineSince: new Date(Date.now() - 44 * 60 * 60 * 1000),
        getOfflineDuration: () => 44 * 60 * 60 * 1000,
        updateSyncStatus: mockUpdateSyncStatus,
        pendingSyncCount: 5,
      });

      render(<OfflineLimitWarning />);

      // Component shows "Sync Soon" at critical level
      expect(screen.getByText(/Sync Soon/i)).toBeTruthy();
    });

    it("should show exceeded modal at 48 hours", () => {
      useOffline.mockReturnValue({
        isOnline: false,
        isOffline: true,
        offlineSince: new Date(Date.now() - 48 * 60 * 60 * 1000),
        getOfflineDuration: () => 48 * 60 * 60 * 1000,
        updateSyncStatus: mockUpdateSyncStatus,
        pendingSyncCount: 5,
      });

      render(<OfflineLimitWarning />);

      // Component shows "Offline Limit Reached" and modal
      expect(screen.getByText(/Offline Limit Reached/i)).toBeTruthy();
      expect(screen.getByText(/Offline Limit Exceeded/i)).toBeTruthy();
    });
  });

  describe("duration display", () => {
    it("should show formatted duration", () => {
      useOffline.mockReturnValue({
        isOnline: false,
        isOffline: true,
        offlineSince: new Date(Date.now() - 40 * 60 * 60 * 1000),
        getOfflineDuration: () => 40 * 60 * 60 * 1000,
        updateSyncStatus: mockUpdateSyncStatus,
        pendingSyncCount: 5,
      });

      render(<OfflineLimitWarning />);

      // Should show hours remaining
      expect(screen.getByText(/h.*remaining|remaining/i)).toBeTruthy();
    });
  });

  describe("interaction", () => {
    it("should show continue offline button when limit exceeded", () => {
      useOffline.mockReturnValue({
        isOnline: false,
        isOffline: true,
        offlineSince: new Date(Date.now() - 48 * 60 * 60 * 1000),
        getOfflineDuration: () => 48 * 60 * 60 * 1000,
        updateSyncStatus: mockUpdateSyncStatus,
        pendingSyncCount: 5,
      });

      render(<OfflineLimitWarning />);

      // Modal should have continue button
      expect(screen.getByText(/Continue Offline/i)).toBeTruthy();
    });

    it("should provide sync action when exceeded", async () => {
      useOffline.mockReturnValue({
        isOnline: false,
        isOffline: true,
        offlineSince: new Date(Date.now() - 48 * 60 * 60 * 1000),
        getOfflineDuration: () => 48 * 60 * 60 * 1000,
        updateSyncStatus: mockUpdateSyncStatus,
        pendingSyncCount: 5,
      });

      render(<OfflineLimitWarning />);

      // Modal should have sync action
      const syncButton = screen.getByText(/Try to Sync/i);
      expect(syncButton).toBeTruthy();

      fireEvent.press(syncButton);

      await waitFor(() => {
        expect(SyncEngine.startSync).toHaveBeenCalled();
      });
    });
  });

  describe("styling", () => {
    it("should show Sync Soon at critical level", () => {
      useOffline.mockReturnValue({
        isOnline: false,
        isOffline: true,
        offlineSince: new Date(Date.now() - 44 * 60 * 60 * 1000),
        getOfflineDuration: () => 44 * 60 * 60 * 1000,
        updateSyncStatus: mockUpdateSyncStatus,
        pendingSyncCount: 5,
      });

      render(<OfflineLimitWarning />);

      // Critical warning should show "Sync Soon"
      expect(screen.getByText(/Sync Soon/i)).toBeTruthy();
    });
  });
});
