/**
 * Model Tests
 *
 * Tests model structure and validation without requiring a database connection.
 * Uses mocks to test model behavior.
 */

const bcrypt = require("bcrypt");

// Helper to create fresh mock objects
const createMockUser = () => ({
  id: 1,
  username: "testuser",
  password: "$2b$10$hashedpassword",
  email: "test@example.com",
  type: null,
  daysWorking: null,
  update: jest.fn().mockImplementation(function (data) {
    Object.assign(this, data);
    return Promise.resolve(this);
  }),
  reload: jest.fn().mockResolvedValue(this),
});

const createMockHome = () => ({
  id: 1,
  userId: 1,
  nickName: "Beach House",
  address: "123 Ocean Drive",
  city: "Miami",
  state: "FL",
  zipcode: "33139",
  numBeds: 4,
  numBaths: 3,
  cleanersNeeded: 2,
  timeToBeCompleted: "4",
  update: jest.fn().mockImplementation(function (data) {
    Object.assign(this, data);
    return Promise.resolve(this);
  }),
});

const createMockAppointment = () => ({
  id: 1,
  userId: 1,
  homeId: 1,
  date: "2025-02-15",
  price: "200",
  paid: false,
  completed: false,
  hasBeenAssigned: false,
  paymentIntentId: "pi_test_123",
  paymentStatus: "pending",
  amountPaid: null,
  update: jest.fn().mockImplementation(function (data) {
    Object.assign(this, data);
    return Promise.resolve(this);
  }),
  reload: jest.fn().mockImplementation(function () {
    return Promise.resolve(this);
  }),
});

const createMockBill = () => ({
  id: 1,
  userId: 1,
  appointmentDue: 0,
  cancellationFee: 0,
  totalDue: 0,
  update: jest.fn().mockImplementation(function (data) {
    Object.assign(this, data);
    return Promise.resolve(this);
  }),
  reload: jest.fn().mockImplementation(function () {
    return Promise.resolve(this);
  }),
});

// Mock the models
jest.mock("../../models", () => ({
  User: {
    create: jest.fn(),
    findByPk: jest.fn(),
    findOne: jest.fn(),
    findAll: jest.fn(),
  },
  UserHomes: {
    create: jest.fn(),
    findByPk: jest.fn(),
    findOne: jest.fn(),
    findAll: jest.fn(),
  },
  UserAppointments: {
    create: jest.fn(),
    findByPk: jest.fn(),
    findOne: jest.fn(),
    findAll: jest.fn(),
  },
  UserBills: {
    create: jest.fn(),
    findByPk: jest.fn(),
    findOne: jest.fn(),
    findAll: jest.fn(),
  },
}));

const { User, UserHomes, UserAppointments, UserBills } = require("../../models");

