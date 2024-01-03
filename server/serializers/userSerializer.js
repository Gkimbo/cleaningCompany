class UserSerializer {
	static serializeOne(user) {
		const allowedAttributes = ["id", "email", "username", "lastLogin"];
		const serializedUser = {};
		let information;
		let cars = [];
		let homes = [];

		for (const attribute of allowedAttributes) {
			serializedUser[attribute] = user[attribute];
		}

		return serializedUser;
	}

	static login(user) {
		const allowedAttributes = ["id", "email", "username"];
		const serializedUser = {};

		for (const attribute of allowedAttributes) {
			serializedUser[attribute] = user[attribute];
		}

		return serializedUser;
	}
}

module.exports = UserSerializer;
