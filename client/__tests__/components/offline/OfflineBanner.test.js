/**
 * OfflineBanner Component Tests
 *
 * Tests for the offline banner UI component.
 */

import React from "react";
import { render, screen, fireEvent } from "@testing-library/react-native";

// Mock dependencies
jest.mock("../../../src/services/offline/OfflineContext", () => ({
  useOffline: jest.fn(() => ({
    isOnline: true,
    isOffline: false,
    networkStatus: "online",
    syncStatus: "idle",
    pendingSyncCount: 0,
    autoSyncEvent: null,
    triggerManualSync: jest.fn(),
  })),
}));

// Import component after mocks
import OfflineBanner from "../../../src/components/offline/OfflineBanner";
import { useOffline } from "../../../src/services/offline/OfflineContext";

describe("OfflineBanner", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("online state", () => {
    it("should not render when online and no pending sync", () => {
      useOffline.mockReturnValue({
        isOnline: true,
        isOffline: false,
        syncStatus: "idle",
        pendingSyncCount: 0,
        autoSyncEvent: null,
        triggerManualSync: jest.fn(),
      });

      const { toJSON } = render(<OfflineBanner />);

      // Should return null when online with nothing to sync
      expect(toJSON()).toBeNull();
    });

    it("should show sync count when online with pending items", () => {
      useOffline.mockReturnValue({
        isOnline: true,
        isOffline: false,
        syncStatus: "idle",
        pendingSyncCount: 5,
        autoSyncEvent: null,
        triggerManualSync: jest.fn(),
      });

      render(<OfflineBanner />);

      expect(screen.getByText(/5 changes/i)).toBeTruthy();
    });
  });

  describe("offline state", () => {
    it("should show offline message when offline", () => {
      useOffline.mockReturnValue({
        isOnline: false,
        isOffline: true,
        syncStatus: "idle",
        pendingSyncCount: 0,
        autoSyncEvent: null,
        triggerManualSync: jest.fn(),
      });

      render(<OfflineBanner />);

      expect(screen.getByText(/offline/i)).toBeTruthy();
    });

    it("should show pending count when offline with pending items", () => {
      useOffline.mockReturnValue({
        isOnline: false,
        isOffline: true,
        syncStatus: "idle",
        pendingSyncCount: 3,
        autoSyncEvent: null,
        triggerManualSync: jest.fn(),
      });

      render(<OfflineBanner />);

      expect(screen.getByText(/3/)).toBeTruthy();
    });
  });

  describe("syncing state", () => {
    it("should show syncing indicator when syncing", () => {
      useOffline.mockReturnValue({
        isOnline: true,
        isOffline: false,
        syncStatus: "syncing",
        pendingSyncCount: 5,
        autoSyncEvent: null,
        triggerManualSync: jest.fn(),
      });

      render(<OfflineBanner />);

      expect(screen.getByText(/syncing/i)).toBeTruthy();
    });
  });

  describe("error state", () => {
    it("should show error message when sync failed", () => {
      useOffline.mockReturnValue({
        isOnline: true,
        isOffline: false,
        syncStatus: "error",
        pendingSyncCount: 2,
        autoSyncEvent: null,
        triggerManualSync: jest.fn(),
      });

      render(<OfflineBanner />);

      expect(screen.getByText(/error/i)).toBeTruthy();
    });

    it("should trigger manual sync when tapped in error state", () => {
      const mockTriggerManualSync = jest.fn();
      useOffline.mockReturnValue({
        isOnline: true,
        isOffline: false,
        syncStatus: "error",
        pendingSyncCount: 2,
        autoSyncEvent: null,
        triggerManualSync: mockTriggerManualSync,
      });

      render(<OfflineBanner />);

      const banner = screen.getByText(/error/i).parent.parent;
      fireEvent.press(banner);

      expect(mockTriggerManualSync).toHaveBeenCalled();
    });
  });

  describe("success state", () => {
    it("should show success message after sync completes", () => {
      useOffline.mockReturnValue({
        isOnline: true,
        isOffline: false,
        syncStatus: "completed",
        pendingSyncCount: 0,
        autoSyncEvent: { type: "sync_completed", syncedCount: 5 },
        triggerManualSync: jest.fn(),
      });

      render(<OfflineBanner />);

      expect(screen.getByText(/complete/i)).toBeTruthy();
      expect(screen.getByText(/5 changes synced/i)).toBeTruthy();
    });
  });
});