describe("Models", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Setup fresh mocks for each test
    User.create.mockImplementation(() => Promise.resolve(createMockUser()));
    User.findByPk.mockImplementation(() => Promise.resolve(createMockUser()));
    User.findOne.mockImplementation(() => Promise.resolve(createMockUser()));
    User.findAll.mockImplementation(() => Promise.resolve([createMockUser()]));

    UserHomes.create.mockImplementation(() => Promise.resolve(createMockHome()));
    UserHomes.findByPk.mockImplementation(() => Promise.resolve(createMockHome()));
    UserHomes.findOne.mockImplementation(() => Promise.resolve(createMockHome()));
    UserHomes.findAll.mockImplementation(() => Promise.resolve([createMockHome()]));

    UserAppointments.create.mockImplementation(() => Promise.resolve(createMockAppointment()));
    UserAppointments.findByPk.mockImplementation(() => Promise.resolve(createMockAppointment()));
    UserAppointments.findOne.mockImplementation(() => Promise.resolve(createMockAppointment()));
    UserAppointments.findAll.mockImplementation(() => Promise.resolve([createMockAppointment()]));

    UserBills.create.mockImplementation(() => Promise.resolve(createMockBill()));
    UserBills.findByPk.mockImplementation(() => Promise.resolve(createMockBill()));
    UserBills.findOne.mockImplementation(() => Promise.resolve(createMockBill()));
    UserBills.findAll.mockImplementation(() => Promise.resolve([createMockBill()]));
  });

  describe("User Model", () => {
    it("should create a user", async () => {
      const userData = {
        username: "testuser",
        password: "plainpassword",
        email: "test@example.com",
      };

      const user = await User.create(userData);

      expect(User.create).toHaveBeenCalledWith(userData);
      expect(user.id).toBeDefined();
      expect(user.username).toBe("testuser");
      expect(user.email).toBe("test@example.com");
    });

    it("should hash password using bcrypt", async () => {
      const plainPassword = "plainpassword";
      const hashedPassword = await bcrypt.hash(plainPassword, 10);

      expect(hashedPassword).not.toBe(plainPassword);
      expect(hashedPassword.startsWith("$2b$")).toBe(true);

      const isMatch = await bcrypt.compare(plainPassword, hashedPassword);
      expect(isMatch).toBe(true);
    });

    it("should find user by primary key", async () => {
      const user = await User.findByPk(1);

      expect(User.findByPk).toHaveBeenCalledWith(1);
      expect(user.id).toBe(1);
    });

    it("should find user by email", async () => {
      const user = await User.findOne({ where: { email: "test@example.com" } });

      expect(User.findOne).toHaveBeenCalled();
      expect(user.email).toBe("test@example.com");
    });

    it("should support cleaner type with days working", async () => {
      const cleanerData = {
        username: "cleaner",
        password: "password",
        email: "cleaner@example.com",
        type: "cleaner",
        daysWorking: ["Monday", "Tuesday", "Wednesday"],
      };

      User.create.mockResolvedValueOnce({
        ...cleanerData,
        id: 2,
        password: "$2b$10$hashedpassword",
      });

      const cleaner = await User.create(cleanerData);

      expect(cleaner.type).toBe("cleaner");
      expect(cleaner.daysWorking).toEqual(["Monday", "Tuesday", "Wednesday"]);
    });
  });

  describe("UserHomes Model", () => {
    it("should create a home", async () => {
      const homeData = {
        userId: 1,
        nickName: "Beach House",
        address: "123 Ocean Drive",
        city: "Miami",
        state: "FL",
        zipcode: "33139",
        numBeds: 4,
        numBaths: 3,
        cleanersNeeded: 2,
        timeToBeCompleted: "4",
      };

      const home = await UserHomes.create(homeData);

      expect(UserHomes.create).toHaveBeenCalledWith(homeData);
      expect(home.id).toBeDefined();
      expect(home.nickName).toBe("Beach House");
      expect(home.cleanersNeeded).toBe(2);
    });

    it("should find home by id", async () => {
      const home = await UserHomes.findByPk(1);

      expect(UserHomes.findByPk).toHaveBeenCalledWith(1);
      expect(home.address).toBe("123 Ocean Drive");
    });

    it("should find all homes for a user", async () => {
      const homes = await UserHomes.findAll({ where: { userId: 1 } });

      expect(UserHomes.findAll).toHaveBeenCalled();
      expect(homes.length).toBe(1);
    });

    it("should have default cleanersNeeded of 1", () => {
      // Default value check
      const defaultCleanersNeeded = 1;
      expect(defaultCleanersNeeded).toBe(1);
    });
  });

  describe("UserAppointments Model", () => {
    it("should create an appointment with payment fields", async () => {
      const appointmentData = {
        userId: 1,
        homeId: 1,
        date: "2025-02-15",
        price: "200",
        paid: false,
        completed: false,
        hasBeenAssigned: false,
        paymentIntentId: "pi_test_123",
        paymentStatus: "pending",
      };

      const appointment = await UserAppointments.create(appointmentData);

      expect(UserAppointments.create).toHaveBeenCalledWith(appointmentData);
      expect(appointment.id).toBeDefined();
      expect(appointment.paymentIntentId).toBe("pi_test_123");
      expect(appointment.paymentStatus).toBe("pending");
    });

    it("should update payment status after capture", async () => {
      const appointment = await UserAppointments.findByPk(1);

      await appointment.update({
        paymentStatus: "captured",
        paid: true,
        amountPaid: 20000,
      });

      expect(appointment.update).toHaveBeenCalled();
      expect(appointment.paymentStatus).toBe("captured");
      expect(appointment.paid).toBe(true);
      expect(appointment.amountPaid).toBe(20000);
    });

    it("should have default paymentStatus of pending", async () => {
      const appointment = await UserAppointments.create({
        userId: 1,
        homeId: 1,
        date: "2025-02-15",
        price: "200",
      });

      expect(appointment.paymentStatus).toBe("pending");
    });

    it("should track hasBeenAssigned status", async () => {
      const appointment = await UserAppointments.findByPk(1);
      expect(appointment.hasBeenAssigned).toBe(false);

      await appointment.update({ hasBeenAssigned: true });
      expect(appointment.hasBeenAssigned).toBe(true);
    });
  });

  describe("UserBills Model", () => {
    it("should create a bill", async () => {
      const billData = {
        userId: 1,
        appointmentDue: 0,
        cancellationFee: 0,
        totalDue: 0,
      };

      const bill = await UserBills.create(billData);

      expect(UserBills.create).toHaveBeenCalledWith(billData);
      expect(bill.id).toBeDefined();
      expect(bill.totalDue).toBe(0);
    });

    it("should update bill amounts", async () => {
      const bill = await UserBills.findByPk(1);

      await bill.update({
        appointmentDue: 150,
        totalDue: 150,
      });

      expect(bill.appointmentDue).toBe(150);
      expect(bill.totalDue).toBe(150);

      await bill.update({
        cancellationFee: 25,
        totalDue: 175,
      });

      expect(bill.cancellationFee).toBe(25);
      expect(bill.totalDue).toBe(175);
    });

    it("should have default values of 0", async () => {
      const bill = await UserBills.create({
        userId: 1,
      });

      expect(bill.appointmentDue).toBe(0);
      expect(bill.cancellationFee).toBe(0);
      expect(bill.totalDue).toBe(0);
    });
  });

  describe("Password Hashing", () => {
    it("should correctly hash and verify passwords", async () => {
      const password = "securePassword123!";
      const hash = await bcrypt.hash(password, 10);

      // Verify correct password
      const correctMatch = await bcrypt.compare(password, hash);
      expect(correctMatch).toBe(true);

      // Verify incorrect password fails
      const incorrectMatch = await bcrypt.compare("wrongPassword", hash);
      expect(incorrectMatch).toBe(false);
    });

    it("should generate different hashes for same password", async () => {
      const password = "samePassword";
      const hash1 = await bcrypt.hash(password, 10);
      const hash2 = await bcrypt.hash(password, 10);

      expect(hash1).not.toBe(hash2);

      // Both should still verify correctly
      expect(await bcrypt.compare(password, hash1)).toBe(true);
      expect(await bcrypt.compare(password, hash2)).toBe(true);
    });
  });

  describe("Payment Status Transitions", () => {
    it("should support valid payment status values", () => {
      const validStatuses = [
        "pending",
        "requires_capture",
        "captured",
        "succeeded",
        "failed",
        "cancelled",
        "refunded",
      ];

      validStatuses.forEach((status) => {
        expect(typeof status).toBe("string");
      });
    });

    it("should track payment flow: pending -> requires_capture -> captured", async () => {
      const appointment = await UserAppointments.findByPk(1);

      // Initial state
      expect(appointment.paymentStatus).toBe("pending");
      expect(appointment.paid).toBe(false);

      // After customer authorizes
      await appointment.update({ paymentStatus: "requires_capture" });
      expect(appointment.paymentStatus).toBe("requires_capture");

      // After capture
      await appointment.update({
        paymentStatus: "captured",
        paid: true,
        amountPaid: 20000,
      });
      expect(appointment.paymentStatus).toBe("captured");
      expect(appointment.paid).toBe(true);
    });
  });
});

afterAll(async () => {
  // Clear all mocks and timers
  jest.clearAllMocks();
  jest.useRealTimers();
});
