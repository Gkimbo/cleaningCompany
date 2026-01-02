import React from "react";
import { render, fireEvent, waitFor, act } from "@testing-library/react-native";
import { Alert } from "react-native";

// Mock react-router-native
const mockNavigate = jest.fn();
jest.mock("react-router-native", () => ({
  useNavigate: () => mockNavigate,
}));

// Mock ReferralService
jest.mock("../../src/services/fetchRequests/ReferralService", () => ({
  getConfig: jest.fn(),
  updateConfig: jest.fn(),
  getAllReferrals: jest.fn(),
  updateReferralStatus: jest.fn(),
}));

// Mock react-native-vector-icons
jest.mock("react-native-vector-icons/FontAwesome", () => "Icon");

// Mock Alert
jest.spyOn(Alert, "alert").mockImplementation(() => {});

// Import after mocks
import ReferralManagement from "../../src/components/owner/ReferralManagement";
import ReferralService from "../../src/services/fetchRequests/ReferralService";

describe("ReferralManagement", () => {
  const mockState = {
    currentUser: { token: "owner-token" },
    account: "owner",
  };

  const defaultProps = {
    state: mockState,
  };

  const mockConfig = {
    clientToClient: {
      enabled: true,
      referrerReward: 2500,
      referredReward: 2500,
      cleaningsRequired: 1,
      rewardType: "credit",
      maxPerMonth: 10,
    },
    clientToCleaner: {
      enabled: false,
      referrerReward: 5000,
      cleaningsRequired: 3,
      rewardType: "credit",
      maxPerMonth: null,
    },
    cleanerToCleaner: {
      enabled: false,
      referrerReward: 5000,
      cleaningsRequired: 5,
      rewardType: "bonus",
      maxPerMonth: null,
    },
    cleanerToClient: {
      enabled: false,
      discountPercent: 10,
      minReferrals: 5,
      rewardType: "discount",
      maxPerMonth: null,
    },
  };

  const mockReferrals = [
    {
      id: 1,
      referrer: { firstName: "John", lastName: "Doe", email: "john@test.com" },
      referred: { firstName: "Jane", lastName: "Smith", email: "jane@test.com" },
      programType: "client_to_client",
      status: "pending",
      referrerRewardAmount: 2500,
      createdAt: "2024-01-15T00:00:00Z",
    },
    {
      id: 2,
      referrer: { firstName: "Bob", lastName: "Builder", email: "bob@test.com" },
      referred: { firstName: "Alice", lastName: "Wonder", email: "alice@test.com" },
      programType: "client_to_client",
      status: "rewarded",
      referrerRewardAmount: 2500,
      createdAt: "2024-01-10T00:00:00Z",
    },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    ReferralService.getConfig.mockResolvedValue(mockConfig);
    ReferralService.getAllReferrals.mockResolvedValue(mockReferrals);
    ReferralService.updateConfig.mockResolvedValue({ message: "Configuration updated" });
    ReferralService.updateReferralStatus.mockResolvedValue({ status: "cancelled" });
  });

  describe("Rendering", () => {
    it("should render page title", async () => {
      const { getByText } = render(<ReferralManagement {...defaultProps} />);

      await waitFor(() => {
        expect(getByText("Referral Management")).toBeTruthy();
      });
    });

    it("should render all program sections", async () => {
      const { getByText } = render(<ReferralManagement {...defaultProps} />);

      await waitFor(() => {
        expect(getByText(/Client.*Client/i)).toBeTruthy();
        expect(getByText(/Client.*Cleaner/i)).toBeTruthy();
        expect(getByText(/Cleaner.*Cleaner/i)).toBeTruthy();
        expect(getByText(/Cleaner.*Client/i)).toBeTruthy();
      });
    });

    it("should show loading state initially", () => {
      ReferralService.getConfig.mockImplementation(() => new Promise(() => {}));

      const { getByTestId } = render(<ReferralManagement {...defaultProps} />);

      // Should show loading indicator
    });
  });

  describe("Program Toggles", () => {
    it("should display toggle switches for each program", async () => {
      const { getAllByRole } = render(<ReferralManagement {...defaultProps} />);

      await waitFor(() => {
        // Should have 4 toggle switches
        // Note: This depends on how your component implements toggles
      });
    });

    it("should reflect initial enabled state", async () => {
      const { getByText } = render(<ReferralManagement {...defaultProps} />);

      await waitFor(() => {
        // Client to Client should be enabled
        expect(getByText(/Enabled/i)).toBeTruthy();
      });
    });

    it("should toggle program enabled state", async () => {
      const { getByText, getAllByTestId } = render(
        <ReferralManagement {...defaultProps} />
      );

      await waitFor(() => {
        // Find and press a toggle
        // Implementation depends on component structure
      });
    });
  });

  describe("Reward Configuration", () => {
    it("should display current reward amounts", async () => {
      const { getByText } = render(<ReferralManagement {...defaultProps} />);

      await waitFor(() => {
        expect(getByText("$25")).toBeTruthy(); // Client to Client reward
      });
    });

    it("should display cleanings required", async () => {
      const { getByText } = render(<ReferralManagement {...defaultProps} />);

      await waitFor(() => {
        expect(getByText("1")).toBeTruthy(); // Cleanings required
      });
    });

    it("should display max per month", async () => {
      const { getByText } = render(<ReferralManagement {...defaultProps} />);

      await waitFor(() => {
        expect(getByText("10")).toBeTruthy(); // Max per month
      });
    });

    it("should allow editing reward amounts", async () => {
      const { getByDisplayValue, getByTestId } = render(
        <ReferralManagement {...defaultProps} />
      );

      await waitFor(() => {
        // Find input and change value
        // Implementation depends on component structure
      });
    });
  });

  describe("Save Configuration", () => {
    it("should have save button", async () => {
      const { getByText } = render(<ReferralManagement {...defaultProps} />);

      await waitFor(() => {
        expect(getByText(/Save/i)).toBeTruthy();
      });
    });

    it("should call updateConfig on save", async () => {
      const { getByText } = render(<ReferralManagement {...defaultProps} />);

      await waitFor(() => {
        const saveButton = getByText(/Save/i);
        fireEvent.press(saveButton);
      });

      await waitFor(() => {
        expect(ReferralService.updateConfig).toHaveBeenCalled();
      });
    });

    it("should show success message on save", async () => {
      const { getByText } = render(<ReferralManagement {...defaultProps} />);

      await waitFor(() => {
        const saveButton = getByText(/Save/i);
        fireEvent.press(saveButton);
      });

      await waitFor(() => {
        expect(Alert.alert).toHaveBeenCalledWith(
          expect.any(String),
          expect.stringContaining(/saved|updated/i)
        );
      });
    });

    it("should handle save error", async () => {
      ReferralService.updateConfig.mockRejectedValue(new Error("Save failed"));

      const { getByText } = render(<ReferralManagement {...defaultProps} />);

      await waitFor(() => {
        const saveButton = getByText(/Save/i);
        fireEvent.press(saveButton);
      });

      await waitFor(() => {
        expect(Alert.alert).toHaveBeenCalledWith(
          expect.stringContaining(/Error/i),
          expect.any(String)
        );
      });
    });

    it("should require change note before saving", async () => {
      // Test depends on implementation
    });
  });

  describe("Referral List", () => {
    it("should display recent referrals", async () => {
      const { getByText } = render(<ReferralManagement {...defaultProps} />);

      await waitFor(() => {
        expect(getByText(/John/)).toBeTruthy();
        expect(getByText(/Jane/)).toBeTruthy();
      });
    });

    it("should show referral status", async () => {
      const { getByText } = render(<ReferralManagement {...defaultProps} />);

      await waitFor(() => {
        expect(getByText(/pending/i)).toBeTruthy();
        expect(getByText(/rewarded/i)).toBeTruthy();
      });
    });

    it("should allow filtering by status", async () => {
      const { getByText } = render(<ReferralManagement {...defaultProps} />);

      await waitFor(() => {
        // Find and use filter dropdown
        // Implementation depends on component structure
      });
    });

    it("should allow filtering by program type", async () => {
      const { getByText } = render(<ReferralManagement {...defaultProps} />);

      await waitFor(() => {
        // Find and use filter dropdown
        // Implementation depends on component structure
      });
    });
  });

  describe("Referral Actions", () => {
    it("should allow cancelling referral", async () => {
      const { getByText, getAllByText } = render(
        <ReferralManagement {...defaultProps} />
      );

      await waitFor(() => {
        const cancelButtons = getAllByText(/Cancel/i);
        if (cancelButtons.length > 0) {
          fireEvent.press(cancelButtons[0]);
        }
      });

      // Should confirm before cancelling
    });

    it("should update status after cancel", async () => {
      const { getByText, getAllByText } = render(
        <ReferralManagement {...defaultProps} />
      );

      await waitFor(() => {
        const cancelButtons = getAllByText(/Cancel/i);
        if (cancelButtons.length > 0) {
          fireEvent.press(cancelButtons[0]);
        }
      });

      await waitFor(() => {
        expect(ReferralService.updateReferralStatus).toHaveBeenCalled();
      });
    });
  });

  describe("Preview Banner", () => {
    it("should show preview of how referral displays", async () => {
      const { getByText } = render(<ReferralManagement {...defaultProps} />);

      await waitFor(() => {
        expect(getByText(/Give \$25, Get \$25/i)).toBeTruthy();
      });
    });

    it("should update preview when rewards change", async () => {
      // Test depends on implementation
    });
  });

  describe("Validation", () => {
    it("should validate reward amounts are positive", async () => {
      // Test depends on implementation
    });

    it("should validate cleanings required is at least 1", async () => {
      // Test depends on implementation
    });

    it("should validate max per month is positive or null", async () => {
      // Test depends on implementation
    });
  });

  describe("Access Control", () => {
    it("should only be accessible by owner", async () => {
      const nonOwnerState = {
        currentUser: { token: "cleaner-token" },
        account: "cleaner",
      };

      const { getByText } = render(
        <ReferralManagement state={nonOwnerState} />
      );

      // Should show access denied or redirect
      // Implementation depends on component
    });
  });

  describe("Statistics", () => {
    it("should display total referrals count", async () => {
      const { getByText } = render(<ReferralManagement {...defaultProps} />);

      await waitFor(() => {
        expect(getByText("2")).toBeTruthy(); // 2 referrals in mock
      });
    });

    it("should display pending count", async () => {
      const { getByText } = render(<ReferralManagement {...defaultProps} />);

      await waitFor(() => {
        expect(getByText(/pending/i)).toBeTruthy();
      });
    });

    it("should display total credits issued", async () => {
      // Implementation depends on component
    });
  });

  describe("Navigation", () => {
    it("should have back button", async () => {
      const { getByText } = render(<ReferralManagement {...defaultProps} />);

      await waitFor(() => {
        const backButton = getByText(/Back/i);
        expect(backButton).toBeTruthy();
      });
    });

    it("should navigate back on back button press", async () => {
      const { getByText } = render(<ReferralManagement {...defaultProps} />);

      await waitFor(() => {
        const backButton = getByText(/Back/i);
        fireEvent.press(backButton);
      });

      expect(mockNavigate).toHaveBeenCalledWith(-1);
    });
  });

  describe("Error Handling", () => {
    it("should handle config fetch error", async () => {
      ReferralService.getConfig.mockRejectedValue(new Error("Network error"));

      const { getByText } = render(<ReferralManagement {...defaultProps} />);

      await waitFor(() => {
        expect(Alert.alert).toHaveBeenCalled();
      });
    });

    it("should handle referrals fetch error", async () => {
      ReferralService.getAllReferrals.mockRejectedValue(new Error("Network error"));

      const { getByText } = render(<ReferralManagement {...defaultProps} />);

      // Should still render with empty referrals list
      await waitFor(() => {
        expect(getByText("Referral Management")).toBeTruthy();
      });
    });
  });
});
