'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('Users', 'ownerPrivateNotes', {
      type: Sequelize.TEXT,
      allowNull: true,
    });

    await queryInterface.addColumn('Users', 'falseHomeSizeCount', {
      type: Sequelize.INTEGER,
      allowNull: false,
      defaultValue: 0,
    });

    await queryInterface.addColumn('Users', 'falseClaimCount', {
      type: Sequelize.INTEGER,
      allowNull: false,
      defaultValue: 0,
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('Users', 'ownerPrivateNotes');
    await queryInterface.removeColumn('Users', 'falseHomeSizeCount');
    await queryInterface.removeColumn('Users', 'falseClaimCount');
  },
};
