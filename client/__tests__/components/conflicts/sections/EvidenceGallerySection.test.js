import React from "react";
import { render, fireEvent, waitFor } from "@testing-library/react-native";

// Mock dependencies
jest.mock("react-native-vector-icons/FontAwesome", () => "Icon");

// Mock theme
jest.mock("../../../../src/services/styles/theme", () => ({
  colors: {
    neutral: { 0: "#fff", 50: "#f9f9f9", 100: "#f0f0f0", 200: "#e0e0e0", 300: "#bdbdbd" },
    primary: { 100: "#bbdefb", 400: "#42a5f5", 500: "#2196f3" },
    warning: { 500: "#ff9800" },
    error: { 500: "#f44336" },
    success: { 500: "#4caf50" },
    text: { primary: "#000", secondary: "#666", tertiary: "#999" },
  },
  spacing: { xs: 4, sm: 8, md: 12, lg: 16, xl: 20 },
  radius: { sm: 4, md: 8, lg: 12 },
  typography: {
    fontSize: { xs: 10, sm: 12, base: 14, lg: 18 },
    fontWeight: { medium: "500", semibold: "600", bold: "700" },
  },
}));

import EvidenceGallerySection from "../../../../src/components/conflicts/sections/EvidenceGallerySection";

describe("EvidenceGallerySection", () => {
  const mockOnPhotoPress = jest.fn();
  const mockOnComparePress = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("Loading State", () => {
    it("should show loading indicator when loading", () => {
      const { getByText } = render(
        <EvidenceGallerySection
          photos={null}
          evidencePhotos={null}
          loading={true}
          onPhotoPress={mockOnPhotoPress}
        />
      );

      expect(getByText("Loading photos...")).toBeTruthy();
    });
  });

  describe("Empty State", () => {
    it("should show empty message when no photos", () => {
      const { getByText } = render(
        <EvidenceGallerySection
          photos={{ before: [], after: [], passes: [] }}
          evidencePhotos={[]}
          loading={false}
          onPhotoPress={mockOnPhotoPress}
        />
      );

      expect(getByText("No Photos Available")).toBeTruthy();
    });
  });

  describe("Photo Display", () => {
    const mockPhotos = {
      before: [
        { id: 1, photoData: "base64...", room: "Kitchen", takenAt: new Date().toISOString() },
      ],
      after: [
        { id: 2, photoData: "base64...", room: "Kitchen", takenAt: new Date().toISOString() },
      ],
      passes: [],
    };

    it("should render photos when available", () => {
      render(
        <EvidenceGallerySection
          photos={mockPhotos}
          evidencePhotos={[]}
          loading={false}
          onPhotoPress={mockOnPhotoPress}
        />
      );
    });

    it("should show category tabs", () => {
      const { getAllByText } = render(
        <EvidenceGallerySection
          photos={mockPhotos}
          evidencePhotos={[]}
          loading={false}
          onPhotoPress={mockOnPhotoPress}
        />
      );

      // Use getAllByText for tabs since the same text may appear elsewhere
      expect(getAllByText("All").length).toBeGreaterThan(0);
      expect(getAllByText(/Before/).length).toBeGreaterThan(0);
      expect(getAllByText(/After/).length).toBeGreaterThan(0);
    });

    it("should show comparison section when before and after photos exist", () => {
      const { getByText } = render(
        <EvidenceGallerySection
          photos={mockPhotos}
          evidencePhotos={[]}
          loading={false}
          onPhotoPress={mockOnPhotoPress}
          onComparePress={mockOnComparePress}
        />
      );

      expect(getByText("Before & After Comparison")).toBeTruthy();
    });

    it("should show Full Compare button when onComparePress provided", () => {
      const { getByText } = render(
        <EvidenceGallerySection
          photos={mockPhotos}
          evidencePhotos={[]}
          loading={false}
          onPhotoPress={mockOnPhotoPress}
          onComparePress={mockOnComparePress}
        />
      );

      expect(getByText("Full Compare")).toBeTruthy();
    });

    it("should call onComparePress when Full Compare button pressed", () => {
      const { getByText } = render(
        <EvidenceGallerySection
          photos={mockPhotos}
          evidencePhotos={[]}
          loading={false}
          onPhotoPress={mockOnPhotoPress}
          onComparePress={mockOnComparePress}
        />
      );

      fireEvent.press(getByText("Full Compare"));
      expect(mockOnComparePress).toHaveBeenCalled();
    });
  });

  describe("Evidence Photos", () => {
    it("should show Evidence tab when evidence photos exist", () => {
      const mockPhotos = {
        before: [],
        after: [],
        passes: [],
      };
      const mockEvidencePhotos = [
        { id: 1, photoData: "base64...", description: "Evidence 1" },
      ];

      const { getByText } = render(
        <EvidenceGallerySection
          photos={mockPhotos}
          evidencePhotos={mockEvidencePhotos}
          loading={false}
          onPhotoPress={mockOnPhotoPress}
        />
      );

      expect(getByText("Evidence")).toBeTruthy();
    });
  });
});
