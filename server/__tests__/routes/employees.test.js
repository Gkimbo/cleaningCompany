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
  UserPendingRequests: {},
  TermsAndConditions: {},
  UserTermsAcceptance: {},
  Op: {
    contains: Symbol("contains"),
  },
}));

// Mock UserInfoClass
jest.mock("../../services/UserInfoClass", () => ({
  editEmployeeInDB: jest.fn(),
}));

// Mock serializer
jest.mock("../../serializers/userSerializer", () => ({
  serializeOne: jest.fn((user) => ({
    id: user.id,
    username: user.username,
    email: user.email,
    type: user.type,
    firstName: user.firstName,
    lastName: user.lastName,
  })),
  login: jest.fn((user) => ({
    id: user.id,
    username: user.username,
    email: user.email,
    type: user.type,
  })),
}));

// Mock Email service
jest.mock("../../services/sendNotifications/EmailClass", () => ({
  sendEmailCongragulations: jest.fn().mockResolvedValue(true),
}));

const {
  User,
  UserBills,
  UserCleanerAppointments,
  UserAppointments,
} = require("../../models");
const UserInfo = require("../../services/UserInfoClass");
const Email = require("../../services/sendNotifications/EmailClass");

const usersRouter = require("../../routes/api/v1/usersRouter");
const app = express();
app.use(express.json());
app.use("/api/v1/users", usersRouter);

