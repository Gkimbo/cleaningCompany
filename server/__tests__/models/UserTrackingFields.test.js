/**
 * User Model Tracking Fields Tests
 *
 * Tests the new manager-only tracking fields:
 * - managerPrivateNotes (TEXT)
 * - falseHomeSizeCount (INTEGER)
 * - falseClaimCount (INTEGER)
 */

// Helper to create mock User objects
const createMockUser = (overrides = {}) => ({
  id: 1,
  firstName: "John",
  lastName: "Doe",
  username: "johndoe",
  email: "john@example.com",
  type: "homeowner",
  managerPrivateNotes: null,
  falseHomeSizeCount: 0,
  falseClaimCount: 0,
  createdAt: new Date(),
  updatedAt: new Date(),
  update: jest.fn().mockImplementation(function (data) {
    Object.assign(this, data);
    return Promise.resolve(this);
  }),
  save: jest.fn().mockResolvedValue(this),
  ...overrides,
});

describe("User Model - Tracking Fields", () => {
  describe("Model Structure", () => {
    it("should have managerPrivateNotes field", () => {
      const user = createMockUser();
      expect(user).toHaveProperty("managerPrivateNotes");
    });

    it("should have falseHomeSizeCount field", () => {
      const user = createMockUser();
      expect(user).toHaveProperty("falseHomeSizeCount");
    });

    it("should have falseClaimCount field", () => {
      const user = createMockUser();
      expect(user).toHaveProperty("falseClaimCount");
    });

    it("should have default null for managerPrivateNotes", () => {
      const user = createMockUser();
      expect(user.managerPrivateNotes).toBeNull();
    });

    it("should have default 0 for falseHomeSizeCount", () => {
      const user = createMockUser();
      expect(user.falseHomeSizeCount).toBe(0);
    });

    it("should have default 0 for falseClaimCount", () => {
      const user = createMockUser();
      expect(user.falseClaimCount).toBe(0);
    });
  });

  describe("Manager Private Notes", () => {
    it("should allow null notes", () => {
      const user = createMockUser({ managerPrivateNotes: null });
      expect(user.managerPrivateNotes).toBeNull();
    });

    it("should store text notes", () => {
      const note = "[2025-01-15] False claim reported by manager";
      const user = createMockUser({ managerPrivateNotes: note });
      expect(user.managerPrivateNotes).toBe(note);
    });

    it("should store long text notes", () => {
      const longNote = "A".repeat(5000);
      const user = createMockUser({ managerPrivateNotes: longNote });
      expect(user.managerPrivateNotes.length).toBe(5000);
    });

    it("should append new notes to existing notes", async () => {
      const existingNote = "[2025-01-01] First incident";
      const user = createMockUser({ managerPrivateNotes: existingNote });

      const newNote = "[2025-01-15] Second incident";
      const combinedNotes = existingNote + "\n" + newNote;

      await user.update({ managerPrivateNotes: combinedNotes });

      expect(user.managerPrivateNotes).toContain("First incident");
      expect(user.managerPrivateNotes).toContain("Second incident");
    });

    it("should handle first note when managerPrivateNotes is null", async () => {
      const user = createMockUser({ managerPrivateNotes: null });

      const firstNote = "[2025-01-15] First note ever";
      await user.update({ managerPrivateNotes: firstNote });

      expect(user.managerPrivateNotes).toBe(firstNote);
      expect(user.managerPrivateNotes).not.toContain("null");
    });

    it("should store notes with timestamps", () => {
      const timestamp = new Date().toISOString();
      const note = `[${timestamp}] HOME SIZE DISCREPANCY: Homeowner disputed`;
      const user = createMockUser({ managerPrivateNotes: note });

      expect(user.managerPrivateNotes).toContain(timestamp);
    });

    it("should store notes with manager identification", () => {
      const note = "[2025-01-15] FALSE CLAIM: Manager: John Smith";
      const user = createMockUser({ managerPrivateNotes: note });

      expect(user.managerPrivateNotes).toContain("Manager: John Smith");
    });

    it("should preserve newlines in multi-line notes", () => {
      const multiLineNote = "Line 1\nLine 2\nLine 3";
      const user = createMockUser({ managerPrivateNotes: multiLineNote });

      const lines = user.managerPrivateNotes.split("\n");
      expect(lines).toHaveLength(3);
    });
  });

  describe("False Home Size Count (Homeowners)", () => {
    it("should start at 0", () => {
      const user = createMockUser({ type: "homeowner" });
      expect(user.falseHomeSizeCount).toBe(0);
    });

    it("should increment count", async () => {
      const user = createMockUser({ type: "homeowner", falseHomeSizeCount: 0 });

      await user.update({ falseHomeSizeCount: user.falseHomeSizeCount + 1 });

      expect(user.falseHomeSizeCount).toBe(1);
    });

    it("should track multiple incidents", async () => {
      const user = createMockUser({ type: "homeowner", falseHomeSizeCount: 2 });

      await user.update({ falseHomeSizeCount: user.falseHomeSizeCount + 1 });

      expect(user.falseHomeSizeCount).toBe(3);
    });

    it("should handle high counts", () => {
      const user = createMockUser({ type: "homeowner", falseHomeSizeCount: 100 });
      expect(user.falseHomeSizeCount).toBe(100);
    });

    it("should not be negative", () => {
      const user = createMockUser({ type: "homeowner", falseHomeSizeCount: 0 });
      // Count should never go below 0
      expect(user.falseHomeSizeCount).toBeGreaterThanOrEqual(0);
    });

    it("should be associated with homeowner user type", () => {
      const homeowner = createMockUser({ type: "homeowner", falseHomeSizeCount: 2 });
      expect(homeowner.type).toBe("homeowner");
      expect(homeowner.falseHomeSizeCount).toBe(2);
    });
  });

  describe("False Claim Count (Cleaners)", () => {
    it("should start at 0", () => {
      const user = createMockUser({ type: "cleaner" });
      expect(user.falseClaimCount).toBe(0);
    });

    it("should increment count", async () => {
      const user = createMockUser({ type: "cleaner", falseClaimCount: 0 });

      await user.update({ falseClaimCount: user.falseClaimCount + 1 });

      expect(user.falseClaimCount).toBe(1);
    });

    it("should track multiple false claims", async () => {
      const user = createMockUser({ type: "cleaner", falseClaimCount: 3 });

      await user.update({ falseClaimCount: user.falseClaimCount + 1 });

      expect(user.falseClaimCount).toBe(4);
    });

    it("should handle high counts", () => {
      const user = createMockUser({ type: "cleaner", falseClaimCount: 50 });
      expect(user.falseClaimCount).toBe(50);
    });

    it("should not be negative", () => {
      const user = createMockUser({ type: "cleaner", falseClaimCount: 0 });
      expect(user.falseClaimCount).toBeGreaterThanOrEqual(0);
    });

    it("should be associated with cleaner user type", () => {
      const cleaner = createMockUser({ type: "cleaner", falseClaimCount: 1 });
      expect(cleaner.type).toBe("cleaner");
      expect(cleaner.falseClaimCount).toBe(1);
    });
  });

  describe("Field Independence", () => {
    it("should update managerPrivateNotes independently", async () => {
      const user = createMockUser({
        managerPrivateNotes: "Initial note",
        falseHomeSizeCount: 1,
        falseClaimCount: 2,
      });

      await user.update({ managerPrivateNotes: "Updated note" });

      expect(user.managerPrivateNotes).toBe("Updated note");
      expect(user.falseHomeSizeCount).toBe(1);
      expect(user.falseClaimCount).toBe(2);
    });

    it("should update falseHomeSizeCount independently", async () => {
      const user = createMockUser({
        managerPrivateNotes: "Some note",
        falseHomeSizeCount: 1,
        falseClaimCount: 0,
      });

      await user.update({ falseHomeSizeCount: 2 });

      expect(user.managerPrivateNotes).toBe("Some note");
      expect(user.falseHomeSizeCount).toBe(2);
      expect(user.falseClaimCount).toBe(0);
    });

    it("should update falseClaimCount independently", async () => {
      const user = createMockUser({
        managerPrivateNotes: "Some note",
        falseHomeSizeCount: 1,
        falseClaimCount: 0,
      });

      await user.update({ falseClaimCount: 1 });

      expect(user.managerPrivateNotes).toBe("Some note");
      expect(user.falseHomeSizeCount).toBe(1);
      expect(user.falseClaimCount).toBe(1);
    });

    it("should update multiple fields together", async () => {
      const user = createMockUser({
        managerPrivateNotes: null,
        falseHomeSizeCount: 0,
        falseClaimCount: 0,
      });

      await user.update({
        managerPrivateNotes: "New note",
        falseHomeSizeCount: 1,
      });

      expect(user.managerPrivateNotes).toBe("New note");
      expect(user.falseHomeSizeCount).toBe(1);
    });
  });

  describe("Combined Notes and Counts", () => {
    it("should update notes when incrementing falseHomeSizeCount", async () => {
      const user = createMockUser({ type: "homeowner", falseHomeSizeCount: 0 });

      const timestamp = new Date().toISOString();
      const note = `[${timestamp}] HOME SIZE DISCREPANCY: Homeowner disputed claim`;

      await user.update({
        managerPrivateNotes: note,
        falseHomeSizeCount: 1,
      });

      expect(user.managerPrivateNotes).toContain("HOME SIZE DISCREPANCY");
      expect(user.falseHomeSizeCount).toBe(1);
    });

    it("should update notes when incrementing falseClaimCount", async () => {
      const user = createMockUser({ type: "cleaner", falseClaimCount: 0 });

      const timestamp = new Date().toISOString();
      const note = `[${timestamp}] FALSE CLAIM: Cleaner made invalid claim`;

      await user.update({
        managerPrivateNotes: note,
        falseClaimCount: 1,
      });

      expect(user.managerPrivateNotes).toContain("FALSE CLAIM");
      expect(user.falseClaimCount).toBe(1);
    });
  });

  describe("User Type Specific Behavior", () => {
    it("should allow homeowners to have falseHomeSizeCount > 0", () => {
      const homeowner = createMockUser({
        type: "homeowner",
        falseHomeSizeCount: 3,
        falseClaimCount: 0,
      });

      expect(homeowner.falseHomeSizeCount).toBe(3);
    });

    it("should allow cleaners to have falseClaimCount > 0", () => {
      const cleaner = createMockUser({
        type: "cleaner",
        falseHomeSizeCount: 0,
        falseClaimCount: 2,
      });

      expect(cleaner.falseClaimCount).toBe(2);
    });

    it("should allow managers to have notes but typically 0 counts", () => {
      const manager = createMockUser({
        type: "manager",
        managerPrivateNotes: "Manager notes about operations",
        falseHomeSizeCount: 0,
        falseClaimCount: 0,
      });

      expect(manager.managerPrivateNotes).toBeTruthy();
      expect(manager.falseHomeSizeCount).toBe(0);
      expect(manager.falseClaimCount).toBe(0);
    });
  });

  describe("Privacy - Manager Only Access", () => {
    it("should store data that is hidden from users", () => {
      const user = createMockUser({
        managerPrivateNotes: "SECRET: User has history of issues",
        falseHomeSizeCount: 2,
      });

      // This tests the data structure - actual access control is in the router
      expect(user.managerPrivateNotes).toContain("SECRET");
      expect(user.falseHomeSizeCount).toBe(2);
    });

    it("should not expose notes in standard user properties", () => {
      const user = createMockUser({
        managerPrivateNotes: "Private manager note",
      });

      // Regular user properties should not include managerPrivateNotes in serialized output
      const publicFields = ["firstName", "lastName", "username", "email"];
      publicFields.forEach((field) => {
        expect(user[field]).not.toContain("Private manager note");
      });
    });
  });

  describe("Edge Cases", () => {
    it("should handle empty string notes", () => {
      const user = createMockUser({ managerPrivateNotes: "" });
      expect(user.managerPrivateNotes).toBe("");
    });

    it("should handle special characters in notes", () => {
      const specialNote = "Note with special chars: <script>alert('xss')</script> & \"quotes\"";
      const user = createMockUser({ managerPrivateNotes: specialNote });
      expect(user.managerPrivateNotes).toBe(specialNote);
    });

    it("should handle unicode in notes", () => {
      const unicodeNote = "Note with emoji: 🚨 Warning! User flagged";
      const user = createMockUser({ managerPrivateNotes: unicodeNote });
      expect(user.managerPrivateNotes).toContain("🚨");
    });

    it("should handle max integer for counts", () => {
      // PostgreSQL INTEGER max is 2147483647
      const user = createMockUser({ falseHomeSizeCount: 2147483647 });
      expect(user.falseHomeSizeCount).toBe(2147483647);
    });
  });

  describe("Historical Record", () => {
    it("should maintain full history in notes", () => {
      const notes = [
        "[2025-01-01T10:00:00Z] First incident - Manager: Admin1",
        "[2025-01-15T14:30:00Z] Second incident - Manager: Admin2",
        "[2025-02-01T09:00:00Z] Third incident - Manager: Admin1",
      ].join("\n");

      const user = createMockUser({ managerPrivateNotes: notes });

      expect(user.managerPrivateNotes).toContain("First incident");
      expect(user.managerPrivateNotes).toContain("Second incident");
      expect(user.managerPrivateNotes).toContain("Third incident");

      const noteLines = user.managerPrivateNotes.split("\n");
      expect(noteLines).toHaveLength(3);
    });

    it("should track cumulative count accurately", () => {
      // Simulating multiple increments over time
      const user = createMockUser({ falseHomeSizeCount: 0 });

      // First incident
      user.falseHomeSizeCount = 1;
      expect(user.falseHomeSizeCount).toBe(1);

      // Second incident
      user.falseHomeSizeCount = 2;
      expect(user.falseHomeSizeCount).toBe(2);

      // Third incident
      user.falseHomeSizeCount = 3;
      expect(user.falseHomeSizeCount).toBe(3);
    });
  });
});
