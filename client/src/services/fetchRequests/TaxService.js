import { API_BASE } from "../config";

const baseURL = API_BASE.replace("/api/v1", "");

class TaxService {
  // ============================================================================
  // CLEANER/EMPLOYEE TAX ENDPOINTS (Stripe-based)
  // ============================================================================

  /**
   * Get earnings summary for a cleaner/employee
   * Returns earnings from Payment records for a tax year
   */
  static async getEarnings(token, taxYear) {
    try {
      const response = await fetch(
        `${baseURL}/api/v1/tax/earnings/${taxYear}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );
      if (!response.ok) {
        const errorData = await response.json();
        return { error: true, ...errorData };
      }
      return await response.json();
    } catch (error) {
      return { error: true, message: error.message };
    }
  }

  /**
   * Get tax summary for a cleaner (contractor) - alias for getEarnings
   */
  static async getCleanerTaxSummary(token, taxYear) {
    try {
      const response = await fetch(
        `${baseURL}/api/v1/tax/contractor/tax-summary/${taxYear}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );
      if (!response.ok) {
        const errorData = await response.json();
        return { error: true, ...errorData };
      }
      return await response.json();
    } catch (error) {
      return { error: true, message: error.message };
    }
  }

  /**
   * Get Stripe Express Dashboard link for accessing tax forms (1099)
   * Cleaners access their 1099 forms through the Stripe Dashboard
   */
  static async getDashboardLink(token) {
    try {
      const response = await fetch(`${baseURL}/api/v1/tax/dashboard-link`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      if (!response.ok) {
        const errorData = await response.json();
        return { error: true, ...errorData };
      }
      return await response.json();
    } catch (error) {
      return { error: true, message: error.message };
    }
  }

  /**
   * Get Stripe account tax status
   * Returns whether the user's Stripe account is set up for tax reporting
   */
  static async getTaxStatus(token) {
    try {
      const response = await fetch(`${baseURL}/api/v1/tax/status`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      if (!response.ok) {
        const errorData = await response.json();
        return { error: true, ...errorData };
      }
      return await response.json();
    } catch (error) {
      return { error: true, message: error.message };
    }
  }

  // ============================================================================
  // PLATFORM TAX ENDPOINTS (Business Owner's Own Taxes)
  // ============================================================================

  /**
   * Get platform income summary (for owner/company)
   */
  static async getPlatformIncomeSummary(token, taxYear) {
    try {
      const response = await fetch(
        `${baseURL}/api/v1/tax/platform/income-summary/${taxYear}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );
      if (!response.ok) {
        const errorData = await response.json();
        return { error: true, ...errorData };
      }
      return await response.json();
    } catch (error) {
      return { error: true, message: error.message };
    }
  }

  /**
   * Get comprehensive platform tax report (for owner/company)
   */
  static async getPlatformTaxReport(token, taxYear) {
    try {
      const response = await fetch(
        `${baseURL}/api/v1/tax/platform/comprehensive-report/${taxYear}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );
      if (!response.ok) {
        const errorData = await response.json();
        return { error: true, ...errorData };
      }
      return await response.json();
    } catch (error) {
      return { error: true, message: error.message };
    }
  }

  /**
   * Get Schedule C data (for owner/company)
   */
  static async getScheduleCData(token, taxYear) {
    try {
      const response = await fetch(
        `${baseURL}/api/v1/tax/platform/schedule-c/${taxYear}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );
      if (!response.ok) {
        const errorData = await response.json();
        return { error: true, ...errorData };
      }
      return await response.json();
    } catch (error) {
      return { error: true, message: error.message };
    }
  }

  /**
   * Get tax deadlines
   */
  static async getTaxDeadlines(token, taxYear) {
    try {
      const response = await fetch(
        `${baseURL}/api/v1/tax/platform/deadlines/${taxYear}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );
      if (!response.ok) {
        const errorData = await response.json();
        return { error: true, ...errorData };
      }
      return await response.json();
    } catch (error) {
      return { error: true, message: error.message };
    }
  }

  /**
   * Get quarterly estimated tax info (for owner/company)
   */
  static async getQuarterlyTax(token, taxYear, quarter) {
    try {
      const response = await fetch(
        `${baseURL}/api/v1/tax/platform/quarterly-tax/${taxYear}/${quarter}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );
      if (!response.ok) {
        const errorData = await response.json();
        return { error: true, ...errorData };
      }
      return await response.json();
    } catch (error) {
      return { error: true, message: error.message };
    }
  }
}

export default TaxService;
