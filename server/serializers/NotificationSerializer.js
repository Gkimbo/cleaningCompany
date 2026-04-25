const EncryptionService = require("../services/EncryptionService");

class NotificationSerializer {
	static serializeOne(notification) {
		const data = notification.dataValues || notification;

		const allowedAttributes = [
			"id",
			"userId",
			"relatedAppointmentId",
			"relatedCleanerClientId",
			"type",
			"title",
			"body",
			"data",
			"isRead",
			"actionRequired",
			"expiresAt",
			"createdAt",
			"updatedAt"
		];

		const serialized = {};
		for (const attribute of allowedAttributes) {
			serialized[attribute] = data[attribute];
		}

		// Add computed properties
		if (data.expiresAt) {
			serialized.isExpired = new Date() > new Date(data.expiresAt);
		} else {
			serialized.isExpired = false;
		}

		// Serialize related appointment if included
		if (notification.appointment) {
			serialized.appointment = this.serializeAppointmentSummary(notification.appointment);
		}

		// Serialize related cleaner client if included
		if (notification.cleanerClient) {
			serialized.cleanerClient = this.serializeCleanerClientSummary(notification.cleanerClient);
		}

		return serialized;
	}

	static serializeArray(notifications) {
		return notifications.map((notification) => this.serializeOne(notification));
	}

	static serializeAppointmentSummary(appointment) {
		const data = appointment.dataValues || appointment;
		const summary = {
			id: data.id,
			date: data.date,
			price: data.price,
			homeId: data.homeId,
			completed: data.completed,
			timeToBeCompleted: data.timeToBeCompleted,
			bringSheets: data.bringSheets,
			bringTowels: data.bringTowels,
		};

		if (appointment.home) {
			const home = appointment.home.dataValues || appointment.home;
			summary.home = {
				id: home.id,
				nickName: home.nickName,
				city: home.city ? EncryptionService.decrypt(home.city) : null,
				numBeds: home.numBeds,
				numBaths: home.numBaths,
				squareFootage: home.squareFootage,
			};
		}

		return summary;
	}

	static serializeCleanerClientSummary(cleanerClient) {
		const data = cleanerClient.dataValues || cleanerClient;
		return {
			id: data.id,
			status: data.status,
			invitedName: data.invitedName ? EncryptionService.decrypt(data.invitedName) : null
		};
	}

	static serializeForList(notification) {
		const data = notification.dataValues || notification;
		return {
			id: data.id,
			type: data.type,
			title: data.title,
			body: data.body,
			isRead: data.isRead,
			actionRequired: data.actionRequired,
			createdAt: data.createdAt,
			isExpired: data.expiresAt ? new Date() > new Date(data.expiresAt) : false
		};
	}

	static serializeArrayForList(notifications) {
		return notifications.map((notification) => this.serializeForList(notification));
	}
}

module.exports = NotificationSerializer;
