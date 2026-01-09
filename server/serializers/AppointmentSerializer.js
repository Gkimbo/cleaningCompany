const EncryptionService = require("../services/EncryptionService");

class AppointmentSerializer {
	// Fields that are encrypted in the database
	static encryptedFields = ["keyPadCode", "keyLocation", "contact"];

	static getValue(data, attribute) {
		const value = data[attribute];
		// EncryptionService.decrypt() safely handles both encrypted and unencrypted data
		if (this.encryptedFields.includes(attribute) && value) {
			return EncryptionService.decrypt(value);
		}
		// Parse DECIMAL fields to ensure they're numbers, not strings
		if (this.decimalFields.includes(attribute) && value !== null && value !== undefined) {
			return parseFloat(value);
		}
		return value;
	}

	// Fields that are DECIMAL in the database and need parseFloat
	static decimalFields = ["discountPercent"];

	static serializeArray(appointmentArray) {
		const allowedAttributes = [
			"id",
			"date",
			"price",
			"userId",
			"homeId",
			"paid",
			"bringTowels",
			"bringSheets",
			"keyPadCode",
			"keyLocation",
			"completed",
			"hasBeenAssigned",
			"employeesAssigned",
			"empoyeesNeeded",
			"timeToBeCompleted",
			"paymentCaptureFailed",
			"contact",
			"sheetConfigurations",
			"towelConfigurations",
			"hasClientReview",
			"hasCleanerReview",
			"discountApplied",
			"discountPercent",
			"originalPrice",
			// Last-minute booking fields
			"isLastMinuteBooking",
			"lastMinuteFeeApplied",
			"lastMinuteNotificationsSentAt"
		];
		const serializedAppointment = appointmentArray.map((appointment) => {
			const newAppointment = {};
			// Handle both Sequelize instances and plain objects
			const data = appointment.dataValues || appointment;
			for (const attribute of allowedAttributes) {
				newAppointment[attribute] = this.getValue(data, attribute);
			}
			return newAppointment;
		});

		return serializedAppointment;
	}
	static serializeOne(appointment) {
		const allowedAttributes = [
			"id",
			"date",
			"price",
			"userId",
			"homeId",
			"paid",
			"bringTowels",
			"bringSheets",
			"keyPadCode",
			"keyLocation",
			"completed",
			"hasBeenAssigned",
			"employeesAssigned",
			"empoyeesNeeded",
			"timeToBeCompleted",
			"paymentCaptureFailed",
			"contact",
			"sheetConfigurations",
			"towelConfigurations",
			"hasClientReview",
			"hasCleanerReview",
			"discountApplied",
			"discountPercent",
			"originalPrice",
			// Last-minute booking fields
			"isLastMinuteBooking",
			"lastMinuteFeeApplied",
			"lastMinuteNotificationsSentAt"
		];
		const newAppointment = {};
		// Handle both Sequelize instances and plain objects
		const data = appointment.dataValues || appointment;
		for (const attribute of allowedAttributes) {
			newAppointment[attribute] = this.getValue(data, attribute);
		}
		return newAppointment;
	}
}

module.exports = AppointmentSerializer;
