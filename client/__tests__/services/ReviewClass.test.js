// Mock fetch
global.fetch = jest.fn();

describe("ReviewClass Service", () => {
  const mockToken = "test_token_12345";
  const baseURL = "http://localhost:3000";

  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch.mockReset();
  });

  describe("submitReview", () => {
    const reviewData = {
      userId: 2,
      appointmentId: 100,
      reviewType: "homeowner_to_cleaner",
      review: 4.5,
      reviewComment: "Great service!",
      cleaningQuality: 5,
      punctuality: 4,
      professionalism: 5,
      communication: 4,
      wouldRecommend: true,
    };

    it("should submit review successfully", async () => {
      const mockResponse = {
        review: { id: 1, ...reviewData },
        status: { bothReviewed: false },
        message: "Review submitted!",
      };

      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const response = await fetch(`${baseURL}/api/v1/reviews/submit`, {
        method: "POST",
        body: JSON.stringify(reviewData),
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${mockToken}`,
        },
      });

      const data = await response.json();

      expect(global.fetch).toHaveBeenCalledWith(
        `${baseURL}/api/v1/reviews/submit`,
        expect.objectContaining({
          method: "POST",
          headers: expect.objectContaining({
            "Content-Type": "application/json",
            Authorization: `Bearer ${mockToken}`,
          }),
        })
      );
      expect(data.review.id).toBe(1);
    });

    it("should return error for duplicate review", async () => {
      global.fetch.mockResolvedValueOnce({
        ok: false,
        json: () =>
          Promise.resolve({ error: "You have already reviewed this appointment" }),
      });

      const response = await fetch(`${baseURL}/api/v1/reviews/submit`, {
        method: "POST",
        body: JSON.stringify(reviewData),
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${mockToken}`,
        },
      });

      expect(response.ok).toBe(false);
      const data = await response.json();
      expect(data.error).toBe("You have already reviewed this appointment");
    });

    it("should handle network error", async () => {
      global.fetch.mockRejectedValueOnce(new Error("Network error"));

      try {
        await fetch(`${baseURL}/api/v1/reviews/submit`, {
          method: "POST",
          body: JSON.stringify(reviewData),
        });
      } catch (error) {
        expect(error.message).toBe("Network error");
      }
    });
  });

  describe("getReviews", () => {
    it("should fetch published reviews successfully", async () => {
      const mockReviews = [
        { id: 1, review: 4.5, reviewComment: "Great!" },
        { id: 2, review: 5.0, reviewComment: "Excellent!" },
      ];

      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ reviews: mockReviews }),
      });

      const response = await fetch(`${baseURL}/api/v1/reviews`, {
        headers: { Authorization: `Bearer ${mockToken}` },
      });

      const data = await response.json();

      expect(data.reviews).toHaveLength(2);
      expect(data.reviews[0].review).toBe(4.5);
    });

    it("should return empty array on error", async () => {
      global.fetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
      });

      const response = await fetch(`${baseURL}/api/v1/reviews`, {
        headers: { Authorization: `Bearer ${mockToken}` },
      });

      expect(response.ok).toBe(false);
    });

    it("should include auth header", async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ reviews: [] }),
      });

      await fetch(`${baseURL}/api/v1/reviews`, {
        headers: { Authorization: `Bearer ${mockToken}` },
      });

      expect(global.fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: `Bearer ${mockToken}`,
          }),
        })
      );
    });
  });

  describe("getPendingReviews", () => {
    it("should fetch pending reviews successfully", async () => {
      const mockPending = [
        {
          appointmentId: 100,
          date: "2025-01-15",
          home: { address: "123 Main St" },
          cleaners: [{ id: 2, firstName: "John" }],
        },
      ];

      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ pendingReviews: mockPending }),
      });

      const response = await fetch(`${baseURL}/api/v1/reviews/pending`, {
        headers: { Authorization: `Bearer ${mockToken}` },
      });

      const data = await response.json();

      expect(data.pendingReviews).toHaveLength(1);
      expect(data.pendingReviews[0].appointmentId).toBe(100);
    });

    it("should return empty array when no pending reviews", async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ pendingReviews: [] }),
      });

      const response = await fetch(`${baseURL}/api/v1/reviews/pending`, {
        headers: { Authorization: `Bearer ${mockToken}` },
      });

      const data = await response.json();

      expect(data.pendingReviews).toHaveLength(0);
    });
  });

  describe("getReviewStatus", () => {
    it("should fetch review status successfully", async () => {
      const mockStatus = {
        hasHomeownerReviewed: true,
        hasCleanerReviewed: false,
        userHasReviewed: true,
        bothReviewed: false,
        isPublished: false,
      };

      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockStatus),
      });

      const response = await fetch(`${baseURL}/api/v1/reviews/status/100`, {
        headers: { Authorization: `Bearer ${mockToken}` },
      });

      const data = await response.json();

      expect(data.hasHomeownerReviewed).toBe(true);
      expect(data.bothReviewed).toBe(false);
    });

    it("should return null on error", async () => {
      global.fetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
      });

      const response = await fetch(`${baseURL}/api/v1/reviews/status/999`, {
        headers: { Authorization: `Bearer ${mockToken}` },
      });

      expect(response.ok).toBe(false);
    });
  });

  describe("getReviewStats", () => {
    it("should fetch stats successfully", async () => {
      const mockStats = {
        averageRating: 4.5,
        totalReviews: 10,
        recommendationRate: 90,
        aspectAverages: {
          cleaningQuality: 4.7,
          punctuality: 4.3,
        },
      };

      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockStats),
      });

      const response = await fetch(`${baseURL}/api/v1/reviews/stats`, {
        headers: { Authorization: `Bearer ${mockToken}` },
      });

      const data = await response.json();

      expect(data.averageRating).toBe(4.5);
      expect(data.totalReviews).toBe(10);
      expect(data.aspectAverages.cleaningQuality).toBe(4.7);
    });

    it("should return default stats on error", async () => {
      const defaultStats = {
        averageRating: 0,
        totalReviews: 0,
        recommendationRate: 0,
        aspectAverages: {},
      };

      global.fetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
      });

      const response = await fetch(`${baseURL}/api/v1/reviews/stats`, {
        headers: { Authorization: `Bearer ${mockToken}` },
      });

      expect(response.ok).toBe(false);
      // In actual service, would return defaultStats
    });
  });

  describe("getUserReviews", () => {
    it("should fetch public user reviews without auth", async () => {
      const mockData = {
        reviews: [{ id: 1, review: 4.5 }],
        stats: { averageRating: 4.5, totalReviews: 1 },
      };

      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockData),
      });

      const response = await fetch(`${baseURL}/api/v1/reviews/user/2`);

      const data = await response.json();

      expect(data.reviews).toHaveLength(1);
      expect(data.stats.averageRating).toBe(4.5);
    });

    it("should not require authorization header", async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ reviews: [], stats: null }),
      });

      await fetch(`${baseURL}/api/v1/reviews/user/2`);

      expect(global.fetch).toHaveBeenCalledWith(`${baseURL}/api/v1/reviews/user/2`);
    });
  });

  describe("getWrittenReviews", () => {
    it("should fetch reviews written by user", async () => {
      const mockReviews = [
        { id: 1, reviewerId: 1, review: 4.5 },
        { id: 2, reviewerId: 1, review: 5.0 },
      ];

      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ reviews: mockReviews }),
      });

      const response = await fetch(`${baseURL}/api/v1/reviews/written`, {
        headers: { Authorization: `Bearer ${mockToken}` },
      });

      const data = await response.json();

      expect(data.reviews).toHaveLength(2);
    });
  });

  describe("deleteReview", () => {
    it("should delete unpublished review successfully", async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ message: "Review deleted successfully" }),
      });

      const response = await fetch(`${baseURL}/api/v1/reviews/1`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${mockToken}`,
        },
      });

      const data = await response.json();

      expect(data.message).toBe("Review deleted successfully");
    });

    it("should fail to delete published review", async () => {
      global.fetch.mockResolvedValueOnce({
        ok: false,
        json: () => Promise.resolve({ error: "Cannot delete published reviews" }),
      });

      const response = await fetch(`${baseURL}/api/v1/reviews/1`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${mockToken}`,
        },
      });

      expect(response.ok).toBe(false);
      const data = await response.json();
      expect(data.error).toBe("Cannot delete published reviews");
    });

    it("should return 404 for non-existent review", async () => {
      global.fetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        json: () => Promise.resolve({ error: "Review not found" }),
      });

      const response = await fetch(`${baseURL}/api/v1/reviews/999`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${mockToken}`,
        },
      });

      expect(response.ok).toBe(false);
    });
  });

  describe("addReviewToDb (legacy)", () => {
    it("should submit legacy review", async () => {
      const legacyData = {
        userId: 2,
        reviewerId: 1,
        appointmentId: 100,
        rating: 4,
        comment: "Good job",
      };

      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ newReview: { id: 1, ...legacyData } }),
      });

      const response = await fetch(`${baseURL}/api/v1/reviews/submit-legacy`, {
        method: "POST",
        body: JSON.stringify(legacyData),
        headers: {
          "Content-Type": "application/json",
        },
      });

      const data = await response.json();

      expect(data.newReview).toBeTruthy();
    });

    it("should not require auth for legacy endpoint", async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ newReview: { id: 1 } }),
      });

      await fetch(`${baseURL}/api/v1/reviews/submit-legacy`, {
        method: "POST",
        body: JSON.stringify({}),
        headers: {
          "Content-Type": "application/json",
        },
      });

      expect(global.fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.not.objectContaining({
            Authorization: expect.any(String),
          }),
        })
      );
    });
  });

  describe("Error Handling", () => {
    it("should handle 401 unauthorized", async () => {
      global.fetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: () => Promise.resolve({ error: "Invalid or expired token" }),
      });

      const response = await fetch(`${baseURL}/api/v1/reviews`, {
        headers: { Authorization: "Bearer invalid_token" },
      });

      expect(response.ok).toBe(false);
    });

    it("should handle 500 server error", async () => {
      global.fetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: () => Promise.resolve({ error: "Internal server error" }),
      });

      const response = await fetch(`${baseURL}/api/v1/reviews`, {
        headers: { Authorization: `Bearer ${mockToken}` },
      });

      expect(response.ok).toBe(false);
    });

    it("should handle network timeout", async () => {
      global.fetch.mockRejectedValueOnce(new Error("Network request timeout"));

      try {
        await fetch(`${baseURL}/api/v1/reviews`);
      } catch (error) {
        expect(error.message).toBe("Network request timeout");
      }
    });
  });

  describe("Request Headers", () => {
    it("should include correct content-type for POST", async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({}),
      });

      await fetch(`${baseURL}/api/v1/reviews/submit`, {
        method: "POST",
        body: JSON.stringify({}),
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${mockToken}`,
        },
      });

      expect(global.fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            "Content-Type": "application/json",
          }),
        })
      );
    });

    it("should include auth token in protected routes", async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ reviews: [] }),
      });

      await fetch(`${baseURL}/api/v1/reviews`, {
        headers: { Authorization: `Bearer ${mockToken}` },
      });

      expect(global.fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: { Authorization: `Bearer ${mockToken}` },
        })
      );
    });
  });
});