describe("Employee CRUD Operations", () => {
  const secretKey = process.env.SESSION_SECRET || "test_secret";
  const managerToken = jwt.sign({ userId: 1 }, secretKey);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("POST /new-employee - Create Employee", () => {
    const validEmployeeData = {
      username: "newcleaner",
      password: "password123",
      email: "cleaner@test.com",
      type: "cleaner",
      firstName: "John",
      lastName: "Doe",
    };

    it("should create a new employee successfully", async () => {
      User.findOne.mockResolvedValue(null); // No existing user
      User.create.mockResolvedValue({
        dataValues: {
          id: 10,
          username: "newcleaner",
          email: "cleaner@test.com",
          type: "cleaner",
          firstName: "John",
          lastName: "Doe",
        },
        update: jest.fn(),
      });
      UserBills.create.mockResolvedValue({ userId: 10 });

      const response = await request(app)
        .post("/api/v1/users/new-employee")
        .send(validEmployeeData);

      expect(response.status).toBe(201);
      expect(response.body.user).toBeDefined();
      expect(response.body.user.username).toBe("newcleaner");
      expect(response.body.user.type).toBe("cleaner");
      expect(User.create).toHaveBeenCalledWith(
        expect.objectContaining({
          username: "newcleaner",
          email: "cleaner@test.com",
          type: "cleaner",
          firstName: "John",
          lastName: "Doe",
        })
      );
    });

    it("should send welcome email after creating employee", async () => {
      User.findOne.mockResolvedValue(null);
      User.create.mockResolvedValue({
        dataValues: {
          id: 10,
          username: "newcleaner",
          email: "cleaner@test.com",
          type: "cleaner",
          firstName: "John",
          lastName: "Doe",
        },
        update: jest.fn(),
      });
      UserBills.create.mockResolvedValue({ userId: 10 });

      await request(app)
        .post("/api/v1/users/new-employee")
        .send(validEmployeeData);

      expect(Email.sendEmailCongragulations).toHaveBeenCalledWith(
        "John",
        "Doe",
        "newcleaner",
        "password123",
        "cleaner@test.com",
        "cleaner"
      );
    });

    it("should return 409 if email already exists", async () => {
      User.findOne.mockResolvedValueOnce({ id: 5, email: "cleaner@test.com" }); // Email exists

      const response = await request(app)
        .post("/api/v1/users/new-employee")
        .send(validEmployeeData);

      expect(response.status).toBe(409);
      expect(response.text).toBe('"User already exists"');
    });

    it("should return 410 if username already exists", async () => {
      User.findOne
        .mockResolvedValueOnce(null) // Email doesn't exist
        .mockResolvedValueOnce({ id: 5, username: "newcleaner" }); // Username exists

      const response = await request(app)
        .post("/api/v1/users/new-employee")
        .send(validEmployeeData);

      expect(response.status).toBe(410);
      expect(response.text).toBe('"Username already exists"');
    });

    it("should create employee with empty firstName/lastName if not provided", async () => {
      const dataWithoutNames = {
        username: "newcleaner",
        password: "password123",
        email: "cleaner@test.com",
        type: "cleaner",
      };

      User.findOne.mockResolvedValue(null);
      User.create.mockResolvedValue({
        dataValues: {
          id: 10,
          username: "newcleaner",
          email: "cleaner@test.com",
          type: "cleaner",
          firstName: "",
          lastName: "",
        },
        update: jest.fn(),
      });
      UserBills.create.mockResolvedValue({ userId: 10 });

      const response = await request(app)
        .post("/api/v1/users/new-employee")
        .send(dataWithoutNames);

      expect(response.status).toBe(201);
      expect(User.create).toHaveBeenCalledWith(
        expect.objectContaining({
          firstName: "",
          lastName: "",
        })
      );
    });

    it("should create UserBills record for new employee", async () => {
      User.findOne.mockResolvedValue(null);
      User.create.mockResolvedValue({
        dataValues: { id: 10, username: "newcleaner" },
        update: jest.fn(),
      });
      UserBills.create.mockResolvedValue({ userId: 10 });

      await request(app)
        .post("/api/v1/users/new-employee")
        .send(validEmployeeData);

      expect(UserBills.create).toHaveBeenCalledWith({
        userId: 10,
        appointmentDue: 0,
        cancellationFee: 0,
        totalDue: 0,
      });
    });

    it("should handle database errors gracefully", async () => {
      User.findOne.mockRejectedValue(new Error("Database connection failed"));

      const response = await request(app)
        .post("/api/v1/users/new-employee")
        .send(validEmployeeData);

      expect(response.status).toBe(500);
      expect(response.body.error).toBe("Failed to create employee account");
    });
  });

  describe("GET /employees - List Employees", () => {
    it("should return list of all cleaners", async () => {
      const mockCleaners = [
        {
          dataValues: {
            id: 1,
            username: "cleaner1",
            email: "cleaner1@test.com",
            type: "cleaner",
          },
        },
        {
          dataValues: {
            id: 2,
            username: "cleaner2",
            email: "cleaner2@test.com",
            type: "cleaner",
          },
        },
      ];

      User.findAll.mockResolvedValue(mockCleaners);

      const response = await request(app)
        .get("/api/v1/users/employees")
        .set("Authorization", `Bearer ${managerToken}`);

      expect(response.status).toBe(200);
      expect(response.body.users).toHaveLength(2);
      expect(User.findAll).toHaveBeenCalledWith({
        where: { type: "cleaner" },
      });
    });

    it("should return empty array when no employees exist", async () => {
      User.findAll.mockResolvedValue([]);

      const response = await request(app)
        .get("/api/v1/users/employees")
        .set("Authorization", `Bearer ${managerToken}`);

      expect(response.status).toBe(200);
      expect(response.body.users).toHaveLength(0);
    });

    it("should return 401 for invalid token", async () => {
      const response = await request(app)
        .get("/api/v1/users/employees")
        .set("Authorization", "Bearer invalid_token");

      expect(response.status).toBe(401);
      expect(response.body.error).toBe("Invalid or expired token");
    });

  });

  describe("PATCH /employee - Edit Employee", () => {
    const updateData = {
      id: 10,
      username: "updatedcleaner",
      password: "newpassword123",
      email: "updated@test.com",
      type: "cleaner",
    };

    it("should update employee successfully", async () => {
      UserInfo.editEmployeeInDB.mockResolvedValue({
        id: 10,
        username: "updatedcleaner",
        email: "updated@test.com",
        type: "cleaner",
      });

      const response = await request(app)
        .patch("/api/v1/users/employee")
        .send(updateData);

      expect(response.status).toBe(200);
      expect(response.body.user).toBeDefined();
      expect(UserInfo.editEmployeeInDB).toHaveBeenCalledWith({
        id: 10,
        username: "updatedcleaner",
        password: "newpassword123",
        email: "updated@test.com",
        type: "cleaner",
      });
    });

    it("should handle employee not found", async () => {
      UserInfo.editEmployeeInDB.mockResolvedValue("Employee not found for editing");

      const response = await request(app)
        .patch("/api/v1/users/employee")
        .send(updateData);

      expect(response.status).toBe(200);
      expect(response.body.user).toBe("Employee not found for editing");
    });

    it("should handle update errors", async () => {
      UserInfo.editEmployeeInDB.mockRejectedValue(new Error("Update failed"));

      const response = await request(app)
        .patch("/api/v1/users/employee")
        .send(updateData);

      expect(response.status).toBe(401);
      expect(response.body.error).toBe("Invalid token");
    });

    it("should handle token expiration error", async () => {
      const expiredError = new Error("Token expired");
      expiredError.name = "TokenExpiredError";
      UserInfo.editEmployeeInDB.mockRejectedValue(expiredError);

      const response = await request(app)
        .patch("/api/v1/users/employee")
        .send(updateData);

      expect(response.status).toBe(401);
      expect(response.body.error).toBe("Token has expired");
    });

    it("should change employee type from cleaner to manager", async () => {
      const promoteData = {
        id: 10,
        username: "promoteduser",
        password: "password123",
        email: "promoted@test.com",
        type: "manager",
      };

      UserInfo.editEmployeeInDB.mockResolvedValue({
        id: 10,
        username: "promoteduser",
        email: "promoted@test.com",
        type: "manager",
      });

      const response = await request(app)
        .patch("/api/v1/users/employee")
        .send(promoteData);

      expect(response.status).toBe(200);
      expect(UserInfo.editEmployeeInDB).toHaveBeenCalledWith(
        expect.objectContaining({ type: "manager" })
      );
    });
  });

  describe("DELETE /employee - Delete Employee", () => {
    it("should delete employee and associated data successfully", async () => {
      UserBills.destroy.mockResolvedValue(1);
      UserCleanerAppointments.destroy.mockResolvedValue(5);
      UserAppointments.findAll.mockResolvedValue([]);
      User.destroy.mockResolvedValue(1);

      const response = await request(app)
        .delete("/api/v1/users/employee")
        .send({ id: 10 });

      expect(response.status).toBe(201);
      expect(response.body.message).toBe("Employee Deleted from DB");
      expect(UserBills.destroy).toHaveBeenCalledWith({
        where: { userId: 10 },
      });
      expect(UserCleanerAppointments.destroy).toHaveBeenCalledWith({
        where: { employeeId: 10 },
      });
      expect(User.destroy).toHaveBeenCalledWith({
        where: { id: 10 },
      });
    });

    it("should remove employee from assigned appointments", async () => {
      const mockAppointment = {
        employeesAssigned: ["10", "20", "30"],
        update: jest.fn(),
      };

      UserBills.destroy.mockResolvedValue(1);
      UserCleanerAppointments.destroy.mockResolvedValue(1);
      UserAppointments.findAll.mockResolvedValue([mockAppointment]);
      User.destroy.mockResolvedValue(1);

      const response = await request(app)
        .delete("/api/v1/users/employee")
        .send({ id: 10 });

      expect(response.status).toBe(201);
      expect(mockAppointment.update).toHaveBeenCalledWith({
        employeesAssigned: ["20", "30"],
      });
    });

    it("should handle appointment with no assigned employees", async () => {
      const mockAppointment = {
        employeesAssigned: null,
        update: jest.fn(),
      };

      UserBills.destroy.mockResolvedValue(1);
      UserCleanerAppointments.destroy.mockResolvedValue(0);
      UserAppointments.findAll.mockResolvedValue([mockAppointment]);
      User.destroy.mockResolvedValue(1);

      const response = await request(app)
        .delete("/api/v1/users/employee")
        .send({ id: 10 });

      expect(response.status).toBe(201);
      expect(mockAppointment.update).not.toHaveBeenCalled();
    });

    it("should handle multiple appointments with employee assigned", async () => {
      const mockAppointments = [
        { employeesAssigned: ["10", "20"], update: jest.fn() },
        { employeesAssigned: ["10"], update: jest.fn() },
        { employeesAssigned: ["30", "10", "40"], update: jest.fn() },
      ];

      UserBills.destroy.mockResolvedValue(1);
      UserCleanerAppointments.destroy.mockResolvedValue(3);
      UserAppointments.findAll.mockResolvedValue(mockAppointments);
      User.destroy.mockResolvedValue(1);

      const response = await request(app)
        .delete("/api/v1/users/employee")
        .send({ id: 10 });

      expect(response.status).toBe(201);
      expect(mockAppointments[0].update).toHaveBeenCalledWith({
        employeesAssigned: ["20"],
      });
      expect(mockAppointments[1].update).toHaveBeenCalledWith({
        employeesAssigned: [],
      });
      expect(mockAppointments[2].update).toHaveBeenCalledWith({
        employeesAssigned: ["30", "40"],
      });
    });

    it("should handle deletion errors gracefully", async () => {
      UserBills.destroy.mockRejectedValue(new Error("Database error"));

      const response = await request(app)
        .delete("/api/v1/users/employee")
        .send({ id: 10 });

      expect(response.status).toBe(401);
      expect(response.body.error).toBe("Invalid or expired token");
    });

    it("should handle employee with no bills", async () => {
      UserBills.destroy.mockResolvedValue(0); // No bills deleted
      UserCleanerAppointments.destroy.mockResolvedValue(0);
      UserAppointments.findAll.mockResolvedValue([]);
      User.destroy.mockResolvedValue(1);

      const response = await request(app)
        .delete("/api/v1/users/employee")
        .send({ id: 10 });

      expect(response.status).toBe(201);
      expect(response.body.message).toBe("Employee Deleted from DB");
    });

    it("should handle employee with no appointments", async () => {
      UserBills.destroy.mockResolvedValue(1);
      UserCleanerAppointments.destroy.mockResolvedValue(0);
      UserAppointments.findAll.mockResolvedValue([]);
      User.destroy.mockResolvedValue(1);

      const response = await request(app)
        .delete("/api/v1/users/employee")
        .send({ id: 10 });

      expect(response.status).toBe(201);
      expect(response.body.message).toBe("Employee Deleted from DB");
    });
  });
});
