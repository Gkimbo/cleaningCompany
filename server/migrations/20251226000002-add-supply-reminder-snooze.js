'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('Users', 'supplyReminderSnoozedUntil', {
      type: Sequelize.DATE,
      allowNull: true,
      comment: 'If set, supply reminders are silenced until this date',
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('Users', 'supplyReminderSnoozedUntil');
  },
};
