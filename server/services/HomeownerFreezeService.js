const {
	User,
	UserAppointments,
	UserCleanerAppointments,
	UserHomes,
	UserPendingRequests,
	RecurringSchedule,
	Payout,
	Notification,
	MultiCleanerJob,
	CleanerJoinRequest,
	CleanerJobOffer,
	CleanerRoomAssignment,
	CleanerJobCompletion,
	EmployeeJobAssignment,
} = require("../models");
const { Op } = require("sequelize");
const NotificationService = require("./NotificationService");
const Email = require("./sendNotifications/EmailClass");
const EncryptionService = require("./EncryptionService");

// Helper to safely decrypt a field
const safeDecrypt = (value) => {
	if (!value) return null;
	try {
		return EncryptionService.decrypt(value);
	} catch (error) {
		return "[encrypted]";
	}
};

/**
 * Service for handling homeowner account freeze/unfreeze/warning operations
 *
 * Freeze triggers:
 * - Manual freeze by owner/HR
 * - Auto-freeze after 3 warnings (payment failures, false claims, appeal abuse)
 * - Suspicious activity report action
 *
 * When frozen:
 * - Appointments within 7 days are cancelled (cleaner assignments removed, no cleaner notifications)
 * - Appointments beyond 7 days are paused (hidden from cleaners, no notifications)
 * - Recurring schedules are paused
 * - Homes are hidden from marketplace
 * - Homeowner is notified of all changes
 */
class HomeownerFreezeService {
	/**
	 * Issue a warning to a homeowner
	 * After 3 warnings, the account is automatically frozen
	 *
	 * @param {number} homeownerId - The homeowner's user ID
	 * @param {string} reason - Reason for the warning
	 * @param {number} issuedById - User ID of who issued the warning
	 * @param {Object} io - Socket.io instance for real-time notifications
	 * @returns {Object} { warned: boolean, frozen: boolean, warningCount: number }
	 */
	static async issueWarning(homeownerId, reason, issuedById, io = null) {
		const homeowner = await User.findByPk(homeownerId);
		if (!homeowner) {
			throw new Error("Homeowner not found");
		}

		// Verify this is a homeowner (type 'client' or 'homeowner')
		if (!["client", "homeowner"].includes(homeowner.type)) {
			throw new Error("User is not a homeowner");
		}

		// Already frozen - no warning needed
		if (homeowner.accountFrozen) {
			return { warned: false, frozen: true, warningCount: homeowner.warningCount };
		}

		// Increment warning count
		const newWarningCount = (homeowner.warningCount || 0) + 1;
		await homeowner.update({ warningCount: newWarningCount });

		// Send warning notification
		const warningNumber = newWarningCount;
		const maxWarnings = 3;
		const isFinalWarning = warningNumber === maxWarnings - 1;
		const shouldFreeze = newWarningCount >= maxWarnings;

		if (!shouldFreeze) {
			// Send warning notification to homeowner
			try {
				const title = isFinalWarning ? "Final Warning" : "Account Warning";
				const body = `Warning ${warningNumber}/${maxWarnings}: ${reason}. ${
					isFinalWarning
						? "One more violation will result in account suspension."
						: "Additional violations may result in account suspension."
				}`;

				await NotificationService.notifyUser({
					userId: homeownerId,
					type: "account_warning",
					title,
					body,
					data: {
						warningCount: newWarningCount,
						reason,
						issuedById,
					},
					actionRequired: false,
					sendPush: true,
					sendEmail: true,
					emailOptions: {
						sendFunction: Email.sendAccountWarningEmail,
						args: [warningNumber, maxWarnings, reason, isFinalWarning],
					},
					io,
				});
			} catch (notifyError) {
				console.error("[HomeownerFreezeService] Warning notification failed:", notifyError);
			}

			return { warned: true, frozen: false, warningCount: newWarningCount };
		}

		// Third warning - auto-freeze
		await this.freezeHomeowner(homeownerId, `Auto-freeze after ${maxWarnings} warnings. Final warning reason: ${reason}`, issuedById, io);

		return { warned: true, frozen: true, warningCount: newWarningCount };
	}

