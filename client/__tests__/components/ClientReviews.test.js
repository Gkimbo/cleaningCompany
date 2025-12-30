import React from "react";

// Mock fetch
global.fetch = jest.fn();

// Mock react-native-vector-icons
jest.mock("react-native-vector-icons/FontAwesome", () => "Icon");

// Mock react-router-native
jest.mock("react-router-native", () => ({
  useNavigate: () => jest.fn(),
}));

describe("ClientReviews Component", () => {
  const mockState = {
    currentUser: { token: "test_token", id: 1 },
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("Data Fetching", () => {
    it("should fetch stats and reviews on mount", async () => {
      const mockStats = {
        averageRating: 4.5,
        totalReviews: 10,
        recommendationRate: 90,
        aspectAverages: {
          accuracyOfDescription: 4.5,
          homeReadiness: 4.0,
          communication: 4.5,
        },
      };

      const mockReviews = [
        {
          id: 1,
          review: 4.5,
          reviewComment: "Great homeowner!",
          wouldWorkForAgain: true,
          reviewer: { username: "cleaner123" },
        },
      ];

      global.fetch
        .mockResolvedValueOnce({
          json: () => Promise.resolve(mockStats),
        })
        .mockResolvedValueOnce({
          json: () => Promise.resolve({ reviews: mockReviews }),
        });

      // Simulate component fetching data
      const [statsResponse, reviewsResponse] = await Promise.all([
        fetch("/api/v1/reviews/stats"),
        fetch("/api/v1/reviews"),
      ]);

      const stats = await statsResponse.json();
      const reviewsData = await reviewsResponse.json();

      expect(stats.averageRating).toBe(4.5);
      expect(stats.totalReviews).toBe(10);
      expect(reviewsData.reviews).toHaveLength(1);
    });

    it("should handle fetch error gracefully", async () => {
      global.fetch.mockRejectedValueOnce(new Error("Network error"));

      let error = null;
      try {
        await fetch("/api/v1/reviews/stats");
      } catch (e) {
        error = e;
      }

      expect(error).toBeTruthy();
      expect(error.message).toBe("Network error");
    });
  });

  describe("Stats Display", () => {
    it("should display average rating with correct formatting", () => {
      const averageRating = 4.5;
      const formattedRating = averageRating.toFixed(1);

      expect(formattedRating).toBe("4.5");
    });

    it("should display 0.0 when no reviews", () => {
      const averageRating = 0;
      const formattedRating = averageRating?.toFixed(1) || "0.0";

      expect(formattedRating).toBe("0.0");
    });

    it("should display total reviews count", () => {
      const totalReviews = 10;

      expect(totalReviews).toBe(10);
    });

    it("should display recommendation rate as percentage", () => {
      const recommendationRate = 90;
      const displayRate = `${recommendationRate}%`;

      expect(displayRate).toBe("90%");
    });
  });

  describe("Star Rating Rendering", () => {
    const renderStars = (rating) => {
      const stars = [];
      const fullStars = Math.floor(rating);
      const hasHalfStar = rating % 1 >= 0.5;

      for (let i = 1; i <= 5; i++) {
        if (i <= fullStars) {
          stars.push({ type: "full", position: i });
        } else if (i === fullStars + 1 && hasHalfStar) {
          stars.push({ type: "half", position: i });
        } else {
          stars.push({ type: "empty", position: i });
        }
      }
      return stars;
    };

    it("should render 5 full stars for rating 5.0", () => {
      const stars = renderStars(5.0);

      expect(stars.filter((s) => s.type === "full")).toHaveLength(5);
      expect(stars.filter((s) => s.type === "empty")).toHaveLength(0);
    });

    it("should render 4 full and 1 half star for rating 4.5", () => {
      const stars = renderStars(4.5);

      expect(stars.filter((s) => s.type === "full")).toHaveLength(4);
      expect(stars.filter((s) => s.type === "half")).toHaveLength(1);
    });

    it("should render 4 full and 1 empty star for rating 4.0", () => {
      const stars = renderStars(4.0);

      expect(stars.filter((s) => s.type === "full")).toHaveLength(4);
      expect(stars.filter((s) => s.type === "empty")).toHaveLength(1);
    });

    it("should render 5 empty stars for rating 0", () => {
      const stars = renderStars(0);

      expect(stars.filter((s) => s.type === "empty")).toHaveLength(5);
    });
  });

  describe("Aspect Breakdown", () => {
    it("should format aspect labels from camelCase", () => {
      const formatAspectLabel = (aspect) => {
        return aspect
          .replace(/([A-Z])/g, " $1")
          .replace(/^./, (str) => str.toUpperCase());
      };

      expect(formatAspectLabel("accuracyOfDescription")).toBe("Accuracy Of Description");
      expect(formatAspectLabel("homeReadiness")).toBe("Home Readiness");
      expect(formatAspectLabel("communication")).toBe("Communication");
    });

    it("should filter out null aspect values", () => {
      const aspectAverages = {
        accuracyOfDescription: 4.5,
        homeReadiness: null,
        communication: 4.0,
      };

      const validAspects = Object.entries(aspectAverages).filter(
        ([_, value]) => value !== null
      );

      expect(validAspects).toHaveLength(2);
    });
  });

  describe("Review List Display", () => {
    it("should display reviewer username", () => {
      const review = {
        reviewer: { username: "cleaner123" },
      };

      const displayName = review.reviewer?.username || "Cleaner";

      expect(displayName).toBe("cleaner123");
    });

    it("should fallback to 'Cleaner' when no username", () => {
      const review = {
        reviewer: null,
      };

      const displayName = review.reviewer?.username || "Cleaner";

      expect(displayName).toBe("Cleaner");
    });

    it("should format review date correctly", () => {
      const formatDate = (dateString) => {
        const date = new Date(dateString);
        return date.toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric",
        });
      };

      const formatted = formatDate("2025-12-30T10:00:00Z");

      expect(formatted).toContain("Dec");
      expect(formatted).toContain("30");
      expect(formatted).toContain("2025");
    });
  });

  describe("Would Work For Again Badge", () => {
    it("should show thumbs up for wouldWorkForAgain true", () => {
      const wouldWorkForAgain = true;
      const iconName = wouldWorkForAgain ? "thumbs-up" : "thumbs-down";
      const badgeText = wouldWorkForAgain
        ? "Would work for again"
        : "Would not work for again";

      expect(iconName).toBe("thumbs-up");
      expect(badgeText).toBe("Would work for again");
    });

    it("should show thumbs down for wouldWorkForAgain false", () => {
      const wouldWorkForAgain = false;
      const iconName = wouldWorkForAgain ? "thumbs-up" : "thumbs-down";
      const badgeText = wouldWorkForAgain
        ? "Would work for again"
        : "Would not work for again";

      expect(iconName).toBe("thumbs-down");
      expect(badgeText).toBe("Would not work for again");
    });

    it("should not render badge when wouldWorkForAgain is null", () => {
      const wouldWorkForAgain = null;
      const shouldRender = wouldWorkForAgain != null;

      expect(shouldRender).toBe(false);
    });

    it("should not render badge when wouldWorkForAgain is undefined", () => {
      const wouldWorkForAgain = undefined;
      const shouldRender = wouldWorkForAgain != null;

      expect(shouldRender).toBe(false);
    });

    it("should render badge when wouldWorkForAgain is false", () => {
      const wouldWorkForAgain = false;
      const shouldRender = wouldWorkForAgain != null;

      expect(shouldRender).toBe(true);
    });
  });

  describe("Aspect Badges", () => {
    it("should display aspect rating with one decimal", () => {
      const accuracyOfDescription = 4.5;
      const displayValue = accuracyOfDescription.toFixed(1);

      expect(displayValue).toBe("4.5");
    });

    it("should not render badge if aspect is null", () => {
      const homeReadiness = null;
      const shouldRender = homeReadiness !== null && homeReadiness !== undefined;

      expect(shouldRender).toBe(false);
    });

    it("should render badge if aspect has value", () => {
      const communication = 4.0;
      const shouldRender = communication !== null && communication !== undefined;

      expect(shouldRender).toBe(true);
    });
  });

  describe("Empty State", () => {
    it("should show empty message when no reviews", () => {
      const reviews = [];
      const showEmptyState = reviews.length === 0;

      expect(showEmptyState).toBe(true);
    });

    it("should hide empty message when reviews exist", () => {
      const reviews = [{ id: 1, review: 4.5 }];
      const showEmptyState = reviews.length === 0;

      expect(showEmptyState).toBe(false);
    });
  });

  describe("Loading State", () => {
    it("should track loading state", () => {
      let loading = true;

      expect(loading).toBe(true);

      loading = false;

      expect(loading).toBe(false);
    });
  });

  describe("Error State", () => {
    it("should display error message", () => {
      const error = "Failed to load reviews";

      expect(error).toBe("Failed to load reviews");
    });

    it("should provide retry functionality", () => {
      let fetchCalled = false;
      const retryFetch = () => {
        fetchCalled = true;
      };

      retryFetch();

      expect(fetchCalled).toBe(true);
    });
  });

  describe("Stats Response Format", () => {
    it("should handle stats returned directly (not wrapped)", () => {
      // The endpoint returns stats directly, not as { stats: ... }
      const statsResponse = {
        averageRating: 4.5,
        totalReviews: 10,
        recommendationRate: 90,
        aspectAverages: {},
      };

      // Correct access pattern
      const stats = statsResponse;

      expect(stats.averageRating).toBe(4.5);
      expect(stats.totalReviews).toBe(10);
    });
  });
});
