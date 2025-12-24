require("dotenv").config();
const bcrypt = require("bcrypt");
const owner1Password = process.env.OWNER1_PASSWORD;

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const hashPassword = async (password) => {
      const saltRounds = 10;
      const passwordHash = await bcrypt.hash(password, saltRounds);
      return passwordHash;
    };

    // Function to seed the owner account
    const ownerSeeder = async () => {
      const hashedPassword = await hashPassword(owner1Password);

      // Insert a owner account into the Users table
      await queryInterface.bulkInsert("Users", [
        {
          firstName: "Owner",
          lastName: "One",
          username: "owner1",
          email: "gavin.kimball@maritime.edu",
          type: "owner",
          password: hashedPassword,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]);
    };

    // Call the ownerSeeder function
    await ownerSeeder();
  },

  down: async (queryInterface, Sequelize) => {
    // Remove the owner account
    await queryInterface.bulkDelete("Users", { username: "owner1" });
  },
};
