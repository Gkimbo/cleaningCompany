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
  const [paymentTermsToAccept, setPaymentTermsToAccept] = useState(null);
  const [damageProtectionToAccept, setDamageProtectionToAccept] = useState(null);

  // Track original total for progress calculation (doesn't change as docs are accepted)
  const [originalTotalDocs, setOriginalTotalDocs] = useState(0);
  // Track current step number (1-indexed) for progress display
  const [currentStepNumber, setCurrentStepNumber] = useState(1);

  // Track current document being viewed
  // 'terms', 'privacy', 'paymentTerms', or 'damageProtection'
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
      if (data.paymentTerms) {
        setPaymentTermsToAccept(data.paymentTerms);
      }
      if (data.damageProtection) {
        setDamageProtectionToAccept(data.damageProtection);
      }

      // Calculate and store original total for progress tracking
      const total = (data.terms ? 1 : 0) + (data.privacyPolicy ? 1 : 0) + (data.paymentTerms ? 1 : 0) + (data.damageProtection ? 1 : 0);
      setOriginalTotalDocs(total);

      // Start with terms if available, then privacy policy, then payment terms, then damage protection
      if (data.terms) {
        setCurrentDocument("terms");
      } else if (data.privacyPolicy) {
        setCurrentDocument("privacy");
      } else if (data.paymentTerms) {
        setCurrentDocument("paymentTerms");
      } else if (data.damageProtection) {
        setCurrentDocument("damageProtection");
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
    const currentDoc = currentDocument === "terms"
      ? termsToAccept
      : currentDocument === "privacy"
        ? privacyToAccept
        : currentDocument === "paymentTerms"
          ? paymentTermsToAccept
          : damageProtectionToAccept;
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
        // Check if there's more to accept - flow: terms → privacy → paymentTerms → damageProtection
        if (currentDocument === "terms") {
          setTermsToAccept(null); // Mark as accepted
          setHasScrolledToBottom(false); // Reset scroll state
          if (privacyToAccept) {
            setCurrentStepNumber(prev => prev + 1);
            setCurrentDocument("privacy");
          } else if (paymentTermsToAccept) {
            setCurrentStepNumber(prev => prev + 1);
            setCurrentDocument("paymentTerms");
          } else if (damageProtectionToAccept) {
            setCurrentStepNumber(prev => prev + 1);
            setCurrentDocument("damageProtection");
          } else {
            // All done
            if (onAccepted) {
              onAccepted();
            } else {
              navigate("/");
            }
          }
        } else if (currentDocument === "privacy") {
          setPrivacyToAccept(null); // Mark as accepted
          setHasScrolledToBottom(false); // Reset scroll state
          if (paymentTermsToAccept) {
            setCurrentStepNumber(prev => prev + 1);
            setCurrentDocument("paymentTerms");
          } else if (damageProtectionToAccept) {
            setCurrentStepNumber(prev => prev + 1);
            setCurrentDocument("damageProtection");
          } else {
            // All done
            if (onAccepted) {
              onAccepted();
            } else {
              navigate("/");
            }
          }
        } else if (currentDocument === "paymentTerms") {
          setPaymentTermsToAccept(null); // Mark as accepted
          setHasScrolledToBottom(false); // Reset scroll state
          if (damageProtectionToAccept) {
            setCurrentStepNumber(prev => prev + 1);
            setCurrentDocument("damageProtection");
          } else {
            // All done
            if (onAccepted) {
              onAccepted();
            } else {
              navigate("/");
            }
          }
        } else if (currentDocument === "damageProtection") {
          setDamageProtectionToAccept(null); // Mark as accepted
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

  if (error && !termsToAccept && !privacyToAccept && !paymentTermsToAccept && !damageProtectionToAccept) {
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
  const currentDoc = currentDocument === "terms"
    ? termsToAccept
    : currentDocument === "privacy"
      ? privacyToAccept
      : currentDocument === "paymentTerms"
        ? paymentTermsToAccept
        : damageProtectionToAccept;
  const currentTitle = currentDocument === "terms"
    ? "Terms and Conditions"
    : currentDocument === "privacy"
      ? "Privacy Policy"
      : currentDocument === "paymentTerms"
        ? "Payment Terms"
        : "Damage Protection";

  // Calculate progress - use originalTotalDocs for consistent progress display
  const totalDocs = originalTotalDocs;
  const currentDocNum = currentStepNumber;

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
            : currentDocument === "privacy"
              ? "Our privacy policy has been updated. Please review and accept to continue using the app."
              : currentDocument === "paymentTerms"
                ? "Our payment terms have been updated. Please review and accept to continue using the app."
                : "Our damage protection policy has been updated. Please review and accept to continue using the app."}
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
              {currentDocument === "terms"
                ? "Terms and Conditions"
                : currentDocument === "privacy"
                  ? "Privacy Policy"
                  : "Payment Terms"}
              {currentDocument === "terms" && privacyToAccept
                ? " → Privacy Policy next"
                : currentDocument === "terms" && paymentTermsToAccept
                  ? " → Payment Terms next"
                  : currentDocument === "privacy" && paymentTermsToAccept
                    ? " → Payment Terms next"
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
