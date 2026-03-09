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
      // Base pricing (in cents)
      basePrice: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 15000,
        comment: "Base price in cents (15000 = $150.00)",
      },
      extraBedBathFee: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 5000,
        comment: "Extra bed/bath fee in cents",
      },
      // Linen services (in cents)
      sheetFeePerBed: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 3000,
        comment: "Sheet fee per bed in cents",
      },
      towelFee: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 500,
        comment: "Towel fee in cents",
      },
      faceClothFee: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 200,
        comment: "Face cloth fee in cents",
      },
      // Time window surcharges (in cents)
      timeWindowAnytime: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
        comment: "Anytime window surcharge in cents",
      },
      timeWindow10To3: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 2500,
        comment: "10-3 window surcharge in cents",
      },
      timeWindow11To4: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 2500,
        comment: "11-4 window surcharge in cents",
      },
      timeWindow12To2: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 3000,
        comment: "12-2 window surcharge in cents",
      },
      // Cancellation policy
      cancellationFee: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 2500,
        comment: "Cancellation fee in cents",
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
        defaultValue: 5000,
        comment: "High volume fee in cents",
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
