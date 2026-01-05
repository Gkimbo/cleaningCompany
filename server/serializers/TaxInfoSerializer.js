const EncryptionService = require("../services/EncryptionService");

class TaxInfoSerializer {
	// PII fields that are encrypted in the database
	static encryptedFields = [
		"legalName",
		"businessName",
		"addressLine1",
		"addressLine2",
		"city",
		"state",
		"zipCode",
		"certificationSignature"
	];

	static decrypt(value) {
		if (!value) return null;
		// EncryptionService.decrypt() safely handles both encrypted and unencrypted data
		return EncryptionService.decrypt(value);
	}

	static serializeUser(user) {
		if (!user) return null;
		const data = user.dataValues || user;
		return {
			id: data.id,
			firstName: this.decrypt(data.firstName),
			lastName: this.decrypt(data.lastName),
			email: this.decrypt(data.email)
		};
	}

	static serializeOne(taxInfo) {
		const data = taxInfo.dataValues || taxInfo;

		const serialized = {
			id: data.id,
			userId: data.userId,
			legalName: this.decrypt(data.legalName),
			businessName: this.decrypt(data.businessName),
			taxClassification: data.taxClassification,
			exemptPayeeCode: data.exemptPayeeCode,
			fatcaExemptionCode: data.fatcaExemptionCode,
			addressLine1: this.decrypt(data.addressLine1),
			addressLine2: this.decrypt(data.addressLine2),
			city: this.decrypt(data.city),
			state: this.decrypt(data.state),
			zipCode: this.decrypt(data.zipCode),
			tinType: data.tinType,
			tinLast4: data.tinLast4,
			certificationDate: data.certificationDate,
			certificationSignature: this.decrypt(data.certificationSignature),
			status: data.status,
			tinVerified: data.tinVerified,
			tinVerifiedAt: data.tinVerifiedAt,
			form1099Required: data.form1099Required,
			backupWithholdingRequired: data.backupWithholdingRequired,
			backupWithholdingRate: data.backupWithholdingRate ? parseFloat(data.backupWithholdingRate) : null,
			lastUpdatedBy: data.lastUpdatedBy,
			createdAt: data.createdAt,
			updatedAt: data.updatedAt
		};

		// Format TIN display (masked)
		serialized.tinDisplay = this.formatTinMasked(data.tinType, data.tinLast4);

		// Format full address
		serialized.fullAddress = this.formatAddress(data);

		// Serialize user if included
		if (taxInfo.user) {
			serialized.user = this.serializeUser(taxInfo.user);
		}

		return serialized;
	}

	static serializeArray(taxInfos) {
		return taxInfos.map((taxInfo) => this.serializeOne(taxInfo));
	}

	static formatTinMasked(tinType, tinLast4) {
		if (!tinLast4) return null;
		if (tinType === "ssn") {
			return `XXX-XX-${tinLast4}`;
		}
		return `XX-XXX${tinLast4}`;
	}

	static formatAddress(data) {
		const parts = [data.addressLine1];
		if (data.addressLine2) parts.push(data.addressLine2);
		parts.push(`${data.city}, ${data.state} ${data.zipCode}`);
		return parts.join(", ");
	}

	static serializeForList(taxInfo) {
		const data = taxInfo.dataValues || taxInfo;

		return {
			id: data.id,
			userId: data.userId,
			legalName: this.decrypt(data.legalName),
			tinType: data.tinType,
			tinDisplay: this.formatTinMasked(data.tinType, data.tinLast4),
			status: data.status,
			tinVerified: data.tinVerified,
			form1099Required: data.form1099Required,
			createdAt: data.createdAt
		};
	}

	static serializeArrayForList(taxInfos) {
		return taxInfos.map((taxInfo) => this.serializeForList(taxInfo));
	}

	static serializeForW9Display(taxInfo) {
		const data = taxInfo.dataValues || taxInfo;

		return {
			legalName: this.decrypt(data.legalName),
			businessName: this.decrypt(data.businessName),
			taxClassification: data.taxClassification,
			addressLine1: this.decrypt(data.addressLine1),
			addressLine2: this.decrypt(data.addressLine2),
			city: this.decrypt(data.city),
			state: this.decrypt(data.state),
			zipCode: this.decrypt(data.zipCode),
			tinType: data.tinType,
			tinDisplay: this.formatTinMasked(data.tinType, data.tinLast4),
			certificationDate: data.certificationDate,
			certificationSignature: this.decrypt(data.certificationSignature),
			status: data.status,
			tinVerified: data.tinVerified
		};
	}

	static serializeForCleaner(taxInfo) {
		const data = taxInfo.dataValues || taxInfo;

		return {
			id: data.id,
			legalName: this.decrypt(data.legalName),
			businessName: this.decrypt(data.businessName),
			taxClassification: data.taxClassification,
			addressLine1: this.decrypt(data.addressLine1),
			addressLine2: this.decrypt(data.addressLine2),
			city: this.decrypt(data.city),
			state: this.decrypt(data.state),
			zipCode: this.decrypt(data.zipCode),
			tinType: data.tinType,
			tinDisplay: this.formatTinMasked(data.tinType, data.tinLast4),
			status: data.status,
			tinVerified: data.tinVerified,
			form1099Required: data.form1099Required,
			certificationDate: data.certificationDate,
			updatedAt: data.updatedAt
		};
	}

	static serializeSubmissionStatus(taxInfo) {
		const data = taxInfo.dataValues || taxInfo;

		return {
			id: data.id,
			status: data.status,
			tinVerified: data.tinVerified,
			tinVerifiedAt: data.tinVerifiedAt,
			form1099Required: data.form1099Required,
			backupWithholdingRequired: data.backupWithholdingRequired,
			certificationDate: data.certificationDate
		};
	}
}

module.exports = TaxInfoSerializer;
