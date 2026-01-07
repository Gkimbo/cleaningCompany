const EncryptionService = require("../services/EncryptionService");

class TermsAndConditionsSerializer {
	static serializeUser(user) {
		if (!user) return null;
		const data = user.dataValues || user;
		return {
			id: data.id,
			firstName: EncryptionService.decrypt(data.firstName),
			lastName: EncryptionService.decrypt(data.lastName)
		};
	}

	static serializeOne(terms) {
		const data = terms.dataValues || terms;

		const serialized = {
			id: data.id,
			type: data.type,
			version: data.version,
			title: data.title,
			content: data.content,
			contentType: data.contentType,
			pdfFileName: data.pdfFileName,
			pdfFilePath: data.pdfFilePath,
			pdfFileSize: data.pdfFileSize,
			effectiveDate: data.effectiveDate,
			createdBy: data.createdBy,
			createdAt: data.createdAt,
			updatedAt: data.updatedAt
		};

		// Serialize creator if included
		if (terms.creator) {
			serialized.creator = this.serializeUser(terms.creator);
		}

		return serialized;
	}

	static serializeArray(termsArray) {
		return termsArray.map((terms) => this.serializeOne(terms));
	}

	static serializeForList(terms) {
		const data = terms.dataValues || terms;

		return {
			id: data.id,
			type: data.type,
			version: data.version,
			title: data.title,
			contentType: data.contentType,
			effectiveDate: data.effectiveDate,
			createdAt: data.createdAt
		};
	}

	static serializeArrayForList(termsArray) {
		return termsArray.map((terms) => this.serializeForList(terms));
	}

	static serializeForAcceptance(terms) {
		const data = terms.dataValues || terms;

		const serialized = {
			id: data.id,
			type: data.type,
			version: data.version,
			title: data.title,
			effectiveDate: data.effectiveDate
		};

		if (data.contentType === "text") {
			serialized.content = data.content;
		} else if (data.contentType === "pdf") {
			serialized.pdfFileName = data.pdfFileName;
			serialized.pdfFileSize = data.pdfFileSize;
		}

		serialized.contentType = data.contentType;

		return serialized;
	}

	static serializeAcceptance(acceptance) {
		const data = acceptance.dataValues || acceptance;

		return {
			id: data.id,
			userId: data.userId,
			termsId: data.termsId,
			acceptedAt: data.acceptedAt,
			ipAddress: data.ipAddress,
			userAgent: data.userAgent
		};
	}

	static serializeAcceptanceArray(acceptances) {
		return acceptances.map((acceptance) => this.serializeAcceptance(acceptance));
	}

	static serializeWithAcceptanceStatus(terms, userId, acceptances) {
		const serialized = this.serializeForList(terms);
		const data = terms.dataValues || terms;

		// Check if user has accepted this version
		const hasAccepted = acceptances.some(
			(a) => a.termsId === data.id && a.userId === userId
		);

		serialized.hasAccepted = hasAccepted;
		serialized.acceptedAt = hasAccepted
			? acceptances.find((a) => a.termsId === data.id && a.userId === userId)?.acceptedAt
			: null;

		return serialized;
	}
}

module.exports = TermsAndConditionsSerializer;
