import React from "react";
import { render, waitFor, fireEvent, act } from "@testing-library/react-native";

// Mock dependencies
jest.mock("react-router-native", () => ({
  useNavigate: () => jest.fn(),
}));

jest.mock("@expo/vector-icons", () => ({
  Feather: "Feather",
}));

jest.mock("../../src/services/fetchRequests/ApplicationClass", () => ({
  __esModule: true,
  default: {
    getPendingCount: jest.fn(),
  },
}));

// Mock nav button components
jest.mock("../../src/components/navBar/AppointmentsButton", () => "AppointmentsButton");
jest.mock("../../src/components/navBar/BillButton", () => "BillButton");
jest.mock("../../src/components/navBar/ChooseNewJobButton", () => "ChooseNewJobButton");
jest.mock("../../src/components/navBar/CleanerRequestsButton", () => "CleanerRequestsButton");
jest.mock("../../src/components/navBar/EarningsButton", () => "EarningsButton");
jest.mock("../../src/components/navBar/EditHomeButton", () => "EditHomeButton");
jest.mock("../../src/components/navBar/EmployeeAssignmentsButton", () => "EmployeeAssignmentsButton");
jest.mock("../../src/components/navBar/HomeButton", () => "HomeButton");
jest.mock("../../src/components/navBar/ManageEmployeeButton", () => "ManageEmployees");
jest.mock("../../src/components/navBar/ManagePricingButton", () => "ManagePricingButton");
jest.mock("../../src/components/navBar/MyRequestsButton", () => "MyRequestsButton");
jest.mock("../../src/components/navBar/ScheduleCleaningButton", () => "ScheduleCleaningButton");
jest.mock("../../src/components/navBar/SeeAllAppointmentsButton", () => "SeeAllAppointments");
jest.mock("../../src/components/navBar/SignoutButton", () => "SignOutButton");
jest.mock("../../src/components/navBar/UnassignedAppointmentsButton", () => "UnassignedAppointmentsButton");
jest.mock("../../src/components/navBar/ViewApplicationsButton", () => "ViewApplicationsButton");
jest.mock("../../src/components/messaging/MessagesButton", () => "MessagesButton");
jest.mock("../../src/components/navBar/AccountSettingsButton", () => "AccountSettingsButton");
jest.mock("../../src/components/navBar/IncentivesButton", () => "IncentivesButton");
jest.mock("../../src/components/navBar/RecommendedSuppliesButton", () => "RecommendedSuppliesButton");
jest.mock("../../src/components/navBar/ArchiveButton", () => "ArchiveButton");
jest.mock("../../src/components/navBar/ReviewsButton", () => "ReviewsButton");
jest.mock("../../src/components/navBar/ReferralsButton", () => "ReferralsButton");
jest.mock("../../src/components/navBar/MyReferralsButton", () => "MyReferralsButton");
jest.mock("../../src/services/fetchRequests/ClientDashboardService", () => ({
  __esModule: true,
  default: {
    getPendingRequestsForClient: jest.fn().mockResolvedValue({ totalCount: 0 }),
  },
}));

// Mock SocketContext
jest.mock("../../src/services/SocketContext", () => ({
  useSocket: () => ({
    socket: {
      on: jest.fn(),
      off: jest.fn(),
      emit: jest.fn(),
    },
    isConnected: false,
    emit: jest.fn(),
    on: jest.fn(),
    off: jest.fn(),
    onNotification: jest.fn(() => jest.fn()), // Returns unsubscribe function
    onNotificationCountUpdate: jest.fn(() => jest.fn()), // Returns unsubscribe function
  }),
  SocketProvider: ({ children }) => children,
}));

import TopBar from "../../src/components/navBar/TopBar";
import Application from "../../src/services/fetchRequests/ApplicationClass";

