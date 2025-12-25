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

  describe("geocodeAddress", () => {
    const validAddress = "123 Main Street";
    const validCity = "Boston";
    const validState = "MA";
    const validZipcode = "02101";

    const mockNominatimSuccess = {
      data: [
        {
          lat: "42.3601",
          lon: "-71.0589",
          display_name: "123 Main Street, Boston, MA 02101, USA",
        },
      ],
    };

    const mockZipFallback = {
      data: {
        "post code": "02101",
        country: "United States",
        places: [
          {
            "place name": "Boston",
            state: "Massachusetts",
            latitude: "42.3706",
            longitude: "-71.0272",
          },
        ],
      },
    };

    describe("Successful Geocoding", () => {
      it("should return coordinates from Nominatim on success", async () => {
        axios.get.mockResolvedValueOnce(mockNominatimSuccess);

        const result = await HomeClass.geocodeAddress(
          validAddress,
          validCity,
          validState,
          validZipcode
        );

        expect(result).toEqual({
          latitude: 42.3601,
          longitude: -71.0589,
        });

        expect(axios.get).toHaveBeenCalledWith(
          expect.stringContaining("nominatim.openstreetmap.org"),
          expect.objectContaining({
            headers: { "User-Agent": "CleaningCompanyApp/1.0" },
            timeout: 10000,
          })
        );
      });

      it("should encode address properly in URL", async () => {
        axios.get.mockResolvedValueOnce(mockNominatimSuccess);

        await HomeClass.geocodeAddress(
          "123 Main St #4",
          "New York",
          "NY",
          "10001"
        );

        const calledUrl = axios.get.mock.calls[0][0];
        expect(calledUrl).toContain(encodeURIComponent("123 Main St #4"));
        expect(calledUrl).toContain(encodeURIComponent("New York"));
      });

      it("should parse latitude and longitude as floats", async () => {
        axios.get.mockResolvedValueOnce({
          data: [{ lat: "42.36012345", lon: "-71.05891234" }],
        });

        const result = await HomeClass.geocodeAddress(
          validAddress,
          validCity,
          validState,
          validZipcode
        );

        expect(typeof result.latitude).toBe("number");
        expect(typeof result.longitude).toBe("number");
        expect(result.latitude).toBeCloseTo(42.36012345, 5);
        expect(result.longitude).toBeCloseTo(-71.05891234, 5);
      });
    });

    describe("Fallback to ZIP Code", () => {
      it("should fallback to ZIP code when address not found in Nominatim", async () => {
        // Nominatim returns empty array (address not found)
        axios.get.mockResolvedValueOnce({ data: [] });
        // Zippopotam.us fallback
        axios.get.mockResolvedValueOnce(mockZipFallback);

        const result = await HomeClass.geocodeAddress(
          "999 Nonexistent St",
          validCity,
          validState,
          validZipcode
        );

        expect(result).toEqual({
          latitude: "42.3706",
          longitude: "-71.0272",
        });

        // Should have called Nominatim first, then Zippopotam
        expect(axios.get).toHaveBeenCalledTimes(2);
        expect(axios.get.mock.calls[1][0]).toContain("zippopotam.us");
      });
    });

    describe("Retry Logic", () => {
      it("should retry 3 times on network error before falling back", async () => {
        // All 3 Nominatim attempts fail
        axios.get.mockRejectedValueOnce(new Error("Network error"));
        axios.get.mockRejectedValueOnce(new Error("Network error"));
        axios.get.mockRejectedValueOnce(new Error("Network error"));
        // Zippopotam.us fallback succeeds
        axios.get.mockResolvedValueOnce(mockZipFallback);

        const result = await HomeClass.geocodeAddress(
          validAddress,
          validCity,
          validState,
          validZipcode
        );

        // 3 Nominatim retries + 1 Zippopotam fallback = 4 calls
        expect(axios.get).toHaveBeenCalledTimes(4);
        expect(result.latitude).toBe("42.3706");
      }, 15000); // Increased timeout for retry delays

      it("should succeed on second retry if first fails", async () => {
        // First attempt fails
        axios.get.mockRejectedValueOnce(new Error("Timeout"));
        // Second attempt succeeds
        axios.get.mockResolvedValueOnce(mockNominatimSuccess);

        const result = await HomeClass.geocodeAddress(
          validAddress,
          validCity,
          validState,
          validZipcode
        );

        expect(axios.get).toHaveBeenCalledTimes(2);
        expect(result.latitude).toBe(42.3601);
      }, 10000);

      it("should succeed on third retry if first two fail", async () => {
        axios.get.mockRejectedValueOnce(new Error("Timeout"));
        axios.get.mockRejectedValueOnce(new Error("Connection refused"));
        axios.get.mockResolvedValueOnce(mockNominatimSuccess);

        const result = await HomeClass.geocodeAddress(
          validAddress,
          validCity,
          validState,
          validZipcode
        );

        expect(axios.get).toHaveBeenCalledTimes(3);
        expect(result.latitude).toBe(42.3601);
      }, 15000);

      it("should NOT retry when address simply not found (empty response)", async () => {
        // Empty response means address doesn't exist - no point retrying
        axios.get.mockResolvedValueOnce({ data: [] });
        // Zippopotam fallback
        axios.get.mockResolvedValueOnce(mockZipFallback);

        await HomeClass.geocodeAddress(
          "Nonexistent Address",
          validCity,
          validState,
          validZipcode
        );

        // Only 1 Nominatim call (no retries) + 1 fallback = 2 calls
        expect(axios.get).toHaveBeenCalledTimes(2);
      });
    });

    describe("Request Configuration", () => {
      it("should include User-Agent header", async () => {
        axios.get.mockResolvedValueOnce(mockNominatimSuccess);

        await HomeClass.geocodeAddress(
          validAddress,
          validCity,
          validState,
          validZipcode
        );

        expect(axios.get).toHaveBeenCalledWith(
          expect.any(String),
          expect.objectContaining({
            headers: { "User-Agent": "CleaningCompanyApp/1.0" },
          })
        );
      });

      it("should set 10 second timeout", async () => {
        axios.get.mockResolvedValueOnce(mockNominatimSuccess);

        await HomeClass.geocodeAddress(
          validAddress,
          validCity,
          validState,
          validZipcode
        );

        expect(axios.get).toHaveBeenCalledWith(
          expect.any(String),
          expect.objectContaining({
            timeout: 10000,
          })
        );
      });

      it("should construct full address with USA suffix", async () => {
        axios.get.mockResolvedValueOnce(mockNominatimSuccess);

        await HomeClass.geocodeAddress(
          validAddress,
          validCity,
          validState,
          validZipcode
        );

        const calledUrl = axios.get.mock.calls[0][0];
        expect(calledUrl).toContain(encodeURIComponent("USA"));
      });
    });

    describe("Edge Cases", () => {
      it("should handle addresses with special characters", async () => {
        axios.get.mockResolvedValueOnce(mockNominatimSuccess);

        await HomeClass.geocodeAddress(
          "123 O'Brien's Way #4B",
          "San José",
          "CA",
          "95101"
        );

        expect(axios.get).toHaveBeenCalled();
        const calledUrl = axios.get.mock.calls[0][0];
        expect(calledUrl).toContain(encodeURIComponent("O'Brien's"));
      });

      it("should handle negative longitude values (West coast)", async () => {
        axios.get.mockResolvedValueOnce({
          data: [{ lat: "34.0522", lon: "-118.2437" }],
        });

        const result = await HomeClass.geocodeAddress(
          "100 Hollywood Blvd",
          "Los Angeles",
          "CA",
          "90028"
        );

        expect(result.longitude).toBe(-118.2437);
      });

      it("should handle coordinates with many decimal places", async () => {
        axios.get.mockResolvedValueOnce({
          data: [{ lat: "42.360108273649", lon: "-71.058924718364" }],
        });

        const result = await HomeClass.geocodeAddress(
          validAddress,
          validCity,
          validState,
          validZipcode
        );

        expect(result.latitude).toBeCloseTo(42.360108273649, 10);
      });

      it("should handle empty address gracefully", async () => {
        axios.get.mockResolvedValueOnce({ data: [] });
        axios.get.mockResolvedValueOnce(mockZipFallback);

        const result = await HomeClass.geocodeAddress(
          "",
          validCity,
          validState,
          validZipcode
        );

        // Should fallback to ZIP code
        expect(result.latitude).toBe("42.3706");
      });
    });
  });
});
