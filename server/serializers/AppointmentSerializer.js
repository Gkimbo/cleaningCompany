const EncryptionService = require("../services/EncryptionService");
const MultiCleanerService = require("../services/MultiCleanerService");

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
			"lastMinuteNotificationsSentAt",
			// Multi-cleaner fields
			"isMultiCleanerJob",
			"multiCleanerJobId",
			"multiCleanerJob",
			"cleanerRoomAssignments"
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
			"lastMinuteNotificationsSentAt",
			// Multi-cleaner fields
			"isMultiCleanerJob",
			"multiCleanerJobId",
			"multiCleanerJob",
			"cleanerRoomAssignments"
		];
		const newAppointment = {};
		// Handle both Sequelize instances and plain objects
		const data = appointment.dataValues || appointment;
		for (const attribute of allowedAttributes) {
			newAppointment[attribute] = this.getValue(data, attribute);
		}
		return newAppointment;
	}

	/**
	 * Serialize appointments with edge large home info for cleaner job listings
	 * This async method checks if each appointment is an edge large home
	 * @param {Array} appointmentArray - Array of appointments with home data
	 * @returns {Promise<Array>} Serialized appointments with isEdgeLargeHome flag
	 */
	static async serializeArrayWithEdgeInfo(appointmentArray) {
		const serialized = this.serializeArray(appointmentArray);

		// Add edge large home info to each appointment
		const enriched = await Promise.all(
			serialized.map(async (appt, index) => {
				const original = appointmentArray[index];
				const home = original.home || original.dataValues?.home;

				if (home) {
					const numBeds = parseInt(home.numBeds) || 0;
					const numBaths = parseInt(home.numBaths) || 0;
					const isLargeHome = await MultiCleanerService.isLargeHome(numBeds, numBaths);
					const isEdgeLargeHome = await MultiCleanerService.isEdgeLargeHome(numBeds, numBaths);
					const soloAllowed = await MultiCleanerService.isSoloAllowed(numBeds, numBaths);

					return {
						...appt,
						isLargeHome,
						isEdgeLargeHome,
						soloAllowed,
						numBeds,
						numBaths,
					};
				}

				return appt;
			})
		);

		return enriched;
	}
}

module.exports = AppointmentSerializer;
