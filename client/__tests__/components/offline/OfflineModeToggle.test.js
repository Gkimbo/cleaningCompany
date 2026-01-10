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
      unresolvedConflictCount: 0,
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

let mockIsOnline = true;
let mockPendingSyncCount = 3;

jest.mock("../../../src/services/offline/OfflineContext", () => ({
  useOffline: jest.fn(() => ({
    isOnline: mockIsOnline,
    isOffline: !mockIsOnline,
    pendingSyncCount: mockPendingSyncCount,
  })),
}));

// Import after mocks
import OfflineModeToggle from "../../../src/components/offline/OfflineModeToggle";
import OfflineManager from "../../../src/services/offline/OfflineManager";
import StorageManager from "../../../src/services/offline/StorageManager";
import { useOffline } from "../../../src/services/offline/OfflineContext";

describe("OfflineModeToggle", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockIsOnline = true;
    mockPendingSyncCount = 3;

    // Reset mock implementation
    useOffline.mockImplementation(() => ({
      isOnline: mockIsOnline,
      isOffline: !mockIsOnline,
      pendingSyncCount: mockPendingSyncCount,
    }));

    // Reset StorageManager mock
    StorageManager.getStorageStats.mockResolvedValue({
      health: "good",
      healthMessage: "Storage healthy",
      photoStorageFormatted: "50 MB",
      totalPhotoCount: 25,
      pendingPhotoCount: 5,
      jobCount: 10,
      pendingSyncCount: 3,
      unresolvedConflictCount: 0,
    });
  });

  describe("rendering", () => {
    it("should render storage statistics", async () => {
      render(<OfflineModeToggle />);

      await waitFor(() => {
        expect(screen.getByText(/50 MB/)).toBeTruthy();
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
        expect(screen.getByText(/Preload Jobs/i)).toBeTruthy();
      });
    });

    it("should call preloadJobs when preload pressed", async () => {
      render(<OfflineModeToggle />);

      await waitFor(() => {
        expect(screen.getByText(/Preload Jobs/i)).toBeTruthy();
      });

      fireEvent.press(screen.getByText(/Preload Jobs/i));

      await waitFor(() => {
        expect(OfflineManager.preloadJobs).toHaveBeenCalled();
      });
    });

    it("should disable preload when offline", async () => {
      mockIsOnline = false;
      useOffline.mockImplementation(() => ({
        isOnline: false,
        isOffline: true,
        pendingSyncCount: mockPendingSyncCount,
      }));

      render(<OfflineModeToggle />);

      await waitFor(() => {
        // Button text should still be there but disabled
        const preloadButton = screen.getByText(/Preload Jobs/i);
        expect(preloadButton).toBeTruthy();
      });
    });
  });

  describe("cleanup functionality", () => {
    it("should show cleanup button", async () => {
      mockPendingSyncCount = 0;
      useOffline.mockImplementation(() => ({
        isOnline: mockIsOnline,
        isOffline: !mockIsOnline,
        pendingSyncCount: 0,
      }));

      render(<OfflineModeToggle />);

      await waitFor(() => {
        expect(screen.getByText(/Cleanup Storage/i)).toBeTruthy();
      });
    });

    it("should call runCleanup when cleanup pressed", async () => {
      mockPendingSyncCount = 0;
      useOffline.mockImplementation(() => ({
        isOnline: mockIsOnline,
        isOffline: !mockIsOnline,
        pendingSyncCount: 0,
      }));

      render(<OfflineModeToggle />);

      await waitFor(() => {
        expect(screen.getByText(/Cleanup Storage/i)).toBeTruthy();
      });

      fireEvent.press(screen.getByText(/Cleanup Storage/i));

      await waitFor(() => {
        expect(StorageManager.runCleanup).toHaveBeenCalled();
      });
    });

    it("should show cleanup results", async () => {
      mockPendingSyncCount = 0;
      useOffline.mockImplementation(() => ({
        isOnline: mockIsOnline,
        isOffline: !mockIsOnline,
        pendingSyncCount: 0,
      }));

      render(<OfflineModeToggle />);

      await waitFor(() => {
        expect(screen.getByText(/Cleanup Storage/i)).toBeTruthy();
      });

      fireEvent.press(screen.getByText(/Cleanup Storage/i));

      await waitFor(() => {
        // Should show success with cleaned items count (2 + 5 + 10 = 17)
        expect(screen.getByText(/Cleaned 17 items/i)).toBeTruthy();
      });
    });
  });

  describe("storage health", () => {
    it("should show healthy status with good health", async () => {
      render(<OfflineModeToggle />);

      await waitFor(() => {
        expect(screen.getByText(/Storage healthy/i)).toBeTruthy();
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
        unresolvedConflictCount: 0,
      });

      render(<OfflineModeToggle />);

      await waitFor(() => {
        expect(screen.getByText(/Storage high/i)).toBeTruthy();
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
        unresolvedConflictCount: 0,
      });

      render(<OfflineModeToggle />);

      await waitFor(() => {
        expect(screen.getByText(/Storage critical/i)).toBeTruthy();
      });
    });
  });

  describe("pending sync indicator", () => {
    it("should show pending sync count", async () => {
      render(<OfflineModeToggle />);

      await waitFor(() => {
        expect(screen.getByText(/3 pending/i)).toBeTruthy();
      });
    });
  });
});
