import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Dimensions,
  Linking,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useNavigate } from "react-router-native";
import Icon from "react-native-vector-icons/FontAwesome";
import TaxService from "../../services/fetchRequests/TaxService";

const { width } = Dimensions.get("window");

/**
 * TaxFormsSection Component
 *
 * Displays tax information for different user types:
 * - Cleaners: Earnings summary + link to Stripe Dashboard for 1099 forms
 * - Business Owners: Platform tax reports for Schedule C filing
 * - Homeowners: Informational message (no tax forms issued)
 *
 * IMPORTANT: This component is designed to NEVER crash the app.
 * All errors are caught and displayed as user-friendly messages.
 */
const TaxFormsSection = ({ state }) => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [taxData, setTaxData] = useState(null);
  const [taxStatus, setTaxStatus] = useState(null);
  const [statusLoading, setStatusLoading] = useState(true);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [error, setError] = useState(null);
  const [statusError, setStatusError] = useState(null);
  const [dashboardLoading, setDashboardLoading] = useState(false);
  const [dashboardError, setDashboardError] = useState(null);

  const currentYear = new Date().getFullYear();
  const availableYears = [currentYear, currentYear - 1, currentYear - 2];

  // Safely get user type with fallback
  // Employees are treated like cleaners for tax purposes (they receive 1099s)
  const rawUserType = state?.account || null;
  const userType = rawUserType === "employee" ? "cleaner" : rawUserType;

  useEffect(() => {
    if (!state?.currentUser?.token) return;

    // Reset errors when year changes
    setError(null);
    setDashboardError(null);

    fetchTaxData();

    // Fetch Stripe status for cleaners/employees
    if (userType === "cleaner") {
      fetchTaxStatus();
    }
  }, [selectedYear, state?.currentUser?.token, userType]);

  const fetchTaxStatus = async () => {
    setStatusError(null);
    setStatusLoading(true);
    try {
      const status = await TaxService.getTaxStatus(state.currentUser.token);
      if (status && !status.error) {
        setTaxStatus(status);
      } else {
        // Don't show error for status - it's not critical
        setTaxStatus(null);
        console.log("Tax status check returned error:", status?.message);
      }
    } catch (err) {
      // Silently fail - status is supplementary info
      setTaxStatus(null);
      console.log("Could not fetch tax status:", err?.message);
    } finally {
      setStatusLoading(false);
    }
  };

  const fetchTaxData = async () => {
    setLoading(true);
    setError(null);

    try {
      let data;

      if (userType === "cleaner") {
        data = await TaxService.getEarnings(state.currentUser.token, selectedYear);
      } else if (userType === "owner") {
        data = await TaxService.getPlatformTaxReport(state.currentUser.token, selectedYear);
      } else {
        // Homeowner - no tax data needed
        setTaxData({ noData: true });
        setLoading(false);
        return;
      }

      if (!data) {
        setError("Unable to retrieve tax information. Please try again later.");
        setTaxData(null);
      } else if (data.error) {
        // Handle specific error codes with user-friendly messages
        const errorMessage = getErrorMessage(data.code, data.message);
        setError(errorMessage);
        setTaxData(null);
      } else {
        setTaxData(data);
        setError(null);
      }
    } catch (err) {
      console.error("Tax data fetch error:", err);
      setError(
        "We couldn't load your tax information right now. This won't affect your earnings or tax documents. Please try again later."
      );
      setTaxData(null);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Convert error codes to user-friendly messages
   */
  const getErrorMessage = (code, defaultMessage) => {
    const errorMessages = {
      UNAUTHORIZED: "Your session has expired. Please log out and log back in to view tax information.",
      FORBIDDEN: "You don't have permission to view this tax information.",
      INVALID_YEAR: "The selected tax year is not available. Please choose a different year.",
      FETCH_FAILED: "We're having trouble connecting to our servers. Your tax documents are safe - please try again in a few minutes.",
      STRIPE_NOT_CONFIGURED: "Tax document access is being set up. Please check back later.",
      ACCOUNT_NOT_FOUND: "Please complete your payment setup in the Earnings section to access tax documents.",
      ONBOARDING_INCOMPLETE: "Please complete your Stripe payment setup to access tax documents.",
      LINK_GENERATION_FAILED: "We couldn't open the tax document portal right now. Please try again in a few minutes.",
    };

    return errorMessages[code] || defaultMessage || "Something went wrong. Please try again later.";
  };

  const openStripeDashboard = async () => {
    setDashboardLoading(true);
    setDashboardError(null);

    try {
      const result = await TaxService.getDashboardLink(state.currentUser.token);

      if (!result) {
        setDashboardError("Unable to connect to Stripe. Please try again.");
      } else if (result.error) {
        setDashboardError(getErrorMessage(result.code, result.message));
      } else if (result.url) {
        const canOpen = await Linking.canOpenURL(result.url);
        if (canOpen) {
          await Linking.openURL(result.url);
        } else {
          setDashboardError("Unable to open the Stripe Dashboard. Please try accessing it from a web browser.");
        }
      } else {
        setDashboardError("No dashboard link was returned. Please try again.");
      }
    } catch (err) {
      console.error("Dashboard link error:", err);
      setDashboardError(
        "We couldn't open the Stripe Dashboard right now. Your tax documents are still available - please try again in a few minutes."
      );
    } finally {
      setDashboardLoading(false);
    }
  };

  const formatCurrency = (cents) => {
    try {
      if (cents === undefined || cents === null || isNaN(cents)) return "$0.00";
      return `$${(Number(cents) / 100).toFixed(2)}`;
    } catch {
      return "$0.00";
    }
  };

  const renderDisclaimer = () => (
    <View style={styles.disclaimerBox}>
      <Text style={styles.disclaimerText}>
        This information is provided for your reference only and should not be considered tax advice.
        Please consult a qualified tax professional for guidance on your specific tax situation.
      </Text>
    </View>
  );

  /**
   * Prominent setup banner for employees/cleaners who need to set up Stripe
   * This is shown at the TOP of the tax section to make it clear what's needed
   */
  const renderStripeSetupBanner = () => {
    // Still loading status - show loading state
    if (statusLoading) {
      return (
        <View style={styles.setupBannerLoading}>
          <ActivityIndicator size="small" color="#3a8dff" />
          <Text style={styles.setupBannerLoadingText}>
            Checking your payment setup status...
          </Text>
        </View>
      );
    }

    // No Stripe account at all - show prominent setup banner
    if (taxStatus && !taxStatus.stripeConnected) {
      return (
        <View style={styles.setupBanner}>
          <View style={styles.setupBannerIcon}>
            <Icon name="exclamation-triangle" size={24} color="#dc2626" />
          </View>
          <View style={styles.setupBannerContent}>
            <Text style={styles.setupBannerTitle}>
              Payment Setup Required for Tax Documents
            </Text>
            <Text style={styles.setupBannerText}>
              To receive your 1099 tax forms, you need to complete your payment setup.
              Stripe securely collects your tax information (like SSN) during this process.
            </Text>
            <View style={styles.setupBannerSteps}>
              <Text style={styles.setupBannerStepTitle}>What you'll need:</Text>
              <Text style={styles.setupBannerStep}>• Social Security Number (SSN) or EIN</Text>
              <Text style={styles.setupBannerStep}>• Bank account for direct deposits</Text>
              <Text style={styles.setupBannerStep}>• Valid ID for verification</Text>
            </View>
          </View>
          <Pressable
            style={styles.setupBannerButton}
            onPress={() => navigate("/earnings")}
          >
            <Icon name="credit-card" size={16} color="#fff" style={{ marginRight: 8 }} />
            <Text style={styles.setupBannerButtonText}>Set Up Payments</Text>
          </Pressable>
        </View>
      );
    }

    // Stripe connected but onboarding not complete
    if (taxStatus && taxStatus.stripeConnected && !taxStatus.onboardingComplete) {
      return (
        <View style={[styles.setupBanner, styles.setupBannerWarning]}>
          <View style={styles.setupBannerIcon}>
            <Icon name="clock-o" size={24} color="#f59e0b" />
          </View>
          <View style={styles.setupBannerContent}>
            <Text style={[styles.setupBannerTitle, styles.setupBannerTitleWarning]}>
              Complete Your Payment Setup
            </Text>
            <Text style={[styles.setupBannerText, styles.setupBannerTextWarning]}>
              Your Stripe account setup is incomplete. Please finish the onboarding
              process to receive earnings and tax documents.
            </Text>
            <Text style={[styles.setupBannerSubtext, styles.setupBannerSubtextWarning]}>
              This usually takes less than 5 minutes to complete.
            </Text>
          </View>
          <Pressable
            style={[styles.setupBannerButton, styles.setupBannerButtonWarning]}
            onPress={() => navigate("/earnings")}
          >
            <Icon name="arrow-right" size={16} color="#fff" style={{ marginRight: 8 }} />
            <Text style={styles.setupBannerButtonText}>Continue Setup</Text>
          </Pressable>
        </View>
      );
    }

    // Everything is good - no banner needed
    return null;
  };

  const renderCleanerTaxInfo = () => {
    // Show setup banner prominently at the top if needed
    const setupBanner = renderStripeSetupBanner();

    // Show helpful message even if data failed to load
    if (!taxData) {
      return (
        <View style={styles.taxContent}>
          {/* Prominent setup banner if Stripe not connected */}
          {setupBanner}

          <Text style={styles.taxTitle}>Earnings Summary</Text>
          <Text style={styles.taxSubtitle}>Tax Year {selectedYear}</Text>

          <View style={[styles.noticeBox, styles.noticeBoxInfo]}>
            <Text style={[styles.noticeText, styles.noticeTextInfo]}>
              Your earnings information is temporarily unavailable. This does not affect your actual earnings or tax documents.
            </Text>
          </View>

          {/* Only show dashboard access if Stripe is set up */}
          {taxStatus?.canReceive1099 && renderStripeAccessSection()}
          {renderDisclaimer()}
        </View>
      );
    }

    return (
      <View style={styles.taxContent}>
        {/* Prominent setup banner if Stripe not connected */}
        {setupBanner}

        <Text style={styles.taxTitle}>Earnings Summary</Text>
        <Text style={styles.taxSubtitle}>Tax Year {selectedYear}</Text>

        <View style={styles.taxRow}>
          <Text style={styles.taxLabel}>Total Earnings:</Text>
          <Text style={styles.taxValue}>
            ${taxData.totalEarningsDollars || "0.00"}
          </Text>
        </View>

        <View style={styles.taxRow}>
          <Text style={styles.taxLabel}>Number of Jobs:</Text>
          <Text style={styles.taxValue}>{taxData.transactionCount || 0}</Text>
        </View>

        {/* 1099 Status Notice */}
        {taxData.requires1099 ? (
          <View style={styles.noticeBox}>
            <Text style={styles.noticeTitle}>1099-NEC Form Required</Text>
            <Text style={styles.noticeText}>
              Your earnings exceed $600, so you will receive a 1099-NEC form for tax filing.
              {taxStatus?.canReceive1099
                ? " Access your official tax documents through the Stripe Dashboard below."
                : " Complete your payment setup above to access your 1099 forms."}
            </Text>
          </View>
        ) : (
          <View style={[styles.noticeBox, styles.noticeBoxInfo]}>
            <Text style={[styles.noticeTitle, styles.noticeTitleInfo]}>No 1099 Form Required</Text>
            <Text style={[styles.noticeText, styles.noticeTextInfo]}>
              Your earnings are below the $600 IRS threshold. You won't receive a 1099-NEC form,
              but you may still need to report this income on your tax return.
            </Text>
          </View>
        )}

        {/* Only show dashboard access if Stripe is fully set up */}
        {taxStatus?.canReceive1099 && renderStripeAccessSection()}
        {renderDisclaimer()}
      </View>
    );
  };

  const renderStripeAccessSection = () => (
    <View style={styles.stripeSection}>
      {/* Dashboard Error */}
      {dashboardError && (
        <View style={styles.inlineWarningBox}>
          <Text style={styles.inlineWarningText}>{dashboardError}</Text>
          <Pressable onPress={() => setDashboardError(null)}>
            <Text style={styles.dismissText}>Dismiss</Text>
          </Pressable>
        </View>
      )}

      {/* Only show dashboard access when fully set up */}
      <View style={styles.successBox}>
        <Icon name="check-circle" size={16} color="#065f46" style={{ marginRight: 8 }} />
        <Text style={styles.successText}>
          Your payment account is set up and ready to receive tax documents.
        </Text>
      </View>

      <Pressable
        style={[styles.dashboardButton, dashboardLoading && styles.dashboardButtonDisabled]}
        onPress={openStripeDashboard}
        disabled={dashboardLoading}
      >
        {dashboardLoading ? (
          <ActivityIndicator size="small" color="#fff" />
        ) : (
          <>
            <View style={styles.dashboardButtonContent}>
              <Icon name="external-link" size={18} color="#fff" style={{ marginRight: 10 }} />
              <View>
                <Text style={styles.dashboardButtonText}>
                  View Tax Forms in Stripe Dashboard
                </Text>
                <Text style={styles.dashboardButtonSubtext}>
                  Access your official 1099-NEC documents
                </Text>
              </View>
            </View>
          </>
        )}
      </Pressable>

      <Text style={styles.taxHint}>
        Your 1099 forms are securely managed by Stripe. They handle tax document generation,
        delivery, and IRS compliance on your behalf.
      </Text>
    </View>
  );

  const renderHomeownerTaxInfo = () => {
    return (
      <View style={styles.taxContent}>
        <Text style={styles.taxTitle}>Tax Information</Text>
        <Text style={styles.taxSubtitle}>Tax Year {selectedYear}</Text>

        <View style={[styles.noticeBox, styles.noticeBoxInfo]}>
          <Text style={[styles.noticeTitle, styles.noticeTitleInfo]}>No Tax Forms Issued</Text>
          <Text style={[styles.noticeText, styles.noticeTextInfo]}>
            As a homeowner using our cleaning services, you do not receive tax forms from us.
            Your payment receipts are available in your payment history.
          </Text>
        </View>

        <View style={styles.helpBox}>
          <Text style={styles.helpTitle}>Potential Tax Deductions</Text>
          <Text style={styles.helpText}>
            If you use cleaning services for a home office or rental property, these expenses
            may be tax deductible. Keep your payment receipts and consult a tax professional.
          </Text>
        </View>

        {renderDisclaimer()}
      </View>
    );
  };

  const renderOwnerTaxInfo = () => {
    // Show helpful message even if data failed to load
    if (!taxData) {
      return (
        <View style={styles.taxContent}>
          <Text style={styles.taxTitle}>Platform Tax Report</Text>
          <Text style={styles.taxSubtitle}>Tax Year {selectedYear}</Text>

          <View style={[styles.noticeBox, styles.noticeBoxInfo]}>
            <Text style={[styles.noticeText, styles.noticeTextInfo]}>
              Your tax report is temporarily unavailable. This does not affect your actual earnings
              or tax obligations. Please try again later.
            </Text>
          </View>

          {renderDisclaimer()}
        </View>
      );
    }

    const annual = taxData.incomeSummary?.annual || {};
    const quarterlyTaxes = taxData.quarterlyTaxes || {};

    return (
      <View style={styles.taxContent}>
        <Text style={styles.taxTitle}>Platform Tax Report</Text>
        <Text style={styles.taxSubtitle}>Tax Year {selectedYear}</Text>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Annual Summary</Text>
        </View>

        <View style={styles.taxRow}>
          <Text style={styles.taxLabel}>Gross Platform Fees:</Text>
          <Text style={styles.taxValue}>
            {formatCurrency(annual.totalPlatformFeesCents)}
          </Text>
        </View>

        <View style={styles.taxRow}>
          <Text style={styles.taxLabel}>Net Earnings:</Text>
          <Text style={styles.taxValue}>
            {formatCurrency(annual.totalNetEarningsCents)}
          </Text>
        </View>

        <View style={styles.taxRow}>
          <Text style={styles.taxLabel}>Total Transactions:</Text>
          <Text style={styles.taxValue}>{annual.transactionCount || 0}</Text>
        </View>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Estimated Quarterly Tax</Text>
        </View>

        <View style={styles.taxRow}>
          <Text style={styles.taxLabel}>Total Estimated Tax:</Text>
          <Text style={styles.taxValueHighlight}>
            ${quarterlyTaxes.totalEstimatedTaxPaid || "0.00"}
          </Text>
        </View>

        <View style={styles.quarterGrid}>
          {["q1", "q2", "q3", "q4"].map((q, idx) => (
            <View key={q} style={styles.quarterBox}>
              <Text style={styles.quarterLabel}>Q{idx + 1}</Text>
              <Text style={styles.quarterValue}>
                ${quarterlyTaxes[q]?.totalEstimatedTax || "0.00"}
              </Text>
            </View>
          ))}
        </View>

        <View style={styles.helpBox}>
          <Text style={styles.helpTitle}>Important Tax Reminders</Text>
          <Text style={styles.helpText}>
            As a business owner, you're responsible for quarterly estimated tax payments.
            These figures are estimates only - please work with a tax professional for accurate calculations.
          </Text>
        </View>

        {renderDisclaimer()}
      </View>
    );
  };

  const renderTaxContent = () => {
    if (loading) {
      return (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#3a8dff" />
          <Text style={styles.loadingText}>Loading tax information...</Text>
          <Text style={styles.loadingSubtext}>This may take a moment</Text>
        </View>
      );
    }

    if (error) {
      return (
        <View style={styles.errorContainer}>
          <Text style={styles.errorTitle}>Unable to Load Tax Information</Text>
          <Text style={styles.errorText}>{error}</Text>

          <View style={styles.errorHelpBox}>
            <Text style={styles.errorHelpText}>
              Your tax documents and earnings are safe. This is just a temporary display issue.
            </Text>
          </View>

          <Pressable style={styles.retryButton} onPress={fetchTaxData}>
            <Text style={styles.retryButtonText}>Try Again</Text>
          </Pressable>

          {/* Show basic info even on error for cleaners */}
          {userType === "cleaner" && (
            <View style={styles.errorFallback}>
              <Text style={styles.errorFallbackTitle}>While you wait:</Text>
              <Text style={styles.errorFallbackText}>
                Your 1099 tax forms are available in your Stripe Dashboard.
                If you've completed payment setup, you can access them there directly.
              </Text>
            </View>
          )}
        </View>
      );
    }

    try {
      if (userType === "cleaner") {
        return renderCleanerTaxInfo();
      } else if (userType === "owner") {
        return renderOwnerTaxInfo();
      } else {
        return renderHomeownerTaxInfo();
      }
    } catch (renderError) {
      // Catch any rendering errors to prevent crashes
      console.error("Tax section render error:", renderError);
      return (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>
            Something went wrong displaying your tax information.
            Please try refreshing the page.
          </Text>
          <Pressable style={styles.retryButton} onPress={fetchTaxData}>
            <Text style={styles.retryButtonText}>Refresh</Text>
          </Pressable>
        </View>
      );
    }
  };

  // Safe render - never crash the app
  try {
    // Don't show if not logged in
    if (!state?.currentUser?.token) {
      return null;
    }

    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Tax Documents</Text>
          <View style={styles.yearSelector}>
            {availableYears.map((year) => (
              <Pressable
                key={year}
                style={[
                  styles.yearButton,
                  selectedYear === year && styles.yearButtonActive,
                ]}
                onPress={() => setSelectedYear(year)}
              >
                <Text
                  style={[
                    styles.yearButtonText,
                    selectedYear === year && styles.yearButtonTextActive,
                  ]}
                >
                  {year}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
        {renderTaxContent()}
      </View>
    );
  } catch (err) {
    // Ultimate fallback - component should never crash
    console.error("TaxFormsSection critical error:", err);
    return (
      <View style={styles.container}>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>
            Tax information is temporarily unavailable.
            Your documents are safe and accessible through Stripe.
          </Text>
        </View>
      </View>
    );
  }
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: "#fff",
    borderRadius: 15,
    padding: 20,
    marginTop: 20,
    marginBottom: 20,
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 5,
    elevation: 3,
  },
  header: {
    flexDirection: "column",
    alignItems: "center",
    marginBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
    paddingBottom: 16,
  },
  headerTitle: {
    fontSize: width < 400 ? 18 : 22,
    fontWeight: "bold",
    color: "#1e3a8a",
    marginBottom: 12,
  },
  yearSelector: {
    flexDirection: "row",
    gap: 8,
  },
  yearButton: {
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 20,
    backgroundColor: "#f1f5f9",
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  yearButtonActive: {
    backgroundColor: "#3a8dff",
    borderColor: "#3a8dff",
  },
  yearButtonText: {
    fontSize: 14,
    color: "#64748b",
    fontWeight: "500",
  },
  yearButtonTextActive: {
    color: "#fff",
  },
  taxContent: {
    paddingTop: 8,
  },
  taxTitle: {
    fontSize: width < 400 ? 16 : 18,
    fontWeight: "600",
    color: "#1e40af",
    textAlign: "center",
    marginBottom: 4,
  },
  taxSubtitle: {
    fontSize: 14,
    color: "#64748b",
    textAlign: "center",
    marginBottom: 16,
  },
  taxRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
  },
  taxLabel: {
    fontSize: 14,
    color: "#475569",
  },
  taxValue: {
    fontSize: 16,
    fontWeight: "600",
    color: "#0f172a",
  },
  taxValueHighlight: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#3a8dff",
  },
  taxHint: {
    fontSize: 12,
    color: "#94a3b8",
    fontStyle: "italic",
    textAlign: "center",
    marginTop: 16,
    lineHeight: 18,
  },
  // Notice boxes
  noticeBox: {
    backgroundColor: "#fef3c7",
    borderRadius: 8,
    padding: 12,
    marginTop: 12,
    borderLeftWidth: 4,
    borderLeftColor: "#f59e0b",
  },
  noticeBoxInfo: {
    backgroundColor: "#eff6ff",
    borderLeftColor: "#3b82f6",
  },
  noticeTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#92400e",
    marginBottom: 4,
  },
  noticeTitleInfo: {
    color: "#1e40af",
  },
  noticeText: {
    fontSize: 13,
    color: "#92400e",
    lineHeight: 18,
  },
  noticeTextInfo: {
    color: "#1e40af",
  },
  // Warning boxes
  warningBox: {
    backgroundColor: "#fef2f2",
    borderRadius: 8,
    padding: 12,
    marginTop: 12,
    borderLeftWidth: 4,
    borderLeftColor: "#ef4444",
  },
  warningTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#991b1b",
    marginBottom: 4,
  },
  warningText: {
    fontSize: 13,
    color: "#991b1b",
    lineHeight: 18,
  },
  // Inline warning (dismissible)
  inlineWarningBox: {
    backgroundColor: "#fef2f2",
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  inlineWarningText: {
    fontSize: 13,
    color: "#991b1b",
    flex: 1,
    marginRight: 8,
  },
  dismissText: {
    fontSize: 12,
    color: "#3b82f6",
    fontWeight: "500",
  },
  // Success box
  successBox: {
    backgroundColor: "#ecfdf5",
    borderRadius: 8,
    padding: 12,
    marginTop: 12,
    borderLeftWidth: 4,
    borderLeftColor: "#10b981",
    flexDirection: "row",
    alignItems: "center",
  },
  successText: {
    fontSize: 13,
    color: "#065f46",
    flex: 1,
  },
  // Help boxes
  helpBox: {
    backgroundColor: "#f8fafc",
    borderRadius: 8,
    padding: 12,
    marginTop: 16,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  helpTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#374151",
    marginBottom: 4,
  },
  helpText: {
    fontSize: 13,
    color: "#64748b",
    lineHeight: 18,
  },
  // Disclaimer
  disclaimerBox: {
    backgroundColor: "#f9fafb",
    borderRadius: 8,
    padding: 12,
    marginTop: 16,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderStyle: "dashed",
  },
  disclaimerText: {
    fontSize: 11,
    color: "#6b7280",
    fontStyle: "italic",
    textAlign: "center",
    lineHeight: 16,
  },
  // Stripe section
  stripeSection: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: "#e5e7eb",
  },
  // Dashboard button
  dashboardButton: {
    backgroundColor: "#635bff",
    borderRadius: 8,
    padding: 14,
    marginTop: 12,
    alignItems: "center",
  },
  dashboardButtonDisabled: {
    opacity: 0.7,
  },
  dashboardButtonContent: {
    flexDirection: "row",
    alignItems: "center",
  },
  dashboardButtonText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "600",
  },
  dashboardButtonSubtext: {
    color: "rgba(255,255,255,0.8)",
    fontSize: 12,
    marginTop: 2,
  },
  // Setup banner for employees without Stripe
  setupBanner: {
    backgroundColor: "#fef2f2",
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: "#fecaca",
  },
  setupBannerWarning: {
    backgroundColor: "#fffbeb",
    borderColor: "#fde68a",
  },
  setupBannerLoading: {
    backgroundColor: "#f8fafc",
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  setupBannerLoadingText: {
    marginLeft: 10,
    fontSize: 14,
    color: "#64748b",
  },
  setupBannerIcon: {
    alignItems: "center",
    marginBottom: 12,
  },
  setupBannerContent: {
    marginBottom: 16,
  },
  setupBannerTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#991b1b",
    textAlign: "center",
    marginBottom: 8,
  },
  setupBannerTitleWarning: {
    color: "#92400e",
  },
  setupBannerText: {
    fontSize: 14,
    color: "#b91c1c",
    textAlign: "center",
    lineHeight: 20,
    marginBottom: 12,
  },
  setupBannerTextWarning: {
    color: "#a16207",
  },
  setupBannerSubtext: {
    fontSize: 13,
    color: "#b91c1c",
    textAlign: "center",
    fontStyle: "italic",
  },
  setupBannerSubtextWarning: {
    color: "#a16207",
  },
  setupBannerSteps: {
    backgroundColor: "rgba(255,255,255,0.5)",
    borderRadius: 8,
    padding: 12,
  },
  setupBannerStepTitle: {
    fontSize: 13,
    fontWeight: "600",
    color: "#7f1d1d",
    marginBottom: 6,
  },
  setupBannerStep: {
    fontSize: 13,
    color: "#991b1b",
    marginBottom: 4,
    paddingLeft: 4,
  },
  setupBannerButton: {
    backgroundColor: "#dc2626",
    borderRadius: 8,
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  setupBannerButtonWarning: {
    backgroundColor: "#f59e0b",
  },
  setupBannerButtonText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "600",
  },
  // Section headers
  sectionHeader: {
    marginTop: 16,
    marginBottom: 8,
    borderTopWidth: 1,
    borderTopColor: "#e5e7eb",
    paddingTop: 16,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: "#374151",
  },
  // Quarter grid
  quarterGrid: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 12,
    gap: 8,
  },
  quarterBox: {
    flex: 1,
    backgroundColor: "#f8fafc",
    borderRadius: 8,
    padding: 10,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  quarterLabel: {
    fontSize: 12,
    color: "#64748b",
    fontWeight: "500",
  },
  quarterValue: {
    fontSize: 14,
    fontWeight: "600",
    color: "#1e40af",
    marginTop: 4,
  },
  // Loading state
  loadingContainer: {
    alignItems: "center",
    paddingVertical: 30,
  },
  loadingText: {
    marginTop: 10,
    fontSize: 14,
    color: "#64748b",
  },
  loadingSubtext: {
    marginTop: 4,
    fontSize: 12,
    color: "#94a3b8",
  },
  // Error state
  errorContainer: {
    alignItems: "center",
    paddingVertical: 20,
  },
  errorTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#991b1b",
    marginBottom: 8,
  },
  errorText: {
    fontSize: 14,
    color: "#dc2626",
    marginBottom: 12,
    textAlign: "center",
    lineHeight: 20,
    paddingHorizontal: 10,
  },
  errorHelpBox: {
    backgroundColor: "#f0fdf4",
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    width: "100%",
  },
  errorHelpText: {
    fontSize: 13,
    color: "#166534",
    textAlign: "center",
  },
  errorFallback: {
    backgroundColor: "#f8fafc",
    borderRadius: 8,
    padding: 12,
    marginTop: 16,
    width: "100%",
  },
  errorFallbackTitle: {
    fontSize: 13,
    fontWeight: "600",
    color: "#374151",
    marginBottom: 4,
  },
  errorFallbackText: {
    fontSize: 12,
    color: "#64748b",
    lineHeight: 18,
  },
  retryButton: {
    backgroundColor: "#3a8dff",
    paddingVertical: 10,
    paddingHorizontal: 24,
    borderRadius: 20,
  },
  retryButtonText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
  },
});

export default TaxFormsSection;
