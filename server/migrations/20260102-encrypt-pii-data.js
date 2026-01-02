"use strict";

const EncryptionService = require("../services/EncryptionService");

/**
 * Migration to encrypt PII data in User, UserHomes, and UserApplications tables.
 * This migration:
 * 1. Adds emailHash columns for searching encrypted emails
 * 2. Changes column types from STRING to TEXT for encrypted fields
 * 3. Encrypts all existing PII data
 */

module.exports = {
  async up(queryInterface, Sequelize) {
    const transaction = await queryInterface.sequelize.transaction();

    try {
      // 1. Add emailHash column to Users table
      await queryInterface.addColumn(
        "Users",
        "emailHash",
        {
          type: Sequelize.STRING,
          allowNull: true,
        },
        { transaction }
      );

      // 2. Add emailHash column to UserApplications table
      await queryInterface.addColumn(
        "UserApplications",
        "emailHash",
        {
          type: Sequelize.STRING,
          allowNull: true,
        },
        { transaction }
      );

      // 3. Change User PII columns to TEXT
      const userPIIColumns = ["firstName", "lastName", "email", "notificationEmail", "phone"];
      for (const column of userPIIColumns) {
        await queryInterface.changeColumn(
          "Users",
          column,
          {
            type: Sequelize.TEXT,
            allowNull: column === "notificationEmail" || column === "phone" ? true : false,
          },
          { transaction }
        );
      }

      // 4. Change UserHomes PII columns to TEXT
      const homesPIIColumns = ["address", "city", "state", "keyPadCode", "keyLocation", "contact"];
      for (const column of homesPIIColumns) {
        await queryInterface.changeColumn(
          "UserHomes",
          column,
          {
            type: Sequelize.TEXT,
            allowNull: column === "state" || column === "keyPadCode" || column === "keyLocation" ? true : false,
          },
          { transaction }
        );
      }

      // Change UserHomes latitude/longitude to TEXT for encrypted storage
      await queryInterface.changeColumn(
        "UserHomes",
        "latitude",
        {
          type: Sequelize.TEXT,
          allowNull: true,
        },
        { transaction }
      );

      await queryInterface.changeColumn(
        "UserHomes",
        "longitude",
        {
          type: Sequelize.TEXT,
          allowNull: true,
        },
        { transaction }
      );

      // 5. Change UserApplications PII columns to TEXT
      const appPIIColumns = [
        "firstName", "lastName", "email", "phone",
        "streetAddress", "city", "state", "zipCode",
        "ssnLast4", "driversLicenseNumber", "driversLicenseState",
        "previousEmployer", "previousEmployerPhone",
        "emergencyContactName", "emergencyContactPhone"
      ];
      for (const column of appPIIColumns) {
        try {
          await queryInterface.changeColumn(
            "UserApplications",
            column,
            {
              type: Sequelize.TEXT,
              allowNull: column === "firstName" || column === "lastName" || column === "email" || column === "phone" ? false : true,
            },
            { transaction }
          );
        } catch (error) {
          console.log(`Column ${column} may not exist or already be TEXT:`, error.message);
        }
      }

      // 6. Encrypt existing User data
      if (EncryptionService.isEnabled()) {
        console.log("Encrypting existing User data...");
        const [users] = await queryInterface.sequelize.query(
          "SELECT id, firstName, lastName, email, notificationEmail, phone FROM \"Users\"",
          { transaction }
        );

        for (const user of users) {
          const updates = {};

          if (user.firstName && !user.firstName.includes(":")) {
            updates.firstName = EncryptionService.encrypt(user.firstName);
          }
          if (user.lastName && !user.lastName.includes(":")) {
            updates.lastName = EncryptionService.encrypt(user.lastName);
          }
          if (user.email && !user.email.includes(":")) {
            updates.email = EncryptionService.encrypt(user.email);
            updates.emailHash = EncryptionService.hash(user.email);
          }
          if (user.notificationEmail && !user.notificationEmail.includes(":")) {
            updates.notificationEmail = EncryptionService.encrypt(user.notificationEmail);
          }
          if (user.phone && !user.phone.includes(":")) {
            updates.phone = EncryptionService.encrypt(user.phone);
          }

          if (Object.keys(updates).length > 0) {
            const setClauses = Object.keys(updates)
              .map((key) => `"${key}" = :${key}`)
              .join(", ");

            await queryInterface.sequelize.query(
              `UPDATE "Users" SET ${setClauses} WHERE id = :id`,
              {
                replacements: { ...updates, id: user.id },
                transaction,
              }
            );
          }
        }
        console.log(`Encrypted ${users.length} users`);

        // 7. Encrypt existing UserHomes data
        console.log("Encrypting existing UserHomes data...");
        const [homes] = await queryInterface.sequelize.query(
          `SELECT id, address, city, state, zipcode, "keyPadCode", "keyLocation", contact, latitude, longitude FROM "UserHomes"`,
          { transaction }
        );

        for (const home of homes) {
          const updates = {};

          const fieldsToEncrypt = ["address", "city", "state", "zipcode", "keyPadCode", "keyLocation", "contact"];
          for (const field of fieldsToEncrypt) {
            if (home[field] && !String(home[field]).includes(":")) {
              updates[field] = EncryptionService.encrypt(String(home[field]));
            }
          }

          // Encrypt latitude and longitude
          if (home.latitude && !String(home.latitude).includes(":")) {
            updates.latitude = EncryptionService.encrypt(String(home.latitude));
          }
          if (home.longitude && !String(home.longitude).includes(":")) {
            updates.longitude = EncryptionService.encrypt(String(home.longitude));
          }

          if (Object.keys(updates).length > 0) {
            const setClauses = Object.keys(updates)
              .map((key) => `"${key}" = :${key}`)
              .join(", ");

            await queryInterface.sequelize.query(
              `UPDATE "UserHomes" SET ${setClauses} WHERE id = :id`,
              {
                replacements: { ...updates, id: home.id },
                transaction,
              }
            );
          }
        }
        console.log(`Encrypted ${homes.length} homes`);

        // 8. Encrypt existing UserApplications data
        console.log("Encrypting existing UserApplications data...");
        const [applications] = await queryInterface.sequelize.query(
          `SELECT id, "firstName", "lastName", email, phone, "streetAddress", city, state, "zipCode",
           "ssnLast4", "driversLicenseNumber", "driversLicenseState", "idPhoto",
           "previousEmployer", "previousEmployerPhone", "emergencyContactName", "emergencyContactPhone"
           FROM "UserApplications"`,
          { transaction }
        );

        for (const app of applications) {
          const updates = {};

          const fieldsToEncrypt = [
            "firstName", "lastName", "email", "phone",
            "streetAddress", "city", "state", "zipCode",
            "ssnLast4", "driversLicenseNumber", "driversLicenseState", "idPhoto",
            "previousEmployer", "previousEmployerPhone",
            "emergencyContactName", "emergencyContactPhone"
          ];

          for (const field of fieldsToEncrypt) {
            if (app[field] && !String(app[field]).includes(":")) {
              updates[field] = EncryptionService.encrypt(String(app[field]));
            }
          }

          // Generate email hash
          if (app.email && !String(app.email).includes(":")) {
            updates.emailHash = EncryptionService.hash(app.email);
          }

          if (Object.keys(updates).length > 0) {
            const setClauses = Object.keys(updates)
              .map((key) => `"${key}" = :${key}`)
              .join(", ");

            await queryInterface.sequelize.query(
              `UPDATE "UserApplications" SET ${setClauses} WHERE id = :id`,
              {
                replacements: { ...updates, id: app.id },
                transaction,
              }
            );
          }
        }
        console.log(`Encrypted ${applications.length} applications`);
      } else {
        console.log("PII_ENCRYPTION_KEY not set. Skipping data encryption.");
        console.log("Run this migration again after setting the key to encrypt existing data.");
      }

      await transaction.commit();
      console.log("PII encryption migration completed successfully");
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  },

  async down(queryInterface, Sequelize) {
    const transaction = await queryInterface.sequelize.transaction();

    try {
      // Remove emailHash columns
      await queryInterface.removeColumn("Users", "emailHash", { transaction });

      // UserApplications table may not exist if its migration was already rolled back
      try {
        await queryInterface.removeColumn("UserApplications", "emailHash", { transaction });
      } catch (error) {
        console.log("UserApplications table does not exist, skipping emailHash removal");
      }

      // Note: We don't decrypt data in down migration as that would require the encryption key
      // and could lead to data loss if key is not available

      await transaction.commit();
      console.log("PII encryption migration rolled back (columns removed, data not decrypted)");
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  },
};
