const { calculateDistance, isWithinRadius, GPS_VERIFICATION_RADIUS_METERS } = require("../../utils/geoUtils");

describe("geoUtils", () => {
  describe("calculateDistance", () => {
    it("should calculate distance between two points correctly", () => {
      // New York City to Los Angeles (approximately 3,940 km)
      const nyLat = 40.7128;
      const nyLon = -74.006;
      const laLat = 34.0522;
      const laLon = -118.2437;

      const distance = calculateDistance(nyLat, nyLon, laLat, laLon);

      // Should be approximately 3,940 km (3,940,000 meters)
      expect(distance).toBeGreaterThan(3900000);
      expect(distance).toBeLessThan(4000000);
    });

    it("should return 0 for same location", () => {
      const lat = 40.7128;
      const lon = -74.006;

      const distance = calculateDistance(lat, lon, lat, lon);
      expect(distance).toBe(0);
    });

    it("should calculate short distances accurately", () => {
      // Two points about 100 meters apart
      const lat1 = 40.7128;
      const lon1 = -74.006;
      const lat2 = 40.7137; // About 100m north
      const lon2 = -74.006;

      const distance = calculateDistance(lat1, lon1, lat2, lon2);

      // Should be approximately 100 meters
      expect(distance).toBeGreaterThan(90);
      expect(distance).toBeLessThan(110);
    });

    it("should return null for null coordinates", () => {
      expect(calculateDistance(null, -74.006, 40.7128, -74.006)).toBeNull();
      expect(calculateDistance(40.7128, null, 40.7128, -74.006)).toBeNull();
      expect(calculateDistance(40.7128, -74.006, null, -74.006)).toBeNull();
      expect(calculateDistance(40.7128, -74.006, 40.7128, null)).toBeNull();
    });

    it("should return null for undefined coordinates", () => {
      expect(calculateDistance(undefined, -74.006, 40.7128, -74.006)).toBeNull();
    });

    it("should handle string coordinates", () => {
      const distance = calculateDistance("40.7128", "-74.006", "40.7137", "-74.006");
      expect(distance).toBeGreaterThan(90);
      expect(distance).toBeLessThan(110);
    });

    it("should return null for invalid string coordinates", () => {
      expect(calculateDistance("invalid", "-74.006", "40.7128", "-74.006")).toBeNull();
    });

    it("should handle negative coordinates (southern/western hemispheres)", () => {
      // Sydney, Australia
      const sydneyLat = -33.8688;
      const sydneyLon = 151.2093;
      // Melbourne, Australia
      const melbourneLat = -37.8136;
      const melbourneLon = 144.9631;

      const distance = calculateDistance(sydneyLat, sydneyLon, melbourneLat, melbourneLon);

      // Should be approximately 714 km
      expect(distance).toBeGreaterThan(700000);
      expect(distance).toBeLessThan(730000);
    });
  });

  describe("isWithinRadius", () => {
    it("should return true when within default radius", () => {
      // Two points about 50 meters apart
      const cleanerLat = 40.7128;
      const cleanerLon = -74.006;
      const homeLat = 40.71285;
      const homeLon = -74.006;

      const result = isWithinRadius(cleanerLat, cleanerLon, homeLat, homeLon);

      expect(result.isWithinRadius).toBe(true);
      expect(result.distance).toBeLessThan(GPS_VERIFICATION_RADIUS_METERS);
    });

    it("should return false when outside default radius", () => {
      // Two points about 500 meters apart
      const cleanerLat = 40.7128;
      const cleanerLon = -74.006;
      const homeLat = 40.7173;
      const homeLon = -74.006;

      const result = isWithinRadius(cleanerLat, cleanerLon, homeLat, homeLon);

      expect(result.isWithinRadius).toBe(false);
      expect(result.distance).toBeGreaterThan(GPS_VERIFICATION_RADIUS_METERS);
    });

    it("should respect custom radius", () => {
      // Two points about 300 meters apart
      const cleanerLat = 40.7128;
      const cleanerLon = -74.006;
      const homeLat = 40.7155;
      const homeLon = -74.006;

      // With default 200m radius, should be outside
      const result1 = isWithinRadius(cleanerLat, cleanerLon, homeLat, homeLon);
      expect(result1.isWithinRadius).toBe(false);

      // With 500m radius, should be inside
      const result2 = isWithinRadius(cleanerLat, cleanerLon, homeLat, homeLon, 500);
      expect(result2.isWithinRadius).toBe(true);
    });

    it("should return null for isWithinRadius when coordinates are missing", () => {
      const result = isWithinRadius(null, -74.006, 40.7128, -74.006);

      expect(result.isWithinRadius).toBeNull();
      expect(result.distance).toBeNull();
    });

    it("should return true for same location", () => {
      const lat = 40.7128;
      const lon = -74.006;

      const result = isWithinRadius(lat, lon, lat, lon);

      expect(result.isWithinRadius).toBe(true);
      expect(result.distance).toBe(0);
    });
  });

  describe("GPS_VERIFICATION_RADIUS_METERS", () => {
    it("should be 200 meters", () => {
      expect(GPS_VERIFICATION_RADIUS_METERS).toBe(200);
    });
  });
});
