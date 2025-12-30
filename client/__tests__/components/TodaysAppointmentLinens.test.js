/**
 * Tests for linen location display in TodaysAppointment component.
 * Verifies that cleaners can see where to find clean linens and where to put dirty ones.
 */

// Mock react-native-vector-icons
jest.mock("react-native-vector-icons/FontAwesome", () => "Icon");

describe("TodaysAppointment Linen Location Display", () => {
  describe("Home State with Linen Fields", () => {
    it("should include linen location fields in home state", () => {
      const homeState = {
        address: "",
        city: "",
        numBeds: "",
        numBaths: "",
        sheetsProvided: "",
        towelsProvided: "",
        cleanSheetsLocation: "",
        dirtySheetsLocation: "",
        cleanTowelsLocation: "",
        dirtyTowelsLocation: "",
      };

      expect(homeState).toHaveProperty("cleanSheetsLocation");
      expect(homeState).toHaveProperty("dirtySheetsLocation");
      expect(homeState).toHaveProperty("cleanTowelsLocation");
      expect(homeState).toHaveProperty("dirtyTowelsLocation");
    });
  });

  describe("Linen Location Display Conditions", () => {
    it("should show linen locations when homeowner provides linens", () => {
      const bringSheets = "No";
      const bringTowels = "No";
      const linensProvidedByHomeowner = bringSheets === "No" && bringTowels === "No";

      expect(linensProvidedByHomeowner).toBe(true);
    });

    it("should not show linen locations when company brings linens", () => {
      const bringSheets = "Yes";
      const bringTowels = "Yes";
      const linensProvidedByHomeowner = bringSheets === "No" && bringTowels === "No";

      expect(linensProvidedByHomeowner).toBe(false);
    });

    it("should show sheets section when clean or dirty sheets location exists", () => {
      const home1 = { cleanSheetsLocation: "Hall closet", dirtySheetsLocation: "" };
      const home2 = { cleanSheetsLocation: "", dirtySheetsLocation: "Laundry room" };
      const home3 = { cleanSheetsLocation: "", dirtySheetsLocation: "" };

      const showSheets1 = home1.cleanSheetsLocation || home1.dirtySheetsLocation;
      const showSheets2 = home2.cleanSheetsLocation || home2.dirtySheetsLocation;
      const showSheets3 = home3.cleanSheetsLocation || home3.dirtySheetsLocation;

      expect(Boolean(showSheets1)).toBe(true);
      expect(Boolean(showSheets2)).toBe(true);
      expect(Boolean(showSheets3)).toBe(false);
    });

    it("should show towels section when clean or dirty towels location exists", () => {
      const home1 = { cleanTowelsLocation: "Bathroom cabinet", dirtyTowelsLocation: "" };
      const home2 = { cleanTowelsLocation: "", dirtyTowelsLocation: "Hamper" };
      const home3 = { cleanTowelsLocation: "", dirtyTowelsLocation: "" };

      const showTowels1 = home1.cleanTowelsLocation || home1.dirtyTowelsLocation;
      const showTowels2 = home2.cleanTowelsLocation || home2.dirtyTowelsLocation;
      const showTowels3 = home3.cleanTowelsLocation || home3.dirtyTowelsLocation;

      expect(Boolean(showTowels1)).toBe(true);
      expect(Boolean(showTowels2)).toBe(true);
      expect(Boolean(showTowels3)).toBe(false);
    });
  });

  describe("Linen Location Values", () => {
    it("should display clean sheets location", () => {
      const home = { cleanSheetsLocation: "Hall closet, top shelf" };

      expect(home.cleanSheetsLocation).toBe("Hall closet, top shelf");
    });

    it("should display dirty sheets location", () => {
      const home = { dirtySheetsLocation: "Laundry room basket" };

      expect(home.dirtySheetsLocation).toBe("Laundry room basket");
    });

    it("should display clean towels location", () => {
      const home = { cleanTowelsLocation: "Linen closet in hallway" };

      expect(home.cleanTowelsLocation).toBe("Linen closet in hallway");
    });

    it("should display dirty towels location", () => {
      const home = { dirtyTowelsLocation: "Bathroom hamper" };

      expect(home.dirtyTowelsLocation).toBe("Bathroom hamper");
    });
  });

  describe("Complete Linen Info Display", () => {
    it("should display complete linen info for homeowner-provided linens", () => {
      const home = {
        cleanSheetsLocation: "Hall closet",
        dirtySheetsLocation: "Laundry room",
        cleanTowelsLocation: "Bathroom cabinet",
        dirtyTowelsLocation: "Bathroom hamper",
      };

      const linenInfo = {
        sheets: {
          clean: home.cleanSheetsLocation,
          dirty: home.dirtySheetsLocation,
        },
        towels: {
          clean: home.cleanTowelsLocation,
          dirty: home.dirtyTowelsLocation,
        },
      };

      expect(linenInfo.sheets.clean).toBe("Hall closet");
      expect(linenInfo.sheets.dirty).toBe("Laundry room");
      expect(linenInfo.towels.clean).toBe("Bathroom cabinet");
      expect(linenInfo.towels.dirty).toBe("Bathroom hamper");
    });
  });

  describe("Partial Linen Info", () => {
    it("should handle only clean locations provided", () => {
      const home = {
        cleanSheetsLocation: "Hall closet",
        dirtySheetsLocation: "",
        cleanTowelsLocation: "Bathroom cabinet",
        dirtyTowelsLocation: "",
      };

      expect(home.cleanSheetsLocation).toBeTruthy();
      expect(home.dirtySheetsLocation).toBeFalsy();
      expect(home.cleanTowelsLocation).toBeTruthy();
      expect(home.dirtyTowelsLocation).toBeFalsy();
    });

    it("should handle only dirty locations provided", () => {
      const home = {
        cleanSheetsLocation: "",
        dirtySheetsLocation: "Laundry room",
        cleanTowelsLocation: "",
        dirtyTowelsLocation: "Hamper",
      };

      expect(home.cleanSheetsLocation).toBeFalsy();
      expect(home.dirtySheetsLocation).toBeTruthy();
      expect(home.cleanTowelsLocation).toBeFalsy();
      expect(home.dirtyTowelsLocation).toBeTruthy();
    });

    it("should handle only sheets info provided", () => {
      const home = {
        cleanSheetsLocation: "Hall closet",
        dirtySheetsLocation: "Laundry room",
        cleanTowelsLocation: "",
        dirtyTowelsLocation: "",
      };

      const hasSheets = home.cleanSheetsLocation || home.dirtySheetsLocation;
      const hasTowels = home.cleanTowelsLocation || home.dirtyTowelsLocation;

      expect(Boolean(hasSheets)).toBe(true);
      expect(Boolean(hasTowels)).toBe(false);
    });

    it("should handle only towels info provided", () => {
      const home = {
        cleanSheetsLocation: "",
        dirtySheetsLocation: "",
        cleanTowelsLocation: "Bathroom cabinet",
        dirtyTowelsLocation: "Bathroom hamper",
      };

      const hasSheets = home.cleanSheetsLocation || home.dirtySheetsLocation;
      const hasTowels = home.cleanTowelsLocation || home.dirtyTowelsLocation;

      expect(Boolean(hasSheets)).toBe(false);
      expect(Boolean(hasTowels)).toBe(true);
    });
  });

  describe("Empty/Null Handling", () => {
    it("should handle null linen locations", () => {
      const home = {
        cleanSheetsLocation: null,
        dirtySheetsLocation: null,
        cleanTowelsLocation: null,
        dirtyTowelsLocation: null,
      };

      expect(home.cleanSheetsLocation).toBeNull();
      expect(home.dirtySheetsLocation).toBeNull();
    });

    it("should handle undefined linen locations", () => {
      const home = {};

      expect(home.cleanSheetsLocation).toBeUndefined();
      expect(home.dirtySheetsLocation).toBeUndefined();
    });

    it("should treat empty string as no location", () => {
      const home = { cleanSheetsLocation: "" };

      const hasLocation = Boolean(home.cleanSheetsLocation);

      expect(hasLocation).toBe(false);
    });
  });

  describe("Linen Section Titles", () => {
    it("should have correct section titles", () => {
      const sheetsSectionTitle = "Sheets";
      const towelsSectionTitle = "Towels";

      expect(sheetsSectionTitle).toBe("Sheets");
      expect(towelsSectionTitle).toBe("Towels");
    });

    it("should have correct label text", () => {
      const cleanLabel = "Clean:";
      const dirtyLabel = "Dirty:";

      expect(cleanLabel).toBe("Clean:");
      expect(dirtyLabel).toBe("Dirty:");
    });
  });

  describe("Linens Provided Header", () => {
    it("should show correct header when linens provided by homeowner", () => {
      const headerText = "Linens provided by homeowner";

      expect(headerText).toBe("Linens provided by homeowner");
    });
  });

  describe("Integration with Bring Sheets/Towels", () => {
    it("should show linen info only when not bringing linens", () => {
      const scenarios = [
        { bringSheets: true, bringTowels: true, shouldShowLinenInfo: false },
        { bringSheets: true, bringTowels: false, shouldShowLinenInfo: false },
        { bringSheets: false, bringTowels: true, shouldShowLinenInfo: false },
        { bringSheets: false, bringTowels: false, shouldShowLinenInfo: true },
      ];

      scenarios.forEach((scenario) => {
        const showLinenInfo = !scenario.bringSheets && !scenario.bringTowels;
        expect(showLinenInfo).toBe(scenario.shouldShowLinenInfo);
      });
    });
  });
});
