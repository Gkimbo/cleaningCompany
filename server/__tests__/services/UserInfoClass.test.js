const UserInfoClass = require("../../services/UserInfoClass");
const bcrypt = require("bcrypt");

// Mock models
jest.mock("../../models", () => ({
  UserHomes: {
    create: jest.fn(),
    findOne: jest.fn(),
    destroy: jest.fn(),
  },
  User: {
    findOne: jest.fn(),
  },
  UserAppointments: {
    findOne: jest.fn(),
  },
  UserBills: {
    findOne: jest.fn(),
  },
}));

jest.mock("bcrypt", () => ({
  genSalt: jest.fn(),
  hash: jest.fn(),
}));

const { UserHomes, User, UserAppointments, UserBills } = require("../../models");

describe("UserInfoClass", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const validHomeData = {
    userId: 1,
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
    cleanersNeeded: 2,
    timeToBeCompleted: "10:00",
    outsideServiceArea: false,
  };

  describe("addHomeToDB", () => {
    it("should create a new home successfully", async () => {
      const mockCreatedHome = { id: 1, ...validHomeData };
      UserHomes.create.mockResolvedValue(mockCreatedHome);

      const result = await UserInfoClass.addHomeToDB(validHomeData);

      expect(UserHomes.create).toHaveBeenCalledWith(validHomeData);
      expect(result).toEqual(mockCreatedHome);
    });

    it("should handle outsideServiceArea flag", async () => {
      const outsideAreaData = { ...validHomeData, outsideServiceArea: true };
      UserHomes.create.mockResolvedValue({ id: 1, ...outsideAreaData });

      const result = await UserInfoClass.addHomeToDB(outsideAreaData);

      expect(UserHomes.create).toHaveBeenCalledWith(
        expect.objectContaining({ outsideServiceArea: true })
      );
      expect(result.outsideServiceArea).toBe(true);
    });

    it("should default outsideServiceArea to false", async () => {
      const dataWithoutFlag = { ...validHomeData };
      delete dataWithoutFlag.outsideServiceArea;
      UserHomes.create.mockResolvedValue({ id: 1, ...dataWithoutFlag, outsideServiceArea: false });

      await UserInfoClass.addHomeToDB(dataWithoutFlag);

      expect(UserHomes.create).toHaveBeenCalledWith(
        expect.objectContaining({ outsideServiceArea: false })
      );
    });

    it("should handle database errors", async () => {
      UserHomes.create.mockRejectedValue(new Error("Database error"));

      await expect(UserInfoClass.addHomeToDB(validHomeData)).rejects.toThrow(
        "Database error"
      );
    });
  });

  describe("editHomeInDB", () => {
    const updateData = { id: 1, ...validHomeData, nickName: "Updated Beach House" };

    it("should update home successfully", async () => {
      const mockHome = {
        id: 1,
        ...validHomeData,
        update: jest.fn(),
      };
      UserHomes.findOne.mockResolvedValue(mockHome);

      const result = await UserInfoClass.editHomeInDB(updateData);

      expect(UserHomes.findOne).toHaveBeenCalledWith({ where: { id: 1 } });
      expect(mockHome.update).toHaveBeenCalled();
      expect(result).toEqual(mockHome);
    });

    it("should return error message for non-existent home", async () => {
      UserHomes.findOne.mockResolvedValue(null);

      const result = await UserInfoClass.editHomeInDB(updateData);

      expect(result).toBe("Home not found for editing");
    });

    it("should update outsideServiceArea flag", async () => {
      const mockHome = {
        id: 1,
        ...validHomeData,
        update: jest.fn(),
      };
      UserHomes.findOne.mockResolvedValue(mockHome);

      await UserInfoClass.editHomeInDB({ ...updateData, outsideServiceArea: true });

      expect(mockHome.update).toHaveBeenCalledWith(
        expect.objectContaining({ outsideServiceArea: true })
      );
    });
  });

  describe("deleteHomeInfo", () => {
    it("should delete home successfully", async () => {
      UserHomes.destroy.mockResolvedValue(1);

      const result = await UserInfoClass.deleteHomeInfo(1);

      expect(UserHomes.destroy).toHaveBeenCalledWith({ where: { id: 1 } });
      expect(result).toBe(1);
    });

    it("should return 0 when home not found", async () => {
      UserHomes.destroy.mockResolvedValue(0);

      const result = await UserInfoClass.deleteHomeInfo(999);

      expect(result).toBe(0);
    });

    it("should throw error on database failure", async () => {
      UserHomes.destroy.mockRejectedValue(new Error("Delete failed"));

      await expect(UserInfoClass.deleteHomeInfo(1)).rejects.toThrow(
        "Delete failed"
      );
    });
  });

  describe("editEmployeeInDB", () => {
    const employeeData = {
      id: 1,
      username: "newusername",
      password: "newpassword",
      email: "new@email.com",
      type: "cleaner",
    };

    it("should update employee with hashed password", async () => {
      const mockEmployee = {
        id: 1,
        username: "oldusername",
        update: jest.fn(),
      };
      User.findOne.mockResolvedValue(mockEmployee);
      bcrypt.genSalt.mockResolvedValue("salt");
      bcrypt.hash.mockResolvedValue("hashedpassword");

      const result = await UserInfoClass.editEmployeeInDB(employeeData);

      expect(bcrypt.genSalt).toHaveBeenCalledWith(10);
      expect(bcrypt.hash).toHaveBeenCalledWith("newpassword", "salt");
      expect(mockEmployee.update).toHaveBeenCalled();
      expect(result).toEqual(mockEmployee);
    });

    it("should return error message for non-existent employee", async () => {
      User.findOne.mockResolvedValue(null);

      const result = await UserInfoClass.editEmployeeInDB(employeeData);

      expect(result).toBe("Employee not found for editing");
    });

    it("should handle bcrypt errors", async () => {
      const mockEmployee = { id: 1, update: jest.fn() };
      User.findOne.mockResolvedValue(mockEmployee);
      bcrypt.genSalt.mockRejectedValue(new Error("Bcrypt error"));

      await expect(
        UserInfoClass.editEmployeeInDB(employeeData)
      ).rejects.toThrow();
    });
  });

  describe("editTimeInDB", () => {
    const mockAppointment = {
      dataValues: { id: 1, price: 100, userId: 1 },
      update: jest.fn(),
    };
    const mockBill = {
      dataValues: { appointmentDue: 100, totalDue: 100 },
      update: jest.fn(),
    };

    beforeEach(() => {
      UserAppointments.findOne.mockResolvedValue(mockAppointment);
      UserBills.findOne.mockResolvedValue(mockBill);
    });

    it("should not add price for anytime", async () => {
      await UserInfoClass.editTimeInDB({ id: 1, timeToBeCompleted: "anytime" });

      expect(mockAppointment.update).toHaveBeenCalledWith(
        expect.objectContaining({
          timeToBeCompleted: "anytime",
          price: 100, // No change
        })
      );
    });

    it("should add $25 for 10-3 time slot", async () => {
      await UserInfoClass.editTimeInDB({ id: 1, timeToBeCompleted: "10-3" });

      expect(mockAppointment.update).toHaveBeenCalledWith(
        expect.objectContaining({
          timeToBeCompleted: "10-3",
          price: 125,
        })
      );
    });

    it("should add $25 for 11-4 time slot", async () => {
      await UserInfoClass.editTimeInDB({ id: 1, timeToBeCompleted: "11-4" });

      expect(mockAppointment.update).toHaveBeenCalledWith(
        expect.objectContaining({
          price: 125,
        })
      );
    });

    it("should add $30 for 12-2 time slot", async () => {
      await UserInfoClass.editTimeInDB({ id: 1, timeToBeCompleted: "12-2" });

      expect(mockAppointment.update).toHaveBeenCalledWith(
        expect.objectContaining({
          price: 130,
        })
      );
    });

    it("should update bill totals", async () => {
      await UserInfoClass.editTimeInDB({ id: 1, timeToBeCompleted: "10-3" });

      expect(mockBill.update).toHaveBeenCalledWith({
        appointmentDue: 125,
        totalDue: 125,
      });
    });
  });

  describe("editSheetsInDB", () => {
    const mockAppointment = {
      dataValues: { id: 1, price: 100, userId: 1 },
      update: jest.fn(),
    };
    const mockBill = {
      dataValues: { appointmentDue: 100, totalDue: 100 },
      update: jest.fn(),
    };

    beforeEach(() => {
      UserAppointments.findOne.mockResolvedValue(mockAppointment);
      UserBills.findOne.mockResolvedValue(mockBill);
    });

    it("should add $30 when bringing sheets", async () => {
      await UserInfoClass.editSheetsInDB({ id: 1, bringSheets: "yes" });

      expect(mockAppointment.update).toHaveBeenCalledWith(
        expect.objectContaining({
          bringSheets: "yes",
          price: 130,
        })
      );
    });

    it("should subtract $30 when not bringing sheets", async () => {
      await UserInfoClass.editSheetsInDB({ id: 1, bringSheets: "no" });

      expect(mockAppointment.update).toHaveBeenCalledWith(
        expect.objectContaining({
          bringSheets: "no",
          price: 70,
        })
      );
    });
  });

  describe("editTowelsInDB", () => {
    const mockAppointment = {
      dataValues: { id: 1, price: 100, userId: 1 },
      update: jest.fn(),
    };
    const mockBill = {
      dataValues: { appointmentDue: 100, totalDue: 100 },
      update: jest.fn(),
    };

    beforeEach(() => {
      UserAppointments.findOne.mockResolvedValue(mockAppointment);
      UserBills.findOne.mockResolvedValue(mockBill);
    });

    it("should add $12 when bringing towels (2 towels at $5 + 1 face cloth at $2)", async () => {
      await UserInfoClass.editTowelsInDB({ id: 1, bringTowels: "yes" });

      expect(mockAppointment.update).toHaveBeenCalledWith(
        expect.objectContaining({
          bringTowels: "yes",
          price: 112,
        })
      );
    });

    it("should subtract $12 when not bringing towels", async () => {
      await UserInfoClass.editTowelsInDB({ id: 1, bringTowels: "no" });

      expect(mockAppointment.update).toHaveBeenCalledWith(
        expect.objectContaining({
          bringTowels: "no",
          price: 88,
        })
      );
    });
  });

  describe("editCodeKeyInDB", () => {
    it("should update keypad and key location", async () => {
      const mockAppointment = {
        id: 1,
        update: jest.fn(),
      };
      UserAppointments.findOne.mockResolvedValue(mockAppointment);

      await UserInfoClass.editCodeKeyInDB({
        id: 1,
        keyPadCode: "5678",
        keyLocation: "Lockbox",
      });

      expect(mockAppointment.update).toHaveBeenCalledWith({
        keyPadCode: "5678",
        keyLocation: "Lockbox",
      });
    });

    it("should return error for non-existent appointment", async () => {
      UserAppointments.findOne.mockResolvedValue(null);

      const result = await UserInfoClass.editCodeKeyInDB({
        id: 999,
        keyPadCode: "5678",
        keyLocation: "Lockbox",
      });

      expect(result).toBe("Employee not found for editing");
    });
  });
});
