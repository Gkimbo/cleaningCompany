const HomeSerializer = require("./homesSerializer");
const AppointmentSerializer = require("./AppointmentSerializer");
class UserSerializer {
	static serializeOne(user) {
		const allowedAttributes = ["id", "email", "username", "lastLogin"];
		const serializedUser = {};
		let homes = [];

		for (const attribute of allowedAttributes) {
			serializedUser[attribute] = user[attribute];
		}

		if (user.homes) {
			homes = HomeSerializer.serializeArray(user.homes);
			serializedUser.homes = homes;
		}

		if (user.appointments) {
			const appointments = AppointmentSerializer.serializeArray(
				user.appointments
			);
			serializedUser.appointments = appointments;
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
