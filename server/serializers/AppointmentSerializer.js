class AppointmentSerializer {
	static serializeArray(appointmentArray) {
		const allowedAttributes = ["id", "date", "price", "userId", "homeId"];
		const serializedAppointment = appointmentArray.map((appointment) => {
			const newAppointment = {};
			for (const attribute of allowedAttributes) {
				newAppointment[attribute] = appointment.dataValues[attribute];
			}
			return newAppointment;
		});
		return serializedAppointment;
	}
}

module.exports = AppointmentSerializer;