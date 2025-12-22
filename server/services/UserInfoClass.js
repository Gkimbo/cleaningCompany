const { UserHomes, User, UserAppointments, UserBills } = require("../models");
const bcrypt = require("bcrypt");
const { businessConfig } = require("../config/businessConfig");

// Get pricing from config
const { pricing } = businessConfig;

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
    outsideServiceArea = false,
    // New fields for sheets/towels details
    cleanSheetsLocation,
    dirtySheetsLocation,
    cleanTowelsLocation,
    dirtyTowelsLocation,
    bedConfigurations,
    bathroomConfigurations,
  }) {
    const newHome = await UserHomes.create({
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
      outsideServiceArea,
      cleanSheetsLocation,
      dirtySheetsLocation,
      cleanTowelsLocation,
      dirtyTowelsLocation,
      bedConfigurations,
      bathroomConfigurations,
    });
    return newHome;
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
    outsideServiceArea = false,
    // New fields for sheets/towels details
    cleanSheetsLocation,
    dirtySheetsLocation,
    cleanTowelsLocation,
    dirtyTowelsLocation,
    bedConfigurations,
    bathroomConfigurations,
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
      outsideServiceArea,
      cleanSheetsLocation,
      dirtySheetsLocation,
      cleanTowelsLocation,
      dirtyTowelsLocation,
      bedConfigurations,
      bathroomConfigurations,
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
    // Get time window surcharge from config
    const price = pricing.timeWindows[timeToBeCompleted] || 0;

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
    // Use sheet fee from config (per bed - assumes 1 bed adjustment for simple toggle)
    const sheetFee = pricing.linens.sheetFeePerBed;
    const price = bringSheets === "yes" ? sheetFee : -sheetFee;

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
    // Use towel fee from config (default: 2 towels + 1 face cloth per bathroom for simple toggle)
    const { towelFee, faceClothFee } = pricing.linens;
    const defaultTowelPrice = 2 * towelFee + faceClothFee; // $12 for default bathroom
    const price = bringTowels === "yes" ? defaultTowelPrice : -defaultTowelPrice;

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

  static async editAppointmentLinensInDB({
    id,
    sheetConfigurations,
    towelConfigurations,
    bringSheets,
    bringTowels,
    newPrice,
  }) {
    const existingAppointment = await UserAppointments.findOne({
      where: { id },
    });

    if (!existingAppointment) {
      return "Appointment not found for editing";
    }

    const userId = existingAppointment.dataValues.userId;
    const oldPrice = Number(existingAppointment.dataValues.price);
    const priceDifference = newPrice - oldPrice;

    const existingBill = await UserBills.findOne({
      where: { userId },
    });

    try {
      // Update bill if price changed
      if (priceDifference !== 0 && existingBill) {
        const totalAppointmentPrice =
          Number(existingBill.dataValues.appointmentDue) + priceDifference;
        const totalOverallPrice =
          Number(existingBill.dataValues.totalDue) + priceDifference;

        await existingBill.update({
          appointmentDue: totalAppointmentPrice,
          totalDue: totalOverallPrice,
        });
      }

      // Update appointment
      await existingAppointment.update({
        sheetConfigurations,
        towelConfigurations,
        bringSheets,
        bringTowels,
        price: newPrice,
      });

      return existingAppointment;
    } catch (error) {
      throw new Error(error);
    }
  }
}

module.exports = UserInfoClass;
