const EncryptionService = require("../services/EncryptionService");

class PaymentSerializer {
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

	static serializeOne(payment) {
		const data = payment.dataValues || payment;

		const serialized = {
			id: data.id,
			transactionId: data.transactionId,
			type: data.type,
			status: data.status,
			userId: data.userId,
			cleanerId: data.cleanerId,
			appointmentId: data.appointmentId,
			payoutId: data.payoutId,
			amount: data.amount,
			currency: data.currency,
			platformFeeAmount: data.platformFeeAmount,
			netAmount: data.netAmount,
			taxYear: data.taxYear,
			reportable: data.reportable,
			reported: data.reported,
			description: data.description,
			metadata: data.metadata,
			failureReason: data.failureReason,
			processedAt: data.processedAt,
			createdAt: data.createdAt,
			updatedAt: data.updatedAt
		};

		// Format amounts in dollars
		serialized.amountDollars = (data.amount / 100).toFixed(2);
		if (data.platformFeeAmount) {
			serialized.platformFeeAmountDollars = (data.platformFeeAmount / 100).toFixed(2);
		}
		if (data.netAmount) {
			serialized.netAmountDollars = (data.netAmount / 100).toFixed(2);
		}

		// Serialize related entities if included
		if (payment.customer) {
			serialized.customer = this.serializeUser(payment.customer);
		}

		if (payment.cleaner) {
			serialized.cleaner = this.serializeUser(payment.cleaner);
		}

		return serialized;
	}

	static serializeArray(payments) {
		return payments.map((payment) => this.serializeOne(payment));
	}

	static serializeForList(payment) {
		const data = payment.dataValues || payment;

		return {
			id: data.id,
			transactionId: data.transactionId,
			type: data.type,
			status: data.status,
			amount: data.amount,
			amountDollars: (data.amount / 100).toFixed(2),
			description: data.description,
			processedAt: data.processedAt,
			createdAt: data.createdAt
		};
	}

	static serializeArrayForList(payments) {
		return payments.map((payment) => this.serializeForList(payment));
	}

	static serializeForReceipt(payment) {
		const data = payment.dataValues || payment;

		const serialized = {
			transactionId: data.transactionId,
			type: data.type,
			status: data.status,
			amount: data.amount,
			amountDollars: (data.amount / 100).toFixed(2),
			currency: data.currency.toUpperCase(),
			description: data.description,
			processedAt: data.processedAt,
			createdAt: data.createdAt
		};

		if (payment.appointment) {
			serialized.appointment = {
				id: payment.appointment.id,
				date: payment.appointment.date
			};
		}

		return serialized;
	}

	static serializeForTaxReport(payment) {
		const data = payment.dataValues || payment;

		return {
			transactionId: data.transactionId,
			type: data.type,
			status: data.status,
			amount: data.amount,
			amountDollars: (data.amount / 100).toFixed(2),
			taxYear: data.taxYear,
			reportable: data.reportable,
			reported: data.reported,
			processedAt: data.processedAt
		};
	}

	static serializeArrayForTaxReport(payments) {
		return payments.map((payment) => this.serializeForTaxReport(payment));
	}
}

module.exports = PaymentSerializer;
