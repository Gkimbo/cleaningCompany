"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn("UserHomes", "squareFootage", {
      type: Sequelize.INTEGER,
      allowNull: true,
      comment: "Square footage of the home",
    });

    await queryInterface.addColumn("UserHomes", "roomConfiguration", {
      type: Sequelize.JSONB,
      allowNull: true,
      comment: "Detailed room configuration: [{type, label, squareFt}, ...]",
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn("UserHomes", "roomConfiguration");
    await queryInterface.removeColumn("UserHomes", "squareFootage");
  },
};
