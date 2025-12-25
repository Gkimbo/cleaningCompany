/**
 * Tests for HR Account Settings
 * Tests HR users updating their username and password
 */

const request = require("supertest");
const express = require("express");
const jwt = require("jsonwebtoken");

// Mock bcrypt
jest.mock("bcrypt", () => ({
  genSalt: jest.fn().mockResolvedValue("mock-salt"),
  hash: jest.fn().mockResolvedValue("new-hashed-password"),
  compare: jest.fn(),
}));

// Mock models
jest.mock("../../models", () => ({
  User: {
    findByPk: jest.fn(),
    findOne: jest.fn(),
  },
}));

const bcrypt = require("bcrypt");
const { User } = require("../../models");

describe("HR Account Settings", () => {
  let app;
  const secretKey = process.env.SESSION_SECRET || "test-secret";

  const generateToken = (userId) => {
    return jwt.sign({ userId }, secretKey);
  };

  const mockHRUser = {
    id: 10,
    username: "hrstaff1",
    firstName: "Jane",
    lastName: "Smith",
    email: "jane@example.com",
    type: "humanResources",
    password: "hashed-password",
    update: jest.fn().mockResolvedValue(true),
    validPassword: jest.fn(),
  };

  const mockOwner = {
    id: 1,
    username: "owner1",
    type: "owner",
    update: jest.fn().mockResolvedValue(true),
    validPassword: jest.fn(),
  };

  const mockCleaner = {
    id: 5,
    username: "cleaner1",
    type: "cleaner",
    update: jest.fn().mockResolvedValue(true),
    validPassword: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();

    app = express();
    app.use(express.json());

    const usersRouter = require("../../routes/api/v1/usersRouter");
    app.use("/api/v1/users", usersRouter);
  });

  // ============================================
  // UPDATE USERNAME TESTS
  // ============================================
  describe("PATCH /update-username", () => {
    describe("Authorization", () => {
      it("should return 401 without authorization header", async () => {
        const res = await request(app)
          .patch("/api/v1/users/update-username")
          .send({ username: "newusername" });

        expect(res.status).toBe(401);
        expect(res.body.error).toBe("Authorization token required");
      });

      it("should return 401 for invalid token", async () => {
        const res = await request(app)
          .patch("/api/v1/users/update-username")
          .set("Authorization", "Bearer invalid-token")
          .send({ username: "newusername" });

        expect(res.status).toBe(401);
      });

      it("should return 401 for expired token", async () => {
        const expiredToken = jwt.sign({ userId: 10 }, secretKey, { expiresIn: "-1h" });

        const res = await request(app)
          .patch("/api/v1/users/update-username")
          .set("Authorization", `Bearer ${expiredToken}`)
          .send({ username: "newusername" });

        expect(res.status).toBe(401);
        expect(res.body.error).toBe("Token has expired");
      });
    });

    describe("Validation", () => {
      beforeEach(() => {
        User.findByPk.mockResolvedValue(mockHRUser);
        User.findOne.mockResolvedValue(null);
      });

      it("should return 400 for username less than 4 characters", async () => {
        const token = generateToken(10);

        const res = await request(app)
          .patch("/api/v1/users/update-username")
          .set("Authorization", `Bearer ${token}`)
          .send({ username: "abc" });

        expect(res.status).toBe(400);
        expect(res.body.error).toBe("Username must be at least 4 characters");
      });

      it("should return 400 for empty username", async () => {
        const token = generateToken(10);

        const res = await request(app)
          .patch("/api/v1/users/update-username")
          .set("Authorization", `Bearer ${token}`)
          .send({ username: "" });

        expect(res.status).toBe(400);
        expect(res.body.error).toBe("Username must be at least 4 characters");
      });

      it("should return 400 for missing username", async () => {
        const token = generateToken(10);

        const res = await request(app)
          .patch("/api/v1/users/update-username")
          .set("Authorization", `Bearer ${token}`)
          .send({});

        expect(res.status).toBe(400);
        expect(res.body.error).toBe("Username must be at least 4 characters");
      });

      it("should return 400 for username over 20 characters", async () => {
        const token = generateToken(10);

        const res = await request(app)
          .patch("/api/v1/users/update-username")
          .set("Authorization", `Bearer ${token}`)
          .send({ username: "a".repeat(21) });

        expect(res.status).toBe(400);
        expect(res.body.error).toBe("Username must be 20 characters or less");
      });

      it("should return 400 for username with special characters", async () => {
        const token = generateToken(10);

        const res = await request(app)
          .patch("/api/v1/users/update-username")
          .set("Authorization", `Bearer ${token}`)
          .send({ username: "user@name!" });

        expect(res.status).toBe(400);
        expect(res.body.error).toBe("Username can only contain letters, numbers, and underscores");
      });

      it("should return 400 for username with spaces", async () => {
        const token = generateToken(10);

        const res = await request(app)
          .patch("/api/v1/users/update-username")
          .set("Authorization", `Bearer ${token}`)
          .send({ username: "user name" });

        expect(res.status).toBe(400);
        expect(res.body.error).toBe("Username can only contain letters, numbers, and underscores");
      });

      it("should return 400 for username containing 'owner'", async () => {
        const token = generateToken(10);

        const res = await request(app)
          .patch("/api/v1/users/update-username")
          .set("Authorization", `Bearer ${token}`)
          .send({ username: "hrowner123" });

        expect(res.status).toBe(400);
        expect(res.body.error).toBe("Username cannot contain the word 'owner'");
      });

      it("should return 400 for username containing 'OWNER' (case insensitive)", async () => {
        const token = generateToken(10);

        const res = await request(app)
          .patch("/api/v1/users/update-username")
          .set("Authorization", `Bearer ${token}`)
          .send({ username: "hrOWNER123" });

        expect(res.status).toBe(400);
        expect(res.body.error).toBe("Username cannot contain the word 'owner'");
      });

      it("should return 409 when username is already taken", async () => {
        const token = generateToken(10);
        User.findOne.mockResolvedValue({ id: 20, username: "takenname" });

        const res = await request(app)
          .patch("/api/v1/users/update-username")
          .set("Authorization", `Bearer ${token}`)
          .send({ username: "takenname" });

        expect(res.status).toBe(409);
        expect(res.body.error).toBe("Username is already taken");
      });
    });

    describe("Successful Username Update - HR User", () => {
      it("should allow HR user to update their username", async () => {
        const token = generateToken(10);
        User.findByPk.mockResolvedValue(mockHRUser);
        User.findOne.mockResolvedValue(null);

        const res = await request(app)
          .patch("/api/v1/users/update-username")
          .set("Authorization", `Bearer ${token}`)
          .send({ username: "newhrname" });

        expect(res.status).toBe(200);
        expect(res.body.message).toBe("Username updated successfully");
        expect(res.body.username).toBe("newhrname");
        expect(mockHRUser.update).toHaveBeenCalledWith({ username: "newhrname" });
      });

      it("should allow username with underscores", async () => {
        const token = generateToken(10);
        User.findByPk.mockResolvedValue(mockHRUser);
        User.findOne.mockResolvedValue(null);

        const res = await request(app)
          .patch("/api/v1/users/update-username")
          .set("Authorization", `Bearer ${token}`)
          .send({ username: "hr_staff_1" });

        expect(res.status).toBe(200);
        expect(res.body.username).toBe("hr_staff_1");
      });

      it("should allow username with numbers", async () => {
        const token = generateToken(10);
        User.findByPk.mockResolvedValue(mockHRUser);
        User.findOne.mockResolvedValue(null);

        const res = await request(app)
          .patch("/api/v1/users/update-username")
          .set("Authorization", `Bearer ${token}`)
          .send({ username: "hrstaff2024" });

        expect(res.status).toBe(200);
        expect(res.body.username).toBe("hrstaff2024");
      });

      it("should allow user to keep same username", async () => {
        const token = generateToken(10);
        User.findByPk.mockResolvedValue(mockHRUser);
        User.findOne.mockResolvedValue({ id: 10, username: "hrstaff1" }); // Same user

        const res = await request(app)
          .patch("/api/v1/users/update-username")
          .set("Authorization", `Bearer ${token}`)
          .send({ username: "hrstaff1" });

        expect(res.status).toBe(200);
      });

      it("should allow exactly 4 character username", async () => {
        const token = generateToken(10);
        User.findByPk.mockResolvedValue(mockHRUser);
        User.findOne.mockResolvedValue(null);

        const res = await request(app)
          .patch("/api/v1/users/update-username")
          .set("Authorization", `Bearer ${token}`)
          .send({ username: "hr01" });

        expect(res.status).toBe(200);
      });

      it("should allow exactly 20 character username", async () => {
        const token = generateToken(10);
        User.findByPk.mockResolvedValue(mockHRUser);
        User.findOne.mockResolvedValue(null);

        const res = await request(app)
          .patch("/api/v1/users/update-username")
          .set("Authorization", `Bearer ${token}`)
          .send({ username: "a".repeat(20) });

        expect(res.status).toBe(200);
      });
    });

    describe("User Not Found", () => {
      it("should return 404 when user not found", async () => {
        const token = generateToken(999);
        User.findByPk.mockResolvedValue(null);

        const res = await request(app)
          .patch("/api/v1/users/update-username")
          .set("Authorization", `Bearer ${token}`)
          .send({ username: "newname" });

        expect(res.status).toBe(404);
        expect(res.body.error).toBe("User not found");
      });
    });
  });

  // ============================================
  // UPDATE PASSWORD TESTS
  // ============================================
  describe("PATCH /update-password", () => {
    describe("Authorization", () => {
      it("should return 401 without authorization header", async () => {
        const res = await request(app)
          .patch("/api/v1/users/update-password")
          .send({ currentPassword: "old", newPassword: "New1234!" });

        expect(res.status).toBe(401);
        expect(res.body.error).toBe("Authorization token required");
      });

      it("should return 401 for invalid token", async () => {
        const res = await request(app)
          .patch("/api/v1/users/update-password")
          .set("Authorization", "Bearer invalid-token")
          .send({ currentPassword: "old", newPassword: "New1234!" });

        expect(res.status).toBe(401);
      });

      it("should return 401 for expired token", async () => {
        const expiredToken = jwt.sign({ userId: 10 }, secretKey, { expiresIn: "-1h" });

        const res = await request(app)
          .patch("/api/v1/users/update-password")
          .set("Authorization", `Bearer ${expiredToken}`)
          .send({ currentPassword: "old", newPassword: "New1234!" });

        expect(res.status).toBe(401);
        expect(res.body.error).toBe("Token has expired");
      });
    });

    describe("Current Password Validation", () => {
      beforeEach(() => {
        User.findByPk.mockResolvedValue(mockHRUser);
      });

      it("should return 400 when current password is missing", async () => {
        const token = generateToken(10);

        const res = await request(app)
          .patch("/api/v1/users/update-password")
          .set("Authorization", `Bearer ${token}`)
          .send({ newPassword: "NewPass123!" });

        expect(res.status).toBe(400);
        expect(res.body.error).toBe("Current password is required");
      });

      it("should return 401 when current password is incorrect", async () => {
        const token = generateToken(10);
        mockHRUser.validPassword.mockResolvedValue(false);

        const res = await request(app)
          .patch("/api/v1/users/update-password")
          .set("Authorization", `Bearer ${token}`)
          .send({ currentPassword: "wrongpassword", newPassword: "NewPass123!" });

        expect(res.status).toBe(401);
        expect(res.body.error).toBe("Current password is incorrect");
      });
    });

    describe("New Password Validation", () => {
      beforeEach(() => {
        User.findByPk.mockResolvedValue(mockHRUser);
        mockHRUser.validPassword.mockResolvedValue(true);
      });

      it("should return 400 for password less than 8 characters", async () => {
        const token = generateToken(10);

        const res = await request(app)
          .patch("/api/v1/users/update-password")
          .set("Authorization", `Bearer ${token}`)
          .send({ currentPassword: "OldPass1!", newPassword: "Ab1!" });

        expect(res.status).toBe(400);
        expect(res.body.error).toContain("8 characters");
      });

      it("should return 400 for password without uppercase", async () => {
        const token = generateToken(10);

        const res = await request(app)
          .patch("/api/v1/users/update-password")
          .set("Authorization", `Bearer ${token}`)
          .send({ currentPassword: "OldPass1!", newPassword: "newpass123!" });

        expect(res.status).toBe(400);
        expect(res.body.error).toContain("uppercase");
      });

      it("should return 400 for password without lowercase", async () => {
        const token = generateToken(10);

        const res = await request(app)
          .patch("/api/v1/users/update-password")
          .set("Authorization", `Bearer ${token}`)
          .send({ currentPassword: "OldPass1!", newPassword: "NEWPASS123!" });

        expect(res.status).toBe(400);
        expect(res.body.error).toContain("lowercase");
      });

      it("should return 400 for password without number", async () => {
        const token = generateToken(10);

        const res = await request(app)
          .patch("/api/v1/users/update-password")
          .set("Authorization", `Bearer ${token}`)
          .send({ currentPassword: "OldPass1!", newPassword: "NewPassword!" });

        expect(res.status).toBe(400);
        expect(res.body.error).toContain("number");
      });

      it("should return 400 for password without special character", async () => {
        const token = generateToken(10);

        const res = await request(app)
          .patch("/api/v1/users/update-password")
          .set("Authorization", `Bearer ${token}`)
          .send({ currentPassword: "OldPass1!", newPassword: "NewPass123" });

        expect(res.status).toBe(400);
        expect(res.body.error).toContain("special character");
      });

      it("should return 400 for empty new password", async () => {
        const token = generateToken(10);

        const res = await request(app)
          .patch("/api/v1/users/update-password")
          .set("Authorization", `Bearer ${token}`)
          .send({ currentPassword: "OldPass1!", newPassword: "" });

        expect(res.status).toBe(400);
      });

      it("should return 400 for null new password", async () => {
        const token = generateToken(10);

        const res = await request(app)
          .patch("/api/v1/users/update-password")
          .set("Authorization", `Bearer ${token}`)
          .send({ currentPassword: "OldPass1!", newPassword: null });

        expect(res.status).toBe(400);
      });
    });

    describe("Successful Password Update - HR User", () => {
      beforeEach(() => {
        User.findByPk.mockResolvedValue(mockHRUser);
        mockHRUser.validPassword.mockResolvedValue(true);
      });

      it("should allow HR user to update their password", async () => {
        const token = generateToken(10);

        const res = await request(app)
          .patch("/api/v1/users/update-password")
          .set("Authorization", `Bearer ${token}`)
          .send({ currentPassword: "OldPass123!", newPassword: "NewPass456!" });

        expect(res.status).toBe(200);
        expect(res.body.message).toBe("Password updated successfully");
        expect(bcrypt.genSalt).toHaveBeenCalledWith(10);
        expect(bcrypt.hash).toHaveBeenCalledWith("NewPass456!", "mock-salt");
        expect(mockHRUser.update).toHaveBeenCalledWith({ password: "new-hashed-password" });
      });

      it("should accept various special characters", async () => {
        const token = generateToken(10);
        const specialChars = ["!", "@", "#", "$", "%", "^", "&", "*", "(", ")", ",", ".", "?", ":", "{", "}", "|", "<", ">"];

        for (const char of specialChars) {
          mockHRUser.update.mockClear();
          bcrypt.hash.mockClear();

          const res = await request(app)
            .patch("/api/v1/users/update-password")
            .set("Authorization", `Bearer ${token}`)
            .send({ currentPassword: "OldPass123!", newPassword: `NewPass1${char}` });

          expect(res.status).toBe(200);
        }
      });

      it("should accept exactly 8 character password meeting all requirements", async () => {
        const token = generateToken(10);

        const res = await request(app)
          .patch("/api/v1/users/update-password")
          .set("Authorization", `Bearer ${token}`)
          .send({ currentPassword: "OldPass123!", newPassword: "Aa1!aaaa" });

        expect(res.status).toBe(200);
      });

      it("should accept long password", async () => {
        const token = generateToken(10);

        const res = await request(app)
          .patch("/api/v1/users/update-password")
          .set("Authorization", `Bearer ${token}`)
          .send({
            currentPassword: "OldPass123!",
            newPassword: "VeryLongPassword123!WithManyCharacters",
          });

        expect(res.status).toBe(200);
      });
    });

    describe("User Not Found", () => {
      it("should return 404 when user not found", async () => {
        const token = generateToken(999);
        User.findByPk.mockResolvedValue(null);

        const res = await request(app)
          .patch("/api/v1/users/update-password")
          .set("Authorization", `Bearer ${token}`)
          .send({ currentPassword: "old", newPassword: "NewPass123!" });

        expect(res.status).toBe(404);
        expect(res.body.error).toBe("User not found");
      });
    });
  });

  // ============================================
  // CROSS-USER TYPE TESTS
  // ============================================
  describe("Account Settings for Different User Types", () => {
    describe("Owner can update credentials", () => {
      it("should allow owner to update username", async () => {
        const token = generateToken(1);
        User.findByPk.mockResolvedValue(mockOwner);
        User.findOne.mockResolvedValue(null);

        const res = await request(app)
          .patch("/api/v1/users/update-username")
          .set("Authorization", `Bearer ${token}`)
          .send({ username: "bossuser" });

        expect(res.status).toBe(200);
      });

      it("should allow owner to update password", async () => {
        const token = generateToken(1);
        User.findByPk.mockResolvedValue(mockOwner);
        mockOwner.validPassword.mockResolvedValue(true);

        const res = await request(app)
          .patch("/api/v1/users/update-password")
          .set("Authorization", `Bearer ${token}`)
          .send({ currentPassword: "OldPass1!", newPassword: "NewPass1!" });

        expect(res.status).toBe(200);
      });
    });

    describe("Cleaner can update credentials", () => {
      it("should allow cleaner to update username", async () => {
        const token = generateToken(5);
        User.findByPk.mockResolvedValue(mockCleaner);
        User.findOne.mockResolvedValue(null);

        const res = await request(app)
          .patch("/api/v1/users/update-username")
          .set("Authorization", `Bearer ${token}`)
          .send({ username: "newcleanername" });

        expect(res.status).toBe(200);
      });

      it("should allow cleaner to update password", async () => {
        const token = generateToken(5);
        User.findByPk.mockResolvedValue(mockCleaner);
        mockCleaner.validPassword.mockResolvedValue(true);

        const res = await request(app)
          .patch("/api/v1/users/update-password")
          .set("Authorization", `Bearer ${token}`)
          .send({ currentPassword: "OldPass1!", newPassword: "NewPass1!" });

        expect(res.status).toBe(200);
      });
    });
  });

  // ============================================
  // ERROR HANDLING TESTS
  // ============================================
  describe("Error Handling", () => {
    it("should handle database error during username update", async () => {
      const token = generateToken(10);
      User.findByPk.mockRejectedValue(new Error("Database error"));

      const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => {});

      const res = await request(app)
        .patch("/api/v1/users/update-username")
        .set("Authorization", `Bearer ${token}`)
        .send({ username: "newname" });

      expect(res.status).toBe(500);
      expect(res.body.error).toBe("Failed to update username");

      consoleSpy.mockRestore();
    });

    it("should handle database error during password update", async () => {
      const token = generateToken(10);
      User.findByPk.mockRejectedValue(new Error("Database error"));

      const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => {});

      const res = await request(app)
        .patch("/api/v1/users/update-password")
        .set("Authorization", `Bearer ${token}`)
        .send({ currentPassword: "old", newPassword: "NewPass1!" });

      expect(res.status).toBe(500);
      expect(res.body.error).toBe("Failed to update password");

      consoleSpy.mockRestore();
    });

    it("should handle update failure gracefully", async () => {
      const token = generateToken(10);
      const failingUser = {
        ...mockHRUser,
        update: jest.fn().mockRejectedValue(new Error("Update failed")),
        validPassword: jest.fn().mockResolvedValue(true),
      };
      User.findByPk.mockResolvedValue(failingUser);

      const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => {});

      const res = await request(app)
        .patch("/api/v1/users/update-password")
        .set("Authorization", `Bearer ${token}`)
        .send({ currentPassword: "old", newPassword: "NewPass1!" });

      expect(res.status).toBe(500);

      consoleSpy.mockRestore();
    });
  });
});
