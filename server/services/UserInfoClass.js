const { UserHomes } = require("../models");

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
}

module.exports = UserInfoClass;
