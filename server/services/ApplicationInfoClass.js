const { UserApplications } = require("../models");

class ApplicationInfoClass {
  static async addApplicationToDB({
    firstName,
    lastName,
    email,
    phone,
    experience,
    message,
    idPhoto,
    backgroundConsent,
  }) {
    // Create a new record in the database
    const application = await UserApplications.create({
      firstName,
      lastName,
      email,
      phone,
      experience,
      message,
      idPhoto,
      backgroundConsent,
    });

    return application;
  }
}

module.exports = ApplicationInfoClass;
