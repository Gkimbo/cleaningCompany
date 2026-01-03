const InvitationService = require("../../services/InvitationService");

// Mock crypto
jest.mock("crypto", () => ({
  randomBytes: jest.fn(() => ({
    toString: jest.fn(() => "a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6"),
  })),
}));

describe("InvitationService", () => {
  let mockModels;
  let mockCleanerClient;
  let mockUser;
  let mockUserHomes;
  let mockUserBills;

  beforeEach(() => {
    jest.clearAllMocks();

    // Create mock instances
    mockCleanerClient = {
      id: 1,
      cleanerId: 100,
      clientId: null,
      homeId: null,
      inviteToken: "abc123def456abc123def456abc12345",
      invitedEmail: "client@example.com",
      invitedName: "John Doe",
      invitedPhone: "555-1234",
      invitedAddress: { address: "123 Main St", city: "Boston", state: "MA", zipcode: "02101" },
      invitedBeds: 3,
      invitedBaths: 2,
      invitedNotes: "Test notes",
      status: "pending_invite",
      invitedAt: new Date(),
      acceptedAt: null,
      defaultFrequency: "weekly",
      defaultPrice: 150,
      defaultTimeWindow: "morning",
      update: jest.fn().mockResolvedValue(true),
      toJSON: jest.fn().mockReturnValue({
        id: 1,
        cleanerId: 100,
        inviteToken: "abc123def456abc123def456abc12345",
        invitedEmail: "client@example.com",
        invitedName: "John Doe",
        status: "pending_invite",
      }),
    };

    mockUser = {
      id: 200,
      firstName: "John",
      lastName: "Doe",
      email: "client@example.com",
      phone: "555-1234",
      type: "homeowner",
    };

    mockUserHomes = {
      id: 1,
      userId: 200,
      nickName: "Home",
      address: "123 Main St",
      city: "Boston",
      state: "MA",
      zipcode: "02101",
    };

    mockUserBills = {
      id: 1,
      usersId: 200,
      appointmentDue: 0,
      cancellationDue: 0,
      totalDue: 0,
    };

    mockModels = {
      CleanerClient: {
        findOne: jest.fn(),
        findAll: jest.fn(),
        create: jest.fn(),
      },
      User: {
        findOne: jest.fn(),
        create: jest.fn(),
      },
      UserHomes: {
        create: jest.fn(),
      },
      UserBills: {
        create: jest.fn(),
      },
    };
  });

  describe("validateInviteToken", () => {
    it("should return null for invalid token format", async () => {
      const result = await InvitationService.validateInviteToken("short", mockModels);
      expect(result).toBeNull();
    });

    it("should return null for null token", async () => {
      const result = await InvitationService.validateInviteToken(null, mockModels);
      expect(result).toBeNull();
    });

    it("should return null when token not found in database", async () => {
      mockModels.CleanerClient.findOne.mockResolvedValue(null);

      const result = await InvitationService.validateInviteToken(
        "abc123def456abc123def456abc12345",
        mockModels
      );

      expect(result).toBeNull();
    });

    it("should return cleanerClient for valid pending invitation", async () => {
      mockModels.CleanerClient.findOne.mockResolvedValue(mockCleanerClient);

      const result = await InvitationService.validateInviteToken(
        "abc123def456abc123def456abc12345",
        mockModels
      );

      expect(result).toEqual(mockCleanerClient);
    });

    it("should return isCancelled flag for cancelled invitations", async () => {
      const cancelledClient = {
        ...mockCleanerClient,
        status: "cancelled",
      };

      mockModels.CleanerClient.findOne.mockResolvedValue(cancelledClient);

      const result = await InvitationService.validateInviteToken(
        "abc123def456abc123def456abc12345",
        mockModels
      );

      expect(result.isCancelled).toBe(true);
    });

    it("should allow cancelled invitations to still be validated", async () => {
      const cancelledClient = {
        ...mockCleanerClient,
        status: "cancelled",
      };

      mockModels.CleanerClient.findOne.mockResolvedValue(cancelledClient);

      const result = await InvitationService.validateInviteToken(
        "abc123def456abc123def456abc12345",
        mockModels
      );

      expect(result).not.toBeNull();
      expect(result.isCancelled).toBe(true);
    });

    it("should return isAlreadyAccepted for active invitations", async () => {
      const activeClient = {
        ...mockCleanerClient,
        status: "active",
        toJSON: jest.fn().mockReturnValue({
          id: 1,
          status: "active",
        }),
      };

      mockModels.CleanerClient.findOne.mockResolvedValue(activeClient);

      const result = await InvitationService.validateInviteToken(
        "abc123def456abc123def456abc12345",
        mockModels
      );

      expect(result.isAlreadyAccepted).toBe(true);
    });

    it("should return isExpired for declined invitations", async () => {
      const declinedClient = {
        ...mockCleanerClient,
        status: "declined",
        toJSON: jest.fn().mockReturnValue({
          id: 1,
          status: "declined",
        }),
      };

      mockModels.CleanerClient.findOne.mockResolvedValue(declinedClient);

      const result = await InvitationService.validateInviteToken(
        "abc123def456abc123def456abc12345",
        mockModels
      );

      expect(result.isExpired).toBe(true);
    });
  });

  describe("acceptInvitation", () => {
    const mockHashPassword = jest.fn().mockResolvedValue("hashed_password");

    beforeEach(() => {
      mockModels.CleanerClient.findOne.mockResolvedValue(mockCleanerClient);
      mockModels.User.findOne.mockResolvedValue(null); // No existing user
      mockModels.User.create.mockResolvedValue(mockUser);
      mockModels.UserHomes.create.mockResolvedValue(mockUserHomes);
      mockModels.UserBills.create.mockResolvedValue(mockUserBills);
    });

    it("should create user and home for valid pending invitation", async () => {
      const result = await InvitationService.acceptInvitation(
        "abc123def456abc123def456abc12345",
        { password: "password123", phone: null, addressCorrections: null },
        mockModels,
        mockHashPassword
      );

      expect(result.user).toEqual(mockUser);
      expect(result.home).toEqual(mockUserHomes);
      expect(mockCleanerClient.update).toHaveBeenCalledWith({
        clientId: mockUser.id,
        homeId: mockUserHomes.id,
        status: "active",
        acceptedAt: expect.any(Date),
      });
    });

    it("should set preferredCleanerId for normal invitations", async () => {
      await InvitationService.acceptInvitation(
        "abc123def456abc123def456abc12345",
        { password: "password123", phone: null, addressCorrections: null },
        mockModels,
        mockHashPassword
      );

      expect(mockModels.UserHomes.create).toHaveBeenCalledWith(
        expect.objectContaining({
          preferredCleanerId: 100, // The cleaner's ID
        })
      );
    });

    it("should NOT set preferredCleanerId for cancelled invitations", async () => {
      const cancelledClientUpdate = jest.fn().mockResolvedValue(true);
      const cancelledClient = {
        ...mockCleanerClient,
        status: "cancelled",
        update: cancelledClientUpdate,
      };

      mockModels.CleanerClient.findOne.mockResolvedValue(cancelledClient);

      await InvitationService.acceptInvitation(
        "abc123def456abc123def456abc12345",
        { password: "password123", phone: null, addressCorrections: null },
        mockModels,
        mockHashPassword
      );

      expect(mockModels.UserHomes.create).toHaveBeenCalledWith(
        expect.objectContaining({
          preferredCleanerId: null, // Should be null for cancelled
        })
      );
    });

    it("should NOT link client to cleaner for cancelled invitations", async () => {
      const cancelledClientUpdate = jest.fn().mockResolvedValue(true);
      const cancelledClient = {
        ...mockCleanerClient,
        status: "cancelled",
        update: cancelledClientUpdate,
      };

      mockModels.CleanerClient.findOne.mockResolvedValue(cancelledClient);

      await InvitationService.acceptInvitation(
        "abc123def456abc123def456abc12345",
        { password: "password123", phone: null, addressCorrections: null },
        mockModels,
        mockHashPassword
      );

      // For cancelled invitations, should only set acceptedAt, not clientId/homeId/status
      expect(cancelledClientUpdate).toHaveBeenCalledWith({
        acceptedAt: expect.any(Date),
      });
    });

    it("should throw error for invalid token", async () => {
      mockModels.CleanerClient.findOne.mockResolvedValue(null);

      await expect(
        InvitationService.acceptInvitation(
          "invalid_token_12345678901234567",
          { password: "password123" },
          mockModels,
          mockHashPassword
        )
      ).rejects.toThrow("Invalid or expired invitation");
    });

    it("should throw error for already accepted invitation", async () => {
      const acceptedClient = {
        ...mockCleanerClient,
        isAlreadyAccepted: true,
      };

      mockModels.CleanerClient.findOne.mockResolvedValue(acceptedClient);

      await expect(
        InvitationService.acceptInvitation(
          "abc123def456abc123def456abc12345",
          { password: "password123" },
          mockModels,
          mockHashPassword
        )
      ).rejects.toThrow("This invitation has already been accepted");
    });

    it("should throw error if user with email already exists", async () => {
      mockModels.User.findOne.mockResolvedValue({ id: 999, email: "client@example.com" });

      await expect(
        InvitationService.acceptInvitation(
          "abc123def456abc123def456abc12345",
          { password: "password123" },
          mockModels,
          mockHashPassword
        )
      ).rejects.toThrow("An account with this email already exists");
    });

    it("should create user as homeowner type", async () => {
      await InvitationService.acceptInvitation(
        "abc123def456abc123def456abc12345",
        { password: "password123" },
        mockModels,
        mockHashPassword
      );

      expect(mockModels.User.create).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "homeowner",
        })
      );
    });

    it("should handle address corrections", async () => {
      const addressCorrections = {
        address: "456 New St",
        city: "New York",
      };

      await InvitationService.acceptInvitation(
        "abc123def456abc123def456abc12345",
        { password: "password123", addressCorrections },
        mockModels,
        mockHashPassword
      );

      expect(mockModels.UserHomes.create).toHaveBeenCalledWith(
        expect.objectContaining({
          address: "456 New St",
          city: "New York",
        })
      );
    });
  });

  describe("createInvitation", () => {
    it("should throw error if invitation already exists for email", async () => {
      mockModels.CleanerClient.findOne.mockResolvedValue({
        id: 1,
        status: "pending_invite",
      });

      await expect(
        InvitationService.createInvitation(
          {
            cleanerId: 100,
            name: "John Doe",
            email: "existing@example.com",
          },
          mockModels
        )
      ).rejects.toThrow("An invitation has already been sent to this email");
    });

    it("should throw error if client is already active", async () => {
      mockModels.CleanerClient.findOne.mockResolvedValue({
        id: 1,
        status: "active",
      });

      await expect(
        InvitationService.createInvitation(
          {
            cleanerId: 100,
            name: "John Doe",
            email: "existing@example.com",
          },
          mockModels
        )
      ).rejects.toThrow("This client is already linked to your account");
    });
  });

  describe("declineInvitation", () => {
    it("should set status to declined for pending invitation", async () => {
      const pendingClient = {
        ...mockCleanerClient,
        status: "pending_invite",
        update: jest.fn().mockResolvedValue(true),
      };

      mockModels.CleanerClient.findOne.mockResolvedValue(pendingClient);

      const result = await InvitationService.declineInvitation(
        "abc123def456abc123def456abc12345",
        mockModels
      );

      expect(result).toBe(true);
      expect(pendingClient.update).toHaveBeenCalledWith({ status: "declined" });
    });

    it("should throw error if invitation not found", async () => {
      mockModels.CleanerClient.findOne.mockResolvedValue(null);

      await expect(
        InvitationService.declineInvitation(
          "invalid_token_12345678901234567",
          mockModels
        )
      ).rejects.toThrow("Invitation not found or already processed");
    });
  });
});

afterAll(async () => {
  jest.clearAllMocks();
});
