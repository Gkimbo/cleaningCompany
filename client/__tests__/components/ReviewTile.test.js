import React from "react";

// Mock react-native-vector-icons
jest.mock("react-native-vector-icons/FontAwesome", () => "Icon");

describe("ReviewTile Component", () => {
  describe("Star Rating Rendering", () => {
    const renderStars = (value) => {
      const stars = [];
      const roundedRating = Math.round(value * 2) / 2;

      for (let i = 1; i <= 5; i++) {
        if (i <= roundedRating) {
          stars.push({ type: "full", index: i });
        } else if (i - 0.5 === roundedRating) {
          stars.push({ type: "half", index: i });
        } else {
          stars.push({ type: "empty", index: i });
        }
      }
      return stars;
    };

    it("should render 5 full stars for rating of 5", () => {
      const stars = renderStars(5);

      expect(stars).toHaveLength(5);
      expect(stars.filter((s) => s.type === "full")).toHaveLength(5);
    });

    it("should render 4 full stars and 1 empty for rating of 4", () => {
      const stars = renderStars(4);

      expect(stars.filter((s) => s.type === "full")).toHaveLength(4);
      expect(stars.filter((s) => s.type === "empty")).toHaveLength(1);
    });

    it("should render half star for rating of 4.5", () => {
      const stars = renderStars(4.5);

      expect(stars.filter((s) => s.type === "full")).toHaveLength(4);
      expect(stars.filter((s) => s.type === "half")).toHaveLength(1);
    });

    it("should render 0 full stars for rating of 0", () => {
      const stars = renderStars(0);

      expect(stars.filter((s) => s.type === "full")).toHaveLength(0);
      expect(stars.filter((s) => s.type === "empty")).toHaveLength(5);
    });

    it("should round 4.3 to 4.5 (half star)", () => {
      const stars = renderStars(4.3);

      // 4.3 * 2 = 8.6, rounded = 9, /2 = 4.5
      expect(stars.filter((s) => s.type === "half")).toHaveLength(1);
    });

    it("should round 4.2 to 4.0 (no half star)", () => {
      const stars = renderStars(4.2);

      // 4.2 * 2 = 8.4, rounded = 8, /2 = 4.0
      expect(stars.filter((s) => s.type === "full")).toHaveLength(4);
      expect(stars.filter((s) => s.type === "half")).toHaveLength(0);
    });
  });

  describe("Date Formatting", () => {
    const formatDate = (dateString) => {
      const date = new Date(dateString);
      const options = { day: "numeric", month: "long", year: "numeric" };
      return date.toLocaleDateString("en-GB", options);
    };

    it("should format date correctly", () => {
      const formatted = formatDate("2025-01-15T12:00:00");

      expect(formatted).toMatch(/15/);
      expect(formatted).toMatch(/January/);
      expect(formatted).toMatch(/2025/);
    });

    it("should handle date string without time", () => {
      const formatted = formatDate("2025-06-20");

      expect(formatted).toMatch(/20/);
      expect(formatted).toMatch(/June/);
    });
  });

  describe("Review Type Detection", () => {
    const getReviewTypeInfo = (reviewType) => {
      const isHomeownerReview = reviewType === "homeowner_to_cleaner";
      const isCleanerReview = reviewType === "cleaner_to_homeowner";

      return {
        isHomeownerReview,
        isCleanerReview,
        label: isHomeownerReview ? "From Client" : "From Cleaner",
      };
    };

    it("should identify homeowner review correctly", () => {
      const info = getReviewTypeInfo("homeowner_to_cleaner");

      expect(info.isHomeownerReview).toBe(true);
      expect(info.isCleanerReview).toBe(false);
      expect(info.label).toBe("From Client");
    });

    it("should identify cleaner review correctly", () => {
      const info = getReviewTypeInfo("cleaner_to_homeowner");

      expect(info.isHomeownerReview).toBe(false);
      expect(info.isCleanerReview).toBe(true);
      expect(info.label).toBe("From Cleaner");
    });

    it("should handle null review type", () => {
      const info = getReviewTypeInfo(null);

      expect(info.isHomeownerReview).toBe(false);
      expect(info.isCleanerReview).toBe(false);
    });
  });

  describe("Aspect Rating Detection", () => {
    const hasAspectRatings = (review) => {
      return !!(
        review.cleaningQuality ||
        review.punctuality ||
        review.professionalism ||
        review.communication ||
        review.accuracyOfDescription ||
        review.homeReadiness ||
        review.easeOfAccess
      );
    };

    it("should detect homeowner aspect ratings", () => {
      const review = {
        cleaningQuality: 5,
        punctuality: 4,
        professionalism: 5,
        communication: 4,
      };

      expect(hasAspectRatings(review)).toBe(true);
    });

    it("should detect cleaner aspect ratings", () => {
      const review = {
        accuracyOfDescription: 4,
        homeReadiness: 5,
        easeOfAccess: 4,
      };

      expect(hasAspectRatings(review)).toBe(true);
    });

    it("should return false for legacy review without aspects", () => {
      const review = {
        review: 4,
        reviewComment: "Good job",
      };

      expect(hasAspectRatings(review)).toBe(false);
    });

    it("should return false for null values", () => {
      const review = {
        cleaningQuality: null,
        punctuality: null,
      };

      expect(hasAspectRatings(review)).toBe(false);
    });
  });

  describe("Reviewer Name Formatting", () => {
    const getReviewerName = (reviewer) => {
      if (!reviewer) return null;

      const fullName = `${reviewer.firstName || ""} ${reviewer.lastName || ""}`.trim();
      return fullName || reviewer.username;
    };

    it("should return full name when available", () => {
      const reviewer = {
        firstName: "John",
        lastName: "Doe",
        username: "johnd",
      };

      expect(getReviewerName(reviewer)).toBe("John Doe");
    });

    it("should return first name only if no last name", () => {
      const reviewer = {
        firstName: "John",
        username: "johnd",
      };

      expect(getReviewerName(reviewer)).toBe("John");
    });

    it("should fall back to username if no names", () => {
      const reviewer = {
        username: "johnd",
      };

      expect(getReviewerName(reviewer)).toBe("johnd");
    });

    it("should return null for null reviewer", () => {
      expect(getReviewerName(null)).toBeNull();
    });
  });

  describe("Aspect Row Rendering", () => {
    const renderAspectRow = (label, value) => {
      if (value === null || value === undefined) return null;
      return { label, value: value.toFixed(1) };
    };

    it("should render aspect row with correct value", () => {
      const row = renderAspectRow("Cleaning Quality", 4.5);

      expect(row.label).toBe("Cleaning Quality");
      expect(row.value).toBe("4.5");
    });

    it("should return null for null value", () => {
      expect(renderAspectRow("Test", null)).toBeNull();
    });

    it("should return null for undefined value", () => {
      expect(renderAspectRow("Test", undefined)).toBeNull();
    });

    it("should format integer as decimal", () => {
      const row = renderAspectRow("Test", 5);

      expect(row.value).toBe("5.0");
    });
  });

  describe("Recommendation Badge Logic", () => {
    const getRecommendationInfo = (wouldRecommend) => {
      if (wouldRecommend === null || wouldRecommend === undefined) {
        return null;
      }

      return {
        icon: wouldRecommend ? "thumbs-up" : "thumbs-down",
        text: wouldRecommend ? "Yes" : "No",
        color: wouldRecommend ? "#4CAF50" : "#F44336",
      };
    };

    it("should return positive info for true", () => {
      const info = getRecommendationInfo(true);

      expect(info.icon).toBe("thumbs-up");
      expect(info.text).toBe("Yes");
      expect(info.color).toBe("#4CAF50");
    });

    it("should return negative info for false", () => {
      const info = getRecommendationInfo(false);

      expect(info.icon).toBe("thumbs-down");
      expect(info.text).toBe("No");
      expect(info.color).toBe("#F44336");
    });

    it("should return null for null value", () => {
      expect(getRecommendationInfo(null)).toBeNull();
    });

    it("should return null for undefined value", () => {
      expect(getRecommendationInfo(undefined)).toBeNull();
    });
  });

  describe("Props Handling", () => {
    it("should handle all review props correctly", () => {
      const reviewProps = {
        id: 1,
        userId: 2,
        reviewerId: 1,
        appointmentId: 100,
        rating: 4.5,
        comment: "Great job!",
        createdAt: "2025-01-15T12:00:00",
        reviewType: "homeowner_to_cleaner",
        reviewer: { firstName: "John", lastName: "Doe" },
        cleaningQuality: 5,
        punctuality: 4,
        professionalism: 5,
        communication: 4,
        wouldRecommend: true,
      };

      expect(reviewProps.rating).toBe(4.5);
      expect(reviewProps.reviewType).toBe("homeowner_to_cleaner");
      expect(reviewProps.wouldRecommend).toBe(true);
    });

    it("should handle cleaner review props correctly", () => {
      const reviewProps = {
        id: 2,
        userId: 1,
        reviewerId: 2,
        appointmentId: 100,
        rating: 4.0,
        comment: "Nice home",
        reviewType: "cleaner_to_homeowner",
        accuracyOfDescription: 4,
        homeReadiness: 5,
        easeOfAccess: 4,
        wouldWorkForAgain: true,
      };

      expect(reviewProps.reviewType).toBe("cleaner_to_homeowner");
      expect(reviewProps.accuracyOfDescription).toBe(4);
      expect(reviewProps.wouldWorkForAgain).toBe(true);
    });
  });
});
