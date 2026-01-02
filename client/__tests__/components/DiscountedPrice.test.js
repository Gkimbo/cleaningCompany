import React from "react";
import { render } from "@testing-library/react-native";

// Mock dependencies
jest.mock("../../src/services/styles/theme", () => ({
  colors: {
    text: {
      primary: "#000",
      secondary: "#666",
      tertiary: "#999",
    },
    success: {
      600: "#43a047",
    },
  },
  spacing: { xs: 4, sm: 8, md: 12, lg: 16 },
  typography: {
    fontSize: { xs: 10, sm: 12, base: 14, lg: 18 },
    fontWeight: { normal: "400", medium: "500", semibold: "600", bold: "700" },
  },
}));

import DiscountedPrice from "../../src/components/pricing/DiscountedPrice";

describe("DiscountedPrice", () => {
  describe("No Discount Applied", () => {
    it("should show normal price when originalPrice equals discountedPrice", () => {
      const { getByText } = render(
        <DiscountedPrice originalPrice={200} discountedPrice={200} />
      );

      expect(getByText("$200.00")).toBeTruthy();
    });

    it("should show normal price when originalPrice is null", () => {
      const { getByText } = render(
        <DiscountedPrice originalPrice={null} discountedPrice={150} />
      );

      expect(getByText("$150.00")).toBeTruthy();
    });

    it("should show normal price when originalPrice is undefined", () => {
      const { getByText } = render(
        <DiscountedPrice discountedPrice={100} />
      );

      expect(getByText("$100.00")).toBeTruthy();
    });
  });

  describe("Discount Applied", () => {
    it("should show original price crossed out and discounted price", () => {
      const { getByText } = render(
        <DiscountedPrice originalPrice={200} discountedPrice={180} />
      );

      // Should show both original and discounted prices
      expect(getByText("$200.00")).toBeTruthy();
      expect(getByText("$180.00")).toBeTruthy();
    });

    it("should show 10% discount correctly", () => {
      const { getByText } = render(
        <DiscountedPrice originalPrice={100} discountedPrice={90} />
      );

      expect(getByText("$100.00")).toBeTruthy();
      expect(getByText("$90.00")).toBeTruthy();
    });

    it("should show 20% discount correctly", () => {
      const { getByText } = render(
        <DiscountedPrice originalPrice={150} discountedPrice={120} />
      );

      expect(getByText("$150.00")).toBeTruthy();
      expect(getByText("$120.00")).toBeTruthy();
    });

    it("should handle decimal prices", () => {
      const { getByText } = render(
        <DiscountedPrice originalPrice={99.99} discountedPrice={84.99} />
      );

      expect(getByText("$99.99")).toBeTruthy();
      expect(getByText("$84.99")).toBeTruthy();
    });
  });

  describe("showOriginal prop", () => {
    it("should hide original price when showOriginal is false", () => {
      const { queryByText, getByText } = render(
        <DiscountedPrice
          originalPrice={200}
          discountedPrice={180}
          showOriginal={false}
        />
      );

      // Discounted price should be visible
      expect(getByText("$180.00")).toBeTruthy();

      // Original price should not be visible
      expect(queryByText("$200.00")).toBeNull();
    });

    it("should show original price when showOriginal is true (default)", () => {
      const { getByText } = render(
        <DiscountedPrice
          originalPrice={200}
          discountedPrice={180}
          showOriginal={true}
        />
      );

      expect(getByText("$200.00")).toBeTruthy();
      expect(getByText("$180.00")).toBeTruthy();
    });
  });

  describe("Size variants", () => {
    it("should render with small size", () => {
      const { getByText } = render(
        <DiscountedPrice
          originalPrice={200}
          discountedPrice={180}
          size="sm"
        />
      );

      expect(getByText("$200.00")).toBeTruthy();
      expect(getByText("$180.00")).toBeTruthy();
    });

    it("should render with medium size (default)", () => {
      const { getByText } = render(
        <DiscountedPrice
          originalPrice={200}
          discountedPrice={180}
          size="md"
        />
      );

      expect(getByText("$200.00")).toBeTruthy();
      expect(getByText("$180.00")).toBeTruthy();
    });

    it("should render with large size", () => {
      const { getByText } = render(
        <DiscountedPrice
          originalPrice={200}
          discountedPrice={180}
          size="lg"
        />
      );

      expect(getByText("$200.00")).toBeTruthy();
      expect(getByText("$180.00")).toBeTruthy();
    });
  });

  describe("Price Formatting", () => {
    it("should format prices with two decimal places", () => {
      const { getByText } = render(
        <DiscountedPrice originalPrice={100} discountedPrice={90} />
      );

      expect(getByText("$100.00")).toBeTruthy();
      expect(getByText("$90.00")).toBeTruthy();
    });

    it("should handle string prices", () => {
      const { getByText } = render(
        <DiscountedPrice originalPrice="200" discountedPrice="180" />
      );

      expect(getByText("$200.00")).toBeTruthy();
      expect(getByText("$180.00")).toBeTruthy();
    });

    it("should handle large prices", () => {
      const { getByText } = render(
        <DiscountedPrice originalPrice={1500} discountedPrice={1200} />
      );

      expect(getByText("$1500.00")).toBeTruthy();
      expect(getByText("$1200.00")).toBeTruthy();
    });

    it("should handle small prices", () => {
      const { getByText } = render(
        <DiscountedPrice originalPrice={25.50} discountedPrice={21.68} />
      );

      expect(getByText("$25.50")).toBeTruthy();
      expect(getByText("$21.68")).toBeTruthy();
    });
  });

  describe("Edge Cases", () => {
    it("should handle zero discounted price", () => {
      const { getByText } = render(
        <DiscountedPrice originalPrice={50} discountedPrice={0} />
      );

      expect(getByText("$50.00")).toBeTruthy();
      expect(getByText("$0.00")).toBeTruthy();
    });

    it("should handle very small discount", () => {
      const { getByText } = render(
        <DiscountedPrice originalPrice={100} discountedPrice={99.99} />
      );

      expect(getByText("$100.00")).toBeTruthy();
      expect(getByText("$99.99")).toBeTruthy();
    });

    it("should render container when discount applied", () => {
      const { UNSAFE_root } = render(
        <DiscountedPrice originalPrice={200} discountedPrice={180} />
      );

      // Should have a View container with children
      expect(UNSAFE_root.children.length).toBeGreaterThan(0);
    });
  });
});
