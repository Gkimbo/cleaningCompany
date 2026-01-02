import React, { useState, useRef, useEffect } from "react";
import {
  ActivityIndicator,
  Modal,
  Platform,
  Pressable,
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { WebView } from "react-native-webview";
import Icon from "react-native-vector-icons/FontAwesome";
import {
  colors,
  spacing,
  radius,
  typography,
} from "../../services/styles/theme";

/**
 * StripeOnboardingWebView - Displays Stripe onboarding in an in-app WebView modal
 *
 * Props:
 * - visible: boolean - Whether the modal is visible
 * - url: string - The Stripe onboarding URL to load
 * - onClose: () => void - Called when user closes the modal
 * - onComplete: () => void - Called when onboarding is detected as complete
 */
const StripeOnboardingWebView = ({ visible, url, onClose, onComplete }) => {
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const webViewRef = useRef(null);

  // Prevent keyboard shortcuts (like 'r' for reload) from triggering app refresh
  // This is needed on web platform where Expo/Metro dev shortcuts can interfere
  useEffect(() => {
    if (!visible || Platform.OS !== "web") return;

    const handleKeyDown = (event) => {
      // Prevent 'r' from triggering app reload when modal is open
      // Also prevent other common dev shortcuts
      if (event.key === "r" || event.key === "R") {
        // Only prevent if not combined with Cmd/Ctrl (allow Cmd+R for page refresh)
        if (!event.metaKey && !event.ctrlKey) {
          event.stopPropagation();
        }
      }
    };

    // Capture phase to intercept before Expo/Metro handlers
    window.addEventListener("keydown", handleKeyDown, true);

    return () => {
      window.removeEventListener("keydown", handleKeyDown, true);
    };
  }, [visible]);

  // Only detect completion when navigating to OUR app's return URLs
  // Must be specific to avoid false positives from Stripe's internal URLs
  const isOurReturnUrl = (currentUrl) => {
    if (!currentUrl) return false;

    // Only trigger for localhost (dev) or our production domain
    const isOurDomain =
      currentUrl.includes("localhost:3000") ||
      currentUrl.includes("127.0.0.1:3000");

    if (!isOurDomain) return false;

    // Check for our specific return/refresh parameters
    return (
      currentUrl.includes("/earnings?return=true") ||
      currentUrl.includes("/earnings?refresh=true") ||
      currentUrl.includes("/earnings#")
    );
  };

  const handleNavigationStateChange = (navState) => {
    const { url: currentUrl } = navState;

    if (isOurReturnUrl(currentUrl)) {
      // User has completed onboarding and returned to our app
      onComplete?.();
    }
  };

  const handleLoadStart = () => {
    setIsLoading(true);
    setLoadError(null);
  };

  const handleLoadEnd = () => {
    setIsLoading(false);
  };

  const handleError = (syntheticEvent) => {
    const { nativeEvent } = syntheticEvent;
    setLoadError(nativeEvent.description || "Failed to load page");
    setIsLoading(false);
  };

  const handleClose = () => {
    setIsLoading(true);
    setLoadError(null);
    onClose?.();
  };

  const handleRetry = () => {
    setLoadError(null);
    setIsLoading(true);
    webViewRef.current?.reload();
  };

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={handleClose}
    >
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="dark-content" />

        {/* Header */}
        <View style={styles.header}>
          <Pressable onPress={handleClose} style={styles.closeButton}>
            <Icon name="times" size={20} color={colors.text.secondary} />
          </Pressable>
          <View style={styles.headerCenter}>
            <Icon name="lock" size={12} color={colors.success[600]} style={styles.lockIcon} />
            <Text style={styles.headerTitle}>Secure Payment Setup</Text>
          </View>
          <View style={styles.headerRight}>
            <Icon name="cc-stripe" size={24} color="#635BFF" />
          </View>
        </View>

        {/* WebView Content */}
        <View style={styles.webViewContainer}>
          {url ? (
            <WebView
              ref={webViewRef}
              source={{ uri: url }}
              style={styles.webView}
              onNavigationStateChange={handleNavigationStateChange}
              onLoadStart={handleLoadStart}
              onLoadEnd={handleLoadEnd}
              onError={handleError}
              startInLoadingState={true}
              javaScriptEnabled={true}
              domStorageEnabled={true}
              sharedCookiesEnabled={true}
              thirdPartyCookiesEnabled={true}
              // Allow Stripe to work properly
              originWhitelist={["*"]}
              mixedContentMode="compatibility"
              // Handle new windows (open in same webview)
              setSupportMultipleWindows={false}
              // Keyboard handling - prevent dev shortcuts from triggering
              keyboardDisplayRequiresUserAction={false}
              hideKeyboardAccessoryView={false}
              allowsInlineMediaPlayback={true}
              // Ensure WebView captures all input
              nestedScrollEnabled={true}
              // User agent to avoid detection issues
              userAgent={Platform.select({
                ios: "Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1",
                android: "Mozilla/5.0 (Linux; Android 13; SM-G991B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/112.0.0.0 Mobile Safari/537.36",
                default: undefined,
              })}
            />
          ) : (
            <View style={styles.errorContainer}>
              <Icon name="exclamation-circle" size={48} color={colors.error[400]} />
              <Text style={styles.errorText}>No URL provided</Text>
            </View>
          )}

          {/* Loading Overlay */}
          {isLoading && (
            <View style={styles.loadingOverlay}>
              <View style={styles.loadingCard}>
                <ActivityIndicator size="large" color={colors.primary[500]} />
                <Text style={styles.loadingText}>Loading secure payment setup...</Text>
                <Text style={styles.loadingSubtext}>Powered by Stripe</Text>
              </View>
            </View>
          )}

          {/* Error State */}
          {loadError && (
            <View style={styles.errorOverlay}>
              <View style={styles.errorCard}>
                <Icon name="exclamation-triangle" size={48} color={colors.warning[500]} />
                <Text style={styles.errorTitle}>Connection Issue</Text>
                <Text style={styles.errorMessage}>{loadError}</Text>
                <View style={styles.errorActions}>
                  <Pressable style={styles.retryButton} onPress={handleRetry}>
                    <Icon name="refresh" size={14} color={colors.neutral[0]} />
                    <Text style={styles.retryButtonText}>Try Again</Text>
                  </Pressable>
                  <Pressable style={styles.cancelButton} onPress={handleClose}>
                    <Text style={styles.cancelButtonText}>Close</Text>
                  </Pressable>
                </View>
              </View>
            </View>
          )}
        </View>

        {/* Footer Info */}
        <View style={styles.footer}>
          <Icon name="shield" size={14} color={colors.text.tertiary} />
          <Text style={styles.footerText}>
            Your information is encrypted and secure
          </Text>
        </View>
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.primary,
  },

  // Header
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
    backgroundColor: colors.neutral[0],
  },
  closeButton: {
    width: 40,
    height: 40,
    justifyContent: "center",
    alignItems: "center",
  },
  headerCenter: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  lockIcon: {
    marginRight: spacing.xs,
  },
  headerTitle: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
  },
  headerRight: {
    width: 40,
    alignItems: "flex-end",
  },

  // WebView
  webViewContainer: {
    flex: 1,
    backgroundColor: colors.neutral[100],
  },
  webView: {
    flex: 1,
  },

  // Loading
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(255, 255, 255, 0.95)",
    justifyContent: "center",
    alignItems: "center",
  },
  loadingCard: {
    backgroundColor: colors.neutral[0],
    borderRadius: radius.xl,
    padding: spacing.xl,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 8,
  },
  loadingText: {
    marginTop: spacing.lg,
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.medium,
    color: colors.text.primary,
  },
  loadingSubtext: {
    marginTop: spacing.xs,
    fontSize: typography.fontSize.sm,
    color: colors.text.tertiary,
  },

  // Error States
  errorContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: spacing.xl,
  },
  errorOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(255, 255, 255, 0.98)",
    justifyContent: "center",
    alignItems: "center",
    padding: spacing.xl,
  },
  errorCard: {
    backgroundColor: colors.neutral[0],
    borderRadius: radius.xl,
    padding: spacing.xl,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 8,
    maxWidth: 320,
    width: "100%",
  },
  errorTitle: {
    marginTop: spacing.md,
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
  },
  errorMessage: {
    marginTop: spacing.sm,
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
    textAlign: "center",
    lineHeight: 20,
  },
  errorText: {
    marginTop: spacing.md,
    fontSize: typography.fontSize.base,
    color: colors.text.secondary,
  },
  errorActions: {
    marginTop: spacing.xl,
    flexDirection: "row",
    gap: spacing.md,
  },
  retryButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.primary[600],
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.lg,
    gap: spacing.xs,
  },
  retryButtonText: {
    color: colors.neutral[0],
    fontWeight: typography.fontWeight.semibold,
    fontSize: typography.fontSize.sm,
  },
  cancelButton: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
  },
  cancelButtonText: {
    color: colors.text.secondary,
    fontWeight: typography.fontWeight.medium,
    fontSize: typography.fontSize.sm,
  },

  // Footer
  footer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    backgroundColor: colors.neutral[50],
    borderTopWidth: 1,
    borderTopColor: colors.border.light,
    gap: spacing.xs,
  },
  footerText: {
    fontSize: typography.fontSize.xs,
    color: colors.text.tertiary,
  },
});

export default StripeOnboardingWebView;
