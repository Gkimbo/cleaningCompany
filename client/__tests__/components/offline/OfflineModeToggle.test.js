/**
 * OfflineModeToggle Component Tests
 *
 * Tests for the offline mode toggle settings component.
 */

import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react-native";

// Mock dependencies
jest.mock("../../../src/services/offline/OfflineManager", () => ({
  __esModule: true,
  default: {
    preloadJobs: jest.fn().mockResolvedValue(undefined),
    reset: jest.fn().mockResolvedValue(undefined),
    getDataFreshness: jest.fn(() => ({
      isFresh: true,
      lastUpdated: new Date(),
      formattedAge: "5 minutes ago",
    })),
  },
}));

jest.mock("../../../src/services/offline/StorageManager", () => ({
  __esModule: true,
  default: {
    getStorageStats: jest.fn().mockResolvedValue({
      health: "good",
      healthMessage: "Storage healthy",
      photoStorageFormatted: "50 MB",
      totalPhotoCount: 25,
      pendingPhotoCount: 5,
      jobCount: 10,
      pendingSyncCount: 3,
    }),
    runCleanup: jest.fn().mockResolvedValue({
      cleanedJobs: 2,
      cleanedPhotos: 5,
      cleanedSyncQueue: 10,
      cleanedConflicts: 1,
      errors: [],
    }),
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
    pendingSyncCount: 3,
  })),
}));

// Import after mocks
import OfflineModeToggle from "../../../src/components/offline/OfflineModeToggle";
import OfflineManager from "../../../src/services/offline/OfflineManager";
import StorageManager from "../../../src/services/offline/StorageManager";
import { useNetworkStatus } from "../../../src/services/offline/OfflineContext";

describe("OfflineModeToggle", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("rendering", () => {
    it("should render storage statistics", async () => {
      render(<OfflineModeToggle />);

      await waitFor(() => {
        expect(screen.getByText(/50 MB/i)).toBeTruthy();
      });
    });

    it("should show data freshness", async () => {
      render(<OfflineModeToggle />);

      await waitFor(() => {
        expect(screen.getByText(/5 minutes ago/i)).toBeTruthy();
      });
    });

    it("should show job and photo counts", async () => {
      render(<OfflineModeToggle />);

      await waitFor(() => {
        expect(screen.getByText(/10/)).toBeTruthy(); // jobs
        expect(screen.getByText(/25/)).toBeTruthy(); // photos
      });
    });
  });

  describe("preload functionality", () => {
    it("should show preload button when online", async () => {
      render(<OfflineModeToggle />);

      await waitFor(() => {
        expect(screen.getByText(/preload|download|refresh/i)).toBeTruthy();
      });
    });

    it("should call preloadJobs when preload pressed", async () => {
      render(<OfflineModeToggle />);

      await waitFor(() => {
        expect(screen.getByText(/preload|download|refresh/i)).toBeTruthy();
      });

      fireEvent.press(screen.getByText(/preload|download|refresh/i));

      await waitFor(() => {
        expect(OfflineManager.preloadJobs).toHaveBeenCalled();
      });
    });

    it("should disable preload when offline", async () => {
      useNetworkStatus.mockReturnValue({
        isOnline: false,
        isOffline: true,
      });

      render(<OfflineModeToggle />);

      await waitFor(() => {
        const preloadButton = screen.queryByText(/preload|download/i);
        // Button should be disabled or not visible when offline
        expect(preloadButton).toBeFalsy();
      });

      // Reset
      useNetworkStatus.mockReturnValue({
        isOnline: true,
        isOffline: false,
      });
    });
  });

  describe("cleanup functionality", () => {
    it("should show cleanup button", async () => {
      render(<OfflineModeToggle />);

      await waitFor(() => {
        expect(screen.getByText(/clean|clear/i)).toBeTruthy();
      });
    });

    it("should call runCleanup when cleanup pressed", async () => {
      render(<OfflineModeToggle />);

      await waitFor(() => {
        expect(screen.getByText(/clean|clear/i)).toBeTruthy();
      });

      fireEvent.press(screen.getByText(/clean|clear/i));

      await waitFor(() => {
        expect(StorageManager.runCleanup).toHaveBeenCalled();
      });
    });

    it("should show cleanup results", async () => {
      render(<OfflineModeToggle />);

      await waitFor(() => {
        expect(screen.getByText(/clean|clear/i)).toBeTruthy();
      });

      fireEvent.press(screen.getByText(/clean|clear/i));

      await waitFor(() => {
        // Should show success or count of cleaned items
        expect(
          screen.getByText(/cleaned|removed|success/i) || screen.getByText(/\d+/)
        ).toBeTruthy();
      });
    });
  });

  describe("storage health", () => {
    it("should show healthy status with good health", async () => {
      render(<OfflineModeToggle />);

      await waitFor(() => {
        expect(screen.getByText(/healthy|good/i)).toBeTruthy();
      });
    });

    it("should show warning status when storage high", async () => {
      StorageManager.getStorageStats.mockResolvedValue({
        health: "warning",
        healthMessage: "Storage high (150MB)",
        photoStorageFormatted: "150 MB",
        totalPhotoCount: 100,
        pendingPhotoCount: 50,
        jobCount: 30,
        pendingSyncCount: 10,
      });

      render(<OfflineModeToggle />);

      await waitFor(() => {
        expect(screen.getByText(/warning|high/i)).toBeTruthy();
      });
    });

    it("should show critical status when storage critical", async () => {
      StorageManager.getStorageStats.mockResolvedValue({
        health: "critical",
        healthMessage: "Storage critical (250MB)",
        photoStorageFormatted: "250 MB",
        totalPhotoCount: 200,
        pendingPhotoCount: 100,
        jobCount: 50,
        pendingSyncCount: 25,
      });

      render(<OfflineModeToggle />);

      await waitFor(() => {
        expect(screen.getByText(/critical/i)).toBeTruthy();
      });
    });
  });

  describe("pending sync indicator", () => {
    it("should show pending sync count", async () => {
      render(<OfflineModeToggle />);

      await waitFor(() => {
        expect(screen.getByText(/3.*pending|pending.*3/i)).toBeTruthy();
      });
    });
  });

  describe("reset functionality", () => {
    it("should show reset option (with confirmation)", async () => {
      render(<OfflineModeToggle />);

      await waitFor(() => {
        expect(screen.getByText(/reset|clear all/i)).toBeTruthy();
      });
    });

    it("should require confirmation before reset", async () => {
      render(<OfflineModeToggle />);

      await waitFor(() => {
        expect(screen.getByText(/reset|clear all/i)).toBeTruthy();
      });

      fireEvent.press(screen.getByText(/reset|clear all/i));

      // Should show confirmation dialog
      await waitFor(() => {
        expect(screen.getByText(/confirm|sure|warning/i)).toBeTruthy();
      });
    });
  });
});
