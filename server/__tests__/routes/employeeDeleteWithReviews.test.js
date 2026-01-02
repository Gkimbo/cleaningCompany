// Set SESSION_SECRET before importing router
process.env.SESSION_SECRET = process.env.SESSION_SECRET || "test_secret";

const express = require("express");
const request = require("supertest");
const jwt = require("jsonwebtoken");

// Mock models
jest.mock("../../models", () => ({
  User: {
    findOne: jest.fn(),
    findAll: jest.fn(),
    findByPk: jest.fn(),
    create: jest.fn(),
    destroy: jest.fn(),
  },
  UserBills: {
    create: jest.fn(),
    destroy: jest.fn(),
  },
  UserCleanerAppointments: {
    destroy: jest.fn(),
  },
  UserAppointments: {
    findAll: jest.fn(),
  },
  UserPendingRequests: {
    destroy: jest.fn(),
  },
  UserReviews: {
    destroy: jest.fn(),
    update: jest.fn(),
    findAll: jest.fn(),
  },
  TermsAndConditions: {},
  UserTermsAcceptance: {},
  Conversation: {},
  ConversationParticipant: {},
  Op: {
    contains: Symbol("contains"),
    or: Symbol("or"),
  },
}));

// Mock other services
jest.mock("../../services/UserInfoClass", () => ({
  editEmployeeInDB: jest.fn(),
}));

jest.mock("../../serializers/userSerializer", () => ({
  serializeOne: jest.fn((user) => user),
  login: jest.fn((user) => user),
}));

jest.mock("../../services/sendNotifications/EmailClass", () => ({
  sendEmailCongragulations: jest.fn().mockResolvedValue(true),
}));

const {
  User,
  UserBills,
  UserCleanerAppointments,
  UserAppointments,
  UserPendingRequests,
  UserReviews,
} = require("../../models");

const usersRouter = require("../../routes/api/v1/usersRouter");
const app = express();
app.use(express.json());
app.use("/api/v1/users", usersRouter);

