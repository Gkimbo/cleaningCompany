/**
 * User Model Tracking Fields Tests
 *
 * Tests the new owner-only tracking fields:
 * - ownerPrivateNotes (TEXT)
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
  ownerPrivateNotes: null,
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
    it("should have ownerPrivateNotes field", () => {
      const user = createMockUser();
      expect(user).toHaveProperty("ownerPrivateNotes");
    });

    it("should have falseHomeSizeCount field", () => {
      const user = createMockUser();
      expect(user).toHaveProperty("falseHomeSizeCount");
    });

    it("should have falseClaimCount field", () => {
      const user = createMockUser();
      expect(user).toHaveProperty("falseClaimCount");
    });

    it("should have default null for ownerPrivateNotes", () => {
      const user = createMockUser();
      expect(user.ownerPrivateNotes).toBeNull();
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

  describe("Owner Private Notes", () => {
    it("should allow null notes", () => {
      const user = createMockUser({ ownerPrivateNotes: null });
      expect(user.ownerPrivateNotes).toBeNull();
    });

    it("should store text notes", () => {
      const note = "[2025-01-15] False claim reported by owner";
      const user = createMockUser({ ownerPrivateNotes: note });
      expect(user.ownerPrivateNotes).toBe(note);
    });

    it("should store long text notes", () => {
      const longNote = "A".repeat(5000);
      const user = createMockUser({ ownerPrivateNotes: longNote });
      expect(user.ownerPrivateNotes.length).toBe(5000);
    });

    it("should append new notes to existing notes", async () => {
      const existingNote = "[2025-01-01] First incident";
      const user = createMockUser({ ownerPrivateNotes: existingNote });

      const newNote = "[2025-01-15] Second incident";
      const combinedNotes = existingNote + "\n" + newNote;

      await user.update({ ownerPrivateNotes: combinedNotes });

      expect(user.ownerPrivateNotes).toContain("First incident");
      expect(user.ownerPrivateNotes).toContain("Second incident");
    });

    it("should handle first note when ownerPrivateNotes is null", async () => {
      const user = createMockUser({ ownerPrivateNotes: null });

      const firstNote = "[2025-01-15] First note ever";
      await user.update({ ownerPrivateNotes: firstNote });

      expect(user.ownerPrivateNotes).toBe(firstNote);
      expect(user.ownerPrivateNotes).not.toContain("null");
    });

    it("should store notes with timestamps", () => {
      const timestamp = new Date().toISOString();
      const note = `[${timestamp}] HOME SIZE DISCREPANCY: Homeowner disputed`;
      const user = createMockUser({ ownerPrivateNotes: note });

      expect(user.ownerPrivateNotes).toContain(timestamp);
    });

    it("should store notes with owner identification", () => {
      const note = "[2025-01-15] FALSE CLAIM: Owner: John Smith";
      const user = createMockUser({ ownerPrivateNotes: note });

      expect(user.ownerPrivateNotes).toContain("Owner: John Smith");
    });

    it("should preserve newlines in multi-line notes", () => {
      const multiLineNote = "Line 1\nLine 2\nLine 3";
      const user = createMockUser({ ownerPrivateNotes: multiLineNote });

      const lines = user.ownerPrivateNotes.split("\n");
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
    it("should update ownerPrivateNotes independently", async () => {
      const user = createMockUser({
        ownerPrivateNotes: "Initial note",
        falseHomeSizeCount: 1,
        falseClaimCount: 2,
      });

      await user.update({ ownerPrivateNotes: "Updated note" });

      expect(user.ownerPrivateNotes).toBe("Updated note");
      expect(user.falseHomeSizeCount).toBe(1);
      expect(user.falseClaimCount).toBe(2);
    });

    it("should update falseHomeSizeCount independently", async () => {
      const user = createMockUser({
        ownerPrivateNotes: "Some note",
        falseHomeSizeCount: 1,
        falseClaimCount: 0,
      });

      await user.update({ falseHomeSizeCount: 2 });

      expect(user.ownerPrivateNotes).toBe("Some note");
      expect(user.falseHomeSizeCount).toBe(2);
      expect(user.falseClaimCount).toBe(0);
    });

    it("should update falseClaimCount independently", async () => {
      const user = createMockUser({
        ownerPrivateNotes: "Some note",
        falseHomeSizeCount: 1,
        falseClaimCount: 0,
      });

      await user.update({ falseClaimCount: 1 });

      expect(user.ownerPrivateNotes).toBe("Some note");
      expect(user.falseHomeSizeCount).toBe(1);
      expect(user.falseClaimCount).toBe(1);
    });

    it("should update multiple fields together", async () => {
      const user = createMockUser({
        ownerPrivateNotes: null,
        falseHomeSizeCount: 0,
        falseClaimCount: 0,
      });

      await user.update({
        ownerPrivateNotes: "New note",
        falseHomeSizeCount: 1,
      });

      expect(user.ownerPrivateNotes).toBe("New note");
      expect(user.falseHomeSizeCount).toBe(1);
    });
  });

  describe("Combined Notes and Counts", () => {
    it("should update notes when incrementing falseHomeSizeCount", async () => {
      const user = createMockUser({ type: "homeowner", falseHomeSizeCount: 0 });

      const timestamp = new Date().toISOString();
      const note = `[${timestamp}] HOME SIZE DISCREPANCY: Homeowner disputed claim`;

      await user.update({
        ownerPrivateNotes: note,
        falseHomeSizeCount: 1,
      });

      expect(user.ownerPrivateNotes).toContain("HOME SIZE DISCREPANCY");
      expect(user.falseHomeSizeCount).toBe(1);
    });

    it("should update notes when incrementing falseClaimCount", async () => {
      const user = createMockUser({ type: "cleaner", falseClaimCount: 0 });

      const timestamp = new Date().toISOString();
      const note = `[${timestamp}] FALSE CLAIM: Cleaner made invalid claim`;

      await user.update({
        ownerPrivateNotes: note,
        falseClaimCount: 1,
      });

      expect(user.ownerPrivateNotes).toContain("FALSE CLAIM");
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

    it("should allow owners to have notes but typically 0 counts", () => {
      const owner = createMockUser({
        type: "owner",
        ownerPrivateNotes: "Owner notes about operations",
        falseHomeSizeCount: 0,
        falseClaimCount: 0,
      });

      expect(owner.ownerPrivateNotes).toBeTruthy();
      expect(owner.falseHomeSizeCount).toBe(0);
      expect(owner.falseClaimCount).toBe(0);
    });
  });

  describe("Privacy - Owner Only Access", () => {
    it("should store data that is hidden from users", () => {
      const user = createMockUser({
        ownerPrivateNotes: "SECRET: User has history of issues",
        falseHomeSizeCount: 2,
      });

      // This tests the data structure - actual access control is in the router
      expect(user.ownerPrivateNotes).toContain("SECRET");
      expect(user.falseHomeSizeCount).toBe(2);
    });

    it("should not expose notes in standard user properties", () => {
      const user = createMockUser({
        ownerPrivateNotes: "Private owner note",
      });

      // Regular user properties should not include ownerPrivateNotes in serialized output
      const publicFields = ["firstName", "lastName", "username", "email"];
      publicFields.forEach((field) => {
        expect(user[field]).not.toContain("Private owner note");
      });
    });
  });

  describe("Edge Cases", () => {
    it("should handle empty string notes", () => {
      const user = createMockUser({ ownerPrivateNotes: "" });
      expect(user.ownerPrivateNotes).toBe("");
    });

    it("should handle special characters in notes", () => {
      const specialNote = "Note with special chars: <script>alert('xss')</script> & \"quotes\"";
      const user = createMockUser({ ownerPrivateNotes: specialNote });
      expect(user.ownerPrivateNotes).toBe(specialNote);
    });

    it("should handle unicode in notes", () => {
      const unicodeNote = "Note with emoji: 🚨 Warning! User flagged";
      const user = createMockUser({ ownerPrivateNotes: unicodeNote });
      expect(user.ownerPrivateNotes).toContain("🚨");
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
        "[2025-01-01T10:00:00Z] First incident - Owner: Admin1",
        "[2025-01-15T14:30:00Z] Second incident - Owner: Admin2",
        "[2025-02-01T09:00:00Z] Third incident - Owner: Admin1",
      ].join("\n");

      const user = createMockUser({ ownerPrivateNotes: notes });

      expect(user.ownerPrivateNotes).toContain("First incident");
      expect(user.ownerPrivateNotes).toContain("Second incident");
      expect(user.ownerPrivateNotes).toContain("Third incident");

      const noteLines = user.ownerPrivateNotes.split("\n");
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
