"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    // Add warning count field
    await queryInterface.addColumn("Users", "warningCount", {
      type: Sequelize.INTEGER,
      allowNull: false,
      defaultValue: 0,
      comment: "Number of warnings issued to this user",
    });

    // Add field to track who updated the account status
    await queryInterface.addColumn("Users", "accountStatusUpdatedById", {
      type: Sequelize.INTEGER,
      allowNull: true,
      references: {
        model: "Users",
        key: "id",
      },
      onUpdate: "CASCADE",
      onDelete: "SET NULL",
      comment: "The HR/Owner who last updated the account status",
    });

    // Add index for quick lookup of warned/frozen accounts
    await queryInterface.addIndex("Users", ["accountFrozen"], {
      name: "users_account_frozen_idx",
    });

    await queryInterface.addIndex("Users", ["warningCount"], {
      name: "users_warning_count_idx",
    });
  },

  async down(queryInterface) {
    await queryInterface.removeIndex("Users", "users_warning_count_idx");
    await queryInterface.removeIndex("Users", "users_account_frozen_idx");
    await queryInterface.removeColumn("Users", "accountStatusUpdatedById");
    await queryInterface.removeColumn("Users", "warningCount");
  },
};
