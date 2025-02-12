const { UserApplications} = require("../models");

class ApplicationInfoClass {
	static async addApplicationToDB({
		firstName, 
        lastName, 
        email, 
        phone, 
        experience, 
        availability, 
        message,
	}) {
		 await UserApplications.create({
			firstName, 
            lastName, 
            email, 
            phone, 
            experience, 
            availability, 
            message,
		});
        return UserApplications
	}
}

module.exports = ApplicationInfoClass;