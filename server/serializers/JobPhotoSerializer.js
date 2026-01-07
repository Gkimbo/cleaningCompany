const EncryptionService = require("../services/EncryptionService");

class JobPhotoSerializer {
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
			lastName: this.decryptUserField(data.lastName)
		};
	}

	static serializeOne(photo) {
		const data = photo.dataValues || photo;

		const serialized = {
			id: data.id,
			appointmentId: data.appointmentId,
			cleanerId: data.cleanerId,
			photoType: data.photoType,
			photoData: data.photoData,
			room: data.room,
			notes: data.notes,
			takenAt: data.takenAt,
			roomAssignmentId: data.roomAssignmentId,
			createdAt: data.createdAt,
			updatedAt: data.updatedAt
		};

		// Serialize cleaner if included
		if (photo.cleaner) {
			serialized.cleaner = this.serializeUser(photo.cleaner);
		}

		return serialized;
	}

	static serializeArray(photos) {
		return photos.map((photo) => this.serializeOne(photo));
	}

	static serializeForList(photo) {
		const data = photo.dataValues || photo;

		return {
			id: data.id,
			appointmentId: data.appointmentId,
			cleanerId: data.cleanerId,
			photoType: data.photoType,
			room: data.room,
			takenAt: data.takenAt
		};
	}

	static serializeArrayForList(photos) {
		return photos.map((photo) => this.serializeForList(photo));
	}

	static serializeWithoutData(photo) {
		const data = photo.dataValues || photo;

		return {
			id: data.id,
			appointmentId: data.appointmentId,
			cleanerId: data.cleanerId,
			photoType: data.photoType,
			room: data.room,
			notes: data.notes,
			takenAt: data.takenAt,
			roomAssignmentId: data.roomAssignmentId,
			createdAt: data.createdAt
		};
	}

	static serializeArrayWithoutData(photos) {
		return photos.map((photo) => this.serializeWithoutData(photo));
	}
}

module.exports = JobPhotoSerializer;
