module.exports = (sequelize, DataTypes) => {
  const CleanerAvailabilityConfig = sequelize.define(
    "CleanerAvailabilityConfig",
    {
      id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
      },
      cleanerId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        unique: true,
        comment: "Reference to the cleaner user",
      },
      maxDailyJobs: {
        type: DataTypes.INTEGER,
        allowNull: true,
        comment: "Cleaner override for max jobs per day (null = use platform default)",
      },
      maxConcurrentJobs: {
        type: DataTypes.INTEGER,
        allowNull: true,
        comment: "Cleaner override for max overlapping jobs (null = use platform default)",
      },
      blackoutDates: {
        type: DataTypes.JSONB,
        allowNull: true,
        defaultValue: [],
        comment: "Array of dates (YYYY-MM-DD) the cleaner is unavailable",
      },
    },
    {
      tableName: "CleanerAvailabilityConfigs",
      timestamps: true,
    }
  );

  CleanerAvailabilityConfig.associate = (models) => {
    CleanerAvailabilityConfig.belongsTo(models.User, {
      foreignKey: "cleanerId",
      as: "cleaner",
    });
  };

  return CleanerAvailabilityConfig;
};
