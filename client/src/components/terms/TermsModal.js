import React, { useState, useEffect } from "react";
import {
  ActivityIndicator,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { WebView } from "react-native-webview";
import {
  colors,
  spacing,
  radius,
  typography,
  shadows,
} from "../../services/styles/theme";
import { API_BASE } from "../../services/config";

const TermsModal = ({ visible, onClose, onAccept, type, loading = false }) => {
  const [terms, setTerms] = useState(null);
  const [fetchLoading, setFetchLoading] = useState(true);
  const [error, setError] = useState(null);
  const [hasScrolledToBottom, setHasScrolledToBottom] = useState(false);

  useEffect(() => {
    if (visible && type) {
      fetchTerms();
    }
  }, [visible, type]);

  const fetchTerms = async () => {
    setFetchLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_BASE}/terms/current/${type}`);
      const data = await response.json();
      if (data.terms) {
        setTerms(data.terms);
      } else {
        setError("No terms available yet");
      }
    } catch (err) {
      setError("Failed to load terms");
      console.error("Error fetching terms:", err);
    } finally {
      setFetchLoading(false);
    }
  };

  const handleScroll = (event) => {
    const { layoutMeasurement, contentOffset, contentSize } = event.nativeEvent;
    const paddingToBottom = 20;
    const isCloseToBottom =
      layoutMeasurement.height + contentOffset.y >= contentSize.height - paddingToBottom;

    if (isCloseToBottom && !hasScrolledToBottom) {
      setHasScrolledToBottom(true);
    }
  };

  const handleAccept = () => {
    if (terms && onAccept) {
      onAccept(terms.id);
    }
  };

  const renderContent = () => {
    if (fetchLoading) {
      return (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={colors.primary[500]} />
          <Text style={styles.loadingText}>Loading terms...</Text>
        </View>
      );
    }

    if (error) {
      return (
        <View style={styles.centerContainer}>
          <Text style={styles.errorText}>{error}</Text>
          <Pressable style={styles.retryButton} onPress={fetchTerms}>
            <Text style={styles.retryButtonText}>Retry</Text>
          </Pressable>
        </View>
      );
    }

    if (!terms) {
      return (
        <View style={styles.centerContainer}>
          <Text style={styles.noTermsText}>
            No terms and conditions have been set up yet.
          </Text>
        </View>
      );
    }

    if (terms.contentType === "pdf") {
      // Use WebView to display PDF
      const pdfUrl = `${API_BASE}${terms.pdfUrl}`;

      if (Platform.OS === "web") {
        return (
          <View style={styles.pdfContainer}>
            <iframe
              src={pdfUrl}
              style={{ width: "100%", height: "100%", border: "none" }}
              title="Terms and Conditions"
            />
          </View>
        );
      }

      return (
        <View style={styles.pdfContainer}>
          <WebView
            source={{ uri: pdfUrl }}
            style={{ flex: 1 }}
            onLoadEnd={() => setHasScrolledToBottom(true)}
          />
        </View>
      );
    }

    // Text content
    return (
      <ScrollView
        style={styles.scrollContent}
        contentContainerStyle={styles.scrollContentContainer}
        onScroll={handleScroll}
        scrollEventThrottle={16}
      >
        <Text style={styles.termsTitle}>{terms.title}</Text>
        <Text style={styles.termsVersion}>Version {terms.version}</Text>
        <Text style={styles.termsContent}>{terms.content}</Text>
        <View style={styles.endOfTerms}>
          <Text style={styles.endOfTermsText}>End of Terms</Text>
        </View>
      </ScrollView>
    );
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Terms and Conditions</Text>
          <Pressable onPress={onClose} style={styles.closeButton}>
            <Text style={styles.closeButtonText}>Close</Text>
          </Pressable>
        </View>

        {/* Content */}
        <View style={styles.content}>{renderContent()}</View>

        {/* Footer */}
        {terms && !error && (
          <View style={styles.footer}>
            {!hasScrolledToBottom && terms.contentType === "text" && (
              <Text style={styles.scrollHint}>
                Please scroll to the bottom to accept
              </Text>
            )}
            <View style={styles.buttonRow}>
              <Pressable
                style={[styles.button, styles.cancelButton]}
                onPress={onClose}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </Pressable>
              <Pressable
                style={[
                  styles.button,
                  styles.acceptButton,
                  (!hasScrolledToBottom || loading) && styles.buttonDisabled,
                ]}
                onPress={handleAccept}
                disabled={!hasScrolledToBottom || loading}
              >
                {loading ? (
                  <ActivityIndicator size="small" color={colors.neutral[0]} />
                ) : (
                  <Text style={styles.acceptButtonText}>
                    I Accept
                  </Text>
                )}
              </Pressable>
            </View>
          </View>
        )}
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.primary,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
    backgroundColor: colors.neutral[0],
  },
  headerTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
  },
  closeButton: {
    padding: spacing.sm,
  },
  closeButtonText: {
    fontSize: typography.fontSize.base,
    color: colors.primary[600],
    fontWeight: typography.fontWeight.medium,
  },
  content: {
    flex: 1,
  },
  centerContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: spacing.xl,
  },
  loadingText: {
    marginTop: spacing.md,
    color: colors.text.secondary,
    fontSize: typography.fontSize.base,
  },
  errorText: {
    color: colors.error[600],
    fontSize: typography.fontSize.base,
    textAlign: "center",
    marginBottom: spacing.md,
  },
  retryButton: {
    backgroundColor: colors.primary[500],
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xl,
    borderRadius: radius.lg,
  },
  retryButtonText: {
    color: colors.neutral[0],
    fontWeight: typography.fontWeight.semibold,
  },
  noTermsText: {
    color: colors.text.secondary,
    fontSize: typography.fontSize.base,
    textAlign: "center",
  },
  scrollContent: {
    flex: 1,
  },
  scrollContentContainer: {
    padding: spacing.lg,
  },
  termsTitle: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
    marginBottom: spacing.xs,
  },
  termsVersion: {
    fontSize: typography.fontSize.sm,
    color: colors.text.tertiary,
    marginBottom: spacing.lg,
  },
  termsContent: {
    fontSize: typography.fontSize.base,
    color: colors.text.primary,
    lineHeight: 24,
  },
  endOfTerms: {
    marginTop: spacing.xl,
    paddingTop: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.border.light,
    alignItems: "center",
  },
  endOfTermsText: {
    fontSize: typography.fontSize.sm,
    color: colors.text.tertiary,
    fontStyle: "italic",
  },
  pdfContainer: {
    flex: 1,
    backgroundColor: colors.neutral[100],
  },
  footer: {
    padding: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.border.light,
    backgroundColor: colors.neutral[0],
    ...shadows.sm,
  },
  scrollHint: {
    fontSize: typography.fontSize.sm,
    color: colors.warning[600],
    textAlign: "center",
    marginBottom: spacing.md,
  },
  buttonRow: {
    flexDirection: "row",
    gap: spacing.md,
  },
  button: {
    flex: 1,
    paddingVertical: spacing.md,
    borderRadius: radius.lg,
    alignItems: "center",
    justifyContent: "center",
  },
  cancelButton: {
    backgroundColor: colors.neutral[100],
  },
  cancelButtonText: {
    color: colors.text.primary,
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
  },
  acceptButton: {
    backgroundColor: colors.primary[600],
  },
  acceptButtonText: {
    color: colors.neutral[0],
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
});

export default TermsModal;
