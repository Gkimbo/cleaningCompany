import * as FileSystem from "expo-file-system";
import * as Sharing from "expo-sharing";
import * as Print from "expo-print";
import Papa from "papaparse";

/**
 * Export Service - Handles CSV and PDF generation for financial reports
 */

// Format cents to currency string
const formatCurrency = (cents) => {
  const dollars = (cents || 0) / 100;
  return `$${dollars.toFixed(2)}`;
};

// Format date to readable string
const formatDate = (date) => {
  if (!date) return "";
  const d = new Date(date);
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
};

// Get current date for filenames
const getDateStamp = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
};

/**
 * Generate and share a CSV file
 */
export const generateCSV = async (data, filename) => {
  try {
    const csv = Papa.unparse(data);
    const fileUri = `${FileSystem.cacheDirectory}${filename}_${getDateStamp()}.csv`;

    await FileSystem.writeAsStringAsync(fileUri, csv, {
      encoding: FileSystem.EncodingType.UTF8,
    });

    const canShare = await Sharing.isAvailableAsync();
    if (canShare) {
      await Sharing.shareAsync(fileUri, {
        mimeType: "text/csv",
        dialogTitle: `Export ${filename}`,
        UTI: "public.comma-separated-values-text",
      });
      return { success: true };
    } else {
      return { success: false, error: "Sharing is not available on this device" };
    }
  } catch (error) {
    console.error("CSV generation error:", error);
    return { success: false, error: error.message };
  }
};

/**
 * Generate and share a PDF file
 */
export const generatePDF = async (htmlContent, filename) => {
  try {
    const { uri } = await Print.printToFileAsync({
      html: htmlContent,
      base64: false,
    });

    // Move to a better filename
    const newUri = `${FileSystem.cacheDirectory}${filename}_${getDateStamp()}.pdf`;
    await FileSystem.moveAsync({
      from: uri,
      to: newUri,
    });

    const canShare = await Sharing.isAvailableAsync();
    if (canShare) {
      await Sharing.shareAsync(newUri, {
        mimeType: "application/pdf",
        dialogTitle: `Export ${filename}`,
        UTI: "com.adobe.pdf",
      });
      return { success: true };
    } else {
      return { success: false, error: "Sharing is not available on this device" };
    }
  } catch (error) {
    console.error("PDF generation error:", error);
    return { success: false, error: error.message };
  }
};

/**
 * Generate HTML for PDF - Financial Summary
 */
