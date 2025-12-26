"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    // Change notifications array to use TEXT instead of VARCHAR(255)
    await queryInterface.changeColumn("Users", "notifications", {
      type: Sequelize.ARRAY(Sequelize.TEXT),
      allowNull: true,
    });
  },

  async down(queryInterface, Sequelize) {
    // Truncate any long values before reverting to VARCHAR(255)
    await queryInterface.sequelize.query(`
      UPDATE "Users"
      SET notifications = ARRAY(
        SELECT LEFT(unnest(notifications), 255)
      )
      WHERE notifications IS NOT NULL
    `);

    // Revert back to VARCHAR(255) array
    await queryInterface.changeColumn("Users", "notifications", {
      type: Sequelize.ARRAY(Sequelize.STRING),
      allowNull: true,
    });
  },
};
