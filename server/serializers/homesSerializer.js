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
		// EncryptionService.decrypt() safely handles both encrypted and unencrypted data
		if (this.encryptedFields.includes(attribute) && value) {
			return EncryptionService.decrypt(value);
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
