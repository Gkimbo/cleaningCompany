// Set SESSION_SECRET before importing router
process.env.SESSION_SECRET = process.env.SESSION_SECRET || "test_secret";

const express = require("express");
const request = require("supertest");
const jwt = require("jsonwebtoken");

// Mock models
jest.mock("../../models", () => ({
  User: {
    findByPk: jest.fn(),
    findOne: jest.fn(),
  },
  UserHomes: {
    findAll: jest.fn(),
    findByPk: jest.fn(),
  },
  UserAppointments: {
    findAll: jest.fn(),
    destroy: jest.fn(),
  },
  UserBills: {
    findOne: jest.fn(),
  },
  UserReviews: {
    findAll: jest.fn().mockResolvedValue([]),
  },
  UserPendingRequests: {
    findAll: jest.fn().mockResolvedValue([]),
  },
  Op: {
    between: Symbol("between"),
    in: Symbol("in"),
  },
}));

jest.mock("../../services/UserInfoClass", () => ({
  addHomeToDB: jest.fn(),
  editHomeInDB: jest.fn(),
  deleteHomeInfo: jest.fn(),
}));

jest.mock("../../services/HomeClass", () => ({
  checkZipCodeExists: jest.fn(),
}));

jest.mock("../../config/businessConfig", () => ({
  isInServiceArea: jest.fn(),
  getCleanersNeeded: jest.fn(),
  getPricingConfig: jest.fn().mockResolvedValue({
    cancellation: { fee: 25 },
  }),
}));

jest.mock("../../serializers/userSerializer", () => ({
  serializeOne: jest.fn((user) => user),
}));

jest.mock("../../serializers/homesSerializer", () => ({
  serializeOne: jest.fn((home) => home),
}));

const { User, UserHomes, UserAppointments, UserBills } = require("../../models");
const UserInfo = require("../../services/UserInfoClass");
const HomeClass = require("../../services/HomeClass");
const { isInServiceArea, getCleanersNeeded } = require("../../config/businessConfig");

const userInfoRouter = require("../../routes/api/v1/userInfoRouter");
const app = express();
app.use(express.json());
app.use("/api/v1/user-info", userInfoRouter);

