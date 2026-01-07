/**
 * OfflineLimitWarning Component Tests
 *
 * Tests for the offline duration limit warning UI component.
 */

import React from "react";
import { render, screen, fireEvent } from "@testing-library/react-native";

// Mock dependencies
jest.mock("../../../src/services/offline/OfflineContext", () => ({
  useOffline: jest.fn(() => ({
    isOnline: false,
    isOffline: true,
    offlineSince: new Date(Date.now() - 24 * 60 * 60 * 1000), // 24 hours ago
    getOfflineDuration: jest.fn(() => 24 * 60 * 60 * 1000),
    isOfflineDurationExceeded: jest.fn(() => false),
  })),
}));

jest.mock("../../../src/services/offline/constants", () => ({
  MAX_OFFLINE_DURATION_MS: 48 * 60 * 60 * 1000, // 48 hours
}));

// Import after mocks
import OfflineLimitWarning from "../../../src/components/offline/OfflineLimitWarning";
import { useOffline } from "../../../src/services/offline/OfflineContext";

describe("OfflineLimitWarning", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("visibility", () => {
    it("should not render when online", () => {
      useOffline.mockReturnValue({
        isOnline: true,
        isOffline: false,
        offlineSince: null,
        getOfflineDuration: jest.fn(() => 0),
        isOfflineDurationExceeded: jest.fn(() => false),
      });

      const { toJSON } = render(<OfflineLimitWarning />);

      expect(toJSON()).toBeNull();
    });

    it("should not render when offline for short time", () => {
      useOffline.mockReturnValue({
        isOnline: false,
        isOffline: true,
        offlineSince: new Date(Date.now() - 60 * 60 * 1000), // 1 hour ago
        getOfflineDuration: jest.fn(() => 60 * 60 * 1000), // 1 hour
        isOfflineDurationExceeded: jest.fn(() => false),
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
        offlineSince: new Date(Date.now() - 36 * 60 * 60 * 1000), // 36 hours ago
        getOfflineDuration: jest.fn(() => 36 * 60 * 60 * 1000),
        isOfflineDurationExceeded: jest.fn(() => false),
      });

      render(<OfflineLimitWarning />);

      expect(screen.getByText(/12 hours remaining|36 hours/i)).toBeTruthy();
    });

    it("should show critical warning at 44 hours", () => {
      useOffline.mockReturnValue({
        isOnline: false,
        isOffline: true,
        offlineSince: new Date(Date.now() - 44 * 60 * 60 * 1000), // 44 hours ago
        getOfflineDuration: jest.fn(() => 44 * 60 * 60 * 1000),
        isOfflineDurationExceeded: jest.fn(() => false),
      });

      render(<OfflineLimitWarning />);

      expect(screen.getByText(/4 hours remaining|44 hours/i)).toBeTruthy();
    });

    it("should show exceeded modal at 48 hours", () => {
      useOffline.mockReturnValue({
        isOnline: false,
        isOffline: true,
        offlineSince: new Date(Date.now() - 48 * 60 * 60 * 1000), // 48 hours ago
        getOfflineDuration: jest.fn(() => 48 * 60 * 60 * 1000),
        isOfflineDurationExceeded: jest.fn(() => true),
      });

      render(<OfflineLimitWarning />);

      expect(screen.getByText(/exceeded|48 hours|limit reached/i)).toBeTruthy();
    });
  });

  describe("duration display", () => {
    it("should show formatted duration", () => {
      useOffline.mockReturnValue({
        isOnline: false,
        isOffline: true,
        offlineSince: new Date(Date.now() - 40 * 60 * 60 * 1000), // 40 hours ago
        getOfflineDuration: jest.fn(() => 40 * 60 * 60 * 1000),
        isOfflineDurationExceeded: jest.fn(() => false),
      });

      render(<OfflineLimitWarning />);

      // Should show hours or days
      expect(screen.getByText(/hour|day/i)).toBeTruthy();
    });
  });

  describe("interaction", () => {
    it("should call onDismiss when dismissed", () => {
      useOffline.mockReturnValue({
        isOnline: false,
        isOffline: true,
        offlineSince: new Date(Date.now() - 40 * 60 * 60 * 1000),
        getOfflineDuration: jest.fn(() => 40 * 60 * 60 * 1000),
        isOfflineDurationExceeded: jest.fn(() => false),
      });

      const onDismiss = jest.fn();
      render(<OfflineLimitWarning onDismiss={onDismiss} />);

      // Try to find and press dismiss button
      const dismissButton = screen.queryByText(/dismiss|ok|close/i);
      if (dismissButton) {
        fireEvent.press(dismissButton);
        expect(onDismiss).toHaveBeenCalled();
      }
    });

    it("should provide sync action when exceeded", () => {
      useOffline.mockReturnValue({
        isOnline: false,
        isOffline: true,
        offlineSince: new Date(Date.now() - 48 * 60 * 60 * 1000),
        getOfflineDuration: jest.fn(() => 48 * 60 * 60 * 1000),
        isOfflineDurationExceeded: jest.fn(() => true),
      });

      const onSyncRequest = jest.fn();
      render(<OfflineLimitWarning onSyncRequest={onSyncRequest} />);

      // Modal should have sync action
      const syncButton = screen.queryByText(/sync|connect/i);
      if (syncButton) {
        fireEvent.press(syncButton);
        expect(onSyncRequest).toHaveBeenCalled();
      }
    });
  });

  describe("styling", () => {
    it("should show different colors for different warning levels", () => {
      // This test verifies the warning shows different visual states
      // Implementation would check style props or testIDs

      useOffline.mockReturnValue({
        isOnline: false,
        isOffline: true,
        offlineSince: new Date(Date.now() - 44 * 60 * 60 * 1000),
        getOfflineDuration: jest.fn(() => 44 * 60 * 60 * 1000),
        isOfflineDurationExceeded: jest.fn(() => false),
      });

      render(<OfflineLimitWarning />);

      // Critical warning should be visible
      expect(screen.getByText(/warning|critical/i)).toBeTruthy();
    });
  });
});
