class HomeSerializer {
	static serializeArray(homeArray) {
		const allowedAttributes = [
			"id",
			"address",
			"city",
			"zipcode",
			"numBeds",
			"numBaths",
			"sheetsProvided",
			"towelsProvided",
			"KeyPadCode",
			"keyLocation",
			"recyclingLocation",
			"compostLocation",
			"trashLocation",
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
