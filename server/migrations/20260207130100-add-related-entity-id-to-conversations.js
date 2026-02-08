'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('Conversations', 'relatedEntityId', {
      type: Sequelize.INTEGER,
      allowNull: true,
      comment: 'Generic foreign key for related entities (e.g., BusinessEmployee ID for business_employee conversations)',
    });

    // Add index for faster lookups
    await queryInterface.addIndex('Conversations', ['conversationType', 'relatedEntityId'], {
      name: 'conversations_type_entity_idx',
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeIndex('Conversations', 'conversations_type_entity_idx');
    await queryInterface.removeColumn('Conversations', 'relatedEntityId');
  }
};
