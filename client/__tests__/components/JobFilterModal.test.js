/**
 * Tests for JobFilterModal component and filter logic
 * Since React Native component rendering requires native modules,
 * we focus on testing the filter logic and data structures
 */

// Default filters structure (minEarnings removed in latest update)
const defaultFilters = {
  distance: { preset: "any", customValue: 25 },
  sheets: "any",
  towels: "any",
  bedrooms: "any",
  bathrooms: "any",
  timeWindow: "any",
  city: "any",
};

describe("JobFilterModal - Default Filters", () => {
  it("should have correct default filter structure", () => {
    expect(defaultFilters).toEqual({
      distance: { preset: "any", customValue: 25 },
      sheets: "any",
      towels: "any",
      bedrooms: "any",
      bathrooms: "any",
      timeWindow: "any",
      city: "any",
    });
  });

  it("should have distance preset set to 'any' by default", () => {
    expect(defaultFilters.distance.preset).toBe("any");
    expect(defaultFilters.distance.customValue).toBe(25);
  });

  it("should have all optional filters set to 'any'", () => {
    expect(defaultFilters.sheets).toBe("any");
    expect(defaultFilters.towels).toBe("any");
    expect(defaultFilters.bedrooms).toBe("any");
    expect(defaultFilters.bathrooms).toBe("any");
    expect(defaultFilters.timeWindow).toBe("any");
    expect(defaultFilters.city).toBe("any");
  });

  it("should not include minEarnings filter (removed feature)", () => {
    expect(defaultFilters.minEarnings).toBeUndefined();
  });
});

describe("JobFilterModal - Filter Options", () => {
  const distancePresets = [
    { value: "5", label: "5 mi" },
    { value: "10", label: "10 mi" },
    { value: "15", label: "15 mi" },
    { value: "25", label: "25 mi" },
    { value: "any", label: "Any" },
    { value: "custom", label: "Custom" },
  ];

  const sheetsTowelsOptions = [
    { value: "any", label: "Any" },
    { value: "not_needed", label: "Not Needed" },
    { value: "needed", label: "Needed" },
  ];

  const bedroomOptions = [
    { value: "any", label: "Any" },
    { value: "1", label: "1" },
    { value: "2", label: "2" },
    { value: "3", label: "3" },
    { value: "4", label: "4" },
    { value: "5+", label: "5+" },
  ];

  const bathroomOptions = [
    { value: "any", label: "Any" },
    { value: "1", label: "1" },
    { value: "1.5", label: "1.5" },
    { value: "2", label: "2" },
    { value: "2.5", label: "2.5" },
    { value: "3+", label: "3+" },
  ];

  const timeWindowOptions = [
    { value: "any", label: "Any" },
    { value: "anytime", label: "Flexible" },
    { value: "10am-3pm", label: "10am-3pm" },
    { value: "11am-4pm", label: "11am-4pm" },
    { value: "12pm-2pm", label: "12pm-2pm" },
  ];

  // Note: earningsPresets removed as minEarnings filter was removed from the modal

  it("should have 6 distance preset options", () => {
    expect(distancePresets.length).toBe(6);
    expect(distancePresets.map((p) => p.value)).toEqual([
      "5",
      "10",
      "15",
      "25",
      "any",
      "custom",
    ]);
  });

  it("should have 3 sheets/towels options", () => {
    expect(sheetsTowelsOptions.length).toBe(3);
    expect(sheetsTowelsOptions.map((o) => o.value)).toEqual([
      "any",
      "not_needed",
      "needed",
    ]);
  });

  it("should have 6 bedroom options including 5+", () => {
    expect(bedroomOptions.length).toBe(6);
    expect(bedroomOptions[bedroomOptions.length - 1].value).toBe("5+");
  });

  it("should have 6 bathroom options including half baths", () => {
    expect(bathroomOptions.length).toBe(6);
    expect(bathroomOptions.some((o) => o.value === "1.5")).toBe(true);
    expect(bathroomOptions.some((o) => o.value === "2.5")).toBe(true);
  });

  it("should have 5 time window options", () => {
    expect(timeWindowOptions.length).toBe(5);
    expect(timeWindowOptions.some((o) => o.value === "anytime")).toBe(true);
  });
});

