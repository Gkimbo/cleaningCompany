const EncryptionService = require("../services/EncryptionService");

class RecurringScheduleSerializer {
	static decryptUserField(value) {
		if (!value) return null;
		return EncryptionService.decrypt(value);
	}

	static serializeUser(user) {
		if (!user) return null;
		const data = user.dataValues || user;
		return {
			id: data.id,
			firstName: this.decryptUserField(data.firstName),
			lastName: this.decryptUserField(data.lastName),
			email: this.decryptUserField(data.email),
			phone: this.decryptUserField(data.phone)
		};
	}

	static serializeHome(home) {
		if (!home) return null;
		const data = home.dataValues || home;
		return {
			id: data.id,
			address: this.decryptUserField(data.address),
			city: this.decryptUserField(data.city),
			state: this.decryptUserField(data.state),
			zipcode: this.decryptUserField(data.zipcode),
			numBeds: data.numBeds,
			numBaths: data.numBaths
		};
	}

	static serializeOne(schedule) {
		const data = schedule.dataValues || schedule;

		const serialized = {
			id: data.id,
			cleanerClientId: data.cleanerClientId,
			homeId: data.homeId,
			cleanerId: data.cleanerId,
			clientId: data.clientId,
			frequency: data.frequency,
			dayOfWeek: data.dayOfWeek,
			timeWindow: data.timeWindow,
			price: data.price,
			startDate: data.startDate,
			endDate: data.endDate,
			nextScheduledDate: data.nextScheduledDate,
			lastGeneratedDate: data.lastGeneratedDate,
			isActive: data.isActive,
			isPaused: data.isPaused,
			pausedUntil: data.pausedUntil,
			pauseReason: data.pauseReason,
			createdAt: data.createdAt,
			updatedAt: data.updatedAt
		};

		// Add day name for convenience
		const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
		serialized.dayName = dayNames[data.dayOfWeek] || null;

		// Serialize related entities if included
		if (schedule.cleaner) {
			serialized.cleaner = this.serializeUser(schedule.cleaner);
		}

		if (schedule.client) {
			serialized.client = this.serializeUser(schedule.client);
		}

		if (schedule.home) {
			serialized.home = this.serializeHome(schedule.home);
		}

		return serialized;
	}

	static serializeArray(schedules) {
		return schedules.map((schedule) => this.serializeOne(schedule));
	}

	static serializeForList(schedule) {
		const data = schedule.dataValues || schedule;
		const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

		return {
			id: data.id,
			frequency: data.frequency,
			dayOfWeek: data.dayOfWeek,
			dayName: dayNames[data.dayOfWeek] || null,
			timeWindow: data.timeWindow,
			price: data.price,
			nextScheduledDate: data.nextScheduledDate,
			isActive: data.isActive,
			isPaused: data.isPaused
		};
	}

	static serializeArrayForList(schedules) {
		return schedules.map((schedule) => this.serializeForList(schedule));
	}
}

module.exports = RecurringScheduleSerializer;
