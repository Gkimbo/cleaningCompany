const HomeSerializer = require("./homesSerializer");
const AppointmentSerializer = require("./AppointmentSerializer");
const BillSerializer = require("./BillSerializer");
const EncryptionService = require("../services/EncryptionService");

class UserSerializer {
	// Fields that are encrypted in the database
	static encryptedFields = ["firstName", "lastName", "email", "phone", "notificationEmail"];

	static getValue(user, attribute) {
		const value = user[attribute];
		// EncryptionService.decrypt() safely handles both encrypted and unencrypted data
		if (this.encryptedFields.includes(attribute) && value) {
			return EncryptionService.decrypt(value);
		}
		return value;
	}

	static serializeOne(user) {
		const allowedAttributes = [
			"id",
			"firstName",
			"lastName",
			"email",
			"username",
			"phone",
			"lastLogin",
			"type",
			"daysWorking",
			"notifications",
			"reviews",
			"hasPaymentMethod",
			"referralCode",
			"referralCredits",
			"isBusinessOwner",
			"businessName",
			"yearsInBusiness"
		];

		const serializedUser = {};
		let homes = [];

		for (const attribute of allowedAttributes) {
			serializedUser[attribute] = this.getValue(user, attribute);
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
		const allowedAttributes = [
			"id",
			"firstName",
			"lastName",
			"email",
			"username",
			"phone",
			"lastLogin",
			"type",
			"daysWorking",
			"hasPaymentMethod",
			"referralCode",
			"referralCredits",
			"isBusinessOwner",
			"businessName",
			"yearsInBusiness",
		];
		const serializedUser = {};

		for (const attribute of allowedAttributes) {
			serializedUser[attribute] = this.getValue(user, attribute);
		}

		return serializedUser;
	}
}

module.exports = UserSerializer;
