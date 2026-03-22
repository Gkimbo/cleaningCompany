import React, { Component } from "react";
import { View, Text, Pressable, StyleSheet, ScrollView } from "react-native";
import { Feather } from "@expo/vector-icons";
import { colors, spacing, radius, typography, shadows } from "../../services/styles/theme";

/**
 * ErrorBoundary - Catches JavaScript errors in child component tree
 *
 * Usage:
 *   <ErrorBoundary fallback={<CustomFallback />}>
 *     <YourComponent />
 *   </ErrorBoundary>
 *
 * Or with onError callback:
 *   <ErrorBoundary onError={(error, errorInfo) => logToService(error, errorInfo)}>
 *     <YourComponent />
 *   </ErrorBoundary>
 */
class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error) {
    // Update state so the next render shows the fallback UI
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    // Log error to console in development
    if (__DEV__) {
      console.error("[ErrorBoundary] Caught error:", error);
      console.error("[ErrorBoundary] Component stack:", errorInfo?.componentStack);
    }

    // Store error info for display
    this.setState({ errorInfo });

    // Call optional onError callback for external logging
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }
  }

  handleRetry = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
  };

  handleGoHome = () => {
    // Reset error state first
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });

    // Call optional onGoHome callback
    if (this.props.onGoHome) {
      this.props.onGoHome();
    }
  };

  render() {
    const { hasError, error, errorInfo } = this.state;
    const { children, fallback, showDetails = __DEV__ } = this.props;

    if (hasError) {
      // Use custom fallback if provided
      if (fallback) {
        return typeof fallback === "function"
          ? fallback({ error, errorInfo, retry: this.handleRetry })
          : fallback;
      }

      // Default error UI
      return (
        <View style={styles.container}>
          <View style={styles.content}>
            {/* Error Icon */}
            <View style={styles.iconContainer}>
              <Feather name="alert-triangle" size={48} color={colors.error[500]} />
            </View>

            {/* Error Title */}
            <Text style={styles.title}>Something went wrong</Text>

            {/* Error Description */}
            <Text style={styles.description}>
              We're sorry, but something unexpected happened. Please try again or go back to the home screen.
            </Text>

            {/* Action Buttons */}
            <View style={styles.buttonContainer}>
              <Pressable style={styles.retryButton} onPress={this.handleRetry}>
                <Feather name="refresh-cw" size={18} color={colors.neutral[0]} />
                <Text style={styles.retryButtonText}>Try Again</Text>
              </Pressable>

              {this.props.onGoHome && (
                <Pressable style={styles.homeButton} onPress={this.handleGoHome}>
                  <Feather name="home" size={18} color={colors.primary[600]} />
                  <Text style={styles.homeButtonText}>Go Home</Text>
                </Pressable>
              )}
            </View>

            {/* Error Details (development only by default) */}
            {showDetails && error && (
              <ScrollView style={styles.detailsContainer}>
                <Text style={styles.detailsTitle}>Error Details</Text>
                <Text style={styles.errorMessage}>{error.toString()}</Text>
                {errorInfo?.componentStack && (
                  <>
                    <Text style={styles.stackTitle}>Component Stack</Text>
                    <Text style={styles.stackTrace}>
                      {errorInfo.componentStack.trim()}
                    </Text>
                  </>
                )}
              </ScrollView>
            )}
          </View>
        </View>
      );
    }

    return children;
  }
}

/**
 * withErrorBoundary - HOC to wrap a component with ErrorBoundary
 *
 * Usage:
 *   export default withErrorBoundary(MyComponent, { onError: logError });
 */
export const withErrorBoundary = (WrappedComponent, errorBoundaryProps = {}) => {
  const WithErrorBoundary = (props) => (
    <ErrorBoundary {...errorBoundaryProps}>
      <WrappedComponent {...props} />
    </ErrorBoundary>
  );

  WithErrorBoundary.displayName = `WithErrorBoundary(${WrappedComponent.displayName || WrappedComponent.name || "Component"})`;

  return WithErrorBoundary;
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.neutral[50],
    justifyContent: "center",
    alignItems: "center",
    padding: spacing.xl,
  },
  content: {
    backgroundColor: colors.neutral[0],
    borderRadius: radius.xl,
    padding: spacing.xl,
    maxWidth: 400,
    width: "100%",
    alignItems: "center",
    ...shadows.lg,
  },
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.error[50],
    justifyContent: "center",
    alignItems: "center",
    marginBottom: spacing.lg,
  },
  title: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
    color: colors.neutral[900],
    marginBottom: spacing.sm,
    textAlign: "center",
  },
  description: {
    fontSize: typography.fontSize.base,
    color: colors.neutral[600],
    textAlign: "center",
    lineHeight: 24,
    marginBottom: spacing.xl,
  },
  buttonContainer: {
    flexDirection: "row",
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  retryButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primary[600],
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    borderRadius: radius.lg,
    gap: spacing.sm,
    ...shadows.sm,
  },
  retryButtonText: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.neutral[0],
  },
  homeButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primary[50],
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    borderRadius: radius.lg,
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.primary[200],
  },
  homeButtonText: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.primary[600],
  },
  detailsContainer: {
    width: "100%",
    maxHeight: 200,
    backgroundColor: colors.neutral[100],
    borderRadius: radius.md,
    padding: spacing.md,
    marginTop: spacing.md,
  },
  detailsTitle: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    color: colors.error[700],
    marginBottom: spacing.xs,
  },
  errorMessage: {
    fontSize: typography.fontSize.sm,
    color: colors.error[600],
    fontFamily: "monospace",
    marginBottom: spacing.md,
  },
  stackTitle: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    color: colors.neutral[700],
    marginBottom: spacing.xs,
  },
  stackTrace: {
    fontSize: typography.fontSize.xs,
    color: colors.neutral[600],
    fontFamily: "monospace",
    lineHeight: 18,
  },
});

export default ErrorBoundary;
