const SuspiciousContentDetector = require("../../services/SuspiciousContentDetector");

describe("SuspiciousContentDetector", () => {
  describe("detect", () => {
    describe("phone number detection", () => {
      it("should detect standard US phone format with dashes", () => {
        const result = SuspiciousContentDetector.detect(
          "Call me at 123-456-7890"
        );
        expect(result.isSuspicious).toBe(true);
        expect(result.types).toContain("phone_number");
      });

      it("should detect phone format with dots", () => {
        const result = SuspiciousContentDetector.detect(
          "My number is 123.456.7890"
        );
        expect(result.isSuspicious).toBe(true);
        expect(result.types).toContain("phone_number");
      });

      it("should detect phone format with parentheses", () => {
        const result = SuspiciousContentDetector.detect(
          "Reach me at (123) 456-7890"
        );
        expect(result.isSuspicious).toBe(true);
        expect(result.types).toContain("phone_number");
      });

      it("should detect phone format without separators", () => {
        const result = SuspiciousContentDetector.detect(
          "Text 1234567890 for more info"
        );
        expect(result.isSuspicious).toBe(true);
        expect(result.types).toContain("phone_number");
      });

      it("should detect phone format with +1 prefix", () => {
        const result = SuspiciousContentDetector.detect(
          "International: +1 123-456-7890"
        );
        expect(result.isSuspicious).toBe(true);
        expect(result.types).toContain("phone_number");
      });

      it("should detect phone format with spaces", () => {
        const result = SuspiciousContentDetector.detect(
          "My phone is 123 456 7890"
        );
        expect(result.isSuspicious).toBe(true);
        expect(result.types).toContain("phone_number");
      });
    });

    describe("email detection", () => {
      it("should detect standard email format", () => {
        const result = SuspiciousContentDetector.detect(
          "Email me at john@example.com"
        );
        expect(result.isSuspicious).toBe(true);
        expect(result.types).toContain("email");
      });

      it("should detect email with subdomain", () => {
        const result = SuspiciousContentDetector.detect(
          "Contact: jane@mail.example.com"
        );
        expect(result.isSuspicious).toBe(true);
        expect(result.types).toContain("email");
      });

      it("should detect email with plus sign", () => {
        const result = SuspiciousContentDetector.detect(
          "Reach out to user+tag@gmail.com"
        );
        expect(result.isSuspicious).toBe(true);
        expect(result.types).toContain("email");
      });

      it("should detect email with dots in local part", () => {
        const result = SuspiciousContentDetector.detect(
          "Send to first.last@company.org"
        );
        expect(result.isSuspicious).toBe(true);
        expect(result.types).toContain("email");
      });
    });

    describe("off-platform keywords detection", () => {
      it("should detect venmo mention", () => {
        const result = SuspiciousContentDetector.detect(
          "You can pay me on venmo"
        );
        expect(result.isSuspicious).toBe(true);
        expect(result.types).toContain("off_platform");
      });

      it("should detect cash app mention", () => {
        const result = SuspiciousContentDetector.detect(
          "Send it via cash app please"
        );
        expect(result.isSuspicious).toBe(true);
        expect(result.types).toContain("off_platform");
      });

      it("should detect cashapp without space", () => {
        const result = SuspiciousContentDetector.detect(
          "My cashapp is @username"
        );
        expect(result.isSuspicious).toBe(true);
        expect(result.types).toContain("off_platform");
      });

      it("should detect paypal mention", () => {
        const result = SuspiciousContentDetector.detect(
          "I accept PayPal payments"
        );
        expect(result.isSuspicious).toBe(true);
        expect(result.types).toContain("off_platform");
      });

      it("should detect zelle mention", () => {
        const result = SuspiciousContentDetector.detect(
          "Pay via Zelle to my account"
        );
        expect(result.isSuspicious).toBe(true);
        expect(result.types).toContain("off_platform");
      });

      it("should detect 'text me' phrase", () => {
        const result = SuspiciousContentDetector.detect(
          "Just text me when you're ready"
        );
        expect(result.isSuspicious).toBe(true);
        expect(result.types).toContain("off_platform");
      });

      it("should detect 'call me' phrase", () => {
        const result = SuspiciousContentDetector.detect(
          "Call me to discuss details"
        );
        expect(result.isSuspicious).toBe(true);
        expect(result.types).toContain("off_platform");
      });

      it("should detect 'my number' phrase", () => {
        const result = SuspiciousContentDetector.detect(
          "Here's my number for future reference"
        );
        expect(result.isSuspicious).toBe(true);
        expect(result.types).toContain("off_platform");
      });

      it("should detect 'my phone number is' phrase", () => {
        const result = SuspiciousContentDetector.detect(
          "My phone number is for emergencies"
        );
        expect(result.isSuspicious).toBe(true);
        expect(result.types).toContain("off_platform");
      });

      it("should detect 'off the app' phrase", () => {
        const result = SuspiciousContentDetector.detect(
          "Let's communicate off the app"
        );
        expect(result.isSuspicious).toBe(true);
        expect(result.types).toContain("off_platform");
      });

      it("should detect 'outside the app' phrase", () => {
        const result = SuspiciousContentDetector.detect(
          "We can talk outside the app"
        );
        expect(result.isSuspicious).toBe(true);
        expect(result.types).toContain("off_platform");
      });

      it("should detect 'pay cash' phrase", () => {
        const result = SuspiciousContentDetector.detect(
          "You can pay cash instead"
        );
        expect(result.isSuspicious).toBe(true);
        expect(result.types).toContain("off_platform");
      });

      it("should detect 'pay directly' phrase", () => {
        const result = SuspiciousContentDetector.detect(
          "Just pay me directly next time"
        );
        expect(result.isSuspicious).toBe(true);
        expect(result.types).toContain("off_platform");
      });

      it("should detect whatsapp mention", () => {
        const result = SuspiciousContentDetector.detect(
          "Message me on WhatsApp"
        );
        expect(result.isSuspicious).toBe(true);
        expect(result.types).toContain("off_platform");
      });

      it("should detect telegram mention", () => {
        const result = SuspiciousContentDetector.detect(
          "Find me on Telegram @user"
        );
        expect(result.isSuspicious).toBe(true);
        expect(result.types).toContain("off_platform");
      });

      it("should detect signal mention", () => {
        const result = SuspiciousContentDetector.detect(
          "Let's use Signal for privacy"
        );
        expect(result.isSuspicious).toBe(true);
        expect(result.types).toContain("off_platform");
      });
    });

    describe("multiple suspicious types", () => {
      it("should detect both phone and email", () => {
        const result = SuspiciousContentDetector.detect(
          "Call 123-456-7890 or email test@example.com"
        );
        expect(result.isSuspicious).toBe(true);
        expect(result.types).toContain("phone_number");
        expect(result.types).toContain("email");
      });

      it("should detect phone and off-platform keyword", () => {
        const result = SuspiciousContentDetector.detect(
          "Text me at 123-456-7890"
        );
        expect(result.isSuspicious).toBe(true);
        expect(result.types).toContain("phone_number");
        expect(result.types).toContain("off_platform");
      });

      it("should detect all three types", () => {
        const result = SuspiciousContentDetector.detect(
          "Text me at 123-456-7890 or email@test.com, I accept venmo"
        );
        expect(result.isSuspicious).toBe(true);
        expect(result.types).toContain("phone_number");
        expect(result.types).toContain("email");
        expect(result.types).toContain("off_platform");
      });
    });

    describe("non-suspicious messages", () => {
      it("should not flag normal conversation", () => {
        const result = SuspiciousContentDetector.detect(
          "I'll be there at 3pm tomorrow"
        );
        expect(result.isSuspicious).toBe(false);
        expect(result.types).toEqual([]);
      });

      it("should not flag cleaning discussion", () => {
        const result = SuspiciousContentDetector.detect(
          "Please focus on the kitchen and bathrooms"
        );
        expect(result.isSuspicious).toBe(false);
        expect(result.types).toEqual([]);
      });

      it("should not flag scheduling message", () => {
        const result = SuspiciousContentDetector.detect(
          "Can we reschedule to next Tuesday?"
        );
        expect(result.isSuspicious).toBe(false);
        expect(result.types).toEqual([]);
      });

      it("should not flag short numbers that are not phone numbers", () => {
        const result = SuspiciousContentDetector.detect(
          "Meet at apartment 123"
        );
        expect(result.isSuspicious).toBe(false);
        expect(result.types).toEqual([]);
      });

      it("should not flag prices or amounts", () => {
        const result = SuspiciousContentDetector.detect(
          "The cleaning will cost $150"
        );
        expect(result.isSuspicious).toBe(false);
        expect(result.types).toEqual([]);
      });
    });

    describe("edge cases", () => {
      it("should handle null input", () => {
        const result = SuspiciousContentDetector.detect(null);
        expect(result.isSuspicious).toBe(false);
        expect(result.types).toEqual([]);
      });

      it("should handle undefined input", () => {
        const result = SuspiciousContentDetector.detect(undefined);
        expect(result.isSuspicious).toBe(false);
        expect(result.types).toEqual([]);
      });

      it("should handle empty string", () => {
        const result = SuspiciousContentDetector.detect("");
        expect(result.isSuspicious).toBe(false);
        expect(result.types).toEqual([]);
      });

      it("should handle non-string input", () => {
        const result = SuspiciousContentDetector.detect(12345);
        expect(result.isSuspicious).toBe(false);
        expect(result.types).toEqual([]);
      });

      it("should be case insensitive for keywords", () => {
        const result = SuspiciousContentDetector.detect("PAY ME ON VENMO");
        expect(result.isSuspicious).toBe(true);
        expect(result.types).toContain("off_platform");
      });
    });
  });

  describe("getDescription", () => {
    it("should return empty string for no types", () => {
      const result = SuspiciousContentDetector.getDescription([]);
      expect(result).toBe("");
    });

    it("should return single type description", () => {
      const result = SuspiciousContentDetector.getDescription(["phone_number"]);
      expect(result).toBe("phone number");
    });

    it("should return two types joined with 'and'", () => {
      const result = SuspiciousContentDetector.getDescription([
        "phone_number",
        "email",
      ]);
      expect(result).toBe("phone number and email address");
    });

    it("should return three types with commas and 'and'", () => {
      const result = SuspiciousContentDetector.getDescription([
        "phone_number",
        "email",
        "off_platform",
      ]);
      expect(result).toBe(
        "phone number, email address, and off-platform communication attempt"
      );
    });

    it("should handle null input", () => {
      const result = SuspiciousContentDetector.getDescription(null);
      expect(result).toBe("");
    });
  });
});