	/**
	 * Freeze a homeowner's account
	 *
	 * @param {number} homeownerId - The homeowner's user ID
	 * @param {string} reason - Reason for freezing
	 * @param {number} frozenById - User ID of who froze the account
	 * @param {Object} io - Socket.io instance for real-time notifications
	 * @returns {Object} { frozen: boolean, appointmentsCancelled: number, appointmentsPaused: number }
	 */
	static async freezeHomeowner(homeownerId, reason, frozenById, io = null) {
		const homeowner = await User.findByPk(homeownerId);
		if (!homeowner) {
			throw new Error("Homeowner not found");
		}

		// Verify this is a homeowner
		if (!["client", "homeowner"].includes(homeowner.type)) {
			throw new Error("User is not a homeowner");
		}

		// Already frozen
		if (homeowner.accountFrozen) {
			return { frozen: true, appointmentsCancelled: 0, appointmentsPaused: 0, alreadyFrozen: true };
		}

		// 1. Freeze the account
		await homeowner.update({
			accountFrozen: true,
			accountFrozenAt: new Date(),
			accountFrozenReason: reason,
		});

		// 2. Get all future appointments for this homeowner
		const now = new Date();
		const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
		const todayStr = now.toISOString().split("T")[0];
		const sevenDaysStr = sevenDaysFromNow.toISOString().split("T")[0];

		// Get all homes owned by this homeowner
		const homes = await UserHomes.findAll({
			where: { userId: homeownerId },
			attributes: ["id"],
		});
		const homeIds = homes.map((h) => h.id);

		let appointmentsCancelled = 0;
		let appointmentsPaused = 0;
		const cancelledAppointmentDetails = [];

		if (homeIds.length > 0) {
			// Find all uncompleted, non-cancelled future appointments
			const allAppointments = await UserAppointments.findAll({
				where: {
					homeId: { [Op.in]: homeIds },
					date: { [Op.gte]: todayStr },
					completed: false,
					wasCancelled: false,
				},
				include: [
					{ model: UserHomes, as: "home", attributes: ["address", "city", "state"] },
				],
			});

			// Separate appointments into within 7 days (cancel) vs beyond (pause)
			const appointmentsToCancel = [];
			const appointmentsToPause = [];

			for (const appt of allAppointments) {
				if (appt.date <= sevenDaysStr) {
					appointmentsToCancel.push(appt);
				} else {
					appointmentsToPause.push(appt);
				}
			}

			// 3a. Cancel appointments within 7 days
			for (const appt of appointmentsToCancel) {
				try {
					// Remove cleaner assignments (no notification to cleaners)
					await UserCleanerAppointments.destroy({
						where: { appointmentId: appt.id },
					});

					// Remove pending requests
					await UserPendingRequests.destroy({
						where: { appointmentId: appt.id },
					});

					// Delete pending payouts
					await Payout.destroy({
						where: {
							appointmentId: appt.id,
							status: "pending",
						},
					});

					// Remove employee job assignments if this was a business employee job
					if (appt.assignedToBusinessEmployee) {
						await EmployeeJobAssignment.destroy({
							where: { appointmentId: appt.id },
						});
					}

					// Cancel multi-cleaner job if exists
					if (appt.isMultiCleanerJob && appt.multiCleanerJobId) {
						try {
							await MultiCleanerJob.update(
								{ status: "cancelled" },
								{ where: { id: appt.multiCleanerJobId } }
							);
							// Clean up join requests, offers, room assignments, and completion records
							await CleanerJoinRequest.destroy({
								where: { multiCleanerJobId: appt.multiCleanerJobId },
							});
							await CleanerJobOffer.destroy({
								where: { multiCleanerJobId: appt.multiCleanerJobId },
							});
							await CleanerRoomAssignment.destroy({
								where: { multiCleanerJobId: appt.multiCleanerJobId },
							});
							await CleanerJobCompletion.destroy({
								where: { multiCleanerJobId: appt.multiCleanerJobId },
							});
						} catch (mcjError) {
							console.error(`[HomeownerFreezeService] Failed to cancel multi-cleaner job ${appt.multiCleanerJobId}:`, mcjError);
						}
					}

					// Mark appointment as cancelled
					await appt.update({
						wasCancelled: true,
						cancellationType: "system",
						cancellationReason: "Homeowner account suspended",
						cancellationConfirmedAt: new Date(),
						hasBeenAssigned: false,
						employeesAssigned: null,
					});

					appointmentsCancelled++;

					// Track for notification (decrypt address for display)
					cancelledAppointmentDetails.push({
						date: appt.date,
						address: appt.home ? `${safeDecrypt(appt.home.address)}, ${safeDecrypt(appt.home.city)}` : "Unknown",
					});
				} catch (cancelError) {
					console.error(`[HomeownerFreezeService] Failed to cancel appointment ${appt.id}:`, cancelError);
				}
			}

			// 3b. Pause appointments beyond 7 days
			for (const appt of appointmentsToPause) {
				try {
					await appt.update({
						isPaused: true,
						pausedAt: new Date(),
						pauseReason: "homeowner_account_frozen",
					});

					// Pause multi-cleaner job if exists (so notifications aren't sent)
					if (appt.isMultiCleanerJob && appt.multiCleanerJobId) {
						try {
							await MultiCleanerJob.update(
								{ status: "paused" },
								{ where: { id: appt.multiCleanerJobId } }
							);
						} catch (mcjError) {
							console.error(`[HomeownerFreezeService] Failed to pause multi-cleaner job ${appt.multiCleanerJobId}:`, mcjError);
						}
					}

					appointmentsPaused++;
				} catch (pauseError) {
					console.error(`[HomeownerFreezeService] Failed to pause appointment ${appt.id}:`, pauseError);
				}
			}
		}

		// 4. Pause all recurring schedules
		const recurringSchedulesPaused = await RecurringSchedule.update(
			{ isPaused: true, pauseReason: "homeowner_account_frozen" },
			{ where: { clientId: homeownerId, isPaused: false } }
		);

		// 5. Disable marketplace visibility on all homes
		if (homeIds.length > 0) {
			await UserHomes.update(
				{ isMarketplaceEnabled: false },
				{ where: { id: { [Op.in]: homeIds } } }
			);
		}

		// 6. Notify homeowner
		try {
			let body = `Your account has been suspended. Reason: ${reason}`;
			if (appointmentsCancelled > 0 || appointmentsPaused > 0) {
				body += ` ${appointmentsCancelled} appointment(s) cancelled, ${appointmentsPaused} appointment(s) paused.`;
			}
			body += " You may submit an appeal if you believe this is an error.";

			await NotificationService.notifyUser({
				userId: homeownerId,
				type: "account_frozen",
				title: "Account Suspended",
				body,
				data: {
					reason,
					frozenById,
					appointmentsCancelled,
					appointmentsPaused,
					cancelledAppointments: cancelledAppointmentDetails,
				},
				actionRequired: true,
				sendPush: true,
				sendEmail: true,
				emailOptions: {
					sendFunction: Email.sendAccountFrozenEmail,
					args: [reason, appointmentsCancelled, appointmentsPaused, cancelledAppointmentDetails],
				},
				io,
			});
		} catch (notifyError) {
			console.error("[HomeownerFreezeService] Freeze notification failed:", notifyError);
		}

		console.log(
			`[HomeownerFreezeService] Homeowner ${homeownerId} frozen. ` +
			`Cancelled: ${appointmentsCancelled}, Paused: ${appointmentsPaused}, ` +
			`Recurring paused: ${recurringSchedulesPaused[0]}`
		);

		return {
			frozen: true,
			appointmentsCancelled,
			appointmentsPaused,
			recurringSchedulesPaused: recurringSchedulesPaused[0],
		};
	}

