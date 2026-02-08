import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Pressable,
  ActivityIndicator,
} from "react-native";
import Icon from "react-native-vector-icons/FontAwesome";
import { colors, spacing, radius, typography, shadows } from "../../services/styles/theme";

const CURRENT_YEAR = new Date().getFullYear();
const AVAILABLE_YEARS = [CURRENT_YEAR, CURRENT_YEAR - 1, CURRENT_YEAR - 2];

const ExportModal = ({
  visible,
  onClose,
  exportType,
  onExport,
  showYearSelector = false,
  periodLabel = "",
}) => {
  const [format, setFormat] = useState("pdf");
  const [selectedYear, setSelectedYear] = useState(CURRENT_YEAR);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const getTitle = () => {
    switch (exportType) {
      case "summary":
        return "Export Financial Summary";
      case "payroll":
        return "Export Payroll Report";
      case "employee-earnings":
        return "Export Employee Earnings";
      case "payroll-summary":
        return "Export Payroll Summary";
      default:
        return "Export Report";
    }
  };

  const getDescription = () => {
    switch (exportType) {
      case "summary":
        return `Export your financial breakdown for ${periodLabel}`;
      case "payroll":
        return `Export employee payroll details for ${periodLabel}`;
      case "employee-earnings":
        return "Annual earnings report for tax filing (1099 preparation)";
      case "payroll-summary":
        return "Annual payroll summary for your tax records";
      default:
        return "Export your data";
    }
  };

  const handleExport = async () => {
    setLoading(true);
    setError(null);

    try {
      const result = await onExport(format, showYearSelector ? selectedYear : null);
      if (result?.success) {
        onClose();
      } else if (result?.error) {
        setError(result.error);
      }
    } catch (err) {
      setError(err.message || "Failed to export. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setError(null);
    setLoading(false);
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={handleClose}
    >
      <View style={styles.overlay}>
        <View style={styles.modal}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.iconContainer}>
              <Icon name="download" size={20} color={colors.primary[600]} />
            </View>
            <Text style={styles.title}>{getTitle()}</Text>
            <Text style={styles.description}>{getDescription()}</Text>
          </View>

          {/* Year Selector (for tax documents) */}
          {showYearSelector && (
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>Select Tax Year</Text>
              <View style={styles.yearSelector}>
                {AVAILABLE_YEARS.map((year) => (
                  <Pressable
                    key={year}
                    style={[
                      styles.yearOption,
                      selectedYear === year && styles.yearOptionSelected,
                    ]}
                    onPress={() => setSelectedYear(year)}
                  >
                    <Text
                      style={[
                        styles.yearOptionText,
                        selectedYear === year && styles.yearOptionTextSelected,
                      ]}
                    >
                      {year}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>
          )}

          {/* Format Selector */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Export Format</Text>
            <View style={styles.formatSelector}>
              <Pressable
                style={[
                  styles.formatOption,
                  format === "pdf" && styles.formatOptionSelected,
                ]}
                onPress={() => setFormat("pdf")}
              >
                <View style={[styles.formatIcon, format === "pdf" && styles.formatIconSelected]}>
                  <Icon
                    name="file-pdf-o"
                    size={20}
                    color={format === "pdf" ? colors.primary[600] : colors.neutral[400]}
                  />
                </View>
                <Text style={[styles.formatLabel, format === "pdf" && styles.formatLabelSelected]}>
                  PDF
                </Text>
                <Text style={styles.formatDescription}>
                  Professional document
                </Text>
              </Pressable>

              <Pressable
                style={[
                  styles.formatOption,
                  format === "csv" && styles.formatOptionSelected,
                ]}
                onPress={() => setFormat("csv")}
              >
                <View style={[styles.formatIcon, format === "csv" && styles.formatIconSelected]}>
                  <Icon
                    name="file-excel-o"
                    size={20}
                    color={format === "csv" ? colors.primary[600] : colors.neutral[400]}
                  />
                </View>
                <Text style={[styles.formatLabel, format === "csv" && styles.formatLabelSelected]}>
                  CSV
                </Text>
                <Text style={styles.formatDescription}>
                  Spreadsheet data
                </Text>
              </Pressable>
            </View>
          </View>

          {/* Error Message */}
          {error && (
            <View style={styles.errorContainer}>
              <Icon name="exclamation-circle" size={14} color={colors.error[600]} />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          {/* Actions */}
          <View style={styles.actions}>
            <Pressable
              style={styles.cancelButton}
              onPress={handleClose}
              disabled={loading}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </Pressable>

            <Pressable
              style={[styles.exportButton, loading && styles.exportButtonDisabled]}
              onPress={handleExport}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <>
                  <Icon name="download" size={14} color="#fff" />
                  <Text style={styles.exportButtonText}>Export</Text>
                </>
              )}
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: spacing.lg,
  },
  modal: {
    width: "100%",
    maxWidth: 400,
    backgroundColor: colors.background.primary,
    borderRadius: radius.xl,
    ...shadows.lg,
  },
  header: {
    alignItems: "center",
    padding: spacing.xl,
    paddingBottom: spacing.lg,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: radius.full,
    backgroundColor: colors.primary[50],
    justifyContent: "center",
    alignItems: "center",
    marginBottom: spacing.md,
  },
  title: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
    textAlign: "center",
  },
  description: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
    textAlign: "center",
    marginTop: spacing.xs,
  },
  section: {
    paddingHorizontal: spacing.xl,
    marginBottom: spacing.lg,
  },
  sectionLabel: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    color: colors.text.secondary,
    marginBottom: spacing.sm,
  },
  yearSelector: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  yearOption: {
    flex: 1,
    paddingVertical: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: colors.neutral[100],
    alignItems: "center",
    borderWidth: 2,
    borderColor: "transparent",
  },
  yearOptionSelected: {
    backgroundColor: colors.primary[50],
    borderColor: colors.primary[500],
  },
  yearOptionText: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.secondary,
  },
  yearOptionTextSelected: {
    color: colors.primary[700],
  },
  formatSelector: {
    flexDirection: "row",
    gap: spacing.md,
  },
  formatOption: {
    flex: 1,
    padding: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: colors.neutral[50],
    alignItems: "center",
    borderWidth: 2,
    borderColor: colors.border.light,
  },
  formatOptionSelected: {
    backgroundColor: colors.primary[50],
    borderColor: colors.primary[500],
  },
  formatIcon: {
    width: 44,
    height: 44,
    borderRadius: radius.lg,
    backgroundColor: colors.neutral[100],
    justifyContent: "center",
    alignItems: "center",
    marginBottom: spacing.sm,
  },
  formatIconSelected: {
    backgroundColor: colors.primary[100],
  },
  formatLabel: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.secondary,
  },
  formatLabelSelected: {
    color: colors.primary[700],
  },
  formatDescription: {
    fontSize: typography.fontSize.xs,
    color: colors.text.tertiary,
    marginTop: 2,
  },
  errorContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.error[50],
    marginHorizontal: spacing.xl,
    marginBottom: spacing.lg,
    padding: spacing.md,
    borderRadius: radius.md,
    gap: spacing.sm,
  },
  errorText: {
    flex: 1,
    fontSize: typography.fontSize.sm,
    color: colors.error[700],
  },
  actions: {
    flexDirection: "row",
    padding: spacing.lg,
    paddingTop: 0,
    gap: spacing.md,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: colors.neutral[100],
    alignItems: "center",
  },
  cancelButtonText: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.secondary,
  },
  exportButton: {
    flex: 1,
    flexDirection: "row",
    paddingVertical: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: colors.primary[600],
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
  },
  exportButtonDisabled: {
    opacity: 0.7,
  },
  exportButtonText: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: "#fff",
  },
});

export default ExportModal;
