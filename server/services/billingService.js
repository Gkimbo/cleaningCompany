/**
 * BillingService
 * Handles automated billing, invoicing, and payment processing for cleaner-booked appointments
 */

const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);

class BillingService {
  /**
   * Process auto-payment for a cleaner-booked appointment
   * Called when the cleaner marks the job as complete
   * @param {Object} appointment - The appointment record
   * @param {Object} models - Sequelize models
   * @returns {Object} { success, paymentIntent, error }
   */
  static async processAutoPayment(appointment, models) {
    const { User, UserBills } = models;

    try {
      // Verify this is a cleaner-booked appointment with auto-pay enabled
      if (!appointment.bookedByCleanerId) {
        return { success: false, error: "Not a cleaner-booked appointment" };
      }

      if (!appointment.autoPayEnabled) {
        return { success: false, error: "Auto-pay is not enabled for this appointment" };
      }

      // Already paid?
      if (appointment.paid && appointment.paymentStatus === "captured") {
        return { success: true, alreadyPaid: true };
      }

      // Get the client (homeowner)
      const client = await User.findByPk(appointment.userId);
      if (!client) {
        return { success: false, error: "Client not found" };
      }

      // Get client's default payment method
      if (!client.stripeCustomerId) {
        return { success: false, error: "Client does not have Stripe customer ID" };
      }

      const customer = await stripe.customers.retrieve(client.stripeCustomerId);
      const defaultPaymentMethod = customer.invoice_settings?.default_payment_method ||
                                   customer.default_source;

      if (!defaultPaymentMethod) {
        return { success: false, error: "Client does not have a default payment method" };
      }

      // Calculate amount in cents
      const priceInCents = Math.round(parseFloat(appointment.price) * 100);

      let paymentIntent;

      // If payment intent already exists, capture it
      if (appointment.paymentIntentId) {
        try {
          paymentIntent = await stripe.paymentIntents.capture(appointment.paymentIntentId);
        } catch (captureError) {
          // If capture fails, try creating a new payment
          if (captureError.code === "payment_intent_unexpected_state") {
            paymentIntent = await this.createAndConfirmPayment(
              client.stripeCustomerId,
              defaultPaymentMethod,
              priceInCents,
              appointment
            );
          } else {
            throw captureError;
          }
        }
      } else {
        // Create and confirm new payment intent
        paymentIntent = await this.createAndConfirmPayment(
          client.stripeCustomerId,
          defaultPaymentMethod,
          priceInCents,
          appointment
        );
      }

      // Update appointment with payment info
      await appointment.update({
        paymentIntentId: paymentIntent.id,
        paymentStatus: "captured",
        paid: true,
        amountPaid: paymentIntent.amount_received || paymentIntent.amount,
        paymentCaptureFailed: false,
      });

      // Update user bills
      const userBill = await UserBills.findOne({
        where: { userId: appointment.userId },
      });

      if (userBill) {
        const paidAmount = (paymentIntent.amount_received || paymentIntent.amount) / 100;
        await userBill.update({
          appointmentPaid: parseFloat(userBill.appointmentPaid || 0) + paidAmount,
          totalPaid: parseFloat(userBill.totalPaid || 0) + paidAmount,
          appointmentDue: Math.max(0, parseFloat(userBill.appointmentDue || 0) - paidAmount),
          totalDue: Math.max(0, parseFloat(userBill.totalDue || 0) - paidAmount),
        });
      }

      // Record the payment transaction
      await this.recordPaymentTransaction(models, {
        type: "capture",
        status: "succeeded",
        amount: paymentIntent.amount_received || paymentIntent.amount,
        userId: appointment.userId,
        appointmentId: appointment.id,
        stripePaymentIntentId: paymentIntent.id,
        stripeChargeId: paymentIntent.latest_charge,
        description: "Auto-payment for cleaner-booked appointment",
      });

      return {
        success: true,
        paymentIntent,
        amountCharged: (paymentIntent.amount_received || paymentIntent.amount) / 100,
      };
    } catch (error) {
      console.error("Error processing auto-payment:", error);

      // Mark payment as failed
      await appointment.update({
        paymentCaptureFailed: true,
        paymentStatus: "failed",
      });

      return {
        success: false,
        error: error.message || "Payment processing failed",
      };
    }
  }

