module.exports = (sequelize, DataTypes) => {
  const CalendarSync = sequelize.define("CalendarSync", {
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
    homeId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    platform: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: "other",
      // airbnb, vrbo, booking, other
    },
    icalUrl: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },
    lastSyncAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    lastSyncStatus: {
      type: DataTypes.STRING,
      allowNull: true,
      // success, error
    },
    lastSyncError: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    syncedEventUids: {
      type: DataTypes.ARRAY(DataTypes.STRING),
      allowNull: true,
      defaultValue: [],
    },
    autoCreateAppointments: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },
    daysAfterCheckout: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      // 0 = same day as checkout, 1 = day after, etc.
    },
    autoSync: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      // Enable automatic syncing every 6 hours
    },
  });

  CalendarSync.associate = (models) => {
    CalendarSync.belongsTo(models.User, {
      foreignKey: "userId",
      as: "user",
    });
    CalendarSync.belongsTo(models.UserHomes, {
      foreignKey: "homeId",
      as: "home",
    });
  };

  return CalendarSync;
};
