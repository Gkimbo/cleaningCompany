const ReviewsClass = require("../../services/ReviewsClass");

// Mock models
jest.mock("../../models", () => ({
  UserReviews: {
    findOne: jest.fn(),
    findAll: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  User: {
    findByPk: jest.fn(),
    findAll: jest.fn(),
  },
  UserAppointments: {
    findAll: jest.fn(),
    findByPk: jest.fn(),
  },
  UserHomes: {
    findAll: jest.fn(),
  },
}));

const { UserReviews, User, UserAppointments, UserHomes } = require("../../models");

describe("ReviewsClass", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("submitReview", () => {
    const baseReviewData = {
      userId: 2,
      reviewerId: 1,
      appointmentId: 100,
      reviewType: "homeowner_to_cleaner",
      review: 4.5,
      reviewComment: "Great cleaning!",
      cleaningQuality: 5,
      punctuality: 4,
      professionalism: 5,
      communication: 4,
      wouldRecommend: true,
    };

    it("should create a new review successfully", async () => {
      UserReviews.findOne.mockResolvedValue(null);
      UserAppointments.findByPk.mockResolvedValue({
        id: 100,
        completed: true,
        cancelled: false,
        home: { userId: 1 },
        employeesAssigned: ["2"],
      });
      User.findByPk.mockResolvedValue({ id: 1, firstName: "enc_John", lastName: "enc_Doe" });
      UserReviews.create.mockResolvedValue({
        id: 1,
        ...baseReviewData,
        isPublished: false,
        toJSON: () => ({ id: 1, ...baseReviewData, isPublished: false }),
      });
      UserReviews.findAll.mockResolvedValue([
        { id: 1, reviewType: "homeowner_to_cleaner" },
      ]);

      const result = await ReviewsClass.submitReview(baseReviewData);

      expect(UserReviews.findOne).toHaveBeenCalledWith({
        where: {
          reviewerId: 1,
          appointmentId: 100,
          userId: 2,
        },
      });
      expect(UserReviews.create).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 2,
          reviewerId: 1,
          appointmentId: 100,
          isPublished: false,
        })
      );
      expect(result).toHaveProperty("id", 1);
    });

    it("should throw error if review already exists", async () => {
      UserAppointments.findByPk.mockResolvedValue({
        id: 100,
        completed: true,
        cancelled: false,
        home: { userId: 1 },
        employeesAssigned: ["2"],
      });
      User.findByPk.mockResolvedValue({ id: 1, firstName: "enc_John", lastName: "enc_Doe" });
      UserReviews.findOne.mockResolvedValue({
        id: 1,
        ...baseReviewData,
      });

      await expect(ReviewsClass.submitReview(baseReviewData)).rejects.toThrow(
        "You have already reviewed this appointment"
      );
    });

    it("should create cleaner-to-homeowner review with correct fields", async () => {
      const cleanerReviewData = {
        userId: 1,
        reviewerId: 2,
        appointmentId: 100,
        reviewType: "cleaner_to_homeowner",
        review: 4.0,
        reviewComment: "Nice home to clean",
        accuracyOfDescription: 4,
        homeReadiness: 5,
        easeOfAccess: 4,
        communication: 5,
        wouldWorkForAgain: true,
      };

      UserReviews.findOne.mockResolvedValue(null);
      UserAppointments.findByPk.mockResolvedValue({
        id: 100,
        completed: true,
        cancelled: false,
        home: { userId: 1 },
        employeesAssigned: ["2"],
      });
      User.findByPk.mockResolvedValue({ id: 2, firstName: "enc_Jane", lastName: "enc_Cleaner" });
      UserReviews.create.mockResolvedValue({
        id: 2,
        ...cleanerReviewData,
        isPublished: false,
      });
      UserReviews.findAll.mockResolvedValue([
        { id: 2, reviewType: "cleaner_to_homeowner" },
      ]);

      const result = await ReviewsClass.submitReview(cleanerReviewData);

      expect(UserReviews.create).toHaveBeenCalledWith(
        expect.objectContaining({
          reviewType: "cleaner_to_homeowner",
          accuracyOfDescription: 4,
          homeReadiness: 5,
          easeOfAccess: 4,
          wouldWorkForAgain: true,
        })
      );
      expect(result.reviewType).toBe("cleaner_to_homeowner");
    });
  });

  describe("checkAndPublishReviews", () => {
    it("should publish both reviews when both parties have reviewed", async () => {
      UserReviews.findAll.mockResolvedValue([
        { id: 1, reviewType: "homeowner_to_cleaner" },
        { id: 2, reviewType: "cleaner_to_homeowner" },
      ]);
      UserReviews.update.mockResolvedValue([2]);

      const result = await ReviewsClass.checkAndPublishReviews(100);

      expect(UserReviews.update).toHaveBeenCalledWith(
        { isPublished: true },
        { where: { appointmentId: 100 } }
      );
      expect(result).toBe(true);
    });

    it("should not publish when only homeowner has reviewed", async () => {
      UserReviews.findAll.mockResolvedValue([
        { id: 1, reviewType: "homeowner_to_cleaner" },
      ]);

      const result = await ReviewsClass.checkAndPublishReviews(100);

      expect(UserReviews.update).not.toHaveBeenCalled();
      expect(result).toBe(false);
    });

    it("should not publish when only cleaner has reviewed", async () => {
      UserReviews.findAll.mockResolvedValue([
        { id: 2, reviewType: "cleaner_to_homeowner" },
      ]);

      const result = await ReviewsClass.checkAndPublishReviews(100);

      expect(UserReviews.update).not.toHaveBeenCalled();
      expect(result).toBe(false);
    });

    it("should not publish when no reviews exist", async () => {
      UserReviews.findAll.mockResolvedValue([]);

      const result = await ReviewsClass.checkAndPublishReviews(100);

      expect(UserReviews.update).not.toHaveBeenCalled();
      expect(result).toBe(false);
    });
  });

  describe("getReviewStatus", () => {
    it("should return correct status when both parties reviewed", async () => {
      UserReviews.findAll.mockResolvedValue([
        { reviewType: "homeowner_to_cleaner", reviewerId: 1 },
        { reviewType: "cleaner_to_homeowner", reviewerId: 2 },
      ]);

      const result = await ReviewsClass.getReviewStatus(100, 1);

      expect(result).toEqual({
        hasHomeownerReviewed: true,
        hasCleanerReviewed: true,
        userHasReviewed: true,
        bothReviewed: true,
        isPublished: true,
      });
    });

    it("should return correct status when only homeowner reviewed", async () => {
      UserReviews.findAll.mockResolvedValue([
        { reviewType: "homeowner_to_cleaner", reviewerId: 1 },
      ]);

      const result = await ReviewsClass.getReviewStatus(100, 1);

      expect(result).toEqual({
        hasHomeownerReviewed: true,
        hasCleanerReviewed: false,
        userHasReviewed: true,
        bothReviewed: false,
        isPublished: false,
      });
    });

    it("should return correct status when user has not reviewed", async () => {
      UserReviews.findAll.mockResolvedValue([
        { reviewType: "homeowner_to_cleaner", reviewerId: 3 },
      ]);

      const result = await ReviewsClass.getReviewStatus(100, 1);

      expect(result.userHasReviewed).toBe(false);
    });

    it("should return all false when no reviews exist", async () => {
      UserReviews.findAll.mockResolvedValue([]);

      const result = await ReviewsClass.getReviewStatus(100, 1);

      expect(result).toEqual({
        hasHomeownerReviewed: false,
        hasCleanerReviewed: false,
        userHasReviewed: false,
        bothReviewed: false,
        isPublished: false,
      });
    });
  });

  describe("getPublishedReviewsForUser", () => {
    it("should return only published reviews", async () => {
      const mockReviews = [
        { id: 1, userId: 1, isPublished: true, review: 4.5 },
        { id: 2, userId: 1, isPublished: true, review: 5.0 },
      ];
      UserReviews.findAll.mockResolvedValue(mockReviews);

      const result = await ReviewsClass.getPublishedReviewsForUser(1);

      expect(UserReviews.findAll).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            userId: 1,
            isPublished: true,
          },
        })
      );
      expect(result).toHaveLength(2);
    });

    it("should return empty array when no published reviews", async () => {
      UserReviews.findAll.mockResolvedValue([]);

      const result = await ReviewsClass.getPublishedReviewsForUser(1);

      expect(result).toEqual([]);
    });
  });

  describe("getReviewsWrittenByUser", () => {
    it("should return all reviews written by user", async () => {
      const mockReviews = [
        { id: 1, reviewerId: 1, isPublished: true },
        { id: 2, reviewerId: 1, isPublished: false },
      ];
      UserReviews.findAll.mockResolvedValue(mockReviews);

      const result = await ReviewsClass.getReviewsWrittenByUser(1);

      expect(UserReviews.findAll).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { reviewerId: 1 },
        })
      );
      expect(result).toHaveLength(2);
    });
  });

  describe("getPendingReviewsForUser", () => {
    it("should return pending reviews for cleaner first", async () => {
      // Test cleaner path first since it doesn't require UserHomes mock
      const mockAppointments = [
        { id: 100, employeesAssigned: ["2", "3"], completed: true },
        { id: 101, employeesAssigned: ["2"], completed: true },
      ];

      UserAppointments.findAll.mockResolvedValue(mockAppointments);
      UserReviews.findOne
        .mockResolvedValueOnce(null) // No review for appointment 100
        .mockResolvedValueOnce(null); // No review for appointment 101

      const result = await ReviewsClass.getPendingReviewsForUser(2, "cleaner");

      // Both appointments should be returned since cleaner 2 is assigned to both
      expect(result).toHaveLength(2);
    });

    it("should return pending reviews for cleaner", async () => {
      const mockAppointments = [
        { id: 100, employeesAssigned: ["2", "3"], completed: true },
        { id: 101, employeesAssigned: ["2"], completed: true },
        { id: 102, employeesAssigned: ["3"], completed: true }, // Not assigned to user 2
      ];

      UserAppointments.findAll.mockResolvedValue(mockAppointments);
      UserReviews.findOne.mockResolvedValue(null);

      const result = await ReviewsClass.getPendingReviewsForUser(2, "cleaner");

      // Should only return appointments where cleaner is assigned
      expect(result.length).toBeLessThanOrEqual(2);
    });

    it("should handle cleaner not assigned to any appointments", async () => {
      UserAppointments.findAll.mockResolvedValue([
        { id: 100, employeesAssigned: ["3", "4"], completed: true },
      ]);

      const result = await ReviewsClass.getPendingReviewsForUser(2, "cleaner");

      expect(result).toHaveLength(0);
    });
  });

  describe("getReviewStats", () => {
    it("should calculate correct statistics", async () => {
      const mockReviews = [
        {
          review: 5,
          reviewType: "homeowner_to_cleaner",
          cleaningQuality: 5,
          punctuality: 4,
          professionalism: 5,
          communication: 4,
          wouldRecommend: true,
        },
        {
          review: 4,
          reviewType: "homeowner_to_cleaner",
          cleaningQuality: 4,
          punctuality: 4,
          professionalism: 4,
          communication: 4,
          wouldRecommend: true,
        },
      ];
      UserReviews.findAll.mockResolvedValue(mockReviews);

      const result = await ReviewsClass.getReviewStats(1);

      expect(result.averageRating).toBe(4.5);
      expect(result.totalReviews).toBe(2);
      expect(result.recommendationRate).toBe(100);
      expect(result.aspectAverages.cleaningQuality).toBe(4.5);
      expect(result.aspectAverages.punctuality).toBe(4.0);
    });

    it("should return zeros when no reviews exist", async () => {
      UserReviews.findAll.mockResolvedValue([]);

      const result = await ReviewsClass.getReviewStats(1);

      expect(result).toEqual({
        averageRating: 0,
        totalReviews: 0,
        recommendationRate: 0,
        aspectAverages: {},
      });
    });

    it("should calculate recommendation rate correctly with mixed reviews", async () => {
      const mockReviews = [
        { review: 5, reviewType: "homeowner_to_cleaner", wouldRecommend: true },
        { review: 3, reviewType: "homeowner_to_cleaner", wouldRecommend: false },
        { review: 4, reviewType: "homeowner_to_cleaner", wouldRecommend: true },
        { review: 2, reviewType: "homeowner_to_cleaner", wouldRecommend: false },
      ];
      UserReviews.findAll.mockResolvedValue(mockReviews);

      const result = await ReviewsClass.getReviewStats(1);

      expect(result.recommendationRate).toBe(50);
    });

    it("should calculate cleaner review stats correctly", async () => {
      const mockReviews = [
        {
          review: 4,
          reviewType: "cleaner_to_homeowner",
          accuracyOfDescription: 4,
          homeReadiness: 5,
          easeOfAccess: 4,
          communication: 4,
          wouldWorkForAgain: true,
        },
      ];
      UserReviews.findAll.mockResolvedValue(mockReviews);

      const result = await ReviewsClass.getReviewStats(1);

      expect(result.aspectAverages.accuracyOfDescription).toBe(4.0);
      expect(result.aspectAverages.homeReadiness).toBe(5.0);
      expect(result.recommendationRate).toBe(100);
    });
  });

  describe("calculateAspectAverage", () => {
    it("should calculate average correctly", () => {
      const reviews = [
        { cleaningQuality: 5 },
        { cleaningQuality: 4 },
        { cleaningQuality: 3 },
      ];

      const result = ReviewsClass.calculateAspectAverage(reviews, "cleaningQuality");

      expect(result).toBe(4.0);
    });

    it("should return null for empty reviews", () => {
      const result = ReviewsClass.calculateAspectAverage([], "cleaningQuality");

      expect(result).toBeNull();
    });

    it("should ignore null values", () => {
      const reviews = [
        { cleaningQuality: 5 },
        { cleaningQuality: null },
        { cleaningQuality: 3 },
      ];

      const result = ReviewsClass.calculateAspectAverage(reviews, "cleaningQuality");

      expect(result).toBe(4.0);
    });
  });

  describe("addReviewToDB (legacy)", () => {
    it("should create review with isPublished true for legacy method", async () => {
      const legacyData = {
        userId: 2,
        reviewerId: 1,
        appointmentId: 100,
        rating: 4,
        comment: "Good cleaning",
      };

      UserAppointments.findByPk.mockResolvedValue({
        id: 100,
        completed: true,
        cancelled: false,
        home: { userId: 1 },
        employeesAssigned: ["2"],
      });
      User.findByPk.mockResolvedValue({ id: 1, firstName: "enc_John", lastName: "enc_Doe" });
      UserReviews.findOne.mockResolvedValue(null);
      UserReviews.create.mockResolvedValue({
        id: 1,
        userId: 2,
        reviewerId: 1,
        appointmentId: 100,
        review: 4,
        reviewComment: "Good cleaning",
        isPublished: true,
      });

      const result = await ReviewsClass.addReviewToDB(legacyData);

      expect(UserReviews.create).toHaveBeenCalledWith(
        expect.objectContaining({
          isPublished: true,
          review: 4,
          reviewComment: "Good cleaning",
        })
      );
    });
  });
});