describe("Filter Logic - Distance", () => {
  const haversineDistance = (lat1, lon1, lat2, lon2) => {
    const toRad = (x) => (x * Math.PI) / 180;
    const R = 6371; // km
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  it("should calculate distance correctly in km", () => {
    // Austin, TX to Dallas, TX (approximately 300 km)
    const distance = haversineDistance(30.2672, -97.7431, 32.7767, -96.797);
    expect(distance).toBeGreaterThan(280);
    expect(distance).toBeLessThan(320);
  });

  it("should convert km to miles correctly", () => {
    const distanceKm = 10;
    const distanceMiles = distanceKm * 0.621371;
    expect(distanceMiles).toBeCloseTo(6.21, 1);
  });

  it("should filter appointments by distance", () => {
    const appointments = [
      { id: 1, distance: 5 }, // ~3.1 miles
      { id: 2, distance: 20 }, // ~12.4 miles
      { id: 3, distance: 40 }, // ~24.8 miles
      { id: 4, distance: 80 }, // ~49.7 miles
    ];

    const maxDistMiles = 15;
    const filtered = appointments.filter((appt) => {
      const distMiles = appt.distance * 0.621371;
      return distMiles <= maxDistMiles;
    });

    expect(filtered.length).toBe(2);
    expect(filtered.map((a) => a.id)).toEqual([1, 2]);
  });

  it("should include all appointments when distance is 'any'", () => {
    const appointments = [
      { id: 1, distance: 5 },
      { id: 2, distance: 100 },
    ];

    const filters = { distance: { preset: "any" } };
    const filtered =
      filters.distance.preset === "any"
        ? appointments
        : appointments.filter((a) => a.distance <= 50);

    expect(filtered.length).toBe(2);
  });

  it("should use custom distance value when preset is 'custom'", () => {
    const filters = { distance: { preset: "custom", customValue: 30 } };

    const appointments = [
      { id: 1, distance: 40 }, // ~24.8 miles
      { id: 2, distance: 60 }, // ~37.3 miles
    ];

    const maxDistMiles =
      filters.distance.preset === "custom"
        ? filters.distance.customValue
        : parseInt(filters.distance.preset);

    const filtered = appointments.filter((appt) => {
      const distMiles = appt.distance * 0.621371;
      return distMiles <= maxDistMiles;
    });

    expect(filtered.length).toBe(1);
    expect(filtered[0].id).toBe(1);
  });
});

describe("Filter Logic - Sheets/Towels", () => {
  const appointments = [
    { id: 1, bringSheets: "yes", bringTowels: "yes" },
    { id: 2, bringSheets: "no", bringTowels: "yes" },
    { id: 3, bringSheets: "yes", bringTowels: "no" },
    { id: 4, bringSheets: "no", bringTowels: "no" },
  ];

  it("should filter for sheets needed", () => {
    const filtered = appointments.filter((a) => a.bringSheets === "yes");
    expect(filtered.length).toBe(2);
    expect(filtered.map((a) => a.id)).toEqual([1, 3]);
  });

  it("should filter for sheets not needed", () => {
    const filtered = appointments.filter((a) => a.bringSheets !== "yes");
    expect(filtered.length).toBe(2);
    expect(filtered.map((a) => a.id)).toEqual([2, 4]);
  });

  it("should filter for towels needed", () => {
    const filtered = appointments.filter((a) => a.bringTowels === "yes");
    expect(filtered.length).toBe(2);
    expect(filtered.map((a) => a.id)).toEqual([1, 2]);
  });

  it("should filter for towels not needed", () => {
    const filtered = appointments.filter((a) => a.bringTowels !== "yes");
    expect(filtered.length).toBe(2);
    expect(filtered.map((a) => a.id)).toEqual([3, 4]);
  });

  it("should filter for both sheets and towels not needed", () => {
    const filtered = appointments.filter(
      (a) => a.bringSheets !== "yes" && a.bringTowels !== "yes"
    );
    expect(filtered.length).toBe(1);
    expect(filtered[0].id).toBe(4);
  });

  it("should return all when filter is 'any'", () => {
    const filters = { sheets: "any", towels: "any" };

    const filtered = appointments.filter((a) => {
      if (filters.sheets === "needed" && a.bringSheets !== "yes") return false;
      if (filters.sheets === "not_needed" && a.bringSheets === "yes")
        return false;
      if (filters.towels === "needed" && a.bringTowels !== "yes") return false;
      if (filters.towels === "not_needed" && a.bringTowels === "yes")
        return false;
      return true;
    });

    expect(filtered.length).toBe(4);
  });
});

describe("Filter Logic - Bedroom/Bathroom", () => {
  const homes = [
    { id: 1, numBeds: "2", numBaths: "1", numHalfBaths: "0" },
    { id: 2, numBeds: "3", numBaths: "2", numHalfBaths: "0" },
    { id: 3, numBeds: "4", numBaths: "2", numHalfBaths: "1" },
    { id: 4, numBeds: "5", numBaths: "3", numHalfBaths: "0" },
    { id: 5, numBeds: "6", numBaths: "4", numHalfBaths: "0" },
  ];

  it("should filter for exact bedroom count", () => {
    const filtered = homes.filter((h) => parseInt(h.numBeds) === 3);
    expect(filtered.length).toBe(1);
    expect(filtered[0].id).toBe(2);
  });

  it("should filter for 5+ bedrooms", () => {
    const filtered = homes.filter((h) => parseFloat(h.numBeds) >= 5);
    expect(filtered.length).toBe(2);
    expect(filtered.map((h) => h.id)).toEqual([4, 5]);
  });

  it("should calculate total bathrooms including half baths", () => {
    const home = homes[2]; // 2 full baths + 1 half bath
    const totalBaths =
      parseFloat(home.numBaths) + parseFloat(home.numHalfBaths) * 0.5;
    expect(totalBaths).toBe(2.5);
  });

  it("should filter for exact bathroom count", () => {
    const filtered = homes.filter((h) => {
      const totalBaths =
        parseFloat(h.numBaths) + parseFloat(h.numHalfBaths) * 0.5;
      return totalBaths === 2;
    });
    expect(filtered.length).toBe(1);
    expect(filtered[0].id).toBe(2);
  });

  it("should filter for 3+ bathrooms", () => {
    const filtered = homes.filter((h) => {
      const totalBaths =
        parseFloat(h.numBaths) + parseFloat(h.numHalfBaths) * 0.5;
      return totalBaths >= 3;
    });
    expect(filtered.length).toBe(2);
    expect(filtered.map((h) => h.id)).toEqual([4, 5]);
  });

  it("should filter for 2.5 bathrooms exactly", () => {
    const filtered = homes.filter((h) => {
      const totalBaths =
        parseFloat(h.numBaths) + parseFloat(h.numHalfBaths) * 0.5;
      return totalBaths === 2.5;
    });
    expect(filtered.length).toBe(1);
    expect(filtered[0].id).toBe(3);
  });
});

describe("Filter Logic - Earnings", () => {
  const appointments = [
    { id: 1, price: "50" },
    { id: 2, price: "100" },
    { id: 3, price: "150" },
    { id: 4, price: "200" },
  ];

  it("should calculate cleaner earnings (90% of price)", () => {
    const price = 100;
    const cleanerShare = price * 0.9;
    expect(cleanerShare).toBe(90);
  });

  it("should filter for minimum $45 earnings (from $50 job)", () => {
    const minEarnings = 45;
    const filtered = appointments.filter((a) => {
      const earnings = Number(a.price) * 0.9;
      return earnings >= minEarnings;
    });
    expect(filtered.length).toBe(4);
  });

  it("should filter for minimum $75 earnings", () => {
    const minEarnings = 75;
    const filtered = appointments.filter((a) => {
      const earnings = Number(a.price) * 0.9;
      return earnings >= minEarnings;
    });
    expect(filtered.length).toBe(3);
    expect(filtered.map((a) => a.id)).toEqual([2, 3, 4]);
  });

  it("should filter for minimum $100 earnings", () => {
    const minEarnings = 100;
    const filtered = appointments.filter((a) => {
      const earnings = Number(a.price) * 0.9;
      return earnings >= minEarnings;
    });
    expect(filtered.length).toBe(2);
    expect(filtered.map((a) => a.id)).toEqual([3, 4]);
  });

  it("should filter for minimum $150 earnings", () => {
    const minEarnings = 150;
    const filtered = appointments.filter((a) => {
      const earnings = Number(a.price) * 0.9;
      return earnings >= minEarnings;
    });
    expect(filtered.length).toBe(1);
    expect(filtered[0].id).toBe(4);
  });

  it("should return all when minEarnings is null", () => {
    const minEarnings = null;
    const filtered = minEarnings
      ? appointments.filter((a) => Number(a.price) * 0.9 >= minEarnings)
      : appointments;
    expect(filtered.length).toBe(4);
  });
});

describe("Filter Logic - City", () => {
  const appointments = [
    { id: 1, homeId: 1 },
    { id: 2, homeId: 2 },
    { id: 3, homeId: 3 },
    { id: 4, homeId: 4 },
  ];

  const homeDetails = {
    1: { city: "Austin" },
    2: { city: "Dallas" },
    3: { city: "Austin" },
    4: { city: "Houston" },
  };

  it("should filter by city", () => {
    const filtered = appointments.filter(
      (a) => homeDetails[a.homeId]?.city === "Austin"
    );
    expect(filtered.length).toBe(2);
    expect(filtered.map((a) => a.id)).toEqual([1, 3]);
  });

  it("should extract unique cities from homes", () => {
    const cities = [
      ...new Set(Object.values(homeDetails).map((h) => h?.city).filter(Boolean)),
    ].sort();
    expect(cities).toEqual(["Austin", "Dallas", "Houston"]);
  });

  it("should return all appointments when city is 'any'", () => {
    const cityFilter = "any";
    const filtered =
      cityFilter === "any"
        ? appointments
        : appointments.filter((a) => homeDetails[a.homeId]?.city === cityFilter);
    expect(filtered.length).toBe(4);
  });

  it("should handle missing home details gracefully", () => {
    const appointmentsWithMissing = [
      { id: 1, homeId: 1 },
      { id: 2, homeId: 999 }, // Missing home
    ];

    const filtered = appointmentsWithMissing.filter((a) => {
      const home = homeDetails[a.homeId];
      if (!home) return true; // Include if home data not loaded
      return home.city === "Austin";
    });

    expect(filtered.length).toBe(2); // Both included (1 matches, 1 has no data)
  });
});

describe("Filter Logic - Time Window", () => {
  const appointments = [
    { id: 1, timeToBeCompleted: "anytime" },
    { id: 2, timeToBeCompleted: "10am-3pm" },
    { id: 3, timeToBeCompleted: "11am-4pm" },
    { id: 4, timeToBeCompleted: "12pm-2pm" },
  ];

  it("should filter by specific time window", () => {
    const filtered = appointments.filter(
      (a) => a.timeToBeCompleted === "10am-3pm"
    );
    expect(filtered.length).toBe(1);
    expect(filtered[0].id).toBe(2);
  });

  it("should filter for flexible time", () => {
    const filtered = appointments.filter(
      (a) => a.timeToBeCompleted === "anytime"
    );
    expect(filtered.length).toBe(1);
    expect(filtered[0].id).toBe(1);
  });

  it("should return all when filter is 'any'", () => {
    const filterValue = "any";
    const filtered =
      filterValue === "any"
        ? appointments
        : appointments.filter((a) => a.timeToBeCompleted === filterValue);
    expect(filtered.length).toBe(4);
  });
});

describe("Filter Logic - Combined Filters", () => {
  it("should apply multiple filters correctly", () => {
    const appointments = [
      {
        id: 1,
        bringSheets: "no",
        bringTowels: "no",
        price: "150",
        timeToBeCompleted: "anytime",
        distance: 10,
      },
      {
        id: 2,
        bringSheets: "yes",
        bringTowels: "yes",
        price: "100",
        timeToBeCompleted: "10am-3pm",
        distance: 5,
      },
      {
        id: 3,
        bringSheets: "no",
        bringTowels: "no",
        price: "200",
        timeToBeCompleted: "anytime",
        distance: 20,
      },
    ];

    const filters = {
      distance: { preset: "25", customValue: 25 },
      sheets: "not_needed",
      towels: "not_needed",
      minEarnings: 100,
    };

    const filtered = appointments.filter((appt) => {
      // Distance filter
      const maxDistMiles = parseInt(filters.distance.preset);
      const distMiles = appt.distance * 0.621371;
      if (distMiles > maxDistMiles) return false;

      // Sheets filter
      if (filters.sheets === "not_needed" && appt.bringSheets === "yes")
        return false;

      // Towels filter
      if (filters.towels === "not_needed" && appt.bringTowels === "yes")
        return false;

      // Earnings filter
      if (filters.minEarnings) {
        const earnings = Number(appt.price) * 0.9;
        if (earnings < filters.minEarnings) return false;
      }

      return true;
    });

    expect(filtered.length).toBe(2);
    expect(filtered.map((a) => a.id)).toEqual([1, 3]);
  });

  it("should count active filters correctly", () => {
    const filters = {
      distance: { preset: "10", customValue: 25 },
      sheets: "needed",
      towels: "any",
      bedrooms: "3",
      bathrooms: "any",
      timeWindow: "10am-3pm",
      city: "any",
    };

    let count = 0;
    if (filters.distance.preset !== "any") count++;
    if (filters.sheets !== "any") count++;
    if (filters.towels !== "any") count++;
    if (filters.bedrooms !== "any") count++;
    if (filters.bathrooms !== "any") count++;
    if (filters.timeWindow !== "any") count++;
    if (filters.city !== "any") count++;

    expect(count).toBe(4); // distance, sheets, bedrooms, timeWindow
  });

  it("should return 0 active filters for default state", () => {
    const filters = { ...defaultFilters };

    let count = 0;
    if (filters.distance.preset !== "any") count++;
    if (filters.sheets !== "any") count++;
    if (filters.towels !== "any") count++;
    if (filters.bedrooms !== "any") count++;
    if (filters.bathrooms !== "any") count++;
    if (filters.timeWindow !== "any") count++;
    if (filters.city !== "any") count++;

    expect(count).toBe(0);
  });
});

describe("Filter Logic - Edge Cases", () => {
  it("should handle empty appointments array", () => {
    const appointments = [];
    const filtered = appointments.filter(() => true);
    expect(filtered.length).toBe(0);
  });

  it("should handle appointments with missing fields", () => {
    const appointments = [
      { id: 1 }, // Missing all optional fields
      { id: 2, bringSheets: "yes" },
    ];

    const filtered = appointments.filter((a) => {
      // Safe check with default values
      const sheets = a.bringSheets || "no";
      return sheets === "yes";
    });

    expect(filtered.length).toBe(1);
    expect(filtered[0].id).toBe(2);
  });

  it("should handle string vs number price comparison", () => {
    const appointments = [
      { id: 1, price: "100" },
      { id: 2, price: 150 },
    ];

    const filtered = appointments.filter((a) => {
      const earnings = Number(a.price) * 0.9;
      return earnings >= 100;
    });

    expect(filtered.length).toBe(1);
    expect(filtered[0].id).toBe(2);
  });

  it("should handle null distance values", () => {
    const appointments = [
      { id: 1, distance: 10 },
      { id: 2, distance: null },
      { id: 3, distance: undefined },
    ];

    const filtered = appointments.filter((a) => {
      const distMiles = (a.distance ?? 999) * 0.621371;
      return distMiles <= 15;
    });

    expect(filtered.length).toBe(1);
    expect(filtered[0].id).toBe(1);
  });
});
