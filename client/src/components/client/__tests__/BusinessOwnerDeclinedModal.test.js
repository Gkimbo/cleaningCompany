/**
 * Tests for Business Owner Declined Modal
 * Tests the client-facing modal for responding to a business owner's decline
 */

import React from "react";
import { render, fireEvent, waitFor, act } from "@testing-library/react-native";
import { Alert } from "react-native";

// Mock fetch
global.fetch = jest.fn();

// Mock UserContext
const mockUserState = {
  currentUser: { token: "test-token", id: 200 },
};

jest.mock("../../../context/UserContext", () => {
  const React = require("react");
  return {
    UserContext: React.createContext({
      state: mockUserState,
    }),
  };
});

// Mock Feather icons
jest.mock("@expo/vector-icons", () => ({
  Feather: ({ name, testID, ...props }) => {
    const { Text } = require("react-native");
    return <Text testID={testID || `icon-${name}`} {...props}>{name}</Text>;
  },
}));

// Mock the config
jest.mock("../../../services/config", () => ({
  API_BASE: "http://test-api.com/api/v1",
}));

// Mock theme
jest.mock("../../../services/styles/theme", () => ({
  colors: {
    primary: { 50: "#f0f9ff", 100: "#e0f2fe", 500: "#0ea5e9", 600: "#0284c7", 700: "#0369a1" },
    error: { 50: "#fef2f2", 100: "#fee2e2", 200: "#fecaca", 500: "#ef4444" },
    success: { 50: "#f0fdf4", 100: "#dcfce7", 200: "#bbf7d0", 500: "#22c55e", 700: "#15803d" },
    warning: { 100: "#fef3c7", 500: "#f59e0b" },
    neutral: { 0: "#fff", 100: "#f5f5f5", 500: "#737373", 600: "#525252", 700: "#404040", 800: "#262626", 900: "#171717" },
  },
  spacing: { xs: 4, sm: 8, md: 12, lg: 16, xl: 20 },
  radius: { md: 8, lg: 12 },
  typography: { fontSize: { sm: 12, md: 14, xl: 20 } },
}));

// Mock formatters
jest.mock("../../../services/formatters", () => ({
  formatCurrency: (cents) => `$${(cents / 100).toFixed(2)}`,
}));

// Mock dateUtils
jest.mock("../../../utils/dateUtils", () => ({
  parseLocalDate: (date) => new Date(date),
}));

// Mock Alert
jest.spyOn(Alert, "alert");

// Import after mocks
import BusinessOwnerDeclinedModal from "../BusinessOwnerDeclinedModal";
import { UserContext } from "../../../context/UserContext";

// Wrapper component that provides UserContext
const TestWrapper = ({ children }) => (
  <UserContext.Provider value={{ state: mockUserState }}>
    {children}
  </UserContext.Provider>
);

const renderWithProviders = (component) => {
  return render(<TestWrapper>{component}</TestWrapper>);
};

