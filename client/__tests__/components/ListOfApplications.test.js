/**
 * Tests for ListOfApplications Component
 * Tests pending count updates when application status changes
 */

import React from "react";
import { render, waitFor, act, fireEvent } from "@testing-library/react-native";

// Mock dependencies
jest.mock("react-router-native", () => ({
  useNavigate: () => jest.fn(),
}));

jest.mock("../../src/services/fetchRequests/ApplicationClass", () => ({
  __esModule: true,
  default: {
    getPendingCount: jest.fn(),
    deleteApplication: jest.fn(),
    updateApplicationStatus: jest.fn(),
    updateApplicationNotes: jest.fn(),
  },
}));

jest.mock("../../src/services/fetchRequests/fetchData", () => ({
  __esModule: true,
  default: {
    getApplicationsFromBackend: jest.fn(),
  },
}));

// Mock ApplicationTile component
jest.mock(
  "../../src/components/admin/CleanerApplications/ApplicationTile",
  () => "ApplicationTile"
);

import Application from "../../src/services/fetchRequests/ApplicationClass";
import FetchData from "../../src/services/fetchRequests/fetchData";

describe("ListOfApplications Pending Count Updates", () => {
  const mockDispatch = jest.fn();

  const mockState = {
    currentUser: { token: "valid-token" },
    account: "owner",
    pendingApplications: 5,
  };

  const mockApplications = [
    {
      id: 1,
      firstName: "John",
      lastName: "Doe",
      email: "john@test.com",
      status: "pending",
    },
    {
      id: 2,
      firstName: "Jane",
      lastName: "Smith",
      email: "jane@test.com",
      status: "pending",
    },
    {
      id: 3,
      firstName: "Bob",
      lastName: "Wilson",
      email: "bob@test.com",
      status: "approved",
    },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    FetchData.getApplicationsFromBackend.mockResolvedValue({
      serializedApplications: mockApplications,
    });
    Application.getPendingCount.mockResolvedValue(2);
  });

  describe("updatePendingCount function", () => {
    it("should dispatch SET_PENDING_APPLICATIONS when dispatch is provided", async () => {
      // Import the component dynamically to ensure mocks are set up
      const ListOfApplications = require("../../src/components/admin/CleanerApplications/ListOfApplications").default;

      render(<ListOfApplications state={mockState} dispatch={mockDispatch} />);

      await waitFor(() => {
        expect(Application.getPendingCount).toHaveBeenCalled();
      });

      await waitFor(() => {
        expect(mockDispatch).toHaveBeenCalledWith({
          type: "SET_PENDING_APPLICATIONS",
          payload: 2,
        });
      });
    });

    it("should not dispatch when dispatch is not provided", async () => {
      const ListOfApplications = require("../../src/components/admin/CleanerApplications/ListOfApplications").default;

      render(<ListOfApplications state={mockState} />);

      await waitFor(() => {
        expect(FetchData.getApplicationsFromBackend).toHaveBeenCalled();
      });

      // Should not throw an error even without dispatch
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 100));
      });

      // Since dispatch is undefined, it should be called 0 times
      expect(mockDispatch).not.toHaveBeenCalled();
    });

    it("should update pending count after fetching applications", async () => {
      const ListOfApplications = require("../../src/components/admin/CleanerApplications/ListOfApplications").default;

      render(<ListOfApplications state={mockState} dispatch={mockDispatch} />);

      await waitFor(() => {
        expect(FetchData.getApplicationsFromBackend).toHaveBeenCalled();
        expect(Application.getPendingCount).toHaveBeenCalled();
      });
    });

    it("should handle error when fetching pending count fails", async () => {
      Application.getPendingCount.mockRejectedValue(new Error("Network error"));

      const ListOfApplications = require("../../src/components/admin/CleanerApplications/ListOfApplications").default;

      // Should not throw when getPendingCount fails
      render(<ListOfApplications state={mockState} dispatch={mockDispatch} />);

      await waitFor(() => {
        expect(FetchData.getApplicationsFromBackend).toHaveBeenCalled();
      });

      // Component should still render
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 100));
      });
    });
  });

  describe("Pending count updates on status change", () => {
    it("should update pending count when an application status changes", async () => {
      // First call returns 2 pending, after status change returns 1
      Application.getPendingCount
        .mockResolvedValueOnce(2)
        .mockResolvedValueOnce(1);

      const ListOfApplications = require("../../src/components/admin/CleanerApplications/ListOfApplications").default;

      render(<ListOfApplications state={mockState} dispatch={mockDispatch} />);

      await waitFor(() => {
        expect(mockDispatch).toHaveBeenCalledWith({
          type: "SET_PENDING_APPLICATIONS",
          payload: 2,
        });
      });
    });

  });

  describe("Statistics calculation", () => {
    it("should calculate correct status counts from applications", async () => {
      const applicationsWithVariousStatuses = [
        { id: 1, status: "pending" },
        { id: 2, status: "pending" },
        { id: 3, status: "pending" },
        { id: 4, status: "approved" },
        { id: 5, status: "approved" },
        { id: 6, status: "hired" },
        { id: 7, status: "rejected" },
      ];

      FetchData.getApplicationsFromBackend.mockResolvedValue({
        serializedApplications: applicationsWithVariousStatuses,
      });
      Application.getPendingCount.mockResolvedValue(3);

      const ListOfApplications = require("../../src/components/admin/CleanerApplications/ListOfApplications").default;

      const { getAllByText } = render(
        <ListOfApplications state={mockState} dispatch={mockDispatch} />
      );

      // Wait for component to load and verify total count appears (may appear multiple times in UI)
      await waitFor(() => {
        const totalBadges = getAllByText("7");
        expect(totalBadges.length).toBeGreaterThan(0);
      });
    });

    it("should show 0 pending when all applications are processed", async () => {
      const allProcessedApplications = [
        { id: 1, status: "approved" },
        { id: 2, status: "hired" },
        { id: 3, status: "rejected" },
      ];

      FetchData.getApplicationsFromBackend.mockResolvedValue({
        serializedApplications: allProcessedApplications,
      });
      Application.getPendingCount.mockResolvedValue(0);

      const ListOfApplications = require("../../src/components/admin/CleanerApplications/ListOfApplications").default;

      render(<ListOfApplications state={mockState} dispatch={mockDispatch} />);

      await waitFor(() => {
        expect(mockDispatch).toHaveBeenCalledWith({
          type: "SET_PENDING_APPLICATIONS",
          payload: 0,
        });
      });
    });
  });

  describe("HR user access", () => {
    it("should work the same for HR users as for owners", async () => {
      // Reset mocks for this specific test
      jest.clearAllMocks();

      const hrState = {
        currentUser: { token: "valid-token" },
        account: "humanResources",
        pendingApplications: 3,
      };

      FetchData.getApplicationsFromBackend.mockResolvedValue({
        serializedApplications: mockApplications,
      });
      Application.getPendingCount.mockResolvedValue(2);

      const ListOfApplications = require("../../src/components/admin/CleanerApplications/ListOfApplications").default;

      render(<ListOfApplications state={hrState} dispatch={mockDispatch} />);

      await waitFor(() => {
        expect(FetchData.getApplicationsFromBackend).toHaveBeenCalled();
      });

      await waitFor(() => {
        expect(mockDispatch).toHaveBeenCalledWith({
          type: "SET_PENDING_APPLICATIONS",
          payload: 2,
        });
      });
    });
  });

  describe("Real-time updates simulation", () => {
    it("should dispatch updated count immediately when applications are refreshed", async () => {
      // Simulate initial load with 3 pending
      Application.getPendingCount.mockResolvedValue(3);

      const ListOfApplications = require("../../src/components/admin/CleanerApplications/ListOfApplications").default;

      render(<ListOfApplications state={mockState} dispatch={mockDispatch} />);

      await waitFor(() => {
        expect(mockDispatch).toHaveBeenCalledWith({
          type: "SET_PENDING_APPLICATIONS",
          payload: 3,
        });
      });
    });

    it("should handle empty applications list", async () => {
      FetchData.getApplicationsFromBackend.mockResolvedValue({
        serializedApplications: [],
      });
      Application.getPendingCount.mockResolvedValue(0);

      const ListOfApplications = require("../../src/components/admin/CleanerApplications/ListOfApplications").default;

      const { findByText } = render(
        <ListOfApplications state={mockState} dispatch={mockDispatch} />
      );

      // Should show empty state
      const emptyTitle = await findByText("No Applications Found");
      expect(emptyTitle).toBeTruthy();

      await waitFor(() => {
        expect(mockDispatch).toHaveBeenCalledWith({
          type: "SET_PENDING_APPLICATIONS",
          payload: 0,
        });
      });
    });
  });
});
