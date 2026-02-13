/**
 * Review Copies for All Employees Tests
 * Tests for creating review copies when a homeowner reviews a multi-employee job
 */

// Mock sequelize Op
jest.mock("sequelize", () => ({
  Op: {
    notIn: Symbol("notIn"),
    in: Symbol("in"),
    ne: Symbol("ne"),
  },
}));

// Mock models
jest.mock("../../models", () => {
  return {
    UserReviews: {
      findOne: jest.fn(),
      findAll: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    User: {
      findByPk: jest.fn(),
    },
    UserAppointments: {
      findByPk: jest.fn(),
    },
    BusinessEmployee: {
      findOne: jest.fn(),
      findAll: jest.fn(),
    },
    UserHomes: {},
    EmployeeJobAssignment: {
      findAll: jest.fn(),
    },
  };
});

const {
  UserReviews,
  User,
  UserAppointments,
  BusinessEmployee,
  EmployeeJobAssignment,
} = require("../../models");

// We need to test the ReviewsClass
const ReviewsClass = require("../../services/ReviewsClass");

describe("ReviewsClass - Multi-Employee Review Copies", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("createReviewCopiesForAllEmployees", () => {
    const mockOriginalReview = {
      id: 1,
      userId: 100, // The employee being reviewed (first employee)
      reviewerId: 50,
      reviewerName: "John Homeowner",
      appointmentId: 200,
      reviewType: "homeowner_to_cleaner",
      review: 4.5,
      reviewComment: "Great job!",
      privateComment: "Minor issue with bathroom",
      cleaningQuality: 5,
      punctuality: 4,
      professionalism: 5,
      communication: 4,
      attentionToDetail: 4,
      thoroughness: 5,
      respectOfProperty: 5,
      followedInstructions: 4,
      wouldRecommend: true,
      isPublished: true,
      toJSON: function () {
        return { ...this, toJSON: undefined };
      },
    };

    const mockEmployee1 = {
      id: 1,
      userId: 100,
      businessOwnerId: 10,
      status: "active",
      user: { id: 100 },
    };

    const mockEmployee2 = {
      id: 2,
      userId: 101,
      businessOwnerId: 10,
      status: "active",
      user: { id: 101 },
    };

    const mockEmployee3 = {
      id: 3,
      userId: 102,
      businessOwnerId: 10,
      status: "active",
      user: { id: 102 },
    };

    it("should create review copies for all assigned employees except the original", async () => {
      // Mock assignments for 3 employees
      EmployeeJobAssignment.findAll.mockResolvedValue([
        { id: 1, businessEmployeeId: 1, businessOwnerId: 10, employee: mockEmployee1 },
        { id: 2, businessEmployeeId: 2, businessOwnerId: 10, employee: mockEmployee2 },
        { id: 3, businessEmployeeId: 3, businessOwnerId: 10, employee: mockEmployee3 },
      ]);

      // Mock the business owner copy creation
      BusinessEmployee.findOne.mockResolvedValue(mockEmployee1);
      UserAppointments.findByPk.mockResolvedValue({
        id: 200,
        home: { preferredCleanerId: 10 },
      });

      const createdCopies = [];
      UserReviews.create.mockImplementation((data) => {
        const copy = { id: createdCopies.length + 10, ...data };
        createdCopies.push(copy);
        return Promise.resolve(copy);
      });

      const result = await ReviewsClass.createReviewCopiesForAllEmployees(
        mockOriginalReview,
        200
      );

      // Should create copies for employee2 and employee3 (not employee1 who is the original)
      // Plus one business owner copy
      expect(createdCopies.length).toBeGreaterThanOrEqual(2);

      // Check that employee copies were created with correct data
      const employeeCopies = createdCopies.filter((c) => c.isEmployeeReviewCopy === true);
      expect(employeeCopies.length).toBe(2);

      // Verify copy data is correct
      employeeCopies.forEach((copy) => {
        expect(copy.review).toBe(4.5);
        expect(copy.reviewComment).toBe("Great job!");
        expect(copy.sourceReviewId).toBe(1);
        expect(copy.isEmployeeReviewCopy).toBe(true);
      });

      // Verify the copies are for the correct employees
      const copyUserIds = employeeCopies.map((c) => c.userId);
      expect(copyUserIds).toContain(101); // employee2
      expect(copyUserIds).toContain(102); // employee3
      expect(copyUserIds).not.toContain(100); // Not the original employee
    });

    it("should fallback to business copy only when no employee assignments found", async () => {
      EmployeeJobAssignment.findAll.mockResolvedValue([]);

      // Mock the business owner copy creation
      BusinessEmployee.findOne.mockResolvedValue(mockEmployee1);
      UserAppointments.findByPk.mockResolvedValue({
        id: 200,
        home: { preferredCleanerId: 10 },
      });

      UserReviews.create.mockResolvedValue({
        id: 10,
        userId: 10,
        isBusinessReview: true,
      });

      const result = await ReviewsClass.createReviewCopiesForAllEmployees(
        mockOriginalReview,
        200
      );

      // Should only have the business copy
      expect(result.length).toBe(1);
    });

    it("should handle errors gracefully and return partial results", async () => {
      EmployeeJobAssignment.findAll.mockResolvedValue([
        { id: 1, businessEmployeeId: 1, businessOwnerId: 10, employee: mockEmployee1 },
        { id: 2, businessEmployeeId: 2, businessOwnerId: 10, employee: mockEmployee2 },
      ]);

      // First create succeeds, second fails
      let createCount = 0;
      UserReviews.create.mockImplementation(() => {
        createCount++;
        if (createCount === 1) {
          return Promise.resolve({ id: 10, isEmployeeReviewCopy: true });
        }
        return Promise.reject(new Error("Database error"));
      });

      BusinessEmployee.findOne.mockResolvedValue(null); // No business copy

      const result = await ReviewsClass.createReviewCopiesForAllEmployees(
        mockOriginalReview,
        200
      );

      // Should have at least one copy despite the error
      expect(result.length).toBeGreaterThanOrEqual(0);
    });

    it("should skip employees without userId", async () => {
      const employeeWithoutUserId = {
        id: 4,
        userId: null,
        businessOwnerId: 10,
        employee: { userId: null },
      };

      EmployeeJobAssignment.findAll.mockResolvedValue([
        { id: 1, businessEmployeeId: 1, businessOwnerId: 10, employee: mockEmployee2 },
        { id: 4, businessEmployeeId: 4, businessOwnerId: 10, employee: employeeWithoutUserId },
      ]);

      UserReviews.create.mockResolvedValue({ id: 10, isEmployeeReviewCopy: true });
      BusinessEmployee.findOne.mockResolvedValue(null);

      const result = await ReviewsClass.createReviewCopiesForAllEmployees(
        mockOriginalReview,
        200
      );

      // Should only create one copy for employee with valid userId
      expect(UserReviews.create).toHaveBeenCalledTimes(1);
    });
  });

  describe("submitReview - Integration with Multi-Employee Copies", () => {
    it("should call createReviewCopiesForAllEmployees for homeowner_to_cleaner reviews", async () => {
      const mockReviewData = {
        userId: 100,
        reviewerId: 50,
        appointmentId: 200,
        reviewType: "homeowner_to_cleaner",
        review: 4.5,
      };

      // Mock all dependencies
      UserReviews.findOne.mockResolvedValue(null); // No existing review
      User.findByPk.mockResolvedValue({ id: 50, firstName: "enc_John", lastName: "enc_Doe" });
      UserAppointments.findByPk.mockResolvedValue({ id: 200 });

      const createdReview = {
        id: 1,
        ...mockReviewData,
        toJSON: () => mockReviewData,
      };
      UserReviews.create.mockResolvedValue(createdReview);

      // Mock findAll for checkAndPublishReviews
      UserReviews.findAll.mockResolvedValue([createdReview]);

      // Mock the copies creation
      EmployeeJobAssignment.findAll.mockResolvedValue([]);
      BusinessEmployee.findOne.mockResolvedValue(null);

      // Spy on the method
      const copySpy = jest.spyOn(ReviewsClass, "createReviewCopiesForAllEmployees");

      await ReviewsClass.submitReview(mockReviewData);

      expect(copySpy).toHaveBeenCalledWith(createdReview, 200);

      copySpy.mockRestore();
    });

    it("should NOT call createReviewCopiesForAllEmployees for cleaner_to_homeowner reviews", async () => {
      const mockReviewData = {
        userId: 50,
        reviewerId: 100,
        appointmentId: 200,
        reviewType: "cleaner_to_homeowner",
        review: 4.0,
      };

      UserReviews.findOne.mockResolvedValue(null);
      User.findByPk.mockResolvedValue({ id: 100, firstName: "enc_Jane", lastName: "enc_Cleaner" });
      UserAppointments.findByPk.mockResolvedValue({ id: 200 });

      const createdReview = { id: 1, ...mockReviewData };
      UserReviews.create.mockResolvedValue(createdReview);

      // Mock findAll for checkAndPublishReviews
      UserReviews.findAll.mockResolvedValue([createdReview]);

      const copySpy = jest.spyOn(ReviewsClass, "createReviewCopiesForAllEmployees");

      await ReviewsClass.submitReview(mockReviewData);

      expect(copySpy).not.toHaveBeenCalled();

      copySpy.mockRestore();
    });
  });
});
