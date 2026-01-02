"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Allow reviewerId to be null so reviews can remain when reviewer is deleted
    await queryInterface.changeColumn("UserReviews", "reviewerId", {
      type: Sequelize.INTEGER,
      allowNull: true,
      references: {
        model: "Users",
        key: "id",
      },
      onDelete: "SET NULL",
    });
  },

  down: async (queryInterface, Sequelize) => {
    // Revert to non-nullable with CASCADE delete
    await queryInterface.changeColumn("UserReviews", "reviewerId", {
      type: Sequelize.INTEGER,
      allowNull: false,
      references: {
        model: "Users",
        key: "id",
      },
      onDelete: "CASCADE",
    });
  },
};
