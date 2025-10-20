module.exports = (sequelize, DataTypes) => {
	const UserApplications = sequelize.define("UserApplications", {
	  id: {
		type: DataTypes.INTEGER,
		allowNull: false,
		autoIncrement: true,
		primaryKey: true,
	  },
	  firstName: {
		type: DataTypes.STRING,
		allowNull: false,
	  },
	  lastName: {
		type: DataTypes.STRING,
		allowNull: false,
	  },
	  email: {
		type: DataTypes.STRING,
		allowNull: false,
	  },
	  phone: {
		type: DataTypes.STRING,
		allowNull: false,
	  },
	  experience: {
		type: DataTypes.STRING,
		allowNull: false,
	  },
	  message: {
		type: DataTypes.TEXT,
		allowNull: false,
	  },
	  idPhoto: {
		type: DataTypes.TEXT,
		allowNull: false, // must have uploaded ID
	  },
	  backgroundConsent: {
		type: DataTypes.BOOLEAN,
		allowNull: false, // must consent
		defaultValue: false,
	  },
	});
  
	return UserApplications;
  };
  