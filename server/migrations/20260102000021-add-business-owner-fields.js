'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    // Add isBusinessOwner field
    await queryInterface.addColumn('Users', 'isBusinessOwner', {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    });

    // Add businessName field
    await queryInterface.addColumn('Users', 'businessName', {
      type: Sequelize.STRING,
      allowNull: true,
    });

    // Add yearsInBusiness field
    await queryInterface.addColumn('Users', 'yearsInBusiness', {
      type: Sequelize.INTEGER,
      allowNull: true,
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn('Users', 'isBusinessOwner');
    await queryInterface.removeColumn('Users', 'businessName');
    await queryInterface.removeColumn('Users', 'yearsInBusiness');
  }
};
