import React from "react";
import { render, fireEvent } from "@testing-library/react-native";

// Mock dependencies
jest.mock("../../src/services/styles/theme", () => ({
  colors: {
    text: { primary: "#000", secondary: "#666", tertiary: "#999" },
    primary: { 50: "#f0f9ff", 100: "#e0f2fe", 600: "#0284c7", 700: "#0369a1" },
    success: { 50: "#f0fdf4", 500: "#22c55e", 600: "#16a34a", 700: "#15803d" },
    warning: { 500: "#f59e0b" },
    neutral: { 0: "#fff", 100: "#f5f5f5" },
    border: { light: "#e5e5e5" },
  },
  spacing: { xs: 4, sm: 8, md: 12, lg: 16 },
  radius: { md: 8, lg: 12, xl: 16, full: 9999 },
  typography: {
    fontSize: { xs: 10, sm: 12, base: 14, lg: 18, xl: 20 },
    fontWeight: { normal: "400", medium: "500", semibold: "600", bold: "700" },
  },
  shadows: { md: {} },
}));

jest.mock("@expo/vector-icons", () => ({
  Feather: () => "Feather",
}));

// Mock PricingContext
const mockPricing = {
  basePrice: 140,
  extraBedBathFee: 15,
  halfBathFee: 7,
};

jest.mock("../../src/context/PricingContext", () => ({
  usePricing: () => ({ pricing: mockPricing, loading: false }),
  calculateBasePrice: (pricing, beds, baths) => {
    if (!pricing) return null;
    // Simple calculation: base + extra for beds/baths above 1
    const extraBeds = Math.max(0, beds - 1);
    const extraBaths = Math.max(0, Math.floor(baths) - 1);
    const halfBath = baths % 1 > 0 ? 7 : 0;
    return pricing.basePrice + (extraBeds + extraBaths) * pricing.extraBedBathFee + halfBath;
  },
}));

import MyCleanerCard from "../../src/components/client/MyCleanerCard";

