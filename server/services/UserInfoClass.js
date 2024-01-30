const { UserHomes, User } = require("../models");

class UserInfoClass {
	static async addHomeToDB({
		userId,
		address,
		city,
		zipcode,
		numBeds,
		numBaths,
		sheetsProvided,
		towelsProvided,
		keyPadCode,
		keyLocation,
		recyclingLocation,
		compostLocation,
		trashLocation,
	}) {
		await UserHomes.create({
			userId,
			address,
			city,
			zipcode,
			numBeds,
			numBaths,
			sheetsProvided,
			towelsProvided,
			keyPadCode,
			keyLocation,
			recyclingLocation,
			compostLocation,
			trashLocation,
		});
	}

	static async editHomeInDB({
		id,
		address,
		city,
		zipcode,
		numBeds,
		numBaths,
		sheetsProvided,
		towelsProvided,
		keyPadCode,
		keyLocation,
		recyclingLocation,
		compostLocation,
		trashLocation,
	}) {
		const existingHome = await UserHomes.findOne({
			where: { id },
		});

		if (!existingHome) {
			return "Home not found for editing";
		}

		await existingHome.update({
			address,
			city,
			zipcode,
			numBeds,
			numBaths,
			sheetsProvided,
			towelsProvided,
			keyPadCode,
			keyLocation,
			recyclingLocation,
			compostLocation,
			trashLocation,
		});

		return existingHome;
	}

	static async deleteHomeInfo(id) {
		try {
			const deletedHomeInfo = await UserHomes.destroy({
				where: { id: id },
			});
			return deletedHomeInfo;
		} catch (error) {
			console.error("Error deleting car info: ", error);
			throw error;
		}
	}

	static async editEmployeeInDB({ id, username, password, email, type }) {
		const existingEmployee = await User.findOne({
			where: { id },
		});

		if (!existingEmployee) {
			return "Employee not found for editing";
		}

		await existingEmployee.update({
			username,
			password,
			email,
			type,
		});

		return existingEmployee;
	}
}

module.exports = UserInfoClass;
