import React from "react";
import { render, fireEvent, waitFor } from "@testing-library/react-native";
import TermsModal from "../../src/components/terms/TermsModal";

// Mock the API_BASE
jest.mock("../../src/services/config", () => ({
  API_BASE: "http://localhost:5000/api/v1",
}));

// Mock fetch
global.fetch = jest.fn();

describe("TermsModal", () => {
  const mockOnClose = jest.fn();
  const mockOnAccept = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch.mockReset();
  });

  const defaultProps = {
    visible: true,
    onClose: mockOnClose,
    onAccept: mockOnAccept,
    type: "homeowner",
  };

  describe("Rendering", () => {
    it("should not render when visible is false", () => {
      const { queryByText } = render(
        <TermsModal {...defaultProps} visible={false} />
      );

      expect(queryByText("Terms and Conditions")).toBeNull();
    });

    it("should show loading state initially", async () => {
      global.fetch.mockImplementation(() => new Promise(() => {})); // Never resolves

      const { getByText } = render(<TermsModal {...defaultProps} />);

      await waitFor(() => {
        expect(getByText("Loading terms...")).toBeTruthy();
      });
    });

    it("should display text terms content", async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          terms: {
            id: 1,
            title: "Terms of Service",
            version: 1,
            contentType: "text",
            content: "These are the terms and conditions for homeowners.",
          },
        }),
      });

      const { getByText } = render(<TermsModal {...defaultProps} />);

      await waitFor(() => {
        expect(getByText("Terms of Service")).toBeTruthy();
        expect(getByText("Version 1")).toBeTruthy();
        expect(getByText(/These are the terms and conditions/)).toBeTruthy();
      });
    });

    it("should display error message on fetch failure", async () => {
      global.fetch.mockRejectedValueOnce(new Error("Network error"));

      const { getByText } = render(<TermsModal {...defaultProps} />);

      await waitFor(() => {
        expect(getByText("Failed to load terms")).toBeTruthy();
      });
    });

    it("should display message when no terms exist", async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          terms: null,
          message: "No terms available yet",
        }),
      });

      const { getByText } = render(<TermsModal {...defaultProps} />);

      await waitFor(() => {
        expect(getByText("No terms available yet")).toBeTruthy();
      });
    });
  });

  describe("User Interactions", () => {
    it("should call onClose when close button is pressed", async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          terms: {
            id: 1,
            title: "Terms",
            version: 1,
            contentType: "text",
            content: "Content",
          },
        }),
      });

      const { getByText } = render(<TermsModal {...defaultProps} required={false} />);

      await waitFor(() => {
        expect(getByText("Terms")).toBeTruthy();
      });

      const closeButton = getByText("Close");
      fireEvent.press(closeButton);

      expect(mockOnClose).toHaveBeenCalled();
    });

    it("should show I Accept button", async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          terms: {
            id: 1,
            title: "Terms",
            version: 1,
            contentType: "text",
            content: "Short content",
          },
        }),
      });

      const { getByText } = render(<TermsModal {...defaultProps} />);

      await waitFor(() => {
        expect(getByText("Terms")).toBeTruthy();
      });

      const acceptButton = getByText("I Accept");
      expect(acceptButton).toBeTruthy();
    });

    it("should call onAccept with termsId when accepting after scrolling", async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          terms: {
            id: 123,
            title: "Terms",
            version: 1,
            contentType: "text",
            content: "Content",
          },
        }),
      });

      const { getByText, getByTestId, UNSAFE_getByType } = render(
        <TermsModal {...defaultProps} />
      );

      await waitFor(() => {
        expect(getByText("Terms")).toBeTruthy();
      });

      // Find ScrollView and simulate scroll to bottom
      const scrollView = UNSAFE_getByType("RCTScrollView");
      fireEvent.scroll(scrollView, {
        nativeEvent: {
          contentOffset: { y: 100 },
          contentSize: { height: 100 },
          layoutMeasurement: { height: 50 },
        },
      });

      // Now press accept
      const acceptButton = getByText("I Accept");
      fireEvent.press(acceptButton);

      expect(mockOnAccept).toHaveBeenCalledWith(123);
    });
  });

  describe("API Integration", () => {
    it("should fetch terms for homeowner type", async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          terms: {
            id: 1,
            title: "Homeowner Terms",
            version: 1,
            contentType: "text",
            content: "Homeowner content",
          },
        }),
      });

      render(<TermsModal {...defaultProps} type="homeowner" />);

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          "http://localhost:5000/api/v1/terms/current/homeowner"
        );
      });
    });

    it("should fetch terms for cleaner type", async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          terms: {
            id: 2,
            title: "Cleaner Terms",
            version: 1,
            contentType: "text",
            content: "Cleaner content",
          },
        }),
      });

      render(<TermsModal {...defaultProps} type="cleaner" />);

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          "http://localhost:5000/api/v1/terms/current/cleaner"
        );
      });
    });

    it("should refetch terms when type changes", async () => {
      global.fetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          terms: {
            id: 1,
            title: "Terms",
            version: 1,
            contentType: "text",
            content: "Content",
          },
        }),
      });

      const { rerender } = render(<TermsModal {...defaultProps} type="homeowner" />);

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledTimes(1);
      });

      rerender(<TermsModal {...defaultProps} type="cleaner" />);

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledTimes(2);
      });
    });
  });

  describe("PDF Content Type", () => {
    it("should render WebView for PDF terms", async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          terms: {
            id: 1,
            title: "PDF Terms",
            version: 1,
            contentType: "pdf",
            pdfUrl: "/api/v1/terms/pdf/1",
          },
        }),
      });

      const { getByText, UNSAFE_getByType } = render(
        <TermsModal {...defaultProps} />
      );

      await waitFor(() => {
        expect(getByText("Terms and Conditions")).toBeTruthy();
      });

      // WebView should be rendered for PDF
      const webView = UNSAFE_getByType("WebView");
      expect(webView).toBeTruthy();
    });
  });
});
