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
			"timeToBeCompleted"
		];
		const serializedAppointment = appointmentArray.map((appointment) => {
			const newAppointment = {};
			for (const attribute of allowedAttributes) {
				newAppointment[attribute] = appointment.dataValues[attribute];
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
			"timeToBeCompleted"
		];
		
			const newAppointment = {};
			for (const attribute of allowedAttributes) {
				newAppointment[attribute] = appointment.dataValues[attribute];
			}
			return newAppointment;
	
	}
}

module.exports = AppointmentSerializer;
