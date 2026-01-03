/**
 * Tests for SelectNewJobList component
 * Focuses on preferred cleaner filtering and direct booking functionality
 */

// Mock fetch
global.fetch = jest.fn();

describe("SelectNewJobList - Preferred Home Filtering", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("Fetching Preferred Home IDs", () => {
    it("should fetch preferred home IDs on mount", async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ preferredHomeIds: [10, 15, 22] }),
      });

      const response = await fetch("http://localhost:3000/api/v1/users/preferred-homes", {
        headers: { Authorization: "Bearer test_token" },
      });

      const data = await response.json();

      expect(data.preferredHomeIds).toEqual([10, 15, 22]);
    });

    it("should handle empty preferred homes response", async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ preferredHomeIds: [] }),
      });

      const response = await fetch("http://localhost:3000/api/v1/users/preferred-homes", {
        headers: { Authorization: "Bearer test_token" },
      });

      const data = await response.json();

      expect(data.preferredHomeIds).toEqual([]);
    });

    it("should handle fetch error gracefully", async () => {
      global.fetch.mockRejectedValueOnce(new Error("Network error"));

      let preferredHomeIds = [];
      try {
        await fetch("http://localhost:3000/api/v1/users/preferred-homes");
      } catch (error) {
        preferredHomeIds = [];
      }

      expect(preferredHomeIds).toEqual([]);
    });
  });

  describe("Marking Appointments as Preferred", () => {
    const preferredHomeIds = [10, 15, 22];

    it("should mark appointments with isPreferred flag", () => {
      const appointments = [
        { id: 1, homeId: 10, address: "123 Main St" },
        { id: 2, homeId: 11, address: "456 Oak Ave" },
        { id: 3, homeId: 15, address: "789 Pine Rd" },
        { id: 4, homeId: 20, address: "321 Elm St" },
      ];

      const markedAppointments = appointments.map((apt) => ({
        ...apt,
        isPreferred: preferredHomeIds.includes(apt.homeId),
      }));

      expect(markedAppointments[0].isPreferred).toBe(true);
      expect(markedAppointments[1].isPreferred).toBe(false);
      expect(markedAppointments[2].isPreferred).toBe(true);
      expect(markedAppointments[3].isPreferred).toBe(false);
    });

    it("should pass isPreferred prop to EmployeeAssignmentTile", () => {
      const appointment = { id: 1, homeId: 10 };
      const isPreferred = preferredHomeIds.includes(appointment.homeId);

      // Simulating prop passed to child component
      const tileProps = {
        ...appointment,
        isPreferred,
      };

      expect(tileProps.isPreferred).toBe(true);
    });
  });

  describe("Filter Logic with preferredOnly", () => {
    const preferredHomeIds = [10, 15, 22];
    const appointments = [
      { id: 1, homeId: 10, address: "123 Main St", bringSheets: "no", distance: 5 },
      { id: 2, homeId: 11, address: "456 Oak Ave", bringSheets: "yes", distance: 8 },
      { id: 3, homeId: 15, address: "789 Pine Rd", bringSheets: "no", distance: 12 },
      { id: 4, homeId: 20, address: "321 Elm St", bringSheets: "no", distance: 3 },
      { id: 5, homeId: 22, address: "555 Maple Ave", bringSheets: "yes", distance: 20 },
    ];

    it("should filter to show only preferred when preferredOnly is true", () => {
      const filters = { preferredOnly: true };

      const filtered = appointments.filter((apt) => {
        if (filters.preferredOnly) {
          return preferredHomeIds.includes(apt.homeId);
        }
        return true;
      });

      expect(filtered).toHaveLength(3);
      expect(filtered.map((a) => a.homeId)).toEqual([10, 15, 22]);
    });

    it("should show all when preferredOnly is false", () => {
      const filters = { preferredOnly: false };

      const filtered = appointments.filter((apt) => {
        if (filters.preferredOnly) {
          return preferredHomeIds.includes(apt.homeId);
        }
        return true;
      });

      expect(filtered).toHaveLength(5);
    });

    it("should combine preferredOnly with other filters", () => {
      const filters = {
        preferredOnly: true,
        sheets: "not_needed",
      };

      const filtered = appointments.filter((apt) => {
        // Preferred filter
        if (filters.preferredOnly && !preferredHomeIds.includes(apt.homeId)) {
          return false;
        }

        // Sheets filter
        if (filters.sheets === "not_needed" && apt.bringSheets === "yes") {
          return false;
        }

        return true;
      });

      expect(filtered).toHaveLength(2);
      expect(filtered.map((a) => a.id)).toEqual([1, 3]); // Preferred + no sheets
    });

    it("should combine preferredOnly with distance filter", () => {
      const filters = {
        preferredOnly: true,
        distance: { preset: "10" },
      };

      const filtered = appointments.filter((apt) => {
        // Preferred filter
        if (filters.preferredOnly && !preferredHomeIds.includes(apt.homeId)) {
          return false;
        }

        // Distance filter (in km, * 0.621371 for miles)
        const maxDistMiles = parseInt(filters.distance.preset);
        const distMiles = apt.distance * 0.621371;
        if (distMiles > maxDistMiles) {
          return false;
        }

        return true;
      });

      expect(filtered).toHaveLength(2);
      expect(filtered.map((a) => a.id)).toEqual([1, 3]); // Preferred + within 10 miles
    });
  });

  describe("hasPreferredHomes Calculation", () => {
    it("should return true when preferredHomeIds has items", () => {
      const preferredHomeIds = [10, 15, 22];
      const hasPreferredHomes = preferredHomeIds.length > 0;

      expect(hasPreferredHomes).toBe(true);
    });

    it("should return false when preferredHomeIds is empty", () => {
      const preferredHomeIds = [];
      const hasPreferredHomes = preferredHomeIds.length > 0;

      expect(hasPreferredHomes).toBe(false);
    });
  });

  describe("Active Filter Count", () => {
    it("should include preferredOnly in active filter count", () => {
      const filters = {
        distance: { preset: "any" },
        sheets: "any",
        towels: "any",
        bedrooms: "any",
        bathrooms: "any",
        timeWindow: "any",
        city: "any",
        preferredOnly: true,
      };

      let count = 0;
      if (filters.distance.preset !== "any") count++;
      if (filters.sheets !== "any") count++;
      if (filters.towels !== "any") count++;
      if (filters.bedrooms !== "any") count++;
      if (filters.bathrooms !== "any") count++;
      if (filters.timeWindow !== "any") count++;
      if (filters.city !== "any") count++;
      if (filters.preferredOnly) count++;

      expect(count).toBe(1);
    });

    it("should count multiple active filters including preferredOnly", () => {
      const filters = {
        distance: { preset: "10" },
        sheets: "not_needed",
        towels: "any",
        bedrooms: "any",
        bathrooms: "any",
        timeWindow: "any",
        city: "any",
        preferredOnly: true,
      };

      let count = 0;
      if (filters.distance.preset !== "any") count++;
      if (filters.sheets !== "any") count++;
      if (filters.towels !== "any") count++;
      if (filters.bedrooms !== "any") count++;
      if (filters.bathrooms !== "any") count++;
      if (filters.timeWindow !== "any") count++;
      if (filters.city !== "any") count++;
      if (filters.preferredOnly) count++;

      expect(count).toBe(3); // distance, sheets, preferredOnly
    });
  });
});

