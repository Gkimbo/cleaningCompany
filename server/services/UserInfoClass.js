const { UserHomes, User, UserAppointments, UserBills } = require("../models");
const bcrypt = require("bcrypt");
const { getPricingConfig } = require("../config/businessConfig");
const HomeClass = require("./HomeClass");

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
    // Geocode the address to get accurate coordinates
    const { latitude, longitude } = await HomeClass.geocodeAddress(
      address,
      city,
      state,
      zipcode
    );

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
      latitude,
      longitude,
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

    // Check if address changed - if so, re-geocode
    const addressChanged =
      existingHome.address !== address ||
      existingHome.city !== city ||
      existingHome.state !== state ||
      existingHome.zipcode !== zipcode;

    let latitude = existingHome.latitude;
    let longitude = existingHome.longitude;

    if (addressChanged) {
      const coords = await HomeClass.geocodeAddress(address, city, state, zipcode);
      latitude = coords.latitude;
      longitude = coords.longitude;
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
      latitude,
      longitude,
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

  static async editEmployeeInDB({ id, username, password, email, type, firstName, lastName, phone }) {
    const existingEmployee = await User.findOne({
      where: { id },
    });

    if (!existingEmployee) {
      return "Employee not found for editing";
    }

    try {
      const updateData = {
        username,
        email,
        type,
        firstName,
        lastName,
        phone: phone || null,
      };

      // Only hash and update password if one was provided
      if (password && password.trim() !== "") {
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);
        updateData.password = hashedPassword;
      }

      await existingEmployee.update(updateData);

      return existingEmployee;
    } catch (error) {
      throw new Error(error);
    }
  }

  static async editTimeInDB({ id, timeToBeCompleted }) {
    const existingAppointment = await UserAppointments.findOne({
      where: { id },
    });

    if (!existingAppointment) {
      return "Appointment not found for editing";
    }

    // Get time window surcharges from database pricing
    const pricing = await getPricingConfig();
    const timeWindows = pricing.timeWindows || {};

    // Get old and new surcharges (handle both object and number formats)
    const oldTimeWindow = existingAppointment.dataValues.timeToBeCompleted;
    const oldSurchargeConfig = timeWindows[oldTimeWindow];
    const newSurchargeConfig = timeWindows[timeToBeCompleted];

    const oldSurcharge = typeof oldSurchargeConfig === "object"
      ? oldSurchargeConfig?.surcharge || 0
      : oldSurchargeConfig || 0;
    const newSurcharge = typeof newSurchargeConfig === "object"
      ? newSurchargeConfig?.surcharge || 0
      : newSurchargeConfig || 0;

    const priceDifference = newSurcharge - oldSurcharge;

    const userId = existingAppointment.dataValues.userId;
    const existingBill = await UserBills.findOne({
      where: { userId },
    });

    const finalPrice = Number(existingAppointment.dataValues.price) + priceDifference;
    const totalAppointmentPrice =
      Number(existingBill.dataValues.appointmentDue) + priceDifference;
    const totalOverallPrice = Number(existingBill.dataValues.totalDue) + priceDifference;

    try {
      if (priceDifference !== 0 && existingBill) {
        await existingBill.update({
          appointmentDue: totalAppointmentPrice,
          totalDue: totalOverallPrice,
        });
      }
      await existingAppointment.update({
        timeToBeCompleted,
        price: finalPrice,
      });

      return existingAppointment;
    } catch (error) {
      throw new Error(error);
    }
  }

  static async editContactInDB({ id, contact }) {
    const existingAppointment = await UserAppointments.findOne({
      where: { id },
    });

    if (!existingAppointment) {
      return "Appointment not found for editing";
    }

    try {
      await existingAppointment.update({ contact });
      return existingAppointment;
    } catch (error) {
      throw new Error(error);
    }
  }

  static async editSheetsInDB({ id, bringSheets }) {
    // Use sheet fee from database pricing (per bed - assumes 1 bed adjustment for simple toggle)
    const pricing = await getPricingConfig();
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
    // Use towel fee from database pricing (default: 2 towels + 1 face cloth per bathroom for simple toggle)
    const pricing = await getPricingConfig();
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
