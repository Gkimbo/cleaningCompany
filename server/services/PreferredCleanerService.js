/**
 * PreferredCleanerService
 * Handles the preferred cleaner decline flow for business owner clients
 */

const Email = require("./sendNotifications/EmailClass");
const PushNotification = require("./sendNotifications/PushNotificationClass");
const EncryptionService = require("./EncryptionService");

// Helper to decrypt home fields
const decryptHomeField = (value) => {
  if (!value) return value;
  return EncryptionService.decrypt(value);
};

class PreferredCleanerService {
  /**
   * Business owner declines an appointment from their client
   * @param {number} appointmentId - The appointment ID
   * @param {number} cleanerId - The cleaner (business owner) ID
   * @param {Object} models - Sequelize models
   * @returns {Object} Result with updated appointment
   */
  static async declineAppointment(appointmentId, cleanerId, models) {
    const { UserAppointments, UserHomes, User, CleanerClient } = models;

    // Find the appointment with home details
    const appointment = await UserAppointments.findByPk(appointmentId, {
      include: [
        { model: UserHomes, as: "home" },
        { model: User, as: "user" },
      ],
    });

    if (!appointment) {
      throw new Error("Appointment not found");
    }

    // Verify this cleaner is the preferred cleaner for this home
    if (appointment.home.preferredCleanerId !== cleanerId) {
      throw new Error("You are not the preferred cleaner for this home");
    }

    // Check if already declined or assigned to someone else
    if (appointment.preferredCleanerDeclined) {
      throw new Error("This appointment has already been declined");
    }

    if (appointment.hasBeenAssigned && appointment.employeesAssigned?.length > 0) {
      throw new Error("This appointment is already assigned to cleaners");
    }

    // Get the cleaner's details for notifications
    const cleaner = await User.findByPk(cleanerId);

    // Update the appointment
    await appointment.update({
      preferredCleanerDeclined: true,
      declinedAt: new Date(),
      clientResponsePending: true,
    });

    // Send notification to the client
    const client = appointment.user;
    const cleanerName = `${cleaner.firstName} ${cleaner.lastName}`;
    const homeAddress = `${decryptHomeField(appointment.home.address)}, ${decryptHomeField(appointment.home.city)}`;

    try {
      // Email notification
      await this.sendDeclineNotificationEmail(
        client.email,
        client.firstName,
        cleanerName,
        appointment.date,
        homeAddress,
        appointment.id
      );

      // Push notification
      if (client.expoPushToken) {
        await PushNotification.sendPushNotification(
          client.expoPushToken,
          "Cleaner Unavailable",
          `${cleanerName} is unavailable for ${this.formatDate(appointment.date)}. Tap to reschedule or open to other cleaners.`,
          { type: "preferred_cleaner_declined", appointmentId: appointment.id }
        );
      }
    } catch (notifyErr) {
      console.error("Error sending decline notification:", notifyErr);
    }

    return {
      success: true,
      appointment: {
        id: appointment.id,
        date: appointment.date,
        clientResponsePending: true,
      },
    };
  }

  /**
   * Client responds to preferred cleaner declining
   * @param {number} appointmentId - The appointment ID
   * @param {number} userId - The client's user ID
   * @param {string} action - 'cancel' or 'open_to_market'
   * @param {Object} models - Sequelize models
   * @returns {Object} Result with updated appointment
   */
  static async clientRespond(appointmentId, userId, action, models) {
    const { UserAppointments, UserHomes, User } = models;
    const calculatePrice = require("./CalculatePrice");

    // Find the appointment
    const appointment = await UserAppointments.findByPk(appointmentId, {
      include: [
        { model: UserHomes, as: "home" },
        { model: User, as: "user" },
      ],
    });

    if (!appointment) {
      throw new Error("Appointment not found");
    }

    // Verify this is the client's appointment
    if (appointment.userId !== userId) {
      throw new Error("This is not your appointment");
    }

    // Verify we're waiting for client response
    if (!appointment.clientResponsePending) {
      throw new Error("No response is pending for this appointment");
    }

    if (action === "cancel") {
      // Cancel the appointment
      // Note: We're soft-deleting by just clearing the pending flag
      // In a real scenario you might want to handle refunds, etc.
      await appointment.update({
        clientResponsePending: false,
        // Mark as completed/cancelled - could add a 'cancelled' status if needed
      });

      // Actually destroy the appointment since it was never assigned
      await appointment.destroy();

      return {
        success: true,
        action: "cancelled",
        message: "Appointment has been cancelled",
      };
    } else if (action === "open_to_market") {
      // Calculate platform pricing
      const home = appointment.home;
      const platformPrice = await calculatePrice(
        home.numBeds,
        home.numBaths,
        appointment.bringSheets === "true",
        appointment.bringTowels === "true",
        home.bedConfigurations,
        home.bathroomConfigurations
      );

      // Store the original business owner price and switch to platform price
      await appointment.update({
        clientResponsePending: false,
        openToMarket: true,
        openedToMarketAt: new Date(),
        businessOwnerPrice: appointment.price,
        price: platformPrice.toString(),
        // Clear the preferred cleaner assignment so it shows up in the market
        hasBeenAssigned: false,
        employeesAssigned: [],
      });

      // Clear the preferred cleaner from the home for this appointment
      // (but keep it on the home for future appointments)

      return {
        success: true,
        action: "opened_to_market",
        message: "Appointment is now open to other cleaners",
        originalPrice: parseFloat(appointment.businessOwnerPrice),
        newPrice: platformPrice,
      };
    } else {
      throw new Error("Invalid action. Must be 'cancel' or 'open_to_market'");
    }
  }

