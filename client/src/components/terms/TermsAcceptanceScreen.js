import React, { useState, useEffect, useRef } from "react";
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
  const [loading, setLoading] = useState(true);
  const [accepting, setAccepting] = useState(false);
  const [error, setError] = useState(null);
  const [hasScrolledToBottom, setHasScrolledToBottom] = useState(false);
  const scrollViewRef = useRef(null);

  const scrollToBottom = () => {
    if (scrollViewRef.current) {
      scrollViewRef.current.scrollToEnd({ animated: true });
    }
  };

  // Track what needs to be accepted
  const [termsToAccept, setTermsToAccept] = useState(null);
  const [privacyToAccept, setPrivacyToAccept] = useState(null);

  // Track current document being viewed
  // 'terms' or 'privacy'
  const [currentDocument, setCurrentDocument] = useState(null);

  useEffect(() => {
    checkAcceptanceStatus();
  }, []);

  const checkAcceptanceStatus = async () => {
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

      // Store what needs to be accepted
      if (data.terms) {
        setTermsToAccept(data.terms);
      }
      if (data.privacyPolicy) {
        setPrivacyToAccept(data.privacyPolicy);
      }

      // Start with terms if available, otherwise privacy policy
      if (data.terms) {
        setCurrentDocument("terms");
      } else if (data.privacyPolicy) {
        setCurrentDocument("privacy");
      }
    } catch (err) {
      setError("Failed to check acceptance status");
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
    const currentDoc = currentDocument === "terms" ? termsToAccept : privacyToAccept;
    if (!currentDoc) return;

    setAccepting(true);
    setError(null);
    try {
      const response = await fetch(`${API_BASE}/terms/accept`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${state.currentUser.token}`,
        },
        body: JSON.stringify({ termsId: currentDoc.id }),
      });

      const data = await response.json();

      if (response.ok) {
        // Check if there's more to accept
        if (currentDocument === "terms" && privacyToAccept) {
          // Move to privacy policy
          setCurrentDocument("privacy");
          setTermsToAccept(null); // Mark as accepted
          setHasScrolledToBottom(false); // Reset scroll state
        } else if (currentDocument === "privacy" && termsToAccept) {
          // Move to terms
          setCurrentDocument("terms");
          setPrivacyToAccept(null); // Mark as accepted
          setHasScrolledToBottom(false); // Reset scroll state
        } else {
          // All done
          if (onAccepted) {
            onAccepted();
          } else {
            navigate("/");
          }
        }
      } else {
        setError(data.error || "Failed to accept");
      }
    } catch (err) {
      setError("Failed to accept. Please try again.");
      console.error("Error accepting:", err);
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
        <Text style={styles.loadingText}>Checking requirements...</Text>
      </View>
    );
  }

  if (error && !termsToAccept && !privacyToAccept) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.errorText}>{error}</Text>
        <Pressable style={styles.retryButton} onPress={checkAcceptanceStatus}>
          <Text style={styles.retryButtonText}>Retry</Text>
        </Pressable>
        <Pressable style={styles.logoutLink} onPress={handleLogout}>
          <Text style={styles.logoutLinkText}>Logout</Text>
        </Pressable>
      </View>
    );
  }

  // Get current document to display
  const currentDoc = currentDocument === "terms" ? termsToAccept : privacyToAccept;
  const currentTitle = currentDocument === "terms" ? "Terms and Conditions" : "Privacy Policy";

  // Calculate progress
  const totalDocs = (termsToAccept ? 1 : 0) + (privacyToAccept ? 1 : 0);
  const currentDocNum = currentDocument === "terms" ? 1 : (termsToAccept ? 2 : 1);

  const renderDocumentContent = () => {
    if (!currentDoc) return null;

    if (currentDoc.contentType === "pdf") {
      const pdfUrl = `${API_BASE}${currentDoc.pdfUrl}`;

      if (Platform.OS === "web") {
        return (
          <View style={styles.pdfContainer}>
            <iframe
              src={pdfUrl}
              style={{ width: "100%", height: "100%", border: "none" }}
              title={currentTitle}
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
        ref={scrollViewRef}
        style={styles.scrollContent}
        contentContainerStyle={styles.scrollContentContainer}
        onScroll={handleScroll}
        scrollEventThrottle={16}
      >
        <Text style={styles.termsTitle}>{currentDoc.title}</Text>
        <Text style={styles.termsVersion}>Version {currentDoc.version}</Text>
        <Text style={styles.termsContent}>{currentDoc.content}</Text>
        <View style={styles.endOfTerms}>
          <Text style={styles.endOfTermsText}>End of Document</Text>
        </View>
      </ScrollView>
    );
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.updateBadge}>
          <Text style={styles.updateBadgeText}>
            {totalDocs > 1 ? `Step ${currentDocNum} of ${totalDocs}` : "Updated"}
          </Text>
        </View>
        <Text style={styles.headerTitle}>{currentTitle}</Text>
        <Text style={styles.headerSubtitle}>
          {currentDocument === "terms"
            ? "Our terms have been updated. Please review and accept to continue using the app."
            : "Our privacy policy has been updated. Please review and accept to continue using the app."}
        </Text>
        {totalDocs > 1 && (
          <View style={styles.progressContainer}>
            <View style={styles.progressBar}>
              <View
                style={[
                  styles.progressFill,
                  { width: `${(currentDocNum / totalDocs) * 100}%` },
                ]}
              />
            </View>
            <Text style={styles.progressText}>
              {currentDocNum === 1
                ? "Terms and Conditions"
                : "Privacy Policy"}
              {privacyToAccept && termsToAccept && currentDocNum === 1
                ? " → Privacy Policy next"
                : ""}
            </Text>
          </View>
        )}
      </View>

      {/* Content */}
      <View style={styles.content}>{renderDocumentContent()}</View>

      {/* Error message */}
      {error && (
        <View style={styles.errorBanner}>
          <Text style={styles.errorBannerText}>{error}</Text>
        </View>
      )}

      {/* Footer */}
      <View style={styles.footer}>
        {!hasScrolledToBottom && currentDoc?.contentType === "text" && (
          <>
            <Pressable
              style={styles.skipToBottomButton}
              onPress={scrollToBottom}
            >
              <Text style={styles.skipToBottomText}>Skip to Bottom ↓</Text>
            </Pressable>
            <Text style={styles.scrollHint}>
              or scroll down to continue
            </Text>
          </>
        )}
        <Text style={styles.requiredNotice}>
          You must read and accept to continue
        </Text>
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
              <Text style={styles.acceptButtonText}>
                {totalDocs > 1 && currentDocNum < totalDocs
                  ? "Accept & Continue"
                  : "I Accept"}
              </Text>
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
  progressContainer: {
    marginTop: spacing.md,
  },
  progressBar: {
    height: 6,
    backgroundColor: colors.primary[100],
    borderRadius: radius.full,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    backgroundColor: colors.primary[500],
    borderRadius: radius.full,
  },
  progressText: {
    fontSize: typography.fontSize.xs,
    color: colors.primary[600],
    marginTop: spacing.xs,
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
  skipToBottomButton: {
    backgroundColor: colors.primary[100],
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.lg,
    alignSelf: "center",
    marginBottom: spacing.sm,
  },
  skipToBottomText: {
    color: colors.primary[700],
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
  },
  scrollHint: {
    fontSize: typography.fontSize.xs,
    color: colors.text.tertiary,
    textAlign: "center",
    marginBottom: spacing.md,
  },
  requiredNotice: {
    fontSize: typography.fontSize.sm,
    color: colors.primary[600],
    textAlign: "center",
    marginBottom: spacing.md,
    fontWeight: typography.fontWeight.medium,
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
