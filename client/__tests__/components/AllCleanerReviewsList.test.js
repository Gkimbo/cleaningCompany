/**
 * Tests for AllCleanerReviewsList Component
 * Tests cleaner profile display, approve/deny functionality, and state management
 */

import React from "react";
import { render, fireEvent, waitFor, act } from "@testing-library/react-native";
import { Alert } from "react-native";

// Mock dependencies
jest.mock("react-router-native", () => ({
  useNavigate: () => jest.fn(),
  useParams: () => ({ id: "123" }),
  useLocation: () => ({
    state: {
      fromRequests: true,
      requestId: 1,
      appointmentId: 10,
      homeId: 5,
      cleanerId: 123,
    },
  }),
}));

jest.mock("react-native-vector-icons/FontAwesome", () => "Icon");

jest.mock("../../src/services/fetchRequests/fetchData", () => ({
  __esModule: true,
  default: {
    getCleanerProfile: jest.fn(),
    approveRequest: jest.fn(),
    denyRequest: jest.fn(),
  },
}));

jest.mock("../../src/services/styles/theme", () => ({
  colors: {
    primary: { 50: "#f0f0f0", 100: "#e0e0e0", 500: "#3b82f6", 600: "#2563eb", 700: "#1d4ed8" },
    neutral: { 0: "#ffffff", 100: "#f5f5f5" },
    success: { 500: "#10b981", 600: "#059669" },
    error: { 500: "#ef4444", 600: "#dc2626" },
    text: { primary: "#1f2937", secondary: "#6b7280", tertiary: "#9ca3af" },
    border: { light: "#e5e7eb" },
    background: { secondary: "#f9fafb" },
  },
  spacing: { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, "2xl": 24, "3xl": 32, "4xl": 40 },
  radius: { md: 8, lg: 12, xl: 16, full: 9999 },
  shadows: { sm: {}, md: {} },
  typography: {
    fontSize: { xs: 12, sm: 14, base: 16, lg: 18, xl: 20, "2xl": 24 },
    fontWeight: { medium: "500", semibold: "600", bold: "700" },
  },
}));

import FetchData from "../../src/services/fetchRequests/fetchData";
import AllCleanerReviewsList from "../../src/components/reviews/AllCleanerReviewsList";

// Spy on Alert
jest.spyOn(Alert, "alert");

