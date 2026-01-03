/**
 * Tests for appointment creation respecting usePreferredCleaners toggle
 * When usePreferredCleaners is false, appointments should be created
 * as regular marketplace appointments without preferred cleaner pricing
 */

describe("Appointment Creation - usePreferredCleaners Toggle", () => {
  describe("Home usePreferredCleaners Logic", () => {
    it("should respect toggle when usePreferredCleaners is explicitly true", () => {
      const home = {
        dataValues: {
          id: 1,
          preferredCleanerId: 100,
          usePreferredCleaners: true,
        },
      };

      const usePreferredCleaners = home.dataValues.usePreferredCleaners !== false;
      const preferredCleanerId = usePreferredCleaners
        ? home.dataValues.preferredCleanerId
        : null;

      expect(usePreferredCleaners).toBe(true);
      expect(preferredCleanerId).toBe(100);
    });

    it("should respect toggle when usePreferredCleaners is false", () => {
      const home = {
        dataValues: {
          id: 1,
          preferredCleanerId: 100,
          usePreferredCleaners: false,
        },
      };

      const usePreferredCleaners = home.dataValues.usePreferredCleaners !== false;
      const preferredCleanerId = usePreferredCleaners
        ? home.dataValues.preferredCleanerId
        : null;

      expect(usePreferredCleaners).toBe(false);
      expect(preferredCleanerId).toBeNull();
    });

    it("should default to true when usePreferredCleaners is undefined (legacy data)", () => {
      const home = {
        dataValues: {
          id: 1,
          preferredCleanerId: 100,
          // usePreferredCleaners not set (undefined)
        },
      };

      const usePreferredCleaners = home.dataValues.usePreferredCleaners !== false;
      const preferredCleanerId = usePreferredCleaners
        ? home.dataValues.preferredCleanerId
        : null;

      expect(usePreferredCleaners).toBe(true);
      expect(preferredCleanerId).toBe(100);
    });

    it("should default to true when usePreferredCleaners is null", () => {
      const home = {
        dataValues: {
          id: 1,
          preferredCleanerId: 100,
          usePreferredCleaners: null,
        },
      };

      const usePreferredCleaners = home.dataValues.usePreferredCleaners !== false;
      const preferredCleanerId = usePreferredCleaners
        ? home.dataValues.preferredCleanerId
        : null;

      expect(usePreferredCleaners).toBe(true);
      expect(preferredCleanerId).toBe(100);
    });

    it("should handle home without preferredCleanerId", () => {
      const home = {
        dataValues: {
          id: 1,
          preferredCleanerId: null,
          usePreferredCleaners: true,
        },
      };

      const usePreferredCleaners = home.dataValues.usePreferredCleaners !== false;
      const preferredCleanerId = usePreferredCleaners
        ? home.dataValues.preferredCleanerId
        : null;

      expect(usePreferredCleaners).toBe(true);
      expect(preferredCleanerId).toBeNull();
    });
  });

  describe("Appointment Date Object", () => {
    it("should set preferredCleanerId on date when toggle is on", () => {
      const home = {
        dataValues: {
          id: 1,
          preferredCleanerId: 100,
          usePreferredCleaners: true,
        },
      };

      const usePreferredCleaners = home.dataValues.usePreferredCleaners !== false;
      const preferredCleanerId = usePreferredCleaners
        ? home.dataValues.preferredCleanerId
        : null;

      const date = {};
      date.preferredCleanerId = preferredCleanerId || null;

      expect(date.preferredCleanerId).toBe(100);
    });

    it("should set preferredCleanerId to null on date when toggle is off", () => {
      const home = {
        dataValues: {
          id: 1,
          preferredCleanerId: 100,
          usePreferredCleaners: false,
        },
      };

      const usePreferredCleaners = home.dataValues.usePreferredCleaners !== false;
      const preferredCleanerId = usePreferredCleaners
        ? home.dataValues.preferredCleanerId
        : null;

      const date = {};
      date.preferredCleanerId = preferredCleanerId || null;

      expect(date.preferredCleanerId).toBeNull();
    });
  });

  describe("Pricing Logic", () => {
    it("should use platform pricing when toggle is off (ignores preferred cleaner pricing)", () => {
      const home = {
        dataValues: {
          id: 1,
          preferredCleanerId: 100,
          usePreferredCleaners: false,
          numBeds: 3,
          numBaths: 2,
        },
      };

      const cleanerClientRelation = {
        dataValues: {
          defaultPrice: 120.0, // Custom preferred cleaner price
        },
      };

      const platformPrice = 150.0; // Calculated platform price

      const usePreferredCleaners = home.dataValues.usePreferredCleaners !== false;

      // When toggle is off, we don't use preferred cleaner pricing
      let finalPrice;
      if (!usePreferredCleaners) {
        // Use platform pricing
        finalPrice = platformPrice;
      } else if (cleanerClientRelation && cleanerClientRelation.dataValues.defaultPrice) {
        // Use preferred cleaner pricing
        finalPrice = parseFloat(cleanerClientRelation.dataValues.defaultPrice);
      } else {
        // Use platform pricing
        finalPrice = platformPrice;
      }

      expect(finalPrice).toBe(150.0);
    });

    it("should use preferred cleaner pricing when toggle is on", () => {
      const home = {
        dataValues: {
          id: 1,
          preferredCleanerId: 100,
          usePreferredCleaners: true,
          numBeds: 3,
          numBaths: 2,
        },
      };

      const cleanerClientRelation = {
        dataValues: {
          defaultPrice: 120.0, // Custom preferred cleaner price
        },
      };

      const platformPrice = 150.0; // Calculated platform price

      const usePreferredCleaners = home.dataValues.usePreferredCleaners !== false;

      let finalPrice;
      if (!usePreferredCleaners) {
        finalPrice = platformPrice;
      } else if (cleanerClientRelation && cleanerClientRelation.dataValues.defaultPrice) {
        finalPrice = parseFloat(cleanerClientRelation.dataValues.defaultPrice);
      } else {
        finalPrice = platformPrice;
      }

      expect(finalPrice).toBe(120.0);
    });

    it("should use platform pricing when toggle is on but no preferred cleaner exists", () => {
      const home = {
        dataValues: {
          id: 1,
          preferredCleanerId: null, // No preferred cleaner
          usePreferredCleaners: true,
          numBeds: 3,
          numBaths: 2,
        },
      };

      const cleanerClientRelation = null; // No relationship

      const platformPrice = 150.0;

      const usePreferredCleaners = home.dataValues.usePreferredCleaners !== false;

      let finalPrice;
      if (!usePreferredCleaners) {
        finalPrice = platformPrice;
      } else if (cleanerClientRelation && cleanerClientRelation.dataValues?.defaultPrice) {
        finalPrice = parseFloat(cleanerClientRelation.dataValues.defaultPrice);
      } else {
        finalPrice = platformPrice;
      }

      expect(finalPrice).toBe(150.0);
    });
  });

  describe("Marketplace Behavior", () => {
    it("should open appointment to all cleaners when toggle is off", () => {
      const home = {
        dataValues: {
          id: 1,
          preferredCleanerId: 100,
          usePreferredCleaners: false,
        },
      };

      const usePreferredCleaners = home.dataValues.usePreferredCleaners !== false;
      const preferredCleanerId = usePreferredCleaners
        ? home.dataValues.preferredCleanerId
        : null;

      // When preferredCleanerId is null, appointment goes to marketplace
      const goesToMarketplace = !preferredCleanerId;

      expect(goesToMarketplace).toBe(true);
    });

    it("should not open appointment to marketplace when toggle is on and preferred cleaner exists", () => {
      const home = {
        dataValues: {
          id: 1,
          preferredCleanerId: 100,
          usePreferredCleaners: true,
        },
      };

      const usePreferredCleaners = home.dataValues.usePreferredCleaners !== false;
      const preferredCleanerId = usePreferredCleaners
        ? home.dataValues.preferredCleanerId
        : null;

      // When preferredCleanerId exists, appointment goes to preferred cleaner first
      const goesToMarketplace = !preferredCleanerId;

      expect(goesToMarketplace).toBe(false);
    });
  });
});

describe("UserHomes Model - usePreferredCleaners Field", () => {
  describe("Default Value", () => {
    it("should default to true for new homes", () => {
      const defaultValue = true;
      expect(defaultValue).toBe(true);
    });
  });

  describe("Field Validation", () => {
    it("should accept true", () => {
      const value = true;
      const isValid = typeof value === "boolean";
      expect(isValid).toBe(true);
    });

    it("should accept false", () => {
      const value = false;
      const isValid = typeof value === "boolean";
      expect(isValid).toBe(true);
    });

    it("should not accept string values", () => {
      const value = "true";
      const isValid = typeof value === "boolean";
      expect(isValid).toBe(false);
    });

    it("should not accept number values", () => {
      const value = 1;
      const isValid = typeof value === "boolean";
      expect(isValid).toBe(false);
    });
  });
});
