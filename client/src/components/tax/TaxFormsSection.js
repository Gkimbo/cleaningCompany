import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Dimensions,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import TaxService from "../../services/fetchRequests/TaxService";

const { width } = Dimensions.get("window");

const TaxFormsSection = ({ state }) => {
  const [loading, setLoading] = useState(false);
  const [taxData, setTaxData] = useState(null);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [error, setError] = useState(null);

  const currentYear = new Date().getFullYear();
  const availableYears = [currentYear, currentYear - 1, currentYear - 2];

  const userType = state.account; // "cleaner", "owner1", or null/undefined (homeowner)

  useEffect(() => {
    if (!state.currentUser.token) return;
    fetchTaxData();
  }, [selectedYear, state.currentUser.token]);

  const fetchTaxData = async () => {
    setLoading(true);
    setError(null);

    try {
      let data;
      if (userType === "cleaner") {
        data = await TaxService.getCleanerTaxSummary(
          state.currentUser.token,
          selectedYear
        );
      } else if (userType === "owner1") {
        data = await TaxService.getPlatformTaxReport(
          state.currentUser.token,
          selectedYear
        );
      } else {
        // Homeowner
        data = await TaxService.getPaymentHistory(
          state.currentUser.token,
          selectedYear
        );
      }

      if (data.error) {
        setError(data.message || "Failed to load tax information");
        setTaxData(null);
      } else {
        setTaxData(data);
      }
    } catch (err) {
      setError("Failed to load tax information");
      setTaxData(null);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (cents) => {
    if (cents === undefined || cents === null) return "$0.00";
    return `$${(cents / 100).toFixed(2)}`;
  };

  const renderCleanerTaxInfo = () => {
    if (!taxData) return null;

    return (
      <View style={styles.taxContent}>
        <Text style={styles.taxTitle}>1099-NEC Tax Summary</Text>
        <Text style={styles.taxSubtitle}>Tax Year {selectedYear}</Text>

        <View style={styles.taxRow}>
          <Text style={styles.taxLabel}>Total Earnings:</Text>
          <Text style={styles.taxValue}>
            {formatCurrency(taxData.totalEarningsCents)}
          </Text>
        </View>

        <View style={styles.taxRow}>
          <Text style={styles.taxLabel}>Number of Jobs:</Text>
          <Text style={styles.taxValue}>{taxData.jobCount || 0}</Text>
        </View>

        {taxData.totalEarningsCents >= 60000 && (
          <View style={styles.noticeBox}>
            <Text style={styles.noticeText}>
              You will receive a 1099-NEC form since your earnings exceed $600.
            </Text>
          </View>
        )}

        <Text style={styles.taxHint}>
          Keep track of your expenses for potential deductions.
        </Text>
      </View>
    );
  };

  const renderHomeownerTaxInfo = () => {
    if (!taxData) return null;

    return (
      <View style={styles.taxContent}>
        <Text style={styles.taxTitle}>Payment History</Text>
        <Text style={styles.taxSubtitle}>Tax Year {selectedYear}</Text>

        <View style={styles.taxRow}>
          <Text style={styles.taxLabel}>Total Payments:</Text>
          <Text style={styles.taxValue}>
            {formatCurrency(taxData.totalPaidCents)}
          </Text>
        </View>

        <View style={styles.taxRow}>
          <Text style={styles.taxLabel}>Number of Services:</Text>
          <Text style={styles.taxValue}>{taxData.paymentCount || 0}</Text>
        </View>

        <Text style={styles.taxHint}>
          Cleaning services may be tax deductible if used for business purposes.
        </Text>
      </View>
    );
  };

  const renderOwnerTaxInfo = () => {
    if (!taxData) return null;

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
          <Text style={styles.sectionTitle}>Estimated Tax Payments</Text>
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

        <Text style={styles.taxHint}>
          Consult with a tax professional for accurate filing requirements.
        </Text>
      </View>
    );
  };

  const renderTaxContent = () => {
    if (loading) {
      return (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#3a8dff" />
          <Text style={styles.loadingText}>Loading tax information...</Text>
        </View>
      );
    }

    if (error) {
      return (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
          <Pressable style={styles.retryButton} onPress={fetchTaxData}>
            <Text style={styles.retryButtonText}>Retry</Text>
          </Pressable>
        </View>
      );
    }

    if (userType === "cleaner") {
      return renderCleanerTaxInfo();
    } else if (userType === "owner1") {
      return renderOwnerTaxInfo();
    } else {
      return renderHomeownerTaxInfo();
    }
  };

  // Don't show if not logged in
  if (!state.currentUser.token) {
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
  },
  noticeBox: {
    backgroundColor: "#fef3c7",
    borderRadius: 8,
    padding: 12,
    marginTop: 12,
    borderLeftWidth: 4,
    borderLeftColor: "#f59e0b",
  },
  noticeText: {
    fontSize: 13,
    color: "#92400e",
  },
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
  loadingContainer: {
    alignItems: "center",
    paddingVertical: 30,
  },
  loadingText: {
    marginTop: 10,
    fontSize: 14,
    color: "#64748b",
  },
  errorContainer: {
    alignItems: "center",
    paddingVertical: 20,
  },
  errorText: {
    fontSize: 14,
    color: "#dc2626",
    marginBottom: 12,
    textAlign: "center",
  },
  retryButton: {
    backgroundColor: "#3a8dff",
    paddingVertical: 8,
    paddingHorizontal: 20,
    borderRadius: 20,
  },
  retryButtonText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "500",
  },
});

export default TaxFormsSection;
