import React from "react";
import { render } from "@testing-library/react-native";

// Mock dependencies
jest.mock("@expo/vector-icons", () => ({
  Feather: "Feather",
}));

jest.mock("../../src/services/styles/theme", () => ({
  colors: {
    success: {
      50: "#e8f5e9",
      100: "#c8e6c9",
      200: "#a5d6a7",
      600: "#43a047",
      700: "#388e3c",
    },
    secondary: {
      50: "#e3f2fd",
      100: "#bbdefb",
      200: "#90caf9",
      600: "#1e88e5",
      700: "#1976d2",
    },
  },
  spacing: { xs: 4, sm: 8, md: 12, lg: 16, xl: 20 },
  radius: { sm: 4, md: 8, lg: 12, xl: 16 },
  typography: {
    fontSize: { xs: 10, sm: 12, base: 14, lg: 18 },
    fontWeight: { normal: "400", medium: "500", semibold: "600", bold: "700" },
  },
}));

import IncentiveBanner from "../../src/components/incentives/IncentiveBanner";

describe("IncentiveBanner", () => {
  describe("Rendering", () => {
    it("should render with message", () => {
      const { getByText } = render(
        <IncentiveBanner message="Test promotion message!" />
      );

      expect(getByText("Test promotion message!")).toBeTruthy();
    });

    it("should render cleaner type banner by default", () => {
      const { UNSAFE_root } = render(
        <IncentiveBanner message="Cleaner banner" />
      );

      // Check that it renders (cleaner is default)
      expect(UNSAFE_root).toBeTruthy();
    });

    it("should render homeowner type banner when specified", () => {
      const { UNSAFE_root } = render(
        <IncentiveBanner type="homeowner" message="Homeowner banner" />
      );

      expect(UNSAFE_root).toBeTruthy();
    });
  });

  describe("Types", () => {
    it("should accept cleaner type", () => {
      const { getByText } = render(
        <IncentiveBanner type="cleaner" message="Cleaner promotion" />
      );

      expect(getByText("Cleaner promotion")).toBeTruthy();
    });

    it("should accept homeowner type", () => {
      const { getByText } = render(
        <IncentiveBanner type="homeowner" message="Homeowner promotion" />
      );

      expect(getByText("Homeowner promotion")).toBeTruthy();
    });
  });

  describe("Icon", () => {
    it("should use gift icon by default", () => {
      const { UNSAFE_getByType } = render(
        <IncentiveBanner message="Test with default icon" />
      );

      const icon = UNSAFE_getByType("Feather");
      expect(icon.props.name).toBe("gift");
    });

    it("should accept custom icon", () => {
      const { UNSAFE_getByType } = render(
        <IncentiveBanner message="Test with star icon" icon="star" />
      );

      const icon = UNSAFE_getByType("Feather");
      expect(icon.props.name).toBe("star");
    });
  });

  describe("Message Display", () => {
    it("should display cleaner incentive message correctly", () => {
      const message = "New cleaners get 0% platform fees for first 5 cleanings!";
      const { getByText } = render(
        <IncentiveBanner type="cleaner" message={message} />
      );

      expect(getByText(message)).toBeTruthy();
    });

    it("should display homeowner incentive message correctly", () => {
      const message = "First 4 cleanings get 10% off!";
      const { getByText } = render(
        <IncentiveBanner type="homeowner" message={message} />
      );

      expect(getByText(message)).toBeTruthy();
    });

    it("should display long promotional messages", () => {
      const message = "Sign up now and enjoy reduced platform fees for your first cleanings. This limited time offer is available to all new cleaners who join our platform.";
      const { getByText } = render(
        <IncentiveBanner type="cleaner" message={message} />
      );

      expect(getByText(message)).toBeTruthy();
    });
  });

  describe("Styling", () => {
    it("should have proper structure with icon container and text", () => {
      const { UNSAFE_root } = render(
        <IncentiveBanner message="Test banner" />
      );

      // Banner should have children (icon container and text)
      expect(UNSAFE_root.children.length).toBeGreaterThan(0);
    });
  });
});
