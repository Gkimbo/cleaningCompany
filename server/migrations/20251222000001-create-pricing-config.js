"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("PricingConfigs", {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER,
      },
      // Base pricing (in dollars)
      basePrice: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 150,
      },
      extraBedBathFee: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 50,
      },
      // Linen services (in dollars)
      sheetFeePerBed: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 30,
      },
      towelFee: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 5,
      },
      faceClothFee: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 2,
      },
      // Time window surcharges (in dollars)
      timeWindowAnytime: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      timeWindow10To3: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 25,
      },
      timeWindow11To4: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 25,
      },
      timeWindow12To2: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 30,
      },
      // Cancellation policy
      cancellationFee: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 25,
      },
      cancellationWindowDays: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 7,
      },
      homeownerPenaltyDays: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 3,
      },
      cleanerPenaltyDays: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 4,
      },
      refundPercentage: {
        type: Sequelize.DECIMAL(3, 2),
        allowNull: false,
        defaultValue: 0.50,
      },
      // Platform fees
      platformFeePercent: {
        type: Sequelize.DECIMAL(3, 2),
        allowNull: false,
        defaultValue: 0.10,
      },
      // High volume fee
      highVolumeFee: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 50,
      },
      // Audit fields
      isActive: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: true,
      },
      updatedBy: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          model: "Users",
          key: "id",
        },
        onUpdate: "CASCADE",
        onDelete: "SET NULL",
      },
      changeNote: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      createdAt: {
        allowNull: false,
        type: Sequelize.DATE,
      },
      updatedAt: {
        allowNull: false,
        type: Sequelize.DATE,
      },
    });

    // Add index for quick lookup of active config
    await queryInterface.addIndex("PricingConfigs", ["isActive"], {
      name: "pricing_config_active_idx",
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable("PricingConfigs");
  },
};