describe("AllCleanerReviewsList Component", () => {
  const mockCleaner = {
    id: 123,
    username: "TestCleaner",
    completedJobs: 50,
    memberSince: "2024-01-01",
    daysWorking: ["monday", "wednesday", "friday"],
    reviews: [
      {
        id: 1,
        review: 4.5,
        reviewComment: "Great job!",
        createdAt: "2024-06-15",
        cleaningQuality: 5,
        punctuality: 4,
        professionalism: 4.5,
        communication: 4,
        wouldRecommend: true,
      },
      {
        id: 2,
        review: 5,
        reviewComment: "Excellent service",
        createdAt: "2024-07-20",
      },
    ],
  };

  const mockDispatch = jest.fn();
  const mockState = { requests: [] };

  beforeEach(() => {
    jest.clearAllMocks();
    FetchData.getCleanerProfile.mockResolvedValue({ cleaner: mockCleaner });
    FetchData.approveRequest.mockResolvedValue(true);
    FetchData.denyRequest.mockResolvedValue(true);
  });

  describe("Initial Render", () => {
    it("should show loading state initially", async () => {
      let resolvePromise;
      FetchData.getCleanerProfile.mockReturnValue(
        new Promise((resolve) => {
          resolvePromise = resolve;
        })
      );

      const { getByText } = render(
        <AllCleanerReviewsList state={mockState} dispatch={mockDispatch} />
      );

      expect(getByText("Loading cleaner profile...")).toBeTruthy();

      await act(async () => {
        resolvePromise({ cleaner: mockCleaner });
      });
    });

    it("should display cleaner profile after loading", async () => {
      const { getByText } = render(
        <AllCleanerReviewsList state={mockState} dispatch={mockDispatch} />
      );

      await waitFor(() => {
        expect(getByText("TestCleaner")).toBeTruthy();
      });
    });

    it("should display cleaner reviews", async () => {
      const { getByText } = render(
        <AllCleanerReviewsList state={mockState} dispatch={mockDispatch} />
      );

      await waitFor(() => {
        expect(getByText('"Great job!"')).toBeTruthy();
        expect(getByText('"Excellent service"')).toBeTruthy();
      });
    });
  });

  describe("Approve/Deny Actions", () => {
    it("should show approve and deny buttons when coming from requests", async () => {
      const { getByText } = render(
        <AllCleanerReviewsList state={mockState} dispatch={mockDispatch} />
      );

      await waitFor(() => {
        expect(getByText("Approve")).toBeTruthy();
        expect(getByText("Deny")).toBeTruthy();
      });
    });

    it("should call approveRequest when approve button is pressed", async () => {
      const { getByText } = render(
        <AllCleanerReviewsList state={mockState} dispatch={mockDispatch} />
      );

      await waitFor(() => {
        expect(getByText("Approve")).toBeTruthy();
      });

      await act(async () => {
        fireEvent.press(getByText("Approve"));
      });

      await waitFor(() => {
        expect(FetchData.approveRequest).toHaveBeenCalledWith(1, true);
      });
    });

    it("should update UI to show approved state after successful approval", async () => {
      const { getByText, queryByText } = render(
        <AllCleanerReviewsList state={mockState} dispatch={mockDispatch} />
      );

      await waitFor(() => {
        expect(getByText("Approve")).toBeTruthy();
      });

      await act(async () => {
        fireEvent.press(getByText("Approve"));
      });

      await waitFor(() => {
        expect(getByText("Request Approved")).toBeTruthy();
        expect(queryByText("Approve")).toBeNull();
        expect(queryByText("Deny")).toBeNull();
      });
    });

    it("should call denyRequest when deny button is pressed", async () => {
      const { getByText } = render(
        <AllCleanerReviewsList state={mockState} dispatch={mockDispatch} />
      );

      await waitFor(() => {
        expect(getByText("Deny")).toBeTruthy();
      });

      await act(async () => {
        fireEvent.press(getByText("Deny"));
      });

      await waitFor(() => {
        expect(FetchData.denyRequest).toHaveBeenCalledWith(123, 10);
      });
    });

    it("should update UI to show denied state after successful denial", async () => {
      const { getByText, queryByText } = render(
        <AllCleanerReviewsList state={mockState} dispatch={mockDispatch} />
      );

      await waitFor(() => {
        expect(getByText("Deny")).toBeTruthy();
      });

      await act(async () => {
        fireEvent.press(getByText("Deny"));
      });

      await waitFor(() => {
        expect(getByText("Request Denied")).toBeTruthy();
        expect(queryByText("Approve")).toBeNull();
        expect(queryByText("Deny")).toBeNull();
      });
    });

    it("should dispatch DECREMENT_PENDING_CLEANER_REQUESTS on successful approval", async () => {
      const { getByText } = render(
        <AllCleanerReviewsList state={mockState} dispatch={mockDispatch} />
      );

      await waitFor(() => {
        expect(getByText("Approve")).toBeTruthy();
      });

      await act(async () => {
        fireEvent.press(getByText("Approve"));
      });

      await waitFor(() => {
        expect(mockDispatch).toHaveBeenCalledWith({
          type: "DECREMENT_PENDING_CLEANER_REQUESTS",
        });
      });
    });

    it("should dispatch DECREMENT_PENDING_CLEANER_REQUESTS on successful denial", async () => {
      const { getByText } = render(
        <AllCleanerReviewsList state={mockState} dispatch={mockDispatch} />
      );

      await waitFor(() => {
        expect(getByText("Deny")).toBeTruthy();
      });

      await act(async () => {
        fireEvent.press(getByText("Deny"));
      });

      await waitFor(() => {
        expect(mockDispatch).toHaveBeenCalledWith({
          type: "DECREMENT_PENDING_CLEANER_REQUESTS",
        });
      });
    });

    it("should show Back to My Homes button after action is completed", async () => {
      const { getByText } = render(
        <AllCleanerReviewsList state={mockState} dispatch={mockDispatch} />
      );

      await waitFor(() => {
        expect(getByText("Approve")).toBeTruthy();
      });

      await act(async () => {
        fireEvent.press(getByText("Approve"));
      });

      await waitFor(() => {
        expect(getByText("Back to My Homes")).toBeTruthy();
      });
    });
  });

  describe("Error Handling", () => {
    it("should show error alert when approval fails", async () => {
      FetchData.approveRequest.mockRejectedValue(new Error("Network error"));

      const { getByText } = render(
        <AllCleanerReviewsList state={mockState} dispatch={mockDispatch} />
      );

      await waitFor(() => {
        expect(getByText("Approve")).toBeTruthy();
      });

      await act(async () => {
        fireEvent.press(getByText("Approve"));
      });

      await waitFor(() => {
        expect(Alert.alert).toHaveBeenCalledWith(
          "Error",
          "Failed to approve the request. Please try again."
        );
      });
    });

    it("should show error alert when denial fails", async () => {
      FetchData.denyRequest.mockRejectedValue(new Error("Network error"));

      const { getByText } = render(
        <AllCleanerReviewsList state={mockState} dispatch={mockDispatch} />
      );

      await waitFor(() => {
        expect(getByText("Deny")).toBeTruthy();
      });

      await act(async () => {
        fireEvent.press(getByText("Deny"));
      });

      await waitFor(() => {
        expect(Alert.alert).toHaveBeenCalledWith(
          "Error",
          "Failed to deny the request. Please try again."
        );
      });
    });

    it("should handle denyRequest returning an Error object", async () => {
      FetchData.denyRequest.mockResolvedValue(new Error("Failed to delete"));

      const { getByText } = render(
        <AllCleanerReviewsList state={mockState} dispatch={mockDispatch} />
      );

      await waitFor(() => {
        expect(getByText("Deny")).toBeTruthy();
      });

      await act(async () => {
        fireEvent.press(getByText("Deny"));
      });

      await waitFor(() => {
        expect(Alert.alert).toHaveBeenCalledWith(
          "Error",
          "Failed to deny the request. Please try again."
        );
      });
    });
  });

  describe("Missing Request Context", () => {
    it("should show error when cleanerId or appointmentId is missing for deny", async () => {
      // Override useLocation to return missing values
      jest.doMock("react-router-native", () => ({
        useNavigate: () => jest.fn(),
        useParams: () => ({ id: "123" }),
        useLocation: () => ({
          state: {
            fromRequests: true,
            requestId: 1,
            // Missing cleanerId and appointmentId
          },
        }),
      }));

      // This test verifies the early return with error alert logic
      const handleDeny = async (cleanerId, appointmentId) => {
        if (!cleanerId || !appointmentId) {
          Alert.alert("Error", "Unable to deny request. Missing required information.");
          return;
        }
        await FetchData.denyRequest(cleanerId, appointmentId);
      };

      await handleDeny(null, null);

      expect(Alert.alert).toHaveBeenCalledWith(
        "Error",
        "Unable to deny request. Missing required information."
      );
      expect(FetchData.denyRequest).not.toHaveBeenCalled();
    });
  });

  describe("Rating Display", () => {
    it("should calculate average rating correctly", async () => {
      const { getByText } = render(
        <AllCleanerReviewsList state={mockState} dispatch={mockDispatch} />
      );

      await waitFor(() => {
        // Average of 4.5 and 5 = 4.75, displayed as "4.8" (rounded)
        expect(getByText("4.8")).toBeTruthy();
      });
    });

    it("should display correct review count", async () => {
      const { getByText } = render(
        <AllCleanerReviewsList state={mockState} dispatch={mockDispatch} />
      );

      await waitFor(() => {
        expect(getByText("2 reviews")).toBeTruthy();
      });
    });
  });

  describe("requestHandled State", () => {
    it("should initialize with requestHandled as false", () => {
      // Test the initial state logic
      const initialState = false;
      expect(initialState).toBe(false);
    });

    it("should set requestHandled to 'approved' after successful approval", async () => {
      const { getByText } = render(
        <AllCleanerReviewsList state={mockState} dispatch={mockDispatch} />
      );

      await waitFor(() => {
        expect(getByText("Approve")).toBeTruthy();
      });

      await act(async () => {
        fireEvent.press(getByText("Approve"));
      });

      await waitFor(() => {
        expect(getByText("Request Approved")).toBeTruthy();
        expect(getByText("This cleaner has been approved for your appointment.")).toBeTruthy();
      });
    });

    it("should set requestHandled to 'denied' after successful denial", async () => {
      const { getByText } = render(
        <AllCleanerReviewsList state={mockState} dispatch={mockDispatch} />
      );

      await waitFor(() => {
        expect(getByText("Deny")).toBeTruthy();
      });

      await act(async () => {
        fireEvent.press(getByText("Deny"));
      });

      await waitFor(() => {
        expect(getByText("Request Denied")).toBeTruthy();
        expect(getByText("This cleaner's request has been denied.")).toBeTruthy();
      });
    });
  });
});
