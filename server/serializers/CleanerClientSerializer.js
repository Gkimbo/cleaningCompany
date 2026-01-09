const EncryptionService = require("../services/EncryptionService");

class CleanerClientSerializer {
	static decryptField(value) {
		if (!value) return null;
		return EncryptionService.decrypt(value);
	}

	static serializeUser(user) {
		if (!user) return null;
		const data = user.dataValues || user;
		return {
			id: data.id,
			firstName: this.decryptField(data.firstName),
			lastName: this.decryptField(data.lastName),
			email: this.decryptField(data.email),
			phone: this.decryptField(data.phone)
		};
	}

	static serializeHome(home) {
		if (!home) return null;
		const data = home.dataValues || home;
		return {
			id: data.id,
			address: this.decryptField(data.address),
			city: this.decryptField(data.city),
			state: this.decryptField(data.state),
			zipcode: this.decryptField(data.zipcode),
			numBeds: data.numBeds,
			numBaths: data.numBaths
		};
	}

	static parseAddress(invitedAddress) {
		if (!invitedAddress) return null;
		if (typeof invitedAddress === "object") return invitedAddress;
		try {
			return JSON.parse(invitedAddress);
		} catch (e) {
			return invitedAddress;
		}
	}

	static serializeOne(cleanerClient) {
		const data = cleanerClient.dataValues || cleanerClient;

		const serialized = {
			id: data.id,
			cleanerId: data.cleanerId,
			clientId: data.clientId,
			homeId: data.homeId,
			inviteToken: data.inviteToken,
			invitedEmail: this.decryptField(data.invitedEmail),
			invitedName: this.decryptField(data.invitedName),
			invitedPhone: this.decryptField(data.invitedPhone),
			invitedAddress: this.parseAddress(data.invitedAddress),
			invitedBeds: data.invitedBeds,
			invitedBaths: data.invitedBaths ? parseFloat(data.invitedBaths) : null,
			invitedNotes: data.invitedNotes,
			status: data.status,
			invitedAt: data.invitedAt,
			acceptedAt: data.acceptedAt,
			lastInviteReminderAt: data.lastInviteReminderAt,
			defaultFrequency: data.defaultFrequency,
			defaultPrice: data.defaultPrice ? parseFloat(data.defaultPrice) : null,
			defaultDayOfWeek: data.defaultDayOfWeek,
			defaultTimeWindow: data.defaultTimeWindow,
			autoPayEnabled: data.autoPayEnabled,
			autoScheduleEnabled: data.autoScheduleEnabled,
			createdAt: data.createdAt,
			updatedAt: data.updatedAt
		};

		// Add day name for convenience
		if (data.defaultDayOfWeek !== null && data.defaultDayOfWeek !== undefined) {
			const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
			serialized.defaultDayName = dayNames[data.defaultDayOfWeek] || null;
		}

		// Serialize related entities if included
		if (cleanerClient.cleaner) {
			serialized.cleaner = this.serializeUser(cleanerClient.cleaner);
		}

		if (cleanerClient.client) {
			serialized.client = this.serializeUser(cleanerClient.client);
		}

		if (cleanerClient.home) {
			serialized.home = this.serializeHome(cleanerClient.home);
		}

		if (cleanerClient.recurringSchedules) {
			serialized.recurringSchedules = cleanerClient.recurringSchedules.map(schedule => ({
				id: schedule.id,
				frequency: schedule.frequency,
				dayOfWeek: schedule.dayOfWeek,
				price: schedule.price ? parseFloat(schedule.price) : null,
				isActive: schedule.isActive,
				isPaused: schedule.isPaused
			}));
		}

		return serialized;
	}

	static serializeArray(cleanerClients) {
		return cleanerClients.map((cleanerClient) => this.serializeOne(cleanerClient));
	}

	static serializeForList(cleanerClient) {
		const data = cleanerClient.dataValues || cleanerClient;

		const serialized = {
			id: data.id,
			invitedName: this.decryptField(data.invitedName),
			invitedEmail: this.decryptField(data.invitedEmail),
			status: data.status,
			defaultFrequency: data.defaultFrequency,
			defaultPrice: data.defaultPrice ? parseFloat(data.defaultPrice) : null,
			invitedAt: data.invitedAt,
			acceptedAt: data.acceptedAt
		};

		if (cleanerClient.client) {
			serialized.client = this.serializeUser(cleanerClient.client);
		}

		if (cleanerClient.home) {
			serialized.home = this.serializeHome(cleanerClient.home);
		}

		return serialized;
	}

	static serializeArrayForList(cleanerClients) {
		return cleanerClients.map((cleanerClient) => this.serializeForList(cleanerClient));
	}

	static serializeInvitation(cleanerClient) {
		const data = cleanerClient.dataValues || cleanerClient;

		return {
			id: data.id,
			inviteToken: data.inviteToken,
			invitedName: this.decryptField(data.invitedName),
			invitedEmail: this.decryptField(data.invitedEmail),
			invitedPhone: this.decryptField(data.invitedPhone),
			invitedAddress: this.parseAddress(data.invitedAddress),
			invitedBeds: data.invitedBeds,
			invitedBaths: data.invitedBaths ? parseFloat(data.invitedBaths) : null,
			invitedNotes: data.invitedNotes,
			defaultFrequency: data.defaultFrequency,
			defaultPrice: data.defaultPrice ? parseFloat(data.defaultPrice) : null,
			status: data.status,
			invitedAt: data.invitedAt
		};
	}
}

module.exports = CleanerClientSerializer;
