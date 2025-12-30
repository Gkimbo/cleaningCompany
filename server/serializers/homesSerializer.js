const EncryptionService = require("../services/EncryptionService");

class HomeSerializer {
	static allowedAttributes = [
		"id",
		"nickName",
		"address",
		"city",
		"state",
		"zipcode",
		"numBeds",
		"numBaths",
		"sheetsProvided",
		"towelsProvided",
		"keyPadCode",
		"keyLocation",
		"recyclingLocation",
		"compostLocation",
		"trashLocation",
		"contact",
		"specialNotes",
		"cleanersNeeded",
		"timeToBeCompleted",
		"outsideServiceArea",
		"bedConfigurations",
		"bathroomConfigurations",
		"cleanSheetsLocation",
		"dirtySheetsLocation",
		"cleanTowelsLocation",
		"dirtyTowelsLocation"
	];

	// Fields that are encrypted in the database
	static encryptedFields = [
		"address",
		"city",
		"state",
		"zipcode",
		"keyPadCode",
		"keyLocation",
		"contact",
	];

	static getValue(home, attribute) {
		// Get value from dataValues or directly from home object
		const value = home.dataValues ? home.dataValues[attribute] : home[attribute];

		// If this is an encrypted field, check if it needs decryption
		if (this.encryptedFields.includes(attribute) && value) {
			// Check if value looks encrypted (contains colon with two parts)
			if (typeof value === 'string' && value.includes(':') && value.split(':').length === 2) {
				try {
					return EncryptionService.decrypt(value);
				} catch (e) {
					// If decryption fails, return as-is
					return value;
				}
			}
		}

		return value;
	}

	static serializeOne(home) {
		if (!home) return null;
		const newHome = {};
		for (const attribute of this.allowedAttributes) {
			newHome[attribute] = this.getValue(home, attribute);
		}
		return newHome;
	}

	static serializeArray(homeArray) {
		const serializedHome = homeArray.map((home) => {
			const newHome = {};
			for (const attribute of this.allowedAttributes) {
				newHome[attribute] = this.getValue(home, attribute);
			}
			return newHome;
		});
		return serializedHome;
	}
}

module.exports = HomeSerializer;
