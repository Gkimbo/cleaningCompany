const bcrypt = require("bcrypt");

module.exports = {
	up: async (queryInterface, Sequelize) => {
		const hashPassword = async (password) => {
			const saltRounds = 10;
			return await bcrypt.hash(password, saltRounds);
		};

		// Function to seed the manager account
		const managerSeeder = async () => {
			const hashedPassword = await hashPassword("PassWordManager$$101");

			// Insert a manager account into the Users table
			await queryInterface.bulkInsert("Users", [
				{
					username: "manager1",
					email: "manager1CleaningCo@gmail.com",
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
		await queryInterface.bulkDelete("Users", { username: "manager" });
	},
};
