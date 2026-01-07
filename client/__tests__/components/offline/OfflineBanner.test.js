/**
 * OfflineBanner Component Tests
 *
 * Tests for the offline banner UI component.
 */

import React from "react";
import { render, screen } from "@testing-library/react-native";

// Mock dependencies
jest.mock("../../../src/services/offline/OfflineContext", () => ({
  useNetworkStatus: jest.fn(() => ({
    isOnline: true,
    isOffline: false,
    networkStatus: "online",
  })),
  useSyncStatus: jest.fn(() => ({
    syncStatus: "idle",
    pendingSyncCount: 0,
  })),
}));

// Import component after mocks
import OfflineBanner from "../../../src/components/offline/OfflineBanner";
import { useNetworkStatus, useSyncStatus } from "../../../src/services/offline/OfflineContext";

describe("OfflineBanner", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("online state", () => {
    it("should not render when online and no pending sync", () => {
      useNetworkStatus.mockReturnValue({
        isOnline: true,
        isOffline: false,
      });
      useSyncStatus.mockReturnValue({
        syncStatus: "idle",
        pendingSyncCount: 0,
      });

      const { toJSON } = render(<OfflineBanner />);

      // Should return null when online with nothing to sync
      expect(toJSON()).toBeNull();
    });

    it("should show sync count when online with pending items", () => {
      useNetworkStatus.mockReturnValue({
        isOnline: true,
        isOffline: false,
      });
      useSyncStatus.mockReturnValue({
        syncStatus: "idle",
        pendingSyncCount: 5,
      });

      render(<OfflineBanner />);

      expect(screen.getByText(/5 changes/i)).toBeTruthy();
    });
  });

  describe("offline state", () => {
    it("should show offline message when offline", () => {
      useNetworkStatus.mockReturnValue({
        isOnline: false,
        isOffline: true,
      });
      useSyncStatus.mockReturnValue({
        syncStatus: "idle",
        pendingSyncCount: 0,
      });

      render(<OfflineBanner />);

      expect(screen.getByText(/offline/i)).toBeTruthy();
    });

    it("should show pending count when offline with pending items", () => {
      useNetworkStatus.mockReturnValue({
        isOnline: false,
        isOffline: true,
      });
      useSyncStatus.mockReturnValue({
        syncStatus: "idle",
        pendingSyncCount: 3,
      });

      render(<OfflineBanner />);

      expect(screen.getByText(/3/)).toBeTruthy();
    });
  });

  describe("syncing state", () => {
    it("should show syncing indicator when syncing", () => {
      useNetworkStatus.mockReturnValue({
        isOnline: true,
        isOffline: false,
      });
      useSyncStatus.mockReturnValue({
        syncStatus: "syncing",
        pendingSyncCount: 5,
      });

      render(<OfflineBanner />);

      expect(screen.getByText(/syncing/i)).toBeTruthy();
    });
  });

  describe("error state", () => {
    it("should show error message when sync failed", () => {
      useNetworkStatus.mockReturnValue({
        isOnline: true,
        isOffline: false,
      });
      useSyncStatus.mockReturnValue({
        syncStatus: "error",
        pendingSyncCount: 2,
      });

      render(<OfflineBanner />);

      expect(screen.getByText(/error|failed/i)).toBeTruthy();
    });
  });
});
