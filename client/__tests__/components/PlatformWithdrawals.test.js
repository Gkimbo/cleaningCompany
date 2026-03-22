import React from "react";
import { render, fireEvent, waitFor, act } from "@testing-library/react-native";

// Mock the dependencies before importing the component
const mockNavigate = jest.fn();
jest.mock("react-router-native", () => ({
  useNavigate: () => mockNavigate,
  useLocation: () => ({ key: "test-history-key", pathname: "/", search: "", hash: "", state: null }),
}));

jest.mock("../../src/services/fetchRequests/OwnerDashboardService", () => ({
  __esModule: true,
  default: {
    getStripeBalance: jest.fn(),
    getWithdrawals: jest.fn(),
    createWithdrawal: jest.fn(),
  },
}));

jest.mock("react-native-vector-icons/FontAwesome", () => "Icon");

import PlatformWithdrawals from "../../src/components/owner/PlatformWithdrawals";
import OwnerDashboardService from "../../src/services/fetchRequests/OwnerDashboardService";

describe("PlatformWithdrawals", () => {
  const mockBalance = {
    available: { cents: 50000, dollars: "500.00" },
    pending: { cents: 10000, dollars: "100.00" },
    pendingWithdrawals: { cents: 0, dollars: "0.00", count: 0 },
    withdrawableBalance: { cents: 50000, dollars: "500.00" },
    withdrawnThisYear: {
      totalWithdrawnCents: 150000,
      totalWithdrawnDollars: "1500.00",
      withdrawalCount: 5,
    },
    currency: "usd",
  };

  const mockWithdrawals = {
    withdrawals: [
      {
        id: 1,
        transactionId: "ow_abc123",
        amount: { cents: 10000, dollars: "100.00" },
        status: "completed",
        bankAccountLast4: "4242",
        bankName: "Chase",
        requestedAt: "2025-01-15T10:00:00Z",
        processedAt: "2025-01-15T10:01:00Z",
        completedAt: "2025-01-16T10:00:00Z",
        estimatedArrival: null,
        failureReason: null,
        description: "Withdrawal of $100.00",
      },
      {
        id: 2,
        transactionId: "ow_def456",
        amount: { cents: 25000, dollars: "250.00" },
        status: "processing",
        bankAccountLast4: "4242",
        bankName: "Chase",
        requestedAt: "2025-01-20T10:00:00Z",
        processedAt: "2025-01-20T10:01:00Z",
        completedAt: null,
        estimatedArrival: "2025-01-22T10:00:00Z",
        failureReason: null,
        description: "Withdrawal of $250.00",
      },
      {
        id: 3,
        transactionId: "ow_ghi789",
        amount: { cents: 5000, dollars: "50.00" },
        status: "failed",
        bankAccountLast4: "4242",
        bankName: "Chase",
        requestedAt: "2025-01-10T10:00:00Z",
        processedAt: "2025-01-10T10:01:00Z",
        completedAt: null,
        estimatedArrival: null,
        failureReason: "Insufficient funds in Stripe account",
        description: "Withdrawal of $50.00",
      },
    ],
    total: 3,
    limit: 20,
    offset: 0,
  };

  const defaultProps = {
    state: {
      currentUser: {
        token: "test-token-123",
      },
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    OwnerDashboardService.getStripeBalance.mockResolvedValue(mockBalance);
    OwnerDashboardService.getWithdrawals.mockResolvedValue(mockWithdrawals);
  });

  describe("Loading State", () => {
    it("should show loading indicator while fetching data", async () => {
      OwnerDashboardService.getStripeBalance.mockImplementation(
        () => new Promise(() => {})
      );

      const { getByText } = render(<PlatformWithdrawals {...defaultProps} />);

      expect(getByText("Loading...")).toBeTruthy();
    });

    it("should hide loading indicator after data is fetched", async () => {
      const { queryByText, findByText } = render(
        <PlatformWithdrawals {...defaultProps} />
      );

      await findByText("Platform Withdrawals");

      expect(queryByText("Loading...")).toBeNull();
    });
  });

  describe("Balance Display", () => {
    it("should display available balance", async () => {
      const { findByText } = render(<PlatformWithdrawals {...defaultProps} />);

      // Check for "Available to Withdraw" label
      expect(await findByText("Available to Withdraw")).toBeTruthy();
    });

    it("should display Stripe balance details", async () => {
      const { findByText } = render(<PlatformWithdrawals {...defaultProps} />);

      expect(await findByText("Stripe Balance")).toBeTruthy();
    });

    it("should display pending balance", async () => {
      const { findByText } = render(<PlatformWithdrawals {...defaultProps} />);

      expect(await findByText("Pending in Stripe")).toBeTruthy();
    });

    it("should display pending withdrawals when present", async () => {
      const balanceWithPending = {
        ...mockBalance,
        pendingWithdrawals: { cents: 5000, dollars: "50.00", count: 2 },
        withdrawableBalance: { cents: 45000, dollars: "450.00" },
      };
      OwnerDashboardService.getStripeBalance.mockResolvedValue(balanceWithPending);

      const { findByText } = render(<PlatformWithdrawals {...defaultProps} />);

      expect(await findByText("Pending Withdrawals (2)")).toBeTruthy();
      expect(await findByText("-$50.00")).toBeTruthy();
    });

    it("should display year summary", async () => {
      const { findByText } = render(<PlatformWithdrawals {...defaultProps} />);

      expect(await findByText("This Year")).toBeTruthy();
      expect(await findByText("$1500.00")).toBeTruthy();
      expect(await findByText("Total Withdrawn")).toBeTruthy();
      expect(await findByText("5")).toBeTruthy();
      expect(await findByText("Withdrawals")).toBeTruthy();
    });
  });

  describe("Withdrawal Button", () => {
    it("should show withdraw button when balance is sufficient", async () => {
      const { findByText } = render(<PlatformWithdrawals {...defaultProps} />);

      expect(await findByText("Withdraw to Bank")).toBeTruthy();
    });

    it("should disable withdraw button when balance is below minimum", async () => {
      const lowBalance = {
        ...mockBalance,
        withdrawableBalance: { cents: 50, dollars: "0.50" },
      };
      OwnerDashboardService.getStripeBalance.mockResolvedValue(lowBalance);

      const { findByText } = render(<PlatformWithdrawals {...defaultProps} />);

      await findByText("Withdraw to Bank");
      expect(await findByText("Minimum withdrawal amount is $1.00")).toBeTruthy();
    });

    it("should open withdrawal modal when button is pressed", async () => {
      const { findByText } = render(<PlatformWithdrawals {...defaultProps} />);

      const withdrawButton = await findByText("Withdraw to Bank");
      fireEvent.press(withdrawButton);

      expect(await findByText("Withdraw Funds")).toBeTruthy();
    });
  });

  describe("Withdrawal Modal", () => {
    it("should display available balance in modal", async () => {
      const { findByText, findAllByText } = render(
        <PlatformWithdrawals {...defaultProps} />
      );

      const withdrawButton = await findByText("Withdraw to Bank");
      fireEvent.press(withdrawButton);

      expect(await findByText("Available: $500.00")).toBeTruthy();
    });

    it("should show amount input field", async () => {
      const { findByText, findByPlaceholderText } = render(
        <PlatformWithdrawals {...defaultProps} />
      );

      const withdrawButton = await findByText("Withdraw to Bank");
      fireEvent.press(withdrawButton);

      expect(await findByPlaceholderText("0.00")).toBeTruthy();
    });

    it("should show description input field", async () => {
      const { findByText, findByPlaceholderText } = render(
        <PlatformWithdrawals {...defaultProps} />
      );

      const withdrawButton = await findByText("Withdraw to Bank");
      fireEvent.press(withdrawButton);

      expect(await findByPlaceholderText("Description (optional)")).toBeTruthy();
    });

    it("should display modal title when opened", async () => {
      const { findByText } = render(
        <PlatformWithdrawals {...defaultProps} />
      );

      const withdrawButton = await findByText("Withdraw to Bank");
      fireEvent.press(withdrawButton);

      expect(await findByText("Withdraw Funds")).toBeTruthy();
    });

    it("should show error for invalid amount", async () => {
      const { findByText, findByPlaceholderText, findAllByText } = render(
        <PlatformWithdrawals {...defaultProps} />
      );

      const withdrawButton = await findByText("Withdraw to Bank");
      fireEvent.press(withdrawButton);

      const amountInput = await findByPlaceholderText("0.00");
      fireEvent.changeText(amountInput, "0.50");

      const modalButtons = await findAllByText("Withdraw to Bank");
      const modalWithdrawButton = modalButtons[modalButtons.length - 1];
      fireEvent.press(modalWithdrawButton);

      expect(
        await findByText("Please enter a valid amount (minimum $1.00)")
      ).toBeTruthy();
    });

    it("should show error when amount exceeds balance", async () => {
      const { findByText, findByPlaceholderText, findAllByText } = render(
        <PlatformWithdrawals {...defaultProps} />
      );

      const withdrawButton = await findByText("Withdraw to Bank");
      fireEvent.press(withdrawButton);

      const amountInput = await findByPlaceholderText("0.00");
      fireEvent.changeText(amountInput, "1000.00");

      const modalButtons = await findAllByText("Withdraw to Bank");
      const modalWithdrawButton = modalButtons[modalButtons.length - 1];
      fireEvent.press(modalWithdrawButton);

      expect(
        await findByText("Amount exceeds available balance of $500.00")
      ).toBeTruthy();
    });

    it("should call createWithdrawal with correct amount", async () => {
      OwnerDashboardService.createWithdrawal.mockResolvedValue({
        success: true,
        message: "Withdrawal of $100.00 initiated successfully",
      });

      const { findByText, findByPlaceholderText, findAllByText } = render(
        <PlatformWithdrawals {...defaultProps} />
      );

      const withdrawButton = await findByText("Withdraw to Bank");
      fireEvent.press(withdrawButton);

      const amountInput = await findByPlaceholderText("0.00");
      fireEvent.changeText(amountInput, "100.00");

      const modalButtons = await findAllByText("Withdraw to Bank");
      const modalWithdrawButton = modalButtons[modalButtons.length - 1];

      await act(async () => {
        fireEvent.press(modalWithdrawButton);
      });

      await waitFor(() => {
        expect(OwnerDashboardService.createWithdrawal).toHaveBeenCalledWith(
          "test-token-123",
          10000,
          ""
        );
      });
    });

    it("should include description when provided", async () => {
      OwnerDashboardService.createWithdrawal.mockResolvedValue({
        success: true,
        message: "Withdrawal of $100.00 initiated successfully",
      });

      const { findByText, findByPlaceholderText, findAllByText } = render(
        <PlatformWithdrawals {...defaultProps} />
      );

      const withdrawButton = await findByText("Withdraw to Bank");
      fireEvent.press(withdrawButton);

      const amountInput = await findByPlaceholderText("0.00");
      fireEvent.changeText(amountInput, "100.00");

      const descriptionInput = await findByPlaceholderText("Description (optional)");
      fireEvent.changeText(descriptionInput, "Monthly payout");

      const modalButtons = await findAllByText("Withdraw to Bank");
      const modalWithdrawButton = modalButtons[modalButtons.length - 1];

      await act(async () => {
        fireEvent.press(modalWithdrawButton);
      });

      await waitFor(() => {
        expect(OwnerDashboardService.createWithdrawal).toHaveBeenCalledWith(
          "test-token-123",
          10000,
          "Monthly payout"
        );
      });
    });

    it("should show success message after withdrawal", async () => {
      OwnerDashboardService.createWithdrawal.mockResolvedValue({
        success: true,
        message: "Withdrawal of $100.00 initiated successfully",
      });

      const { findByText, findByPlaceholderText, findAllByText } = render(
        <PlatformWithdrawals {...defaultProps} />
      );

      const withdrawButton = await findByText("Withdraw to Bank");
      fireEvent.press(withdrawButton);

      const amountInput = await findByPlaceholderText("0.00");
      fireEvent.changeText(amountInput, "100.00");

      const modalButtons = await findAllByText("Withdraw to Bank");
      const modalWithdrawButton = modalButtons[modalButtons.length - 1];

      await act(async () => {
        fireEvent.press(modalWithdrawButton);
      });

      expect(
        await findByText("Withdrawal of $100.00 initiated successfully")
      ).toBeTruthy();
    });

    it("should show error message when withdrawal fails", async () => {
      OwnerDashboardService.createWithdrawal.mockResolvedValue({
        success: false,
        error: "Failed to create payout",
      });

      const { findByText, findByPlaceholderText, findAllByText } = render(
        <PlatformWithdrawals {...defaultProps} />
      );

      const withdrawButton = await findByText("Withdraw to Bank");
      fireEvent.press(withdrawButton);

      const amountInput = await findByPlaceholderText("0.00");
      fireEvent.changeText(amountInput, "100.00");

      const modalButtons = await findAllByText("Withdraw to Bank");
      const modalWithdrawButton = modalButtons[modalButtons.length - 1];

      await act(async () => {
        fireEvent.press(modalWithdrawButton);
      });

      expect(await findByText("Failed to create payout")).toBeTruthy();
    });

    it("should show note about arrival time", async () => {
      const { findByText } = render(<PlatformWithdrawals {...defaultProps} />);

      const withdrawButton = await findByText("Withdraw to Bank");
      fireEvent.press(withdrawButton);

      expect(
        await findByText("Funds typically arrive in 1-2 business days")
      ).toBeTruthy();
    });
  });

  describe("Withdrawal History", () => {
    it("should display withdrawal history section", async () => {
      const { findByText } = render(<PlatformWithdrawals {...defaultProps} />);

      expect(await findByText("Withdrawal History")).toBeTruthy();
    });

    it("should display withdrawal amounts", async () => {
      const { findAllByText, findByText } = render(<PlatformWithdrawals {...defaultProps} />);

      // Wait for the history to load
      await findByText("Withdrawal History");

      // Dollar amounts are in the withdrawal history - use regex to match partial text
      const amount100 = await findAllByText(/100\.00/);
      const amount250 = await findAllByText(/250\.00/);
      const amount50 = await findAllByText(/50\.00/);

      expect(amount100.length).toBeGreaterThan(0);
      expect(amount250.length).toBeGreaterThan(0);
      expect(amount50.length).toBeGreaterThan(0);
    });

    it("should display completed status", async () => {
      const { findByText } = render(<PlatformWithdrawals {...defaultProps} />);

      expect(await findByText("Completed")).toBeTruthy();
    });

    it("should display processing status", async () => {
      const { findByText } = render(<PlatformWithdrawals {...defaultProps} />);

      expect(await findByText("Processing")).toBeTruthy();
    });

    it("should display failed status", async () => {
      const { findByText } = render(<PlatformWithdrawals {...defaultProps} />);

      expect(await findByText("Failed")).toBeTruthy();
    });

    it("should display failure reason for failed withdrawals", async () => {
      const { findByText } = render(<PlatformWithdrawals {...defaultProps} />);

      expect(
        await findByText("Insufficient funds in Stripe account")
      ).toBeTruthy();
    });

    it("should display bank account last 4 digits", async () => {
      const { findAllByText } = render(<PlatformWithdrawals {...defaultProps} />);

      const bankDigits = await findAllByText("****4242");
      expect(bankDigits.length).toBeGreaterThan(0);
    });

    it("should show empty state when no withdrawals", async () => {
      OwnerDashboardService.getWithdrawals.mockResolvedValue({
        withdrawals: [],
        total: 0,
        limit: 20,
        offset: 0,
      });

      const { findByText } = render(<PlatformWithdrawals {...defaultProps} />);

      expect(await findByText("No withdrawals yet")).toBeTruthy();
      expect(
        await findByText("Your withdrawal history will appear here")
      ).toBeTruthy();
    });
  });

  describe("Navigation", () => {
    it("should navigate back when back button is pressed", async () => {
      const { findByText, getByTestId } = render(
        <PlatformWithdrawals {...defaultProps} />
      );

      await findByText("Platform Withdrawals");

      // Find the back button by testID
      const backButton = getByTestId("back-button");
      fireEvent.press(backButton);

      expect(mockNavigate).toHaveBeenCalledWith(-1);
    });

    it("should display header title", async () => {
      const { findByText } = render(<PlatformWithdrawals {...defaultProps} />);

      expect(await findByText("Platform Withdrawals")).toBeTruthy();
    });
  });

  describe("Error Handling", () => {
    it("should display error banner when data fetch fails", async () => {
      OwnerDashboardService.getStripeBalance.mockRejectedValue(
        new Error("Network error")
      );

      const { findByText } = render(<PlatformWithdrawals {...defaultProps} />);

      expect(
        await findByText("Failed to load data. Please try again.")
      ).toBeTruthy();
    });
  });

  describe("Refresh", () => {
    it("should call fetch functions on mount", async () => {
      render(<PlatformWithdrawals {...defaultProps} />);

      await waitFor(() => {
        expect(OwnerDashboardService.getStripeBalance).toHaveBeenCalledWith(
          "test-token-123"
        );
        expect(OwnerDashboardService.getWithdrawals).toHaveBeenCalledWith(
          "test-token-123"
        );
      });
    });
  });

  describe("Date Formatting", () => {
    it("should format dates correctly", async () => {
      const { findByText } = render(<PlatformWithdrawals {...defaultProps} />);

      // The dates should be formatted as "Jan 15, 2025" etc.
      expect(await findByText("Jan 15, 2025")).toBeTruthy();
    });
  });
});