describe("MyCleanerCard", () => {
  const mockCleaner = {
    id: 1,
    firstName: "Jane",
    lastName: "Doe",
    profilePhoto: null,
    averageRating: 4.8,
    totalReviews: 127,
  };

  const mockRelationship = {
    id: 1,
    defaultPrice: 150,
    defaultFrequency: "weekly",
    autoPayEnabled: true,
    since: "2024-01-15T00:00:00Z",
  };

  const mockHome = {
    id: 10,
    numBeds: 3,
    numBaths: 2,
  };

  const mockOnMessage = jest.fn();
  const mockOnViewProfile = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("Basic Rendering", () => {
    it("should render cleaner information", () => {
      const { getByText } = render(
        <MyCleanerCard
          cleaner={mockCleaner}
          relationship={mockRelationship}
          home={mockHome}
        />
      );

      expect(getByText("Jane Doe")).toBeTruthy();
      expect(getByText("Your Cleaner")).toBeTruthy();
    });

    it("should return null when cleaner is not provided", () => {
      const { toJSON } = render(
        <MyCleanerCard cleaner={null} relationship={mockRelationship} />
      );

      expect(toJSON()).toBeNull();
    });

    it("should show avatar initial when no profile photo", () => {
      const { getByText } = render(
        <MyCleanerCard
          cleaner={mockCleaner}
          relationship={mockRelationship}
        />
      );

      expect(getByText("J")).toBeTruthy();
    });

    it("should display rating and review count", () => {
      const { getByText } = render(
        <MyCleanerCard
          cleaner={mockCleaner}
          relationship={mockRelationship}
        />
      );

      expect(getByText("4.8 (127 reviews)")).toBeTruthy();
    });

    it("should display client since date", () => {
      const { getByText } = render(
        <MyCleanerCard
          cleaner={mockCleaner}
          relationship={mockRelationship}
        />
      );

      expect(getByText("Client since Jan 2024")).toBeTruthy();
    });
  });

  describe("Pricing Display", () => {
    it("should display cleaner's price", () => {
      const { getByText } = render(
        <MyCleanerCard
          cleaner={mockCleaner}
          relationship={mockRelationship}
          home={mockHome}
        />
      );

      expect(getByText("$150/cleaning")).toBeTruthy();
      expect(getByText("Your Rate")).toBeTruthy();
    });

    it("should show savings when cleaner price is lower than platform price", () => {
      // Platform price for 3 bed, 2 bath: 140 + (2 + 1) * 15 = 185
      // Cleaner price: 150
      // Savings: 185 - 150 = 35
      const { getByText } = render(
        <MyCleanerCard
          cleaner={mockCleaner}
          relationship={{ ...mockRelationship, defaultPrice: 150 }}
          home={mockHome}
        />
      );

      expect(getByText("Save $35 vs platform rate")).toBeTruthy();
    });

    it("should not show savings when cleaner price equals platform price", () => {
      // Platform price for 3 bed, 2 bath = 185
      const { queryByText } = render(
        <MyCleanerCard
          cleaner={mockCleaner}
          relationship={{ ...mockRelationship, defaultPrice: 185 }}
          home={mockHome}
        />
      );

      expect(queryByText(/Save \$\d+ vs platform rate/)).toBeNull();
    });

    it("should not show savings when cleaner price is higher than platform price", () => {
      const { queryByText } = render(
        <MyCleanerCard
          cleaner={mockCleaner}
          relationship={{ ...mockRelationship, defaultPrice: 200 }}
          home={mockHome}
        />
      );

      expect(queryByText(/Save \$\d+ vs platform rate/)).toBeNull();
    });

    it("should not show pricing section when no defaultPrice", () => {
      const { queryByText } = render(
        <MyCleanerCard
          cleaner={mockCleaner}
          relationship={{ ...mockRelationship, defaultPrice: null }}
          home={mockHome}
        />
      );

      expect(queryByText("Your Rate")).toBeNull();
    });

    it("should handle missing home data for platform price calculation", () => {
      const { getByText, queryByText } = render(
        <MyCleanerCard
          cleaner={mockCleaner}
          relationship={mockRelationship}
          home={null}
        />
      );

      // Should still show cleaner price
      expect(getByText("$150/cleaning")).toBeTruthy();
      // Should not show savings (can't calculate platform price)
      expect(queryByText(/Save \$\d+ vs platform rate/)).toBeNull();
    });
  });

  describe("Relationship Info", () => {
    it("should display frequency pill", () => {
      const { getByText } = render(
        <MyCleanerCard
          cleaner={mockCleaner}
          relationship={mockRelationship}
        />
      );

      expect(getByText("Weekly")).toBeTruthy();
    });

    it("should display biweekly frequency", () => {
      const { getByText } = render(
        <MyCleanerCard
          cleaner={mockCleaner}
          relationship={{ ...mockRelationship, defaultFrequency: "biweekly" }}
        />
      );

      expect(getByText("Every 2 Weeks")).toBeTruthy();
    });

    it("should display monthly frequency", () => {
      const { getByText } = render(
        <MyCleanerCard
          cleaner={mockCleaner}
          relationship={{ ...mockRelationship, defaultFrequency: "monthly" }}
        />
      );

      expect(getByText("Monthly")).toBeTruthy();
    });

    it("should display on demand frequency", () => {
      const { getByText } = render(
        <MyCleanerCard
          cleaner={mockCleaner}
          relationship={{ ...mockRelationship, defaultFrequency: "on_demand" }}
        />
      );

      expect(getByText("On Demand")).toBeTruthy();
    });

    it("should display auto-pay pill when enabled", () => {
      const { getByText } = render(
        <MyCleanerCard
          cleaner={mockCleaner}
          relationship={{ ...mockRelationship, autoPayEnabled: true }}
        />
      );

      expect(getByText("Auto-Pay On")).toBeTruthy();
    });

    it("should not display auto-pay pill when disabled", () => {
      const { queryByText } = render(
        <MyCleanerCard
          cleaner={mockCleaner}
          relationship={{ ...mockRelationship, autoPayEnabled: false }}
        />
      );

      expect(queryByText("Auto-Pay On")).toBeNull();
    });
  });

  describe("Action Buttons", () => {
    it("should render message button when onMessage provided", () => {
      const { getByText } = render(
        <MyCleanerCard
          cleaner={mockCleaner}
          relationship={mockRelationship}
          onMessage={mockOnMessage}
        />
      );

      expect(getByText("Message")).toBeTruthy();
    });

    it("should call onMessage when message button pressed", () => {
      const { getByText } = render(
        <MyCleanerCard
          cleaner={mockCleaner}
          relationship={mockRelationship}
          onMessage={mockOnMessage}
        />
      );

      fireEvent.press(getByText("Message"));
      expect(mockOnMessage).toHaveBeenCalled();
    });

    it("should render view profile button when onViewProfile provided", () => {
      const { getByText } = render(
        <MyCleanerCard
          cleaner={mockCleaner}
          relationship={mockRelationship}
          onViewProfile={mockOnViewProfile}
        />
      );

      expect(getByText("View Profile")).toBeTruthy();
    });

    it("should call onViewProfile when view profile button pressed", () => {
      const { getByText } = render(
        <MyCleanerCard
          cleaner={mockCleaner}
          relationship={mockRelationship}
          onViewProfile={mockOnViewProfile}
        />
      );

      fireEvent.press(getByText("View Profile"));
      expect(mockOnViewProfile).toHaveBeenCalled();
    });

    it("should not render action buttons when handlers not provided", () => {
      const { queryByText } = render(
        <MyCleanerCard
          cleaner={mockCleaner}
          relationship={mockRelationship}
        />
      );

      expect(queryByText("Message")).toBeNull();
      expect(queryByText("View Profile")).toBeNull();
    });
  });

  describe("Edge Cases", () => {
    it("should handle cleaner without rating", () => {
      const cleanerNoRating = { ...mockCleaner, averageRating: null, totalReviews: 0 };
      const { queryByText } = render(
        <MyCleanerCard
          cleaner={cleanerNoRating}
          relationship={mockRelationship}
        />
      );

      expect(queryByText(/reviews/)).toBeNull();
    });

    it("should handle relationship without since date", () => {
      const relationshipNoSince = { ...mockRelationship, since: null };
      const { queryByText } = render(
        <MyCleanerCard
          cleaner={mockCleaner}
          relationship={relationshipNoSince}
        />
      );

      expect(queryByText(/Client since/)).toBeNull();
    });

    it("should handle relationship without frequency", () => {
      const relationshipNoFreq = { ...mockRelationship, defaultFrequency: null };
      const { queryByText } = render(
        <MyCleanerCard
          cleaner={mockCleaner}
          relationship={relationshipNoFreq}
        />
      );

      expect(queryByText("Weekly")).toBeNull();
      expect(queryByText("Every 2 Weeks")).toBeNull();
    });
  });
});
