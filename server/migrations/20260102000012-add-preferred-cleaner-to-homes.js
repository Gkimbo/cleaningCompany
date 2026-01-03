"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn("UserHomes", "preferredCleanerId", {
      type: Sequelize.INTEGER,
      allowNull: true,
      references: {
        model: "Users",
        key: "id",
      },
      onUpdate: "CASCADE",
      onDelete: "SET NULL",
    });

    // Add index for preferred cleaner lookups
    await queryInterface.addIndex("UserHomes", ["preferredCleanerId"], {
      name: "user_homes_preferred_cleaner_idx",
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeIndex("UserHomes", "user_homes_preferred_cleaner_idx");
    await queryInterface.removeColumn("UserHomes", "preferredCleanerId");
  },
};
