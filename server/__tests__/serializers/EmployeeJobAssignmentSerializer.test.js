const EmployeeJobAssignmentSerializer = require("../../serializers/EmployeeJobAssignmentSerializer");
const EncryptionService = require("../../services/EncryptionService");

// Mock EncryptionService
jest.mock("../../services/EncryptionService", () => ({
  decrypt: jest.fn((value) => (value ? `decrypted_${value}` : null)),
}));

describe("EmployeeJobAssignmentSerializer", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("serializeOne", () => {
    it("should return null for null input", () => {
      const result = EmployeeJobAssignmentSerializer.serializeOne(null);
      expect(result).toBeNull();
    });

    it("should serialize basic assignment fields", () => {
      const mockAssignment = {
        dataValues: {
          id: 1,
          businessEmployeeId: 10,
          appointmentId: 100,
          businessOwnerId: 5,
          status: "assigned",
          isSelfAssignment: false,
          assignedAt: new Date("2024-01-15"),
          startedAt: null,
          completedAt: null,
        },
      };

      const result = EmployeeJobAssignmentSerializer.serializeOne(mockAssignment);

      expect(result.id).toBe(1);
      expect(result.businessEmployeeId).toBe(10);
      expect(result.appointmentId).toBe(100);
      expect(result.businessOwnerId).toBe(5);
      expect(result.status).toBe("assigned");
      expect(result.isSelfAssignment).toBe(false);
    });

    it("should include pay info when includePayInfo is true", () => {
      const mockAssignment = {
        dataValues: {
          id: 1,
          payAmount: 5000,
          payType: "hourly",
          hoursWorked: 3,
          payoutStatus: "pending",
        },
      };

      const result = EmployeeJobAssignmentSerializer.serializeOne(mockAssignment, {
        includePayInfo: true,
      });

      expect(result.payAmount).toBe(5000);
      expect(result.payType).toBe("hourly");
      expect(result.hoursWorked).toBe(3);
      expect(result.payoutStatus).toBe("pending");
      expect(result.formattedPay).toBe("$50.00");
    });

    it("should exclude pay info when includePayInfo is false", () => {
      const mockAssignment = {
        dataValues: {
          id: 1,
          payAmount: 5000,
          payType: "hourly",
        },
      };

      const result = EmployeeJobAssignmentSerializer.serializeOne(mockAssignment, {
        includePayInfo: false,
      });

      expect(result.payAmount).toBeUndefined();
      expect(result.payType).toBeUndefined();
      expect(result.formattedPay).toBeUndefined();
    });

    it("should decrypt employee PII fields", () => {
      const mockAssignment = {
        dataValues: {
          id: 1,
          employee: {
            id: 10,
            firstName: "encrypted_john",
            lastName: "encrypted_doe",
            paymentMethod: "stripe_connect",
          },
        },
      };

      const result = EmployeeJobAssignmentSerializer.serializeOne(mockAssignment, {
        includeEmployee: true,
      });

      expect(EncryptionService.decrypt).toHaveBeenCalledWith("encrypted_john");
      expect(EncryptionService.decrypt).toHaveBeenCalledWith("encrypted_doe");
      expect(result.employee.firstName).toBe("decrypted_encrypted_john");
      expect(result.employee.lastName).toBe("decrypted_encrypted_doe");
      expect(result.employee.paymentMethod).toBe("stripe_connect");
    });
  });

  describe("serializeHome", () => {
    it("should return null for null input", () => {
      const result = EmployeeJobAssignmentSerializer.serializeHome(null);
      expect(result).toBeNull();
    });

    it("should serialize basic home fields without details", () => {
      const mockHome = {
        dataValues: {
          id: 1,
          numBeds: 3,
          numBaths: 2,
          address: "encrypted_address",
          city: "encrypted_city",
        },
      };

      const result = EmployeeJobAssignmentSerializer.serializeHome(mockHome, false);

      expect(result.id).toBe(1);
      expect(result.numBeds).toBe(3);
      expect(result.numBaths).toBe(2);
      expect(result.address).toBeUndefined();
      expect(result.city).toBeUndefined();
    });

    it("should decrypt all encrypted home fields when includeDetails is true", () => {
      const mockHome = {
        dataValues: {
          id: 1,
          numBeds: 3,
          numBaths: 2,
          address: "encrypted_123_main_st",
          city: "encrypted_boston",
          state: "encrypted_ma",
          zipcode: "encrypted_02101",
          keyPadCode: "encrypted_1234",
          keyLocation: "encrypted_under_mat",
          contact: "encrypted_555-1234",
          notes: "Please use side door",
        },
      };

      const result = EmployeeJobAssignmentSerializer.serializeHome(mockHome, true);

      // Verify all encrypted fields are decrypted
      expect(EncryptionService.decrypt).toHaveBeenCalledWith("encrypted_123_main_st");
      expect(EncryptionService.decrypt).toHaveBeenCalledWith("encrypted_boston");
      expect(EncryptionService.decrypt).toHaveBeenCalledWith("encrypted_ma");
      expect(EncryptionService.decrypt).toHaveBeenCalledWith("encrypted_02101");
      expect(EncryptionService.decrypt).toHaveBeenCalledWith("encrypted_1234");
      expect(EncryptionService.decrypt).toHaveBeenCalledWith("encrypted_under_mat");
      expect(EncryptionService.decrypt).toHaveBeenCalledWith("encrypted_555-1234");

      // Verify decrypted values
      expect(result.address).toBe("decrypted_encrypted_123_main_st");
      expect(result.city).toBe("decrypted_encrypted_boston");
      expect(result.state).toBe("decrypted_encrypted_ma");
      expect(result.zipcode).toBe("decrypted_encrypted_02101");
      expect(result.keyPadCode).toBe("decrypted_encrypted_1234");
      expect(result.keyLocation).toBe("decrypted_encrypted_under_mat");
      expect(result.contact).toBe("decrypted_encrypted_555-1234");

      // Notes should not be decrypted (not encrypted)
      expect(result.notes).toBe("Please use side door");
    });

    it("should handle null encrypted fields gracefully", () => {
      const mockHome = {
        dataValues: {
          id: 1,
          numBeds: 2,
          numBaths: 1,
          address: null,
          city: null,
          state: null,
          zipcode: null,
        },
      };

      const result = EmployeeJobAssignmentSerializer.serializeHome(mockHome, true);

      expect(result.address).toBeNull();
      expect(result.city).toBeNull();
      expect(result.state).toBeNull();
      expect(result.zipcode).toBeNull();
    });
  });

  describe("serializeUser", () => {
    it("should return null for null input", () => {
      const result = EmployeeJobAssignmentSerializer.serializeUser(null);
      expect(result).toBeNull();
    });

    it("should decrypt user PII fields", () => {
      const mockUser = {
        dataValues: {
          id: 1,
          firstName: "encrypted_jane",
          lastName: "encrypted_smith",
          email: "encrypted_jane@example.com",
          phone: "encrypted_555-9876",
        },
      };

      const result = EmployeeJobAssignmentSerializer.serializeUser(mockUser);

      expect(EncryptionService.decrypt).toHaveBeenCalledWith("encrypted_jane");
      expect(EncryptionService.decrypt).toHaveBeenCalledWith("encrypted_smith");
      expect(EncryptionService.decrypt).toHaveBeenCalledWith("encrypted_jane@example.com");
      expect(EncryptionService.decrypt).toHaveBeenCalledWith("encrypted_555-9876");

      expect(result.firstName).toBe("decrypted_encrypted_jane");
      expect(result.lastName).toBe("decrypted_encrypted_smith");
      expect(result.email).toBe("decrypted_encrypted_jane@example.com");
      expect(result.phone).toBe("decrypted_encrypted_555-9876");
    });
  });

  describe("serializeAppointment", () => {
    it("should return null for null input", () => {
      const result = EmployeeJobAssignmentSerializer.serializeAppointment(null);
      expect(result).toBeNull();
    });

    it("should serialize appointment with home details decrypted", () => {
      const mockAppointment = {
        dataValues: {
          id: 100,
          date: "2024-01-20",
          price: 15000,
          completed: false,
          paymentCaptureFailed: false,
          home: {
            dataValues: {
              id: 1,
              numBeds: 3,
              numBaths: 2,
              address: "encrypted_456_oak_ave",
              city: "encrypted_cambridge",
              state: "encrypted_ma",
              zipcode: "encrypted_02139",
            },
          },
          user: {
            dataValues: {
              id: 5,
              firstName: "encrypted_bob",
              lastName: "encrypted_jones",
            },
          },
        },
      };

      const result = EmployeeJobAssignmentSerializer.serializeAppointment(
        mockAppointment,
        true
      );

      expect(result.id).toBe(100);
      expect(result.price).toBe("150.00");
      expect(result.completed).toBe(false);

      // Home should be decrypted
      expect(result.home.address).toBe("decrypted_encrypted_456_oak_ave");
      expect(result.home.city).toBe("decrypted_encrypted_cambridge");
      expect(result.home.state).toBe("decrypted_encrypted_ma");
      expect(result.home.zipcode).toBe("decrypted_encrypted_02139");

      // User should be decrypted
      expect(result.user.firstName).toBe("decrypted_encrypted_bob");
      expect(result.user.lastName).toBe("decrypted_encrypted_jones");
    });

    it("should limit user info when includeClientDetails is false", () => {
      const mockAppointment = {
        dataValues: {
          id: 100,
          date: "2024-01-20",
          price: 10000,
          home: {
            dataValues: {
              id: 1,
              numBeds: 2,
              numBaths: 1,
              address: "encrypted_address",
            },
          },
          user: {
            // Note: When nested in dataValues, user should be a plain object (not wrapped in dataValues)
            // because serializeAppointment extracts data.user directly, not data.user.dataValues
            id: 5,
            firstName: "encrypted_alice",
            lastName: "encrypted_wonder",
            email: "encrypted_alice@test.com",
            phone: "encrypted_555-1111",
          },
        },
      };

      const result = EmployeeJobAssignmentSerializer.serializeAppointment(
        mockAppointment,
        false
      );

      // User should only have id and firstName when client details not included
      expect(result.user.id).toBe(5);
      expect(result.user.firstName).toBe("decrypted_encrypted_alice");
      expect(result.user.lastName).toBeUndefined();
      expect(result.user.email).toBeUndefined();
      expect(result.user.phone).toBeUndefined();
    });
  });

  describe("serializeArray", () => {
    it("should return empty array for null input", () => {
      const result = EmployeeJobAssignmentSerializer.serializeArray(null);
      expect(result).toEqual([]);
    });

    it("should return empty array for non-array input", () => {
      const result = EmployeeJobAssignmentSerializer.serializeArray("not an array");
      expect(result).toEqual([]);
    });

    it("should serialize array of assignments", () => {
      const mockAssignments = [
        { dataValues: { id: 1, status: "assigned" } },
        { dataValues: { id: 2, status: "started" } },
        { dataValues: { id: 3, status: "completed" } },
      ];

      const result = EmployeeJobAssignmentSerializer.serializeArray(mockAssignments);

      expect(result).toHaveLength(3);
      expect(result[0].id).toBe(1);
      expect(result[1].id).toBe(2);
      expect(result[2].id).toBe(3);
    });
  });

  describe("serializeForEmployee", () => {
    it("should include full details when employee has view permissions", () => {
      const mockAssignment = {
        dataValues: {
          id: 1,
          status: "assigned",
          payAmount: 5000,
          appointment: {
            dataValues: {
              id: 100,
              date: "2024-01-20",
              price: 15000,
              home: {
                dataValues: {
                  id: 1,
                  numBeds: 3,
                  numBaths: 2,
                  address: "encrypted_address",
                  city: "encrypted_city",
                },
              },
              user: {
                dataValues: {
                  id: 5,
                  firstName: "encrypted_client",
                  lastName: "encrypted_name",
                },
              },
            },
          },
        },
      };

      const employeeRecord = {
        canViewClientDetails: true,
        canViewPayInfo: true,
      };

      const result = EmployeeJobAssignmentSerializer.serializeForEmployee(
        mockAssignment,
        employeeRecord
      );

      expect(result.id).toBe(1);
      expect(result.payAmount).toBe(5000);
      expect(result.appointment.home.address).toBe("decrypted_encrypted_address");
      expect(result.appointment.user.firstName).toBe("decrypted_encrypted_client");
    });

    it("should exclude client details when employee lacks permissions", () => {
      const mockAssignment = {
        dataValues: {
          id: 1,
          status: "assigned",
          payAmount: 5000,
          appointment: {
            dataValues: {
              id: 100,
              date: "2024-01-20",
              price: 15000,
              home: {
                dataValues: {
                  id: 1,
                  numBeds: 3,
                  numBaths: 2,
                  address: "encrypted_address",
                },
              },
              user: {
                // Plain object without nested dataValues
                id: 5,
                firstName: "encrypted_client",
                lastName: "encrypted_name",
                email: "encrypted_email",
              },
            },
          },
        },
      };

      const employeeRecord = {
        canViewClientDetails: false,
        canViewJobEarnings: false,
      };

      const result = EmployeeJobAssignmentSerializer.serializeForEmployee(
        mockAssignment,
        employeeRecord
      );

      // Pay amount is ALWAYS included for employees' own jobs
      // (they should see what they'll earn)
      expect(result.payAmount).toBe(5000);

      // Home should not have address when canViewClientDetails is false
      expect(result.appointment.home.address).toBeUndefined();

      // User should only have limited info when canViewClientDetails is false
      expect(result.appointment.user.email).toBeUndefined();
    });
  });

  describe("toDollars", () => {
    it("should convert cents to dollars", () => {
      expect(EmployeeJobAssignmentSerializer.toDollars(15000)).toBe("150.00");
      expect(EmployeeJobAssignmentSerializer.toDollars(100)).toBe("1.00");
      expect(EmployeeJobAssignmentSerializer.toDollars(50)).toBe("0.50");
    });

    it("should handle null/undefined", () => {
      expect(EmployeeJobAssignmentSerializer.toDollars(null)).toBeNull();
      expect(EmployeeJobAssignmentSerializer.toDollars(undefined)).toBeNull();
    });

    it("should handle zero", () => {
      expect(EmployeeJobAssignmentSerializer.toDollars(0)).toBe("0.00");
    });
  });
});