	/**
	 * Unfreeze a homeowner's account
	 *
	 * @param {number} homeownerId - The homeowner's user ID
	 * @param {number} unfrozenById - User ID of who unfroze the account
	 * @param {Object} io - Socket.io instance for real-time notifications
	 * @returns {Object} { unfrozen: boolean, appointmentsResumed: number }
	 */
	static async unfreezeHomeowner(homeownerId, unfrozenById, io = null) {
		const homeowner = await User.findByPk(homeownerId);
		if (!homeowner) {
			throw new Error("Homeowner not found");
		}

		// Verify this is a homeowner
		if (!["client", "homeowner"].includes(homeowner.type)) {
			throw new Error("User is not a homeowner");
		}

		// Not frozen
		if (!homeowner.accountFrozen) {
			return { unfrozen: true, appointmentsResumed: 0, wasNotFrozen: true };
		}

		// 1. Unfreeze the account
		await homeowner.update({
			accountFrozen: false,
			accountFrozenAt: null,
			accountFrozenReason: null,
			warningCount: 0, // Reset warnings on unfreeze
		});

		// 2. Get all homes owned by this homeowner
		const homes = await UserHomes.findAll({
			where: { userId: homeownerId },
			attributes: ["id"],
		});
		const homeIds = homes.map((h) => h.id);

		let appointmentsResumed = 0;

		if (homeIds.length > 0) {
			// 3. Find paused appointments with multi-cleaner jobs to resume them
			const todayStr = new Date().toISOString().split("T")[0];
			const pausedAppointments = await UserAppointments.findAll({
				where: {
					homeId: { [Op.in]: homeIds },
					isPaused: true,
					pauseReason: "homeowner_account_frozen",
					date: { [Op.gte]: todayStr },
					wasCancelled: false,
				},
				attributes: ["id", "multiCleanerJobId", "isMultiCleanerJob"],
			});

			// Resume paused multi-cleaner jobs with correct status
			const multiCleanerJobIds = pausedAppointments
				.filter((a) => a.isMultiCleanerJob && a.multiCleanerJobId)
				.map((a) => a.multiCleanerJobId);

			if (multiCleanerJobIds.length > 0) {
				// For each multi-cleaner job, determine if it should be "open" or "partially_filled"
				for (const jobId of multiCleanerJobIds) {
					// Check if there are active cleaner completions for this job
					const activeCompletions = await CleanerJobCompletion.count({
						where: {
							multiCleanerJobId: jobId,
							status: { [Op.notIn]: ["dropped_out", "no_show"] },
						},
					});

					const newStatus = activeCompletions > 0 ? "partially_filled" : "open";
					await MultiCleanerJob.update(
						{ status: newStatus },
						{ where: { id: jobId, status: "paused" } }
					);
				}
			}

			// Resume the appointments
			const [resumedCount] = await UserAppointments.update(
				{
					isPaused: false,
					pausedAt: null,
					pauseReason: null,
				},
				{
					where: {
						homeId: { [Op.in]: homeIds },
						isPaused: true,
						pauseReason: "homeowner_account_frozen",
						date: { [Op.gte]: todayStr },
						wasCancelled: false,
					},
				}
			);
			appointmentsResumed = resumedCount;
		}

		// 4. Resume paused recurring schedules (only those paused due to freeze)
		const [recurringResumed] = await RecurringSchedule.update(
			{ isPaused: false, pauseReason: null },
			{ where: { clientId: homeownerId, isPaused: true, pauseReason: "homeowner_account_frozen" } }
		);

		// 5. Note: We do NOT automatically re-enable marketplace visibility on homes
		// The homeowner may have intentionally disabled it before freeze, so they should manually re-enable
		// We just notify them they can do so

		// 6. Notify homeowner
		try {
			let body = "Your account has been restored.";
			if (appointmentsResumed > 0) {
				body += ` ${appointmentsResumed} paused appointment(s) have been resumed.`;
			}
			body += " Your homes are still hidden from the marketplace - visit each home's settings to re-enable if desired.";
			body += " Thank you for your patience.";

			await NotificationService.notifyUser({
				userId: homeownerId,
				type: "account_unfrozen",
				title: "Account Restored",
				body,
				data: {
					unfrozenById,
					appointmentsResumed,
				},
				actionRequired: false,
				sendPush: true,
				sendEmail: true,
				emailOptions: {
					sendFunction: Email.sendAccountUnfrozenEmail,
					args: [appointmentsResumed],
				},
				io,
			});
		} catch (notifyError) {
			console.error("[HomeownerFreezeService] Unfreeze notification failed:", notifyError);
		}

		console.log(
			`[HomeownerFreezeService] Homeowner ${homeownerId} unfrozen. ` +
			`Appointments resumed: ${appointmentsResumed}, Recurring resumed: ${recurringResumed}`
		);

		return {
			unfrozen: true,
			appointmentsResumed,
			recurringSchedulesResumed: recurringResumed,
		};
	}

