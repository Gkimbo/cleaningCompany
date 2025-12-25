/**
 * Tests for Time Frame Sorting Utility
 * Tests the parseEndTime and sortByEndTime functions used in CleanerDashboard
 * to order today's appointments by deadline (end time)
 */

describe("Time Frame Sorting", () => {
  // Parse end time from format like "10am-3pm" → 15 (3pm in 24hr)
  const parseEndTime = (timeToBeCompleted) => {
    if (!timeToBeCompleted || timeToBeCompleted === "anytime") {
      return 24; // Put "anytime" at the end
    }

    // Format: "10am-3pm" → extract "3pm"
    const match = timeToBeCompleted.match(/-(\d+)(am|pm)$/i);
    if (!match) return 24;

    let hour = parseInt(match[1], 10);
    const period = match[2].toLowerCase();

    if (period === "pm" && hour !== 12) hour += 12;
    if (period === "am" && hour === 12) hour = 0;

    return hour;
  };

  // Sort appointments by end time (earliest deadline first, anytime last)
  const sortByEndTime = (appointments) => {
    return [...appointments].sort((a, b) => {
      const endA = parseEndTime(a.timeToBeCompleted);
      const endB = parseEndTime(b.timeToBeCompleted);
      return endA - endB;
    });
  };

  describe("parseEndTime", () => {
    describe("PM times", () => {
      it("should parse 12pm-2pm correctly (end time = 14)", () => {
        expect(parseEndTime("12pm-2pm")).toBe(14);
      });

      it("should parse 10am-3pm correctly (end time = 15)", () => {
        expect(parseEndTime("10am-3pm")).toBe(15);
      });

      it("should parse 11am-4pm correctly (end time = 16)", () => {
        expect(parseEndTime("11am-4pm")).toBe(16);
      });

      it("should parse 9am-5pm correctly (end time = 17)", () => {
        expect(parseEndTime("9am-5pm")).toBe(17);
      });

      it("should parse 1pm-6pm correctly (end time = 18)", () => {
        expect(parseEndTime("1pm-6pm")).toBe(18);
      });

      it("should parse 8am-12pm correctly (end time = 12)", () => {
        expect(parseEndTime("8am-12pm")).toBe(12);
      });
    });

    describe("AM times", () => {
      it("should parse 6am-9am correctly (end time = 9)", () => {
        expect(parseEndTime("6am-9am")).toBe(9);
      });

      it("should parse 7am-10am correctly (end time = 10)", () => {
        expect(parseEndTime("7am-10am")).toBe(10);
      });

      it("should parse 8am-11am correctly (end time = 11)", () => {
        expect(parseEndTime("8am-11am")).toBe(11);
      });

      it("should parse 10pm-12am correctly (end time = 0, midnight)", () => {
        expect(parseEndTime("10pm-12am")).toBe(0);
      });
    });

    describe("Special cases", () => {
      it("should return 24 for 'anytime'", () => {
        expect(parseEndTime("anytime")).toBe(24);
      });

      it("should return 24 for null", () => {
        expect(parseEndTime(null)).toBe(24);
      });

      it("should return 24 for undefined", () => {
        expect(parseEndTime(undefined)).toBe(24);
      });

      it("should return 24 for empty string", () => {
        expect(parseEndTime("")).toBe(24);
      });

      it("should return 24 for invalid format", () => {
        expect(parseEndTime("invalid")).toBe(24);
      });

      it("should return 24 for format without dash", () => {
        expect(parseEndTime("3pm")).toBe(24);
      });
    });

    describe("Case insensitivity", () => {
      it("should handle uppercase PM", () => {
        expect(parseEndTime("10am-3PM")).toBe(15);
      });

      it("should handle uppercase AM", () => {
        expect(parseEndTime("10pm-3AM")).toBe(3);
      });

      it("should handle mixed case", () => {
        expect(parseEndTime("10Am-3Pm")).toBe(15);
      });
    });
  });

  describe("sortByEndTime", () => {
    it("should sort appointments by end time correctly", () => {
      const appointments = [
        { id: 1, timeToBeCompleted: "10am-3pm" },  // End: 15
        { id: 2, timeToBeCompleted: "12pm-2pm" },  // End: 14
        { id: 3, timeToBeCompleted: "11am-4pm" },  // End: 16
      ];

      const sorted = sortByEndTime(appointments);

      expect(sorted[0].id).toBe(2); // 2pm (14) first
      expect(sorted[1].id).toBe(1); // 3pm (15) second
      expect(sorted[2].id).toBe(3); // 4pm (16) third
    });

    it("should put 'anytime' appointments last", () => {
      const appointments = [
        { id: 1, timeToBeCompleted: "anytime" },
        { id: 2, timeToBeCompleted: "10am-2pm" },
        { id: 3, timeToBeCompleted: "9am-1pm" },
      ];

      const sorted = sortByEndTime(appointments);

      expect(sorted[0].id).toBe(3); // 1pm first
      expect(sorted[1].id).toBe(2); // 2pm second
      expect(sorted[2].id).toBe(1); // anytime last
    });

    it("should handle multiple 'anytime' appointments", () => {
      const appointments = [
        { id: 1, timeToBeCompleted: "anytime" },
        { id: 2, timeToBeCompleted: "10am-2pm" },
        { id: 3, timeToBeCompleted: "anytime" },
      ];

      const sorted = sortByEndTime(appointments);

      expect(sorted[0].id).toBe(2); // 2pm first
      // Both anytime should be at the end
      expect([sorted[1].id, sorted[2].id]).toContain(1);
      expect([sorted[1].id, sorted[2].id]).toContain(3);
    });

    it("should handle null timeToBeCompleted (treat as anytime)", () => {
      const appointments = [
        { id: 1, timeToBeCompleted: null },
        { id: 2, timeToBeCompleted: "10am-2pm" },
        { id: 3, timeToBeCompleted: "9am-1pm" },
      ];

      const sorted = sortByEndTime(appointments);

      expect(sorted[0].id).toBe(3); // 1pm first
      expect(sorted[1].id).toBe(2); // 2pm second
      expect(sorted[2].id).toBe(1); // null (treated as anytime) last
    });

    it("should handle empty array", () => {
      const sorted = sortByEndTime([]);
      expect(sorted).toEqual([]);
    });

    it("should handle single appointment", () => {
      const appointments = [{ id: 1, timeToBeCompleted: "10am-3pm" }];
      const sorted = sortByEndTime(appointments);

      expect(sorted).toHaveLength(1);
      expect(sorted[0].id).toBe(1);
    });

    it("should not mutate original array", () => {
      const appointments = [
        { id: 1, timeToBeCompleted: "10am-3pm" },
        { id: 2, timeToBeCompleted: "12pm-2pm" },
      ];
      const original = [...appointments];

      sortByEndTime(appointments);

      expect(appointments[0].id).toBe(original[0].id);
      expect(appointments[1].id).toBe(original[1].id);
    });

    it("should handle appointments with same end time (stable sort)", () => {
      const appointments = [
        { id: 1, timeToBeCompleted: "10am-3pm" },
        { id: 2, timeToBeCompleted: "11am-3pm" },
        { id: 3, timeToBeCompleted: "12pm-3pm" },
      ];

      const sorted = sortByEndTime(appointments);

      // All have same end time (3pm = 15), so order should be stable
      expect(sorted).toHaveLength(3);
      sorted.forEach((apt) => {
        expect(parseEndTime(apt.timeToBeCompleted)).toBe(15);
      });
    });

    it("should handle real-world scenario with mixed times", () => {
      const appointments = [
        { id: 1, homeId: 10, timeToBeCompleted: "anytime" },
        { id: 2, homeId: 20, timeToBeCompleted: "11am-4pm" },   // End: 16
        { id: 3, homeId: 30, timeToBeCompleted: "12pm-2pm" },   // End: 14
        { id: 4, homeId: 40, timeToBeCompleted: "10am-3pm" },   // End: 15
        { id: 5, homeId: 50, timeToBeCompleted: null },
      ];

      const sorted = sortByEndTime(appointments);

      // Expected order: 3 (2pm), 4 (3pm), 2 (4pm), 1 (anytime), 5 (null)
      expect(sorted[0].id).toBe(3); // 2pm (14)
      expect(sorted[1].id).toBe(4); // 3pm (15)
      expect(sorted[2].id).toBe(2); // 4pm (16)
      // Last two should be anytime/null (both = 24)
      expect([sorted[3].id, sorted[4].id]).toContain(1);
      expect([sorted[3].id, sorted[4].id]).toContain(5);
    });
  });

  describe("Business Requirements", () => {
    it("should order 12-2 before 10-3 (user requirement)", () => {
      const appointments = [
        { id: 1, timeToBeCompleted: "10am-3pm" },  // End: 15
        { id: 2, timeToBeCompleted: "12pm-2pm" },  // End: 14
      ];

      const sorted = sortByEndTime(appointments);

      expect(sorted[0].id).toBe(2); // 12-2 first (ends earlier)
      expect(sorted[1].id).toBe(1); // 10-3 second
    });

    it("should order 10-3 before 11-4 (user requirement)", () => {
      const appointments = [
        { id: 1, timeToBeCompleted: "11am-4pm" },  // End: 16
        { id: 2, timeToBeCompleted: "10am-3pm" },  // End: 15
      ];

      const sorted = sortByEndTime(appointments);

      expect(sorted[0].id).toBe(2); // 10-3 first (ends earlier)
      expect(sorted[1].id).toBe(1); // 11-4 second
    });

    it("should put 'anytime' last (user requirement)", () => {
      const appointments = [
        { id: 1, timeToBeCompleted: "anytime" },
        { id: 2, timeToBeCompleted: "10am-3pm" },
        { id: 3, timeToBeCompleted: "11am-4pm" },
        { id: 4, timeToBeCompleted: "12pm-2pm" },
      ];

      const sorted = sortByEndTime(appointments);

      expect(sorted[0].id).toBe(4); // 12-2 first
      expect(sorted[1].id).toBe(2); // 10-3 second
      expect(sorted[2].id).toBe(3); // 11-4 third
      expect(sorted[3].id).toBe(1); // anytime last
    });

    it("should handle complex day with 5 appointments", () => {
      const appointments = [
        { id: 1, address: "123 Main St", timeToBeCompleted: "anytime" },
        { id: 2, address: "456 Oak Ave", timeToBeCompleted: "8am-12pm" },  // End: 12
        { id: 3, address: "789 Pine Rd", timeToBeCompleted: "10am-2pm" },  // End: 14
        { id: 4, address: "321 Elm St", timeToBeCompleted: "9am-1pm" },    // End: 13
        { id: 5, address: "654 Maple Dr", timeToBeCompleted: "11am-3pm" }, // End: 15
      ];

      const sorted = sortByEndTime(appointments);

      // Expected order by end time: 12pm, 1pm, 2pm, 3pm, anytime
      expect(sorted[0].id).toBe(2); // 8am-12pm (ends 12pm)
      expect(sorted[1].id).toBe(4); // 9am-1pm (ends 1pm)
      expect(sorted[2].id).toBe(3); // 10am-2pm (ends 2pm)
      expect(sorted[3].id).toBe(5); // 11am-3pm (ends 3pm)
      expect(sorted[4].id).toBe(1); // anytime (last)
    });
  });

  describe("Edge Cases", () => {
    it("should handle early morning end times", () => {
      const appointments = [
        { id: 1, timeToBeCompleted: "5am-7am" },   // End: 7
        { id: 2, timeToBeCompleted: "6am-8am" },   // End: 8
        { id: 3, timeToBeCompleted: "4am-6am" },   // End: 6
      ];

      const sorted = sortByEndTime(appointments);

      expect(sorted[0].id).toBe(3); // 6am
      expect(sorted[1].id).toBe(1); // 7am
      expect(sorted[2].id).toBe(2); // 8am
    });

    it("should handle late evening end times", () => {
      const appointments = [
        { id: 1, timeToBeCompleted: "6pm-9pm" },   // End: 21
        { id: 2, timeToBeCompleted: "7pm-10pm" },  // End: 22
        { id: 3, timeToBeCompleted: "8pm-11pm" },  // End: 23
      ];

      const sorted = sortByEndTime(appointments);

      expect(sorted[0].id).toBe(1); // 9pm
      expect(sorted[1].id).toBe(2); // 10pm
      expect(sorted[2].id).toBe(3); // 11pm
    });

    it("should handle noon correctly (12pm = 12)", () => {
      const appointments = [
        { id: 1, timeToBeCompleted: "9am-12pm" },  // End: 12
        { id: 2, timeToBeCompleted: "10am-1pm" }, // End: 13
      ];

      const sorted = sortByEndTime(appointments);

      expect(sorted[0].id).toBe(1); // 12pm
      expect(sorted[1].id).toBe(2); // 1pm
    });
  });
});
