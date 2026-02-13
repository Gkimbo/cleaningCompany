/**
 * Tests for linensUtils.js
 * Utility functions for handling sheets and towels display,
 * especially for multi-cleaner jobs.
 */

import {
  formatBedSizes,
  filterBedsForCleaner,
  filterBathroomsForCleaner,
  getTowelTotals,
  getEffectiveSheetConfigs,
  getEffectiveTowelConfigs,
  calculateLinensFromRoomCounts,
  calculateMultiCleanerLinens,
} from "../../src/utils/linensUtils";

describe("linensUtils", () => {
  describe("formatBedSizes", () => {
    it("should return empty string for null/undefined input", () => {
      expect(formatBedSizes(null)).toBe("");
      expect(formatBedSizes(undefined)).toBe("");
    });

    it("should return empty string for empty array", () => {
      expect(formatBedSizes([])).toBe("");
    });

    it("should format single bed size correctly", () => {
      const beds = [{ bedNumber: 1, size: "queen", needsSheets: true }];
      expect(formatBedSizes(beds)).toBe("1 Queen");
    });

    it("should group multiple beds of same size", () => {
      const beds = [
        { bedNumber: 1, size: "queen", needsSheets: true },
        { bedNumber: 2, size: "queen", needsSheets: true },
      ];
      expect(formatBedSizes(beds)).toBe("2 Queen");
    });

    it("should format multiple different bed sizes", () => {
      const beds = [
        { bedNumber: 1, size: "queen", needsSheets: true },
        { bedNumber: 2, size: "king", needsSheets: true },
        { bedNumber: 3, size: "full", needsSheets: true },
      ];
      const result = formatBedSizes(beds);
      expect(result).toContain("1 Queen");
      expect(result).toContain("1 King");
      expect(result).toContain("1 Full");
    });

    it("should handle california_king formatting", () => {
      const beds = [{ bedNumber: 1, size: "california_king", needsSheets: true }];
      expect(formatBedSizes(beds)).toBe("1 California King");
    });

    it("should exclude beds where needsSheets is false", () => {
      const beds = [
        { bedNumber: 1, size: "queen", needsSheets: true },
        { bedNumber: 2, size: "king", needsSheets: false },
      ];
      expect(formatBedSizes(beds)).toBe("1 Queen");
    });

    it("should parse JSON string input", () => {
      const bedsJson = JSON.stringify([{ bedNumber: 1, size: "queen", needsSheets: true }]);
      expect(formatBedSizes(bedsJson)).toBe("1 Queen");
    });

    it("should handle invalid JSON gracefully", () => {
      expect(formatBedSizes("invalid json")).toBe("");
    });
  });

  describe("filterBedsForCleaner", () => {
    const allBeds = [
      { bedNumber: 1, size: "queen" },
      { bedNumber: 2, size: "king" },
      { bedNumber: 3, size: "full" },
    ];

    it("should return all beds when no room assignments", () => {
      expect(filterBedsForCleaner(allBeds, null)).toEqual(allBeds);
      expect(filterBedsForCleaner(allBeds, [])).toEqual(allBeds);
    });

    it("should filter beds based on assigned bedrooms", () => {
      const roomAssignments = [
        { roomType: "bedroom", roomNumber: 1 },
        { roomType: "bedroom", roomNumber: 3 },
        { roomType: "bathroom", roomNumber: 1 },
      ];
      const result = filterBedsForCleaner(allBeds, roomAssignments);
      expect(result).toHaveLength(2);
      expect(result.map((b) => b.bedNumber)).toEqual([1, 3]);
    });

    it("should return all beds when no bedrooms in assignments", () => {
      const roomAssignments = [
        { roomType: "bathroom", roomNumber: 1 },
        { roomType: "kitchen", roomNumber: 1 },
      ];
      expect(filterBedsForCleaner(allBeds, roomAssignments)).toEqual(allBeds);
    });

    it("should handle JSON string input", () => {
      const bedsJson = JSON.stringify(allBeds);
      const roomAssignments = [{ roomType: "bedroom", roomNumber: 2 }];
      const result = filterBedsForCleaner(bedsJson, roomAssignments);
      expect(result).toHaveLength(1);
      expect(result[0].bedNumber).toBe(2);
    });
  });

  describe("filterBathroomsForCleaner", () => {
    const allBathrooms = [
      { bathroomNumber: 1, towels: 2, faceCloths: 2 },
      { bathroomNumber: 2, towels: 2, faceCloths: 2 },
      { bathroomNumber: 3, towels: 2, faceCloths: 2 },
    ];

    it("should return all bathrooms when no room assignments", () => {
      expect(filterBathroomsForCleaner(allBathrooms, null)).toEqual(allBathrooms);
      expect(filterBathroomsForCleaner(allBathrooms, [])).toEqual(allBathrooms);
    });

    it("should filter bathrooms based on assigned bathrooms", () => {
      const roomAssignments = [
        { roomType: "bathroom", roomNumber: 1 },
        { roomType: "bathroom", roomNumber: 2 },
        { roomType: "bedroom", roomNumber: 1 },
      ];
      const result = filterBathroomsForCleaner(allBathrooms, roomAssignments);
      expect(result).toHaveLength(2);
      expect(result.map((b) => b.bathroomNumber)).toEqual([1, 2]);
    });

    it("should return all bathrooms when no bathrooms in assignments", () => {
      const roomAssignments = [
        { roomType: "bedroom", roomNumber: 1 },
        { roomType: "kitchen", roomNumber: 1 },
      ];
      expect(filterBathroomsForCleaner(allBathrooms, roomAssignments)).toEqual(allBathrooms);
    });
  });

  describe("getTowelTotals", () => {
    it("should return zeros for empty input", () => {
      expect(getTowelTotals(null)).toEqual({ towels: 0, faceCloths: 0 });
      expect(getTowelTotals([])).toEqual({ towels: 0, faceCloths: 0 });
    });

    it("should sum towels and faceCloths correctly", () => {
      const bathrooms = [
        { bathroomNumber: 1, towels: 2, faceCloths: 3 },
        { bathroomNumber: 2, towels: 4, faceCloths: 2 },
      ];
      expect(getTowelTotals(bathrooms)).toEqual({ towels: 6, faceCloths: 5 });
    });

    it("should handle missing values as zero", () => {
      const bathrooms = [
        { bathroomNumber: 1, towels: 2 },
        { bathroomNumber: 2, faceCloths: 3 },
      ];
      expect(getTowelTotals(bathrooms)).toEqual({ towels: 2, faceCloths: 3 });
    });

    it("should parse JSON string input", () => {
      const bathroomsJson = JSON.stringify([
        { bathroomNumber: 1, towels: 2, faceCloths: 2 },
      ]);
      expect(getTowelTotals(bathroomsJson)).toEqual({ towels: 2, faceCloths: 2 });
    });
  });

  describe("getEffectiveSheetConfigs", () => {
    const allSheets = [
      { bedNumber: 1, size: "queen" },
      { bedNumber: 2, size: "king" },
    ];

    it("should return all sheets for solo jobs", () => {
      expect(getEffectiveSheetConfigs(allSheets, null, false)).toEqual(allSheets);
    });

    it("should return all sheets when no room assignments for multi-cleaner", () => {
      expect(getEffectiveSheetConfigs(allSheets, [], true)).toEqual(allSheets);
    });

    it("should filter sheets for multi-cleaner jobs with assignments", () => {
      const roomAssignments = [{ roomType: "bedroom", roomNumber: 1 }];
      const result = getEffectiveSheetConfigs(allSheets, roomAssignments, true);
      expect(result).toHaveLength(1);
      expect(result[0].bedNumber).toBe(1);
    });
  });

  describe("getEffectiveTowelConfigs", () => {
    const allTowels = [
      { bathroomNumber: 1, towels: 2 },
      { bathroomNumber: 2, towels: 2 },
    ];

    it("should return all towels for solo jobs", () => {
      expect(getEffectiveTowelConfigs(allTowels, null, false)).toEqual(allTowels);
    });

    it("should filter towels for multi-cleaner jobs with assignments", () => {
      const roomAssignments = [{ roomType: "bathroom", roomNumber: 2 }];
      const result = getEffectiveTowelConfigs(allTowels, roomAssignments, true);
      expect(result).toHaveLength(1);
      expect(result[0].bathroomNumber).toBe(2);
    });
  });

  describe("calculateLinensFromRoomCounts", () => {
    it("should return no linens when neither sheets nor towels needed", () => {
      const result = calculateLinensFromRoomCounts({
        assignedBedrooms: 2,
        assignedBathrooms: 2,
        bringSheets: false,
        bringTowels: false,
      });
      expect(result.needsLinens).toBe(false);
      expect(result.needsSheets).toBe(false);
      expect(result.needsTowels).toBe(false);
      expect(result.sheetsText).toBeNull();
      expect(result.towelsText).toBeNull();
    });

    it("should calculate sheets text correctly", () => {
      const result = calculateLinensFromRoomCounts({
        assignedBedrooms: 2,
        assignedBathrooms: 0,
        bringSheets: true,
        bringTowels: false,
      });
      expect(result.needsSheets).toBe(true);
      expect(result.needsTowels).toBe(false);
      expect(result.sheetsText).toBe("2 sheet sets (fitted, flat, pillowcases)");
    });

    it("should use singular for 1 sheet set", () => {
      const result = calculateLinensFromRoomCounts({
        assignedBedrooms: 1,
        assignedBathrooms: 0,
        bringSheets: true,
        bringTowels: false,
      });
      expect(result.sheetsText).toBe("1 sheet set (fitted, flat, pillowcases)");
    });

    it("should calculate towels text correctly", () => {
      const result = calculateLinensFromRoomCounts({
        assignedBedrooms: 0,
        assignedBathrooms: 2,
        bringSheets: false,
        bringTowels: true,
      });
      expect(result.needsTowels).toBe(true);
      expect(result.towelsText).toBe("4 bath towels, 2 hand towels, 4 washcloths");
    });

    it("should use singular for 1 bathroom", () => {
      const result = calculateLinensFromRoomCounts({
        assignedBedrooms: 0,
        assignedBathrooms: 1,
        bringSheets: false,
        bringTowels: true,
      });
      expect(result.towelsText).toBe("2 bath towels, 1 hand towel, 2 washcloths");
    });

    it("should calculate both sheets and towels", () => {
      const result = calculateLinensFromRoomCounts({
        assignedBedrooms: 3,
        assignedBathrooms: 2,
        bringSheets: true,
        bringTowels: true,
      });
      expect(result.needsLinens).toBe(true);
      expect(result.needsSheets).toBe(true);
      expect(result.needsTowels).toBe(true);
      expect(result.sheetsText).toBe("3 sheet sets (fitted, flat, pillowcases)");
      expect(result.towelsText).toBe("4 bath towels, 2 hand towels, 4 washcloths");
      expect(result.assignedBedrooms).toBe(3);
      expect(result.assignedBathrooms).toBe(2);
    });

    it("should not need sheets when 0 bedrooms assigned", () => {
      const result = calculateLinensFromRoomCounts({
        assignedBedrooms: 0,
        assignedBathrooms: 2,
        bringSheets: true,
        bringTowels: true,
      });
      expect(result.needsSheets).toBe(false);
      expect(result.needsTowels).toBe(true);
    });
  });

  describe("calculateMultiCleanerLinens", () => {
    it("should use assigned rooms when provided", () => {
      const result = calculateMultiCleanerLinens({
        totalBedrooms: 4,
        totalBathrooms: 3,
        totalCleaners: 2,
        assignedBedrooms: 2,
        assignedBathrooms: 1,
        bringSheets: true,
        bringTowels: true,
      });
      expect(result.isEstimated).toBe(false);
      expect(result.assignedBedrooms).toBe(2);
      expect(result.assignedBathrooms).toBe(1);
      expect(result.sheetsText).toBe("2 sheet sets (fitted, flat, pillowcases)");
    });

    it("should estimate when assigned rooms not provided", () => {
      const result = calculateMultiCleanerLinens({
        totalBedrooms: 4,
        totalBathrooms: 2,
        totalCleaners: 2,
        assignedBedrooms: null,
        assignedBathrooms: null,
        bringSheets: true,
        bringTowels: true,
      });
      expect(result.isEstimated).toBe(true);
      // Math.ceil(4/2) = 2, Math.ceil(2/2) = 1
      expect(result.assignedBedrooms).toBe(2);
      expect(result.assignedBathrooms).toBe(1);
    });

    it("should round up when dividing rooms", () => {
      const result = calculateMultiCleanerLinens({
        totalBedrooms: 3,
        totalBathrooms: 2,
        totalCleaners: 2,
        assignedBedrooms: null,
        assignedBathrooms: null,
        bringSheets: true,
        bringTowels: true,
      });
      // Math.ceil(3/2) = 2, Math.ceil(2/2) = 1
      expect(result.assignedBedrooms).toBe(2);
      expect(result.assignedBathrooms).toBe(1);
    });

    it("should handle partially specified assignments", () => {
      const result = calculateMultiCleanerLinens({
        totalBedrooms: 4,
        totalBathrooms: 4,
        totalCleaners: 2,
        assignedBedrooms: 2,
        assignedBathrooms: null,
        bringSheets: true,
        bringTowels: true,
      });
      expect(result.isEstimated).toBe(true);
      expect(result.assignedBedrooms).toBe(2);
      expect(result.assignedBathrooms).toBe(2); // estimated
    });
  });
});
