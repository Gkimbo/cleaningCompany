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
      // firstName and lastName are no longer included in serialization (only username)
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

    it("should include reviewerName field in serialization", () => {
      const mockReviews = [
        {
          dataValues: {
            id: 1,
            review: 4.5,
            reviewerName: "John Doe",
          },
        },
      ];

      const result = ReviewSerializer.serializeArray(mockReviews);

      expect(result[0].reviewerName).toBe("John Doe");
    });

    it("should create reviewer object with displayName when reviewer was deleted", () => {
      const mockReviews = [
        {
          dataValues: {
            id: 1,
            review: 4.5,
            reviewerId: null,
            reviewerName: "Deleted Cleaner",
          },
          reviewer: null,
        },
      ];

      const result = ReviewSerializer.serializeArray(mockReviews);

      expect(result[0].reviewer).toBeTruthy();
      expect(result[0].reviewer.id).toBeNull();
      expect(result[0].reviewer.username).toBeNull();
      expect(result[0].reviewer.displayName).toBe("Deleted Cleaner");
    });

    it("should include firstName and lastName when reviewer exists", () => {
      const mockReviews = [
        {
          dataValues: {
            id: 1,
            review: 4.5,
          },
          reviewer: {
            id: 20,
            username: "johndoe",
            firstName: "John",
            lastName: "Doe",
          },
        },
      ];

      const result = ReviewSerializer.serializeArray(mockReviews);

      expect(result[0].reviewer).toBeTruthy();
      expect(result[0].reviewer.id).toBe(20);
      expect(result[0].reviewer.username).toBe("johndoe");
      expect(result[0].reviewer.firstName).toBe("John");
      expect(result[0].reviewer.lastName).toBe("Doe");
    });

    it("should not create reviewer object when no reviewer and no reviewerName", () => {
      const mockReviews = [
        {
          dataValues: {
            id: 1,
            review: 4.5,
            reviewerName: null,
          },
          reviewer: null,
        },
      ];

      const result = ReviewSerializer.serializeArray(mockReviews);

      expect(result[0].reviewer).toBeUndefined();
    });

    it("should prefer reviewer object over reviewerName when both exist", () => {
      const mockReviews = [
        {
          dataValues: {
            id: 1,
            review: 4.5,
            reviewerName: "Stored Name",
          },
          reviewer: {
            id: 20,
            username: "actualuser",
            firstName: "Actual",
            lastName: "User",
          },
        },
      ];

      const result = ReviewSerializer.serializeArray(mockReviews);

      // Should use the actual reviewer object, not the stored name
      expect(result[0].reviewer.id).toBe(20);
      expect(result[0].reviewer.username).toBe("actualuser");
      expect(result[0].reviewer.firstName).toBe("Actual");
      expect(result[0].reviewer.lastName).toBe("User");
      expect(result[0].reviewer.displayName).toBeUndefined();
    });

    it("should handle system reviews with null reviewerId and System reviewerName", () => {
      const mockReviews = [
        {
          dataValues: {
            id: 1,
            review: 1.0,
            reviewerId: null,
            reviewerName: "System",
            reviewType: "system_cancellation_penalty",
          },
          reviewer: null,
        },
      ];

      const result = ReviewSerializer.serializeArray(mockReviews);

      expect(result[0].reviewer).toBeTruthy();
      expect(result[0].reviewer.id).toBeNull();
      expect(result[0].reviewer.displayName).toBe("System");
      expect(result[0].reviewType).toBe("system_cancellation_penalty");
    });
  });

  describe("Deleted reviewer scenarios", () => {
    it("should handle review where cleaner was deleted after writing review", () => {
      // Simulates: cleaner wrote review about homeowner, then cleaner was deleted
      const mockReviews = [
        {
          dataValues: {
            id: 1,
            userId: 100, // homeowner being reviewed
            reviewerId: null, // was cleaner ID 10, now null after deletion
            reviewerName: "John Doe", // stored before deletion
            reviewType: "cleaner_to_homeowner",
            review: 4.5,
            reviewComment: "Great homeowner!",
          },
          reviewer: null, // association is null after deletion
        },
      ];

      const result = ReviewSerializer.serializeArray(mockReviews);

      expect(result[0].userId).toBe(100);
      expect(result[0].reviewerId).toBeNull();
      expect(result[0].reviewerName).toBe("John Doe");
      expect(result[0].reviewer).toBeTruthy();
      expect(result[0].reviewer.displayName).toBe("John Doe");
      expect(result[0].reviewComment).toBe("Great homeowner!");
    });

    it("should preserve all review data when reviewer is deleted", () => {
      const mockReviews = [
        {
          dataValues: {
            id: 5,
            userId: 200,
            reviewerId: null,
            appointmentId: 500,
            reviewerName: "Former Cleaner",
            reviewType: "cleaner_to_homeowner",
            review: 5.0,
            reviewComment: "Best homeowner!",
            accuracyOfDescription: 5.0,
            homeReadiness: 4.5,
            easeOfAccess: 5.0,
            communication: 4.0,
            wouldWorkForAgain: true,
            createdAt: "2024-01-01T10:00:00Z",
          },
          reviewer: null,
        },
      ];

      const result = ReviewSerializer.serializeArray(mockReviews);

      // All fields should be preserved
      expect(result[0].id).toBe(5);
      expect(result[0].userId).toBe(200);
      expect(result[0].appointmentId).toBe(500);
      expect(result[0].reviewType).toBe("cleaner_to_homeowner");
      expect(result[0].review).toBe(5.0);
      expect(result[0].reviewComment).toBe("Best homeowner!");
      expect(result[0].accuracyOfDescription).toBe(5.0);
      expect(result[0].homeReadiness).toBe(4.5);
      expect(result[0].easeOfAccess).toBe(5.0);
      expect(result[0].communication).toBe(4.0);
      expect(result[0].wouldWorkForAgain).toBe(true);
      expect(result[0].reviewer.displayName).toBe("Former Cleaner");
    });

    it("should handle mixed reviews - some with active reviewers, some deleted", () => {
      const mockReviews = [
        {
          dataValues: {
            id: 1,
            review: 4.5,
            reviewerName: "Active Cleaner",
          },
          reviewer: {
            id: 10,
            username: "activecleaner",
            firstName: "Active",
            lastName: "Cleaner",
          },
        },
        {
          dataValues: {
            id: 2,
            review: 4.0,
            reviewerName: "Deleted Cleaner",
            reviewerId: null,
          },
          reviewer: null,
        },
        {
          dataValues: {
            id: 3,
            review: 5.0,
            reviewerName: "Another Active",
          },
          reviewer: {
            id: 20,
            username: "another",
            firstName: "Another",
            lastName: "Active",
          },
        },
      ];

      const result = ReviewSerializer.serializeArray(mockReviews);

      // First review - active reviewer
      expect(result[0].reviewer.id).toBe(10);
      expect(result[0].reviewer.username).toBe("activecleaner");

      // Second review - deleted reviewer
      expect(result[1].reviewer.id).toBeNull();
      expect(result[1].reviewer.displayName).toBe("Deleted Cleaner");

      // Third review - active reviewer
      expect(result[2].reviewer.id).toBe(20);
      expect(result[2].reviewer.username).toBe("another");
    });
  });
});