export const generateFinancialSummaryHTML = (data, periodLabel, businessName = "Your Business") => {
  const {
    totalRevenue = 0,
    platformFees = 0,
    totalPayroll = 0,
    stripeFees = 0,
    netProfit = 0,
    completedJobs = 0,
  } = data;

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 40px; color: #1a1a1a; }
        .header { text-align: center; margin-bottom: 30px; border-bottom: 2px solid #2563eb; padding-bottom: 20px; }
        .header h1 { margin: 0; color: #2563eb; font-size: 24px; }
        .header p { margin: 5px 0 0; color: #666; }
        .summary-box { background: #f8fafc; padding: 15px; border-radius: 8px; margin-bottom: 20px; text-align: center; }
        .summary-box h2 { margin: 0; font-size: 32px; color: #16a34a; }
        .summary-box p { margin: 5px 0 0; color: #666; }
        table { width: 100%; border-collapse: collapse; margin-top: 20px; }
        th, td { padding: 12px 15px; text-align: left; border-bottom: 1px solid #e5e7eb; }
        th { background: #f1f5f9; font-weight: 600; color: #374151; }
        tr:nth-child(even) { background: #f8fafc; }
        .amount { text-align: right; font-weight: 500; }
        .negative { color: #dc2626; }
        .positive { color: #16a34a; }
        .total-row { font-weight: bold; border-top: 2px solid #374151; background: #f1f5f9; }
        .footer { margin-top: 30px; text-align: center; color: #9ca3af; font-size: 12px; }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>${businessName}</h1>
        <p>Financial Summary - ${periodLabel}</p>
      </div>

      <div class="summary-box">
        <h2>${formatCurrency(netProfit)}</h2>
        <p>Net Profit from ${completedJobs} completed jobs</p>
      </div>

      <table>
        <thead>
          <tr>
            <th>Category</th>
            <th class="amount">Amount</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Gross Revenue</td>
            <td class="amount positive">${formatCurrency(totalRevenue)}</td>
          </tr>
          <tr>
            <td>Platform Fees</td>
            <td class="amount negative">-${formatCurrency(platformFees)}</td>
          </tr>
          <tr>
            <td>Employee Payroll</td>
            <td class="amount negative">-${formatCurrency(totalPayroll)}</td>
          </tr>
          ${stripeFees > 0 ? `
          <tr>
            <td>Stripe Processing Fees</td>
            <td class="amount negative">-${formatCurrency(stripeFees)}</td>
          </tr>
          ` : ""}
          <tr class="total-row">
            <td>Net Profit</td>
            <td class="amount ${netProfit >= 0 ? 'positive' : 'negative'}">${formatCurrency(netProfit)}</td>
          </tr>
        </tbody>
      </table>

      <div class="footer">
        Generated on ${formatDate(new Date())}
      </div>
    </body>
    </html>
  `;
};

/**
 * Generate HTML for PDF - Payroll by Employee
 */
export const generatePayrollByEmployeeHTML = (employees, periodLabel, businessName = "Your Business") => {
  const totalPaid = employees.reduce((sum, e) => sum + (e.totalPaid || 0), 0);
  const totalPending = employees.reduce((sum, e) => sum + (e.pending || 0), 0);
  const totalJobs = employees.reduce((sum, e) => sum + (e.jobCount || 0), 0);

  const employeeRows = employees.map((emp, index) => `
    <tr>
      <td>${emp.employee?.firstName || ""} ${emp.employee?.lastName || ""}</td>
      <td class="amount">${emp.jobCount || 0}</td>
      <td class="amount">${formatCurrency(emp.totalPaid)}</td>
      <td class="amount">${formatCurrency(emp.pending)}</td>
    </tr>
  `).join("");

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 40px; color: #1a1a1a; }
        .header { text-align: center; margin-bottom: 30px; border-bottom: 2px solid #2563eb; padding-bottom: 20px; }
        .header h1 { margin: 0; color: #2563eb; font-size: 24px; }
        .header p { margin: 5px 0 0; color: #666; }
        .stats-row { display: flex; justify-content: space-around; margin-bottom: 25px; }
        .stat-box { text-align: center; padding: 15px 25px; background: #f8fafc; border-radius: 8px; }
        .stat-box h3 { margin: 0; font-size: 24px; color: #2563eb; }
        .stat-box p { margin: 5px 0 0; color: #666; font-size: 12px; }
        table { width: 100%; border-collapse: collapse; margin-top: 10px; }
        th, td { padding: 12px 15px; text-align: left; border-bottom: 1px solid #e5e7eb; }
        th { background: #f1f5f9; font-weight: 600; color: #374151; }
        tr:nth-child(even) { background: #f8fafc; }
        .amount { text-align: right; }
        .total-row { font-weight: bold; border-top: 2px solid #374151; background: #f1f5f9; }
        .footer { margin-top: 30px; text-align: center; color: #9ca3af; font-size: 12px; }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>${businessName}</h1>
        <p>Payroll by Employee - ${periodLabel}</p>
      </div>

      <div class="stats-row">
        <div class="stat-box">
          <h3>${employees.length}</h3>
          <p>Employees</p>
        </div>
        <div class="stat-box">
          <h3>${totalJobs}</h3>
          <p>Total Jobs</p>
        </div>
        <div class="stat-box">
          <h3>${formatCurrency(totalPaid)}</h3>
          <p>Total Paid</p>
        </div>
        <div class="stat-box">
          <h3>${formatCurrency(totalPending)}</h3>
          <p>Pending</p>
        </div>
      </div>

      <table>
        <thead>
          <tr>
            <th>Employee Name</th>
            <th class="amount">Jobs</th>
            <th class="amount">Total Paid</th>
            <th class="amount">Pending</th>
          </tr>
        </thead>
        <tbody>
          ${employeeRows}
          <tr class="total-row">
            <td>Total</td>
            <td class="amount">${totalJobs}</td>
            <td class="amount">${formatCurrency(totalPaid)}</td>
            <td class="amount">${formatCurrency(totalPending)}</td>
          </tr>
        </tbody>
      </table>

      <div class="footer">
        Generated on ${formatDate(new Date())}
      </div>
    </body>
    </html>
  `;
};

/**
 * Generate HTML for PDF - Annual Employee Earnings (Tax Document)
 */
export const generateEmployeeEarningsHTML = (employees, year, businessName = "Your Business") => {
  const totalEarnings = employees.reduce((sum, e) => sum + (e.totalPaid || 0), 0);
  const totalJobs = employees.reduce((sum, e) => sum + (e.jobCount || 0), 0);

  const employeeRows = employees.map((emp) => `
    <tr>
      <td>${emp.employee?.firstName || ""} ${emp.employee?.lastName || ""}</td>
      <td class="amount">${emp.jobCount || 0}</td>
      <td class="amount">${formatCurrency(emp.totalPaid)}</td>
      <td class="amount">${(emp.totalPaid || 0) >= 60000 ? "Yes" : "No"}</td>
    </tr>
  `).join("");

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 40px; color: #1a1a1a; }
        .header { text-align: center; margin-bottom: 30px; border-bottom: 2px solid #2563eb; padding-bottom: 20px; }
        .header h1 { margin: 0; color: #2563eb; font-size: 24px; }
        .header p { margin: 5px 0 0; color: #666; }
        .tax-notice { background: #fef3c7; border: 1px solid #f59e0b; border-radius: 8px; padding: 15px; margin-bottom: 25px; }
        .tax-notice p { margin: 0; color: #92400e; font-size: 13px; }
        table { width: 100%; border-collapse: collapse; margin-top: 10px; }
        th, td { padding: 12px 15px; text-align: left; border-bottom: 1px solid #e5e7eb; }
        th { background: #f1f5f9; font-weight: 600; color: #374151; }
        tr:nth-child(even) { background: #f8fafc; }
        .amount { text-align: right; }
        .total-row { font-weight: bold; border-top: 2px solid #374151; background: #f1f5f9; }
        .footer { margin-top: 30px; text-align: center; color: #9ca3af; font-size: 12px; }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>${businessName}</h1>
        <p>Employee Earnings Report - Tax Year ${year}</p>
      </div>

      <div class="tax-notice">
        <p><strong>Tax Information:</strong> Contractors earning $600 or more require a 1099-NEC form. This report shows annual earnings for all employees/contractors.</p>
      </div>

      <table>
        <thead>
          <tr>
            <th>Employee/Contractor Name</th>
            <th class="amount">Jobs Completed</th>
            <th class="amount">Total Earnings</th>
            <th class="amount">1099 Required</th>
          </tr>
        </thead>
        <tbody>
          ${employeeRows}
          <tr class="total-row">
            <td>Total</td>
            <td class="amount">${totalJobs}</td>
            <td class="amount">${formatCurrency(totalEarnings)}</td>
            <td class="amount">-</td>
          </tr>
        </tbody>
      </table>

      <div class="footer">
        Generated on ${formatDate(new Date())} | For tax year ${year}
      </div>
    </body>
    </html>
  `;
};

/**
 * Generate HTML for PDF - Annual Payroll Summary (Tax Document)
 */
export const generatePayrollSummaryHTML = (data, year, businessName = "Your Business") => {
  const {
    totalRevenue = 0,
    platformFees = 0,
    totalPayroll = 0,
    stripeFees = 0,
    netProfit = 0,
    completedJobs = 0,
    employeeCount: _employeeCount = 0,
  } = data;

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 40px; color: #1a1a1a; }
        .header { text-align: center; margin-bottom: 30px; border-bottom: 2px solid #2563eb; padding-bottom: 20px; }
        .header h1 { margin: 0; color: #2563eb; font-size: 24px; }
        .header p { margin: 5px 0 0; color: #666; }
        .summary-grid { display: flex; flex-wrap: wrap; gap: 15px; margin-bottom: 25px; }
        .summary-card { flex: 1; min-width: 45%; background: #f8fafc; padding: 20px; border-radius: 8px; text-align: center; }
        .summary-card h3 { margin: 0; font-size: 28px; color: #2563eb; }
        .summary-card.profit h3 { color: #16a34a; }
        .summary-card p { margin: 8px 0 0; color: #666; font-size: 13px; }
        .section { margin-top: 25px; }
        .section h2 { font-size: 16px; color: #374151; margin-bottom: 15px; border-bottom: 1px solid #e5e7eb; padding-bottom: 10px; }
        table { width: 100%; border-collapse: collapse; }
        th, td { padding: 12px 15px; text-align: left; border-bottom: 1px solid #e5e7eb; }
        th { background: #f1f5f9; font-weight: 600; color: #374151; }
        .amount { text-align: right; font-weight: 500; }
        .negative { color: #dc2626; }
        .positive { color: #16a34a; }
        .total-row { font-weight: bold; border-top: 2px solid #374151; background: #f1f5f9; }
        .footer { margin-top: 30px; text-align: center; color: #9ca3af; font-size: 12px; }
        .tax-info { background: #eff6ff; border: 1px solid #3b82f6; border-radius: 8px; padding: 15px; margin-top: 25px; }
        .tax-info p { margin: 0; color: #1e40af; font-size: 13px; }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>${businessName}</h1>
        <p>Annual Payroll Summary - Tax Year ${year}</p>
      </div>

      <div class="summary-grid">
        <div class="summary-card">
          <h3>${formatCurrency(totalRevenue)}</h3>
          <p>Gross Revenue</p>
        </div>
        <div class="summary-card profit">
          <h3>${formatCurrency(netProfit)}</h3>
          <p>Net Profit</p>
        </div>
        <div class="summary-card">
          <h3>${formatCurrency(totalPayroll)}</h3>
          <p>Total Payroll</p>
        </div>
        <div class="summary-card">
          <h3>${completedJobs}</h3>
          <p>Jobs Completed</p>
        </div>
      </div>

      <div class="section">
        <h2>Financial Breakdown</h2>
        <table>
          <tbody>
            <tr>
              <td>Gross Revenue</td>
              <td class="amount positive">${formatCurrency(totalRevenue)}</td>
            </tr>
            <tr>
              <td>Platform Fees</td>
              <td class="amount negative">-${formatCurrency(platformFees)}</td>
            </tr>
            <tr>
              <td>Employee/Contractor Payroll</td>
              <td class="amount negative">-${formatCurrency(totalPayroll)}</td>
            </tr>
            ${stripeFees > 0 ? `
            <tr>
              <td>Payment Processing Fees</td>
              <td class="amount negative">-${formatCurrency(stripeFees)}</td>
            </tr>
            ` : ""}
            <tr class="total-row">
              <td>Net Profit</td>
              <td class="amount ${netProfit >= 0 ? 'positive' : 'negative'}">${formatCurrency(netProfit)}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div class="tax-info">
        <p><strong>Tax Note:</strong> This summary is for your records. You will receive a 1099-K from Stripe for payments processed through the platform. Consult a tax professional for specific guidance.</p>
      </div>

      <div class="footer">
        Generated on ${formatDate(new Date())} | For tax year ${year}
      </div>
    </body>
    </html>
  `;
};

/**
 * Prepare data for CSV export - Financial Summary
 */
export const prepareFinancialSummaryCSV = (data) => {
  const {
    totalRevenue = 0,
    platformFees = 0,
    totalPayroll = 0,
    stripeFees = 0,
    netProfit = 0,
    completedJobs = 0,
  } = data;

  return [
    { Category: "Gross Revenue", Amount: formatCurrency(totalRevenue) },
    { Category: "Platform Fees", Amount: `-${formatCurrency(platformFees)}` },
    { Category: "Employee Payroll", Amount: `-${formatCurrency(totalPayroll)}` },
    ...(stripeFees > 0 ? [{ Category: "Stripe Fees", Amount: `-${formatCurrency(stripeFees)}` }] : []),
    { Category: "Net Profit", Amount: formatCurrency(netProfit) },
    { Category: "", Amount: "" },
    { Category: "Jobs Completed", Amount: completedJobs.toString() },
  ];
};

/**
 * Prepare data for CSV export - Payroll by Employee
 */
export const preparePayrollByEmployeeCSV = (employees) => {
  return employees.map((emp) => ({
    "Employee Name": `${emp.employee?.firstName || ""} ${emp.employee?.lastName || ""}`.trim(),
    "Jobs Completed": emp.jobCount || 0,
    "Total Paid": formatCurrency(emp.totalPaid),
    "Pending": formatCurrency(emp.pending),
  }));
};

/**
 * Prepare data for CSV export - Annual Employee Earnings
 */
export const prepareEmployeeEarningsCSV = (employees, year) => {
  return employees.map((emp) => ({
    "Employee/Contractor Name": `${emp.employee?.firstName || ""} ${emp.employee?.lastName || ""}`.trim(),
    "Tax Year": year,
    "Jobs Completed": emp.jobCount || 0,
    "Total Earnings": formatCurrency(emp.totalPaid),
    "1099 Required": (emp.totalPaid || 0) >= 60000 ? "Yes" : "No",
  }));
};

export default {
  generateCSV,
  generatePDF,
  generateFinancialSummaryHTML,
  generatePayrollByEmployeeHTML,
  generateEmployeeEarningsHTML,
  generatePayrollSummaryHTML,
  prepareFinancialSummaryCSV,
  preparePayrollByEmployeeCSV,
  prepareEmployeeEarningsCSV,
};
