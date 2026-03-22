import HttpClient from "../HttpClient";

class TaxService {
  // ============================================================================
  // CLEANER/EMPLOYEE TAX ENDPOINTS (Stripe-based)
  // ============================================================================

  /**
   * Get earnings summary for a cleaner/employee
   */
  static async getEarnings(token, taxYear) {
    const result = await HttpClient.get(`/tax/earnings/${taxYear}`, { token });

    if (result.success === false) {
      return { error: true, ...result };
    }

    return result;
  }

  /**
   * Get tax summary for a cleaner (contractor)
   */
  static async getCleanerTaxSummary(token, taxYear) {
    const result = await HttpClient.get(`/tax/contractor/tax-summary/${taxYear}`, { token });

    if (result.success === false) {
      return { error: true, ...result };
    }

    return result;
  }

  /**
   * Get Stripe Express Dashboard link for accessing tax forms (1099)
   */
  static async getDashboardLink(token) {
    const result = await HttpClient.get("/tax/dashboard-link", { token });

    if (result.success === false) {
      return { error: true, ...result };
    }

    return result;
  }

  /**
   * Get Stripe account tax status
   */
  static async getTaxStatus(token) {
    const result = await HttpClient.get("/tax/status", { token });

    if (result.success === false) {
      return { error: true, ...result };
    }

    return result;
  }

  // ============================================================================
  // PLATFORM TAX ENDPOINTS (Business Owner's Own Taxes)
  // ============================================================================

  /**
   * Get platform income summary (for owner/company)
   */
  static async getPlatformIncomeSummary(token, taxYear) {
    const result = await HttpClient.get(`/tax/platform/income-summary/${taxYear}`, { token });

    if (result.success === false) {
      return { error: true, ...result };
    }

    return result;
  }

  /**
   * Get comprehensive platform tax report (for owner/company)
   */
  static async getPlatformTaxReport(token, taxYear) {
    const result = await HttpClient.get(`/tax/platform/comprehensive-report/${taxYear}`, { token });

    if (result.success === false) {
      return { error: true, ...result };
    }

    return result;
  }

  /**
   * Get Schedule C data (for owner/company)
   */
  static async getScheduleCData(token, taxYear) {
    const result = await HttpClient.get(`/tax/platform/schedule-c/${taxYear}`, { token });

    if (result.success === false) {
      return { error: true, ...result };
    }

    return result;
  }

  /**
   * Get tax deadlines
   */
  static async getTaxDeadlines(token, taxYear) {
    const result = await HttpClient.get(`/tax/platform/deadlines/${taxYear}`, { token });

    if (result.success === false) {
      return { error: true, ...result };
    }

    return result;
  }

  /**
   * Get quarterly estimated tax info (for owner/company)
   */
  static async getQuarterlyTax(token, taxYear, quarter) {
    const result = await HttpClient.get(`/tax/platform/quarterly-tax/${taxYear}/${quarter}`, { token });

    if (result.success === false) {
      return { error: true, ...result };
    }

    return result;
  }
}

export default TaxService;
