import React, { useState, useEffect } from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { WebView } from "react-native-webview";
import { useNavigate } from "react-router-native";
import {
  colors,
  spacing,
  radius,
  typography,
  shadows,
} from "../../services/styles/theme";
import { API_BASE } from "../../services/config";

const TermsAcceptanceScreen = ({ state, dispatch, onAccepted }) => {
  const navigate = useNavigate();
  const [terms, setTerms] = useState(null);
  const [loading, setLoading] = useState(true);
  const [accepting, setAccepting] = useState(false);
  const [error, setError] = useState(null);
  const [hasScrolledToBottom, setHasScrolledToBottom] = useState(false);

  useEffect(() => {
    checkTermsStatus();
  }, []);

  const checkTermsStatus = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_BASE}/terms/check`, {
        headers: {
          Authorization: `Bearer ${state.currentUser.token}`,
        },
      });
      const data = await response.json();

      if (!data.requiresAcceptance) {
        // No acceptance needed, proceed to app
        if (onAccepted) {
          onAccepted();
        } else {
          navigate("/");
        }
        return;
      }

      setTerms(data.terms);
    } catch (err) {
      setError("Failed to check terms status");
      console.error("Error checking terms:", err);
    } finally {
      setLoading(false);
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

  const handleAccept = async () => {
    if (!terms) return;

    setAccepting(true);
    setError(null);
    try {
      const response = await fetch(`${API_BASE}/terms/accept`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${state.currentUser.token}`,
        },
        body: JSON.stringify({ termsId: terms.id }),
      });

      const data = await response.json();

      if (response.ok) {
        if (onAccepted) {
          onAccepted();
        } else {
          navigate("/");
        }
      } else {
        setError(data.error || "Failed to accept terms");
      }
    } catch (err) {
      setError("Failed to accept terms. Please try again.");
      console.error("Error accepting terms:", err);
    } finally {
      setAccepting(false);
    }
  };

  const handleLogout = () => {
    dispatch({ type: "CURRENT_USER", payload: null });
    dispatch({ type: "SET_USER_ID", payload: null });
    navigate("/sign-in");
  };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={colors.primary[500]} />
        <Text style={styles.loadingText}>Checking terms status...</Text>
      </View>
    );
  }

  if (error && !terms) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.errorText}>{error}</Text>
        <Pressable style={styles.retryButton} onPress={checkTermsStatus}>
          <Text style={styles.retryButtonText}>Retry</Text>
        </Pressable>
        <Pressable style={styles.logoutLink} onPress={handleLogout}>
          <Text style={styles.logoutLinkText}>Logout</Text>
        </Pressable>
      </View>
    );
  }

  const renderTermsContent = () => {
    if (!terms) return null;

    if (terms.contentType === "pdf") {
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
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.updateBadge}>
          <Text style={styles.updateBadgeText}>Updated Terms</Text>
        </View>
        <Text style={styles.headerTitle}>Terms and Conditions</Text>
        <Text style={styles.headerSubtitle}>
          Our terms have been updated. Please review and accept to continue using the app.
        </Text>
      </View>

      {/* Content */}
      <View style={styles.content}>{renderTermsContent()}</View>

      {/* Error message */}
      {error && (
        <View style={styles.errorBanner}>
          <Text style={styles.errorBannerText}>{error}</Text>
        </View>
      )}

      {/* Footer */}
      <View style={styles.footer}>
        {!hasScrolledToBottom && terms?.contentType === "text" && (
          <Text style={styles.scrollHint}>
            Please scroll to the bottom to accept the terms
          </Text>
        )}
        <View style={styles.buttonRow}>
          <Pressable
            style={[styles.button, styles.logoutButton]}
            onPress={handleLogout}
          >
            <Text style={styles.logoutButtonText}>Logout</Text>
          </Pressable>
          <Pressable
            style={[
              styles.button,
              styles.acceptButton,
              (!hasScrolledToBottom || accepting) && styles.buttonDisabled,
            ]}
            onPress={handleAccept}
            disabled={!hasScrolledToBottom || accepting}
          >
            {accepting ? (
              <ActivityIndicator size="small" color={colors.neutral[0]} />
            ) : (
              <Text style={styles.acceptButtonText}>I Accept</Text>
            )}
          </Pressable>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.primary,
  },
  centerContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: spacing.xl,
    backgroundColor: colors.background.primary,
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
    marginBottom: spacing.md,
  },
  retryButtonText: {
    color: colors.neutral[0],
    fontWeight: typography.fontWeight.semibold,
  },
  logoutLink: {
    padding: spacing.sm,
  },
  logoutLinkText: {
    color: colors.text.secondary,
    fontSize: typography.fontSize.sm,
  },
  header: {
    padding: spacing.lg,
    backgroundColor: colors.primary[50],
    borderBottomWidth: 1,
    borderBottomColor: colors.primary[100],
  },
  updateBadge: {
    alignSelf: "flex-start",
    backgroundColor: colors.warning[500],
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    borderRadius: radius.full,
    marginBottom: spacing.sm,
  },
  updateBadgeText: {
    color: colors.neutral[0],
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.bold,
    textTransform: "uppercase",
  },
  headerTitle: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
    color: colors.primary[800],
    marginBottom: spacing.xs,
  },
  headerSubtitle: {
    fontSize: typography.fontSize.sm,
    color: colors.primary[600],
    lineHeight: 20,
  },
  content: {
    flex: 1,
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
  errorBanner: {
    backgroundColor: colors.error[50],
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.error[200],
  },
  errorBannerText: {
    color: colors.error[700],
    fontSize: typography.fontSize.sm,
    textAlign: "center",
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
    minHeight: 48,
  },
  logoutButton: {
    backgroundColor: colors.neutral[100],
  },
  logoutButtonText: {
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

export default TermsAcceptanceScreen;
