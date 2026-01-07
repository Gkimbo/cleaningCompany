/**
 * ============================================================================
 * PLATFORM TAX SERVICE
 * Service for generating company tax documents and reports
 * ============================================================================
 *
 * This service handles:
 * - Annual income summaries for tax filing
 * - Quarterly estimated tax calculations
 * - Monthly revenue reports
 * - Tax form data generation (Schedule C, Form 1120, etc.)
 * - IRS compliance helpers
 *
 * The company earns a configurable percentage of each cleaning as a platform fee.
 * This income must be reported and taxes paid accordingly.
 * ============================================================================
 */

const { PlatformEarnings, Payment, Payout, UserAppointments, User } = require("../models");

// Tax rates and thresholds (2024 rates - should be updated annually)
const TAX_CONSTANTS = {
  // Self-employment tax rate (Social Security + Medicare)
  SELF_EMPLOYMENT_TAX_RATE: 0.153, // 15.3%
  SELF_EMPLOYMENT_DEDUCTION: 0.5, // Can deduct 50% of SE tax

  // Estimated tax thresholds
  QUARTERLY_ESTIMATED_TAX_THRESHOLD: 100000, // $1,000 annual tax liability

  // Federal income tax brackets (2024 - single/married filing separately)
  // These are simplified - actual brackets depend on filing status
  FEDERAL_TAX_BRACKETS: [
    { min: 0, max: 1160000, rate: 0.10 },      // 10% up to $11,600
    { min: 1160000, max: 4725000, rate: 0.12 }, // 12% $11,600 - $47,250
    { min: 4725000, max: 10050000, rate: 0.22 }, // 22% $47,250 - $100,500
    { min: 10050000, max: 19190000, rate: 0.24 }, // 24% $100,500 - $191,900
    { min: 19190000, max: 24375000, rate: 0.32 }, // 32% $191,900 - $243,750
    { min: 24375000, max: 60962500, rate: 0.35 }, // 35% $243,750 - $609,625
    { min: 60962500, max: Infinity, rate: 0.37 }, // 37% over $609,625
  ],

  // Quarterly due dates (month, day)
  QUARTERLY_DUE_DATES: {
    Q1: { month: 4, day: 15 },  // April 15
    Q2: { month: 6, day: 15 },  // June 15
    Q3: { month: 9, day: 15 },  // September 15
    Q4: { month: 1, day: 15 },  // January 15 (next year)
  },
};

// Company information (from environment)
const COMPANY_INFO = {
  name: process.env.COMPANY_NAME || "Cleaning Company Platform",
  ein: process.env.COMPANY_EIN || "XX-XXXXXXX",
  entityType: process.env.COMPANY_ENTITY_TYPE || "LLC", // LLC, S-Corp, C-Corp, Sole Prop
  addressLine1: process.env.COMPANY_ADDRESS_LINE1 || "123 Platform Street",
  addressLine2: process.env.COMPANY_ADDRESS_LINE2 || "",
  city: process.env.COMPANY_CITY || "Your City",
  state: process.env.COMPANY_STATE || "ST",
  zipCode: process.env.COMPANY_ZIP || "12345",
  fiscalYearEnd: process.env.COMPANY_FISCAL_YEAR_END || "12/31", // MM/DD
};

class PlatformTaxService {
  /**
   * Record platform earnings when a payout is processed
   */
  static async recordPlatformEarnings({
    appointmentId,
    paymentId,
    payoutId,
    customerId,
    cleanerId,
    grossServiceAmount,
    platformFeeAmount,
    platformFeePercentage = null,
    stripeFeeAmount = 0,
  }) {
    const now = new Date();
    const netPlatformEarnings = platformFeeAmount - stripeFeeAmount;

    // Get fee percentage from config if not provided
    let feePercentage = platformFeePercentage;
    if (feePercentage === null) {
      const { getPricingConfig } = require("../config/businessConfig");
      const pricing = await getPricingConfig();
      feePercentage = pricing.platform?.feePercent || 0.10;
    }

    const earning = await PlatformEarnings.create({
      transactionId: PlatformEarnings.generateTransactionId(),
      appointmentId,
      paymentId,
      payoutId,
      customerId,
      cleanerId,
      grossServiceAmount,
      platformFeeAmount,
      platformFeePercentage: feePercentage,
      stripeFeeAmount,
      netPlatformEarnings,
      taxYear: now.getFullYear(),
      taxQuarter: PlatformEarnings.getQuarter(now),
      taxMonth: now.getMonth() + 1,
      status: "collected",
      incomeCategory: "platform_commission",
      earnedAt: now,
      collectedAt: now,
      description: `Platform fee for appointment #${appointmentId}`,
    });

    return earning;
  }

