const ReviewSerializer = require("../../serializers/ReviewSerializer");

describe("ReviewSerializer", () => {
  describe("serializeArray", () => {
    it("should serialize basic review fields", () => {
      const mockReviews = [
        {
          dataValues: {
            id: 1,
            userId: 10,
            reviewerId: 20,
            appointmentId: 100,
            reviewType: "homeowner_to_cleaner",
            review: 4.5,
            reviewComment: "Great job!",
            createdAt: "2025-12-30T10:00:00Z",
          },
        },
      ];

      const result = ReviewSerializer.serializeArray(mockReviews);

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe(1);
      expect(result[0].userId).toBe(10);
      expect(result[0].reviewerId).toBe(20);
      expect(result[0].appointmentId).toBe(100);
      expect(result[0].reviewType).toBe("homeowner_to_cleaner");
      expect(result[0].review).toBe(4.5);
      expect(result[0].reviewComment).toBe("Great job!");
    });

    it("should serialize homeowner-to-cleaner aspect ratings", () => {
      const mockReviews = [
        {
          dataValues: {
            id: 1,
            cleaningQuality: 5.0,
            punctuality: 4.5,
            professionalism: 5.0,
            attentionToDetail: 4.0,
            thoroughness: 4.5,
            respectOfProperty: 5.0,
            followedInstructions: 4.0,
            wouldRecommend: true,
          },
        },
      ];

      const result = ReviewSerializer.serializeArray(mockReviews);

      expect(result[0].cleaningQuality).toBe(5.0);
      expect(result[0].punctuality).toBe(4.5);
      expect(result[0].professionalism).toBe(5.0);
      expect(result[0].attentionToDetail).toBe(4.0);
      expect(result[0].thoroughness).toBe(4.5);
      expect(result[0].respectOfProperty).toBe(5.0);
      expect(result[0].followedInstructions).toBe(4.0);
      expect(result[0].wouldRecommend).toBe(true);
    });

    it("should serialize cleaner-to-homeowner aspect ratings", () => {
      const mockReviews = [
        {
          dataValues: {
            id: 1,
            accuracyOfDescription: 4.5,
            homeReadiness: 5.0,
            easeOfAccess: 4.0,
            homeCondition: 4.5,
            respectfulness: 5.0,
            safetyConditions: 4.0,
            communication: 4.5,
            wouldWorkForAgain: true,
          },
        },
      ];

      const result = ReviewSerializer.serializeArray(mockReviews);

      expect(result[0].accuracyOfDescription).toBe(4.5);
      expect(result[0].homeReadiness).toBe(5.0);
      expect(result[0].easeOfAccess).toBe(4.0);
      expect(result[0].homeCondition).toBe(4.5);
      expect(result[0].respectfulness).toBe(5.0);
      expect(result[0].safetyConditions).toBe(4.0);
      expect(result[0].communication).toBe(4.5);
      expect(result[0].wouldWorkForAgain).toBe(true);
    });

    it("should include reviewer association when present", () => {
      const mockReviews = [
        {
          dataValues: {
            id: 1,
            review: 4.5,
          },
          reviewer: {
            id: 20,
            username: "cleaner123",
            firstName: "John",
            lastName: "Doe",
          },
        },
      ];

      const result = ReviewSerializer.serializeArray(mockReviews);

      expect(result[0].reviewer).toBeTruthy();
      expect(result[0].reviewer.id).toBe(20);
      expect(result[0].reviewer.username).toBe("cleaner123");
      expect(result[0].reviewer.firstName).toBe("John");
      expect(result[0].reviewer.lastName).toBe("Doe");
    });

    it("should include reviewer from dataValues when available", () => {
      const mockReviews = [
        {
          dataValues: {
            id: 1,
            review: 4.5,
          },
          reviewer: {
            dataValues: {
              id: 20,
              username: "cleaner456",
              firstName: "Jane",
              lastName: "Smith",
            },
          },
        },
      ];

      const result = ReviewSerializer.serializeArray(mockReviews);

      expect(result[0].reviewer).toBeTruthy();
      expect(result[0].reviewer.id).toBe(20);
      expect(result[0].reviewer.username).toBe("cleaner456");
    });

    it("should not include reviewer when not present", () => {
      const mockReviews = [
        {
          dataValues: {
            id: 1,
            review: 4.5,
          },
        },
      ];

      const result = ReviewSerializer.serializeArray(mockReviews);

      expect(result[0].reviewer).toBeUndefined();
    });

    it("should handle null aspect ratings", () => {
      const mockReviews = [
        {
          dataValues: {
            id: 1,
            review: 4.5,
            cleaningQuality: null,
            punctuality: null,
            wouldRecommend: null,
            wouldWorkForAgain: null,
          },
        },
      ];

      const result = ReviewSerializer.serializeArray(mockReviews);

      expect(result[0].cleaningQuality).toBeNull();
      expect(result[0].punctuality).toBeNull();
      expect(result[0].wouldRecommend).toBeNull();
      expect(result[0].wouldWorkForAgain).toBeNull();
    });

    it("should serialize wouldWorkForAgain as false correctly", () => {
      const mockReviews = [
        {
          dataValues: {
            id: 1,
            review: 2.0,
            wouldWorkForAgain: false,
          },
        },
      ];

      const result = ReviewSerializer.serializeArray(mockReviews);

      expect(result[0].wouldWorkForAgain).toBe(false);
    });

    it("should serialize wouldRecommend as false correctly", () => {
      const mockReviews = [
        {
          dataValues: {
            id: 1,
            review: 2.0,
            wouldRecommend: false,
          },
        },
      ];

      const result = ReviewSerializer.serializeArray(mockReviews);

      expect(result[0].wouldRecommend).toBe(false);
    });

    it("should handle empty array", () => {
      const result = ReviewSerializer.serializeArray([]);
      expect(result).toEqual([]);
    });

    it("should serialize multiple reviews", () => {
      const mockReviews = [
        {
          dataValues: {
            id: 1,
            review: 5.0,
            reviewComment: "Excellent!",
          },
        },
        {
          dataValues: {
            id: 2,
            review: 4.0,
            reviewComment: "Good",
          },
        },
        {
          dataValues: {
            id: 3,
            review: 3.0,
            reviewComment: "Average",
          },
        },
      ];

      const result = ReviewSerializer.serializeArray(mockReviews);

      expect(result).toHaveLength(3);
      expect(result[0].review).toBe(5.0);
      expect(result[1].review).toBe(4.0);
      expect(result[2].review).toBe(3.0);
    });
  });
});
