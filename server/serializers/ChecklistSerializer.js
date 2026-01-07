const EncryptionService = require("../services/EncryptionService");

class ChecklistSerializer {
	static serializeUser(user) {
		if (!user) return null;
		const data = user.dataValues || user;
		return {
			id: data.id,
			firstName: EncryptionService.decrypt(data.firstName),
			lastName: EncryptionService.decrypt(data.lastName)
		};
	}

	static serializeVersion(version) {
		const data = version.dataValues || version;

		const serialized = {
			id: data.id,
			version: data.version,
			snapshotData: data.snapshotData,
			publishedBy: data.publishedBy,
			publishedAt: data.publishedAt,
			isActive: data.isActive,
			createdAt: data.createdAt,
			updatedAt: data.updatedAt
		};

		if (version.publisher) {
			serialized.publisher = this.serializeUser(version.publisher);
		}

		return serialized;
	}

	static serializeVersionArray(versions) {
		return versions.map((version) => this.serializeVersion(version));
	}

	static serializeDraft(draft) {
		const data = draft.dataValues || draft;

		return {
			id: data.id,
			draftData: data.draftData,
			lastEditedBy: data.lastEditedBy,
			lastEditedAt: data.lastEditedAt,
			createdAt: data.createdAt,
			updatedAt: data.updatedAt
		};
	}

	static serializeSection(section) {
		const data = section.dataValues || section;

		const serialized = {
			id: data.id,
			name: data.name,
			displayOrder: data.displayOrder,
			isActive: data.isActive,
			createdAt: data.createdAt,
			updatedAt: data.updatedAt
		};

		if (section.items) {
			serialized.items = section.items.map(item => this.serializeItem(item));
		}

		return serialized;
	}

	static serializeSectionArray(sections) {
		return sections.map((section) => this.serializeSection(section));
	}

	static serializeItem(item) {
		const data = item.dataValues || item;

		return {
			id: data.id,
			sectionId: data.sectionId,
			text: data.text,
			displayOrder: data.displayOrder,
			isActive: data.isActive,
			requiresPhoto: data.requiresPhoto,
			createdAt: data.createdAt,
			updatedAt: data.updatedAt
		};
	}

	static serializeItemArray(items) {
		return items.map((item) => this.serializeItem(item));
	}

	static serializeStructure(sections) {
		return sections.map((section) => {
			const data = section.dataValues || section;
			return {
				id: data.id,
				name: data.name,
				displayOrder: data.displayOrder,
				items: (section.items || []).map(item => {
					const itemData = item.dataValues || item;
					return {
						id: itemData.id,
						text: itemData.text,
						displayOrder: itemData.displayOrder,
						requiresPhoto: itemData.requiresPhoto
					};
				})
			};
		});
	}

	static serializeVersionForList(version) {
		const data = version.dataValues || version;

		return {
			id: data.id,
			version: data.version,
			publishedAt: data.publishedAt,
			isActive: data.isActive
		};
	}

	static serializeVersionArrayForList(versions) {
		return versions.map((version) => this.serializeVersionForList(version));
	}

	static serializeSummary(version) {
		const data = version.dataValues || version;
		let sectionCount = 0;
		let itemCount = 0;

		if (data.snapshotData) {
			sectionCount = data.snapshotData.length || 0;
			itemCount = data.snapshotData.reduce((acc, section) => {
				return acc + (section.items ? section.items.length : 0);
			}, 0);
		}

		return {
			id: data.id,
			version: data.version,
			isActive: data.isActive,
			publishedAt: data.publishedAt,
			sectionCount,
			itemCount
		};
	}
}

module.exports = ChecklistSerializer;