	/**
	 * Check if a homeowner should be auto-frozen based on violations
	 * Called from various services when violations occur
	 *
	 * @param {number} homeownerId - The homeowner's user ID
	 * @param {string} violationType - Type of violation (payment_failure, false_claim, appeal_abuse)
	 * @param {number} triggeredById - User/system ID that triggered the check
	 * @param {Object} io - Socket.io instance
	 * @returns {Object} { warned: boolean, frozen: boolean }
	 */
	static async checkAndWarnHomeowner(homeownerId, violationType, triggeredById, io = null) {
		const homeowner = await User.findByPk(homeownerId);
		if (!homeowner || homeowner.accountFrozen) {
			return { warned: false, frozen: homeowner?.accountFrozen || false };
		}

		// Map violation types to human-readable reasons
		const reasonMap = {
			payment_failure: "Repeated payment failures",
			false_claim: "False home size or damage claim",
			appeal_abuse: "Excessive appeal submissions",
		};

		const reason = reasonMap[violationType] || violationType;

		return this.issueWarning(homeownerId, reason, triggeredById, io);
	}

	/**
	 * Get freeze statistics for a homeowner
	 *
	 * @param {number} homeownerId - The homeowner's user ID
	 * @returns {Object} Statistics about the homeowner's account status
	 */
	static async getFreezeStatus(homeownerId) {
		const homeowner = await User.findByPk(homeownerId, {
			attributes: ["id", "accountFrozen", "accountFrozenAt", "accountFrozenReason", "warningCount"],
		});

		if (!homeowner) {
			throw new Error("Homeowner not found");
		}

		// Count paused appointments
		const homes = await UserHomes.findAll({
			where: { userId: homeownerId },
			attributes: ["id"],
		});
		const homeIds = homes.map((h) => h.id);

		let pausedAppointments = 0;
		if (homeIds.length > 0) {
			pausedAppointments = await UserAppointments.count({
				where: {
					homeId: { [Op.in]: homeIds },
					isPaused: true,
					pauseReason: "homeowner_account_frozen",
				},
			});
		}

		return {
			isFrozen: homeowner.accountFrozen,
			frozenAt: homeowner.accountFrozenAt,
			frozenReason: homeowner.accountFrozenReason,
			warningCount: homeowner.warningCount || 0,
			pausedAppointments,
		};
	}
}

module.exports = HomeownerFreezeService;
