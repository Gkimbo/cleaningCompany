class HomeSerializer {
	static serializeArray(homeArray) {
		const allowedAttributes = [
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
			"timeToBeCompleted"
		];
		const serializedHome = homeArray.map((home) => {
			const newHome = {};
			for (const attribute of allowedAttributes) {
				newHome[attribute] = home.dataValues[attribute];
			}
			return newHome;
		});
		return serializedHome;
	}
}

module.exports = HomeSerializer;
