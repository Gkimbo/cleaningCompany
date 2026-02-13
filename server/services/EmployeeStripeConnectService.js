/**
 * EmployeeStripeConnectService
 *
 * Manages Stripe Connect accounts for business employees who want to receive
 * direct payouts through the platform instead of being paid by their business owner.
 */

const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
const { BusinessEmployee, User } = require("../models");

const ACCOUNT_STATUS = {
  PENDING: "pending",
  ONBOARDING: "onboarding",
  ACTIVE: "active",
  RESTRICTED: "restricted",
  DISABLED: "disabled",
};

class EmployeeStripeConnectService {
  /**
   * Create a Stripe Connected Account for an employee
   *
   * @param {number} businessEmployeeId - ID of the BusinessEmployee record
   * @param {object} personalInfo - Optional pre-filled personal info
   * @returns {object} - Created account details
   */
  static async createConnectedAccount(businessEmployeeId, personalInfo = {}) {
    const employee = await BusinessEmployee.findByPk(businessEmployeeId, {
      include: [{ model: User, as: "user" }],
    });

    if (!employee) {
      throw new Error("Employee not found");
    }

    if (!employee.userId) {
      throw new Error(
        "Employee must have an accepted invite to set up Stripe Connect"
      );
    }

    if (employee.stripeConnectAccountId) {
      // Account already exists, return existing info
      return {
        success: true,
        stripeAccountId: employee.stripeConnectAccountId,
        alreadyExists: true,
      };
    }

    const user = employee.user;
    if (!user) {
      throw new Error("Employee user account not found");
    }

    // Build individual info for pre-filling
    const individual = {
      first_name: employee.firstName || user.firstName || undefined,
      last_name: employee.lastName || user.lastName || undefined,
      email: employee.email || user.email || undefined,
      phone: employee.phone || user.phone || undefined,
    };

    // Add DOB if provided
    if (personalInfo?.dob) {
      const dobParts = personalInfo.dob.split("-");
      if (dobParts.length === 3) {
        individual.dob = {
          year: parseInt(dobParts[0]),
          month: parseInt(dobParts[1]),
          day: parseInt(dobParts[2]),
        };
      }
    }

    // Add address if provided
    if (personalInfo?.address) {
      individual.address = {
        line1: personalInfo.address.line1 || undefined,
        line2: personalInfo.address.line2 || undefined,
        city: personalInfo.address.city || undefined,
        state: personalInfo.address.state || undefined,
        postal_code: personalInfo.address.postalCode || undefined,
        country: "US",
      };
    }

    // Create account using controller properties (matches platform settings)
    const account = await stripe.accounts.create({
      controller: {
        fees: {
          payer: "application",
        },
        losses: {
          payments: "application",
        },
        stripe_dashboard: {
          type: "express",
        },
      },
      email: individual.email || undefined,
      capabilities: {
        transfers: { requested: true },
      },
      business_type: "individual",
      country: "US",
      business_profile: {
        mcc: "7349", // Cleaning and Maintenance Services
        product_description: "Professional residential cleaning services",
        url: "https://keanr.com",
      },
      individual,
      metadata: {
        platform: "cleaning_company",
        account_type: "business_employee",
        business_employee_id: businessEmployeeId.toString(),
        user_id: user.id.toString(),
        business_owner_id: employee.businessOwnerId.toString(),
      },
    });

    // Update BusinessEmployee with Stripe account info
    await employee.update({
      stripeConnectAccountId: account.id,
      stripeConnectOnboarded: false,
      paymentMethod: "stripe_connect",
    });

    console.log(
      `[EmployeeStripeConnect] Created account ${account.id} for employee ${businessEmployeeId}`
    );

    return {
      success: true,
      stripeAccountId: account.id,
      alreadyExists: false,
    };
  }

  /**
   * Generate an onboarding link for an employee to complete Stripe setup
   *
   * @param {number} businessEmployeeId - ID of the BusinessEmployee record
   * @param {string} baseUrl - Base URL for redirect callbacks
   * @returns {object} - Onboarding link details
   */
  static async generateOnboardingLink(businessEmployeeId, baseUrl) {
    const employee = await BusinessEmployee.findByPk(businessEmployeeId);

    if (!employee) {
      throw new Error("Employee not found");
    }

    if (!employee.stripeConnectAccountId) {
      throw new Error(
        "Employee does not have a Stripe Connect account. Create one first."
      );
    }

    if (employee.stripeConnectOnboarded) {
      // Already onboarded, check if still valid
      const isReady = await this.isReadyForPayouts(businessEmployeeId);
      if (isReady) {
        return {
          success: true,
          alreadyOnboarded: true,
          requiresOnboarding: false,
        };
      }
    }

    // Generate onboarding link
    const accountLink = await stripe.accountLinks.create({
      account: employee.stripeConnectAccountId,
      refresh_url: `${baseUrl}/api/v1/business-employees/stripe-connect/onboarding-refresh?employeeId=${businessEmployeeId}`,
      return_url: `${baseUrl}/api/v1/business-employees/stripe-connect/onboarding-complete?employeeId=${businessEmployeeId}`,
      type: "account_onboarding",
      collection_options: {
        fields: "eventually_due",
      },
    });

    console.log(
      `[EmployeeStripeConnect] Generated onboarding link for employee ${businessEmployeeId}`
    );

    return {
      success: true,
      onboardingUrl: accountLink.url,
      onboardingExpiresAt: accountLink.expires_at,
      requiresOnboarding: true,
      alreadyOnboarded: false,
    };
  }

