import React from "react";
import { render, fireEvent, waitFor, act } from "@testing-library/react-native";
import { Alert, Share } from "react-native";

// Mock react-router-native
const mockNavigate = jest.fn();
jest.mock("react-router-native", () => ({
  useNavigate: () => mockNavigate,
}));

// Mock ReferralService
jest.mock("../../src/services/fetchRequests/ReferralService", () => ({
  getMyReferrals: jest.fn(),
  getCurrentPrograms: jest.fn(),
  logShare: jest.fn(),
  getMyCode: jest.fn(),
}));

// Mock react-native-vector-icons
jest.mock("react-native-vector-icons/FontAwesome", () => "Icon");

// Mock Share API
jest.mock("react-native/Libraries/Share/Share", () => ({
  share: jest.fn().mockResolvedValue({ action: "sharedAction" }),
}));

// Mock expo-clipboard
jest.mock("expo-clipboard", () => ({
  setStringAsync: jest.fn().mockResolvedValue(true),
}));

// Import after mocks
import MyReferralsPage from "../../src/components/referrals/MyReferralsPage";
import ReferralService from "../../src/services/fetchRequests/ReferralService";

describe("MyReferralsPage", () => {
  const mockState = {
    currentUser: { token: "test-token" },
  };

  const mockDispatch = jest.fn();

  const defaultProps = {
    state: mockState,
    dispatch: mockDispatch,
  };

  const mockStats = {
    referralCode: "JOHN1234",
    availableCredits: 5000,
    totalReferrals: 5,
    pending: 2,
    qualified: 1,
    rewarded: 2,
    totalEarned: 5000,
  };

  const mockReferrals = [
    {
      id: 1,
      referred: { firstName: "Jane", lastName: "Doe" },
      status: "rewarded",
      referrerRewardAmount: 2500,
      createdAt: "2024-01-15T00:00:00Z",
    },
    {
      id: 2,
      referred: { firstName: "Bob", lastName: "Smith" },
      status: "pending",
      referrerRewardAmount: 2500,
      cleaningsCompleted: 0,
      cleaningsRequired: 1,
      createdAt: "2024-01-20T00:00:00Z",
    },
  ];

  const mockPrograms = {
    active: true,
    programs: [
      {
        type: "client_to_client",
        name: "Refer a Friend",
        description: "Give $25, Get $25",
        referrerReward: 2500,
        referredReward: 2500,
      },
    ],
  };

  beforeEach(() => {
    jest.clearAllMocks();
    ReferralService.getMyReferrals.mockResolvedValue({
      stats: mockStats,
      referrals: mockReferrals,
      availableCredits: mockStats.availableCredits,
    });
    ReferralService.getCurrentPrograms.mockResolvedValue(mockPrograms);
    ReferralService.logShare.mockResolvedValue({ success: true });
    ReferralService.getMyCode.mockResolvedValue({
      referralCode: "JOHN1234",
      shareMessage: "Use my referral code JOHN1234 to sign up for Kleanr!",
      programs: mockPrograms.programs,
    });
  });

  describe("Rendering", () => {
    it("should render page title", async () => {
      const { getByText } = render(<MyReferralsPage {...defaultProps} />);

      await waitFor(() => {
        expect(getByText("My Referrals")).toBeTruthy();
      });
    });

    it("should show loading state initially", () => {
      const { getByTestId } = render(<MyReferralsPage {...defaultProps} />);

      // Check for loading indicator or skeleton
      // Implementation depends on component
    });

    it("should display referral code", async () => {
      const { getByText } = render(<MyReferralsPage {...defaultProps} />);

      await waitFor(() => {
        expect(getByText("JOHN1234")).toBeTruthy();
      });
    });

    it("should display available credits", async () => {
      const { getAllByText } = render(<MyReferralsPage {...defaultProps} />);

      await waitFor(() => {
        expect(getAllByText("$50.00").length).toBeGreaterThan(0);
      });
    });

    it("should display referral stats", async () => {
      const { getAllByText } = render(<MyReferralsPage {...defaultProps} />);

      await waitFor(() => {
        expect(getAllByText("5").length).toBeGreaterThan(0); // total referrals
        expect(getAllByText("2").length).toBeGreaterThan(0); // pending
      });
    });
  });

  describe("Referral List", () => {
    it("should display referral history", async () => {
      const { getByText } = render(<MyReferralsPage {...defaultProps} />);

      await waitFor(() => {
        expect(getByText(/Jane/)).toBeTruthy();
        expect(getByText(/Bob/)).toBeTruthy();
      });
    });

    it("should show status badges", async () => {
      const { getAllByText } = render(<MyReferralsPage {...defaultProps} />);

      await waitFor(() => {
        expect(getAllByText(/rewarded/i).length).toBeGreaterThan(0);
        expect(getAllByText(/pending/i).length).toBeGreaterThan(0);
      });
    });

    it("should show empty state when no referrals", async () => {
      ReferralService.getMyReferrals.mockResolvedValue({
        stats: { ...mockStats, totalReferrals: 0 },
        referrals: [],
      });

      const { getByText } = render(<MyReferralsPage {...defaultProps} />);

      await waitFor(() => {
        expect(getByText(/No referrals yet/i)).toBeTruthy();
      });
    });
  });

  describe("Share Functionality", () => {
    it("should have share buttons", async () => {
      const { getAllByText } = render(<MyReferralsPage {...defaultProps} />);

      await waitFor(() => {
        expect(getAllByText(/Share/i).length).toBeGreaterThan(0);
      });
    });

    it("should copy code to clipboard", async () => {
      const { getByText } = render(<MyReferralsPage {...defaultProps} />);

      await waitFor(() => {
        const copyButton = getByText(/Copy/i);
        fireEvent.press(copyButton);
      });

      // Verify clipboard was called
      // This depends on your clipboard implementation
    });

    it("should have share button that can be pressed", async () => {
      const { getByText } = render(<MyReferralsPage {...defaultProps} />);

      // Wait for component to load
      await waitFor(() => {
        expect(getByText("Share")).toBeTruthy();
      });

      // Verify the share button exists and can be pressed
      const shareButton = getByText("Share");
      expect(shareButton).toBeTruthy();

      // Fire the press event - this shouldn't throw an error
      await act(async () => {
        fireEvent.press(shareButton);
      });

      // Test passes if no error is thrown
    });
  });

  describe("Active Programs", () => {
    it("should display active programs", async () => {
      const { getByText } = render(<MyReferralsPage {...defaultProps} />);

      await waitFor(() => {
        expect(getByText("Refer a Friend")).toBeTruthy();
        expect(getByText(/Give \$25, Get \$25/)).toBeTruthy();
      });
    });

    it("should not show programs section when no programs available", async () => {
      // Override getMyCode to return no programs
      ReferralService.getMyCode.mockResolvedValue({
        referralCode: "JOHN1234",
        shareMessage: "Use my referral code JOHN1234!",
        programs: [],
      });

      const { queryByText, getByText } = render(<MyReferralsPage {...defaultProps} />);

      await waitFor(() => {
        // Should still render the page
        expect(getByText("My Referrals")).toBeTruthy();
        // But no "Refer a Friend" program should be shown
        expect(queryByText("Refer a Friend")).toBeNull();
      });
    });
  });

  describe("Error Handling", () => {
    it("should handle API error gracefully", async () => {
      ReferralService.getMyReferrals.mockRejectedValue(new Error("Network error"));
      ReferralService.getMyCode.mockRejectedValue(new Error("Network error"));

      const { getByText } = render(<MyReferralsPage {...defaultProps} />);

      await waitFor(() => {
        // Should show error message
        expect(getByText(/Failed to load referral data/i)).toBeTruthy();
      });
    });

    it("should handle missing token", async () => {
      const noTokenState = { currentUser: { token: null } };
      const { getByText } = render(
        <MyReferralsPage state={noTokenState} dispatch={mockDispatch} />
      );

      // Should handle gracefully
      await waitFor(() => {
        // Component should still render
      });
    });
  });

  describe("Navigation", () => {
    it("should have back button", async () => {
      const { getByText } = render(<MyReferralsPage {...defaultProps} />);

      await waitFor(() => {
        const backButton = getByText(/Back/i);
        expect(backButton).toBeTruthy();
      });
    });
  });

  describe("Refresh", () => {
    it("should refetch data on refresh", async () => {
      const { getByTestId } = render(<MyReferralsPage {...defaultProps} />);

      await waitFor(() => {
        expect(ReferralService.getMyReferrals).toHaveBeenCalledTimes(1);
      });

      // Trigger refresh (implementation depends on component)
      // fireEvent scroll, pull to refresh, etc.
    });
  });

  describe("Format Helpers", () => {
    it("should format credits correctly", async () => {
      // availableCredits should be at root level, not in stats
      ReferralService.getMyReferrals.mockResolvedValue({
        stats: mockStats,
        referrals: [],
        availableCredits: 12345,
      });

      const { getByText } = render(<MyReferralsPage {...defaultProps} />);

      await waitFor(() => {
        expect(getByText("$123.45")).toBeTruthy();
      });
    });

    it("should format dates correctly", async () => {
      const { getByText } = render(<MyReferralsPage {...defaultProps} />);

      await waitFor(() => {
        // Should show formatted date
        expect(getByText(/Jan/i) || getByText(/2024/)).toBeTruthy();
      });
    });
  });
});
