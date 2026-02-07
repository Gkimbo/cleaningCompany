/**
 * ID Verification Service Tests
 */

// Mock axios
jest.mock("axios");

const axios = require("axios");
const {
  verifyIdName,
  extractTextFromImage,
  extractNamesFromText,
  namesMatch,
  normalizeName,
  calculateSimilarity,
} = require("../../services/idVerificationService");

describe("ID Verification Service", () => {
  const originalEnv = process.env;

  // Create a valid base64 string that passes the length validation (>= 100 chars)
  const validBase64 = "a".repeat(200);

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = { ...originalEnv, GOOGLE_CLOUD_VISION_API_KEY: "test-api-key" };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  describe("normalizeName", () => {
    it("should lowercase names", () => {
      expect(normalizeName("JOHN")).toBe("john");
      expect(normalizeName("John")).toBe("john");
    });

    it("should remove accents", () => {
      expect(normalizeName("José")).toBe("jose");
      expect(normalizeName("François")).toBe("francois");
      expect(normalizeName("Müller")).toBe("muller");
    });

    it("should remove suffixes", () => {
      expect(normalizeName("John Jr")).toBe("john");
      expect(normalizeName("Robert Sr")).toBe("robert");
      expect(normalizeName("William III")).toBe("william");
    });

    it("should handle punctuation", () => {
      expect(normalizeName("O'Brien")).toBe("o brien");
      expect(normalizeName("Mary-Jane")).toBe("mary jane");
    });

    it("should handle null/undefined", () => {
      expect(normalizeName(null)).toBe("");
      expect(normalizeName(undefined)).toBe("");
      expect(normalizeName("")).toBe("");
    });
  });

  describe("namesMatch", () => {
    it("should match exact names", () => {
      expect(namesMatch("John", "John")).toBe(true);
      expect(namesMatch("JOHN", "john")).toBe(true);
    });

    it("should match common nicknames", () => {
      expect(namesMatch("William", "Bill")).toBe(true);
      expect(namesMatch("Robert", "Bob")).toBe(true);
      expect(namesMatch("Elizabeth", "Liz")).toBe(true);
      expect(namesMatch("Michael", "Mike")).toBe(true);
      expect(namesMatch("Jennifer", "Jenny")).toBe(true);
    });

    it("should match reverse nicknames", () => {
      expect(namesMatch("Bill", "William")).toBe(true);
      expect(namesMatch("Bob", "Robert")).toBe(true);
    });

    it("should match names with accents", () => {
      expect(namesMatch("Jose", "José")).toBe(true);
    });

    it("should match partial names", () => {
      expect(namesMatch("John Michael", "John")).toBe(true);
      expect(namesMatch("Mary", "Mary Jane")).toBe(true);
    });

    it("should not match unrelated names", () => {
      expect(namesMatch("John", "Mary")).toBe(false);
      expect(namesMatch("William", "Jennifer")).toBe(false);
    });

    it("should match Hispanic name variations", () => {
      expect(namesMatch("Francisco", "Frank")).toBe(true);
      expect(namesMatch("Guillermo", "William")).toBe(true);
      expect(namesMatch("Miguel", "Michael")).toBe(true);
    });
  });

  describe("calculateSimilarity", () => {
    it("should return 1 for identical strings", () => {
      expect(calculateSimilarity("john", "john")).toBe(1);
    });

    it("should return high similarity for similar strings", () => {
      expect(calculateSimilarity("john", "jon")).toBeGreaterThan(0.7);
      expect(calculateSimilarity("smith", "smyth")).toBeGreaterThan(0.7);
    });

    it("should return low similarity for different strings", () => {
      expect(calculateSimilarity("john", "mary")).toBeLessThan(0.5);
    });

    it("should handle empty strings", () => {
      expect(calculateSimilarity("", "")).toBe(1);
      expect(calculateSimilarity("john", "")).toBe(0);
    });
  });

  describe("extractNamesFromText", () => {
    it("should extract names in LAST, FIRST format", () => {
      const text = "SMITH, JOHN MICHAEL\nDOB: 01/15/1990";
      const result = extractNamesFromText(text);

      expect(result.potentialNames).toContainEqual(
        expect.objectContaining({
          lastName: "SMITH",
          firstName: "JOHN",
        })
      );
    });

    it("should extract names in FIRST LAST format", () => {
      const text = "JOHN SMITH\nAddress: 123 Main St";
      const result = extractNamesFromText(text);

      expect(result.potentialNames).toContainEqual(
        expect.objectContaining({
          firstName: "JOHN",
          lastName: "SMITH",
        })
      );
    });

    it("should skip common ID labels", () => {
      const text = "DRIVER LICENSE\nJOHN SMITH\nDATE OF BIRTH";
      const result = extractNamesFromText(text);

      // Should not include "DRIVER LICENSE" or "DATE OF BIRTH" as names
      expect(result.potentialNames).not.toContainEqual(
        expect.objectContaining({ firstName: "DRIVER" })
      );
      expect(result.potentialNames).not.toContainEqual(
        expect.objectContaining({ firstName: "DATE" })
      );
    });

    it("should skip lines with mostly numbers", () => {
      const text = "JOHN SMITH\n12345678\n01/15/1990";
      const result = extractNamesFromText(text);

      expect(result.potentialNames.length).toBe(1);
      expect(result.potentialNames[0].firstName).toBe("JOHN");
    });

    it("should handle empty text", () => {
      const result = extractNamesFromText("");
      expect(result.potentialNames).toEqual([]);
      expect(result.fullText).toBe("");
    });

    it("should handle null text", () => {
      const result = extractNamesFromText(null);
      expect(result.potentialNames).toEqual([]);
    });
  });

  describe("extractTextFromImage", () => {
    it("should return empty string when API key is not set", async () => {
      process.env.GOOGLE_CLOUD_VISION_API_KEY = "";

      const result = await extractTextFromImage(validBase64);
      expect(result).toBe("");
    });

    it("should call Google Vision API with correct parameters", async () => {
      const mockResponse = {
        data: {
          responses: [
            {
              fullTextAnnotation: {
                text: "JOHN SMITH",
              },
            },
          ],
        },
      };
      axios.post.mockResolvedValue(mockResponse);

      const result = await extractTextFromImage(validBase64);

      expect(axios.post).toHaveBeenCalledWith(
        expect.stringContaining("vision.googleapis.com"),
        expect.objectContaining({
          requests: expect.arrayContaining([
            expect.objectContaining({
              image: { content: validBase64 },
            }),
          ]),
        }),
        expect.any(Object)
      );
      expect(result).toBe("JOHN SMITH");
    });

    it("should strip data URL prefix from base64", async () => {
      const mockResponse = {
        data: {
          responses: [{ fullTextAnnotation: { text: "JOHN SMITH" } }],
        },
      };
      axios.post.mockResolvedValue(mockResponse);

      // Use a valid length base64 after stripping prefix
      const longBase64 = validBase64; // Already 200 chars
      await extractTextFromImage("data:image/jpeg;base64," + longBase64);

      expect(axios.post).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          requests: [
            expect.objectContaining({
              image: { content: longBase64 },
            }),
          ],
        }),
        expect.any(Object)
      );
    });

    it("should return empty string on API error", async () => {
      axios.post.mockRejectedValue(new Error("API Error"));

      const result = await extractTextFromImage(validBase64);
      expect(result).toBe("");
    });

    it("should return empty string for invalid image data", async () => {
      const result = await extractTextFromImage("");
      expect(result).toBe("");

      const result2 = await extractTextFromImage("ab");
      expect(result2).toBe("");
    });

    it("should handle API response with textAnnotations fallback", async () => {
      const mockResponse = {
        data: {
          responses: [
            {
              textAnnotations: [{ description: "JANE DOE" }],
            },
          ],
        },
      };
      axios.post.mockResolvedValue(mockResponse);

      const result = await extractTextFromImage(validBase64);
      expect(result).toBe("JANE DOE");
    });

    it("should return empty string when no text found", async () => {
      const mockResponse = {
        data: {
          responses: [{}],
        },
      };
      axios.post.mockResolvedValue(mockResponse);

      const result = await extractTextFromImage("base64data");
      expect(result).toBe("");
    });
  });

  describe("verifyIdName", () => {
    it("should return verified=true for matching names", async () => {
      const mockResponse = {
        data: {
          responses: [
            {
              fullTextAnnotation: {
                text: "DRIVER LICENSE\nSMITH, JOHN\nDOB: 01/15/1990",
              },
            },
          ],
        },
      };
      axios.post.mockResolvedValue(mockResponse);

      const result = await verifyIdName(validBase64, "John", "Smith");

      expect(result.verified).toBe(true);
      expect(result.confidence).toBeGreaterThanOrEqual(70);
    });

    it("should return verified=true for nickname matches", async () => {
      const mockResponse = {
        data: {
          responses: [
            {
              fullTextAnnotation: {
                text: "WILLIAM JOHNSON",
              },
            },
          ],
        },
      };
      axios.post.mockResolvedValue(mockResponse);

      const result = await verifyIdName(validBase64, "Bill", "Johnson");

      expect(result.verified).toBe(true);
    });

    it("should return verified=false for non-matching names", async () => {
      const mockResponse = {
        data: {
          responses: [
            {
              fullTextAnnotation: {
                text: "JANE DOE",
              },
            },
          ],
        },
      };
      axios.post.mockResolvedValue(mockResponse);

      const result = await verifyIdName(validBase64, "John", "Smith");

      expect(result.verified).toBe(false);
      expect(result.detectedName).toEqual({
        firstName: "JANE",
        lastName: "DOE",
      });
    });

    it("should return skipped=true when no text extracted", async () => {
      axios.post.mockResolvedValue({
        data: { responses: [{}] },
      });

      const result = await verifyIdName(validBase64, "John", "Smith");

      expect(result.verified).toBeNull();
      expect(result.skipped).toBe(true);
    });

    it("should return skipped=true when no names found in text", async () => {
      axios.post.mockResolvedValue({
        data: {
          responses: [
            {
              fullTextAnnotation: {
                text: "12345678\n01/15/1990\nEXP: 12/31/2025",
              },
            },
          ],
        },
      });

      const result = await verifyIdName(validBase64, "John", "Smith");

      expect(result.verified).toBeNull();
      expect(result.skipped).toBe(true);
    });

    it("should handle API errors gracefully", async () => {
      axios.post.mockRejectedValue(new Error("Network error"));

      const result = await verifyIdName(validBase64, "John", "Smith");

      expect(result.verified).toBeNull();
      expect(result.skipped).toBe(true);
    });

    it("should include suggested names in result", async () => {
      const mockResponse = {
        data: {
          responses: [
            {
              fullTextAnnotation: {
                text: "JOHN SMITH\nJANE DOE",
              },
            },
          ],
        },
      };
      axios.post.mockResolvedValue(mockResponse);

      const result = await verifyIdName(validBase64, "John", "Smith");

      expect(result.suggestedNames.length).toBeGreaterThan(0);
    });

    it("should handle case-insensitive matching", async () => {
      const mockResponse = {
        data: {
          responses: [
            {
              fullTextAnnotation: {
                text: "john smith",
              },
            },
          ],
        },
      };
      axios.post.mockResolvedValue(mockResponse);

      const result = await verifyIdName(validBase64, "JOHN", "SMITH");

      expect(result.verified).toBe(true);
    });
  });
});
