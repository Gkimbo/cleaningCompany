module.exports = (sequelize, DataTypes) => {
  const CleanerPreferredPerks = sequelize.define(
    "CleanerPreferredPerks",
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
      },
      tierLevel: {
        type: DataTypes.ENUM("bronze", "silver", "gold", "platinum"),
        allowNull: false,
        defaultValue: "bronze",
      },
      preferredHomeCount: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      // Cached perk values (recalculated when tier changes)
      bonusPercent: {
        type: DataTypes.DECIMAL(5, 2),
        allowNull: false,
        defaultValue: 0,
      },
      fasterPayouts: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      payoutHours: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 48,
      },
      earlyAccess: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      lastCalculatedAt: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
      },
    },
    {
      tableName: "CleanerPreferredPerks",
      timestamps: true,
    }
  );

  CleanerPreferredPerks.associate = (models) => {
    CleanerPreferredPerks.belongsTo(models.User, {
      foreignKey: "cleanerId",
      as: "cleaner",
    });
  };

  return CleanerPreferredPerks;
};