describe("Employee Deletion with Reviews", () => {
  const secretKey = process.env.SESSION_SECRET || "test_secret";
  const ownerToken = jwt.sign({ userId: 1 }, secretKey);

  const mockOwner = { id: 1, type: "owner" };
  const mockCleaner = {
    id: 10,
    type: "cleaner",
    firstName: "John",
    lastName: "Doe",
    username: "johndoe",
  };

  beforeEach(() => {
    jest.clearAllMocks();
    User.findByPk.mockImplementation((id) => {
      if (id === 1) return Promise.resolve(mockOwner);
      if (id === 10) return Promise.resolve(mockCleaner);
      return Promise.resolve(null);
    });
  });

  describe("Reviewer name preservation", () => {
    it("should store reviewer name before deleting cleaner with reviews they wrote", async () => {
      UserBills.destroy.mockResolvedValue(1);
      UserCleanerAppointments.destroy.mockResolvedValue(0);
      UserPendingRequests.destroy.mockResolvedValue(0);
      UserReviews.update.mockResolvedValue([2]); // 2 reviews updated
      UserReviews.destroy.mockResolvedValue(0);
      UserAppointments.findAll.mockResolvedValue([]);
      User.destroy.mockResolvedValue(1);

      const response = await request(app)
        .delete("/api/v1/users/employee")
        .set("Authorization", `Bearer ${ownerToken}`)
        .send({ id: 10 });

      expect(response.status).toBe(200);

      // Verify reviewerName was stored before deletion
      expect(UserReviews.update).toHaveBeenCalledWith(
        { reviewerName: "John Doe" },
        { where: { reviewerId: 10, reviewerName: null } }
      );
    });

    it("should use username as reviewer name when firstName/lastName are empty", async () => {
      const cleanerWithoutName = {
        id: 10,
        type: "cleaner",
        firstName: "",
        lastName: "",
        username: "johndoe",
      };

      User.findByPk.mockImplementation((id) => {
        if (id === 1) return Promise.resolve(mockOwner);
        if (id === 10) return Promise.resolve(cleanerWithoutName);
        return Promise.resolve(null);
      });

      UserBills.destroy.mockResolvedValue(1);
      UserCleanerAppointments.destroy.mockResolvedValue(0);
      UserPendingRequests.destroy.mockResolvedValue(0);
      UserReviews.update.mockResolvedValue([1]);
      UserReviews.destroy.mockResolvedValue(0);
      UserAppointments.findAll.mockResolvedValue([]);
      User.destroy.mockResolvedValue(1);

      const response = await request(app)
        .delete("/api/v1/users/employee")
        .set("Authorization", `Bearer ${ownerToken}`)
        .send({ id: 10 });

      expect(response.status).toBe(200);

      // Should use username as fallback
      expect(UserReviews.update).toHaveBeenCalledWith(
        { reviewerName: "johndoe" },
        { where: { reviewerId: 10, reviewerName: null } }
      );
    });

    it("should handle cleaner with only firstName", async () => {
      const cleanerWithFirstNameOnly = {
        id: 10,
        type: "cleaner",
        firstName: "John",
        lastName: null,
        username: "johndoe",
      };

      User.findByPk.mockImplementation((id) => {
        if (id === 1) return Promise.resolve(mockOwner);
        if (id === 10) return Promise.resolve(cleanerWithFirstNameOnly);
        return Promise.resolve(null);
      });

      UserBills.destroy.mockResolvedValue(1);
      UserCleanerAppointments.destroy.mockResolvedValue(0);
      UserPendingRequests.destroy.mockResolvedValue(0);
      UserReviews.update.mockResolvedValue([1]);
      UserReviews.destroy.mockResolvedValue(0);
      UserAppointments.findAll.mockResolvedValue([]);
      User.destroy.mockResolvedValue(1);

      const response = await request(app)
        .delete("/api/v1/users/employee")
        .set("Authorization", `Bearer ${ownerToken}`)
        .send({ id: 10 });

      expect(response.status).toBe(200);

      // Should use just firstName
      expect(UserReviews.update).toHaveBeenCalledWith(
        { reviewerName: "John" },
        { where: { reviewerId: 10, reviewerName: null } }
      );
    });
  });

  describe("Review deletion behavior", () => {
    it("should delete reviews where cleaner is the subject (userId)", async () => {
      UserBills.destroy.mockResolvedValue(1);
      UserCleanerAppointments.destroy.mockResolvedValue(0);
      UserPendingRequests.destroy.mockResolvedValue(0);
      UserReviews.update.mockResolvedValue([0]);
      UserReviews.destroy.mockResolvedValue(3); // 3 reviews deleted
      UserAppointments.findAll.mockResolvedValue([]);
      User.destroy.mockResolvedValue(1);

      const response = await request(app)
        .delete("/api/v1/users/employee")
        .set("Authorization", `Bearer ${ownerToken}`)
        .send({ id: 10 });

      expect(response.status).toBe(200);

      // Should only delete reviews where cleaner is the subject
      expect(UserReviews.destroy).toHaveBeenCalledWith({
        where: { userId: 10 },
      });
    });

    it("should NOT delete reviews where cleaner is the reviewer", async () => {
      UserBills.destroy.mockResolvedValue(1);
      UserCleanerAppointments.destroy.mockResolvedValue(0);
      UserPendingRequests.destroy.mockResolvedValue(0);
      UserReviews.update.mockResolvedValue([5]); // 5 reviews they wrote
      UserReviews.destroy.mockResolvedValue(2); // 2 reviews about them
      UserAppointments.findAll.mockResolvedValue([]);
      User.destroy.mockResolvedValue(1);

      const response = await request(app)
        .delete("/api/v1/users/employee")
        .set("Authorization", `Bearer ${ownerToken}`)
        .send({ id: 10 });

      expect(response.status).toBe(200);

      // Verify destroy was only called with userId, not reviewerId
      expect(UserReviews.destroy).toHaveBeenCalledTimes(1);
      expect(UserReviews.destroy).toHaveBeenCalledWith({
        where: { userId: 10 },
      });

      // Verify update was called to preserve reviewer names
      expect(UserReviews.update).toHaveBeenCalledTimes(1);
    });

    it("should handle cleaner with no reviews", async () => {
      UserBills.destroy.mockResolvedValue(1);
      UserCleanerAppointments.destroy.mockResolvedValue(0);
      UserPendingRequests.destroy.mockResolvedValue(0);
      UserReviews.update.mockResolvedValue([0]); // No reviews to update
      UserReviews.destroy.mockResolvedValue(0); // No reviews to delete
      UserAppointments.findAll.mockResolvedValue([]);
      User.destroy.mockResolvedValue(1);

      const response = await request(app)
        .delete("/api/v1/users/employee")
        .set("Authorization", `Bearer ${ownerToken}`)
        .send({ id: 10 });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });
  });

  describe("Complete deletion flow", () => {
    it("should execute all cleanup steps in correct order", async () => {
      const callOrder = [];

      UserBills.destroy.mockImplementation(() => {
        callOrder.push("UserBills.destroy");
        return Promise.resolve(1);
      });
      UserCleanerAppointments.destroy.mockImplementation(() => {
        callOrder.push("UserCleanerAppointments.destroy");
        return Promise.resolve(0);
      });
      UserPendingRequests.destroy.mockImplementation(() => {
        callOrder.push("UserPendingRequests.destroy");
        return Promise.resolve(0);
      });
      UserReviews.update.mockImplementation(() => {
        callOrder.push("UserReviews.update");
        return Promise.resolve([0]);
      });
      UserReviews.destroy.mockImplementation(() => {
        callOrder.push("UserReviews.destroy");
        return Promise.resolve(0);
      });
      UserAppointments.findAll.mockImplementation(() => {
        callOrder.push("UserAppointments.findAll");
        return Promise.resolve([]);
      });
      User.destroy.mockImplementation(() => {
        callOrder.push("User.destroy");
        return Promise.resolve(1);
      });

      const response = await request(app)
        .delete("/api/v1/users/employee")
        .set("Authorization", `Bearer ${ownerToken}`)
        .send({ id: 10 });

      expect(response.status).toBe(200);

      // Verify order: cleanup related records, then update reviews, then delete reviews, then delete user
      expect(callOrder).toEqual([
        "UserBills.destroy",
        "UserCleanerAppointments.destroy",
        "UserPendingRequests.destroy",
        "UserReviews.update",
        "UserReviews.destroy",
        "UserAppointments.findAll",
        "User.destroy",
      ]);
    });
  });
});
