const axios = require("axios");
const HomeClass = require("../../services/HomeClass");

// Mock axios
jest.mock("axios");

describe("HomeClass", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const mockZipCodeResponse = {
    data: {
      "post code": "02101",
      country: "United States",
      places: [
        {
          "place name": "Boston",
          state: "Massachusetts",
          latitude: "42.3601",
          longitude: "-71.0589",
        },
      ],
    },
  };

  describe("checkZipCodeExists", () => {
    it("should return true for valid zipcode", async () => {
      axios.get.mockResolvedValue(mockZipCodeResponse);

      const result = await HomeClass.checkZipCodeExists("02101");

      expect(result).toBe(true);
      expect(axios.get).toHaveBeenCalledWith(
        "https://api.zippopotam.us/us/02101"
      );
    });

    it("should return false for zipcode with no data", async () => {
      axios.get.mockResolvedValue({ data: {} });

      const result = await HomeClass.checkZipCodeExists("00000");

      expect(result).toBe(false);
    });

    it("should throw error on API failure", async () => {
      axios.get.mockRejectedValue(new Error("API unavailable"));

      await expect(HomeClass.checkZipCodeExists("02101")).rejects.toThrow(
        "API unavailable"
      );
    });

    it("should handle different valid zipcodes", async () => {
      const laResponse = {
        data: {
          "post code": "90210",
          country: "United States",
          places: [
            {
              "place name": "Beverly Hills",
              state: "California",
              latitude: "34.0901",
              longitude: "-118.4065",
            },
          ],
        },
      };
      axios.get.mockResolvedValue(laResponse);

      const result = await HomeClass.checkZipCodeExists("90210");

      expect(result).toBe(true);
    });

    it("should handle network timeout", async () => {
      const timeoutError = new Error("timeout of 5000ms exceeded");
      timeoutError.code = "ECONNABORTED";
      axios.get.mockRejectedValue(timeoutError);

      await expect(HomeClass.checkZipCodeExists("02101")).rejects.toThrow(
        "timeout"
      );
    });
  });

  describe("getLatAndLong", () => {
    it("should return latitude and longitude for valid zipcode", async () => {
      axios.get.mockResolvedValue(mockZipCodeResponse);

      const result = await HomeClass.getLatAndLong("02101");

      expect(result).toEqual({
        latitude: "42.3601",
        longitude: "-71.0589",
      });
    });

    it("should return nulls for invalid zipcode data", async () => {
      axios.get.mockResolvedValue({ data: {} });

      const result = await HomeClass.getLatAndLong("00000");

      expect(result).toEqual({
        latitude: null,
        longitude: null,
      });
    });

    it("should throw error on API failure", async () => {
      axios.get.mockRejectedValue(new Error("Network error"));

      await expect(HomeClass.getLatAndLong("02101")).rejects.toThrow(
        "Network error"
      );
    });

    it("should call correct API endpoint", async () => {
      axios.get.mockResolvedValue(mockZipCodeResponse);

      await HomeClass.getLatAndLong("02101");

      expect(axios.get).toHaveBeenCalledWith(
        "https://api.zippopotam.us/us/02101"
      );
    });

    it("should handle different locations correctly", async () => {
      const nyResponse = {
        data: {
          "post code": "10001",
          country: "United States",
          places: [
            {
              "place name": "New York City",
              state: "New York",
              latitude: "40.7484",
              longitude: "-73.9967",
            },
          ],
        },
      };
      axios.get.mockResolvedValue(nyResponse);

      const result = await HomeClass.getLatAndLong("10001");

      expect(result.latitude).toBe("40.7484");
      expect(result.longitude).toBe("-73.9967");
    });
  });
});
