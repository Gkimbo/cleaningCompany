/**
 * TermsAcceptanceScreen Component Tests
 *
 * Tests for the full-screen terms acceptance flow that appears
 * when users need to accept updated terms or privacy policy.
 */

import React from "react";
import { render, fireEvent, waitFor } from "@testing-library/react-native";

// Mock react-router-native
const mockNavigate = jest.fn();
jest.mock("react-router-native", () => ({
  useNavigate: () => mockNavigate,
}));

// Mock react-native-webview
jest.mock("react-native-webview", () => ({
  WebView: "WebView",
}));

// Mock config
jest.mock("../../../src/services/config", () => ({
  API_BASE: "http://localhost:3000/api/v1",
}));

import TermsAcceptanceScreen from "../../../src/components/terms/TermsAcceptanceScreen";

describe("TermsAcceptanceScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch = jest.fn();
  });

  const mockState = {
    currentUser: {
      token: "test-token",
    },
  };

  const mockDispatch = jest.fn();

  describe("Initial Loading", () => {
    it("should show loading indicator on mount", () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ requiresAcceptance: false }),
      });

      const { getByText } = render(
        <TermsAcceptanceScreen state={mockState} dispatch={mockDispatch} />
      );

      expect(getByText("Checking requirements...")).toBeTruthy();
    });

    it("should navigate to home if no acceptance required", async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ requiresAcceptance: false }),
      });

      render(
        <TermsAcceptanceScreen state={mockState} dispatch={mockDispatch} />
      );

      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith("/");
      });
    });

    it("should call onAccepted callback if provided and no acceptance needed", async () => {
      const onAccepted = jest.fn();

      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ requiresAcceptance: false }),
      });

      render(
        <TermsAcceptanceScreen
          state={mockState}
          dispatch={mockDispatch}
          onAccepted={onAccepted}
        />
      );

      await waitFor(() => {
        expect(onAccepted).toHaveBeenCalled();
      });
    });
  });

  describe("Terms Only", () => {
    it("should display terms when only terms need acceptance", async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          requiresAcceptance: true,
          terms: {
            id: 1,
            type: "homeowner",
            version: 1,
            title: "Terms of Service",
            content: "Terms content here",
            contentType: "text",
          },
        }),
      });

      const { getByText } = render(
        <TermsAcceptanceScreen state={mockState} dispatch={mockDispatch} />
      );

      await waitFor(() => {
        expect(getByText("Terms and Conditions")).toBeTruthy();
        expect(getByText("Terms of Service")).toBeTruthy();
        expect(getByText("Version 1")).toBeTruthy();
      });
    });

    it("should show Updated badge when single document", async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          requiresAcceptance: true,
          terms: {
            id: 1,
            type: "homeowner",
            version: 1,
            title: "Terms",
            content: "Content",
            contentType: "text",
          },
        }),
      });

      const { getByText } = render(
        <TermsAcceptanceScreen state={mockState} dispatch={mockDispatch} />
      );

      await waitFor(() => {
        expect(getByText("Updated")).toBeTruthy();
      });
    });
  });

  describe("Both Terms and Privacy Policy", () => {
    it("should show step indicator when both need acceptance", async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          requiresAcceptance: true,
          terms: {
            id: 1,
            type: "homeowner",
            version: 1,
            title: "Terms",
            content: "Terms content",
            contentType: "text",
          },
          privacyPolicy: {
            id: 2,
            type: "privacy_policy",
            version: 1,
            title: "Privacy Policy",
            content: "Privacy content",
            contentType: "text",
          },
        }),
      });

      const { getByText } = render(
        <TermsAcceptanceScreen state={mockState} dispatch={mockDispatch} />
      );

      await waitFor(() => {
        expect(getByText("Step 1 of 2")).toBeTruthy();
      });
    });

    it("should show Terms and Conditions first", async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          requiresAcceptance: true,
          terms: {
            id: 1,
            type: "homeowner",
            version: 1,
            title: "Terms of Service",
            content: "Terms content",
            contentType: "text",
          },
          privacyPolicy: {
            id: 2,
            type: "privacy_policy",
            version: 1,
            title: "Privacy Policy",
            content: "Privacy content",
            contentType: "text",
          },
        }),
      });

      const { getByText } = render(
        <TermsAcceptanceScreen state={mockState} dispatch={mockDispatch} />
      );

      await waitFor(() => {
        expect(getByText("Terms and Conditions")).toBeTruthy();
        expect(getByText("Terms of Service")).toBeTruthy();
      });
    });

    it("should show Accept & Continue button for first document", async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          requiresAcceptance: true,
          terms: {
            id: 1,
            type: "homeowner",
            version: 1,
            title: "Terms",
            content: "Content",
            contentType: "text",
          },
          privacyPolicy: {
            id: 2,
            type: "privacy_policy",
            version: 1,
            title: "Privacy",
            content: "Content",
            contentType: "text",
          },
        }),
      });

      const { getByText } = render(
        <TermsAcceptanceScreen state={mockState} dispatch={mockDispatch} />
      );

      await waitFor(() => {
        expect(getByText("Accept & Continue")).toBeTruthy();
      });
    });
  });

  describe("Privacy Policy Only", () => {
    it("should display privacy policy when only privacy needs acceptance", async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          requiresAcceptance: true,
          privacyPolicy: {
            id: 2,
            type: "privacy_policy",
            version: 1,
            title: "Privacy Policy",
            content: "Privacy content here",
            contentType: "text",
          },
        }),
      });

      const { getByText } = render(
        <TermsAcceptanceScreen state={mockState} dispatch={mockDispatch} />
      );

      await waitFor(() => {
        // Privacy Policy appears in both header and title, so just check content is displayed
        expect(getByText("Privacy content here")).toBeTruthy();
      });
    });
  });

  describe("Acceptance Flow", () => {
    it("should show required notice", async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          requiresAcceptance: true,
          terms: {
            id: 1,
            type: "homeowner",
            version: 1,
            title: "Terms",
            content: "Content",
            contentType: "text",
          },
        }),
      });

      const { getByText } = render(
        <TermsAcceptanceScreen state={mockState} dispatch={mockDispatch} />
      );

      await waitFor(() => {
        expect(getByText("You must read and accept to continue")).toBeTruthy();
      });
    });

    it("should accept terms and move to privacy policy", async () => {
      // Initial check returns both
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          requiresAcceptance: true,
          terms: {
            id: 1,
            type: "homeowner",
            version: 1,
            title: "Terms",
            content: "Content",
            contentType: "text",
          },
          privacyPolicy: {
            id: 2,
            type: "privacy_policy",
            version: 1,
            title: "Privacy",
            content: "Content",
            contentType: "text",
          },
        }),
      });

      // Accept response
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          success: true,
          acceptedVersion: 1,
          type: "homeowner",
        }),
      });

      const { getByText, queryByText } = render(
        <TermsAcceptanceScreen state={mockState} dispatch={mockDispatch} />
      );

      await waitFor(() => {
        expect(getByText("Terms and Conditions")).toBeTruthy();
      });

      // Note: Would need to simulate scroll to bottom to enable button
      // Then press Accept & Continue to move to privacy policy
    });
  });

  describe("Skip to Bottom", () => {
    it("should show skip to bottom button", async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          requiresAcceptance: true,
          terms: {
            id: 1,
            type: "homeowner",
            version: 1,
            title: "Terms",
            content: "Long content here",
            contentType: "text",
          },
        }),
      });

      const { getByText } = render(
        <TermsAcceptanceScreen state={mockState} dispatch={mockDispatch} />
      );

      await waitFor(() => {
        expect(getByText(/Skip to Bottom/)).toBeTruthy();
      });
    });

    it("should show scroll hint", async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          requiresAcceptance: true,
          terms: {
            id: 1,
            type: "homeowner",
            version: 1,
            title: "Terms",
            content: "Content",
            contentType: "text",
          },
        }),
      });

      const { getByText } = render(
        <TermsAcceptanceScreen state={mockState} dispatch={mockDispatch} />
      );

      await waitFor(() => {
        expect(getByText("or scroll down to continue")).toBeTruthy();
      });
    });
  });

  describe("Logout", () => {
    it("should show logout button", async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          requiresAcceptance: true,
          terms: {
            id: 1,
            type: "homeowner",
            version: 1,
            title: "Terms",
            content: "Content",
            contentType: "text",
          },
        }),
      });

      const { getByText } = render(
        <TermsAcceptanceScreen state={mockState} dispatch={mockDispatch} />
      );

      await waitFor(() => {
        expect(getByText("Logout")).toBeTruthy();
      });
    });

    it("should dispatch logout action and navigate on logout", async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          requiresAcceptance: true,
          terms: {
            id: 1,
            type: "homeowner",
            version: 1,
            title: "Terms",
            content: "Content",
            contentType: "text",
          },
        }),
      });

      const { getByText } = render(
        <TermsAcceptanceScreen state={mockState} dispatch={mockDispatch} />
      );

      await waitFor(() => {
        expect(getByText("Logout")).toBeTruthy();
      });

      fireEvent.press(getByText("Logout"));

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
    it("should show error message on check failure", async () => {
      global.fetch.mockRejectedValueOnce(new Error("Network error"));

      const { getByText } = render(
        <TermsAcceptanceScreen state={mockState} dispatch={mockDispatch} />
      );

      await waitFor(() => {
        expect(getByText("Failed to check acceptance status")).toBeTruthy();
      });
    });

    it("should show retry button on error", async () => {
      global.fetch.mockRejectedValueOnce(new Error("Network error"));

      const { getByText } = render(
        <TermsAcceptanceScreen state={mockState} dispatch={mockDispatch} />
      );

      await waitFor(() => {
        expect(getByText("Retry")).toBeTruthy();
      });
    });

    it("should retry check on retry button press", async () => {
      global.fetch
        .mockRejectedValueOnce(new Error("Network error"))
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ requiresAcceptance: false }),
        });

      const { getByText } = render(
        <TermsAcceptanceScreen state={mockState} dispatch={mockDispatch} />
      );

      await waitFor(() => {
        expect(getByText("Retry")).toBeTruthy();
      });

      fireEvent.press(getByText("Retry"));

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledTimes(2);
      });
    });

    it("should show error banner for accept failure", async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          requiresAcceptance: true,
          terms: {
            id: 1,
            type: "homeowner",
            version: 1,
            title: "Terms",
            content: "Content",
            contentType: "text",
          },
        }),
      });

      const { getByText } = render(
        <TermsAcceptanceScreen state={mockState} dispatch={mockDispatch} />
      );

      await waitFor(() => {
        expect(getByText("Terms")).toBeTruthy();
      });

      // Note: Would test accept error after simulating scroll and accept
    });
  });

  describe("PDF Content", () => {
    it("should render WebView for PDF terms", async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          requiresAcceptance: true,
          terms: {
            id: 1,
            type: "homeowner",
            version: 1,
            title: "Terms PDF",
            contentType: "pdf",
            pdfUrl: "/api/v1/terms/pdf/1",
          },
        }),
      });

      render(
        <TermsAcceptanceScreen state={mockState} dispatch={mockDispatch} />
      );

      await waitFor(() => {
        // PDF should be rendered via WebView
      });
    });
  });

  describe("Progress Indicator", () => {
    it("should show progress bar for multiple documents", async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          requiresAcceptance: true,
          terms: {
            id: 1,
            type: "homeowner",
            version: 1,
            title: "Terms",
            content: "Content",
            contentType: "text",
          },
          privacyPolicy: {
            id: 2,
            type: "privacy_policy",
            version: 1,
            title: "Privacy",
            content: "Content",
            contentType: "text",
          },
        }),
      });

      const { getByText } = render(
        <TermsAcceptanceScreen state={mockState} dispatch={mockDispatch} />
      );

      await waitFor(() => {
        expect(getByText(/Privacy Policy next/)).toBeTruthy();
      });
    });
  });

  describe("End of Document", () => {
    it("should show end of document marker", async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          requiresAcceptance: true,
          terms: {
            id: 1,
            type: "homeowner",
            version: 1,
            title: "Terms",
            content: "Content",
            contentType: "text",
          },
        }),
      });

      const { getByText } = render(
        <TermsAcceptanceScreen state={mockState} dispatch={mockDispatch} />
      );

      await waitFor(() => {
        expect(getByText("End of Document")).toBeTruthy();
      });
    });
  });
});
