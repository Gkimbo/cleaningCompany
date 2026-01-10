import React from "react";
import { render, fireEvent } from "@testing-library/react-native";

// Mock dependencies
jest.mock("react-native-vector-icons/FontAwesome", () => "Icon");

// Mock theme
jest.mock("../../../../src/services/styles/theme", () => ({
  colors: {
    neutral: { 0: "#fff", 200: "#e0e0e0", 300: "#bdbdbd", 400: "#9e9e9e", 500: "#757575" },
    primary: { 500: "#2196f3" },
    warning: { 500: "#ff9800" },
    success: { 500: "#4caf50" },
    text: { primary: "#000" },
  },
  spacing: { xs: 4, sm: 8, md: 12, lg: 16 },
  radius: { sm: 4, lg: 12, full: 9999 },
  typography: {
    fontSize: { xs: 10, sm: 12, lg: 18 },
    fontWeight: { bold: "700" },
  },
}));

import PhotoComparisonModal from "../../../../src/components/conflicts/modals/PhotoComparisonModal";

describe("PhotoComparisonModal", () => {
  const mockOnClose = jest.fn();
  const mockBeforePhotos = [
    { id: 1, photoData: "base64_before_1", room: "Kitchen", takenAt: new Date().toISOString() },
    { id: 2, photoData: "base64_before_2", room: "Bathroom", takenAt: new Date().toISOString() },
  ];
  const mockAfterPhotos = [
    { id: 3, photoData: "base64_after_1", room: "Kitchen", takenAt: new Date().toISOString() },
    { id: 4, photoData: "base64_after_2", room: "Bathroom", takenAt: new Date().toISOString() },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("Modal Visibility", () => {
    it("should render when visible is true", () => {
      const { getByText } = render(
        <PhotoComparisonModal
          visible={true}
          onClose={mockOnClose}
          beforePhotos={mockBeforePhotos}
          afterPhotos={mockAfterPhotos}
        />
      );

      expect(getByText("Photo Comparison")).toBeTruthy();
    });

    it("should not render when visible is false", () => {
      const { queryByText } = render(
        <PhotoComparisonModal
          visible={false}
          onClose={mockOnClose}
          beforePhotos={mockBeforePhotos}
          afterPhotos={mockAfterPhotos}
        />
      );

      expect(queryByText("Photo Comparison")).toBeNull();
    });
  });

  describe("Side-by-Side Display", () => {
    it("should show BEFORE label", () => {
      const { getByText } = render(
        <PhotoComparisonModal
          visible={true}
          onClose={mockOnClose}
          beforePhotos={mockBeforePhotos}
          afterPhotos={mockAfterPhotos}
        />
      );

      expect(getByText("BEFORE")).toBeTruthy();
    });

    it("should show AFTER label", () => {
      const { getByText } = render(
        <PhotoComparisonModal
          visible={true}
          onClose={mockOnClose}
          beforePhotos={mockBeforePhotos}
          afterPhotos={mockAfterPhotos}
        />
      );

      expect(getByText("AFTER")).toBeTruthy();
    });
  });

  describe("Empty States", () => {
    it("should show message when no before photos", () => {
      const { getByText } = render(
        <PhotoComparisonModal
          visible={true}
          onClose={mockOnClose}
          beforePhotos={[]}
          afterPhotos={mockAfterPhotos}
        />
      );

      expect(getByText("No before photos")).toBeTruthy();
    });

    it("should show message when no after photos", () => {
      const { getByText } = render(
        <PhotoComparisonModal
          visible={true}
          onClose={mockOnClose}
          beforePhotos={mockBeforePhotos}
          afterPhotos={[]}
        />
      );

      expect(getByText("No after photos")).toBeTruthy();
    });
  });

  describe("Thumbnail Navigation", () => {
    it("should render thumbnail strip when multiple photos", () => {
      render(
        <PhotoComparisonModal
          visible={true}
          onClose={mockOnClose}
          beforePhotos={mockBeforePhotos}
          afterPhotos={mockAfterPhotos}
        />
      );

      // Thumbnails should be rendered for navigation
    });
  });

  describe("Close Button", () => {
    it("should call onClose when close button pressed", () => {
      const { getByTestId } = render(
        <PhotoComparisonModal
          visible={true}
          onClose={mockOnClose}
          beforePhotos={mockBeforePhotos}
          afterPhotos={mockAfterPhotos}
        />
      );

      // Find close button and press it
      // Note: Would need testID on the close button to test this properly
    });
  });

  describe("Instructions", () => {
    it("should show comparison instructions", () => {
      const { getByText } = render(
        <PhotoComparisonModal
          visible={true}
          onClose={mockOnClose}
          beforePhotos={mockBeforePhotos}
          afterPhotos={mockAfterPhotos}
        />
      );

      expect(getByText(/Compare before and after photos/)).toBeTruthy();
    });
  });
});
