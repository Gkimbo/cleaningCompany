import React, { useState, useEffect } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  Share,
} from "react-native";
import { useNavigate } from "react-router-native";
import * as Clipboard from "expo-clipboard";
import Icon from "react-native-vector-icons/FontAwesome";
import {
  colors,
  spacing,
  radius,
  typography,
  shadows,
} from "../../services/styles/theme";
import ReferralService from "../../services/fetchRequests/ReferralService";

const MyReferralsPage = ({ state, dispatch }) => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [referralData, setReferralData] = useState(null);
  const [copySuccess, setCopySuccess] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchReferralData();
  }, []);

  const fetchReferralData = async () => {
    setLoading(true);
    setError(null);

    try {
      const [codeData, referralsData] = await Promise.all([
        ReferralService.getMyCode(state.currentUser.token),
        ReferralService.getMyReferrals(state.currentUser.token),
      ]);

      setReferralData({
        referralCode: codeData?.referralCode || referralsData?.referralCode,
        shareMessage: codeData?.shareMessage,
        programs: codeData?.programs || [],
        availableCredits: referralsData?.availableCredits || 0,
        stats: referralsData?.stats || { totalReferrals: 0, pending: 0, qualified: 0, rewarded: 0, totalEarned: 0 },
        referrals: referralsData?.referrals || [],
      });
    } catch (err) {
      setError("Failed to load referral data");
      console.error("Error fetching referral data:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleCopyCode = async () => {
    try {
      await Clipboard.setStringAsync(referralData.referralCode);
      setCopySuccess(true);
      ReferralService.logShare(state.currentUser.token, "copy");
      setTimeout(() => setCopySuccess(false), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  const handleShare = async () => {
    try {
      await Share.share({
        message: referralData.shareMessage || `Use my referral code ${referralData.referralCode} to sign up for Kleanr!`,
      });
      ReferralService.logShare(state.currentUser.token, "native");
    } catch (err) {
      console.error("Failed to share:", err);
    }
  };

  const formatDollars = (cents) => {
    return (cents / 100).toFixed(2);
  };

  const getStatusColor = (status) => {
    switch (status) {
      case "pending":
        return colors.warning[500];
      case "qualified":
        return colors.primary[500];
      case "rewarded":
        return colors.success[500];
      case "expired":
      case "cancelled":
        return colors.error[500];
      default:
        return colors.text.tertiary;
    }
  };

  const getStatusLabel = (status) => {
    switch (status) {
      case "pending":
        return "Pending";
      case "qualified":
        return "Qualified";
      case "rewarded":
        return "Rewarded";
      case "expired":
        return "Expired";
      case "cancelled":
        return "Cancelled";
      default:
        return status;
    }
  };

  const getProgramLabel = (programType) => {
    switch (programType) {
      case "client_to_client":
        return "Friend Referral";
      case "client_to_cleaner":
        return "Cleaner Referral";
      case "cleaner_to_cleaner":
        return "Cleaner Referral";
      case "cleaner_to_client":
        return "Client Referral";
      default:
        return programType;
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary[600]} />
        <Text style={styles.loadingText}>Loading your referrals...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.errorContainer}>
        <Icon name="exclamation-circle" size={48} color={colors.error[500]} />
        <Text style={styles.errorText}>{error}</Text>
        <Pressable style={styles.retryButton} onPress={fetchReferralData}>
          <Text style={styles.retryButtonText}>Try Again</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => navigate(-1)} style={styles.backButton}>
          <Icon name="arrow-left" size={16} color={colors.primary[600]} />
          <Text style={styles.backButtonText}>Back</Text>
        </Pressable>
        <Text style={styles.headerTitle}>My Referrals</Text>
      </View>

      {/* Referral Code Card */}
      <View style={styles.codeCard}>
        <View style={styles.codeCardHeader}>
          <Icon name="gift" size={24} color={colors.primary[600]} />
          <Text style={styles.codeCardTitle}>Your Referral Code</Text>
        </View>
        <Text style={styles.codeText}>{referralData.referralCode}</Text>
        <Text style={styles.codeDescription}>
          Share this code with friends and family to earn rewards!
        </Text>
        <View style={styles.codeButtons}>
          <Pressable
            style={[styles.codeButton, copySuccess && styles.codeButtonSuccess]}
            onPress={handleCopyCode}
          >
            <Icon
              name={copySuccess ? "check" : "copy"}
              size={16}
              color={copySuccess ? colors.success[600] : colors.primary[600]}
            />
            <Text style={[styles.codeButtonText, copySuccess && styles.codeButtonTextSuccess]}>
              {copySuccess ? "Copied!" : "Copy"}
            </Text>
          </Pressable>
          <Pressable style={styles.codeButton} onPress={handleShare}>
            <Icon name="share-alt" size={16} color={colors.primary[600]} />
            <Text style={styles.codeButtonText}>Share</Text>
          </Pressable>
        </View>
      </View>

      {/* Credits Card */}
      <View style={styles.creditsCard}>
        <View style={styles.creditsHeader}>
          <Icon name="dollar" size={20} color={colors.success[600]} />
          <Text style={styles.creditsTitle}>Available Credits</Text>
        </View>
        <Text style={styles.creditsAmount}>${formatDollars(referralData.availableCredits)}</Text>
        <Text style={styles.creditsDescription}>
          Credits will be automatically applied to your next booking
        </Text>
      </View>

      {/* Stats Card */}
      <View style={styles.statsCard}>
        <Text style={styles.statsTitle}>Referral Stats</Text>
        <View style={styles.statsGrid}>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{referralData.stats.totalReferrals}</Text>
            <Text style={styles.statLabel}>Total</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: colors.warning[500] }]}>
              {referralData.stats.pending}
            </Text>
            <Text style={styles.statLabel}>Pending</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: colors.success[500] }]}>
              {referralData.stats.rewarded}
            </Text>
            <Text style={styles.statLabel}>Rewarded</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: colors.primary[600] }]}>
              ${formatDollars(referralData.stats.totalEarned)}
            </Text>
            <Text style={styles.statLabel}>Earned</Text>
          </View>
        </View>
      </View>

      {/* Available Programs */}
      {referralData.programs.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Available Programs</Text>
          {referralData.programs.map((program, index) => (
            <View key={index} style={styles.programCard}>
              <Text style={styles.programName}>{program.name}</Text>
              <Text style={styles.programDescription}>{program.description}</Text>
            </View>
          ))}
        </View>
      )}

      {/* Referral History */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Referral History</Text>
        {referralData.referrals.length === 0 ? (
          <View style={styles.emptyState}>
            <Icon name="users" size={32} color={colors.text.tertiary} />
            <Text style={styles.emptyStateText}>No referrals yet</Text>
            <Text style={styles.emptyStateSubtext}>
              Share your code to start earning rewards!
            </Text>
          </View>
        ) : (
          referralData.referrals.map((referral, index) => (
            <View key={index} style={styles.referralCard}>
              <View style={styles.referralCardHeader}>
                <View style={styles.referralUser}>
                  <View style={styles.referralAvatar}>
                    <Icon name="user" size={16} color={colors.primary[600]} />
                  </View>
                  <View>
                    <Text style={styles.referralName}>
                      {referral.referred?.firstName || "User"}
                    </Text>
                    <Text style={styles.referralType}>
                      {getProgramLabel(referral.programType)}
                    </Text>
                  </View>
                </View>
                <View
                  style={[
                    styles.statusBadge,
                    { backgroundColor: getStatusColor(referral.status) + "20" },
                  ]}
                >
                  <Text
                    style={[styles.statusText, { color: getStatusColor(referral.status) }]}
                  >
                    {getStatusLabel(referral.status)}
                  </Text>
                </View>
              </View>
              <View style={styles.referralProgress}>
                <Text style={styles.progressText}>
                  {referral.cleaningsCompleted} / {referral.cleaningsRequired} cleanings
                </Text>
                <View style={styles.progressBar}>
                  <View
                    style={[
                      styles.progressFill,
                      {
                        width: `${Math.min(
                          (referral.cleaningsCompleted / referral.cleaningsRequired) * 100,
                          100
                        )}%`,
                      },
                    ]}
                  />
                </View>
              </View>
              {referral.rewardApplied && (
                <View style={styles.rewardApplied}>
                  <Icon name="check-circle" size={14} color={colors.success[600]} />
                  <Text style={styles.rewardAppliedText}>
                    ${formatDollars(referral.rewardAmount)} earned
                  </Text>
                </View>
              )}
            </View>
          ))
        )}
      </View>

      <View style={{ height: 40 }} />
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.tertiary,
  },
  contentContainer: {
    padding: spacing.lg,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: colors.background.tertiary,
  },
  loadingText: {
    marginTop: spacing.md,
    fontSize: typography.fontSize.base,
    color: colors.text.secondary,
  },
  errorContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: colors.background.tertiary,
    padding: spacing.xl,
  },
  errorText: {
    marginTop: spacing.md,
    fontSize: typography.fontSize.base,
    color: colors.text.secondary,
    textAlign: "center",
  },
  retryButton: {
    marginTop: spacing.lg,
    backgroundColor: colors.primary[600],
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    borderRadius: radius.lg,
  },
  retryButtonText: {
    color: colors.neutral[0],
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: spacing.lg,
  },
  backButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: spacing.sm,
    paddingRight: spacing.md,
    gap: spacing.sm,
  },
  backButtonText: {
    color: colors.primary[600],
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.medium,
  },
  headerTitle: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
  },
  codeCard: {
    backgroundColor: colors.primary[50],
    borderRadius: radius.xl,
    padding: spacing.xl,
    marginBottom: spacing.md,
    borderWidth: 2,
    borderColor: colors.primary[200],
    alignItems: "center",
  },
  codeCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  codeCardTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.semibold,
    color: colors.primary[800],
  },
  codeText: {
    fontSize: 32,
    fontWeight: typography.fontWeight.bold,
    color: colors.primary[600],
    letterSpacing: 2,
    marginBottom: spacing.sm,
  },
  codeDescription: {
    fontSize: typography.fontSize.sm,
    color: colors.primary[700],
    textAlign: "center",
    marginBottom: spacing.lg,
  },
  codeButtons: {
    flexDirection: "row",
    gap: spacing.md,
  },
  codeButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    backgroundColor: colors.neutral[0],
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.primary[300],
  },
  codeButtonSuccess: {
    backgroundColor: colors.success[50],
    borderColor: colors.success[300],
  },
  codeButtonText: {
    color: colors.primary[600],
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
  },
  codeButtonTextSuccess: {
    color: colors.success[600],
  },
  creditsCard: {
    backgroundColor: colors.success[50],
    borderRadius: radius.xl,
    padding: spacing.lg,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.success[200],
  },
  creditsHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  creditsTitle: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.medium,
    color: colors.success[800],
  },
  creditsAmount: {
    fontSize: 28,
    fontWeight: typography.fontWeight.bold,
    color: colors.success[600],
    marginBottom: spacing.xs,
  },
  creditsDescription: {
    fontSize: typography.fontSize.sm,
    color: colors.success[700],
  },
  statsCard: {
    backgroundColor: colors.neutral[0],
    borderRadius: radius.xl,
    padding: spacing.lg,
    marginBottom: spacing.md,
    ...shadows.sm,
  },
  statsTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
    marginBottom: spacing.lg,
  },
  statsGrid: {
    flexDirection: "row",
    justifyContent: "space-around",
  },
  statItem: {
    alignItems: "center",
  },
  statValue: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
  },
  statLabel: {
    fontSize: typography.fontSize.sm,
    color: colors.text.tertiary,
    marginTop: spacing.xs,
  },
  section: {
    marginBottom: spacing.md,
  },
  sectionTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
    marginBottom: spacing.md,
  },
  programCard: {
    backgroundColor: colors.neutral[0],
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.sm,
    ...shadows.sm,
  },
  programName: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
    marginBottom: spacing.xs,
  },
  programDescription: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
  },
  emptyState: {
    backgroundColor: colors.neutral[0],
    borderRadius: radius.xl,
    padding: spacing.xl,
    alignItems: "center",
    ...shadows.sm,
  },
  emptyStateText: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.secondary,
    marginTop: spacing.md,
  },
  emptyStateSubtext: {
    fontSize: typography.fontSize.sm,
    color: colors.text.tertiary,
    marginTop: spacing.xs,
    textAlign: "center",
  },
  referralCard: {
    backgroundColor: colors.neutral[0],
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.sm,
    ...shadows.sm,
  },
  referralCardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.md,
  },
  referralUser: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  referralAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.primary[100],
    alignItems: "center",
    justifyContent: "center",
  },
  referralName: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
  },
  referralType: {
    fontSize: typography.fontSize.sm,
    color: colors.text.tertiary,
  },
  statusBadge: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.md,
  },
  statusText: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.semibold,
  },
  referralProgress: {
    marginBottom: spacing.sm,
  },
  progressText: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
    marginBottom: spacing.xs,
  },
  progressBar: {
    height: 6,
    backgroundColor: colors.neutral[200],
    borderRadius: 3,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    backgroundColor: colors.primary[500],
    borderRadius: 3,
  },
  rewardApplied: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  rewardAppliedText: {
    fontSize: typography.fontSize.sm,
    color: colors.success[600],
    fontWeight: typography.fontWeight.medium,
  },
});

export default MyReferralsPage;
