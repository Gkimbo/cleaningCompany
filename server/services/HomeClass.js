const axios = require("axios");
const cheerio = require("cheerio");
const getCarbonIntensity = require("./getLocationCarbonIntensity");
const googleApiKey = process.env.GOOGLE_MAPS;

class HomeClass {
	static async checkZipCodeExists(zipcode) {
		try {
			const response = await axios.get(
				`https://maps.googleapis.com/maps/api/geocode/json?address=${zipcode}&key=${googleApiKey}`
			);
			const { results } = response.data;
			if (results.length > 0) {
				const { lat, lng } = results[0].geometry.location;
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
}

module.exports = HomeClass;
