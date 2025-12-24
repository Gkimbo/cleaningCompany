'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('Users', 'notificationEmail', {
      type: Sequelize.STRING,
      allowNull: true,
      comment: 'Separate email for receiving notifications (falls back to main email if null)',
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('Users', 'notificationEmail');
  },
};
