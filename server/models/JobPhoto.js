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
      type: DataTypes.ENUM('before', 'after', 'passes'),
      allowNull: false,
    },
    photoData: {
      type: DataTypes.TEXT('long'),
      allowNull: true, // Can be null if isNotApplicable is true
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
    // Multi-cleaner: link photo to specific room assignment
    roomAssignmentId: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    // For passes: mark as N/A if no passes are available at the property
    isNotApplicable: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
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
    JobPhoto.belongsTo(models.CleanerRoomAssignment, {
      foreignKey: "roomAssignmentId",
      as: "roomAssignment",
    });
  };

  return JobPhoto;
};
