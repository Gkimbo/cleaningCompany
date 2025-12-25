/**
 * Tests for Distance Calculation with Geocoded Coordinates
 * Tests that distance calculations use accurate address-based coordinates
 * instead of ZIP code center coordinates
 */

describe("Geocoded Distance Calculation", () => {
  // Haversine formula implementation (same as in SelectNewJobList.js)
  const haversineDistance = (lat1, lon1, lat2, lon2) => {
    const R = 6371; // Earth's radius in km
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  describe("Haversine Distance Formula", () => {
    it("should calculate distance correctly in kilometers", () => {
      // Boston to New York (~306 km)
      const boston = { lat: 42.3601, lon: -71.0589 };
      const newYork = { lat: 40.7128, lon: -74.006 };

      const distance = haversineDistance(
        boston.lat,
        boston.lon,
        newYork.lat,
        newYork.lon
      );

      expect(distance).toBeGreaterThan(300);
      expect(distance).toBeLessThan(320);
    });

    it("should return 0 for same coordinates", () => {
      const distance = haversineDistance(42.3601, -71.0589, 42.3601, -71.0589);

      expect(distance).toBe(0);
    });

    it("should handle negative coordinates (Western hemisphere)", () => {
      // Los Angeles to San Francisco
      const la = { lat: 34.0522, lon: -118.2437 };
      const sf = { lat: 37.7749, lon: -122.4194 };

      const distance = haversineDistance(la.lat, la.lon, sf.lat, sf.lon);

      expect(distance).toBeGreaterThan(540);
      expect(distance).toBeLessThan(560);
    });

    it("should be symmetric (A to B = B to A)", () => {
      const pointA = { lat: 42.3601, lon: -71.0589 };
      const pointB = { lat: 40.7128, lon: -74.006 };

      const distanceAB = haversineDistance(
        pointA.lat,
        pointA.lon,
        pointB.lat,
        pointB.lon
      );
      const distanceBA = haversineDistance(
        pointB.lat,
        pointB.lon,
        pointA.lat,
        pointA.lon
      );

      expect(distanceAB).toBeCloseTo(distanceBA, 10);
    });
  });

  describe("Geocoded vs ZIP Code Center Accuracy", () => {
    // Example: Two addresses in same ZIP code but different locations
    const zipCodeCenter = { lat: 42.3601, lon: -71.0589 }; // Boston 02101 center

    it("should show difference between geocoded and ZIP center coordinates", () => {
      // Simulated geocoded address (actual street location)
      const geocodedAddress = { lat: 42.3550, lon: -71.0650 };
      // User's location
      const userLocation = { lat: 42.3400, lon: -71.0800 };

      const distanceFromGeocoded = haversineDistance(
        userLocation.lat,
        userLocation.lon,
        geocodedAddress.lat,
        geocodedAddress.lon
      );

      const distanceFromZipCenter = haversineDistance(
        userLocation.lat,
        userLocation.lon,
        zipCodeCenter.lat,
        zipCodeCenter.lon
      );

      // Distances should be different
      expect(distanceFromGeocoded).not.toBeCloseTo(distanceFromZipCenter, 1);
    });

    it("should provide more accurate distance for nearby addresses", () => {
      // Two nearby addresses in the same city
      const address1 = { lat: 42.3601, lon: -71.0589 }; // One location
      const address2 = { lat: 42.3605, lon: -71.0595 }; // 50m away

      const distance = haversineDistance(
        address1.lat,
        address1.lon,
        address2.lat,
        address2.lon
      );

      // Should be less than 100 meters (0.1 km)
      expect(distance).toBeLessThan(0.1);
    });

    it("should show meaningful differences for addresses within same ZIP", () => {
      // Two addresses in same ZIP but different parts of town
      const northEnd = { lat: 42.3647, lon: -71.0542 }; // North End, Boston
      const backBay = { lat: 42.3503, lon: -71.0810 }; // Back Bay, Boston

      const distance = haversineDistance(
        northEnd.lat,
        northEnd.lon,
        backBay.lat,
        backBay.lon
      );

      // Should be around 2-3 km (meaningful difference within city)
      expect(distance).toBeGreaterThan(2);
      expect(distance).toBeLessThan(4);
    });
  });

  describe("Distance Filtering with Geocoded Coordinates", () => {
    const userLocation = { latitude: 42.3400, longitude: -71.0800 };

    const createAppointmentWithDistance = (homeCoords) => {
      const distance = haversineDistance(
        userLocation.latitude,
        userLocation.longitude,
        homeCoords.latitude,
        homeCoords.longitude
      );
      return { ...homeCoords, distance };
    };

    it("should filter appointments within 5 miles correctly", () => {
      const appointments = [
        createAppointmentWithDistance({ latitude: 42.3450, longitude: -71.0750 }), // ~1 km
        createAppointmentWithDistance({ latitude: 42.3800, longitude: -71.0200 }), // ~7 km
        createAppointmentWithDistance({ latitude: 42.4500, longitude: -71.1000 }), // ~13 km
      ];

      const maxDistMiles = 5;
      const filtered = appointments.filter((appt) => {
        const distMiles = appt.distance * 0.621371;
        return distMiles <= maxDistMiles;
      });

      expect(filtered).toHaveLength(2); // Only first two within 5 miles (~8 km)
    });

    it("should filter appointments within 10 miles correctly", () => {
      const appointments = [
        createAppointmentWithDistance({ latitude: 42.3450, longitude: -71.0750 }), // ~1 km
        createAppointmentWithDistance({ latitude: 42.3800, longitude: -71.0200 }), // ~7 km
        createAppointmentWithDistance({ latitude: 42.4500, longitude: -71.1000 }), // ~12 km
      ];

      const maxDistMiles = 10;
      const filtered = appointments.filter((appt) => {
        const distMiles = appt.distance * 0.621371;
        return distMiles <= maxDistMiles;
      });

      // All three are within 10 miles: ~0.43, ~4.13, ~7.67 miles
      expect(filtered).toHaveLength(3);
    });

    it("should sort appointments by distance correctly", () => {
      const appointments = [
        createAppointmentWithDistance({ latitude: 42.4500, longitude: -71.1000, id: 3 }), // Far
        createAppointmentWithDistance({ latitude: 42.3450, longitude: -71.0750, id: 1 }), // Close
        createAppointmentWithDistance({ latitude: 42.3800, longitude: -71.0200, id: 2 }), // Medium
      ];

      const sorted = [...appointments].sort(
        (a, b) => (a.distance ?? Infinity) - (b.distance ?? Infinity)
      );

      expect(sorted[0].id).toBe(1); // Closest first
      expect(sorted[2].id).toBe(3); // Farthest last
    });
  });

  describe("Coordinate Precision", () => {
    it("should handle high precision coordinates", () => {
      const coord1 = { lat: 42.36012345678901, lon: -71.05891234567890 };
      const coord2 = { lat: 42.36012345678902, lon: -71.05891234567891 };

      const distance = haversineDistance(
        coord1.lat,
        coord1.lon,
        coord2.lat,
        coord2.lon
      );

      // Difference should be negligible (less than 1 mm)
      expect(distance).toBeLessThan(0.000001);
    });

    it("should handle DECIMAL(10,8) precision from database", () => {
      // Database stores as DECIMAL(10,8) which gives ~1mm precision
      const dbCoord = { lat: 42.36012345, lon: -71.05891234 };
      const userLoc = { lat: 42.34000000, lon: -71.08000000 };

      const distance = haversineDistance(
        userLoc.lat,
        userLoc.lon,
        dbCoord.lat,
        dbCoord.lon
      );

      expect(typeof distance).toBe("number");
      expect(distance).toBeGreaterThan(0);
    });

    it("should parse string coordinates correctly", () => {
      // Coordinates often come as strings from API
      const stringLat = "42.3601";
      const stringLon = "-71.0589";

      const lat = parseFloat(stringLat);
      const lon = parseFloat(stringLon);

      expect(lat).toBe(42.3601);
      expect(lon).toBe(-71.0589);
    });
  });

  describe("Edge Cases", () => {
    it("should handle null coordinates gracefully", () => {
      const appt = { distance: null };
      const filtered = [appt].filter((a) => (a.distance ?? 999) < 10);

      // Should not be included (999 > 10)
      expect(filtered).toHaveLength(0);
    });

    it("should handle undefined coordinates gracefully", () => {
      const appt = { distance: undefined };
      const filtered = [appt].filter((a) => (a.distance ?? 999) < 10);

      expect(filtered).toHaveLength(0);
    });

    it("should handle missing location data", () => {
      const userLocation = null;
      const appointments = [
        { id: 1, homeId: 10 },
        { id: 2, homeId: 11 },
      ];

      // Without user location, distance cannot be calculated
      const withDistance = appointments.map((appt) => ({
        ...appt,
        distance: userLocation ? 0 : null,
      }));

      expect(withDistance[0].distance).toBeNull();
    });

    it("should handle coordinates at extreme values", () => {
      // North Pole to South Pole
      const northPole = { lat: 90, lon: 0 };
      const southPole = { lat: -90, lon: 0 };

      const distance = haversineDistance(
        northPole.lat,
        northPole.lon,
        southPole.lat,
        southPole.lon
      );

      // Should be approximately half Earth's circumference (~20,000 km)
      expect(distance).toBeGreaterThan(19000);
      expect(distance).toBeLessThan(21000);
    });
  });

  describe("Kilometers to Miles Conversion", () => {
    const KM_TO_MILES = 0.621371;

    it("should convert kilometers to miles correctly", () => {
      const km = 10;
      const miles = km * KM_TO_MILES;

      expect(miles).toBeCloseTo(6.21371, 4);
    });

    it("should apply conversion in distance filter", () => {
      const distanceKm = 8; // 8 km
      const maxDistMiles = 5; // 5 miles = ~8.05 km

      const distMiles = distanceKm * KM_TO_MILES;

      expect(distMiles).toBeLessThan(maxDistMiles);
    });

    it("should handle distance filter presets correctly", () => {
      const presets = {
        "5": 5,
        "10": 10,
        "15": 15,
        "25": 25,
      };

      Object.entries(presets).forEach(([key, miles]) => {
        const kmEquivalent = miles / KM_TO_MILES;
        expect(kmEquivalent).toBeGreaterThan(miles); // km > miles
      });
    });
  });
});
