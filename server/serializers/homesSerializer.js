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

	static serializeOne(home) {
		if (!home) return null;
		const newHome = {};
		for (const attribute of this.allowedAttributes) {
			newHome[attribute] = home.dataValues[attribute];
		}
		return newHome;
	}

	static serializeArray(homeArray) {
		const serializedHome = homeArray.map((home) => {
			const newHome = {};
			for (const attribute of this.allowedAttributes) {
				newHome[attribute] = home.dataValues[attribute];
			}
			return newHome;
		});
		return serializedHome;
	}
}

module.exports = HomeSerializer;
