"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    // Add referral code field to Users
    await queryInterface.addColumn("Users", "referralCode", {
      type: Sequelize.STRING,
      allowNull: true,
      unique: true,
    });

    // Add referral credits balance field to Users
    await queryInterface.addColumn("Users", "referralCredits", {
      type: Sequelize.INTEGER,
      allowNull: false,
      defaultValue: 0,
    });

    // Add index for referral code lookups
    await queryInterface.addIndex("Users", ["referralCode"], {
      name: "users_referral_code_idx",
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeIndex("Users", "users_referral_code_idx");
    await queryInterface.removeColumn("Users", "referralCredits");
    await queryInterface.removeColumn("Users", "referralCode");
  },
};
