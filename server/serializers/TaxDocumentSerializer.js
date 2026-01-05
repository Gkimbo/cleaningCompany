const EncryptionService = require("../services/EncryptionService");

class TaxDocumentSerializer {
	// PII fields that are encrypted in the database
	static encryptedFields = [
		"recipientName",
		"recipientTin",
		"recipientAddress",
		"payerTin",
		"payerAddress"
	];

	static decrypt(value) {
		if (!value) return null;
		// EncryptionService.decrypt() safely handles both encrypted and unencrypted data
		return EncryptionService.decrypt(value);
	}

	static serializeOne(document) {
		const data = document.dataValues || document;

		const serialized = {
			id: data.id,
			documentId: data.documentId,
			userId: data.userId,
			documentType: data.documentType,
			taxYear: data.taxYear,
			box1NonemployeeCompensation: data.box1NonemployeeCompensation,
			box4FederalTaxWithheld: data.box4FederalTaxWithheld,
			box5StateTaxWithheld: data.box5StateTaxWithheld,
			box6StatePayersNo: data.box6StatePayersNo,
			box7StateIncome: data.box7StateIncome,
			payerName: data.payerName,
			payerAddress: this.decrypt(data.payerAddress),
			recipientName: this.decrypt(data.recipientName),
			recipientTinLast4: data.recipientTinLast4,
			recipientAddress: this.decrypt(data.recipientAddress),
			status: data.status,
			generatedAt: data.generatedAt,
			sentToRecipientAt: data.sentToRecipientAt,
			sentToRecipientMethod: data.sentToRecipientMethod,
			filedWithIrsAt: data.filedWithIrsAt,
			irsConfirmationNumber: data.irsConfirmationNumber,
			isCorrection: data.isCorrection,
			originalDocumentId: data.originalDocumentId,
			correctionReason: data.correctionReason,
			generatedBy: data.generatedBy,
			createdAt: data.createdAt,
			updatedAt: data.updatedAt
		};

		// Format monetary amounts in dollars
		if (data.box1NonemployeeCompensation) {
			serialized.box1NonemployeeCompensationDollars = (data.box1NonemployeeCompensation / 100).toFixed(2);
		}
		if (data.box4FederalTaxWithheld) {
			serialized.box4FederalTaxWithheldDollars = (data.box4FederalTaxWithheld / 100).toFixed(2);
		}
		if (data.box5StateTaxWithheld) {
			serialized.box5StateTaxWithheldDollars = (data.box5StateTaxWithheld / 100).toFixed(2);
		}
		if (data.box7StateIncome) {
			serialized.box7StateIncomeDollars = (data.box7StateIncome / 100).toFixed(2);
		}

		// Format TIN display
		serialized.recipientTinDisplay = `XXX-XX-${data.recipientTinLast4}`;

		return serialized;
	}

	static serializeArray(documents) {
		return documents.map((document) => this.serializeOne(document));
	}

	static serializeForRecipient(document) {
		const data = document.dataValues || document;

		return {
			id: data.id,
			documentId: data.documentId,
			documentType: data.documentType,
			taxYear: data.taxYear,
			box1NonemployeeCompensation: data.box1NonemployeeCompensation,
			box1NonemployeeCompensationDollars: data.box1NonemployeeCompensation
				? (data.box1NonemployeeCompensation / 100).toFixed(2)
				: null,
			recipientName: this.decrypt(data.recipientName),
			recipientTinDisplay: `XXX-XX-${data.recipientTinLast4}`,
			recipientAddress: this.decrypt(data.recipientAddress),
			payerName: data.payerName,
			payerAddress: this.decrypt(data.payerAddress),
			status: data.status,
			generatedAt: data.generatedAt,
			sentToRecipientAt: data.sentToRecipientAt,
			isCorrection: data.isCorrection
		};
	}

	static serializeArrayForRecipient(documents) {
		return documents.map((document) => this.serializeForRecipient(document));
	}

	static serializeForList(document) {
		const data = document.dataValues || document;

		return {
			id: data.id,
			documentId: data.documentId,
			documentType: data.documentType,
			taxYear: data.taxYear,
			recipientName: this.decrypt(data.recipientName),
			box1NonemployeeCompensationDollars: data.box1NonemployeeCompensation
				? (data.box1NonemployeeCompensation / 100).toFixed(2)
				: null,
			status: data.status,
			generatedAt: data.generatedAt,
			isCorrection: data.isCorrection
		};
	}

	static serializeArrayForList(documents) {
		return documents.map((document) => this.serializeForList(document));
	}

	static serializeForDownload(document) {
		const data = document.dataValues || document;

		return {
			documentId: data.documentId,
			pdfPath: data.pdfPath,
			pdfHash: data.pdfHash,
			documentType: data.documentType,
			taxYear: data.taxYear,
			status: data.status
		};
	}
}

module.exports = TaxDocumentSerializer;
