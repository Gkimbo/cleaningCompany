"use strict";

module.exports = {
	async up(queryInterface, Sequelize) {
		// Create ENUM type for verification status
		await queryInterface.sequelize.query(`
			CREATE TYPE "enum_Users_businessVerificationStatus" AS ENUM (
				'none', 'pending', 'verified'
			);
		`).catch(() => {}); // Ignore if already exists

		// Add business verification status
		await queryInterface.addColumn("Users", "businessVerificationStatus", {
			type: Sequelize.ENUM("none", "pending", "verified"),
			allowNull: false,
			defaultValue: "none",
			comment: "Verification status for marketplace highlighting",
		});

		// Add verified at timestamp
		await queryInterface.addColumn("Users", "businessVerifiedAt", {
			type: Sequelize.DATE,
			allowNull: true,
			comment: "When the business was verified",
		});

		// Add business description
		await queryInterface.addColumn("Users", "businessDescription", {
			type: Sequelize.TEXT,
			allowNull: true,
			comment: "Business description/specialties for marketplace profile",
		});

		// Add opt-in flag for marketplace highlighting
		await queryInterface.addColumn("Users", "businessHighlightOptIn", {
			type: Sequelize.BOOLEAN,
			allowNull: false,
			defaultValue: true,
			comment: "Whether business owner opts in to marketplace highlighting",
		});

		// Add index for quick lookup of verified businesses
		await queryInterface.addIndex("Users", ["businessVerificationStatus"], {
			name: "idx_users_business_verification_status",
			where: {
				isBusinessOwner: true,
			},
		}).catch(() => {}); // Partial index might not work on all DBs
	},

	async down(queryInterface, Sequelize) {
		await queryInterface.removeColumn("Users", "businessVerificationStatus");
		await queryInterface.removeColumn("Users", "businessVerifiedAt");
		await queryInterface.removeColumn("Users", "businessDescription");
		await queryInterface.removeColumn("Users", "businessHighlightOptIn");

		await queryInterface.removeIndex("Users", "idx_users_business_verification_status").catch(() => {});

		await queryInterface.sequelize.query(`
			DROP TYPE IF EXISTS "enum_Users_businessVerificationStatus";
		`);
	},
};
