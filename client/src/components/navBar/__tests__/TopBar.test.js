import React from "react";
import { render, waitFor, fireEvent } from "@testing-library/react-native";

// Mock react-router-native
const mockNavigate = jest.fn();
jest.mock("react-router-native", () => ({
  useNavigate: () => mockNavigate,
}));

// Mock ReferralService
const mockGetCurrentPrograms = jest.fn();
jest.mock("../../../services/fetchRequests/ReferralService", () => ({
  getCurrentPrograms: () => mockGetCurrentPrograms(),
}));

// Mock Application service
jest.mock("../../../services/fetchRequests/ApplicationClass", () => ({
  getPendingCount: jest.fn().mockResolvedValue(0),
}));

// Mock ClientDashboardService
jest.mock("../../../services/fetchRequests/ClientDashboardService", () => ({
  getPendingRequestsForClient: jest.fn().mockResolvedValue({ totalCount: 0 }),
}));

// Mock @expo/vector-icons
jest.mock("@expo/vector-icons", () => ({
  Feather: ({ name, ...props }) => {
    const { Text } = require("react-native");
    return <Text {...props}>{name}</Text>;
  },
}));

// Mock child components to simplify testing
jest.mock("../../messaging/MessagesButton", () => {
  const { View } = require("react-native");
  return () => <View testID="messages-button" />;
});

jest.mock("../HomeButton", () => {
  const { View } = require("react-native");
  return () => <View testID="home-button" />;
});

jest.mock("../SignoutButton", () => {
  const { View } = require("react-native");
  return () => <View testID="signout-button" />;
});

jest.mock("../AccountSettingsButton", () => {
  const { View } = require("react-native");
  return () => <View testID="account-settings-button" />;
});

jest.mock("../MyReferralsButton", () => {
  const { View } = require("react-native");
  return () => <View testID="my-referrals-button" />;
});

jest.mock("../ReferralsButton", () => {
  const { View } = require("react-native");
  return () => <View testID="referrals-button" />;
});

// Mock other nav buttons
jest.mock("../AppointmentsButton", () => () => null);
jest.mock("../BillButton", () => () => null);
jest.mock("../ChooseNewJobButton", () => () => null);
jest.mock("../CleanerRequestsButton", () => () => null);
jest.mock("../EarningsButton", () => () => null);
jest.mock("../EditHomeButton", () => () => null);
jest.mock("../EmployeeAssignmentsButton", () => () => null);
jest.mock("../ManageEmployeeButton", () => () => null);
jest.mock("../ManagePricingButton", () => () => null);
jest.mock("../IncentivesButton", () => () => null);
jest.mock("../MyRequestsButton", () => () => null);
jest.mock("../ScheduleCleaningButton", () => () => null);
jest.mock("../SeeAllAppointmentsButton", () => () => null);
jest.mock("../UnassignedAppointmentsButton", () => () => null);
jest.mock("../ViewApplicationsButton", () => () => null);
jest.mock("../RecommendedSuppliesButton", () => () => null);
jest.mock("../ArchiveButton", () => () => null);
jest.mock("../ReviewsButton", () => () => null);
jest.mock("../ChecklistEditorButton", () => () => null);
jest.mock("../HRManagementButton", () => () => null);
jest.mock("../TermsEditorButton", () => () => null);
jest.mock("../WithdrawalsButton", () => () => null);
jest.mock("../MyClientsButton", () => () => null);

import TopBar from "../TopBar";

