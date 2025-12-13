module.exports = (sequelize, DataTypes) => {
  const JobPhoto = sequelize.define("JobPhoto", {
    id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      autoIncrement: true,
      primaryKey: true,
    },
    appointmentId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    cleanerId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    photoType: {
      type: DataTypes.ENUM('before', 'after'),
      allowNull: false,
    },
    photoData: {
      type: DataTypes.TEXT('long'),
      allowNull: false,
    },
    room: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    takenAt: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
  });

  JobPhoto.associate = (models) => {
    JobPhoto.belongsTo(models.UserAppointments, {
      foreignKey: "appointmentId",
      as: "appointment",
    });
    JobPhoto.belongsTo(models.User, {
      foreignKey: "cleanerId",
      as: "cleaner",
    });
  };

  return JobPhoto;
};