  /**
   * Get annual income summary for tax filing
   */
  static async getAnnualIncomeSummary(taxYear) {
    const yearlySummary = await PlatformEarnings.getYearlySummary(taxYear);
    const monthlyBreakdown = await PlatformEarnings.getMonthlyBreakdown(taxYear);

    // Calculate quarterly summaries
    const quarterlySummaries = await Promise.all([
      PlatformEarnings.getQuarterlySummary(taxYear, 1),
      PlatformEarnings.getQuarterlySummary(taxYear, 2),
      PlatformEarnings.getQuarterlySummary(taxYear, 3),
      PlatformEarnings.getQuarterlySummary(taxYear, 4),
    ]);

    return {
      taxYear,
      company: COMPANY_INFO,
      annual: yearlySummary,
      quarterly: quarterlySummaries,
      monthly: monthlyBreakdown,
      generatedAt: new Date().toISOString(),
    };
  }

  /**
   * Calculate estimated quarterly taxes
   */
  static async calculateQuarterlyEstimatedTax(taxYear, quarter) {
    const quarterlyData = await PlatformEarnings.getQuarterlySummary(taxYear, quarter);
    const netIncomeCents = quarterlyData.totalNetEarningsCents;
    const netIncomeDollars = netIncomeCents / 100;

    // Calculate self-employment tax
    const selfEmploymentTax = netIncomeDollars * TAX_CONSTANTS.SELF_EMPLOYMENT_TAX_RATE;
    const selfEmploymentDeduction = selfEmploymentTax * TAX_CONSTANTS.SELF_EMPLOYMENT_DEDUCTION;

    // Taxable income after SE deduction
    const taxableIncome = netIncomeDollars - selfEmploymentDeduction;

    // Calculate estimated federal tax (simplified)
    let federalTax = 0;
    let remainingIncome = Math.round(taxableIncome * 100); // Convert to cents for comparison

    for (const bracket of TAX_CONSTANTS.FEDERAL_TAX_BRACKETS) {
      if (remainingIncome <= 0) break;

      const taxableInBracket = Math.min(
        remainingIncome,
        bracket.max - bracket.min
      );

      if (taxableInBracket > 0) {
        federalTax += (taxableInBracket / 100) * bracket.rate;
        remainingIncome -= taxableInBracket;
      }
    }

    const totalEstimatedTax = selfEmploymentTax + federalTax;

    // Get due date for this quarter's payment
    const dueDate = this.getQuarterlyDueDate(taxYear, quarter);

    return {
      taxYear,
      quarter,
      grossIncome: {
        cents: quarterlyData.totalPlatformFeesCents,
        dollars: (quarterlyData.totalPlatformFeesCents / 100).toFixed(2),
      },
      netIncome: {
        cents: netIncomeCents,
        dollars: netIncomeDollars.toFixed(2),
      },
      selfEmploymentTax: {
        amount: selfEmploymentTax.toFixed(2),
        rate: `${(TAX_CONSTANTS.SELF_EMPLOYMENT_TAX_RATE * 100).toFixed(1)}%`,
        deduction: selfEmploymentDeduction.toFixed(2),
      },
      estimatedFederalTax: federalTax.toFixed(2),
      totalEstimatedTax: totalEstimatedTax.toFixed(2),
      dueDate,
      transactionCount: quarterlyData.transactionCount,
    };
  }

