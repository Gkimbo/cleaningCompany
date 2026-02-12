"use strict";

/**
 * Migration: Add Employee Direct Payout Fields
 *
 * Adds support for business owners to optionally pay employees directly
 * through Stripe Connect instead of receiving all money themselves.
 *
 * Changes:
 * - Users: Add employeePayoutMethod setting for business owners
 * - EmployeeJobAssignments: Add fields to track split payouts
 */

module.exports = {
  async up(queryInterface, Sequelize) {
    // Add employeePayoutMethod to Users table (for business owners)
    await queryInterface.addColumn("Users", "employeePayoutMethod", {
      type: Sequelize.STRING(30),
      allowNull: false,
      defaultValue: "all_to_owner",
      comment:
        "For business owners: all_to_owner (default) or direct_to_employees",
    });

    // Add payout tracking fields to EmployeeJobAssignments
    await queryInterface.addColumn(
      "EmployeeJobAssignments",
      "employeeStripeTransferId",
      {
        type: Sequelize.STRING,
        allowNull: true,
        comment: "Stripe transfer ID if employee received direct payout",
      }
    );

    await queryInterface.addColumn(
      "EmployeeJobAssignments",
      "employeePaidAmount",
      {
        type: Sequelize.INTEGER,
        allowNull: true,
        comment: "Amount paid directly to employee via Stripe (in cents)",
      }
    );

    await queryInterface.addColumn(
      "EmployeeJobAssignments",
      "businessOwnerPaidAmount",
      {
        type: Sequelize.INTEGER,
        allowNull: true,
        comment:
          "Amount paid to business owner after employee split (in cents)",
      }
    );

    await queryInterface.addColumn(
      "EmployeeJobAssignments",
      "payoutMethod",
      {
        type: Sequelize.STRING(30),
        allowNull: false,
        defaultValue: "business_owner",
        comment:
          "How payout was handled: business_owner, direct_to_employee, split, or business_owner_fallback",
      }
    );

    // Add index for querying assignments by payout method
    await queryInterface.addIndex("EmployeeJobAssignments", ["payoutMethod"], {
      name: "idx_employee_assignments_payout_method",
    });
  },

  async down(queryInterface) {
    // Remove index
    await queryInterface.removeIndex(
      "EmployeeJobAssignments",
      "idx_employee_assignments_payout_method"
    );

    // Remove EmployeeJobAssignment columns
    await queryInterface.removeColumn(
      "EmployeeJobAssignments",
      "payoutMethod"
    );
    await queryInterface.removeColumn(
      "EmployeeJobAssignments",
      "businessOwnerPaidAmount"
    );
    await queryInterface.removeColumn(
      "EmployeeJobAssignments",
      "employeePaidAmount"
    );
    await queryInterface.removeColumn(
      "EmployeeJobAssignments",
      "employeeStripeTransferId"
    );

    // Remove User column
    await queryInterface.removeColumn("Users", "employeePayoutMethod");
  },
};