describe("BusinessOwnerDeclinedModal", () => {
  const mockNotification = {
    data: {
      appointmentId: 123,
      businessOwnerName: "Demo Cleaning Co",
      appointmentDate: "2025-02-15",
      reason: "Staff unavailable for this date",
    },
  };

  const mockOnClose = jest.fn();
  const mockOnComplete = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch.mockReset();
  });

  describe("Initial Render - Choice Step", () => {
    it("should render the modal when visible", () => {
      const { getByText } = renderWithProviders(
        <BusinessOwnerDeclinedModal
          visible={true}
          notification={mockNotification}
          onClose={mockOnClose}
          onComplete={mockOnComplete}
        />
      );

      expect(getByText("Appointment Update")).toBeTruthy();
    });

    it("should display the business owner name", () => {
      const { getByText } = renderWithProviders(
        <BusinessOwnerDeclinedModal
          visible={true}
          notification={mockNotification}
          onClose={mockOnClose}
          onComplete={mockOnComplete}
        />
      );

      expect(getByText(/Demo Cleaning Co/)).toBeTruthy();
    });

    it("should display the decline reason if provided", () => {
      const { getByText } = renderWithProviders(
        <BusinessOwnerDeclinedModal
          visible={true}
          notification={mockNotification}
          onClose={mockOnClose}
          onComplete={mockOnComplete}
        />
      );

      expect(getByText("Staff unavailable for this date")).toBeTruthy();
    });

    it("should show cancel option", () => {
      const { getByText } = renderWithProviders(
        <BusinessOwnerDeclinedModal
          visible={true}
          notification={mockNotification}
          onClose={mockOnClose}
          onComplete={mockOnComplete}
        />
      );

      expect(getByText("Cancel Appointment")).toBeTruthy();
    });

    it("should show find another cleaner option", () => {
      const { getByText } = renderWithProviders(
        <BusinessOwnerDeclinedModal
          visible={true}
          notification={mockNotification}
          onClose={mockOnClose}
          onComplete={mockOnComplete}
        />
      );

      expect(getByText("Find Another Cleaner")).toBeTruthy();
    });
  });

  describe("Cancel Appointment Flow", () => {
    it("should call the cancel endpoint when cancel is pressed", async () => {
      const mockResponse = {
        ok: true,
        json: () => Promise.resolve({ success: true, action: "cancelled" }),
      };
      global.fetch.mockResolvedValueOnce(mockResponse);

      const { getByText } = renderWithProviders(
        <BusinessOwnerDeclinedModal
          visible={true}
          notification={mockNotification}
          onClose={mockOnClose}
          onComplete={mockOnComplete}
        />
      );

      await act(async () => {
        fireEvent.press(getByText("Cancel Appointment"));
      });

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          "http://test-api.com/api/v1/appointments/123/decline-response",
          expect.objectContaining({
            method: "POST",
            body: JSON.stringify({ action: "cancel" }),
          })
        );
      });
    });

    it("should show success alert after cancellation", async () => {
      const mockResponse = {
        ok: true,
        json: () => Promise.resolve({ success: true, action: "cancelled" }),
      };
      global.fetch.mockResolvedValueOnce(mockResponse);

      const { getByText } = renderWithProviders(
        <BusinessOwnerDeclinedModal
          visible={true}
          notification={mockNotification}
          onClose={mockOnClose}
          onComplete={mockOnComplete}
        />
      );

      await act(async () => {
        fireEvent.press(getByText("Cancel Appointment"));
      });

      await waitFor(() => {
        expect(Alert.alert).toHaveBeenCalledWith(
          "Appointment Cancelled",
          "Your appointment has been cancelled.",
          expect.any(Array)
        );
      });
    });
  });

  describe("Marketplace Flow - Complete Home Details", () => {
    it("should call the marketplace endpoint when find cleaner is pressed", async () => {
      const mockResponse = {
        ok: true,
        json: () => Promise.resolve({ confirmRequired: true, marketplacePrice: 200, currentPrice: 150, homeId: 1 }),
      };
      global.fetch.mockResolvedValueOnce(mockResponse);

      const { getByText } = renderWithProviders(
        <BusinessOwnerDeclinedModal
          visible={true}
          notification={mockNotification}
          onClose={mockOnClose}
          onComplete={mockOnComplete}
        />
      );

      await act(async () => {
        fireEvent.press(getByText("Find Another Cleaner"));
      });

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          "http://test-api.com/api/v1/appointments/123/decline-response",
          expect.objectContaining({
            method: "POST",
            body: JSON.stringify({ action: "marketplace" }),
          })
        );
      });
    });

    it("should show home details form when home is incomplete", async () => {
      const mockResponse = {
        ok: true,
        json: () => Promise.resolve({
          needsHomeDetails: true,
          missingFields: ["numBeds", "numBaths"],
          homeId: 1,
        }),
      };
      global.fetch.mockResolvedValueOnce(mockResponse);

      const { getByText, findByText } = renderWithProviders(
        <BusinessOwnerDeclinedModal
          visible={true}
          notification={mockNotification}
          onClose={mockOnClose}
          onComplete={mockOnComplete}
        />
      );

      await act(async () => {
        fireEvent.press(getByText("Find Another Cleaner"));
      });

      const detailsText = await findByText("Complete Home Details");
      expect(detailsText).toBeTruthy();
    });
  });

  describe("Marketplace Flow - Price Confirmation", () => {
    it("should show price confirmation when home details are complete", async () => {
      const mockResponse = {
        ok: true,
        json: () => Promise.resolve({
          confirmRequired: true,
          marketplacePrice: 200,
          currentPrice: 150,
          homeId: 1,
        }),
      };
      global.fetch.mockResolvedValueOnce(mockResponse);

      const { getByText, queryByText } = renderWithProviders(
        <BusinessOwnerDeclinedModal
          visible={true}
          notification={mockNotification}
          onClose={mockOnClose}
          onComplete={mockOnComplete}
        />
      );

      await act(async () => {
        fireEvent.press(getByText("Find Another Cleaner"));
      });

      await waitFor(() => {
        expect(queryByText("$200.00")).toBeTruthy();
      });
    });

    it("should call confirm-marketplace endpoint when confirm is pressed", async () => {
      // First response for marketplace check
      const marketplaceResponse = {
        ok: true,
        json: () => Promise.resolve({
          confirmRequired: true,
          marketplacePrice: 200,
          currentPrice: 150,
          homeId: 1,
        }),
      };
      // Second response for confirm
      const confirmResponse = {
        ok: true,
        json: () => Promise.resolve({ success: true, marketplacePrice: 200 }),
      };

      global.fetch
        .mockResolvedValueOnce(marketplaceResponse)
        .mockResolvedValueOnce(confirmResponse);

      const { getByText, queryByText } = renderWithProviders(
        <BusinessOwnerDeclinedModal
          visible={true}
          notification={mockNotification}
          onClose={mockOnClose}
          onComplete={mockOnComplete}
        />
      );

      // Press Find Another Cleaner
      await act(async () => {
        fireEvent.press(getByText("Find Another Cleaner"));
      });

      // Wait for price confirmation step
      await waitFor(() => {
        expect(queryByText("$200.00")).toBeTruthy();
      });

      // Press Confirm
      await act(async () => {
        fireEvent.press(getByText("Confirm"));
      });

      await waitFor(() => {
        expect(global.fetch).toHaveBeenLastCalledWith(
          "http://test-api.com/api/v1/appointments/123/confirm-marketplace",
          expect.objectContaining({
            method: "POST",
          })
        );
      });
    });
  });

  describe("Success State", () => {
    it("should show success message after confirming marketplace", async () => {
      const marketplaceResponse = {
        ok: true,
        json: () => Promise.resolve({
          confirmRequired: true,
          marketplacePrice: 200,
          currentPrice: 150,
          homeId: 1,
        }),
      };
      const confirmResponse = {
        ok: true,
        json: () => Promise.resolve({ success: true, marketplacePrice: 200 }),
      };

      global.fetch
        .mockResolvedValueOnce(marketplaceResponse)
        .mockResolvedValueOnce(confirmResponse);

      const { getByText, queryByText } = renderWithProviders(
        <BusinessOwnerDeclinedModal
          visible={true}
          notification={mockNotification}
          onClose={mockOnClose}
          onComplete={mockOnComplete}
        />
      );

      // Navigate through the flow
      await act(async () => {
        fireEvent.press(getByText("Find Another Cleaner"));
      });

      // Wait for price confirmation step
      await waitFor(() => {
        expect(queryByText("$200.00")).toBeTruthy();
      });

      await act(async () => {
        fireEvent.press(getByText("Confirm"));
      });

      await waitFor(() => {
        expect(queryByText("You're All Set!")).toBeTruthy();
      });
    });
  });

  describe("Error Handling", () => {
    it("should show error alert when cancel fails", async () => {
      const mockResponse = {
        ok: false,
        json: () => Promise.resolve({ error: "Failed to cancel" }),
      };
      global.fetch.mockResolvedValueOnce(mockResponse);

      const { getByText } = renderWithProviders(
        <BusinessOwnerDeclinedModal
          visible={true}
          notification={mockNotification}
          onClose={mockOnClose}
          onComplete={mockOnComplete}
        />
      );

      await act(async () => {
        fireEvent.press(getByText("Cancel Appointment"));
      });

      await waitFor(() => {
        expect(Alert.alert).toHaveBeenCalledWith("Error", "Failed to cancel");
      });
    });

    it("should show error alert when marketplace request fails", async () => {
      const mockResponse = {
        ok: false,
        json: () => Promise.resolve({ error: "Appointment not eligible" }),
      };
      global.fetch.mockResolvedValueOnce(mockResponse);

      const { getByText } = renderWithProviders(
        <BusinessOwnerDeclinedModal
          visible={true}
          notification={mockNotification}
          onClose={mockOnClose}
          onComplete={mockOnComplete}
        />
      );

      await act(async () => {
        fireEvent.press(getByText("Find Another Cleaner"));
      });

      await waitFor(() => {
        expect(Alert.alert).toHaveBeenCalledWith("Error", "Appointment not eligible");
      });
    });
  });

  describe("Modal Close", () => {
    it("should call onClose when close button is pressed", () => {
      const { getByTestId } = renderWithProviders(
        <BusinessOwnerDeclinedModal
          visible={true}
          notification={mockNotification}
          onClose={mockOnClose}
          onComplete={mockOnComplete}
        />
      );

      fireEvent.press(getByTestId("icon-x"));
      expect(mockOnClose).toHaveBeenCalled();
    });
  });

  describe("No Notification Data", () => {
    it("should handle missing notification data gracefully", () => {
      const { getByText } = renderWithProviders(
        <BusinessOwnerDeclinedModal
          visible={true}
          notification={{ data: {} }}
          onClose={mockOnClose}
          onComplete={mockOnComplete}
        />
      );

      expect(getByText("Appointment Update")).toBeTruthy();
      expect(getByText(/Your cleaning service/)).toBeTruthy();
    });
  });
});
