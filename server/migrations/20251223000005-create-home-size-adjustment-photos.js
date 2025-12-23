'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('HomeSizeAdjustmentPhotos', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER,
      },
      adjustmentRequestId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'HomeSizeAdjustmentRequests', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      roomType: {
        type: Sequelize.ENUM('bedroom', 'bathroom'),
        allowNull: false,
      },
      roomNumber: {
        type: Sequelize.INTEGER,
        allowNull: false,
        comment: 'Which bedroom/bathroom this is (1, 2, 3, etc.)',
      },
      photoUrl: {
        type: Sequelize.STRING(500),
        allowNull: false,
      },
      s3Key: {
        type: Sequelize.STRING(500),
        allowNull: true,
        comment: 'S3 object key for deletion',
      },
      createdAt: {
        allowNull: false,
        type: Sequelize.DATE,
      },
      updatedAt: {
        allowNull: false,
        type: Sequelize.DATE,
      },
    });

    // Add index for fetching photos by adjustment request
    await queryInterface.addIndex('HomeSizeAdjustmentPhotos', ['adjustmentRequestId']);
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('HomeSizeAdjustmentPhotos');
  },
};
