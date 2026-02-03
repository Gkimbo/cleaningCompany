const { normalizePhone, formatPhoneForDisplay, isInternationalPhone } = require("../../utils/phoneUtils");

describe("phoneUtils", () => {
  describe("normalizePhone", () => {
    describe("US numbers", () => {
      it("should normalize a 10-digit US number with dashes", () => {
        expect(normalizePhone("555-555-5555")).toBe("5555555555");
      });

      it("should normalize a 10-digit US number with parentheses", () => {
        expect(normalizePhone("(555) 555-5555")).toBe("5555555555");
      });

      it("should normalize a 10-digit US number with dots", () => {
        expect(normalizePhone("555.555.5555")).toBe("5555555555");
      });

      it("should normalize a 10-digit US number with spaces", () => {
        expect(normalizePhone("555 555 5555")).toBe("5555555555");
      });

      it("should normalize a plain 10-digit US number", () => {
        expect(normalizePhone("5555555555")).toBe("5555555555");
      });

      it("should convert 11-digit US number starting with 1 to +1 format", () => {
        expect(normalizePhone("15555555555")).toBe("+15555555555");
      });

      it("should convert 1-800 number to +1 format", () => {
        expect(normalizePhone("1-800-555-5555")).toBe("+18005555555");
      });
    });

    describe("international numbers", () => {
      it("should preserve + prefix for international numbers", () => {
        expect(normalizePhone("+44 20 7123 4567")).toBe("+442071234567");
      });

      it("should normalize UK number with +44", () => {
        expect(normalizePhone("+44 (0) 20 7123 4567")).toBe("+4402071234567");
      });

      it("should normalize German number", () => {
        expect(normalizePhone("+49 30 12345678")).toBe("+493012345678");
      });

      it("should normalize French number", () => {
        expect(normalizePhone("+33 1 23 45 67 89")).toBe("+33123456789");
      });

      it("should normalize Australian number", () => {
        expect(normalizePhone("+61 2 1234 5678")).toBe("+61212345678");
      });

      it("should normalize Canadian number (same format as US)", () => {
        expect(normalizePhone("+1 416 555 1234")).toBe("+14165551234");
      });

      it("should handle +1 US number", () => {
        expect(normalizePhone("+1 555-555-5555")).toBe("+15555555555");
      });

      it("should treat numbers > 10 digits without + as international", () => {
        expect(normalizePhone("442071234567")).toBe("+442071234567");
      });
    });

    describe("edge cases", () => {
      it("should return null for null input", () => {
        expect(normalizePhone(null)).toBeNull();
      });

      it("should return null for undefined input", () => {
        expect(normalizePhone(undefined)).toBeNull();
      });

      it("should return null for empty string", () => {
        expect(normalizePhone("")).toBeNull();
      });

      it("should return null for string with no digits", () => {
        expect(normalizePhone("abc-def-ghij")).toBeNull();
      });

      it("should return null for non-string input", () => {
        expect(normalizePhone(5555555555)).toBeNull();
        expect(normalizePhone({})).toBeNull();
        expect(normalizePhone([])).toBeNull();
      });

      it("should handle whitespace-only input", () => {
        expect(normalizePhone("   ")).toBeNull();
      });

      it("should trim whitespace", () => {
        expect(normalizePhone("  555-555-5555  ")).toBe("5555555555");
      });

      it("should handle short numbers (extensions)", () => {
        expect(normalizePhone("1234")).toBe("1234");
      });

      it("should handle 7-digit local numbers", () => {
        expect(normalizePhone("555-1234")).toBe("5551234");
      });
    });
  });

  describe("formatPhoneForDisplay", () => {
    describe("US numbers", () => {
      it("should format 10-digit number as 555-555-5555", () => {
        expect(formatPhoneForDisplay("5555555555")).toBe("555-555-5555");
      });

      it("should format already formatted number correctly", () => {
        expect(formatPhoneForDisplay("555-555-5555")).toBe("555-555-5555");
      });

      it("should format +1 US number with spaces and dashes", () => {
        expect(formatPhoneForDisplay("+15555555555")).toBe("+1 555-555-5555");
      });

      it("should format +1 number stored with spaces", () => {
        expect(formatPhoneForDisplay("+1 5555555555")).toBe("+1 555-555-5555");
      });
    });

    describe("international numbers", () => {
      it("should format UK number with country code and spaces", () => {
        const formatted = formatPhoneForDisplay("+442071234567");
        expect(formatted).toMatch(/^\+44/);
        expect(formatted).toContain(" ");
      });

      it("should format German number", () => {
        const formatted = formatPhoneForDisplay("+493012345678");
        expect(formatted).toMatch(/^\+49/);
      });

      it("should format short international number", () => {
        const formatted = formatPhoneForDisplay("+331234");
        expect(formatted).toMatch(/^\+33/);
      });
    });

    describe("edge cases", () => {
      it("should return empty string for null", () => {
        expect(formatPhoneForDisplay(null)).toBe("");
      });

      it("should return empty string for undefined", () => {
        expect(formatPhoneForDisplay(undefined)).toBe("");
      });

      it("should return empty string for empty string", () => {
        expect(formatPhoneForDisplay("")).toBe("");
      });

      it("should return original for unformatted short number", () => {
        expect(formatPhoneForDisplay("1234")).toBe("1234");
      });

      it("should handle 7-digit numbers", () => {
        expect(formatPhoneForDisplay("5551234")).toBe("5551234");
      });
    });
  });

  describe("isInternationalPhone", () => {
    it("should return true for numbers starting with +", () => {
      expect(isInternationalPhone("+442071234567")).toBe(true);
      expect(isInternationalPhone("+1 555-555-5555")).toBe(true);
    });

    it("should return true for numbers with more than 10 digits", () => {
      expect(isInternationalPhone("442071234567")).toBe(true);
      expect(isInternationalPhone("15555555555")).toBe(true);
    });

    it("should return false for standard US 10-digit numbers", () => {
      expect(isInternationalPhone("5555555555")).toBe(false);
      expect(isInternationalPhone("555-555-5555")).toBe(false);
    });

    it("should return false for null/undefined/empty", () => {
      expect(isInternationalPhone(null)).toBe(false);
      expect(isInternationalPhone(undefined)).toBe(false);
      expect(isInternationalPhone("")).toBe(false);
    });

    it("should return false for short numbers", () => {
      expect(isInternationalPhone("1234")).toBe(false);
      expect(isInternationalPhone("5551234")).toBe(false);
    });
  });

  describe("round-trip normalization and formatting", () => {
    it("should normalize and format US number correctly", () => {
      const original = "(555) 555-5555";
      const normalized = normalizePhone(original);
      const formatted = formatPhoneForDisplay(normalized);
      expect(formatted).toBe("555-555-5555");
    });

    it("should normalize and format +1 US number correctly", () => {
      const original = "+1 (555) 555-5555";
      const normalized = normalizePhone(original);
      const formatted = formatPhoneForDisplay(normalized);
      expect(formatted).toBe("+1 555-555-5555");
    });

    it("should normalize and format UK number correctly", () => {
      const original = "+44 20 7123 4567";
      const normalized = normalizePhone(original);
      expect(normalized).toBe("+442071234567");
      const formatted = formatPhoneForDisplay(normalized);
      expect(formatted).toMatch(/^\+44/);
    });

    it("should handle multiple normalizations idempotently", () => {
      const phone = "555-555-5555";
      const first = normalizePhone(phone);
      const second = normalizePhone(first);
      expect(first).toBe(second);
    });
  });
});
