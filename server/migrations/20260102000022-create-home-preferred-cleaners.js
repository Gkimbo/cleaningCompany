'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('HomePreferredCleaners', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER,
      },
      homeId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'UserHomes',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      cleanerId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'Users',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      setAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
      setBy: {
        type: Sequelize.ENUM('review', 'settings', 'invitation'),
        allowNull: false,
        defaultValue: 'review',
      },
      createdAt: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
      updatedAt: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
    });

    // Add unique constraint to prevent duplicate preferred cleaner entries
    await queryInterface.addIndex('HomePreferredCleaners', ['homeId', 'cleanerId'], {
      unique: true,
      name: 'home_preferred_cleaner_unique',
    });

    // Add index for fast lookup by cleaner
    await queryInterface.addIndex('HomePreferredCleaners', ['cleanerId'], {
      name: 'idx_home_preferred_cleaners_cleaner',
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('HomePreferredCleaners');
  },
};