describe("TopBar", () => {
  const mockDispatch = jest.fn();

  const authenticatedOwnerState = {
    currentUser: { token: "valid-token" },
    account: "owner",
    appointments: [],
    pendingApplications: 0,
  };

  const authenticatedCleanerState = {
    currentUser: { token: "valid-token" },
    account: "cleaner",
    appointments: [],
  };

  const authenticatedHRState = {
    currentUser: { token: "valid-token" },
    account: "humanResources",
    appointments: [],
    pendingApplications: 0,
  };

  const authenticatedHomeownerState = {
    currentUser: { token: "valid-token" },
    account: null,
    appointments: [{ id: 1 }],
  };

  const unauthenticatedState = {
    currentUser: { token: null },
    account: null,
    appointments: [],
  };

  beforeEach(() => {
    jest.clearAllMocks();
    Application.getPendingCount.mockResolvedValue(0);
  });

  describe("Application Notification Badge", () => {
    it("should fetch pending applications count for owner", async () => {
      Application.getPendingCount.mockResolvedValue(3);

      render(
        <TopBar dispatch={mockDispatch} state={authenticatedOwnerState} />
      );

      await waitFor(() => {
        expect(Application.getPendingCount).toHaveBeenCalled();
      });
    });

    it("should not fetch pending applications for non-owners", async () => {
      render(
        <TopBar dispatch={mockDispatch} state={authenticatedCleanerState} />
      );

      await waitFor(() => {
        expect(Application.getPendingCount).not.toHaveBeenCalled();
      });
    });

    it("should not fetch pending applications for homeowners", async () => {
      render(
        <TopBar dispatch={mockDispatch} state={authenticatedHomeownerState} />
      );

      await waitFor(() => {
        expect(Application.getPendingCount).not.toHaveBeenCalled();
      });
    });

    it("should display badge when there are pending applications", async () => {
      Application.getPendingCount.mockResolvedValue(5);

      const stateWithPending = {
        ...authenticatedOwnerState,
        pendingApplications: 5,
      };

      const { findByText } = render(
        <TopBar dispatch={mockDispatch} state={stateWithPending} />
      );

      const badge = await findByText("5");
      expect(badge).toBeTruthy();
    });

    it("should not display badge when pending count is 0", async () => {
      Application.getPendingCount.mockResolvedValue(0);

      const { queryByText } = render(
        <TopBar dispatch={mockDispatch} state={authenticatedOwnerState} />
      );

      // Wait for the component to settle
      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 100));
      });

      // Badge should not be visible
      expect(queryByText("0")).toBeNull();
    });

    it("should display '9+' when pending count exceeds 9", async () => {
      Application.getPendingCount.mockResolvedValue(15);

      const stateWithPending = {
        ...authenticatedOwnerState,
        pendingApplications: 15,
      };

      const { findByText } = render(
        <TopBar dispatch={mockDispatch} state={stateWithPending} />
      );

      const badge = await findByText("9+");
      expect(badge).toBeTruthy();
    });

    it("should display exact count for numbers 1-9", async () => {
      Application.getPendingCount.mockResolvedValue(7);

      const stateWithPending = {
        ...authenticatedOwnerState,
        pendingApplications: 7,
      };

      const { findByText } = render(
        <TopBar dispatch={mockDispatch} state={stateWithPending} />
      );

      const badge = await findByText("7");
      expect(badge).toBeTruthy();
    });

    it("should handle zero pending count (no badge shown)", async () => {
      // When count is 0, no badge should be displayed
      Application.getPendingCount.mockResolvedValue(0);

      const { queryByText, getByText } = render(
        <TopBar dispatch={mockDispatch} state={authenticatedOwnerState} />
      );

      // Wait for async operations
      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 100));
      });

      // Brand should be visible (component rendered)
      expect(getByText("Kleanr")).toBeTruthy();

      // No badge text should be visible when count is 0
      expect(queryByText("0")).toBeNull();
      expect(queryByText("9+")).toBeNull();
    });
  });

  describe("Authenticated User Views", () => {
    it("should display brand name 'Kleanr' for authenticated users", () => {
      const { getByText } = render(
        <TopBar dispatch={mockDispatch} state={authenticatedOwnerState} />
      );

      expect(getByText("Kleanr")).toBeTruthy();
    });

    it("should display hamburger menu for authenticated users", () => {
      const { UNSAFE_getAllByType } = render(
        <TopBar dispatch={mockDispatch} state={authenticatedOwnerState} />
      );

      // Feather icons are used for the hamburger menu
      const featherIcons = UNSAFE_getAllByType("Feather");
      expect(featherIcons.length).toBeGreaterThan(0);
    });
  });

  describe("Unauthenticated User Views", () => {
    it("should display Sign In button for unauthenticated users", () => {
      const { getByText } = render(
        <TopBar dispatch={mockDispatch} state={unauthenticatedState} />
      );

      expect(getByText("Sign In")).toBeTruthy();
    });

    it("should display Sign Up button for unauthenticated users", () => {
      const { getByText } = render(
        <TopBar dispatch={mockDispatch} state={unauthenticatedState} />
      );

      expect(getByText("Sign Up")).toBeTruthy();
    });

    it("should display Become a Cleaner button for unauthenticated users", () => {
      const { getByText } = render(
        <TopBar dispatch={mockDispatch} state={unauthenticatedState} />
      );

      expect(getByText("Become a Cleaner")).toBeTruthy();
    });

    it("should not fetch pending applications for unauthenticated users", async () => {
      render(
        <TopBar dispatch={mockDispatch} state={unauthenticatedState} />
      );

      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 100));
      });

      expect(Application.getPendingCount).not.toHaveBeenCalled();
    });
  });

  describe("Modal Behavior", () => {
    it("should render hamburger menu button for authenticated users", () => {
      const { UNSAFE_getAllByType } = render(
        <TopBar dispatch={mockDispatch} state={authenticatedOwnerState} />
      );

      // Feather icons are used for the hamburger menu
      const featherIcons = UNSAFE_getAllByType("Feather");
      const menuIcon = featherIcons.find(icon => icon.props.name === "menu");
      expect(menuIcon).toBeTruthy();
    });
  });

  describe("Owner-specific features", () => {
    it("should have notification button for owners with pending applications", async () => {
      Application.getPendingCount.mockResolvedValue(3);

      const stateWithPending = {
        ...authenticatedOwnerState,
        pendingApplications: 3,
      };

      const { findByText } = render(
        <TopBar dispatch={mockDispatch} state={stateWithPending} />
      );

      const badge = await findByText("3");
      expect(badge).toBeTruthy();
    });
  });

  describe("Cleaner-specific menu items", () => {
    it("should not show notification badge for cleaners", async () => {
      Application.getPendingCount.mockResolvedValue(5);

      const { queryByText } = render(
        <TopBar dispatch={mockDispatch} state={authenticatedCleanerState} />
      );

      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 100));
      });

      // Badge should not appear for cleaners
      expect(queryByText("5")).toBeNull();
      expect(queryByText("9+")).toBeNull();
    });
  });

  describe("Badge edge cases", () => {
    it("should handle exactly 9 pending applications", async () => {
      Application.getPendingCount.mockResolvedValue(9);

      const stateWithPending = {
        ...authenticatedOwnerState,
        pendingApplications: 9,
      };

      const { findByText, queryByText } = render(
        <TopBar dispatch={mockDispatch} state={stateWithPending} />
      );

      const badge = await findByText("9");
      expect(badge).toBeTruthy();
      expect(queryByText("9+")).toBeNull();
    });

    it("should handle exactly 10 pending applications", async () => {
      Application.getPendingCount.mockResolvedValue(10);

      const stateWithPending = {
        ...authenticatedOwnerState,
        pendingApplications: 10,
      };

      const { findByText } = render(
        <TopBar dispatch={mockDispatch} state={stateWithPending} />
      );

      const badge = await findByText("9+");
      expect(badge).toBeTruthy();
    });

    it("should handle 1 pending application", async () => {
      Application.getPendingCount.mockResolvedValue(1);

      const stateWithPending = {
        ...authenticatedOwnerState,
        pendingApplications: 1,
      };

      const { findByText } = render(
        <TopBar dispatch={mockDispatch} state={stateWithPending} />
      );

      const badge = await findByText("1");
      expect(badge).toBeTruthy();
    });
  });

  describe("Re-fetch on account change", () => {
    it("should re-fetch pending count when account changes to owner", async () => {
      Application.getPendingCount.mockResolvedValue(2);

      const { rerender } = render(
        <TopBar dispatch={mockDispatch} state={authenticatedCleanerState} />
      );

      // Should not have been called for cleaner
      expect(Application.getPendingCount).not.toHaveBeenCalled();

      // Change to owner
      rerender(
        <TopBar dispatch={mockDispatch} state={authenticatedOwnerState} />
      );

      await waitFor(() => {
        expect(Application.getPendingCount).toHaveBeenCalled();
      });
    });
  });

  describe("HR User Application Notifications", () => {
    it("should fetch pending applications count for HR users", async () => {
      Application.getPendingCount.mockResolvedValue(3);

      render(
        <TopBar dispatch={mockDispatch} state={authenticatedHRState} />
      );

      await waitFor(() => {
        expect(Application.getPendingCount).toHaveBeenCalled();
      });
    });

    it("should display badge for HR users when there are pending applications", async () => {
      Application.getPendingCount.mockResolvedValue(4);

      const stateWithPending = {
        ...authenticatedHRState,
        pendingApplications: 4,
      };

      const { findByText } = render(
        <TopBar dispatch={mockDispatch} state={stateWithPending} />
      );

      const badge = await findByText("4");
      expect(badge).toBeTruthy();
    });

    it("should dispatch SET_PENDING_APPLICATIONS for HR users", async () => {
      Application.getPendingCount.mockResolvedValue(5);

      render(
        <TopBar dispatch={mockDispatch} state={authenticatedHRState} />
      );

      await waitFor(() => {
        expect(mockDispatch).toHaveBeenCalledWith({
          type: "SET_PENDING_APPLICATIONS",
          payload: 5,
        });
      });
    });

    it("should dispatch SET_PENDING_APPLICATIONS for owner users", async () => {
      Application.getPendingCount.mockResolvedValue(3);

      render(
        <TopBar dispatch={mockDispatch} state={authenticatedOwnerState} />
      );

      await waitFor(() => {
        expect(mockDispatch).toHaveBeenCalledWith({
          type: "SET_PENDING_APPLICATIONS",
          payload: 3,
        });
      });
    });

    it("should not fetch pending applications for cleaners", async () => {
      render(
        <TopBar dispatch={mockDispatch} state={authenticatedCleanerState} />
      );

      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 100));
      });

      expect(Application.getPendingCount).not.toHaveBeenCalled();
    });

    it("should show same badge for both owner and HR with same pending count", async () => {
      Application.getPendingCount.mockResolvedValue(6);

      const ownerStateWithPending = {
        ...authenticatedOwnerState,
        pendingApplications: 6,
      };

      const hrStateWithPending = {
        ...authenticatedHRState,
        pendingApplications: 6,
      };

      const { findByText: findByTextOwner } = render(
        <TopBar dispatch={mockDispatch} state={ownerStateWithPending} />
      );

      const ownerBadge = await findByTextOwner("6");
      expect(ownerBadge).toBeTruthy();

      const { findByText: findByTextHR } = render(
        <TopBar dispatch={mockDispatch} state={hrStateWithPending} />
      );

      const hrBadge = await findByTextHR("6");
      expect(hrBadge).toBeTruthy();
    });
  });

  describe("Global State for Pending Applications", () => {
    it("should read pendingApplications from global state", async () => {
      const stateWithGlobalPending = {
        ...authenticatedOwnerState,
        pendingApplications: 8,
      };

      const { findByText } = render(
        <TopBar dispatch={mockDispatch} state={stateWithGlobalPending} />
      );

      const badge = await findByText("8");
      expect(badge).toBeTruthy();
    });

    it("should not show badge when global pendingApplications is 0", async () => {
      const stateWithZeroPending = {
        ...authenticatedOwnerState,
        pendingApplications: 0,
      };

      const { queryByText, getByText } = render(
        <TopBar dispatch={mockDispatch} state={stateWithZeroPending} />
      );

      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 100));
      });

      expect(getByText("Kleanr")).toBeTruthy();
      expect(queryByText("0")).toBeNull();
    });

    it("should update badge when global state changes", async () => {
      const initialState = {
        ...authenticatedOwnerState,
        pendingApplications: 3,
      };

      const { findByText, rerender } = render(
        <TopBar dispatch={mockDispatch} state={initialState} />
      );

      const initialBadge = await findByText("3");
      expect(initialBadge).toBeTruthy();

      // Simulate state update (e.g., after status change)
      const updatedState = {
        ...authenticatedOwnerState,
        pendingApplications: 2,
      };

      rerender(
        <TopBar dispatch={mockDispatch} state={updatedState} />
      );

      const updatedBadge = await findByText("2");
      expect(updatedBadge).toBeTruthy();
    });

    it("should hide badge when pendingApplications becomes 0", async () => {
      const initialState = {
        ...authenticatedOwnerState,
        pendingApplications: 1,
      };

      const { findByText, rerender, queryByText } = render(
        <TopBar dispatch={mockDispatch} state={initialState} />
      );

      const initialBadge = await findByText("1");
      expect(initialBadge).toBeTruthy();

      // Simulate last pending application being approved/hired
      const updatedState = {
        ...authenticatedOwnerState,
        pendingApplications: 0,
      };

      rerender(
        <TopBar dispatch={mockDispatch} state={updatedState} />
      );

      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 100));
      });

      expect(queryByText("1")).toBeNull();
    });
  });
});
