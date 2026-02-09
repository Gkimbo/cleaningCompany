const BusinessEmployeeSerializer = require("../../serializers/BusinessEmployeeSerializer");
const EncryptionService = require("../../services/EncryptionService");

// Mock EncryptionService
jest.mock("../../services/EncryptionService", () => ({
  decrypt: jest.fn((value) => `decrypted_${value}`),
}));

describe("BusinessEmployeeSerializer", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("decryptField", () => {
    it("should return null for null value", () => {
      const result = BusinessEmployeeSerializer.decryptField(null);
      expect(result).toBeNull();
      expect(EncryptionService.decrypt).not.toHaveBeenCalled();
    });

    it("should return null for undefined value", () => {
      const result = BusinessEmployeeSerializer.decryptField(undefined);
      expect(result).toBeNull();
      expect(EncryptionService.decrypt).not.toHaveBeenCalled();
    });

    it("should decrypt non-null value", () => {
      const result = BusinessEmployeeSerializer.decryptField("encrypted_value");
      expect(EncryptionService.decrypt).toHaveBeenCalledWith("encrypted_value");
      expect(result).toBe("decrypted_encrypted_value");
    });
  });

  describe("serializeOne", () => {
    it("should return null for null input", () => {
      const result = BusinessEmployeeSerializer.serializeOne(null);
      expect(result).toBeNull();
    });

    it("should serialize basic employee fields from dataValues", () => {
      const mockEmployee = {
        dataValues: {
          id: 1,
          businessOwnerId: 10,
          userId: 5,
          status: "active",
          defaultHourlyRate: 2500,
          paymentMethod: "stripe",
          stripeConnectOnboarded: true,
          canViewClientDetails: true,
          canViewJobEarnings: false,
          canMessageClients: true,
          maxJobsPerDay: 3,
          createdAt: new Date("2026-01-01"),
        },
      };

      const result = BusinessEmployeeSerializer.serializeOne(mockEmployee);

      expect(result.id).toBe(1);
      expect(result.businessOwnerId).toBe(10);
      expect(result.userId).toBe(5);
      expect(result.status).toBe("active");
      expect(result.defaultHourlyRate).toBe(2500);
      expect(result.paymentMethod).toBe("stripe");
      expect(result.stripeConnectOnboarded).toBe(true);
      expect(result.canViewClientDetails).toBe(true);
      expect(result.canViewJobEarnings).toBe(false);
      expect(result.canMessageClients).toBe(true);
      expect(result.maxJobsPerDay).toBe(3);
    });

    it("should decrypt PII fields (firstName, lastName, email, phone)", () => {
      const mockEmployee = {
        dataValues: {
          id: 1,
          firstName: "iv1:encryptedfirstname",
          lastName: "iv2:encryptedlastname",
          email: "iv3:encryptedemail",
          phone: "iv4:encryptedphone",
        },
      };

      const result = BusinessEmployeeSerializer.serializeOne(mockEmployee);

      expect(EncryptionService.decrypt).toHaveBeenCalledWith("iv1:encryptedfirstname");
      expect(EncryptionService.decrypt).toHaveBeenCalledWith("iv2:encryptedlastname");
      expect(EncryptionService.decrypt).toHaveBeenCalledWith("iv3:encryptedemail");
      expect(EncryptionService.decrypt).toHaveBeenCalledWith("iv4:encryptedphone");

      expect(result.firstName).toBe("decrypted_iv1:encryptedfirstname");
      expect(result.lastName).toBe("decrypted_iv2:encryptedlastname");
      expect(result.email).toBe("decrypted_iv3:encryptedemail");
      expect(result.phone).toBe("decrypted_iv4:encryptedphone");
    });

    it("should handle null PII fields", () => {
      const mockEmployee = {
        dataValues: {
          id: 1,
          firstName: null,
          lastName: null,
          email: null,
          phone: null,
        },
      };

      const result = BusinessEmployeeSerializer.serializeOne(mockEmployee);

      expect(EncryptionService.decrypt).not.toHaveBeenCalled();
      expect(result.firstName).toBeNull();
      expect(result.lastName).toBeNull();
      expect(result.email).toBeNull();
      expect(result.phone).toBeNull();
    });

    it("should format hourly rate when present", () => {
      const mockEmployee = {
        dataValues: {
          id: 1,
          defaultHourlyRate: 2500, // cents
        },
      };

      const result = BusinessEmployeeSerializer.serializeOne(mockEmployee);

      expect(result.defaultHourlyRate).toBe(2500);
      expect(result.formattedHourlyRate).toBe("$25.00/hr");
    });

    it("should not include formattedHourlyRate when rate is not set", () => {
      const mockEmployee = {
        dataValues: {
          id: 1,
          defaultHourlyRate: null,
        },
      };

      const result = BusinessEmployeeSerializer.serializeOne(mockEmployee);

      expect(result.formattedHourlyRate).toBeUndefined();
    });

    it("should serialize nested user data when includeUser is true", () => {
      const mockEmployee = {
        dataValues: {
          id: 1,
        },
        user: {
          dataValues: {
            id: 5,
            firstName: "iv:userfirstname",
            lastName: "iv:userlastname",
            email: "iv:useremail",
            phone: "iv:userphone",
            businessName: "Test Business",
            expoPushToken: "ExponentPushToken[xxx]",
          },
        },
      };

      const result = BusinessEmployeeSerializer.serializeOne(mockEmployee, {
        includeUser: true,
      });

      expect(result.user).toBeDefined();
      expect(result.user.id).toBe(5);
      expect(result.user.firstName).toBe("decrypted_iv:userfirstname");
      expect(result.user.businessName).toBe("Test Business");
    });

    it("should not include user data when includeUser is false", () => {
      const mockEmployee = {
        dataValues: {
          id: 1,
        },
        user: {
          dataValues: {
            id: 5,
            firstName: "John",
          },
        },
      };

      const result = BusinessEmployeeSerializer.serializeOne(mockEmployee, {
        includeUser: false,
      });

      expect(result.user).toBeUndefined();
    });

    it("should serialize job assignments when includeAssignments is true", () => {
      const mockEmployee = {
        dataValues: {
          id: 1,
        },
        jobAssignments: [
          {
            id: 100,
            appointmentId: 50,
            status: "completed",
            payAmount: 5000,
            assignedAt: new Date("2026-01-01"),
            completedAt: new Date("2026-01-01"),
          },
        ],
      };

      const result = BusinessEmployeeSerializer.serializeOne(mockEmployee, {
        includeAssignments: true,
      });

      expect(result.jobAssignments).toHaveLength(1);
      expect(result.jobAssignments[0].id).toBe(100);
      expect(result.jobAssignments[0].appointmentId).toBe(50);
      expect(result.jobAssignments[0].status).toBe("completed");
      expect(result.jobAssignments[0].payAmount).toBe(5000);
    });

    it("should include availability info when present", () => {
      const mockEmployee = {
        dataValues: {
          id: 1,
          availability: {
            date: "2026-01-15",
            isAvailable: true,
            slots: ["morning", "afternoon"],
          },
        },
      };

      const result = BusinessEmployeeSerializer.serializeOne(mockEmployee);

      expect(result.availability).toBeDefined();
      expect(result.availability.isAvailable).toBe(true);
    });

    it("should access values directly if dataValues not present", () => {
      const mockEmployee = {
        id: 1,
        firstName: "iv:firstname",
        lastName: "iv:lastname",
        status: "active",
      };

      const result = BusinessEmployeeSerializer.serializeOne(mockEmployee);

      expect(result.id).toBe(1);
      expect(result.firstName).toBe("decrypted_iv:firstname");
      expect(result.status).toBe("active");
    });
  });

  describe("serializeArray", () => {
    it("should serialize an array of employees", () => {
      const mockEmployees = [
        {
          dataValues: {
            id: 1,
            firstName: "iv:first1",
            lastName: "iv:last1",
            status: "active",
          },
        },
        {
          dataValues: {
            id: 2,
            firstName: "iv:first2",
            lastName: "iv:last2",
            status: "invited",
          },
        },
      ];

      const result = BusinessEmployeeSerializer.serializeArray(mockEmployees);

      expect(result).toHaveLength(2);
      expect(result[0].id).toBe(1);
      expect(result[0].firstName).toBe("decrypted_iv:first1");
      expect(result[1].id).toBe(2);
      expect(result[1].firstName).toBe("decrypted_iv:first2");
    });

    it("should return empty array for null input", () => {
      const result = BusinessEmployeeSerializer.serializeArray(null);
      expect(result).toEqual([]);
    });

    it("should return empty array for non-array input", () => {
      const result = BusinessEmployeeSerializer.serializeArray({});
      expect(result).toEqual([]);
    });

    it("should handle empty array", () => {
      const result = BusinessEmployeeSerializer.serializeArray([]);
      expect(result).toEqual([]);
    });
  });

  describe("serializeListItem", () => {
    it("should return null for null input", () => {
      const result = BusinessEmployeeSerializer.serializeListItem(null);
      expect(result).toBeNull();
    });

    it("should return minimal data for list view", () => {
      const mockEmployee = {
        dataValues: {
          id: 1,
          firstName: "iv:firstname",
          lastName: "iv:lastname",
          status: "active",
          canMessageClients: true,
          paymentMethod: "stripe",
          // These should NOT be included in list item
          defaultHourlyRate: 2500,
          email: "iv:email",
          phone: "iv:phone",
        },
      };

      const result = BusinessEmployeeSerializer.serializeListItem(mockEmployee);

      expect(result.id).toBe(1);
      expect(result.firstName).toBe("decrypted_iv:firstname");
      expect(result.lastName).toBe("decrypted_iv:lastname");
      expect(result.status).toBe("active");
      expect(result.canMessageClients).toBe(true);
      expect(result.paymentMethod).toBe("stripe");

      // Should NOT include these in list item
      expect(result.defaultHourlyRate).toBeUndefined();
      expect(result.email).toBeUndefined();
      expect(result.phone).toBeUndefined();
    });

    it("should decrypt PII fields in list item", () => {
      const mockEmployee = {
        dataValues: {
          id: 1,
          firstName: "iv:encfirst",
          lastName: "iv:enclast",
        },
      };

      const result = BusinessEmployeeSerializer.serializeListItem(mockEmployee);

      expect(EncryptionService.decrypt).toHaveBeenCalledWith("iv:encfirst");
      expect(EncryptionService.decrypt).toHaveBeenCalledWith("iv:enclast");
      expect(result.firstName).toBe("decrypted_iv:encfirst");
      expect(result.lastName).toBe("decrypted_iv:enclast");
    });

    it("should include nested user data if present", () => {
      const mockEmployee = {
        dataValues: {
          id: 1,
          firstName: "iv:empfirst",
          lastName: "iv:emplast",
        },
        user: {
          id: 5,
          firstName: "iv:userfirst",
          lastName: "iv:userlast",
        },
      };

      const result = BusinessEmployeeSerializer.serializeListItem(mockEmployee);

      expect(result.user).toBeDefined();
      expect(result.user.id).toBe(5);
      expect(result.user.firstName).toBe("decrypted_iv:userfirst");
      expect(result.user.lastName).toBe("decrypted_iv:userlast");
    });

    it("should return null for user if not present", () => {
      const mockEmployee = {
        dataValues: {
          id: 1,
          firstName: "iv:firstname",
          lastName: "iv:lastname",
        },
      };

      const result = BusinessEmployeeSerializer.serializeListItem(mockEmployee);

      expect(result.user).toBeNull();
    });
  });

  describe("serializeInvitation", () => {
    it("should return null for null input", () => {
      const result = BusinessEmployeeSerializer.serializeInvitation(null);
      expect(result).toBeNull();
    });

    it("should serialize invitation data with decrypted PII", () => {
      const mockEmployee = {
        dataValues: {
          id: 1,
          firstName: "iv:invfirstname",
          lastName: "iv:invlastname",
          email: "iv:invemail",
        },
        businessOwner: {
          dataValues: {
            id: 10,
            firstName: "iv:ownerfirst",
            lastName: "iv:ownerlast",
            businessName: "Cleaning Co",
          },
        },
      };

      const result = BusinessEmployeeSerializer.serializeInvitation(mockEmployee);

      expect(result.firstName).toBe("decrypted_iv:invfirstname");
      expect(result.lastName).toBe("decrypted_iv:invlastname");
      expect(result.email).toBe("decrypted_iv:invemail");
      expect(result.businessName).toBe("Cleaning Co");
      expect(result.businessOwnerName).toBe("decrypted_iv:ownerfirst decrypted_iv:ownerlast");
    });

    it("should decrypt employee PII fields in invitation", () => {
      const mockEmployee = {
        dataValues: {
          firstName: "iv:encfirst",
          lastName: "iv:enclast",
          email: "iv:encemail",
        },
      };

      const result = BusinessEmployeeSerializer.serializeInvitation(mockEmployee);

      expect(EncryptionService.decrypt).toHaveBeenCalledWith("iv:encfirst");
      expect(EncryptionService.decrypt).toHaveBeenCalledWith("iv:enclast");
      expect(EncryptionService.decrypt).toHaveBeenCalledWith("iv:encemail");
    });

    it("should use fallback business name when owner not present", () => {
      const mockEmployee = {
        dataValues: {
          firstName: "iv:first",
          lastName: "iv:last",
          email: "iv:email",
        },
      };

      const result = BusinessEmployeeSerializer.serializeInvitation(mockEmployee);

      expect(result.businessName).toBe("Business");
      expect(result.businessOwnerName).toBeNull();
    });
  });

  describe("serializeProfile", () => {
    it("should return null for null input", () => {
      const result = BusinessEmployeeSerializer.serializeProfile(null);
      expect(result).toBeNull();
    });

    it("should serialize profile data with decrypted PII", () => {
      const mockEmployee = {
        dataValues: {
          id: 1,
          firstName: "iv:profilefirst",
          lastName: "iv:profilelast",
          email: "iv:profileemail",
          phone: "iv:profilephone",
          status: "active",
          paymentMethod: "stripe",
          stripeConnectOnboarded: true,
          canViewClientDetails: true,
          canViewJobEarnings: false,
          canMessageClients: true,
        },
        businessOwner: {
          dataValues: {
            id: 10,
            firstName: "iv:ownerfirst",
            lastName: "iv:ownerlast",
            businessName: "ABC Cleaning",
          },
        },
      };

      const result = BusinessEmployeeSerializer.serializeProfile(mockEmployee);

      expect(result.id).toBe(1);
      expect(result.firstName).toBe("decrypted_iv:profilefirst");
      expect(result.lastName).toBe("decrypted_iv:profilelast");
      expect(result.email).toBe("decrypted_iv:profileemail");
      expect(result.phone).toBe("decrypted_iv:profilephone");
      expect(result.status).toBe("active");
      expect(result.paymentMethod).toBe("stripe");
      expect(result.canViewClientDetails).toBe(true);
      expect(result.canViewJobEarnings).toBe(false);
      expect(result.canMessageClients).toBe(true);

      expect(result.businessOwner).toBeDefined();
      expect(result.businessOwner.name).toBe("decrypted_iv:ownerfirst decrypted_iv:ownerlast");
      expect(result.businessOwner.businessName).toBe("ABC Cleaning");
    });

    it("should decrypt PII fields in profile", () => {
      const mockEmployee = {
        dataValues: {
          id: 1,
          firstName: "iv:encfirst",
          lastName: "iv:enclast",
          email: "iv:encemail",
          phone: "iv:encphone",
        },
      };

      const result = BusinessEmployeeSerializer.serializeProfile(mockEmployee);

      expect(EncryptionService.decrypt).toHaveBeenCalledWith("iv:encfirst");
      expect(EncryptionService.decrypt).toHaveBeenCalledWith("iv:enclast");
      expect(EncryptionService.decrypt).toHaveBeenCalledWith("iv:encemail");
      expect(EncryptionService.decrypt).toHaveBeenCalledWith("iv:encphone");
    });

    it("should handle missing business owner", () => {
      const mockEmployee = {
        dataValues: {
          id: 1,
          firstName: "iv:first",
          lastName: "iv:last",
          email: "iv:email",
          phone: "iv:phone",
        },
      };

      const result = BusinessEmployeeSerializer.serializeProfile(mockEmployee);

      expect(result.businessOwner).toBeNull();
    });
  });

  describe("serializeUser", () => {
    it("should return null for null input", () => {
      const result = BusinessEmployeeSerializer.serializeUser(null);
      expect(result).toBeNull();
    });

    it("should serialize user with decrypted fields", () => {
      const mockUser = {
        dataValues: {
          id: 5,
          firstName: "iv:userfirst",
          lastName: "iv:userlast",
          email: "iv:useremail",
          phone: "iv:userphone",
          businessName: "Test Business",
          expoPushToken: "ExponentPushToken[xxx]",
        },
      };

      const result = BusinessEmployeeSerializer.serializeUser(mockUser);

      expect(result.id).toBe(5);
      expect(result.firstName).toBe("decrypted_iv:userfirst");
      expect(result.lastName).toBe("decrypted_iv:userlast");
      expect(result.email).toBe("decrypted_iv:useremail");
      expect(result.phone).toBe("decrypted_iv:userphone");
      expect(result.businessName).toBe("Test Business");
      expect(result.expoPushToken).toBe("ExponentPushToken[xxx]");
    });
  });

  describe("encryptedFields", () => {
    it("should list all PII fields that need decryption", () => {
      const expectedEncryptedFields = ["firstName", "lastName", "email", "phone"];

      expectedEncryptedFields.forEach((field) => {
        expect(BusinessEmployeeSerializer.encryptedFields).toContain(field);
      });
    });
  });
});
