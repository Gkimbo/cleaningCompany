module.exports = (sequelize, DataTypes) => {
  const HomeSizeAdjustmentPhoto = sequelize.define('HomeSizeAdjustmentPhoto', {
    id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      autoIncrement: true,
      primaryKey: true,
    },
    adjustmentRequestId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: 'HomeSizeAdjustmentRequests', key: 'id' },
      onUpdate: 'CASCADE',
      onDelete: 'CASCADE',
    },
    roomType: {
      type: DataTypes.ENUM('bedroom', 'bathroom'),
      allowNull: false,
    },
    roomNumber: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    photoUrl: {
      type: DataTypes.STRING(500),
      allowNull: false,
    },
    s3Key: {
      type: DataTypes.STRING(500),
      allowNull: true,
    },
  });

  HomeSizeAdjustmentPhoto.associate = (models) => {
    HomeSizeAdjustmentPhoto.belongsTo(models.HomeSizeAdjustmentRequest, {
      foreignKey: 'adjustmentRequestId',
      as: 'adjustmentRequest',
    });
  };

  return HomeSizeAdjustmentPhoto;
};
