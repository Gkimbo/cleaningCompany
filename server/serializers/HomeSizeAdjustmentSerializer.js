const EncryptionService = require("../services/EncryptionService");

class HomeSizeAdjustmentSerializer {
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
			falseClaimCount: data.falseClaimCount || 0,
			falseHomeSizeCount: data.falseHomeSizeCount || 0,
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

	static serializeOne(request) {
		const data = request.dataValues || request;

		const serialized = {
			id: data.id,
			appointmentId: data.appointmentId,
			homeId: data.homeId,
			cleanerId: data.cleanerId,
			homeownerId: data.homeownerId,
			originalNumBeds: data.originalNumBeds,
			originalNumBaths: data.originalNumBaths,
			originalPrice: parseFloat(data.originalPrice),
			reportedNumBeds: data.reportedNumBeds,
			reportedNumBaths: data.reportedNumBaths,
			calculatedNewPrice: parseFloat(data.calculatedNewPrice),
			priceDifference: parseFloat(data.priceDifference),
			status: data.status,
			cleanerNote: data.cleanerNote,
			homeownerResponse: data.homeownerResponse,
			ownerNote: data.ownerNote,
			ownerId: data.ownerId,
			chargeStatus: data.chargeStatus,
			homeownerRespondedAt: data.homeownerRespondedAt,
			ownerResolvedAt: data.ownerResolvedAt,
			expiresAt: data.expiresAt,
			createdAt: data.createdAt,
			updatedAt: data.updatedAt
		};

		// Add computed properties
		serialized.isExpired = data.expiresAt ? new Date() > new Date(data.expiresAt) : false;

		// Serialize related entities if included
		if (request.cleaner) {
			serialized.cleaner = this.serializeUser(request.cleaner);
		}

		if (request.homeowner) {
			serialized.homeowner = this.serializeUser(request.homeowner);
		}

		if (request.owner) {
			serialized.owner = this.serializeUser(request.owner);
		}

		if (request.home) {
			serialized.home = this.serializeHome(request.home);
		}

		if (request.photos) {
			serialized.photos = request.photos.map(photo => this.serializePhoto(photo));
		}

		return serialized;
	}

	static serializeArray(requests) {
		return requests.map((request) => this.serializeOne(request));
	}

	static serializePhoto(photo) {
		const data = photo.dataValues || photo;

		return {
			id: data.id,
			adjustmentRequestId: data.adjustmentRequestId,
			photoData: data.photoData,
			room: data.room,
			notes: data.notes,
			createdAt: data.createdAt
		};
	}

	static serializeForList(request) {
		const data = request.dataValues || request;

		const serialized = {
			id: data.id,
			appointmentId: data.appointmentId,
			originalNumBeds: data.originalNumBeds,
			originalNumBaths: data.originalNumBaths,
			reportedNumBeds: data.reportedNumBeds,
			reportedNumBaths: data.reportedNumBaths,
			priceDifference: parseFloat(data.priceDifference),
			status: data.status,
			expiresAt: data.expiresAt,
			createdAt: data.createdAt
		};

		if (request.cleaner) {
			serialized.cleaner = this.serializeUser(request.cleaner);
		}

		if (request.homeowner) {
			serialized.homeowner = this.serializeUser(request.homeowner);
		}

		return serialized;
	}

	static serializeArrayForList(requests) {
		return requests.map((request) => this.serializeForList(request));
	}

	static serializeForHomeowner(request) {
		const data = request.dataValues || request;

		const serialized = {
			id: data.id,
			appointmentId: data.appointmentId,
			originalNumBeds: data.originalNumBeds,
			originalNumBaths: data.originalNumBaths,
			originalPrice: parseFloat(data.originalPrice),
			reportedNumBeds: data.reportedNumBeds,
			reportedNumBaths: data.reportedNumBaths,
			calculatedNewPrice: parseFloat(data.calculatedNewPrice),
			priceDifference: parseFloat(data.priceDifference),
			cleanerNote: data.cleanerNote,
			status: data.status,
			expiresAt: data.expiresAt,
			createdAt: data.createdAt
		};

		if (request.photos) {
			serialized.photos = request.photos.map(photo => ({
				id: photo.id,
				photoData: photo.photoData,
				room: photo.room,
				notes: photo.notes
			}));
		}

		if (request.cleaner) {
			serialized.cleaner = this.serializeUser(request.cleaner);
		}

		return serialized;
	}
}

module.exports = HomeSizeAdjustmentSerializer;
