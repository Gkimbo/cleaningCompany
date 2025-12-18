import { API_BASE } from "../config";

const baseURL = API_BASE.replace("/api/v1", "");

class TaxService {
  /**
   * Get tax summary for a cleaner (contractor)
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
      console.log(response);
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
   * Get tax info (W-9 data) for a cleaner
   */
  static async getTaxInfo(token) {
    try {
      const response = await fetch(`${baseURL}/api/v1/tax/info`, {
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
   * Save or update tax info (W-9 data)
   */
  static async saveTaxInfo(token, taxInfo) {
    try {
      const response = await fetch(`${baseURL}/api/v1/tax/info`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(taxInfo),
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
   * Get 1099-NEC documents for a cleaner
   */
  static async get1099Documents(token, taxYear) {
    try {
      const response = await fetch(
        `${baseURL}/api/v1/tax/contractor/1099-nec/${taxYear}`,
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
   * Get payment history for a user (homeowner)
   */
  static async getPaymentHistory(token, taxYear) {
    try {
      const response = await fetch(
        `${baseURL}/api/v1/tax/payment-history/${taxYear}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );
      console.log(response);
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
   * Get platform income summary (for manager/company)
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
   * Get comprehensive platform tax report (for manager/company)
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
   * Get Schedule C data (for manager/company)
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
   * Get quarterly estimated tax info (for manager/company)
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
