const nodemailer = require("nodemailer");

// Mock nodemailer
jest.mock("nodemailer");

// Mock User model for email redirection tests
const mockUserFindOne = jest.fn();
const mockUserFindByPk = jest.fn();

jest.mock("../../models", () => ({
  User: {
    findOne: (...args) => mockUserFindOne(...args),
    findByPk: (...args) => mockUserFindByPk(...args),
  },
}));

// Import the Email class and helpers
const Email = require("../../services/sendNotifications/EmailClass");
const { resolveRecipientEmail, sendMailWithResolution } = require("../../services/sendNotifications/EmailClass");

describe("EmailClass", () => {
  let mockTransporter;
  let mockSendMail;

  beforeEach(() => {
    // Reset mocks before each test
    jest.clearAllMocks();

    // Create mock sendMail function
    mockSendMail = jest.fn().mockResolvedValue({
      response: "250 OK",
      messageId: "test-message-id",
    });

    // Create mock transporter
    mockTransporter = {
      sendMail: mockSendMail,
    };

    // Mock createTransport to return our mock transporter
    nodemailer.createTransport.mockReturnValue(mockTransporter);

    // Set environment variables
    process.env.EMAIL_USER = "test@kleanr.com";
    process.env.EMAIL_PASS = "testpassword";

    // Reset User model mocks (default: no demo account found)
    mockUserFindOne.mockResolvedValue(null);
    mockUserFindByPk.mockResolvedValue(null);
  });

  afterEach(() => {
    delete process.env.EMAIL_USER;
    delete process.env.EMAIL_PASS;
  });

  describe("Transporter Configuration", () => {
    it("should create transporter with correct Gmail SMTP settings", async () => {
      await Email.sendEmailConfirmation(
        "user@example.com",
        { street: "123 Main St", city: "Boston", state: "MA", zipcode: "02101" },
        "John",
        "2025-01-15"
      );

      expect(nodemailer.createTransport).toHaveBeenCalledWith({
        host: "smtp.gmail.com",
        port: 587,
        secure: false,
        auth: {
          user: "test@kleanr.com",
          pass: "testpassword",
        },
      });
    });
  });

  describe("sendEmailCancellation", () => {
    const testAddress = {
      street: "123 Main St",
      city: "Boston",
      state: "MA",
      zipcode: "02101",
    };

    it("should send cancellation email with correct recipient", async () => {
      await Email.sendEmailCancellation(
        "user@example.com",
        testAddress,
        "John",
        "2025-01-15"
      );

      expect(mockSendMail).toHaveBeenCalledTimes(1);
      const mailOptions = mockSendMail.mock.calls[0][0];
      expect(mailOptions.to).toBe("user@example.com");
    });

    it("should include cancellation subject with date", async () => {
      await Email.sendEmailCancellation(
        "user@example.com",
        testAddress,
        "John",
        "2025-01-15"
      );

      const mailOptions = mockSendMail.mock.calls[0][0];
      expect(mailOptions.subject).toContain("Cancelled");
    });

    it("should include user name in greeting", async () => {
      await Email.sendEmailCancellation(
        "user@example.com",
        testAddress,
        "John",
        "2025-01-15"
      );

      const mailOptions = mockSendMail.mock.calls[0][0];
      expect(mailOptions.html).toContain("Hi John");
      expect(mailOptions.text).toContain("Hi John");
    });

    it("should include full address in email content", async () => {
      await Email.sendEmailCancellation(
        "user@example.com",
        testAddress,
        "John",
        "2025-01-15"
      );

      const mailOptions = mockSendMail.mock.calls[0][0];
      expect(mailOptions.html).toContain("123 Main St");
      expect(mailOptions.html).toContain("Boston");
      expect(mailOptions.html).toContain("MA");
      expect(mailOptions.html).toContain("02101");
    });

    it("should include both HTML and plain text versions", async () => {
      await Email.sendEmailCancellation(
        "user@example.com",
        testAddress,
        "John",
        "2025-01-15"
      );

      const mailOptions = mockSendMail.mock.calls[0][0];
      expect(mailOptions.html).toBeDefined();
      expect(mailOptions.text).toBeDefined();
      expect(mailOptions.html).toContain("<!DOCTYPE html>");
    });

    it("should return response on success", async () => {
      const result = await Email.sendEmailCancellation(
        "user@example.com",
        testAddress,
        "John",
        "2025-01-15"
      );

      expect(result).toBe("250 OK");
    });

    it("should handle errors gracefully", async () => {
      mockSendMail.mockRejectedValueOnce(new Error("SMTP error"));

      const consoleSpy = jest.spyOn(console, "error").mockImplementation();

      const result = await Email.sendEmailCancellation(
        "user@example.com",
        testAddress,
        "John",
        "2025-01-15"
      );

      expect(consoleSpy).toHaveBeenCalled();
      expect(result).toBeUndefined();

      consoleSpy.mockRestore();
    });
  });

  describe("sendEmailConfirmation", () => {
    const testAddress = {
      street: "456 Oak Ave",
      city: "Cambridge",
      state: "MA",
      zipcode: "02139",
    };

    it("should send confirmation email with correct recipient", async () => {
      await Email.sendEmailConfirmation(
        "user@example.com",
        testAddress,
        "Sarah",
        "2025-02-20"
      );

      expect(mockSendMail).toHaveBeenCalledTimes(1);
      const mailOptions = mockSendMail.mock.calls[0][0];
      expect(mailOptions.to).toBe("user@example.com");
    });

    it("should include confirmation subject with checkmark", async () => {
      await Email.sendEmailConfirmation(
        "user@example.com",
        testAddress,
        "Sarah",
        "2025-02-20"
      );

      const mailOptions = mockSendMail.mock.calls[0][0];
      expect(mailOptions.subject).toContain("Confirmed");
    });

    it("should include confirmed status in info box", async () => {
      await Email.sendEmailConfirmation(
        "user@example.com",
        testAddress,
        "Sarah",
        "2025-02-20"
      );

      const mailOptions = mockSendMail.mock.calls[0][0];
      expect(mailOptions.html).toContain("Confirmed");
      expect(mailOptions.text).toContain("Confirmed");
    });

    it("should include next steps in email", async () => {
      await Email.sendEmailConfirmation(
        "user@example.com",
        testAddress,
        "Sarah",
        "2025-02-20"
      );

      const mailOptions = mockSendMail.mock.calls[0][0];
      expect(mailOptions.html).toContain("accessible");
      expect(mailOptions.text).toContain("accessible");
    });
  });

  describe("sendEmailCongragulations", () => {
    it("should send welcome email to new employee", async () => {
      await Email.sendEmailCongragulations(
        "John",
        "Doe",
        "johnd",
        "Password123",
        "john@example.com",
        "cleaner"
      );

      expect(mockSendMail).toHaveBeenCalledTimes(1);
      const mailOptions = mockSendMail.mock.calls[0][0];
      expect(mailOptions.to).toBe("john@example.com");
    });

    it("should include username and password in email", async () => {
      await Email.sendEmailCongragulations(
        "John",
        "Doe",
        "johnd",
        "Password123",
        "john@example.com",
        "cleaner"
      );

      const mailOptions = mockSendMail.mock.calls[0][0];
      expect(mailOptions.html).toContain("johnd");
      expect(mailOptions.html).toContain("Password123");
      expect(mailOptions.text).toContain("johnd");
      expect(mailOptions.text).toContain("Password123");
    });

    it("should include employee full name", async () => {
      await Email.sendEmailCongragulations(
        "Jane",
        "Smith",
        "janes",
        "Pass456",
        "jane@example.com",
        "cleaner"
      );

      const mailOptions = mockSendMail.mock.calls[0][0];
      expect(mailOptions.html).toContain("Jane Smith");
      expect(mailOptions.subject).toContain("Jane");
    });

    it("should show correct role title for cleaner", async () => {
      await Email.sendEmailCongragulations(
        "John",
        "Doe",
        "johnd",
        "Password123",
        "john@example.com",
        "cleaner"
      );

      const mailOptions = mockSendMail.mock.calls[0][0];
      expect(mailOptions.html).toContain("Cleaner");
    });

    it("should show correct role title for owner", async () => {
      await Email.sendEmailCongragulations(
        "Admin",
        "User",
        "admin1",
        "AdminPass",
        "admin@example.com",
        "owner"
      );

      const mailOptions = mockSendMail.mock.calls[0][0];
      expect(mailOptions.html).toContain("Owner");
    });

    it("should include security warning", async () => {
      await Email.sendEmailCongragulations(
        "John",
        "Doe",
        "johnd",
        "Password123",
        "john@example.com",
        "cleaner"
      );

      const mailOptions = mockSendMail.mock.calls[0][0];
      expect(mailOptions.html).toContain("Security");
      expect(mailOptions.html).toContain("change your password");
    });

    it("should include login instructions", async () => {
      await Email.sendEmailCongragulations(
        "John",
        "Doe",
        "johnd",
        "Password123",
        "john@example.com",
        "cleaner"
      );

      const mailOptions = mockSendMail.mock.calls[0][0];
      expect(mailOptions.html).toContain("How to Log In");
      expect(mailOptions.text).toContain("HOW TO LOG IN");
    });
  });

  describe("sendEmployeeRequest", () => {
    it("should send request email with cleaner details", async () => {
      await Email.sendEmployeeRequest(
        "homeowner@example.com",
        "HomeOwner",
        "Mike the Cleaner",
        "4.8",
        "2025-03-10"
      );

      expect(mockSendMail).toHaveBeenCalledTimes(1);
      const mailOptions = mockSendMail.mock.calls[0][0];
      expect(mailOptions.to).toBe("homeowner@example.com");
      expect(mailOptions.html).toContain("Mike the Cleaner");
      expect(mailOptions.html).toContain("4.8");
    });

    it("should handle 'No ratings yet' rating", async () => {
      await Email.sendEmployeeRequest(
        "homeowner@example.com",
        "HomeOwner",
        "New Cleaner",
        "No ratings yet",
        "2025-03-10"
      );

      const mailOptions = mockSendMail.mock.calls[0][0];
      expect(mailOptions.html).toContain("New Cleaner");
    });

    it("should include cleaner name in subject", async () => {
      await Email.sendEmployeeRequest(
        "homeowner@example.com",
        "HomeOwner",
        "Mike the Cleaner",
        "4.8",
        "2025-03-10"
      );

      const mailOptions = mockSendMail.mock.calls[0][0];
      expect(mailOptions.subject).toContain("Mike the Cleaner");
    });
  });

  describe("removeRequestEmail", () => {
    it("should send request withdrawal notification", async () => {
      await Email.removeRequestEmail(
        "homeowner@example.com",
        "HomeOwner",
        "2025-03-15"
      );

      expect(mockSendMail).toHaveBeenCalledTimes(1);
      const mailOptions = mockSendMail.mock.calls[0][0];
      expect(mailOptions.to).toBe("homeowner@example.com");
      expect(mailOptions.html).toContain("withdrawn");
    });

    it("should mention no action required", async () => {
      await Email.removeRequestEmail(
        "homeowner@example.com",
        "HomeOwner",
        "2025-03-15"
      );

      const mailOptions = mockSendMail.mock.calls[0][0];
      expect(mailOptions.html).toContain("action");
    });
  });

  describe("sendNewMessageNotification", () => {
    it("should send message notification email", async () => {
      await Email.sendNewMessageNotification(
        "user@example.com",
        "John",
        "Sarah",
        "Hello, I wanted to discuss the appointment"
      );

      expect(mockSendMail).toHaveBeenCalledTimes(1);
      const mailOptions = mockSendMail.mock.calls[0][0];
      expect(mailOptions.to).toBe("user@example.com");
      expect(mailOptions.subject).toContain("Sarah");
    });

    it("should truncate long messages", async () => {
      const longMessage = "A".repeat(150);

      await Email.sendNewMessageNotification(
        "user@example.com",
        "John",
        "Sarah",
        longMessage
      );

      const mailOptions = mockSendMail.mock.calls[0][0];
      expect(mailOptions.html).toContain("...");
    });

    it("should not truncate short messages", async () => {
      const shortMessage = "Short message";

      await Email.sendNewMessageNotification(
        "user@example.com",
        "John",
        "Sarah",
        shortMessage
      );

      const mailOptions = mockSendMail.mock.calls[0][0];
      expect(mailOptions.html).toContain("Short message");
      expect(mailOptions.html).not.toMatch(/Short message\.\.\./);
    });
  });

  describe("sendBroadcastNotification", () => {
    it("should send broadcast email with custom title", async () => {
      await Email.sendBroadcastNotification(
        "user@example.com",
        "John",
        "Important Update",
        "We have exciting news to share!"
      );

      expect(mockSendMail).toHaveBeenCalledTimes(1);
      const mailOptions = mockSendMail.mock.calls[0][0];
      expect(mailOptions.subject).toContain("Important Update");
      expect(mailOptions.html).toContain("Important Update");
    });

    it("should include broadcast content in body", async () => {
      await Email.sendBroadcastNotification(
        "user@example.com",
        "John",
        "Holiday Schedule",
        "We will be closed on Christmas Day"
      );

      const mailOptions = mockSendMail.mock.calls[0][0];
      expect(mailOptions.html).toContain("closed on Christmas Day");
      expect(mailOptions.text).toContain("closed on Christmas Day");
    });
  });

  describe("sendUsernameRecovery", () => {
    it("should send username recovery email", async () => {
      await Email.sendUsernameRecovery("user@example.com", "johnd123");

      expect(mockSendMail).toHaveBeenCalledTimes(1);
      const mailOptions = mockSendMail.mock.calls[0][0];
      expect(mailOptions.to).toBe("user@example.com");
      expect(mailOptions.html).toContain("johnd123");
      expect(mailOptions.text).toContain("johnd123");
    });

    it("should include security notice", async () => {
      await Email.sendUsernameRecovery("user@example.com", "johnd123");

      const mailOptions = mockSendMail.mock.calls[0][0];
      expect(mailOptions.html).toContain("did not request");
    });

    it("should throw error on failure", async () => {
      mockSendMail.mockRejectedValueOnce(new Error("SMTP error"));

      await expect(
        Email.sendUsernameRecovery("user@example.com", "johnd123")
      ).rejects.toThrow("SMTP error");
    });
  });

  describe("sendPasswordReset", () => {
    it("should send password reset email with temporary password", async () => {
      await Email.sendPasswordReset(
        "user@example.com",
        "johnd",
        "TempPass123!"
      );

      expect(mockSendMail).toHaveBeenCalledTimes(1);
      const mailOptions = mockSendMail.mock.calls[0][0];
      expect(mailOptions.to).toBe("user@example.com");
      expect(mailOptions.html).toContain("TempPass123!");
      expect(mailOptions.text).toContain("TempPass123!");
    });

    it("should include security instructions", async () => {
      await Email.sendPasswordReset(
        "user@example.com",
        "johnd",
        "TempPass123!"
      );

      const mailOptions = mockSendMail.mock.calls[0][0];
      expect(mailOptions.html).toContain("change");
      expect(mailOptions.html).toContain("Account Settings");
    });

    it("should throw error on failure", async () => {
      mockSendMail.mockRejectedValueOnce(new Error("SMTP error"));

      await expect(
        Email.sendPasswordReset("user@example.com", "johnd", "TempPass123!")
      ).rejects.toThrow("SMTP error");
    });
  });

  describe("sendRequestApproved", () => {
    const testAddress = {
      street: "789 Elm St",
      city: "Newton",
      state: "MA",
      zipcode: "02458",
    };

    it("should send approval email to cleaner", async () => {
      await Email.sendRequestApproved(
        "cleaner@example.com",
        "Mike",
        "John Smith",
        testAddress,
        "2025-04-01"
      );

      expect(mockSendMail).toHaveBeenCalledTimes(1);
      const mailOptions = mockSendMail.mock.calls[0][0];
      expect(mailOptions.to).toBe("cleaner@example.com");
      expect(mailOptions.html).toContain("Mike");
      expect(mailOptions.html).toContain("John Smith");
    });

    it("should include appointment details with city/state/zip only (no street address)", async () => {
      await Email.sendRequestApproved(
        "cleaner@example.com",
        "Mike",
        "John Smith",
        testAddress,
        "2025-04-01"
      );

      const mailOptions = mockSendMail.mock.calls[0][0];
      // Should NOT contain street address for privacy
      expect(mailOptions.html).not.toContain("789 Elm St");
      // Should contain city, state, zip
      expect(mailOptions.html).toContain("Newton");
      expect(mailOptions.html).toContain("MA");
      expect(mailOptions.html).toContain("02458");
      expect(mailOptions.html).toContain("Approved");
    });

    it("should include preparation steps", async () => {
      await Email.sendRequestApproved(
        "cleaner@example.com",
        "Mike",
        "John Smith",
        testAddress,
        "2025-04-01"
      );

      const mailOptions = mockSendMail.mock.calls[0][0];
      expect(mailOptions.html).toContain("supplies");
    });

    it("should show linens provided message when cleaner does not need to bring linens", async () => {
      const linensConfig = {
        bringSheets: "no",
        bringTowels: "no",
        sheetConfigurations: [],
        towelConfigurations: [],
      };

      await Email.sendRequestApproved(
        "cleaner@example.com",
        "Mike",
        "John Smith",
        testAddress,
        "2025-04-01",
        linensConfig
      );

      const mailOptions = mockSendMail.mock.calls[0][0];
      expect(mailOptions.html).toContain("Linens Provided");
      expect(mailOptions.html).toContain("provided at the home");
      expect(mailOptions.text).toContain("LINENS PROVIDED");
    });

    it("should show sheets details when cleaner needs to bring sheets", async () => {
      const linensConfig = {
        bringSheets: "yes",
        bringTowels: "no",
        sheetConfigurations: [
          { bedNumber: 1, size: "queen", needsSheets: true },
          { bedNumber: 2, size: "twin", needsSheets: true },
        ],
        towelConfigurations: [],
      };

      await Email.sendRequestApproved(
        "cleaner@example.com",
        "Mike",
        "John Smith",
        testAddress,
        "2025-04-01",
        linensConfig
      );

      const mailOptions = mockSendMail.mock.calls[0][0];
      expect(mailOptions.html).toContain("Linens You Need to Bring");
      expect(mailOptions.html).toContain("Bed 1");
      expect(mailOptions.html).toContain("Queen sheets");
      expect(mailOptions.html).toContain("Bed 2");
      expect(mailOptions.html).toContain("Twin sheets");
      expect(mailOptions.text).toContain("SHEETS:");
      expect(mailOptions.text).toContain("Bed 1: Queen sheets");
    });

    it("should show towels details when cleaner needs to bring towels", async () => {
      const linensConfig = {
        bringSheets: "no",
        bringTowels: "yes",
        sheetConfigurations: [],
        towelConfigurations: [
          { bathroomNumber: 1, towels: 2, faceCloths: 2 },
          { bathroomNumber: 2, towels: 1, faceCloths: 1 },
        ],
      };

      await Email.sendRequestApproved(
        "cleaner@example.com",
        "Mike",
        "John Smith",
        testAddress,
        "2025-04-01",
        linensConfig
      );

      const mailOptions = mockSendMail.mock.calls[0][0];
      expect(mailOptions.html).toContain("Linens You Need to Bring");
      expect(mailOptions.html).toContain("Bathroom 1");
      expect(mailOptions.html).toContain("2 towels");
      expect(mailOptions.html).toContain("2 washcloths");
      expect(mailOptions.html).toContain("Total: 3 towels, 3 washcloths");
      expect(mailOptions.text).toContain("TOWELS:");
    });

    it("should show both sheets and towels when cleaner needs to bring both", async () => {
      const linensConfig = {
        bringSheets: "yes",
        bringTowels: "yes",
        sheetConfigurations: [
          { bedNumber: 1, size: "king", needsSheets: true },
        ],
        towelConfigurations: [
          { bathroomNumber: 1, towels: 3, faceCloths: 2 },
        ],
      };

      await Email.sendRequestApproved(
        "cleaner@example.com",
        "Mike",
        "John Smith",
        testAddress,
        "2025-04-01",
        linensConfig
      );

      const mailOptions = mockSendMail.mock.calls[0][0];
      expect(mailOptions.html).toContain("Sheets:");
      expect(mailOptions.html).toContain("Towels:");
      expect(mailOptions.html).toContain("King sheets");
      expect(mailOptions.html).toContain("3 towels");
    });

    it("should work without linens config (backwards compatibility)", async () => {
      await Email.sendRequestApproved(
        "cleaner@example.com",
        "Mike",
        "John Smith",
        testAddress,
        "2025-04-01"
      );

      const mailOptions = mockSendMail.mock.calls[0][0];
      expect(mailOptions.html).toContain("Linens Provided");
    });

    it("should filter out beds that don't need sheets", async () => {
      const linensConfig = {
        bringSheets: "yes",
        bringTowels: "no",
        sheetConfigurations: [
          { bedNumber: 1, size: "queen", needsSheets: true },
          { bedNumber: 2, size: "twin", needsSheets: false },
        ],
        towelConfigurations: [],
      };

      await Email.sendRequestApproved(
        "cleaner@example.com",
        "Mike",
        "John Smith",
        testAddress,
        "2025-04-01",
        linensConfig
      );

      const mailOptions = mockSendMail.mock.calls[0][0];
      expect(mailOptions.html).toContain("Bed 1");
      expect(mailOptions.html).not.toContain("Bed 2");
    });
  });

  describe("sendLinensConfigurationUpdated", () => {
    it("should send linens update email with correct details", async () => {
      const linensConfig = {
        bringSheets: "yes",
        bringTowels: "yes",
        sheetConfigurations: [
          { bedNumber: 1, size: "queen", needsSheets: true },
        ],
        towelConfigurations: [
          { bathroomNumber: 1, towels: 2, faceCloths: 2 },
        ],
      };

      await Email.sendLinensConfigurationUpdated(
        "cleaner@example.com",
        "Mike",
        "John Smith",
        "2025-04-15",
        135.00,
        linensConfig
      );

      expect(mockSendMail).toHaveBeenCalledTimes(1);
      const mailOptions = mockSendMail.mock.calls[0][0];
      expect(mailOptions.to).toBe("cleaner@example.com");
      expect(mailOptions.subject).toContain("Linens changed");
      expect(mailOptions.html).toContain("Mike");
      expect(mailOptions.html).toContain("John Smith");
    });

    it("should show updated payout amount", async () => {
      const linensConfig = {
        bringSheets: "no",
        bringTowels: "no",
        sheetConfigurations: [],
        towelConfigurations: [],
      };

      await Email.sendLinensConfigurationUpdated(
        "cleaner@example.com",
        "Mike",
        "John Smith",
        "2025-04-15",
        157.50,
        linensConfig
      );

      const mailOptions = mockSendMail.mock.calls[0][0];
      expect(mailOptions.html).toContain("$157.50");
      expect(mailOptions.text).toContain("$157.50");
    });

    it("should show linens no longer needed when changed to provided", async () => {
      const linensConfig = {
        bringSheets: "no",
        bringTowels: "no",
        sheetConfigurations: [],
        towelConfigurations: [],
      };

      await Email.sendLinensConfigurationUpdated(
        "cleaner@example.com",
        "Mike",
        "John Smith",
        "2025-04-15",
        135.00,
        linensConfig
      );

      const mailOptions = mockSendMail.mock.calls[0][0];
      expect(mailOptions.html).toContain("provided at the home");
      expect(mailOptions.html).toContain("you don't need to bring any");
    });

    it("should show updated linens requirements when sheets are needed", async () => {
      const linensConfig = {
        bringSheets: "yes",
        bringTowels: "no",
        sheetConfigurations: [
          { bedNumber: 1, size: "full", needsSheets: true },
          { bedNumber: 2, size: "queen", needsSheets: true },
        ],
        towelConfigurations: [],
      };

      await Email.sendLinensConfigurationUpdated(
        "cleaner@example.com",
        "Mike",
        "John Smith",
        "2025-04-15",
        120.00,
        linensConfig
      );

      const mailOptions = mockSendMail.mock.calls[0][0];
      expect(mailOptions.html).toContain("Updated Linens Requirements");
      expect(mailOptions.html).toContain("Bed 1");
      expect(mailOptions.html).toContain("Full sheets");
      expect(mailOptions.html).toContain("Bed 2");
      expect(mailOptions.html).toContain("Queen sheets");
    });

    it("should show updated towel requirements with totals", async () => {
      const linensConfig = {
        bringSheets: "no",
        bringTowels: "yes",
        sheetConfigurations: [],
        towelConfigurations: [
          { bathroomNumber: 1, towels: 3, faceCloths: 2 },
          { bathroomNumber: 2, towels: 2, faceCloths: 1 },
        ],
      };

      await Email.sendLinensConfigurationUpdated(
        "cleaner@example.com",
        "Mike",
        "John Smith",
        "2025-04-15",
        125.00,
        linensConfig
      );

      const mailOptions = mockSendMail.mock.calls[0][0];
      expect(mailOptions.html).toContain("Bathroom 1: 3 towels, 2 washcloths");
      expect(mailOptions.html).toContain("Bathroom 2: 2 towels, 1 washcloth");
      expect(mailOptions.html).toContain("Total: 5 towels, 3 washcloths");
    });

    it("should confirm appointment is still confirmed", async () => {
      const linensConfig = {
        bringSheets: "no",
        bringTowels: "no",
        sheetConfigurations: [],
        towelConfigurations: [],
      };

      await Email.sendLinensConfigurationUpdated(
        "cleaner@example.com",
        "Mike",
        "John Smith",
        "2025-04-15",
        135.00,
        linensConfig
      );

      const mailOptions = mockSendMail.mock.calls[0][0];
      expect(mailOptions.html).toContain("Still Confirmed");
      expect(mailOptions.text).toContain("Still Confirmed");
    });

    it("should handle string payout values", async () => {
      const linensConfig = {
        bringSheets: "no",
        bringTowels: "no",
        sheetConfigurations: [],
        towelConfigurations: [],
      };

      await Email.sendLinensConfigurationUpdated(
        "cleaner@example.com",
        "Mike",
        "John Smith",
        "2025-04-15",
        "$142.50",
        linensConfig
      );

      const mailOptions = mockSendMail.mock.calls[0][0];
      expect(mailOptions.html).toContain("$142.50");
    });

    it("should include text version for plain text email clients", async () => {
      const linensConfig = {
        bringSheets: "yes",
        bringTowels: "no",
        sheetConfigurations: [
          { bedNumber: 1, size: "king", needsSheets: true },
        ],
        towelConfigurations: [],
      };

      await Email.sendLinensConfigurationUpdated(
        "cleaner@example.com",
        "Mike",
        "John Smith",
        "2025-04-15",
        135.00,
        linensConfig
      );

      const mailOptions = mockSendMail.mock.calls[0][0];
      expect(mailOptions.text).toContain("UPDATED LINENS REQUIREMENTS");
      expect(mailOptions.text).toContain("SHEETS:");
      expect(mailOptions.text).toContain("Bed 1: King sheets");
    });
  });

  describe("sendRequestDenied", () => {
    it("should send denial email with encouragement", async () => {
      await Email.sendRequestDenied(
        "cleaner@example.com",
        "Mike",
        "2025-04-01"
      );

      expect(mockSendMail).toHaveBeenCalledTimes(1);
      const mailOptions = mockSendMail.mock.calls[0][0];
      expect(mailOptions.to).toBe("cleaner@example.com");
      expect(mailOptions.html).toContain("Mike");
      expect(mailOptions.html).toContain("not approved");
    });

    it("should include encouragement message", async () => {
      await Email.sendRequestDenied(
        "cleaner@example.com",
        "Mike",
        "2025-04-01"
      );

      const mailOptions = mockSendMail.mock.calls[0][0];
      expect(mailOptions.html).toContain("Keep going");
      expect(mailOptions.html).toContain("opportunities");
    });

    it("should include next steps to find jobs", async () => {
      await Email.sendRequestDenied(
        "cleaner@example.com",
        "Mike",
        "2025-04-01"
      );

      const mailOptions = mockSendMail.mock.calls[0][0];
      expect(mailOptions.html).toContain("Browse");
    });
  });

  describe("sendHomeNowInServiceArea", () => {
    it("should send service area notification", async () => {
      await Email.sendHomeNowInServiceArea(
        "user@example.com",
        "John",
        "My Home",
        "123 Main St, Boston, MA"
      );

      expect(mockSendMail).toHaveBeenCalledTimes(1);
      const mailOptions = mockSendMail.mock.calls[0][0];
      expect(mailOptions.to).toBe("user@example.com");
      expect(mailOptions.subject).toContain("My Home");
      expect(mailOptions.html).toContain("In Service Area");
    });

    it("should include getting started steps", async () => {
      await Email.sendHomeNowInServiceArea(
        "user@example.com",
        "John",
        "My Home",
        "123 Main St, Boston, MA"
      );

      const mailOptions = mockSendMail.mock.calls[0][0];
      expect(mailOptions.html).toContain("Schedule");
    });
  });

  describe("sendHomeNowOutsideServiceArea", () => {
    it("should send outside service area notification", async () => {
      await Email.sendHomeNowOutsideServiceArea(
        "user@example.com",
        "John",
        "Beach House",
        "999 Ocean Dr, Miami, FL"
      );

      expect(mockSendMail).toHaveBeenCalledTimes(1);
      const mailOptions = mockSendMail.mock.calls[0][0];
      expect(mailOptions.to).toBe("user@example.com");
      expect(mailOptions.subject).toContain("Beach House");
      expect(mailOptions.html).toContain("Outside Service Area");
    });

    it("should assure confirmed appointments will be honored", async () => {
      await Email.sendHomeNowOutsideServiceArea(
        "user@example.com",
        "John",
        "Beach House",
        "999 Ocean Dr, Miami, FL"
      );

      const mailOptions = mockSendMail.mock.calls[0][0];
      expect(mailOptions.html).toContain("honored");
    });
  });

  describe("sendNewApplicationNotification", () => {
    it("should send application notification to owner", async () => {
      await Email.sendNewApplicationNotification(
        "owner@example.com",
        "Jane Doe",
        "jane@applicant.com",
        "3 years professional cleaning"
      );

      expect(mockSendMail).toHaveBeenCalledTimes(1);
      const mailOptions = mockSendMail.mock.calls[0][0];
      expect(mailOptions.to).toBe("owner@example.com");
      expect(mailOptions.subject).toContain("Jane Doe");
      expect(mailOptions.html).toContain("Jane Doe");
      expect(mailOptions.html).toContain("jane@applicant.com");
    });

    it("should include experience in email", async () => {
      await Email.sendNewApplicationNotification(
        "owner@example.com",
        "Jane Doe",
        "jane@applicant.com",
        "5 years hotel housekeeping"
      );

      const mailOptions = mockSendMail.mock.calls[0][0];
      expect(mailOptions.html).toContain("5 years hotel housekeeping");
    });

    it("should handle missing experience", async () => {
      await Email.sendNewApplicationNotification(
        "owner@example.com",
        "Jane Doe",
        "jane@applicant.com",
        null
      );

      const mailOptions = mockSendMail.mock.calls[0][0];
      expect(mailOptions.html).toContain("Not specified");
    });

    it("should include next steps for owner", async () => {
      await Email.sendNewApplicationNotification(
        "owner@example.com",
        "Jane Doe",
        "jane@applicant.com",
        "3 years"
      );

      const mailOptions = mockSendMail.mock.calls[0][0];
      expect(mailOptions.html).toContain("dashboard");
      expect(mailOptions.html).toContain("Applications");
    });
  });

  describe("sendEmailCongragulations for HR", () => {
    it("should show correct role title for HR staff", async () => {
      await Email.sendEmailCongragulations(
        "Jane",
        "Smith",
        "janes_hr",
        "HRPass123!",
        "jane.hr@example.com",
        "humanResources"
      );

      const mailOptions = mockSendMail.mock.calls[0][0];
      expect(mailOptions.html).toContain("HR Team Member");
    });

    it("should include HR-specific subtitle", async () => {
      await Email.sendEmailCongragulations(
        "Jane",
        "Smith",
        "janes_hr",
        "HRPass123!",
        "jane.hr@example.com",
        "humanResources"
      );

      const mailOptions = mockSendMail.mock.calls[0][0];
      expect(mailOptions.html).toContain("hired to join our HR team");
    });

    it("should include HR-specific login instructions", async () => {
      await Email.sendEmailCongragulations(
        "Jane",
        "Smith",
        "janes_hr",
        "HRPass123!",
        "jane.hr@example.com",
        "humanResources"
      );

      const mailOptions = mockSendMail.mock.calls[0][0];
      expect(mailOptions.html).toContain("HR Dashboard");
      expect(mailOptions.text).toContain("HR Dashboard");
    });

    it("should include congratulations message", async () => {
      await Email.sendEmailCongragulations(
        "Jane",
        "Smith",
        "janes_hr",
        "HRPass123!",
        "jane.hr@example.com",
        "humanResources"
      );

      const mailOptions = mockSendMail.mock.calls[0][0];
      expect(mailOptions.html).toContain("Congratulations");
      expect(mailOptions.subject).toContain("Congratulations");
    });
  });

  describe("sendApplicationRejected", () => {
    it("should send rejection email to applicant", async () => {
      await Email.sendApplicationRejected(
        "applicant@example.com",
        "John",
        "Doe",
        "Insufficient experience"
      );

      expect(mockSendMail).toHaveBeenCalledTimes(1);
      const mailOptions = mockSendMail.mock.calls[0][0];
      expect(mailOptions.to).toBe("applicant@example.com");
    });

    it("should include applicant name in greeting", async () => {
      await Email.sendApplicationRejected(
        "applicant@example.com",
        "John",
        "Doe",
        null
      );

      const mailOptions = mockSendMail.mock.calls[0][0];
      expect(mailOptions.html).toContain("John Doe");
      expect(mailOptions.text).toContain("John Doe");
    });

    it("should include rejection reason when provided", async () => {
      await Email.sendApplicationRejected(
        "applicant@example.com",
        "John",
        "Doe",
        "Background check did not pass"
      );

      const mailOptions = mockSendMail.mock.calls[0][0];
      expect(mailOptions.html).toContain("Background check did not pass");
      expect(mailOptions.text).toContain("Background check did not pass");
    });

    it("should work without rejection reason", async () => {
      await Email.sendApplicationRejected(
        "applicant@example.com",
        "John",
        "Doe",
        null
      );

      const mailOptions = mockSendMail.mock.calls[0][0];
      expect(mailOptions.html).not.toContain("Feedback:");
    });

    it("should include encouraging message", async () => {
      await Email.sendApplicationRejected(
        "applicant@example.com",
        "John",
        "Doe",
        null
      );

      const mailOptions = mockSendMail.mock.calls[0][0];
      expect(mailOptions.html).toContain("reapply");
      expect(mailOptions.text).toContain("reapply");
    });

    it("should include polite decline message", async () => {
      await Email.sendApplicationRejected(
        "applicant@example.com",
        "John",
        "Doe",
        null
      );

      const mailOptions = mockSendMail.mock.calls[0][0];
      expect(mailOptions.html).toContain("decided");
      expect(mailOptions.text).toContain("decided");
    });

    it("should use appropriate subject line", async () => {
      await Email.sendApplicationRejected(
        "applicant@example.com",
        "John",
        "Doe",
        null
      );

      const mailOptions = mockSendMail.mock.calls[0][0];
      expect(mailOptions.subject).toBe("Application Update - Kleanr");
    });

    it("should handle first name only", async () => {
      await Email.sendApplicationRejected(
        "applicant@example.com",
        "John",
        "",
        null
      );

      const mailOptions = mockSendMail.mock.calls[0][0];
      expect(mailOptions.html).toContain("John");
    });

    it("should handle errors gracefully", async () => {
      mockSendMail.mockRejectedValueOnce(new Error("SMTP error"));

      const consoleSpy = jest.spyOn(console, "error").mockImplementation();

      const result = await Email.sendApplicationRejected(
        "applicant@example.com",
        "John",
        "Doe",
        null
      );

      expect(consoleSpy).toHaveBeenCalled();
      expect(result).toBeUndefined();

      consoleSpy.mockRestore();
    });
  });

  describe("sendHRHiringNotification", () => {
    it("should send approval notification to owner", async () => {
      await Email.sendHRHiringNotification(
        "owner@example.com",
        "Jane HR",
        "John Doe",
        "john@applicant.com",
        "approved"
      );

      expect(mockSendMail).toHaveBeenCalledTimes(1);
      const mailOptions = mockSendMail.mock.calls[0][0];
      expect(mailOptions.to).toBe("owner@example.com");
    });

    it("should include HR name in content for approval", async () => {
      await Email.sendHRHiringNotification(
        "owner@example.com",
        "Jane HR",
        "John Doe",
        "john@applicant.com",
        "approved"
      );

      const mailOptions = mockSendMail.mock.calls[0][0];
      expect(mailOptions.html).toContain("Jane HR");
      expect(mailOptions.text).toContain("Jane HR");
    });

    it("should include applicant details for approval", async () => {
      await Email.sendHRHiringNotification(
        "owner@example.com",
        "Jane HR",
        "John Doe",
        "john@applicant.com",
        "approved"
      );

      const mailOptions = mockSendMail.mock.calls[0][0];
      expect(mailOptions.html).toContain("John Doe");
      expect(mailOptions.html).toContain("john@applicant.com");
    });

    it("should indicate account was created for approval", async () => {
      await Email.sendHRHiringNotification(
        "owner@example.com",
        "Jane HR",
        "John Doe",
        "john@applicant.com",
        "approved"
      );

      const mailOptions = mockSendMail.mock.calls[0][0];
      expect(mailOptions.html).toContain("Account Created");
    });

    it("should use green color scheme for approval", async () => {
      await Email.sendHRHiringNotification(
        "owner@example.com",
        "Jane HR",
        "John Doe",
        "john@applicant.com",
        "approved"
      );

      const mailOptions = mockSendMail.mock.calls[0][0];
      expect(mailOptions.html).toContain("#059669");
    });

    it("should have approval subject with checkmark", async () => {
      await Email.sendHRHiringNotification(
        "owner@example.com",
        "Jane HR",
        "John Doe",
        "john@applicant.com",
        "approved"
      );

      const mailOptions = mockSendMail.mock.calls[0][0];
      expect(mailOptions.subject).toContain("New Cleaner Hired");
      expect(mailOptions.subject).toContain("John Doe");
    });

    it("should send rejection notification to owner", async () => {
      await Email.sendHRHiringNotification(
        "owner@example.com",
        "Jane HR",
        "John Doe",
        "john@applicant.com",
        "rejected",
        "Failed background check"
      );

      const mailOptions = mockSendMail.mock.calls[0][0];
      expect(mailOptions.html).toContain("rejected");
      expect(mailOptions.subject).toContain("Rejected");
    });

    it("should include rejection reason in notification", async () => {
      await Email.sendHRHiringNotification(
        "owner@example.com",
        "Jane HR",
        "John Doe",
        "john@applicant.com",
        "rejected",
        "Failed background check"
      );

      const mailOptions = mockSendMail.mock.calls[0][0];
      expect(mailOptions.html).toContain("Failed background check");
      expect(mailOptions.text).toContain("Failed background check");
    });

    it("should work without rejection reason", async () => {
      await Email.sendHRHiringNotification(
        "owner@example.com",
        "Jane HR",
        "John Doe",
        "john@applicant.com",
        "rejected"
      );

      const mailOptions = mockSendMail.mock.calls[0][0];
      expect(mailOptions.html).not.toContain("Rejection Reason");
    });

    it("should use gray color scheme for rejection", async () => {
      await Email.sendHRHiringNotification(
        "owner@example.com",
        "Jane HR",
        "John Doe",
        "john@applicant.com",
        "rejected"
      );

      const mailOptions = mockSendMail.mock.calls[0][0];
      expect(mailOptions.html).toContain("#64748b");
    });

    it("should have rejection subject with X mark", async () => {
      await Email.sendHRHiringNotification(
        "owner@example.com",
        "Jane HR",
        "John Doe",
        "john@applicant.com",
        "rejected"
      );

      const mailOptions = mockSendMail.mock.calls[0][0];
      expect(mailOptions.subject).toContain("Rejected");
      expect(mailOptions.subject).toContain("John Doe");
    });

    it("should include call to action to view dashboard", async () => {
      await Email.sendHRHiringNotification(
        "owner@example.com",
        "Jane HR",
        "John Doe",
        "john@applicant.com",
        "approved"
      );

      const mailOptions = mockSendMail.mock.calls[0][0];
      expect(mailOptions.html).toContain("dashboard");
    });

    it("should handle errors gracefully", async () => {
      mockSendMail.mockRejectedValueOnce(new Error("SMTP error"));

      const consoleSpy = jest.spyOn(console, "error").mockImplementation();

      const result = await Email.sendHRHiringNotification(
        "owner@example.com",
        "Jane HR",
        "John Doe",
        "john@applicant.com",
        "approved"
      );

      expect(consoleSpy).toHaveBeenCalled();
      expect(result).toBeUndefined();

      consoleSpy.mockRestore();
    });
  });

  describe("Email Template Structure", () => {
    it("should include HTML doctype", async () => {
      await Email.sendEmailConfirmation(
        "user@example.com",
        { street: "123 Main St", city: "Boston", state: "MA", zipcode: "02101" },
        "John",
        "2025-01-15"
      );

      const mailOptions = mockSendMail.mock.calls[0][0];
      expect(mailOptions.html).toContain("<!DOCTYPE html>");
    });

    it("should include Kleanr branding in footer", async () => {
      await Email.sendEmailConfirmation(
        "user@example.com",
        { street: "123 Main St", city: "Boston", state: "MA", zipcode: "02101" },
        "John",
        "2025-01-15"
      );

      const mailOptions = mockSendMail.mock.calls[0][0];
      expect(mailOptions.html).toContain("Kleanr");
      expect(mailOptions.html).toContain(new Date().getFullYear().toString());
    });

    it("should include automated message notice", async () => {
      await Email.sendEmailConfirmation(
        "user@example.com",
        { street: "123 Main St", city: "Boston", state: "MA", zipcode: "02101" },
        "John",
        "2025-01-15"
      );

      const mailOptions = mockSendMail.mock.calls[0][0];
      expect(mailOptions.html).toContain("automated message");
    });

    it("should set from address from environment", async () => {
      await Email.sendEmailConfirmation(
        "user@example.com",
        { street: "123 Main St", city: "Boston", state: "MA", zipcode: "02101" },
        "John",
        "2025-01-15"
      );

      const mailOptions = mockSendMail.mock.calls[0][0];
      expect(mailOptions.from).toBe("test@kleanr.com");
    });
  });

  describe("Date Formatting", () => {
    it("should format dates in human-readable format", async () => {
      await Email.sendEmailConfirmation(
        "user@example.com",
        { street: "123 Main St", city: "Boston", state: "MA", zipcode: "02101" },
        "John",
        "2025-01-15"
      );

      const mailOptions = mockSendMail.mock.calls[0][0];
      // Should contain formatted date elements
      expect(mailOptions.html).toMatch(/Jan|2025|15/);
    });
  });

  describe("sendUnassignedAppointmentWarning", () => {
    const testAddress = {
      street: "123 Main St",
      city: "Boston",
      state: "MA",
      zipcode: "02101",
    };

    it("should send warning email with correct recipient", async () => {
      await Email.sendUnassignedAppointmentWarning(
        "user@example.com",
        testAddress,
        "John",
        "2025-01-15"
      );

      expect(mockSendMail).toHaveBeenCalledTimes(1);
      const mailOptions = mockSendMail.mock.calls[0][0];
      expect(mailOptions.to).toBe("user@example.com");
    });

    it("should include warning subject with hourglass emoji", async () => {
      await Email.sendUnassignedAppointmentWarning(
        "user@example.com",
        testAddress,
        "John",
        "2025-01-15"
      );

      const mailOptions = mockSendMail.mock.calls[0][0];
      expect(mailOptions.subject).toContain("⏳");
      expect(mailOptions.subject).toContain("No Cleaner Assigned");
    });

    it("should include user name in greeting", async () => {
      await Email.sendUnassignedAppointmentWarning(
        "user@example.com",
        testAddress,
        "John",
        "2025-01-15"
      );

      const mailOptions = mockSendMail.mock.calls[0][0];
      expect(mailOptions.html).toContain("Hi John");
      expect(mailOptions.text).toContain("Hi John");
    });

    it("should include full address in email content", async () => {
      await Email.sendUnassignedAppointmentWarning(
        "user@example.com",
        testAddress,
        "John",
        "2025-01-15"
      );

      const mailOptions = mockSendMail.mock.calls[0][0];
      expect(mailOptions.html).toContain("123 Main St");
      expect(mailOptions.html).toContain("Boston");
      expect(mailOptions.html).toContain("MA");
      expect(mailOptions.html).toContain("02101");
    });

    it("should include awaiting cleaner status", async () => {
      await Email.sendUnassignedAppointmentWarning(
        "user@example.com",
        testAddress,
        "John",
        "2025-01-15"
      );

      const mailOptions = mockSendMail.mock.calls[0][0];
      expect(mailOptions.html).toContain("Awaiting Cleaner");
      expect(mailOptions.text).toContain("Awaiting Cleaner");
    });

    it("should include reassuring message about cleaners picking up jobs", async () => {
      await Email.sendUnassignedAppointmentWarning(
        "user@example.com",
        testAddress,
        "John",
        "2025-01-15"
      );

      const mailOptions = mockSendMail.mock.calls[0][0];
      expect(mailOptions.html).toContain("Don't worry");
      expect(mailOptions.html).toContain("still able to pick up");
      expect(mailOptions.text).toContain("Don't worry");
    });

    it("should include backup plan recommendation", async () => {
      await Email.sendUnassignedAppointmentWarning(
        "user@example.com",
        testAddress,
        "John",
        "2025-01-15"
      );

      const mailOptions = mockSendMail.mock.calls[0][0];
      expect(mailOptions.html).toContain("backup plan");
      expect(mailOptions.text).toContain("backup");
    });

    it("should include what you can do steps", async () => {
      await Email.sendUnassignedAppointmentWarning(
        "user@example.com",
        testAddress,
        "John",
        "2025-01-15"
      );

      const mailOptions = mockSendMail.mock.calls[0][0];
      expect(mailOptions.html).toContain("What You Can Do");
      expect(mailOptions.html).toContain("Wait a bit longer");
      expect(mailOptions.text).toContain("WHAT YOU CAN DO");
    });

    it("should include both HTML and plain text versions", async () => {
      await Email.sendUnassignedAppointmentWarning(
        "user@example.com",
        testAddress,
        "John",
        "2025-01-15"
      );

      const mailOptions = mockSendMail.mock.calls[0][0];
      expect(mailOptions.html).toBeDefined();
      expect(mailOptions.text).toBeDefined();
      expect(mailOptions.html).toContain("<!DOCTYPE html>");
    });

    it("should use warning color scheme (orange/yellow)", async () => {
      await Email.sendUnassignedAppointmentWarning(
        "user@example.com",
        testAddress,
        "John",
        "2025-01-15"
      );

      const mailOptions = mockSendMail.mock.calls[0][0];
      expect(mailOptions.html).toContain("#f59e0b");
    });

    it("should return response on success", async () => {
      const result = await Email.sendUnassignedAppointmentWarning(
        "user@example.com",
        testAddress,
        "John",
        "2025-01-15"
      );

      expect(result).toBe("250 OK");
    });

    it("should handle errors gracefully", async () => {
      mockSendMail.mockRejectedValueOnce(new Error("SMTP error"));

      const consoleSpy = jest.spyOn(console, "error").mockImplementation();

      const result = await Email.sendUnassignedAppointmentWarning(
        "user@example.com",
        testAddress,
        "John",
        "2025-01-15"
      );

      expect(consoleSpy).toHaveBeenCalled();
      expect(result).toBeUndefined();

      consoleSpy.mockRestore();
    });
  });

  describe("Email Redirection for Demo Accounts", () => {
    describe("resolveRecipientEmail", () => {
      it("should return original email when recipient is not a demo account", async () => {
        mockUserFindOne.mockResolvedValue(null);

        const result = await resolveRecipientEmail("user@example.com");

        expect(result.email).toBe("user@example.com");
        expect(result.isRedirected).toBe(false);
        expect(result.originalEmail).toBeNull();
        expect(mockUserFindOne).toHaveBeenCalledWith({
          where: {
            email: "user@example.com",
            isDemoAccount: true,
          },
        });
      });

      it("should return original email when demo account has no preview owner", async () => {
        mockUserFindOne.mockResolvedValue({
          id: 1,
          email: "demo_cleaner@sparkle.demo",
          isDemoAccount: true,
          currentPreviewOwnerId: null,
        });

        const result = await resolveRecipientEmail("demo_cleaner@sparkle.demo");

        expect(result.email).toBe("demo_cleaner@sparkle.demo");
        expect(result.isRedirected).toBe(false);
        expect(result.originalEmail).toBeNull();
      });

      it("should redirect to owner email when demo account has active preview owner", async () => {
        const mockDemoAccount = {
          id: 1,
          email: "demo_cleaner@sparkle.demo",
          isDemoAccount: true,
          currentPreviewOwnerId: 100,
        };
        const mockOwner = {
          id: 100,
          email: "owner@company.com",
        };

        mockUserFindOne.mockResolvedValue(mockDemoAccount);
        mockUserFindByPk.mockResolvedValue(mockOwner);

        const result = await resolveRecipientEmail("demo_cleaner@sparkle.demo");

        expect(result.email).toBe("owner@company.com");
        expect(result.isRedirected).toBe(true);
        expect(result.originalEmail).toBe("demo_cleaner@sparkle.demo");
        expect(mockUserFindByPk).toHaveBeenCalledWith(100);
      });

      it("should return original email when owner lookup fails", async () => {
        const mockDemoAccount = {
          id: 1,
          email: "demo_cleaner@sparkle.demo",
          isDemoAccount: true,
          currentPreviewOwnerId: 100,
        };

        mockUserFindOne.mockResolvedValue(mockDemoAccount);
        mockUserFindByPk.mockResolvedValue(null); // Owner not found

        const result = await resolveRecipientEmail("demo_cleaner@sparkle.demo");

        expect(result.email).toBe("demo_cleaner@sparkle.demo");
        expect(result.isRedirected).toBe(false);
        expect(result.originalEmail).toBeNull();
      });

      it("should handle database errors gracefully", async () => {
        mockUserFindOne.mockRejectedValue(new Error("Database error"));
        const consoleSpy = jest.spyOn(console, "error").mockImplementation();

        const result = await resolveRecipientEmail("demo_cleaner@sparkle.demo");

        expect(result.email).toBe("demo_cleaner@sparkle.demo");
        expect(result.isRedirected).toBe(false);
        expect(result.originalEmail).toBeNull();
        expect(consoleSpy).toHaveBeenCalledWith(
          "[Email] Error resolving recipient email:",
          expect.any(Error)
        );

        consoleSpy.mockRestore();
      });
    });

    describe("sendMailWithResolution", () => {
      it("should send email without modification when not redirected", async () => {
        mockUserFindOne.mockResolvedValue(null);

        const mailOptions = {
          from: "test@kleanr.com",
          to: "user@example.com",
          subject: "Test Subject",
          text: "Test body",
        };

        await sendMailWithResolution(mockTransporter, mailOptions);

        expect(mockSendMail).toHaveBeenCalledWith({
          from: "test@kleanr.com",
          to: "user@example.com",
          subject: "Test Subject",
          text: "Test body",
        });
      });

      it("should redirect email and modify subject when demo account is in preview", async () => {
        const mockDemoAccount = {
          id: 1,
          email: "demo_cleaner@sparkle.demo",
          isDemoAccount: true,
          currentPreviewOwnerId: 100,
        };
        const mockOwner = {
          id: 100,
          email: "owner@company.com",
        };

        mockUserFindOne.mockResolvedValue(mockDemoAccount);
        mockUserFindByPk.mockResolvedValue(mockOwner);

        const mailOptions = {
          from: "test@kleanr.com",
          to: "demo_cleaner@sparkle.demo",
          subject: "Appointment Confirmed",
          text: "Test body",
        };

        await sendMailWithResolution(mockTransporter, mailOptions);

        expect(mockSendMail).toHaveBeenCalledWith({
          from: "test@kleanr.com",
          to: "owner@company.com",
          subject: "[DEMO: demo_cleaner@sparkle.demo] Appointment Confirmed",
          text: "Test body",
        });
      });

      it("should return transporter sendMail result", async () => {
        mockUserFindOne.mockResolvedValue(null);
        mockSendMail.mockResolvedValue({ response: "250 OK" });

        const mailOptions = {
          from: "test@kleanr.com",
          to: "user@example.com",
          subject: "Test",
          text: "Test body",
        };

        const result = await sendMailWithResolution(mockTransporter, mailOptions);

        expect(result).toEqual({ response: "250 OK" });
      });
    });

    describe("Integration: Email methods use redirection", () => {
      it("should redirect cancellation email when sent to demo account in preview", async () => {
        const mockDemoAccount = {
          id: 1,
          email: "demo_homeowner@sparkle.demo",
          isDemoAccount: true,
          currentPreviewOwnerId: 100,
        };
        const mockOwner = {
          id: 100,
          email: "owner@company.com",
        };

        mockUserFindOne.mockResolvedValue(mockDemoAccount);
        mockUserFindByPk.mockResolvedValue(mockOwner);

        await Email.sendEmailCancellation(
          "demo_homeowner@sparkle.demo",
          { street: "123 Main St", city: "Boston", state: "MA", zipcode: "02101" },
          "Demo",
          "2025-01-15"
        );

        const mailOptions = mockSendMail.mock.calls[0][0];
        expect(mailOptions.to).toBe("owner@company.com");
        expect(mailOptions.subject).toContain("[DEMO: demo_homeowner@sparkle.demo]");
      });

      it("should not redirect when sending to regular user email", async () => {
        mockUserFindOne.mockResolvedValue(null);

        await Email.sendEmailCancellation(
          "regular_user@example.com",
          { street: "123 Main St", city: "Boston", state: "MA", zipcode: "02101" },
          "John",
          "2025-01-15"
        );

        const mailOptions = mockSendMail.mock.calls[0][0];
        expect(mailOptions.to).toBe("regular_user@example.com");
        expect(mailOptions.subject).not.toContain("[DEMO:");
      });
    });
  });
});
