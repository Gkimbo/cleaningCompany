/**
 * Backup Cleaner Timeout Job
 * Processes appointments where backup cleaner notifications have expired
 * without any cleaner accepting. Escalates to client for response.
 */

const { Op } = require("sequelize");
const models = require("../../models");
const PushNotification = require("../sendNotifications/PushNotificationClass");
const EncryptionService = require("../EncryptionService");

/**
 * Process expired backup cleaner notifications
 * Should be called by a scheduler (e.g., every hour)
 * @param {Object} io - Socket.io instance for real-time notifications
 * @returns {Object} Summary of processed timeouts
 */
async function processBackupCleanerTimeouts(io = null) {
	const { UserAppointments, UserHomes, User, Notification } = models;
	const now = new Date();
	let processed = 0;
	let errors = 0;

	try {
		// Find all appointments where:
		// - Backup cleaners were notified
		// - The notification has expired
		// - No cleaner has accepted yet (still unassigned)
		// - Client hasn't been notified yet
		const expiredBackups = await UserAppointments.findAll({
			where: {
				backupCleanersNotified: true,
				backupNotificationExpiresAt: {
					[Op.lt]: now,
				},
				clientResponsePending: false,
				hasBeenAssigned: false,
				openToMarket: false,
			},
			include: [
				{
					model: UserHomes,
					as: "home",
					attributes: ["id", "nickName", "address", "city", "preferredCleanerId"],
				},
				{
					model: User,
					as: "user",
					attributes: ["id", "firstName", "lastName", "email", "expoPushToken"],
				},
			],
		});

		console.log(`[BackupCleanerTimeoutJob] Found ${expiredBackups.length} expired backup notifications to process`);

		for (const appointment of expiredBackups) {
			try {
				// Escalate to client - mark as needing client response
				await appointment.update({
					clientResponsePending: true,
				});

				// Get client details
				const client = appointment.user;
				if (!client) {
					console.log(`[BackupCleanerTimeoutJob] No client found for appointment ${appointment.id}`);
					continue;
				}

				const clientFirstName = EncryptionService.decrypt(client.firstName) || "there";
				const homeAddress = appointment.home
					? `${EncryptionService.decrypt(appointment.home.address) || ""}, ${EncryptionService.decrypt(appointment.home.city) || ""}`
					: "your home";

				// Send push notification to client
				if (client.expoPushToken) {
					try {
						await PushNotification.sendPushNotification(
							client.expoPushToken,
							"Cleaner Unavailable",
							`No cleaners are available for your ${formatDate(appointment.date)} appointment. Tap to reschedule or open to other cleaners.`,
							{ type: "backup_cleaner_timeout", appointmentId: appointment.id }
						);
					} catch (pushErr) {
						console.error(`[BackupCleanerTimeoutJob] Push error for appointment ${appointment.id}:`, pushErr);
					}
				}

				// Send email notification
				if (client.email) {
					try {
						await sendTimeoutNotificationEmail(
							EncryptionService.decrypt(client.email),
							clientFirstName,
							appointment.date,
							homeAddress,
							appointment.id
						);
					} catch (emailErr) {
						console.error(`[BackupCleanerTimeoutJob] Email error for appointment ${appointment.id}:`, emailErr);
					}
				}

				// Create in-app notification if Notification model exists
				if (Notification) {
					try {
						await Notification.create({
							userId: client.id,
							type: "backup_timeout",
							title: "Action Required: No Cleaner Available",
							message: `Your preferred cleaners are unavailable for ${formatDate(appointment.date)}. Please choose to reschedule or open to other cleaners.`,
							relatedAppointmentId: appointment.id,
							actionRequired: true,
						});
					} catch (notifErr) {
						console.error(`[BackupCleanerTimeoutJob] Notification error for appointment ${appointment.id}:`, notifErr);
					}
				}

				processed++;
				console.log(`[BackupCleanerTimeoutJob] Escalated appointment ${appointment.id} to client ${client.id}`);
			} catch (error) {
				errors++;
				console.error(`[BackupCleanerTimeoutJob] Error processing appointment ${appointment.id}:`, error);
			}
		}

		const summary = {
			processed,
			errors,
			timestamp: now.toISOString(),
		};

		console.log(`[BackupCleanerTimeoutJob] Completed. Processed: ${processed}, Errors: ${errors}`);
		return summary;
	} catch (error) {
		console.error("[BackupCleanerTimeoutJob] Fatal error:", error);
		throw error;
	}
}

/**
 * Format date for display
 * @param {string} dateString - Date string
 * @returns {string} Formatted date
 */
function formatDate(dateString) {
	const date = new Date(dateString);
	return date.toLocaleDateString("en-US", {
		weekday: "short",
		month: "short",
		day: "numeric",
	});
}

/**
 * Send timeout notification email to client
 */
async function sendTimeoutNotificationEmail(email, clientName, appointmentDate, homeAddress, appointmentId) {
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

	const formattedDate = formatDate(appointmentDate);

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
        <h1 style="color: #ffffff; margin: 0; font-size: 28px; font-weight: 700;">No Cleaner Available</h1>
        <p style="color: rgba(255,255,255,0.9); margin: 10px 0 0 0; font-size: 16px;">Action needed for your appointment</p>
      </td>
    </tr>
    <tr>
      <td style="padding: 40px 30px;">
        <h2 style="color: #1e293b; margin: 0 0 20px 0; font-size: 22px;">Hi ${clientName}!</h2>
        <p style="color: #475569; font-size: 16px; line-height: 1.6;">
          Unfortunately, none of your preferred cleaners are available for your scheduled cleaning.
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

Unfortunately, none of your preferred cleaners are available for your scheduled cleaning.

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
		subject: `⚠️ No Cleaner Available for ${formattedDate}`,
		text: textContent,
		html: htmlContent,
	});
}

/**
 * Start the backup timeout job as a recurring interval
 * @param {Object} io - Socket.io instance
 * @param {number} intervalMs - Interval in milliseconds (default: 1 hour)
 * @returns {Object} Interval reference for cleanup
 */
function startBackupTimeoutJob(io, intervalMs = 60 * 60 * 1000) {
	console.log(`[BackupCleanerTimeoutJob] Starting backup timeout job (interval: ${intervalMs}ms)`);

	// Run immediately on start
	processBackupCleanerTimeouts(io).catch((err) => {
		console.error("[BackupCleanerTimeoutJob] Error on initial run:", err);
	});

	// Then run on interval
	const interval = setInterval(() => {
		processBackupCleanerTimeouts(io).catch((err) => {
			console.error("[BackupCleanerTimeoutJob] Error on interval run:", err);
		});
	}, intervalMs);

	return interval;
}

module.exports = {
	processBackupCleanerTimeouts,
	startBackupTimeoutJob,
};
