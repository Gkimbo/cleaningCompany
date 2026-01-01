class AppointmentSerializer {
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
			"originalPrice"
		];
		const serializedAppointment = appointmentArray.map((appointment) => {
			const newAppointment = {};
			// Handle both Sequelize instances and plain objects
			const data = appointment.dataValues || appointment;
			for (const attribute of allowedAttributes) {
				newAppointment[attribute] = data[attribute];
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
			"originalPrice"
		];
		const newAppointment = {};
		// Handle both Sequelize instances and plain objects
		const data = appointment.dataValues || appointment;
		for (const attribute of allowedAttributes) {
			newAppointment[attribute] = data[attribute];
		}
		return newAppointment;
	}
}

module.exports = AppointmentSerializer;
