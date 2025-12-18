require("dotenv").config();
const bcrypt = require("bcrypt");
const manager1Password = process.env.MANAGER1_PASSWORD;

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const hashPassword = async (password) => {
      const saltRounds = 10;
      const passwordHash = await bcrypt.hash(password, saltRounds);
      return passwordHash;
    };

    // Function to seed the manager account
    const managerSeeder = async () => {
      const hashedPassword = await hashPassword(manager1Password);

      // Insert a manager account into the Users table
      await queryInterface.bulkInsert("Users", [
        {
          firstName: "Manager",
          lastName: "One",
          username: "manager1",
          email: "manager1CleaningCo@gmail.com",
          type: "manager",
          password: hashedPassword,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]);
    };

    // Call the managerSeeder function
    await managerSeeder();
  },

  down: async (queryInterface, Sequelize) => {
    // Remove the manager account
    await queryInterface.bulkDelete("Users", { username: "manager1" });
  },
};
