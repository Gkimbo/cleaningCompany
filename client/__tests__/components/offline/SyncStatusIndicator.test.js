/**
 * SyncStatusIndicator Component Tests
 *
 * Tests for the sync status indicator UI component.
 */

import React from "react";
import { render, screen } from "@testing-library/react-native";

// Mock dependencies
jest.mock("../../../src/services/offline/SyncEngine", () => ({
  __esModule: true,
  default: {
    subscribe: jest.fn((cb) => {
      // Return unsubscribe function
      return () => {};
    }),
    getProgress: jest.fn(() => ({
      status: "idle",
      totalOperations: 0,
      completedOperations: 0,
      currentOperation: null,
      errors: [],
    })),
  },
}));

jest.mock("../../../src/services/offline/OfflineContext", () => ({
  useSyncStatus: jest.fn(() => ({
    syncStatus: "idle",
    pendingSyncCount: 0,
  })),
}));

// Import after mocks
import SyncStatusIndicator from "../../../src/components/offline/SyncStatusIndicator";
import SyncEngine from "../../../src/services/offline/SyncEngine";
import { useSyncStatus } from "../../../src/services/offline/OfflineContext";

describe("SyncStatusIndicator", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("idle state", () => {
    it("should not render when idle with no pending items", () => {
      useSyncStatus.mockReturnValue({
        syncStatus: "idle",
        pendingSyncCount: 0,
      });

      SyncEngine.getProgress.mockReturnValue({
        status: "idle",
        totalOperations: 0,
        completedOperations: 0,
      });

      const { toJSON } = render(<SyncStatusIndicator />);

      expect(toJSON()).toBeNull();
    });

    it("should show pending count when items waiting", () => {
      useSyncStatus.mockReturnValue({
        syncStatus: "idle",
        pendingSyncCount: 5,
      });

      SyncEngine.getProgress.mockReturnValue({
        status: "idle",
        totalOperations: 0,
        completedOperations: 0,
      });

      render(<SyncStatusIndicator />);

      expect(screen.getByText(/5/)).toBeTruthy();
    });
  });

  describe("syncing state", () => {
    it("should show progress during sync", () => {
      useSyncStatus.mockReturnValue({
        syncStatus: "syncing",
        pendingSyncCount: 10,
      });

      SyncEngine.getProgress.mockReturnValue({
        status: "syncing",
        totalOperations: 10,
        completedOperations: 3,
        currentOperation: "checklist",
      });

      render(<SyncStatusIndicator />);

      expect(screen.getByText(/3.*10/)).toBeTruthy();
    });

    it("should show current operation type", () => {
      useSyncStatus.mockReturnValue({
        syncStatus: "syncing",
        pendingSyncCount: 5,
      });

      SyncEngine.getProgress.mockReturnValue({
        status: "syncing",
        totalOperations: 5,
        completedOperations: 2,
        currentOperation: "before_photo",
      });

      render(<SyncStatusIndicator />);

      expect(screen.getByText(/photo/i)).toBeTruthy();
    });
  });

  describe("completed state", () => {
    it("should show completion message", () => {
      useSyncStatus.mockReturnValue({
        syncStatus: "completed",
        pendingSyncCount: 0,
      });

      SyncEngine.getProgress.mockReturnValue({
        status: "completed",
        totalOperations: 5,
        completedOperations: 5,
      });

      render(<SyncStatusIndicator />);

      expect(screen.getByText(/complete|synced/i)).toBeTruthy();
    });
  });

  describe("error state", () => {
    it("should show error indicator", () => {
      useSyncStatus.mockReturnValue({
        syncStatus: "error",
        pendingSyncCount: 2,
      });

      SyncEngine.getProgress.mockReturnValue({
        status: "error",
        totalOperations: 5,
        completedOperations: 3,
        errors: [{ error: "Failed to sync" }],
      });

      render(<SyncStatusIndicator />);

      expect(screen.getByText(/error|failed/i)).toBeTruthy();
    });
  });
});
