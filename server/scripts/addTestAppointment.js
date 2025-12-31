/**
 * Script to add a test appointment for today
 *
 * Usage: node server/scripts/addTestAppointment.js
 *
 * Creates an appointment:
 * - Cleaner: Karin
 * - Home: "race lane" (owned by Gavin)
 * - Date: Today
 * - Status: Paid (auto-captured), assigned, ready for cleaning
 * - Created as if booked a week ago
 */

require("dotenv").config({ path: require("path").join(__dirname, "../.env") });

const { User, UserHomes, UserAppointments, UserCleanerAppointments, Payout, sequelize } = require("../models");
const { Op } = require("sequelize");
const calculatePrice = require("../services/CalculatePrice");

async function addTestAppointment() {
  try {
    console.log("Starting test appointment creation...\n");

    // Find Gavin (homeowner) - prioritize username match
    let gavin = await User.findOne({
      where: {
        [Op.or]: [
          { username: { [Op.iLike]: "%gavin%" } },
          { firstName: { [Op.iLike]: "gavin" } },
        ],
        type: { [Op.or]: [null, "homeowner", "client"] },
      },
    });

    // Fallback: find user who owns the Race Lane home
    if (!gavin) {
      const raceLane = await UserHomes.findOne({
        where: { nickName: { [Op.iLike]: "%race%lane%" } },
      });
      if (raceLane) {
        gavin = await User.findByPk(raceLane.userId);
      }
    }

    if (!gavin) {
      console.error("Could not find user 'Gavin'. Please check the database.");
      process.exit(1);
    }
    console.log(`Found homeowner: ${gavin.username || gavin.firstName} (ID: ${gavin.id})`);

    // Find Karin (cleaner)
    const karin = await User.findOne({
      where: {
        [Op.or]: [
          { username: { [Op.iLike]: "%karin%" } },
          { firstName: { [Op.iLike]: "%karin%" } },
        ],
        type: { [Op.or]: ["employee", "cleaner"] },
      },
    });

    if (!karin) {
      console.error("Could not find cleaner 'Karin'. Please check the database.");
      process.exit(1);
    }
    console.log(`Found cleaner: ${karin.username || karin.firstName} (ID: ${karin.id})`);

    // Find "race lane" home
    const homes = await UserHomes.findAll({
      where: { userId: gavin.id },
    });

    // Search for "race lane" in nickName (case insensitive after decryption)
    let raceLaneHome = homes.find(
      (h) => h.nickName && h.nickName.toLowerCase().includes("race")
    );

    // If not found by nickname, try address
    if (!raceLaneHome) {
      raceLaneHome = homes.find(
        (h) => h.address && h.address.toLowerCase().includes("race")
      );
    }

    // If still not found, use the first home
    if (!raceLaneHome && homes.length > 0) {
      raceLaneHome = homes[0];
      console.log(`Could not find 'race lane' home, using first home: ${raceLaneHome.nickName}`);
    }

    if (!raceLaneHome) {
      console.error("Could not find any home for Gavin. Please add a home first.");
      process.exit(1);
    }
    console.log(`Found home: ${raceLaneHome.nickName} (ID: ${raceLaneHome.id})`);

    // Calculate dates
    const today = new Date();
    const todayStr = today.toISOString().split("T")[0]; // YYYY-MM-DD format

    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

    // Check if appointment already exists for today
    const existingAppt = await UserAppointments.findOne({
      where: {
        homeId: raceLaneHome.id,
        date: todayStr,
      },
    });

    if (existingAppt) {
      console.log(`\nAppointment already exists for today (ID: ${existingAppt.id})`);
      console.log("Updating it to match test requirements...");

      await existingAppt.update({
        paid: true,
        hasBeenAssigned: true,
        employeesAssigned: [String(karin.id)],
        completed: false,
        paymentStatus: "captured",
        amountPaid: Math.round(parseFloat(existingAppt.price) * 100),
        manuallyPaid: false,
      });

      // Update timestamps to simulate booking a week ago
      await sequelize.query(
        `UPDATE "UserAppointments" SET "createdAt" = :createdAt WHERE id = :id`,
        {
          replacements: { createdAt: oneWeekAgo, id: existingAppt.id },
          type: sequelize.QueryTypes.UPDATE,
        }
      );

      // Create UserCleanerAppointments record (required for cleaner to see the job)
      const existingCleanerAppt = await UserCleanerAppointments.findOne({
        where: { appointmentId: existingAppt.id, employeeId: karin.id },
      });

      if (!existingCleanerAppt) {
        await UserCleanerAppointments.create({
          appointmentId: existingAppt.id,
          employeeId: karin.id,
        });
      }

      console.log("\nAppointment updated successfully!");
      console.log(`  ID: ${existingAppt.id}`);
      console.log(`  Date: ${todayStr}`);
      console.log(`  Price: $${existingAppt.price}`);
      console.log(`  Cleaner: ${karin.username || karin.firstName} (ID: ${karin.id})`);
      console.log(`  Status: Paid, Assigned, Ready for cleaning`);

      await sequelize.close();
      process.exit(0);
    }

    // Calculate price using the actual pricing service
    const bringSheets = raceLaneHome.sheetsProvided === "company" ? "yes" : "no";
    const bringTowels = raceLaneHome.towelsProvided === "company" ? "yes" : "no";
    const calculatedPrice = await calculatePrice(
      bringSheets,
      bringTowels,
      raceLaneHome.numBeds,
      raceLaneHome.numBaths,
      raceLaneHome.timeToBeCompleted || "anytime"
    );
    const price = calculatedPrice.toFixed(2);

    // Create the appointment
    const appointment = await UserAppointments.create({
      userId: gavin.id,
      homeId: raceLaneHome.id,
      date: todayStr,
      price: price,
      paid: true,
      bringTowels: bringTowels,
      bringSheets: bringSheets,
      keyPadCode: raceLaneHome.keyPadCode || null,
      keyLocation: raceLaneHome.keyLocation || null,
      completed: false,
      hasBeenAssigned: true,
      employeesAssigned: [String(karin.id)],
      empoyeesNeeded: raceLaneHome.cleanersNeeded || 1,
      timeToBeCompleted: raceLaneHome.timeToBeCompleted || "10am-3pm",
      paymentStatus: "captured",
      amountPaid: Math.round(parseFloat(price) * 100),
      manuallyPaid: false,
      paymentCaptureFailed: false,
      unassignedWarningSent: false,
    });

    // Update timestamps to simulate booking a week ago
    await sequelize.query(
      `UPDATE "UserAppointments" SET "createdAt" = :createdAt WHERE id = :id`,
      {
        replacements: { createdAt: oneWeekAgo, id: appointment.id },
        type: sequelize.QueryTypes.UPDATE,
      }
    );

    // Create UserCleanerAppointments record (required for cleaner to see the job)
    const existingCleanerAppt = await UserCleanerAppointments.findOne({
      where: { appointmentId: appointment.id, employeeId: karin.id },
    });

    if (!existingCleanerAppt) {
      await UserCleanerAppointments.create({
        appointmentId: appointment.id,
        employeeId: karin.id,
      });
    }

    console.log("\n✓ Test appointment created successfully!");
    console.log("─".repeat(50));
    console.log(`  Appointment ID: ${appointment.id}`);
    console.log(`  Date: ${todayStr} (today)`);
    console.log(`  Home: ${raceLaneHome.nickName}`);
    console.log(`  Homeowner: ${gavin.username || gavin.firstName} (ID: ${gavin.id})`);
    console.log(`  Cleaner: ${karin.username || karin.firstName} (ID: ${karin.id})`);
    console.log(`  Price: $${price}`);
    console.log(`  Status: Paid ✓, Assigned ✓, Ready for cleaning`);
    console.log(`  Booked: ${oneWeekAgo.toLocaleDateString()} (1 week ago)`);
    console.log("─".repeat(50));

    await sequelize.close();
    process.exit(0);
  } catch (error) {
    console.error("Error creating test appointment:", error);
    await sequelize.close();
    process.exit(1);
  }
}

addTestAppointment();
