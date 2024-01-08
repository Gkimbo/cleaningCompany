const HomeSerializer = require("./homesSerializer");
class UserSerializer {
	static serializeOne(user) {
		const allowedAttributes = ["id", "email", "username", "lastLogin"];
		const serializedUser = {};
		let homes = [];

		for (const attribute of allowedAttributes) {
			serializedUser[attribute] = user[attribute];
		}

		if (user.userHomes) {
			homes = HomeSerializer.serializeArray(user.userHomes);
			serializedUser.homes = homes;
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
