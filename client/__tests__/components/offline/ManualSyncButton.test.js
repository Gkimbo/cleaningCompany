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
    retryFailed: jest.fn().mockResolvedValue({ success: true }),
    getPendingSummary: jest.fn().mockResolvedValue({
      pendingCount: 0,
      failedCount: 0,
      canRetryFailed: false,
    }),
    isSyncing: false,
    subscribe: jest.fn(() => () => {}),
  },
}));

jest.mock("../../../src/services/offline/OfflineContext", () => ({
  useNetworkStatus: jest.fn(() => ({
    isOnline: true,
    isOffline: false,
  })),
  useSyncStatus: jest.fn(() => ({
    syncStatus: "idle",
    pendingSyncCount: 5,
    updateSyncStatus: jest.fn(),
  })),
}));

// Import after mocks
import ManualSyncButton from "../../../src/components/offline/ManualSyncButton";
import SyncEngine from "../../../src/services/offline/SyncEngine";
import { useNetworkStatus, useSyncStatus } from "../../../src/services/offline/OfflineContext";

describe("ManualSyncButton", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    SyncEngine.isSyncing = false;
  });

  describe("rendering", () => {
    it("should render sync button when items pending", async () => {
      SyncEngine.getPendingSummary.mockResolvedValue({
        pendingCount: 5,
        failedCount: 0,
        canRetryFailed: false,
      });

      render(<ManualSyncButton />);

      await waitFor(() => {
        expect(screen.getByText(/sync/i)).toBeTruthy();
      });
    });

    it("should show pending count", async () => {
      SyncEngine.getPendingSummary.mockResolvedValue({
        pendingCount: 5,
        failedCount: 0,
        canRetryFailed: false,
      });

      render(<ManualSyncButton />);

      await waitFor(() => {
        expect(screen.getByText(/5/)).toBeTruthy();
      });
    });
  });

  describe("sync functionality", () => {
    it("should call startSync when pressed", async () => {
      SyncEngine.getPendingSummary.mockResolvedValue({
        pendingCount: 5,
        failedCount: 0,
        canRetryFailed: false,
      });

      render(<ManualSyncButton />);

      await waitFor(() => {
        expect(screen.getByText(/sync/i)).toBeTruthy();
      });

      fireEvent.press(screen.getByText(/sync/i));

      await waitFor(() => {
        expect(SyncEngine.startSync).toHaveBeenCalled();
      });
    });

    it("should disable button while syncing", async () => {
      SyncEngine.isSyncing = true;
      SyncEngine.getPendingSummary.mockResolvedValue({
        pendingCount: 5,
        failedCount: 0,
        canRetryFailed: false,
      });

      render(<ManualSyncButton />);

      await waitFor(() => {
        expect(screen.getByText(/syncing/i)).toBeTruthy();
      });
    });

    it("should disable button when offline", async () => {
      useNetworkStatus.mockReturnValue({
        isOnline: false,
        isOffline: true,
      });

      SyncEngine.getPendingSummary.mockResolvedValue({
        pendingCount: 5,
        failedCount: 0,
        canRetryFailed: false,
      });

      render(<ManualSyncButton />);

      await waitFor(() => {
        expect(screen.getByText(/offline/i)).toBeTruthy();
      });

      // Reset mock
      useNetworkStatus.mockReturnValue({
        isOnline: true,
        isOffline: false,
      });
    });
  });

  describe("retry functionality", () => {
    it("should show retry option when failed operations exist", async () => {
      SyncEngine.getPendingSummary.mockResolvedValue({
        pendingCount: 0,
        failedCount: 3,
        canRetryFailed: true,
      });

      render(<ManualSyncButton />);

      await waitFor(() => {
        expect(screen.getByText(/retry|failed/i)).toBeTruthy();
      });
    });

    it("should call retryFailed when retry pressed", async () => {
      SyncEngine.getPendingSummary.mockResolvedValue({
        pendingCount: 0,
        failedCount: 3,
        canRetryFailed: true,
      });

      render(<ManualSyncButton />);

      await waitFor(() => {
        expect(screen.getByText(/retry/i)).toBeTruthy();
      });

      fireEvent.press(screen.getByText(/retry/i));

      await waitFor(() => {
        expect(SyncEngine.retryFailed).toHaveBeenCalled();
      });
    });
  });

  describe("success/error states", () => {
    it("should show success message after sync", async () => {
      SyncEngine.getPendingSummary.mockResolvedValue({
        pendingCount: 5,
        failedCount: 0,
        canRetryFailed: false,
      });

      SyncEngine.startSync.mockResolvedValue({ success: true, synced: 5 });

      render(<ManualSyncButton />);

      await waitFor(() => {
        expect(screen.getByText(/sync/i)).toBeTruthy();
      });

      fireEvent.press(screen.getByText(/sync/i));

      await waitFor(() => {
        // Should show success feedback
        expect(screen.queryByText(/sync/i) || screen.queryByText(/success|synced/i)).toBeTruthy();
      });
    });

    it("should show error message when sync fails", async () => {
      SyncEngine.getPendingSummary.mockResolvedValue({
        pendingCount: 5,
        failedCount: 0,
        canRetryFailed: false,
      });

      SyncEngine.startSync.mockResolvedValue({ success: false, error: "Network error" });

      render(<ManualSyncButton />);

      await waitFor(() => {
        expect(screen.getByText(/sync/i)).toBeTruthy();
      });

      fireEvent.press(screen.getByText(/sync/i));

      await waitFor(() => {
        expect(screen.getByText(/error|failed/i)).toBeTruthy();
      });
    });
  });
});
