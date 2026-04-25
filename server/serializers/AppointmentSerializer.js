const EncryptionService = require("../services/EncryptionService");
const MultiCleanerService = require("../services/MultiCleanerService");


class AppointmentSerializer {
	// Fields that are encrypted in the database
	static encryptedFields = ["keyPadCode", "keyLocation", "contact"];

	// Fields that are stored in cents and should be converted to dollars for display
	static centsFields = ["price", "originalPrice", "lastMinuteFeeApplied"];

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
		// Return cents fields as-is (frontend handles conversion to dollars for display)
		if (this.centsFields.includes(attribute) && value !== null && value !== undefined) {
			return value;
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
			"employeesNeeded",
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
			"cleanerRoomAssignments",
			"cleanersNeeded",
			"cleanersConfirmed",
			"multiCleanerStatus",
			// Pending request count (for homeowners to see cleaner requests)
			"pendingRequestCount",
			// Pending approval count (cleaner join requests awaiting homeowner approval)
			"pendingApprovalCount",
			// Completion status fields
			"completionStatus",
			"completionSubmittedAt",
			"autoApprovalExpiresAt",
			// Paused state fields (homeowner account frozen)
			"isPaused",
			"pausedAt",
			"pauseReason",
			// Cancellation fields
			"wasCancelled",
			"cancellationType",
			"cancellationReason"
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
			"employeesNeeded",
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
			"cleanerRoomAssignments",
			"cleanersNeeded",
			"cleanersConfirmed",
			"multiCleanerStatus",
			// Pending request count (for homeowners to see cleaner requests)
			"pendingRequestCount",
			// Pending approval count (cleaner join requests awaiting homeowner approval)
			"pendingApprovalCount",
			// Completion status fields
			"completionStatus",
			"completionSubmittedAt",
			"autoApprovalExpiresAt",
			// Paused state fields (homeowner account frozen)
			"isPaused",
			"pausedAt",
			"pauseReason",
			// Cancellation fields
			"wasCancelled",
			"cancellationType",
			"cancellationReason"
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

					const homeData = home.dataValues || home;
					const decryptField = (val) => (val ? EncryptionService.decrypt(val) : null);
					// Coordinates may be encrypted strings when home is a nested include
					// (afterFind hook only fires for direct queries). Decrypt and parse explicitly.
					const decryptCoord = (val) => {
						if (val === null || val === undefined) return null;
						if (typeof val === "number") return isNaN(val) ? null : val;
						const dec = EncryptionService.decrypt(String(val));
						const num = parseFloat(dec);
						return isNaN(num) ? null : num;
					};

					return {
						...appt,
						isLargeHome,
						isEdgeLargeHome,
						soloAllowed,
						numBeds,
						numBaths,
						// Named home props for EmployeeAssignmentTile (avoids extra API call)
						homeCity: decryptField(homeData.city),
						homeState: decryptField(homeData.state),
						homeNumBeds: numBeds,
						homeNumBaths: numBaths,
						// Include home location for distance calculations
						latitude: decryptCoord(homeData.latitude),
						longitude: decryptCoord(homeData.longitude),
						// Include home timezone for date handling
						timezone: homeData.timezone || "America/New_York",
					};
				}

				return appt;
			})
		);

		return enriched;
	}
}

module.exports = AppointmentSerializer;