  /**
   * Get appointments for a business owner's clients that need attention
   * @param {number} cleanerId - The cleaner (business owner) ID
   * @param {Object} models - Sequelize models
   * @returns {Object} Appointments grouped by status
   */
  static async getClientAppointments(cleanerId, models) {
    const { UserAppointments, UserHomes, User, CleanerClient } = models;
    const { Op } = require("sequelize");

    const today = new Date().toISOString().split("T")[0];

    // Get all homes where this cleaner is the preferred cleaner
    const homes = await UserHomes.findAll({
      where: { preferredCleanerId: cleanerId },
      attributes: ["id"],
    });

    const homeIds = homes.map((h) => h.id);

    if (homeIds.length === 0) {
      return { pending: [], declined: [], upcoming: [] };
    }

    // Get appointments for these homes
    const appointments = await UserAppointments.findAll({
      where: {
        homeId: { [Op.in]: homeIds },
        date: { [Op.gte]: today },
        openToMarket: false, // Only show appointments not yet on open market
      },
      include: [
        { model: UserHomes, as: "home" },
        { model: User, as: "user", attributes: ["id", "firstName", "lastName", "email"] },
      ],
      order: [["date", "ASC"]],
    });

    // Group appointments
    const pending = []; // Need cleaner to accept or decline
    const declined = []; // Declined, waiting for client response
    const upcoming = []; // Accepted/confirmed

    for (const apt of appointments) {
      const aptData = {
        id: apt.id,
        date: apt.date,
        price: apt.price,
        timeWindow: apt.timeToBeCompleted,
        client: {
          id: apt.user.id,
          name: `${apt.user.firstName} ${apt.user.lastName}`,
        },
        home: {
          id: apt.home.id,
          nickName: apt.home.nickName,
          address: `${decryptHomeField(apt.home.address)}, ${decryptHomeField(apt.home.city)}`,
          beds: apt.home.numBeds,
          baths: apt.home.numBaths,
        },
      };

      if (apt.preferredCleanerDeclined) {
        if (apt.clientResponsePending) {
          declined.push({ ...aptData, awaitingClientResponse: true });
        }
        // If not pending, it was either cancelled or opened to market
      } else if (apt.hasBeenAssigned && apt.employeesAssigned?.includes(cleanerId.toString())) {
        upcoming.push(aptData);
      } else {
        // Not yet accepted or declined - pending action
        pending.push(aptData);
      }
    }

    return { pending, declined, upcoming };
  }

  /**
   * Business owner accepts an appointment from their client
   * @param {number} appointmentId - The appointment ID
   * @param {number} cleanerId - The cleaner (business owner) ID
   * @param {Object} models - Sequelize models
   * @returns {Object} Result with updated appointment
   */
  static async acceptAppointment(appointmentId, cleanerId, models) {
    const { UserAppointments, UserHomes, User, UserCleanerAppointments } = models;

    // Find the appointment with home details
    const appointment = await UserAppointments.findByPk(appointmentId, {
      include: [
        { model: UserHomes, as: "home" },
        { model: User, as: "user" },
      ],
    });

    if (!appointment) {
      throw new Error("Appointment not found");
    }

    // Verify this cleaner is the preferred cleaner for this home
    if (appointment.home.preferredCleanerId !== cleanerId) {
      throw new Error("You are not the preferred cleaner for this home");
    }

    // Check if already declined or assigned
    if (appointment.preferredCleanerDeclined) {
      throw new Error("This appointment has been declined");
    }

    if (appointment.hasBeenAssigned) {
      throw new Error("This appointment is already assigned");
    }

    // Assign the cleaner to this appointment
    await appointment.update({
      hasBeenAssigned: true,
      employeesAssigned: [cleanerId.toString()],
    });

    // Create the UserCleanerAppointments record
    await UserCleanerAppointments.create({
      appointmentId: appointment.id,
      employeeId: cleanerId,
    });

    // Notify the client
    const client = appointment.user;
    const cleaner = await User.findByPk(cleanerId);
    const cleanerName = `${cleaner.firstName} ${cleaner.lastName}`;

    try {
      if (client.expoPushToken) {
        await PushNotification.sendPushConfirmation(
          client.expoPushToken,
          client.firstName,
          appointment.date,
          { street: decryptHomeField(appointment.home.address), city: decryptHomeField(appointment.home.city) }
        );
      }
    } catch (notifyErr) {
      console.error("Error sending confirmation notification:", notifyErr);
    }

    return {
      success: true,
      appointment: {
        id: appointment.id,
        date: appointment.date,
        assigned: true,
      },
    };
  }

