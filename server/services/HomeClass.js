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
				const country = response.data.country
				const zipcode = response.data["post code"]
				const city = response.data.places[0]["place name"]
				const state = response.data.places[0]["state"]
				const lat = response.data.places[0]["latitude"]
				const lng = response.data.places[0]["longitude"]
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
