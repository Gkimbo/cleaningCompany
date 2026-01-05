const EncryptionService = require("../services/EncryptionService");

class PayoutSerializer {
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
			email: this.decryptUserField(data.email)
		};
	}

	static serializeOne(payout) {
		const data = payout.dataValues || payout;

		const serialized = {
			id: data.id,
			appointmentId: data.appointmentId,
			cleanerId: data.cleanerId,
			grossAmount: data.grossAmount,
			platformFee: data.platformFee,
			netAmount: data.netAmount,
			status: data.status,
			paymentCapturedAt: data.paymentCapturedAt,
			transferInitiatedAt: data.transferInitiatedAt,
			completedAt: data.completedAt,
			failureReason: data.failureReason,
			incentiveApplied: data.incentiveApplied,
			originalPlatformFee: data.originalPlatformFee,
			multiCleanerJobId: data.multiCleanerJobId,
			isPartialPayout: data.isPartialPayout,
			originalGrossAmount: data.originalGrossAmount,
			adjustmentReason: data.adjustmentReason,
			payoutType: data.payoutType,
			businessOwnerId: data.businessOwnerId,
			employeeJobAssignmentId: data.employeeJobAssignmentId,
			paidOutsidePlatform: data.paidOutsidePlatform,
			createdAt: data.createdAt,
			updatedAt: data.updatedAt
		};

		// Format amounts in dollars for display
		serialized.grossAmountDollars = (data.grossAmount / 100).toFixed(2);
		serialized.platformFeeDollars = (data.platformFee / 100).toFixed(2);
		serialized.netAmountDollars = (data.netAmount / 100).toFixed(2);

		// Serialize cleaner if included
		if (payout.cleaner) {
			serialized.cleaner = this.serializeUser(payout.cleaner);
		}

		// Serialize business owner if included
		if (payout.businessOwner) {
			serialized.businessOwner = this.serializeUser(payout.businessOwner);
		}

		return serialized;
	}

	static serializeArray(payouts) {
		return payouts.map((payout) => this.serializeOne(payout));
	}

	static serializeForCleanerView(payout) {
		const data = payout.dataValues || payout;

		return {
			id: data.id,
			appointmentId: data.appointmentId,
			netAmount: data.netAmount,
			netAmountDollars: (data.netAmount / 100).toFixed(2),
			status: data.status,
			completedAt: data.completedAt,
			incentiveApplied: data.incentiveApplied,
			payoutType: data.payoutType,
			paidOutsidePlatform: data.paidOutsidePlatform,
			createdAt: data.createdAt
		};
	}

	static serializeArrayForCleanerView(payouts) {
		return payouts.map((payout) => this.serializeForCleanerView(payout));
	}

	static serializeForOwnerView(payout) {
		const data = payout.dataValues || payout;

		const serialized = {
			id: data.id,
			appointmentId: data.appointmentId,
			cleanerId: data.cleanerId,
			grossAmount: data.grossAmount,
			platformFee: data.platformFee,
			netAmount: data.netAmount,
			grossAmountDollars: (data.grossAmount / 100).toFixed(2),
			platformFeeDollars: (data.platformFee / 100).toFixed(2),
			netAmountDollars: (data.netAmount / 100).toFixed(2),
			status: data.status,
			completedAt: data.completedAt,
			payoutType: data.payoutType,
			createdAt: data.createdAt
		};

		if (payout.cleaner) {
			serialized.cleaner = this.serializeUser(payout.cleaner);
		}

		return serialized;
	}

	static serializeArrayForOwnerView(payouts) {
		return payouts.map((payout) => this.serializeForOwnerView(payout));
	}
}

module.exports = PayoutSerializer;
