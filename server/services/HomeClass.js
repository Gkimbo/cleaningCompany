const axios = require("axios");
const cheerio = require("cheerio");

const googleApiKey = process.env.GOOGLE_MAPS;

class HomeClass {
  static async checkZipCodeExists(zipcode) {
    try {
      const response = await axios.get(
        // `https://maps.googleapis.com/maps/api/geocode/json?address=${zipcode}&key=${googleApiKey}`
        `https://api.zippopotam.us/us/${zipcode}`
      );
      // const { results } = response;
      if (response.data["post code"]) {
        // const { lat, lng } = results[0].geometry.location;
        const country = response.data.country;
        const zipcode = response.data["post code"];
        const city = response.data.places[0]["place name"];
        const state = response.data.places[0]["state"];
        const lat = response.data.places[0]["latitude"];
        const lng = response.data.places[0]["longitude"];
        return true;
      } else {
        return false;
      }
    } catch (error) {
      console.log(error);
      console.error("Error getting latitude and longitude:", error);
      throw error;
    }
  }

  static async getLatAndLong(zipcode) {
    try {
      const response = await axios.get(
        // `https://maps.googleapis.com/maps/api/geocode/json?address=${zipcode}&key=${googleApiKey}`
        `https://api.zippopotam.us/us/${zipcode}`
      );
      // const { results } = response;
      if (response.data["post code"]) {
        // const { lat, lng } = results[0].geometry.location;
        const country = response.data.country;
        const zipcode = response.data["post code"];
        const city = response.data.places[0]["place name"];
        const state = response.data.places[0]["state"];
        const latitude = response.data.places[0]["latitude"];
        const longitude = response.data.places[0]["longitude"];
        return { latitude, longitude };
      } else {
        return { latitude: null, longitude: null };
      }
    } catch (error) {
      console.log(error);
      console.error("Error getting latitude and longitude:", error);
      throw error;
    }
  }

  static async geocodeAddress(address, city, state, zipcode) {
    const fullAddress = `${address}, ${city}, ${state} ${zipcode}, USA`;
    const encodedAddress = encodeURIComponent(fullAddress);
    const maxRetries = 3;
    const retryDelay = 3000; // 3 seconds

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const response = await axios.get(
          `https://nominatim.openstreetmap.org/search?q=${encodedAddress}&format=json&limit=1`,
          {
            headers: {
              "User-Agent": "CleaningCompanyApp/1.0",
            },
            timeout: 10000, // 10 second timeout
          }
        );

        if (response.data && response.data.length > 0) {
          return {
            latitude: parseFloat(response.data[0].lat),
            longitude: parseFloat(response.data[0].lon),
          };
        }

        // Address not found in Nominatim - no point retrying
        console.log(`Address not found in Nominatim: ${fullAddress}`);
        break;
      } catch (error) {
        console.error(
          `Geocoding attempt ${attempt}/${maxRetries} failed:`,
          error.message
        );

        if (attempt < maxRetries) {
          console.log(`Retrying in ${retryDelay / 1000} seconds...`);
          await new Promise((resolve) => setTimeout(resolve, retryDelay));
        }
      }
    }

    // Fallback to ZIP code center after all retries exhausted
    console.log(`Falling back to ZIP code center for: ${fullAddress}`);
    return await this.getLatAndLong(zipcode);
  }
}

module.exports = HomeClass;