  /**
   * Create and confirm a payment intent
   */
  static async createAndConfirmPayment(customerId, paymentMethod, amount, appointment) {
    return stripe.paymentIntents.create({
      amount,
      currency: "usd",
      customer: customerId,
      payment_method: paymentMethod,
      confirm: true,
      off_session: true,
      metadata: {
        appointmentId: appointment.id.toString(),
        userId: appointment.userId.toString(),
        homeId: appointment.homeId.toString(),
        bookedByCleanerId: appointment.bookedByCleanerId?.toString(),
        autoPayment: "true",
      },
    });
  }

  /**
   * Record a payment transaction
   */
  static async recordPaymentTransaction(models, transactionData) {
    const { Payment } = models;

    const taxYear = new Date().getFullYear();

    await Payment.create({
      transactionId: `txn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type: transactionData.type,
      status: transactionData.status,
      amount: transactionData.amount,
      currency: "usd",
      userId: transactionData.userId,
      cleanerId: transactionData.cleanerId,
      appointmentId: transactionData.appointmentId,
      payoutId: transactionData.payoutId,
      stripePaymentIntentId: transactionData.stripePaymentIntentId,
      stripeTransferId: transactionData.stripeTransferId,
      stripeChargeId: transactionData.stripeChargeId,
      platformFeeAmount: transactionData.platformFeeAmount,
      netAmount: transactionData.netAmount,
      taxYear,
      reportable: transactionData.type === "payout" && transactionData.status === "succeeded",
      reported: false,
      description: transactionData.description,
      metadata: transactionData.metadata,
      processedAt: transactionData.status === "succeeded" ? new Date() : null,
    });
  }

  /**
   * Process cleaner payout after payment is captured
   */
  static async processCleanerPayout(appointment, models) {
    const { StripeConnectAccount, Payout, EmployeeJobAssignment, BusinessEmployee } = models;
    const { getPricingConfig } = require("../config/businessConfig");
    const PreferredCleanerPerksService = require("./PreferredCleanerPerksService");
    const BusinessVolumeService = require("./BusinessVolumeService");

    try {
      const pricing = await getPricingConfig();
      // Base platform fee percentages from database config
      const regularFeePercent = pricing.platform?.feePercent || 0.10;
      const businessOwnerFeePercent = pricing.platform?.businessOwnerFeePercent || regularFeePercent;
      const largeBusinessFeePercent = pricing.platform?.largeBusinessFeePercent || 0.07;

      const cleanerIds = appointment.employeesAssigned || [];
      if (cleanerIds.length === 0) {
        return { success: false, error: "No cleaners assigned" };
      }

      const priceInCents = appointment.amountPaid || Math.round(parseFloat(appointment.price) * 100);
      const perCleanerGross = Math.round(priceInCents / cleanerIds.length);

      const payoutResults = [];

      for (const cleanerIdStr of cleanerIds) {
        const cleanerId = parseInt(cleanerIdStr, 10);

        const connectAccount = await StripeConnectAccount.findOne({
          where: { userId: cleanerId },
        });

        if (!connectAccount || !connectAccount.stripeAccountId) {
          payoutResults.push({ cleanerId, success: false, error: "No Stripe Connect account" });
          continue;
        }

        // Determine appropriate fee: check if cleaner is a business employee for this job
        let platformFeePercent = regularFeePercent;
        let businessOwnerId = null;
        const employeeAssignment = await EmployeeJobAssignment.findOne({
          where: { appointmentId: appointment.id },
          include: [{ model: BusinessEmployee, as: "employee", where: { userId: cleanerId } }],
        });

        if (employeeAssignment) {
          businessOwnerId = employeeAssignment.businessOwnerId;
          // Check if this business qualifies for large business discount
          const qualification = await BusinessVolumeService.qualifiesForLargeBusinessFee(businessOwnerId);
          if (qualification.qualifies) {
            platformFeePercent = largeBusinessFeePercent;
          } else {
            // Standard business owner fee
            platformFeePercent = businessOwnerFeePercent;
          }
        }

        let payout = await Payout.findOne({
          where: { appointmentId: appointment.id, cleanerId },
        });

        // Calculate preferred cleaner bonus if applicable
        const bonusInfo = await PreferredCleanerPerksService.calculatePayoutBonus(
          cleanerId,
          appointment.homeId,
          perCleanerGross,
          platformFeePercent * 100, // Convert to percentage for this service
          models
        );

        const platformFee = bonusInfo.adjustedPlatformFee;
        const netAmount = bonusInfo.adjustedNetAmount;

        if (payout) {
          await payout.update({
            amount: netAmount / 100,
            platformFee: platformFee / 100,
            status: "processing",
            // Preferred perk fields
            isPreferredHomeJob: bonusInfo.isPreferredJob,
            preferredBonusApplied: bonusInfo.bonusApplied,
            preferredBonusPercent: bonusInfo.bonusApplied ? bonusInfo.bonusPercent : null,
            preferredBonusAmount: bonusInfo.bonusApplied ? bonusInfo.bonusAmountCents : null,
            cleanerTierAtPayout: bonusInfo.tierLevel,
          });
        } else {
          payout = await Payout.create({
            appointmentId: appointment.id,
            cleanerId,
            amount: netAmount / 100,
            platformFee: platformFee / 100,
            status: "processing",
            // Preferred perk fields
            isPreferredHomeJob: bonusInfo.isPreferredJob,
            preferredBonusApplied: bonusInfo.bonusApplied,
            preferredBonusPercent: bonusInfo.bonusApplied ? bonusInfo.bonusPercent : null,
            preferredBonusAmount: bonusInfo.bonusApplied ? bonusInfo.bonusAmountCents : null,
            cleanerTierAtPayout: bonusInfo.tierLevel,
          });
        }

        try {
          let chargeId = null;
          if (appointment.paymentIntentId) {
            const paymentIntent = await stripe.paymentIntents.retrieve(appointment.paymentIntentId);
            chargeId = paymentIntent.latest_charge;
          }

          const transferParams = {
            amount: netAmount,
            currency: "usd",
            destination: connectAccount.stripeAccountId,
            metadata: {
              appointmentId: appointment.id.toString(),
              cleanerId: cleanerId.toString(),
              payoutId: payout.id.toString(),
            },
          };

          if (chargeId) {
            transferParams.source_transaction = chargeId;
          }

          const transfer = await stripe.transfers.create(transferParams);

          await payout.update({ stripeTransferId: transfer.id, status: "completed" });

          await this.recordPaymentTransaction(models, {
            type: "payout",
            status: "succeeded",
            amount: netAmount,
            cleanerId,
            appointmentId: appointment.id,
            payoutId: payout.id,
            stripeTransferId: transfer.id,
            platformFeeAmount: platformFee,
            netAmount,
            description: "Cleaner payout for completed cleaning",
          });

          await this.recordPaymentTransaction(models, {
            type: "platform_fee",
            status: "succeeded",
            amount: platformFee,
            appointmentId: appointment.id,
            payoutId: payout.id,
            description: "Platform fee",
          });

          // Update business volume stats if this is a business owner job
          if (businessOwnerId) {
            await BusinessVolumeService.incrementVolumeStats(businessOwnerId, perCleanerGross);
          }

          payoutResults.push({ cleanerId, success: true, amount: netAmount / 100, transferId: transfer.id });
        } catch (transferError) {
          console.error(`Transfer failed for cleaner ${cleanerId}:`, transferError);
          await payout.update({ status: "failed" });
          payoutResults.push({ cleanerId, success: false, error: transferError.message });
        }
      }

      return { success: payoutResults.some((p) => p.success), payouts: payoutResults };
    } catch (error) {
      console.error("Error processing cleaner payouts:", error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Complete a cleaner-booked appointment with auto-payment
   */
  static async completeCleanerBookedAppointment(appointmentId, cleanerId, models) {
    const { UserAppointments, UserCleanerAppointments, JobPhoto } = models;

    try {
      const appointment = await UserAppointments.findByPk(appointmentId);
      if (!appointment) {
        return { success: false, error: "Appointment not found" };
      }

      const cleanerAssignment = await UserCleanerAppointments.findOne({
        where: { appointmentId, employeeId: cleanerId },
      });

      if (!cleanerAssignment) {
        return { success: false, error: "Cleaner is not assigned to this appointment" };
      }

      const beforePhotos = await JobPhoto.count({
        where: { appointmentId, cleanerId, photoType: "before" },
      });
      const afterPhotos = await JobPhoto.count({
        where: { appointmentId, cleanerId, photoType: "after" },
      });

      if (beforePhotos === 0 || afterPhotos === 0) {
        return {
          success: false,
          error: "Before and after photos are required to complete the job",
          missingPhotos: { before: beforePhotos === 0, after: afterPhotos === 0 },
        };
      }

      let paymentResult = { success: true, alreadyPaid: true };
      if (appointment.bookedByCleanerId && appointment.autoPayEnabled && !appointment.paid) {
        paymentResult = await this.processAutoPayment(appointment, models);
        if (!paymentResult.success) {
          return { success: false, error: `Payment failed: ${paymentResult.error}`, paymentFailed: true };
        }
        await appointment.reload();
      }

      await appointment.update({ completed: true });

      let payoutResult = { success: false, error: "Payment not captured" };
      if (appointment.paid) {
        payoutResult = await this.processCleanerPayout(appointment, models);
      }

      return { success: true, payment: paymentResult, payouts: payoutResult, appointmentCompleted: true };
    } catch (error) {
      console.error("Error completing cleaner-booked appointment:", error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Get billing history for a client
   */
  static async getClientBillingHistory(userId, models, options = {}) {
    const { Payment, UserAppointments, UserHomes } = models;
    const { Op } = require("sequelize");

    const limit = options.limit || 20;
    const offset = options.offset || 0;

    try {
      const { count, rows: transactions } = await Payment.findAndCountAll({
        where: {
          userId,
          type: { [Op.in]: ["authorization", "capture", "refund"] },
        },
        include: [
          {
            model: UserAppointments,
            as: "appointment",
            include: [{ model: UserHomes, as: "home", attributes: ["id", "address", "city"] }],
          },
        ],
        order: [["createdAt", "DESC"]],
        limit,
        offset,
      });

      return {
        transactions: transactions.map((t) => ({
          id: t.id,
          transactionId: t.transactionId,
          type: t.type,
          status: t.status,
          amount: t.amount / 100,
          date: t.createdAt,
          appointment: t.appointment
            ? { id: t.appointment.id, date: t.appointment.date, home: t.appointment.home ? `${t.appointment.home.address}, ${t.appointment.home.city}` : null }
            : null,
        })),
        total: count,
        hasMore: offset + transactions.length < count,
      };
    } catch (error) {
      console.error("Error fetching billing history:", error);
      return { transactions: [], total: 0, error: error.message };
    }
  }

  /**
   * Get pending payments that need reminders
   */
  static async getPendingPaymentReminders(models, daysOverdue = 3) {
    const { UserAppointments, User, UserHomes } = models;
    const { Op } = require("sequelize");

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOverdue);
    const cutoffDateStr = cutoffDate.toISOString().split("T")[0];

    try {
      const appointments = await UserAppointments.findAll({
        where: {
          completed: true,
          paid: false,
          autoPayEnabled: false,
          date: { [Op.lte]: cutoffDateStr },
        },
        include: [
          { model: User, as: "homeowner", attributes: ["id", "firstName", "lastName", "email"] },
          { model: UserHomes, as: "home", attributes: ["id", "address", "city"] },
        ],
      });

      return appointments;
    } catch (error) {
      console.error("Error fetching pending payment reminders:", error);
      return [];
    }
  }
}

// Scheduler for monthly billing tasks (interest on unpaid fees, etc.)
const startBillingScheduler = () => {
  // Run monthly billing tasks on the 1st of each month at midnight
  const cron = require("node-cron");

  cron.schedule("0 0 1 * *", async () => {
    console.log("[BillingScheduler] Running monthly billing tasks...");
    // Add monthly billing logic here if needed
    // For now, this is a placeholder for future monthly tasks
  });

  console.log("[BillingScheduler] Monthly billing scheduler started");
};

module.exports = BillingService;
module.exports.startBillingScheduler = startBillingScheduler;