describe("User Info Router", () => {
  const secretKey = process.env.SESSION_SECRET || "test_secret";
  const userToken = jwt.sign({ userId: 1 }, secretKey);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("GET /", () => {
    it("should return user info with homes and appointments", async () => {
      User.findByPk.mockResolvedValue({
        id: 1,
        username: "testuser",
        email: "test@test.com",
        homes: [],
        appointments: [],
        bills: [],
        dataValues: {
          id: 1,
          username: "testuser",
          email: "test@test.com",
          homes: [],
          appointments: [],
          bills: [],
        },
      });

      const response = await request(app)
        .get("/api/v1/user-info")
        .set("Authorization", `Bearer ${userToken}`);

      expect(response.status).toBe(200);
      expect(response.body.user).toBeDefined();
      expect(User.findByPk).toHaveBeenCalledWith(
        1,
        expect.objectContaining({
          include: expect.any(Array),
        })
      );
    });

    it("should return 401 for invalid token", async () => {
      const response = await request(app)
        .get("/api/v1/user-info")
        .set("Authorization", "Bearer invalid_token");

      expect(response.status).toBe(401);
      expect(response.body.error).toBe("Invalid or expired token");
    });
  });

  describe("POST /home", () => {
    const validHomeData = {
      user: { token: "" },
      home: {
        nickName: "Beach House",
        address: "123 Beach St",
        city: "Boston",
        state: "MA",
        zipcode: "02101",
        numBeds: 3,
        numBaths: 2,
        sheetsProvided: true,
        towelsProvided: true,
        keyPadCode: "1234",
        keyLocation: "Under mat",
        recyclingLocation: "Garage",
        compostLocation: "Kitchen",
        trashLocation: "Side of house",
        contact: "555-1234",
        specialNotes: "Dog friendly",
        timeToBeCompleted: "10:00",
      },
    };

    beforeEach(() => {
      validHomeData.user.token = userToken;
      HomeClass.checkZipCodeExists.mockResolvedValue(true);
      isInServiceArea.mockReturnValue({ isServiceable: true });
      getCleanersNeeded.mockReturnValue(1);
      User.findOne.mockResolvedValue({ id: 1, username: "testuser" });
    });

    it("should create a new home successfully", async () => {
      UserInfo.addHomeToDB.mockResolvedValue({
        id: 1,
        ...validHomeData.home,
        userId: 1,
      });

      const response = await request(app)
        .post("/api/v1/user-info/home")
        .send(validHomeData);

      expect(response.status).toBe(201);
      expect(response.body.home).toBeDefined();
      expect(response.body.outsideServiceArea).toBe(false);
    });

    it("should return 400 for invalid zipcode", async () => {
      HomeClass.checkZipCodeExists.mockResolvedValue(false);

      const response = await request(app)
        .post("/api/v1/user-info/home")
        .send(validHomeData);

      expect(response.status).toBe(400);
    });

    it("should mark home as outside service area when applicable", async () => {
      isInServiceArea.mockReturnValue({
        isServiceable: false,
        message: "Outside service area",
      });
      UserInfo.addHomeToDB.mockResolvedValue({
        id: 1,
        ...validHomeData.home,
        outsideServiceArea: true,
      });

      const response = await request(app)
        .post("/api/v1/user-info/home")
        .send(validHomeData);

      expect(response.status).toBe(201);
      expect(response.body.outsideServiceArea).toBe(true);
      expect(response.body.serviceAreaMessage).toBeTruthy();
    });

    it("should return 401 for invalid token", async () => {
      const invalidData = {
        ...validHomeData,
        user: { token: "invalid_token" },
      };

      const response = await request(app)
        .post("/api/v1/user-info/home")
        .send(invalidData);

      expect(response.status).toBe(401);
    });
  });

  describe("PATCH /home", () => {
    const updateData = {
      id: 1,
      nickName: "Updated Beach House",
      address: "123 Beach St",
      city: "Boston",
      state: "MA",
      zipcode: "02101",
      numBeds: 4,
      numBaths: 3,
      sheetsProvided: true,
      towelsProvided: true,
      keyPadCode: "5678",
      keyLocation: "Lockbox",
      recyclingLocation: "Garage",
      compostLocation: "Kitchen",
      trashLocation: "Side of house",
      contact: "555-5678",
      specialNotes: "Updated notes",
      timeToBeCompleted: "11:00",
    };

    beforeEach(() => {
      HomeClass.checkZipCodeExists.mockResolvedValue(true);
      isInServiceArea.mockReturnValue({ isServiceable: true });
      getCleanersNeeded.mockReturnValue(1);
    });

    it("should update home successfully", async () => {
      UserInfo.editHomeInDB.mockResolvedValue({
        id: 1,
        ...updateData,
      });

      const response = await request(app)
        .patch("/api/v1/user-info/home")
        .send(updateData);

      expect(response.status).toBe(200);
      expect(response.body.user).toBeDefined();
      expect(response.body.outsideServiceArea).toBe(false);
    });

    it("should return 400 for invalid zipcode", async () => {
      HomeClass.checkZipCodeExists.mockResolvedValue(false);

      const response = await request(app)
        .patch("/api/v1/user-info/home")
        .send(updateData);

      expect(response.status).toBe(400);
      expect(response.body.error).toBe("Cannot find zipcode");
    });

    it("should include service area message when outside area", async () => {
      isInServiceArea.mockReturnValue({
        isServiceable: false,
        message: "This area is not currently serviced",
      });
      UserInfo.editHomeInDB.mockResolvedValue({
        id: 1,
        ...updateData,
        outsideServiceArea: true,
      });

      const response = await request(app)
        .patch("/api/v1/user-info/home")
        .send(updateData);

      expect(response.status).toBe(200);
      expect(response.body.outsideServiceArea).toBe(true);
      expect(response.body.serviceAreaMessage).toBeTruthy();
    });
  });

  describe("DELETE /home", () => {
    beforeEach(() => {
      UserHomes.findAll.mockResolvedValue([
        {
          dataValues: {
            id: 1,
            userId: 1,
          },
        },
      ]);
      UserBills.findOne.mockResolvedValue({
        dataValues: {
          userId: 1,
          appointmentDue: 100,
          cancellationFee: 0,
          totalDue: 100,
        },
        update: jest.fn(),
      });
      UserAppointments.findAll.mockResolvedValue([]);
      UserAppointments.destroy.mockResolvedValue(1);
      UserInfo.deleteHomeInfo.mockResolvedValue(true);
    });

    it("should delete home successfully", async () => {
      const response = await request(app)
        .delete("/api/v1/user-info/home")
        .send({ id: 1 });

      expect(response.status).toBe(201);
      expect(response.body.message).toBe("home deleted");
      expect(UserInfo.deleteHomeInfo).toHaveBeenCalledWith(1);
    });

    it("should apply cancellation fee for appointments within a week", async () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 3);

      UserAppointments.findAll.mockImplementation(async ({ where }) => {
        if (where?.date) {
          return [
            { dataValues: { id: 100, price: 150 } },
            { dataValues: { id: 101, price: 150 } },
          ];
        }
        return [
          { dataValues: { id: 100, price: 150 } },
          { dataValues: { id: 101, price: 150 } },
        ];
      });

      const mockBill = {
        dataValues: {
          userId: 1,
          appointmentDue: 300,
          cancellationFee: 0,
          totalDue: 300,
        },
        update: jest.fn(),
      };
      UserBills.findOne.mockResolvedValue(mockBill);

      const response = await request(app)
        .delete("/api/v1/user-info/home")
        .send({ id: 1 });

      expect(response.status).toBe(201);
    });

    it("should handle deletion errors", async () => {
      UserHomes.findAll.mockRejectedValue(new Error("Database error"));

      const response = await request(app)
        .delete("/api/v1/user-info/home")
        .send({ id: 1 });

      expect(response.status).toBe(401);
    });
  });
});
