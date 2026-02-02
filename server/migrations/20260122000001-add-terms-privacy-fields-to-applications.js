'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('UserApplications', 'termsAccepted', {
      type: Sequelize.BOOLEAN,
      allowNull: true,
      defaultValue: false,
    });

    await queryInterface.addColumn('UserApplications', 'termsId', {
      type: Sequelize.INTEGER,
      allowNull: true,
    });

    await queryInterface.addColumn('UserApplications', 'privacyPolicyAccepted', {
      type: Sequelize.BOOLEAN,
      allowNull: true,
      defaultValue: false,
    });

    await queryInterface.addColumn('UserApplications', 'privacyPolicyId', {
      type: Sequelize.INTEGER,
      allowNull: true,
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn('UserApplications', 'termsAccepted');
    await queryInterface.removeColumn('UserApplications', 'termsId');
    await queryInterface.removeColumn('UserApplications', 'privacyPolicyAccepted');
    await queryInterface.removeColumn('UserApplications', 'privacyPolicyId');
  }
};
