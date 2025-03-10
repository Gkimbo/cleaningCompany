const { UserHomes, User, UserAppointments, UserBills } = require("../models");
const bcrypt = require("bcrypt");

class UserInfoClass {
  static async addHomeToDB({
    userId,
    nickName,
    address,
    city,
    state,
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
    contact,
    specialNotes,
    cleanersNeeded,
    timeToBeCompleted,
  }) {
    await UserHomes.create({
      userId,
      nickName,
      address,
      city,
      state,
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
      contact,
      specialNotes,
      cleanersNeeded,
      timeToBeCompleted,
    });
  }

  static async editHomeInDB({
    id,
    nickName,
    address,
    city,
    state,
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
    contact,
    specialNotes,
    cleanersNeeded,
    timeToBeCompleted,
  }) {
    const existingHome = await UserHomes.findOne({
      where: { id },
    });

    if (!existingHome) {
      return "Home not found for editing";
    }

    await existingHome.update({
      nickName,
      address,
      city,
      state,
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
      contact,
      specialNotes,
      cleanersNeeded,
      timeToBeCompleted,
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

    try {
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(password, salt);
      password = hashedPassword;

      await existingEmployee.update({
        username,
        password,
        email,
        type,
      });

      return existingEmployee;
    } catch (error) {
      throw new Error(error);
    }
  }

  static async editTimeInDB({ id, timeToBeCompleted }) {
    let price;
    if (timeToBeCompleted === "anytime") {
      price = 0;
    } else if (timeToBeCompleted === "10-3") {
      price = 30;
    } else if (timeToBeCompleted === "11-4") {
      price = 30;
    }else if (timeToBeCompleted === "12-2") {
		price = 50;
	  }

    const existingAppointment = await UserAppointments.findOne({
      where: { id },
    });
    const userId = existingAppointment.dataValues.userId;
    const existingBill = await UserBills.findOne({
      where: {
        userId,
      },
    });
    const finalPrice = Number(existingAppointment.dataValues.price) + price;
    const totalAppointmentPrice =
      Number(existingBill.dataValues.appointmentDue) + price;
    const totalOverallPrice = Number(existingBill.dataValues.totalDue) + price;

    if (!existingAppointment) {
      return "Appointment not found for editing";
    }

    try {
      await existingBill.update({
        appointmentDue: totalAppointmentPrice,
        totalDue: totalOverallPrice,
      });
      await existingAppointment.update({
        timeToBeCompleted,
        price: finalPrice,
      });

      return existingAppointment;
    } catch (error) {
      throw new Error(error);
    }
  }

  static async editSheetsInDB({ id, bringSheets }) {
    let price;
    if (bringSheets === "yes") {
      price = 25;
    } else price = -25;

    const existingAppointment = await UserAppointments.findOne({
      where: { id },
    });
    const userId = existingAppointment.dataValues.userId;
    const existingBill = await UserBills.findOne({
      where: {
        userId,
      },
    });
    const finalPrice = Number(existingAppointment.dataValues.price) + price;
    const totalAppointmentPrice =
      Number(existingBill.dataValues.appointmentDue) + price;
    const totalOverallPrice = Number(existingBill.dataValues.totalDue) + price;

    if (!existingAppointment) {
      return "Appointment not found for editing";
    }

    try {
      await existingBill.update({
        appointmentDue: totalAppointmentPrice,
        totalDue: totalOverallPrice,
      });
      await existingAppointment.update({
        bringSheets,
        price: finalPrice,
      });

      return existingAppointment;
    } catch (error) {
      throw new Error(error);
    }
  }

  static async editTowelsInDB({ id, bringTowels }) {
    let price;
    if (bringTowels === "yes") {
      price = 25;
    } else price = -25;

    const existingAppointment = await UserAppointments.findOne({
      where: { id },
    });
    const userId = existingAppointment.dataValues.userId;
    const existingBill = await UserBills.findOne({
      where: {
        userId,
      },
    });
    const finalPrice = Number(existingAppointment.dataValues.price) + price;
    const totalAppointmentPrice =
      Number(existingBill.dataValues.appointmentDue) + price;
    const totalOverallPrice = Number(existingBill.dataValues.totalDue) + price;

    if (!existingAppointment) {
      return "Employee not found for editing";
    }

    try {
      await existingBill.update({
        appointmentDue: totalAppointmentPrice,
        totalDue: totalOverallPrice,
      });
      await existingAppointment.update({
        bringTowels,
        price: finalPrice,
      });

      return existingAppointment;
    } catch (error) {
      throw new Error(error);
    }
  }

  static async editCodeKeyInDB({ id, keyPadCode, keyLocation }) {
    const existingAppointment = await UserAppointments.findOne({
      where: { id },
    });
    if (!existingAppointment) {
      return "Employee not found for editing";
    }
    try {
      await existingAppointment.update({
        keyLocation,
        keyPadCode,
      });

      return existingAppointment;
    } catch (error) {
      throw new Error(error);
    }
  }
}

module.exports = UserInfoClass;