  /**
   * Get quarterly due date
   */
  static getQuarterlyDueDate(taxYear, quarter) {
    const dueDates = TAX_CONSTANTS.QUARTERLY_DUE_DATES;
    const quarterKey = `Q${quarter}`;
    const dueInfo = dueDates[quarterKey];

    // Q4 payment is due in January of the next year
    const year = quarter === 4 ? taxYear + 1 : taxYear;

    return new Date(year, dueInfo.month - 1, dueInfo.day);
  }

  /**
   * Generate Schedule C data (for sole proprietorship/single-member LLC)
   */
  static async generateScheduleCData(taxYear) {
    const annualSummary = await this.getAnnualIncomeSummary(taxYear);
    const grossReceipts = annualSummary.annual.totalPlatformFeesCents;
    const stripeFees = annualSummary.annual.totalStripeFeesCents;

    // Common deductible expenses for a platform business
    // These would typically come from expense tracking - using placeholders
    const expenses = {
      // Part II - Expenses
      advertising: 0,
      carAndTruck: 0,
      commissions: stripeFees, // Stripe fees as commission/processing fees
      contractLabor: 0,
      depletion: 0,
      depreciation: 0,
      employeeBenefitPrograms: 0,
      insurance: 0,
      interestMortgage: 0,
      interestOther: 0,
      legalAndProfessional: 0,
      officeExpense: 0,
      pensionAndProfitSharing: 0,
      rentVehicles: 0,
      rentOther: 0,
      repairs: 0,
      supplies: 0,
      taxesAndLicenses: 0,
      travel: 0,
      meals: 0,
      utilities: 0,
      wages: 0,
      otherExpenses: 0,
    };

    const totalExpenses = Object.values(expenses).reduce((a, b) => a + b, 0);
    const netProfit = grossReceipts - totalExpenses;

    return {
      taxYear,
      formType: "Schedule C (Form 1040)",
      formTitle: "Profit or Loss From Business",

      // Part I - Income
      partI: {
        line1: {
          description: "Gross receipts or sales",
          amountCents: grossReceipts,
          amountDollars: (grossReceipts / 100).toFixed(2),
        },
        line2: {
          description: "Returns and allowances",
          amountCents: 0,
          amountDollars: "0.00",
        },
        line3: {
          description: "Subtract line 2 from line 1",
          amountCents: grossReceipts,
          amountDollars: (grossReceipts / 100).toFixed(2),
        },
        line4: {
          description: "Cost of goods sold",
          amountCents: 0,
          amountDollars: "0.00",
        },
        line5: {
          description: "Gross profit",
          amountCents: grossReceipts,
          amountDollars: (grossReceipts / 100).toFixed(2),
        },
        line7: {
          description: "Gross income",
          amountCents: grossReceipts,
          amountDollars: (grossReceipts / 100).toFixed(2),
        },
      },

      // Part II - Expenses
      partII: {
        line10: { description: "Commissions and fees", amountCents: expenses.commissions },
        line28: { description: "Total expenses", amountCents: totalExpenses },
      },

      // Net profit
      line29: {
        description: "Tentative profit or (loss)",
        amountCents: netProfit,
        amountDollars: (netProfit / 100).toFixed(2),
      },
      line31: {
        description: "Net profit or (loss)",
        amountCents: netProfit,
        amountDollars: (netProfit / 100).toFixed(2),
      },

      // Business information
      businessInfo: {
        name: COMPANY_INFO.name,
        address: `${COMPANY_INFO.addressLine1}, ${COMPANY_INFO.city}, ${COMPANY_INFO.state} ${COMPANY_INFO.zipCode}`,
        ein: COMPANY_INFO.ein,
        principalBusinessCode: "561720", // Janitorial Services
        businessDescription: "Cleaning Services Platform",
        accountingMethod: "Cash",
      },

      summary: annualSummary,
      generatedAt: new Date().toISOString(),
    };
  }