  // Helper methods

  static formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
    });
  }

  static async sendDeclineNotificationEmail(
    email,
    clientName,
    cleanerName,
    appointmentDate,
    homeAddress,
    appointmentId
  ) {
    const nodemailer = require("nodemailer");

    const transporter = nodemailer.createTransport({
      host: "smtp.gmail.com",
      port: 587,
      secure: false,
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });

    const formattedDate = this.formatDate(appointmentDate);

    const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f5f7fa;">
  <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 600px; margin: 0 auto; background-color: #ffffff;">
    <tr>
      <td style="background: linear-gradient(135deg, #f59e0b 0%, #fbbf24 100%); padding: 40px 30px; text-align: center;">
        <h1 style="color: #ffffff; margin: 0; font-size: 28px; font-weight: 700;">Cleaner Unavailable</h1>
        <p style="color: rgba(255,255,255,0.9); margin: 10px 0 0 0; font-size: 16px;">Action needed for your appointment</p>
      </td>
    </tr>
    <tr>
      <td style="padding: 40px 30px;">
        <h2 style="color: #1e293b; margin: 0 0 20px 0; font-size: 22px;">Hi ${clientName}!</h2>
        <p style="color: #475569; font-size: 16px; line-height: 1.6;">
          Unfortunately, <strong>${cleanerName}</strong> is not available for your scheduled cleaning.
        </p>

        <div style="background-color: #fef3c7; border: 2px solid #f59e0b; border-radius: 12px; padding: 25px; margin: 25px 0;">
          <h3 style="color: #92400e; margin: 0 0 15px 0; font-size: 18px;">📅 Appointment Details</h3>
          <div style="padding: 8px 0; border-bottom: 1px solid #fcd34d;">
            <span style="color: #92400e; font-size: 14px;">Date:</span>
            <span style="color: #78350f; font-size: 15px; font-weight: 600; margin-left: 8px;">${formattedDate}</span>
          </div>
          <div style="padding: 8px 0;">
            <span style="color: #92400e; font-size: 14px;">Address:</span>
            <span style="color: #78350f; font-size: 15px; font-weight: 600; margin-left: 8px;">${homeAddress}</span>
          </div>
        </div>

        <h3 style="color: #1e293b; margin: 30px 0 15px 0; font-size: 18px;">What would you like to do?</h3>
        <p style="color: #475569; font-size: 15px; line-height: 1.8;">
          Please open the Kleanr app to choose one of these options:
        </p>
        <ol style="color: #475569; font-size: 15px; line-height: 1.8; margin: 0; padding-left: 20px;">
          <li style="margin-bottom: 8px;"><strong>Cancel</strong> - Cancel this appointment</li>
          <li style="margin-bottom: 8px;"><strong>Open to Other Cleaners</strong> - Let other available cleaners request this job (platform pricing will apply)</li>
        </ol>

        <div style="text-align: center; margin: 30px 0;">
          <p style="color: #475569; font-size: 15px; margin: 0;">
            Log into the Kleanr app to respond.
          </p>
        </div>
      </td>
    </tr>
    <tr>
      <td style="background-color: #1e293b; padding: 30px; text-align: center;">
        <p style="color: #94a3b8; font-size: 14px; margin: 0 0 10px 0;">
          We're here to help! 🧹✨
        </p>
        <p style="color: #64748b; font-size: 12px; margin: 0;">
          © ${new Date().getFullYear()} Kleanr. All rights reserved.
        </p>
      </td>
    </tr>
  </table>
</body>
</html>`;

    const textContent = `Hi ${clientName}!

Unfortunately, ${cleanerName} is not available for your scheduled cleaning.

APPOINTMENT DETAILS
━━━━━━━━━━━━━━━━━━━━━━
Date: ${formattedDate}
Address: ${homeAddress}

WHAT WOULD YOU LIKE TO DO?
━━━━━━━━━━━━━━━━━━━━━━
Please open the Kleanr app to choose one of these options:

1. Cancel - Cancel this appointment
2. Open to Other Cleaners - Let other available cleaners request this job (platform pricing will apply)

Log into the Kleanr app to respond.

Best regards,
The Kleanr Team`;

    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: email,
      subject: `⚠️ ${cleanerName} is unavailable for ${formattedDate}`,
      text: textContent,
      html: htmlContent,
    });
  }
}

module.exports = PreferredCleanerService;