describe("TopBar", () => {
  const mockDispatch = jest.fn();

  const createState = (overrides = {}) => ({
    currentUser: { token: "test-token" },
    account: null,
    appointments: [],
    pendingApplications: 0,
    pendingCleanerRequests: 0,
    ...overrides,
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockGetCurrentPrograms.mockReset();
  });

  // Helper to open the hamburger menu
  const openMenu = async (getByText) => {
    const menuIcon = getByText("menu");
    fireEvent.press(menuIcon);
  };

  describe("Referrals Button Visibility", () => {
    describe("when all referral programs are enabled", () => {
      beforeEach(() => {
        mockGetCurrentPrograms.mockResolvedValue({
          active: true,
          programs: [
            { type: "client_to_client", enabled: true },
            { type: "client_to_cleaner", enabled: true },
            { type: "cleaner_to_cleaner", enabled: true },
            { type: "cleaner_to_client", enabled: true },
          ],
        });
      });

      it("should show MyReferralsButton for clients", async () => {
        const state = createState({ account: null });
        const { getByTestId, getByText } = render(
          <TopBar dispatch={mockDispatch} state={state} />
        );

        await waitFor(() => {
          expect(mockGetCurrentPrograms).toHaveBeenCalled();
        });

        await openMenu(getByText);

        await waitFor(() => {
          expect(getByTestId("my-referrals-button")).toBeTruthy();
        });
      });

      it("should show MyReferralsButton for cleaners", async () => {
        const state = createState({ account: "cleaner" });
        const { getByTestId, getByText } = render(
          <TopBar dispatch={mockDispatch} state={state} />
        );

        await waitFor(() => {
          expect(mockGetCurrentPrograms).toHaveBeenCalled();
        });

        await openMenu(getByText);

        await waitFor(() => {
          expect(getByTestId("my-referrals-button")).toBeTruthy();
        });
      });
    });

    describe("when only client programs are enabled", () => {
      beforeEach(() => {
        mockGetCurrentPrograms.mockResolvedValue({
          active: true,
          programs: [
            { type: "client_to_client", enabled: true },
            { type: "client_to_cleaner", enabled: true },
          ],
        });
      });

      it("should show MyReferralsButton for clients", async () => {
        const state = createState({ account: null });
        const { getByTestId, getByText } = render(
          <TopBar dispatch={mockDispatch} state={state} />
        );

        await waitFor(() => {
          expect(mockGetCurrentPrograms).toHaveBeenCalled();
        });

        await openMenu(getByText);

        await waitFor(() => {
          expect(getByTestId("my-referrals-button")).toBeTruthy();
        });
      });

      it("should NOT show MyReferralsButton for cleaners", async () => {
        const state = createState({ account: "cleaner" });
        const { queryByTestId, getByText } = render(
          <TopBar dispatch={mockDispatch} state={state} />
        );

        await waitFor(() => {
          expect(mockGetCurrentPrograms).toHaveBeenCalled();
        });

        await openMenu(getByText);

        await waitFor(
          () => {
            expect(queryByTestId("my-referrals-button")).toBeNull();
          },
          { timeout: 1000 }
        );
      });
    });

    describe("when only cleaner programs are enabled", () => {
      beforeEach(() => {
        mockGetCurrentPrograms.mockResolvedValue({
          active: true,
          programs: [
            { type: "cleaner_to_cleaner", enabled: true },
            { type: "cleaner_to_client", enabled: true },
          ],
        });
      });

      it("should NOT show MyReferralsButton for clients", async () => {
        const state = createState({ account: null });
        const { queryByTestId, getByText } = render(
          <TopBar dispatch={mockDispatch} state={state} />
        );

        await waitFor(() => {
          expect(mockGetCurrentPrograms).toHaveBeenCalled();
        });

        await openMenu(getByText);

        await waitFor(
          () => {
            expect(queryByTestId("my-referrals-button")).toBeNull();
          },
          { timeout: 1000 }
        );
      });

      it("should show MyReferralsButton for cleaners", async () => {
        const state = createState({ account: "cleaner" });
        const { getByTestId, getByText } = render(
          <TopBar dispatch={mockDispatch} state={state} />
        );

        await waitFor(() => {
          expect(mockGetCurrentPrograms).toHaveBeenCalled();
        });

        await openMenu(getByText);

        await waitFor(() => {
          expect(getByTestId("my-referrals-button")).toBeTruthy();
        });
      });
    });

    describe("when only client_to_client is enabled", () => {
      beforeEach(() => {
        mockGetCurrentPrograms.mockResolvedValue({
          active: true,
          programs: [{ type: "client_to_client", enabled: true }],
        });
      });

      it("should show MyReferralsButton for clients", async () => {
        const state = createState({ account: null });
        const { getByTestId, getByText } = render(
          <TopBar dispatch={mockDispatch} state={state} />
        );

        await waitFor(() => {
          expect(mockGetCurrentPrograms).toHaveBeenCalled();
        });

        await openMenu(getByText);

        await waitFor(() => {
          expect(getByTestId("my-referrals-button")).toBeTruthy();
        });
      });

      it("should NOT show MyReferralsButton for cleaners", async () => {
        const state = createState({ account: "cleaner" });
        const { queryByTestId, getByText } = render(
          <TopBar dispatch={mockDispatch} state={state} />
        );

        await waitFor(() => {
          expect(mockGetCurrentPrograms).toHaveBeenCalled();
        });

        await openMenu(getByText);

        await waitFor(
          () => {
            expect(queryByTestId("my-referrals-button")).toBeNull();
          },
          { timeout: 1000 }
        );
      });
    });

    describe("when only cleaner_to_cleaner is enabled", () => {
      beforeEach(() => {
        mockGetCurrentPrograms.mockResolvedValue({
          active: true,
          programs: [{ type: "cleaner_to_cleaner", enabled: true }],
        });
      });

      it("should NOT show MyReferralsButton for clients", async () => {
        const state = createState({ account: null });
        const { queryByTestId, getByText } = render(
          <TopBar dispatch={mockDispatch} state={state} />
        );

        await waitFor(() => {
          expect(mockGetCurrentPrograms).toHaveBeenCalled();
        });

        await openMenu(getByText);

        await waitFor(
          () => {
            expect(queryByTestId("my-referrals-button")).toBeNull();
          },
          { timeout: 1000 }
        );
      });

      it("should show MyReferralsButton for cleaners", async () => {
        const state = createState({ account: "cleaner" });
        const { getByTestId, getByText } = render(
          <TopBar dispatch={mockDispatch} state={state} />
        );

        await waitFor(() => {
          expect(mockGetCurrentPrograms).toHaveBeenCalled();
        });

        await openMenu(getByText);

        await waitFor(() => {
          expect(getByTestId("my-referrals-button")).toBeTruthy();
        });
      });
    });

    describe("when referrals are disabled", () => {
      beforeEach(() => {
        mockGetCurrentPrograms.mockResolvedValue({
          active: false,
          programs: [],
        });
      });

      it("should NOT show MyReferralsButton for clients", async () => {
        const state = createState({ account: null });
        const { queryByTestId, getByText } = render(
          <TopBar dispatch={mockDispatch} state={state} />
        );

        await waitFor(() => {
          expect(mockGetCurrentPrograms).toHaveBeenCalled();
        });

        await openMenu(getByText);

        await waitFor(
          () => {
            expect(queryByTestId("my-referrals-button")).toBeNull();
          },
          { timeout: 1000 }
        );
      });

      it("should NOT show MyReferralsButton for cleaners", async () => {
        const state = createState({ account: "cleaner" });
        const { queryByTestId, getByText } = render(
          <TopBar dispatch={mockDispatch} state={state} />
        );

        await waitFor(() => {
          expect(mockGetCurrentPrograms).toHaveBeenCalled();
        });

        await openMenu(getByText);

        await waitFor(
          () => {
            expect(queryByTestId("my-referrals-button")).toBeNull();
          },
          { timeout: 1000 }
        );
      });
    });

    describe("when programs exist but active is false", () => {
      beforeEach(() => {
        mockGetCurrentPrograms.mockResolvedValue({
          active: false,
          programs: [{ type: "client_to_client", enabled: true }],
        });
      });

      it("should NOT show MyReferralsButton when active is false", async () => {
        const state = createState({ account: null });
        const { queryByTestId, getByText } = render(
          <TopBar dispatch={mockDispatch} state={state} />
        );

        await waitFor(() => {
          expect(mockGetCurrentPrograms).toHaveBeenCalled();
        });

        await openMenu(getByText);

        await waitFor(
          () => {
            expect(queryByTestId("my-referrals-button")).toBeNull();
          },
          { timeout: 1000 }
        );
      });
    });

    describe("when API call fails", () => {
      beforeEach(() => {
        mockGetCurrentPrograms.mockRejectedValue(new Error("Network error"));
      });

      it("should NOT show MyReferralsButton when API fails", async () => {
        const consoleSpy = jest.spyOn(console, "error").mockImplementation();
        const state = createState({ account: null });
        const { queryByTestId, getByText } = render(
          <TopBar dispatch={mockDispatch} state={state} />
        );

        await waitFor(() => {
          expect(mockGetCurrentPrograms).toHaveBeenCalled();
        });

        await openMenu(getByText);

        await waitFor(
          () => {
            expect(queryByTestId("my-referrals-button")).toBeNull();
          },
          { timeout: 1000 }
        );

        consoleSpy.mockRestore();
      });
    });

    describe("for owners", () => {
      it("should always show ReferralsButton for owners regardless of referral status", async () => {
        mockGetCurrentPrograms.mockResolvedValue({
          active: false,
          programs: [],
        });

        const state = createState({ account: "owner" });
        const { getByTestId, getByText } = render(
          <TopBar dispatch={mockDispatch} state={state} />
        );

        await openMenu(getByText);

        await waitFor(() => {
          expect(getByTestId("referrals-button")).toBeTruthy();
        });
      });

      it("should NOT call getCurrentPrograms for owners", async () => {
        const state = createState({ account: "owner" });
        render(<TopBar dispatch={mockDispatch} state={state} />);

        await new Promise((resolve) => setTimeout(resolve, 100));

        expect(mockGetCurrentPrograms).not.toHaveBeenCalled();
      });
    });

    describe("for unauthenticated users", () => {
      it("should NOT call getCurrentPrograms when not logged in", async () => {
        const state = createState({
          currentUser: { token: null },
        });

        render(<TopBar dispatch={mockDispatch} state={state} />);

        await new Promise((resolve) => setTimeout(resolve, 100));

        expect(mockGetCurrentPrograms).not.toHaveBeenCalled();
      });
    });

    describe("when active is true but programs array is empty", () => {
      beforeEach(() => {
        mockGetCurrentPrograms.mockResolvedValue({
          active: true,
          programs: [],
        });
      });

      it("should NOT show MyReferralsButton when no programs exist", async () => {
        const state = createState({ account: null });
        const { queryByTestId, getByText } = render(
          <TopBar dispatch={mockDispatch} state={state} />
        );

        await waitFor(() => {
          expect(mockGetCurrentPrograms).toHaveBeenCalled();
        });

        await openMenu(getByText);

        await waitFor(
          () => {
            expect(queryByTestId("my-referrals-button")).toBeNull();
          },
          { timeout: 1000 }
        );
      });
    });
  });
});
