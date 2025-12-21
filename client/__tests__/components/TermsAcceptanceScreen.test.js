import React from "react";
import { render, fireEvent, waitFor } from "@testing-library/react-native";
import TermsAcceptanceScreen from "../../src/components/terms/TermsAcceptanceScreen";

// Mock react-router-native
const mockNavigate = jest.fn();
jest.mock("react-router-native", () => ({
  useNavigate: () => mockNavigate,
}));

// Mock the API_BASE
jest.mock("../../src/services/config", () => ({
  API_BASE: "http://localhost:5000/api/v1",
}));

// Mock fetch
global.fetch = jest.fn();

describe("TermsAcceptanceScreen", () => {
  const mockDispatch = jest.fn();
  const mockOnAccepted = jest.fn();

  const defaultState = {
    currentUser: {
      token: "test-token-123",
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch.mockReset();
  });

  describe("Initial Loading", () => {
    it("should show loading state while checking terms status", async () => {
      global.fetch.mockImplementation(() => new Promise(() => {})); // Never resolves

      const { getByText } = render(
        <TermsAcceptanceScreen state={defaultState} dispatch={mockDispatch} />
      );

      expect(getByText("Checking terms status...")).toBeTruthy();
    });

    it("should navigate away if no acceptance required", async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          requiresAcceptance: false,
        }),
      });

      render(
        <TermsAcceptanceScreen state={defaultState} dispatch={mockDispatch} />
      );

      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith("/");
      });
    });

    it("should call onAccepted callback if provided and no acceptance required", async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          requiresAcceptance: false,
        }),
      });

      render(
        <TermsAcceptanceScreen
          state={defaultState}
          dispatch={mockDispatch}
          onAccepted={mockOnAccepted}
        />
      );

      await waitFor(() => {
        expect(mockOnAccepted).toHaveBeenCalled();
      });
    });
  });

  describe("Terms Display", () => {
    it("should display terms content when acceptance is required", async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          requiresAcceptance: true,
          terms: {
            id: 1,
            title: "Updated Terms of Service",
            version: 2,
            contentType: "text",
            content: "These are the updated terms and conditions...",
          },
        }),
      });

      const { getByText } = render(
        <TermsAcceptanceScreen state={defaultState} dispatch={mockDispatch} />
      );

      await waitFor(() => {
        expect(getByText("Terms and Conditions")).toBeTruthy();
        expect(getByText("Updated Terms of Service")).toBeTruthy();
        expect(getByText(/Version 2/)).toBeTruthy();
      });
    });

    it("should display Updated Terms badge", async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          requiresAcceptance: true,
          terms: {
            id: 1,
            title: "Terms",
            version: 1,
            contentType: "text",
            content: "Content",
          },
        }),
      });

      const { getByText } = render(
        <TermsAcceptanceScreen state={defaultState} dispatch={mockDispatch} />
      );

      await waitFor(() => {
        expect(getByText("Updated Terms")).toBeTruthy();
      });
    });
  });

  describe("Accept Terms Flow", () => {
    it("should send accept request when I Accept is pressed", async () => {
      global.fetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            requiresAcceptance: true,
            terms: {
              id: 1,
              title: "Terms",
              version: 1,
              contentType: "text",
              content: "Short content for quick scroll",
            },
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            success: true,
          }),
        });

      const { getByText, UNSAFE_getByType } = render(
        <TermsAcceptanceScreen state={defaultState} dispatch={mockDispatch} />
      );

      await waitFor(() => {
        expect(getByText("Terms")).toBeTruthy();
      });

      // Simulate scrolling to bottom to enable accept button
      const scrollView = UNSAFE_getByType("RCTScrollView");
      fireEvent.scroll(scrollView, {
        nativeEvent: {
          contentOffset: { y: 100 },
          contentSize: { height: 100 },
          layoutMeasurement: { height: 50 },
        },
      });

      const acceptButton = getByText("I Accept");
      fireEvent.press(acceptButton);

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          "http://localhost:5000/api/v1/terms/accept",
          expect.objectContaining({
            method: "POST",
            headers: expect.objectContaining({
              "Content-Type": "application/json",
              Authorization: "Bearer test-token-123",
            }),
          })
        );
      });
    });

    it("should navigate to home after successful acceptance", async () => {
      global.fetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            requiresAcceptance: true,
            terms: {
              id: 1,
              title: "Terms",
              version: 1,
              contentType: "text",
              content: "Content",
            },
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            success: true,
          }),
        });

      const { getByText, UNSAFE_getByType } = render(
        <TermsAcceptanceScreen state={defaultState} dispatch={mockDispatch} />
      );

      await waitFor(() => {
        expect(getByText("Terms")).toBeTruthy();
      });

      // Simulate scrolling to bottom
      const scrollView = UNSAFE_getByType("RCTScrollView");
      fireEvent.scroll(scrollView, {
        nativeEvent: {
          contentOffset: { y: 100 },
          contentSize: { height: 100 },
          layoutMeasurement: { height: 50 },
        },
      });

      const acceptButton = getByText("I Accept");
      fireEvent.press(acceptButton);

      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith("/");
      });
    });
  });

  describe("Logout Flow", () => {
    it("should dispatch logout actions and navigate to sign-in when logout pressed", async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          requiresAcceptance: true,
          terms: {
            id: 1,
            title: "Terms",
            version: 1,
            contentType: "text",
            content: "Content",
          },
        }),
      });

      const { getByText } = render(
        <TermsAcceptanceScreen state={defaultState} dispatch={mockDispatch} />
      );

      await waitFor(() => {
        expect(getByText("Terms")).toBeTruthy();
      });

      const logoutButton = getByText("Logout");
      fireEvent.press(logoutButton);

      expect(mockDispatch).toHaveBeenCalledWith({
        type: "CURRENT_USER",
        payload: null,
      });
      expect(mockDispatch).toHaveBeenCalledWith({
        type: "SET_USER_ID",
        payload: null,
      });
      expect(mockNavigate).toHaveBeenCalledWith("/sign-in");
    });
  });

  describe("Error Handling", () => {
    it("should show error state when check fails", async () => {
      global.fetch.mockRejectedValueOnce(new Error("Network error"));

      const { getByText } = render(
        <TermsAcceptanceScreen state={defaultState} dispatch={mockDispatch} />
      );

      await waitFor(() => {
        expect(getByText("Failed to check terms status")).toBeTruthy();
      });
    });

    it("should show retry button on error", async () => {
      global.fetch.mockRejectedValueOnce(new Error("Network error"));

      const { getByText } = render(
        <TermsAcceptanceScreen state={defaultState} dispatch={mockDispatch} />
      );

      await waitFor(() => {
        expect(getByText("Retry")).toBeTruthy();
      });
    });
  });

  describe("API Calls", () => {
    it("should include authorization header in check request", async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          requiresAcceptance: false,
        }),
      });

      render(
        <TermsAcceptanceScreen state={defaultState} dispatch={mockDispatch} />
      );

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          "http://localhost:5000/api/v1/terms/check",
          expect.objectContaining({
            headers: {
              Authorization: "Bearer test-token-123",
            },
          })
        );
      });
    });
  });
});
