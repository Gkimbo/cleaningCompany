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
			type: DataTypes.INTEGER,
			allowNull: false,
		},
		address: {
			type: DataTypes.INTEGER,
			allowNull: false,
		},
		city: {
			type: DataTypes.INTEGER,
			allowNull: false,
		},
		state: {
			type: DataTypes.INTEGER,
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
			type: DataTypes.STRING,
			allowNull: true,
		},
		keyLocation: {
			type: DataTypes.STRING,
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
			type: DataTypes.STRING,
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
	});

	// Define the one-to-many relationship with User
	UserHomes.associate = (models) => {
		UserHomes.belongsTo(models.User, {
			foreignKey: "userId",
			as: "user",
		});
		UserHomes.hasMany(models.UserAppointments, {
			foreignKey: "homeId",
			as: "appointments",
		});
	};

	return UserHomes;
};
