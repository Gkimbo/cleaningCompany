"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("NewHomeRequests", {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER,
      },

      // === Relationships ===
      homeId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: "UserHomes",
          key: "id",
        },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      },
      clientId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: "Users",
          key: "id",
        },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
        comment: "The homeowner who added the new home",
      },
      businessOwnerId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: "Users",
          key: "id",
        },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
        comment: "The business owner being asked to clean this home",
      },
      existingCleanerClientId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: "CleanerClients",
          key: "id",
        },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
        comment: "The existing CleanerClient relationship between client and BO",
      },

      // === Request state ===
      status: {
        type: Sequelize.ENUM("pending", "accepted", "declined", "expired", "cancelled"),
        allowNull: false,
        defaultValue: "pending",
      },
      expiresAt: {
        type: Sequelize.DATE,
        allowNull: true,
        comment: "When the request expires (48 hours from creation)",
      },
      respondedAt: {
        type: Sequelize.DATE,
        allowNull: true,
        comment: "When the business owner responded",
      },
      declineReason: {
        type: Sequelize.TEXT,
        allowNull: true,
        comment: "Optional reason provided when declining",
      },

      // === Price calculation (stored at request time) ===
      calculatedPrice: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: true,
        comment: "The auto-calculated price based on home size and hourly rate",
      },
      numBeds: {
        type: Sequelize.INTEGER,
        allowNull: true,
        comment: "Number of bedrooms at time of request",
      },
      numBaths: {
        type: Sequelize.DECIMAL(3, 1),
        allowNull: true,
        comment: "Number of bathrooms at time of request",
      },
      hourlyRate: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: true,
        comment: "Business owner hourly rate used for calculation",
      },

      // === Rate limiting for re-requests ===
      lastRequestedAt: {
        type: Sequelize.DATE,
        allowNull: true,
        comment: "When the client last sent/re-sent this request",
      },
      requestCount: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 1,
        comment: "Number of times this request has been sent",
      },

      // === Timestamps ===
      createdAt: {
        allowNull: false,
        type: Sequelize.DATE,
      },
      updatedAt: {
        allowNull: false,
        type: Sequelize.DATE,
      },
    });

    // Indexes for efficient querying
    await queryInterface.addIndex("NewHomeRequests", ["homeId"], {
      name: "new_home_requests_home_id_idx",
    });
    await queryInterface.addIndex("NewHomeRequests", ["clientId"], {
      name: "new_home_requests_client_id_idx",
    });
    await queryInterface.addIndex("NewHomeRequests", ["businessOwnerId"], {
      name: "new_home_requests_business_owner_id_idx",
    });
    await queryInterface.addIndex("NewHomeRequests", ["businessOwnerId", "status"], {
      name: "new_home_requests_bo_status_idx",
    });
    await queryInterface.addIndex("NewHomeRequests", ["status"], {
      name: "new_home_requests_status_idx",
    });
    await queryInterface.addIndex("NewHomeRequests", ["expiresAt"], {
      name: "new_home_requests_expires_at_idx",
      where: { expiresAt: { [Sequelize.Op.ne]: null } },
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable("NewHomeRequests");
  },
};
