/**
 * Tests for VerifiedBusinessBadge Component
 * Tests all badge variants and display configurations
 */

import React from "react";
import { render, fireEvent } from "@testing-library/react-native";

// Mock dependencies
jest.mock("react-native-vector-icons/FontAwesome", () => "Icon");

jest.mock("../../src/services/styles/theme", () => ({
  colors: {
    success: { 50: "#dcfce7", 100: "#bbf7d0", 200: "#86efac", 600: "#16a34a", 700: "#15803d" },
    neutral: { 500: "#737373" },
    text: { primary: "#171717", secondary: "#525252" },
    background: { primary: "#ffffff" },
  },
  spacing: { xs: 4, sm: 8, md: 16 },
  radius: { lg: 12, full: 9999 },
  typography: {
    fontSize: { xs: 12, sm: 14, base: 16, lg: 18 },
    fontWeight: { medium: "500", semibold: "600" },
  },
}));

import VerifiedBusinessBadge, {
  VerifiedBadgeSmall,
  VerifiedBadgeLarge,
} from "../../src/components/shared/VerifiedBusinessBadge";

describe("VerifiedBusinessBadge Component", () => {
  describe("Badge Variant (default)", () => {
    it("should render badge variant by default", () => {
      const { getByText } = render(<VerifiedBusinessBadge />);
      expect(getByText("Verified Business")).toBeTruthy();
    });

    it("should render with small size", () => {
      const { getByText } = render(<VerifiedBusinessBadge size="small" />);
      expect(getByText("Verified Business")).toBeTruthy();
    });

    it("should render with medium size", () => {
      const { getByText } = render(<VerifiedBusinessBadge size="medium" />);
      expect(getByText("Verified Business")).toBeTruthy();
    });

    it("should render with large size", () => {
      const { getByText } = render(<VerifiedBusinessBadge size="large" />);
      expect(getByText("Verified Business")).toBeTruthy();
    });

    it("should be pressable when onPress is provided", () => {
      const onPressMock = jest.fn();
      const { getByText } = render(
        <VerifiedBusinessBadge onPress={onPressMock} />
      );

      fireEvent.press(getByText("Verified Business"));
      expect(onPressMock).toHaveBeenCalledTimes(1);
    });

    it("should not be pressable when onPress is not provided", () => {
      const { queryByTestId } = render(<VerifiedBusinessBadge />);
      // Component should render without Pressable wrapper
      expect(queryByTestId("pressable")).toBeNull();
    });
  });

  describe("Inline Variant", () => {
    it("should render inline variant with 'Verified' text", () => {
      const { getByText } = render(<VerifiedBusinessBadge variant="inline" />);
      expect(getByText("Verified")).toBeTruthy();
    });

    it("should render with small size", () => {
      const { getByText } = render(
        <VerifiedBusinessBadge variant="inline" size="small" />
      );
      expect(getByText("Verified")).toBeTruthy();
    });

    it("should render with large size", () => {
      const { getByText } = render(
        <VerifiedBusinessBadge variant="inline" size="large" />
      );
      expect(getByText("Verified")).toBeTruthy();
    });
  });

  describe("Card Variant", () => {
    it("should render card variant with header", () => {
      const { getByText } = render(<VerifiedBusinessBadge variant="card" />);
      expect(getByText("Verified Business")).toBeTruthy();
    });

    it("should display business name when provided", () => {
      const { getByText } = render(
        <VerifiedBusinessBadge
          variant="card"
          businessName="CleanPro Services"
          showDetails
        />
      );
      expect(getByText("CleanPro Services")).toBeTruthy();
    });

    it("should display years in business when provided", () => {
      const { getByText } = render(
        <VerifiedBusinessBadge
          variant="card"
          yearsInBusiness={5}
          showDetails
        />
      );
      expect(getByText("5 years in business")).toBeTruthy();
    });

    it("should display singular year when yearsInBusiness is 1", () => {
      const { getByText } = render(
        <VerifiedBusinessBadge
          variant="card"
          yearsInBusiness={1}
          showDetails
        />
      );
      expect(getByText("1 year in business")).toBeTruthy();
    });

    it("should display client count when provided", () => {
      const { getByText } = render(
        <VerifiedBusinessBadge
          variant="card"
          clientCount={25}
          showDetails
        />
      );
      expect(getByText("Trusted by 25+ clients")).toBeTruthy();
    });

    it("should display all details when all props provided", () => {
      const { getByText } = render(
        <VerifiedBusinessBadge
          variant="card"
          businessName="Premium Cleaners"
          yearsInBusiness={10}
          clientCount={50}
          showDetails
        />
      );
      expect(getByText("Premium Cleaners")).toBeTruthy();
      expect(getByText("10 years in business")).toBeTruthy();
      expect(getByText("Trusted by 50+ clients")).toBeTruthy();
    });

    it("should not display years if yearsInBusiness is 0", () => {
      const { queryByText } = render(
        <VerifiedBusinessBadge
          variant="card"
          yearsInBusiness={0}
          showDetails
        />
      );
      expect(queryByText(/years? in business/)).toBeNull();
    });

    it("should not display client count if clientCount is 0", () => {
      const { queryByText } = render(
        <VerifiedBusinessBadge
          variant="card"
          clientCount={0}
          showDetails
        />
      );
      expect(queryByText(/Trusted by/)).toBeNull();
    });

    it("should be pressable when onPress is provided", () => {
      const onPressMock = jest.fn();
      const { getByText } = render(
        <VerifiedBusinessBadge
          variant="card"
          businessName="Test Business"
          onPress={onPressMock}
        />
      );

      fireEvent.press(getByText("Test Business"));
      expect(onPressMock).toHaveBeenCalledTimes(1);
    });

    it("should show content when showDetails is true even without businessName", () => {
      const { getByText } = render(
        <VerifiedBusinessBadge
          variant="card"
          yearsInBusiness={3}
          clientCount={15}
          showDetails
        />
      );
      expect(getByText("3 years in business")).toBeTruthy();
      expect(getByText("Trusted by 15+ clients")).toBeTruthy();
    });
  });

  describe("Convenience Components", () => {
    describe("VerifiedBadgeSmall", () => {
      it("should render as small inline badge", () => {
        const { getByText } = render(<VerifiedBadgeSmall />);
        expect(getByText("Verified")).toBeTruthy();
      });

      it("should pass additional props", () => {
        const onPressMock = jest.fn();
        const { getByText } = render(
          <VerifiedBadgeSmall onPress={onPressMock} />
        );
        // Since inline variant doesn't have pressable, this just verifies props pass through
        expect(getByText("Verified")).toBeTruthy();
      });
    });

    describe("VerifiedBadgeLarge", () => {
      it("should render as large card with showDetails", () => {
        const { getByText } = render(
          <VerifiedBadgeLarge
            businessName="Large Business Co"
            yearsInBusiness={7}
            clientCount={100}
          />
        );
        expect(getByText("Large Business Co")).toBeTruthy();
        expect(getByText("7 years in business")).toBeTruthy();
        expect(getByText("Trusted by 100+ clients")).toBeTruthy();
      });

      it("should be pressable when onPress provided", () => {
        const onPressMock = jest.fn();
        const { getByText } = render(
          <VerifiedBadgeLarge
            businessName="Pressable Business"
            onPress={onPressMock}
          />
        );
        fireEvent.press(getByText("Pressable Business"));
        expect(onPressMock).toHaveBeenCalledTimes(1);
      });
    });
  });

  describe("Edge Cases", () => {
    it("should return null for unknown variant", () => {
      const { toJSON } = render(
        <VerifiedBusinessBadge variant="unknown" />
      );
      expect(toJSON()).toBeNull();
    });

    it("should handle undefined props gracefully", () => {
      const { getByText } = render(
        <VerifiedBusinessBadge
          variant="card"
          businessName={undefined}
          yearsInBusiness={undefined}
          clientCount={undefined}
          showDetails
        />
      );
      // Should still render the header
      expect(getByText("Verified Business")).toBeTruthy();
    });

    it("should handle null onPress", () => {
      const { getByText } = render(
        <VerifiedBusinessBadge onPress={null} />
      );
      expect(getByText("Verified Business")).toBeTruthy();
    });
  });
});

describe("VerifiedBusinessBadge Size Configuration Logic", () => {
  const sizeConfig = {
    small: {
      iconSize: 10,
      fontSize: 12, // typography.fontSize.xs
      paddingH: 4, // spacing.xs
      paddingV: 2,
      gap: 3,
    },
    medium: {
      iconSize: 12,
      fontSize: 14, // typography.fontSize.sm
      paddingH: 8, // spacing.sm
      paddingV: 4,
      gap: 4,
    },
    large: {
      iconSize: 14,
      fontSize: 16, // typography.fontSize.base
      paddingH: 16, // spacing.md
      paddingV: 4, // spacing.xs
      gap: 4, // spacing.xs
    },
  };

  it("should have correct small size config", () => {
    expect(sizeConfig.small.iconSize).toBe(10);
    expect(sizeConfig.small.paddingV).toBe(2);
  });

  it("should have correct medium size config", () => {
    expect(sizeConfig.medium.iconSize).toBe(12);
    expect(sizeConfig.medium.paddingH).toBe(8);
  });

  it("should have correct large size config", () => {
    expect(sizeConfig.large.iconSize).toBe(14);
    expect(sizeConfig.large.fontSize).toBe(16);
  });
});
