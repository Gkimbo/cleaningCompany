const HomeSerializer = require("./homesSerializer");
const AppointmentSerializer = require("./AppointmentSerializer");
const BillSerializer = require("./BillSerializer");
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
		if (user.bills) {
			const bill = BillSerializer.serializeArray(user.bills);
			serializedUser.bill = bill;
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