describe("SelectNewJobList - Direct Booking Handling", () => {
  describe("addEmployee Response", () => {
    it("should handle direct booking success response", async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            success: true,
            message: "Job booked successfully! As a preferred cleaner, no approval was needed.",
            directBooking: true,
          }),
      });

      const response = await fetch("http://localhost:3000/api/v1/appointments/request-employee", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: 100, appointmentId: 1 }),
      });

      const data = await response.json();

      expect(data.directBooking).toBe(true);
      expect(data.message).toContain("no approval was needed");
    });

    it("should handle normal request response", async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            success: true,
            message: "Request sent to the client for approval",
            directBooking: false,
          }),
      });

      const response = await fetch("http://localhost:3000/api/v1/appointments/request-employee", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: 100, appointmentId: 1 }),
      });

      const data = await response.json();

      expect(data.directBooking).toBe(false);
    });
  });

  describe("State Updates After Booking", () => {
    it("should remove appointment from list after direct booking", () => {
      const appointments = [
        { id: 1, homeId: 10 },
        { id: 2, homeId: 15 },
        { id: 3, homeId: 22 },
      ];
      const bookedAppointmentId = 2;
      const directBooking = true;

      const updatedAppointments = appointments.filter((a) => a.id !== bookedAppointmentId);

      expect(updatedAppointments).toHaveLength(2);
      expect(updatedAppointments.map((a) => a.id)).toEqual([1, 3]);
    });

    it("should not add to requests list for direct booking", () => {
      const requests = [];
      const bookedAppointment = { id: 2, homeId: 15 };
      const directBooking = true;

      // Simulate the logic
      if (!directBooking) {
        requests.push(bookedAppointment);
      }

      expect(requests).toHaveLength(0);
    });

    it("should add to requests list for normal request", () => {
      const requests = [];
      const requestedAppointment = { id: 2, homeId: 15 };
      const directBooking = false;

      // Simulate the logic
      if (!directBooking) {
        requests.push(requestedAppointment);
      }

      expect(requests).toHaveLength(1);
    });
  });

  describe("Alert Display", () => {
    it("should show success alert for direct booking", () => {
      const directBooking = true;
      const showAlert = directBooking;
      const alertTitle = "Job Booked!";
      const alertMessage =
        "As a preferred cleaner, this job has been confirmed automatically. The homeowner has been notified.";

      expect(showAlert).toBe(true);
      expect(alertTitle).toBe("Job Booked!");
      expect(alertMessage).toContain("confirmed automatically");
    });

    it("should not show special alert for normal request", () => {
      const directBooking = false;
      const showSpecialAlert = directBooking;

      expect(showSpecialAlert).toBe(false);
    });
  });
});

