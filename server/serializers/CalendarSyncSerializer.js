const EncryptionService = require("../services/EncryptionService");

class CalendarSyncSerializer {
	static serializeHome(home) {
		if (!home) return null;
		const data = home.dataValues || home;
		return {
			id: data.id,
			address: EncryptionService.decrypt(data.address),
			city: EncryptionService.decrypt(data.city),
			state: EncryptionService.decrypt(data.state),
			numBeds: data.numBeds,
			numBaths: data.numBaths
		};
	}

	static serializeOne(calendarSync) {
		const data = calendarSync.dataValues || calendarSync;

		const serialized = {
			id: data.id,
			userId: data.userId,
			homeId: data.homeId,
			platform: data.platform,
			icalUrl: data.icalUrl,
			isActive: data.isActive,
			lastSyncAt: data.lastSyncAt,
			lastSyncStatus: data.lastSyncStatus,
			lastSyncError: data.lastSyncError,
			syncedEventUids: data.syncedEventUids,
			autoCreateAppointments: data.autoCreateAppointments,
			daysAfterCheckout: data.daysAfterCheckout,
			autoSync: data.autoSync,
			deletedDates: data.deletedDates,
			createdAt: data.createdAt,
			updatedAt: data.updatedAt
		};

		// Serialize home if included
		if (calendarSync.home) {
			serialized.home = this.serializeHome(calendarSync.home);
		}

		return serialized;
	}

	static serializeArray(calendarSyncs) {
		return calendarSyncs.map((calendarSync) => this.serializeOne(calendarSync));
	}

	static serializeForList(calendarSync) {
		const data = calendarSync.dataValues || calendarSync;

		const serialized = {
			id: data.id,
			homeId: data.homeId,
			platform: data.platform,
			isActive: data.isActive,
			lastSyncAt: data.lastSyncAt,
			lastSyncStatus: data.lastSyncStatus,
			autoSync: data.autoSync,
			autoCreateAppointments: data.autoCreateAppointments
		};

		if (calendarSync.home) {
			serialized.home = this.serializeHome(calendarSync.home);
		}

		return serialized;
	}

	static serializeArrayForList(calendarSyncs) {
		return calendarSyncs.map((calendarSync) => this.serializeForList(calendarSync));
	}

	static serializeSyncStatus(calendarSync) {
		const data = calendarSync.dataValues || calendarSync;

		return {
			id: data.id,
			platform: data.platform,
			isActive: data.isActive,
			lastSyncAt: data.lastSyncAt,
			lastSyncStatus: data.lastSyncStatus,
			lastSyncError: data.lastSyncError,
			syncedEventsCount: data.syncedEventUids ? data.syncedEventUids.length : 0
		};
	}
}

module.exports = CalendarSyncSerializer;