  /**
   * Generate 1099-K summary (if applicable - for payment processors)
   * Note: The company may receive a 1099-K from Stripe if volume exceeds threshold
   */
  static async generate1099KExpectation(taxYear) {
    const annualSummary = await this.getAnnualIncomeSummary(taxYear);
    const totalGross = annualSummary.annual.totalGrossServicesCents;

    // 2024 threshold: $5,000 (was $600, being phased in)
    const threshold2024Cents = 500000; // $5,000

    return {
      taxYear,
      formType: "1099-K",
      description: "Payment Card and Third Party Network Transactions",
      expectedFromStripe: totalGross >= threshold2024Cents,
      totalGrossAmount: {
        cents: totalGross,
        dollars: (totalGross / 100).toFixed(2),
      },
      threshold: {
        cents: threshold2024Cents,
        dollars: (threshold2024Cents / 100).toFixed(2),
      },
      note: "You may receive a 1099-K from Stripe if your gross payment volume exceeds the IRS threshold.",
    };
  }

  /**
   * Get tax filing deadlines for the company
   */
  static getTaxDeadlines(taxYear) {
    const nextYear = taxYear + 1;

    return {
      taxYear,
      entityType: COMPANY_INFO.entityType,
      deadlines: {
        // Quarterly estimated taxes
        q1Estimated: {
          description: "Q1 Estimated Tax Payment",
          dueDate: new Date(taxYear, 3, 15), // April 15
          applies: true,
        },
        q2Estimated: {
          description: "Q2 Estimated Tax Payment",
          dueDate: new Date(taxYear, 5, 15), // June 15
          applies: true,
        },
        q3Estimated: {
          description: "Q3 Estimated Tax Payment",
          dueDate: new Date(taxYear, 8, 15), // September 15
          applies: true,
        },
        q4Estimated: {
          description: "Q4 Estimated Tax Payment",
          dueDate: new Date(nextYear, 0, 15), // January 15 next year
          applies: true,
        },

        // Annual filings
        form1099NEC: {
          description: "File 1099-NEC forms for contractors",
          dueDate: new Date(nextYear, 0, 31), // January 31
          applies: true,
        },
        scheduleC: {
          description: "Schedule C (with Form 1040)",
          dueDate: new Date(nextYear, 3, 15), // April 15
          applies: COMPANY_INFO.entityType === "Sole Prop" || COMPANY_INFO.entityType === "LLC",
        },
        form1120: {
          description: "Form 1120 (C-Corp)",
          dueDate: new Date(nextYear, 3, 15), // April 15
          applies: COMPANY_INFO.entityType === "C-Corp",
        },
        form1120S: {
          description: "Form 1120-S (S-Corp)",
          dueDate: new Date(nextYear, 2, 15), // March 15
          applies: COMPANY_INFO.entityType === "S-Corp",
        },
      },
    };
  }

  /**
   * Get comprehensive tax report for the year
   */
  static async getComprehensiveTaxReport(taxYear) {
    const [
      annualSummary,
      q1Tax,
      q2Tax,
      q3Tax,
      q4Tax,
      scheduleCData,
      form1099KExpectation,
    ] = await Promise.all([
      this.getAnnualIncomeSummary(taxYear),
      this.calculateQuarterlyEstimatedTax(taxYear, 1),
      this.calculateQuarterlyEstimatedTax(taxYear, 2),
      this.calculateQuarterlyEstimatedTax(taxYear, 3),
      this.calculateQuarterlyEstimatedTax(taxYear, 4),
      this.generateScheduleCData(taxYear),
      this.generate1099KExpectation(taxYear),
    ]);

    const totalEstimatedTaxPaid =
      parseFloat(q1Tax.totalEstimatedTax) +
      parseFloat(q2Tax.totalEstimatedTax) +
      parseFloat(q3Tax.totalEstimatedTax) +
      parseFloat(q4Tax.totalEstimatedTax);

    return {
      taxYear,
      company: COMPANY_INFO,
      incomeSummary: annualSummary,
      quarterlyTaxes: {
        q1: q1Tax,
        q2: q2Tax,
        q3: q3Tax,
        q4: q4Tax,
        totalEstimatedTaxPaid: totalEstimatedTaxPaid.toFixed(2),
      },
      taxForms: {
        scheduleC: scheduleCData,
        form1099K: form1099KExpectation,
      },
      deadlines: this.getTaxDeadlines(taxYear),
      generatedAt: new Date().toISOString(),
    };
  }
}

module.exports = PlatformTaxService;