  /**
   * Check onboarding status and update local records
   *
   * @param {number} businessEmployeeId - ID of the BusinessEmployee record
   * @returns {object} - Current onboarding status
   */
  static async checkOnboardingStatus(businessEmployeeId) {
    const employee = await BusinessEmployee.findByPk(businessEmployeeId);

    if (!employee) {
      throw new Error("Employee not found");
    }

    if (!employee.stripeConnectAccountId) {
      return {
        hasAccount: false,
        onboarded: false,
        payoutsEnabled: false,
      };
    }

    try {
      const stripeAccount = await stripe.accounts.retrieve(
        employee.stripeConnectAccountId
      );

      const payoutsEnabled = stripeAccount.payouts_enabled || false;
      const detailsSubmitted = stripeAccount.details_submitted || false;
      const onboarded = payoutsEnabled && detailsSubmitted;

      // Update local record if status changed
      if (employee.stripeConnectOnboarded !== onboarded) {
        await employee.update({ stripeConnectOnboarded: onboarded });
      }

      return {
        hasAccount: true,
        stripeAccountId: employee.stripeConnectAccountId,
        onboarded,
        payoutsEnabled,
        detailsSubmitted,
        hasBankAccount: stripeAccount.external_accounts?.data?.length > 0,
        requirements: stripeAccount.requirements,
      };
    } catch (error) {
      console.error(
        `[EmployeeStripeConnect] Error checking status for ${businessEmployeeId}:`,
        error.message
      );
      return {
        hasAccount: true,
        stripeAccountId: employee.stripeConnectAccountId,
        onboarded: false,
        payoutsEnabled: false,
        error: error.message,
      };
    }
  }

  /**
   * Check if an employee is ready to receive direct payouts
   *
   * @param {number} businessEmployeeId - ID of the BusinessEmployee record
   * @returns {boolean} - True if employee can receive payouts
   */
  static async isReadyForPayouts(businessEmployeeId) {
    const employee = await BusinessEmployee.findByPk(businessEmployeeId);

    if (!employee) {
      return false;
    }

    if (!employee.stripeConnectAccountId) {
      return false;
    }

    // If we already know they're onboarded, do a quick check
    if (employee.stripeConnectOnboarded) {
      try {
        const stripeAccount = await stripe.accounts.retrieve(
          employee.stripeConnectAccountId
        );
        return stripeAccount.payouts_enabled === true;
      } catch {
        return false;
      }
    }

    return false;
  }

  /**
   * Generate a dashboard link for an employee to view their Stripe dashboard
   *
   * @param {number} businessEmployeeId - ID of the BusinessEmployee record
   * @returns {object} - Dashboard link details
   */
  static async generateDashboardLink(businessEmployeeId) {
    const employee = await BusinessEmployee.findByPk(businessEmployeeId);

    if (!employee) {
      throw new Error("Employee not found");
    }

    if (!employee.stripeConnectAccountId) {
      throw new Error("Employee does not have a Stripe Connect account");
    }

    const loginLink = await stripe.accounts.createLoginLink(
      employee.stripeConnectAccountId
    );

    return {
      success: true,
      dashboardUrl: loginLink.url,
    };
  }

  /**
   * Complete onboarding callback - called after employee finishes Stripe onboarding
   *
   * @param {number} businessEmployeeId - ID of the BusinessEmployee record
   * @returns {object} - Updated status
   */
  static async completeOnboarding(businessEmployeeId) {
    const employee = await BusinessEmployee.findByPk(businessEmployeeId);

    if (!employee || !employee.stripeConnectAccountId) {
      throw new Error("Employee or Stripe account not found");
    }

    // Fetch latest status from Stripe
    const stripeAccount = await stripe.accounts.retrieve(
      employee.stripeConnectAccountId
    );

    const payoutsEnabled = stripeAccount.payouts_enabled || false;
    const detailsSubmitted = stripeAccount.details_submitted || false;
    const onboarded = payoutsEnabled && detailsSubmitted;

    // Update local record
    await employee.update({
      stripeConnectOnboarded: onboarded,
    });

    console.log(
      `[EmployeeStripeConnect] Onboarding complete for employee ${businessEmployeeId}: onboarded=${onboarded}, payoutsEnabled=${payoutsEnabled}`
    );

    return {
      success: true,
      onboarded,
      payoutsEnabled,
      detailsSubmitted,
      hasBankAccount: stripeAccount.external_accounts?.data?.length > 0,
    };
  }
}

module.exports = EmployeeStripeConnectService;