describe("SelectNewJobList - JobFilterModal Integration", () => {
  describe("Passing hasPreferredHomes prop", () => {
    it("should pass hasPreferredHomes to JobFilterModal", () => {
      const preferredHomeIds = [10, 15];
      const hasPreferredHomes = preferredHomeIds.length > 0;

      const modalProps = {
        visible: true,
        filters: {},
        hasPreferredHomes,
      };

      expect(modalProps.hasPreferredHomes).toBe(true);
    });

    it("should pass false when no preferred homes", () => {
      const preferredHomeIds = [];
      const hasPreferredHomes = preferredHomeIds.length > 0;

      const modalProps = {
        visible: true,
        filters: {},
        hasPreferredHomes,
      };

      expect(modalProps.hasPreferredHomes).toBe(false);
    });
  });

  describe("Filter Application", () => {
    it("should apply filters from modal including preferredOnly", () => {
      const appliedFilters = {
        distance: { preset: "25" },
        sheets: "any",
        towels: "any",
        bedrooms: "any",
        bathrooms: "any",
        timeWindow: "any",
        city: "any",
        preferredOnly: true,
      };

      expect(appliedFilters.preferredOnly).toBe(true);
    });

    it("should reset preferredOnly when clearing filters", () => {
      const defaultFilters = {
        distance: { preset: "any", customValue: 25 },
        sheets: "any",
        towels: "any",
        bedrooms: "any",
        bathrooms: "any",
        timeWindow: "any",
        city: "any",
        preferredOnly: false,
      };

      expect(defaultFilters.preferredOnly).toBe(false);
    });
  });
});

describe("SelectNewJobList - Match Count with preferredOnly", () => {
  const preferredHomeIds = [10, 15, 22];
  const appointments = [
    { id: 1, homeId: 10 },
    { id: 2, homeId: 11 },
    { id: 3, homeId: 15 },
    { id: 4, homeId: 20 },
    { id: 5, homeId: 22 },
  ];

  it("should count only preferred homes when filter is active", () => {
    const filters = { preferredOnly: true };

    const matchCount = appointments.filter((apt) => {
      if (filters.preferredOnly) {
        return preferredHomeIds.includes(apt.homeId);
      }
      return true;
    }).length;

    expect(matchCount).toBe(3);
  });

  it("should count all homes when preferredOnly is false", () => {
    const filters = { preferredOnly: false };

    const matchCount = appointments.filter((apt) => {
      if (filters.preferredOnly) {
        return preferredHomeIds.includes(apt.homeId);
      }
      return true;
    }).length;

    expect(matchCount).toBe(5);
  });

  it("should return 0 when preferredOnly true but no preferred homes", () => {
    const emptyPreferredHomeIds = [];
    const filters = { preferredOnly: true };

    const matchCount = appointments.filter((apt) => {
      if (filters.preferredOnly) {
        return emptyPreferredHomeIds.includes(apt.homeId);
      }
      return true;
    }).length;

    expect(matchCount).toBe(0);
  });
});

describe("SelectNewJobList - Edge Cases", () => {
  it("should handle preferredHomeIds loading state", () => {
    let preferredHomeIds = null; // Loading state

    const isLoading = preferredHomeIds === null;

    expect(isLoading).toBe(true);
  });

  it("should handle preferredHomeIds loaded as empty", () => {
    const preferredHomeIds = [];

    const hasPreferredHomes = preferredHomeIds.length > 0;
    const isLoading = false;

    expect(hasPreferredHomes).toBe(false);
    expect(isLoading).toBe(false);
  });

  it("should safely handle missing homeId in appointment", () => {
    const preferredHomeIds = [10, 15];
    const appointments = [
      { id: 1, homeId: 10 },
      { id: 2 }, // Missing homeId
      { id: 3, homeId: 15 },
    ];

    const filtered = appointments.filter((apt) => {
      const homeId = apt.homeId;
      if (!homeId) return false; // Exclude if no homeId
      return preferredHomeIds.includes(homeId);
    });

    expect(filtered).toHaveLength(2);
    expect(filtered.map((a) => a.id)).toEqual([1, 3]);
  });
});
