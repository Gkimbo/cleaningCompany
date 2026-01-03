const EncryptionService = require("../services/EncryptionService");

// Fields that contain PII and should be encrypted
const PII_FIELDS = [
	"address",
	"city",
	"state",
	"zipcode",
	"keyPadCode",
	"keyLocation",
	"contact",
];

// Location fields stored as strings when encrypted
const LOCATION_FIELDS = ["latitude", "longitude"];

module.exports = (sequelize, DataTypes) => {
	// Define the UserHomes model
	const UserHomes = sequelize.define("UserHomes", {
		id: {
			type: DataTypes.INTEGER,
			allowNull: false,
			autoIncrement: true,
			primaryKey: true,
		},
		userId: {
			type: DataTypes.INTEGER,
			allowNull: false,
		},
		nickName: {
			type: DataTypes.STRING,
			allowNull: false,
		},
		address: {
			type: DataTypes.TEXT,
			allowNull: false,
		},
		city: {
			type: DataTypes.TEXT,
			allowNull: false,
		},
		state: {
			type: DataTypes.TEXT,
			allowNull: true,
		},
		zipcode: {
			type: DataTypes.STRING,
			allowNull: false,
		},
		numBeds: {
			type: DataTypes.STRING,
			allowNull: true,
		},
		numBaths: {
			type: DataTypes.STRING,
			allowNull: true,
		},
		sheetsProvided: {
			type: DataTypes.STRING,
			allowNull: true,
		},
		towelsProvided: {
			type: DataTypes.STRING,
			allowNull: true,
		},
		keyPadCode: {
			type: DataTypes.TEXT,
			allowNull: true,
		},
		keyLocation: {
			type: DataTypes.TEXT,
			allowNull: true,
		},
		recyclingLocation: {
			type: DataTypes.STRING,
			allowNull: true,
		},
		compostLocation: {
			type: DataTypes.STRING,
			allowNull: true,
		},
		trashLocation: {
			type: DataTypes.STRING,
			allowNull: true,
		},
		contact: {
			type: DataTypes.TEXT,
			allowNull: false,
		},
		specialNotes: {
			type: DataTypes.STRING,
			allowNull: true,
		},
		cleanersNeeded: {
			type: DataTypes.INTEGER,
			allowNull: true,
		},
		timeToBeCompleted: {
			type: DataTypes.STRING,
			allowNull: false,
		},
		outsideServiceArea: {
			type: DataTypes.BOOLEAN,
			allowNull: false,
			defaultValue: false,
		},
		// Location fields for when homeowner provides linens (cleaner changes them)
		cleanSheetsLocation: {
			type: DataTypes.STRING,
			allowNull: true,
		},
		dirtySheetsLocation: {
			type: DataTypes.STRING,
			allowNull: true,
		},
		cleanTowelsLocation: {
			type: DataTypes.STRING,
			allowNull: true,
		},
		dirtyTowelsLocation: {
			type: DataTypes.STRING,
			allowNull: true,
		},
		// Configuration for when company brings linens
		// bedConfigurations: [{ bedNumber: 1, size: "queen", needsSheets: true }, ...]
		bedConfigurations: {
			type: DataTypes.JSON,
			allowNull: true,
		},
		// bathroomConfigurations: [{ bathroomNumber: 1, towels: 2, faceCloths: 2 }, ...]
		bathroomConfigurations: {
			type: DataTypes.JSON,
			allowNull: true,
		},
		// Geocoded coordinates for accurate distance calculations (stored encrypted as TEXT)
		latitude: {
			type: DataTypes.TEXT,
			allowNull: true,
		},
		longitude: {
			type: DataTypes.TEXT,
			allowNull: true,
		},
		// Preferred cleaner for this home (set when cleaner invites existing client)
		preferredCleanerId: {
			type: DataTypes.INTEGER,
			allowNull: true,
		},
	});

	// Helper function to encrypt PII fields
	const encryptPIIFields = (home) => {
		// Encrypt regular PII fields
		PII_FIELDS.forEach((field) => {
			if (home[field] !== undefined && home[field] !== null) {
				const value = String(home[field]);
				// Only encrypt if not already encrypted (doesn't contain the iv:ciphertext format)
				if (!value.includes(":") || value.split(":").length !== 2) {
					home[field] = EncryptionService.encrypt(value);
				}
			}
		});

		// Encrypt location fields (convert numbers to strings first)
		LOCATION_FIELDS.forEach((field) => {
			if (home[field] !== undefined && home[field] !== null) {
				const value = String(home[field]);
				// Only encrypt if not already encrypted
				if (!value.includes(":") || value.split(":").length !== 2) {
					home[field] = EncryptionService.encrypt(value);
				}
			}
		});
	};

	// Helper function to decrypt PII fields
	const decryptPIIFields = (home) => {
		if (!home) return;

		// Decrypt regular PII fields
		PII_FIELDS.forEach((field) => {
			if (home.dataValues && home.dataValues[field]) {
				home.dataValues[field] = EncryptionService.decrypt(home.dataValues[field]);
			}
		});

		// Decrypt location fields (convert back to numbers)
		LOCATION_FIELDS.forEach((field) => {
			if (home.dataValues && home.dataValues[field]) {
				const decrypted = EncryptionService.decrypt(home.dataValues[field]);
				home.dataValues[field] = decrypted ? parseFloat(decrypted) : null;
			}
		});
	};

	// Encrypt before creating
	UserHomes.beforeCreate((home) => {
		encryptPIIFields(home);
	});

	// Encrypt before updating
	UserHomes.beforeUpdate((home) => {
		encryptPIIFields(home);
	});

	// Decrypt after finding
	UserHomes.afterFind((result) => {
		if (!result) return;

		if (Array.isArray(result)) {
			result.forEach((home) => decryptPIIFields(home));
		} else {
			decryptPIIFields(result);
		}
	});

	// Define the one-to-many relationship with User
	UserHomes.associate = (models) => {
		UserHomes.belongsTo(models.User, {
			foreignKey: "userId",
			as: "user",
		});
		UserHomes.belongsTo(models.User, {
			foreignKey: "preferredCleanerId",
			as: "preferredCleaner",
		});
		UserHomes.hasMany(models.UserAppointments, {
			foreignKey: "homeId",
			as: "appointments",
		});
		UserHomes.hasMany(models.CleanerClient, {
			foreignKey: "homeId",
			as: "cleanerClients",
		});
		UserHomes.hasMany(models.RecurringSchedule, {
			foreignKey: "homeId",
			as: "recurringSchedules",
		});
	};

	return UserHomes;
};
