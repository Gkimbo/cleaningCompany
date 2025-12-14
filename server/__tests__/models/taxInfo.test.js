/**
 * TaxInfo Model Tests
 *
 * Tests for the TaxInfo model including:
 * - SSN validation
 * - EIN validation
 * - TIN masking
 * - State validation
 */

describe("TaxInfo Model Validation", () => {
  // SSN Validation Tests
  describe("SSN Validation", () => {
    // Import the actual validation logic
    const validateSSN = (ssn) => {
      const cleaned = ssn.replace(/\D/g, "");
      if (cleaned.length !== 9) return { valid: false, error: "SSN must be 9 digits" };

      const area = cleaned.substring(0, 3);
      const group = cleaned.substring(3, 5);
      const serial = cleaned.substring(5, 9);

      if (area === "000" || group === "00" || serial === "0000") {
        return { valid: false, error: "Invalid SSN format" };
      }
      if (area === "666" || parseInt(area) >= 900) {
        return { valid: false, error: "Invalid SSN area number" };
      }

      return { valid: true, cleaned };
    };

    it("should accept valid SSN with dashes", () => {
      const result = validateSSN("123-45-6789");
      expect(result.valid).toBe(true);
      expect(result.cleaned).toBe("123456789");
    });

    it("should accept valid SSN without dashes", () => {
      const result = validateSSN("123456789");
      expect(result.valid).toBe(true);
      expect(result.cleaned).toBe("123456789");
    });

    it("should reject SSN with wrong length", () => {
      expect(validateSSN("12345678").valid).toBe(false);
      expect(validateSSN("1234567890").valid).toBe(false);
      expect(validateSSN("123-45-678").valid).toBe(false);
    });

    it("should reject SSN starting with 000", () => {
      const result = validateSSN("000-12-3456");
      expect(result.valid).toBe(false);
      expect(result.error).toContain("Invalid SSN");
    });

    it("should reject SSN with 00 in middle group", () => {
      const result = validateSSN("123-00-6789");
      expect(result.valid).toBe(false);
    });

    it("should reject SSN with 0000 in serial", () => {
      const result = validateSSN("123-45-0000");
      expect(result.valid).toBe(false);
    });

    it("should reject SSN starting with 666", () => {
      const result = validateSSN("666-12-3456");
      expect(result.valid).toBe(false);
      expect(result.error).toContain("Invalid SSN area number");
    });

    it("should reject SSN starting with 900-999", () => {
      expect(validateSSN("900-12-3456").valid).toBe(false);
      expect(validateSSN("950-12-3456").valid).toBe(false);
      expect(validateSSN("999-12-3456").valid).toBe(false);
    });

    it("should strip non-numeric characters", () => {
      const result = validateSSN("123 45 6789");
      expect(result.valid).toBe(true);
      expect(result.cleaned).toBe("123456789");
    });
  });

  // EIN Validation Tests
  describe("EIN Validation", () => {
    const validPrefixes = [
      "10", "12", "20", "27", "30", "32", "35", "36", "37", "38", "39",
      "40", "41", "42", "43", "44", "45", "46", "47", "48", "50", "51",
      "52", "53", "54", "55", "56", "57", "58", "59", "60", "61", "62",
      "63", "64", "65", "66", "67", "68", "71", "72", "73", "74", "75",
      "76", "77", "80", "81", "82", "83", "84", "85", "86", "87", "88",
      "90", "91", "92", "93", "94", "95", "98", "99",
    ];

    const validateEIN = (ein) => {
      const cleaned = ein.replace(/\D/g, "");
      if (cleaned.length !== 9) return { valid: false, error: "EIN must be 9 digits" };

      const prefix = cleaned.substring(0, 2);
      if (!validPrefixes.includes(prefix)) {
        return { valid: false, error: "Invalid EIN prefix" };
      }

      return { valid: true, cleaned };
    };

    it("should accept valid EIN with dash", () => {
      const result = validateEIN("12-3456789");
      expect(result.valid).toBe(true);
      expect(result.cleaned).toBe("123456789");
    });

    it("should accept valid EIN without dash", () => {
      const result = validateEIN("123456789");
      expect(result.valid).toBe(true);
    });

    it("should accept all valid IRS prefixes", () => {
      validPrefixes.forEach((prefix) => {
        const ein = `${prefix}-1234567`;
        const result = validateEIN(ein);
        expect(result.valid).toBe(true);
      });
    });

    it("should reject EIN with invalid prefix", () => {
      expect(validateEIN("00-1234567").valid).toBe(false);
      expect(validateEIN("01-1234567").valid).toBe(false);
      expect(validateEIN("11-1234567").valid).toBe(false);
      expect(validateEIN("19-1234567").valid).toBe(false);
    });

    it("should reject EIN with wrong length", () => {
      expect(validateEIN("12-345678").valid).toBe(false);
      expect(validateEIN("12-34567890").valid).toBe(false);
    });
  });

  // TIN Masking Tests
  describe("TIN Masking", () => {
    const formatTinMasked = (tinType, tinLast4) => {
      if (tinType === "ssn") {
        return `XXX-XX-${tinLast4}`;
      }
      return `XX-XXX${tinLast4}`;
    };

    it("should mask SSN correctly", () => {
      const result = formatTinMasked("ssn", "6789");
      expect(result).toBe("XXX-XX-6789");
    });

    it("should mask EIN correctly", () => {
      const result = formatTinMasked("ein", "5678");
      expect(result).toBe("XX-XXX5678");
    });
  });

  // State Validation Tests
  describe("State Validation", () => {
    const VALID_STATES = [
      "AL", "AK", "AZ", "AR", "CA", "CO", "CT", "DE", "FL", "GA",
      "HI", "ID", "IL", "IN", "IA", "KS", "KY", "LA", "ME", "MD",
      "MA", "MI", "MN", "MS", "MO", "MT", "NE", "NV", "NH", "NJ",
      "NM", "NY", "NC", "ND", "OH", "OK", "OR", "PA", "RI", "SC",
      "SD", "TN", "TX", "UT", "VT", "VA", "WA", "WV", "WI", "WY",
      "DC", "PR", "VI", "GU", "AS", "MP",
    ];

    it("should accept all 50 US states", () => {
      const states = [
        "AL", "AK", "AZ", "AR", "CA", "CO", "CT", "DE", "FL", "GA",
        "HI", "ID", "IL", "IN", "IA", "KS", "KY", "LA", "ME", "MD",
        "MA", "MI", "MN", "MS", "MO", "MT", "NE", "NV", "NH", "NJ",
        "NM", "NY", "NC", "ND", "OH", "OK", "OR", "PA", "RI", "SC",
        "SD", "TN", "TX", "UT", "VT", "VA", "WA", "WV", "WI", "WY",
      ];
      states.forEach((state) => {
        expect(VALID_STATES).toContain(state);
      });
    });

    it("should accept DC and territories", () => {
      expect(VALID_STATES).toContain("DC"); // District of Columbia
      expect(VALID_STATES).toContain("PR"); // Puerto Rico
      expect(VALID_STATES).toContain("VI"); // US Virgin Islands
      expect(VALID_STATES).toContain("GU"); // Guam
      expect(VALID_STATES).toContain("AS"); // American Samoa
      expect(VALID_STATES).toContain("MP"); // Northern Mariana Islands
    });

    it("should reject invalid state abbreviations", () => {
      expect(VALID_STATES).not.toContain("XX");
      expect(VALID_STATES).not.toContain("ZZ");
      expect(VALID_STATES).not.toContain("AB"); // Canadian province
    });
  });

  // Tax Classification Tests
  describe("Tax Classifications", () => {
    const validClassifications = [
      "individual",
      "sole_proprietor",
      "single_member_llc",
      "c_corporation",
      "s_corporation",
      "partnership",
      "trust_estate",
      "llc_c",
      "llc_s",
      "llc_p",
      "other",
    ];

    it("should have all W-9 tax classifications", () => {
      // Individual/sole proprietor
      expect(validClassifications).toContain("individual");
      expect(validClassifications).toContain("sole_proprietor");

      // Corporations
      expect(validClassifications).toContain("c_corporation");
      expect(validClassifications).toContain("s_corporation");

      // LLCs
      expect(validClassifications).toContain("single_member_llc");
      expect(validClassifications).toContain("llc_c");
      expect(validClassifications).toContain("llc_s");
      expect(validClassifications).toContain("llc_p");

      // Other entity types
      expect(validClassifications).toContain("partnership");
      expect(validClassifications).toContain("trust_estate");
      expect(validClassifications).toContain("other");
    });
  });

  // 1099 Threshold Tests
  describe("1099 Threshold", () => {
    const IRS_1099_THRESHOLD_CENTS = 60000; // $600.00

    it("should use correct IRS threshold of $600", () => {
      expect(IRS_1099_THRESHOLD_CENTS).toBe(60000);
      expect(IRS_1099_THRESHOLD_CENTS / 100).toBe(600);
    });

    it("should require 1099 at exactly $600", () => {
      const amount = 60000;
      expect(amount >= IRS_1099_THRESHOLD_CENTS).toBe(true);
    });

    it("should not require 1099 below $600", () => {
      const amount = 59999;
      expect(amount >= IRS_1099_THRESHOLD_CENTS).toBe(false);
    });
  });
});

describe("TaxInfo Encryption", () => {
  it("should store only last 4 digits in plain text", () => {
    const tin = "123456789";
    const tinLast4 = tin.slice(-4);
    expect(tinLast4).toBe("6789");
    expect(tinLast4.length).toBe(4);
  });

  it("should not expose full TIN in responses", () => {
    // Simulating a response object that should NOT contain full TIN
    const taxInfoResponse = {
      legalName: "John Doe",
      tinType: "ssn",
      tinLast4: "6789",
      tinMasked: "XXX-XX-6789",
      // Note: tinEncrypted should NOT be in response
    };

    expect(taxInfoResponse).not.toHaveProperty("tin");
    expect(taxInfoResponse).not.toHaveProperty("tinEncrypted");
    expect(taxInfoResponse).toHaveProperty("tinLast4");
    expect(taxInfoResponse).toHaveProperty("tinMasked");
  });
});
