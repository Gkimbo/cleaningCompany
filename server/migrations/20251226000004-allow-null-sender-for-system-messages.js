'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    // Allow senderId to be null for system messages
    await queryInterface.changeColumn('Messages', 'senderId', {
      type: Sequelize.INTEGER,
      allowNull: true,
      references: {
        model: 'Users',
        key: 'id',
      },
      onUpdate: 'CASCADE',
      onDelete: 'CASCADE',
    });
  },

  async down(queryInterface, Sequelize) {
    // Revert to not null (will fail if there are null values)
    await queryInterface.changeColumn('Messages', 'senderId', {
      type: Sequelize.INTEGER,
      allowNull: false,
      references: {
        model: 'Users',
        key: 'id',
      },
      onUpdate: 'CASCADE',
      onDelete: 'CASCADE',
    });
  },
};
