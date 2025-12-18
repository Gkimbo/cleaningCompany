const ApplicationInfoClass = require("../../services/ApplicationInfoClass");

// Mock models
jest.mock("../../models", () => ({
  UserApplications: {
    create: jest.fn(),
  },
}));

const { UserApplications } = require("../../models");

describe("ApplicationInfoClass", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const validApplicationData = {
    firstName: "John",
    lastName: "Doe",
    email: "john.doe@test.com",
    phone: "555-123-4567",
    dateOfBirth: "1990-01-15",
    streetAddress: "123 Main St",
    city: "Boston",
    state: "MA",
    zipCode: "02101",
    ssnLast4: "1234",
    driversLicenseNumber: "DL12345",
    driversLicenseState: "MA",
    idPhoto: "base64photodata",
    isAuthorizedToWork: true,
    hasValidDriversLicense: true,
    hasReliableTransportation: true,
    experience: "3 years professional cleaning",
    previousEmployer: "ABC Cleaning Co",
    previousEmployerPhone: "555-987-6543",
    previousEmploymentDuration: "2 years",
    reasonForLeaving: "Looking for better opportunity",
    references: [
      { name: "Jane Smith", phone: "555-111-2222", relationship: "Former supervisor" },
    ],
    hasCriminalHistory: false,
    criminalHistoryExplanation: "",
    emergencyContactName: "Mary Doe",
    emergencyContactPhone: "555-333-4444",
    emergencyContactRelation: "Spouse",
    availableStartDate: "2025-02-01",
    availableDays: ["Monday", "Tuesday", "Wednesday"],
    message: "I am excited to join!",
    backgroundConsent: true,
    drugTestConsent: true,
    referenceCheckConsent: true,
  };

  describe("addApplicationToDB", () => {
    it("should create a new application successfully", async () => {
      const mockCreatedApplication = {
        id: 1,
        ...validApplicationData,
        status: "pending",
        createdAt: new Date(),
      };
      UserApplications.create.mockResolvedValue(mockCreatedApplication);

      const result = await ApplicationInfoClass.addApplicationToDB(validApplicationData);

      expect(UserApplications.create).toHaveBeenCalledWith(validApplicationData);
      expect(result).toEqual(mockCreatedApplication);
    });

    it("should pass all fields to the database", async () => {
      UserApplications.create.mockResolvedValue({ id: 1, ...validApplicationData });

      await ApplicationInfoClass.addApplicationToDB(validApplicationData);

      expect(UserApplications.create).toHaveBeenCalledWith(
        expect.objectContaining({
          firstName: "John",
          lastName: "Doe",
          email: "john.doe@test.com",
          phone: "555-123-4567",
          dateOfBirth: "1990-01-15",
          streetAddress: "123 Main St",
          city: "Boston",
          state: "MA",
          zipCode: "02101",
          ssnLast4: "1234",
          driversLicenseNumber: "DL12345",
          driversLicenseState: "MA",
          idPhoto: "base64photodata",
          isAuthorizedToWork: true,
          hasValidDriversLicense: true,
          hasReliableTransportation: true,
          experience: "3 years professional cleaning",
          previousEmployer: "ABC Cleaning Co",
          previousEmployerPhone: "555-987-6543",
          previousEmploymentDuration: "2 years",
          reasonForLeaving: "Looking for better opportunity",
          references: expect.any(Array),
          hasCriminalHistory: false,
          emergencyContactName: "Mary Doe",
          emergencyContactPhone: "555-333-4444",
          emergencyContactRelation: "Spouse",
          availableStartDate: "2025-02-01",
          availableDays: ["Monday", "Tuesday", "Wednesday"],
          message: "I am excited to join!",
          backgroundConsent: true,
          drugTestConsent: true,
          referenceCheckConsent: true,
        })
      );
    });

    it("should handle criminal history explanation", async () => {
      const dataWithCriminalHistory = {
        ...validApplicationData,
        hasCriminalHistory: true,
        criminalHistoryExplanation: "Minor traffic violation 5 years ago",
      };
      UserApplications.create.mockResolvedValue({ id: 1, ...dataWithCriminalHistory });

      await ApplicationInfoClass.addApplicationToDB(dataWithCriminalHistory);

      expect(UserApplications.create).toHaveBeenCalledWith(
        expect.objectContaining({
          hasCriminalHistory: true,
          criminalHistoryExplanation: "Minor traffic violation 5 years ago",
        })
      );
    });

    it("should handle multiple references", async () => {
      const dataWithMultipleRefs = {
        ...validApplicationData,
        references: [
          { name: "Jane Smith", phone: "555-111-2222", relationship: "Former supervisor" },
          { name: "Bob Johnson", phone: "555-333-4444", relationship: "Coworker" },
        ],
      };
      UserApplications.create.mockResolvedValue({ id: 1, ...dataWithMultipleRefs });

      await ApplicationInfoClass.addApplicationToDB(dataWithMultipleRefs);

      expect(UserApplications.create).toHaveBeenCalledWith(
        expect.objectContaining({
          references: expect.arrayContaining([
            expect.objectContaining({ name: "Jane Smith" }),
            expect.objectContaining({ name: "Bob Johnson" }),
          ]),
        })
      );
    });

    it("should handle database errors", async () => {
      UserApplications.create.mockRejectedValue(new Error("Database connection failed"));

      await expect(
        ApplicationInfoClass.addApplicationToDB(validApplicationData)
      ).rejects.toThrow("Database connection failed");
    });

    it("should handle optional fields with null values", async () => {
      const minimalData = {
        ...validApplicationData,
        previousEmployer: null,
        previousEmployerPhone: null,
        previousEmploymentDuration: null,
        reasonForLeaving: null,
      };
      UserApplications.create.mockResolvedValue({ id: 1, ...minimalData });

      await ApplicationInfoClass.addApplicationToDB(minimalData);

      expect(UserApplications.create).toHaveBeenCalledWith(
        expect.objectContaining({
          previousEmployer: null,
        })
      );
    });

    it("should handle different availability days", async () => {
      const weekendAvailability = {
        ...validApplicationData,
        availableDays: ["Saturday", "Sunday"],
      };
      UserApplications.create.mockResolvedValue({ id: 1, ...weekendAvailability });

      await ApplicationInfoClass.addApplicationToDB(weekendAvailability);

      expect(UserApplications.create).toHaveBeenCalledWith(
        expect.objectContaining({
          availableDays: ["Saturday", "Sunday"],
        })
      );
    });
  });
});
