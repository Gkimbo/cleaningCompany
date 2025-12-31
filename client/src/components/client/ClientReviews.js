import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Pressable,
} from "react-native";
import Icon from "react-native-vector-icons/FontAwesome";
import {
  colors,
  spacing,
  radius,
  typography,
  shadows,
} from "../../services/styles/theme";
import { API_BASE } from "../../services/config";

const ClientReviews = ({ state }) => {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState(null);
  const [reviews, setReviews] = useState([]);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchReviewData();
  }, [state.currentUser.token]);

  const fetchReviewData = async () => {
    setLoading(true);
    setError(null);

    try {
      // Fetch review stats and reviews in parallel
      const [statsResponse, reviewsResponse] = await Promise.all([
        fetch(`${API_BASE}/reviews/stats`, {
          headers: { Authorization: `Bearer ${state.currentUser.token}` },
        }),
        fetch(`${API_BASE}/reviews`, {
          headers: { Authorization: `Bearer ${state.currentUser.token}` },
        }),
      ]);

      const statsData = await statsResponse.json();
      const reviewsData = await reviewsResponse.json();

      if (statsData.error) {
        throw new Error(statsData.error);
      }

      // Stats are returned directly from the endpoint, not wrapped in { stats: ... }
      setStats(statsData);
      setReviews(reviewsData.reviews || []);
    } catch (err) {
      console.error("Error fetching review data:", err);
      setError("Failed to load reviews");
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const renderStars = (rating) => {
    const stars = [];
    const fullStars = Math.floor(rating);
    const hasHalfStar = rating % 1 >= 0.5;

    for (let i = 1; i <= 5; i++) {
      if (i <= fullStars) {
        stars.push(
          <Icon key={i} name="star" size={14} color="#FFD700" />
        );
      } else if (i === fullStars + 1 && hasHalfStar) {
        stars.push(
          <Icon key={i} name="star-half-o" size={14} color="#FFD700" />
        );
      } else {
        stars.push(
          <Icon key={i} name="star-o" size={14} color={colors.neutral[300]} />
        );
      }
    }
    return stars;
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary[500]} />
        <Text style={styles.loadingText}>Loading reviews...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.errorContainer}>
        <Icon name="exclamation-circle" size={48} color={colors.error[400]} />
        <Text style={styles.errorText}>{error}</Text>
        <Pressable style={styles.retryButton} onPress={fetchReviewData}>
          <Text style={styles.retryButtonText}>Try Again</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
      {/* Header */}
      <View style={styles.header}>
        <Icon name="star" size={24} color={colors.primary[600]} />
        <Text style={styles.headerTitle}>My Reviews</Text>
      </View>
      <Text style={styles.headerSubtitle}>
        See what cleaners have said about you
      </Text>

      {/* Stats Overview */}
      <View style={styles.statsCard}>
        <View style={styles.mainStat}>
          <Text style={styles.mainStatValue}>
            {stats?.averageRating?.toFixed(1) || "0.0"}
          </Text>
          <View style={styles.starsRow}>
            {renderStars(stats?.averageRating || 0)}
          </View>
          <Text style={styles.mainStatLabel}>Overall Rating</Text>
        </View>

        <View style={styles.statsDivider} />

        <View style={styles.secondaryStats}>
          <View style={styles.secondaryStat}>
            <Text style={styles.secondaryStatValue}>{stats?.totalReviews || 0}</Text>
            <Text style={styles.secondaryStatLabel}>Total Reviews</Text>
          </View>
          <View style={styles.secondaryStat}>
            <Text style={styles.secondaryStatValue}>
              {stats?.recommendationRate || 0}%
            </Text>
            <Text style={styles.secondaryStatLabel}>Would Work Again</Text>
          </View>
        </View>
      </View>

      {/* Aspect Breakdown */}
      {stats?.aspectAverages && Object.keys(stats.aspectAverages).length > 0 && (
        <View style={styles.aspectsCard}>
          <Text style={styles.sectionTitle}>Rating Breakdown</Text>
          {Object.entries(stats.aspectAverages).map(([aspect, value]) => {
            if (value === null) return null;
            const label = aspect
              .replace(/([A-Z])/g, " $1")
              .replace(/^./, (str) => str.toUpperCase());
            return (
              <View key={aspect} style={styles.aspectRow}>
                <Text style={styles.aspectLabel}>{label}</Text>
                <View style={styles.aspectRight}>
                  <View style={styles.aspectStars}>{renderStars(value)}</View>
                  <Text style={styles.aspectValue}>{value.toFixed(1)}</Text>
                </View>
              </View>
            );
          })}
        </View>
      )}

      {/* Reviews List */}
      <View style={styles.reviewsSection}>
        <Text style={styles.sectionTitle}>Reviews from Cleaners</Text>

        {reviews.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Icon name="comments-o" size={48} color={colors.neutral[300]} />
            <Text style={styles.emptyTitle}>No Reviews Yet</Text>
            <Text style={styles.emptySubtitle}>
              Reviews will appear here after cleaners rate their experience working for you
            </Text>
          </View>
        ) : (
          reviews.map((review) => (
            <View key={review.id} style={styles.reviewCard}>
              <View style={styles.reviewHeader}>
                <View style={styles.reviewerInfo}>
                  <View style={styles.reviewerAvatar}>
                    <Icon name="user" size={16} color={colors.primary[600]} />
                  </View>
                  <Text style={styles.reviewerName}>
                    {review.reviewer?.username || "Cleaner"}
                  </Text>
                </View>
                <Text style={styles.reviewDate}>{formatDate(review.createdAt)}</Text>
              </View>

              <View style={styles.reviewRating}>
                <View style={styles.starsRow}>{renderStars(review.review)}</View>
                <Text style={styles.ratingValue}>{review.review.toFixed(1)}</Text>
              </View>

              {review.reviewComment && (
                <Text style={styles.reviewComment}>"{review.reviewComment}"</Text>
              )}

              {/* Aspect Ratings */}
              <View style={styles.reviewAspects}>
                {review.accuracyOfDescription && (
                  <View style={styles.aspectBadge}>
                    <Text style={styles.aspectBadgeText}>
                      Accuracy: {review.accuracyOfDescription.toFixed(1)}
                    </Text>
                  </View>
                )}
                {review.homeReadiness && (
                  <View style={styles.aspectBadge}>
                    <Text style={styles.aspectBadgeText}>
                      Readiness: {review.homeReadiness.toFixed(1)}
                    </Text>
                  </View>
                )}
                {review.communication && (
                  <View style={styles.aspectBadge}>
                    <Text style={styles.aspectBadgeText}>
                      Communication: {review.communication.toFixed(1)}
                    </Text>
                  </View>
                )}
              </View>

              {review.wouldWorkForAgain != null && (
                <View style={[
                  styles.recommendBadge,
                  review.wouldWorkForAgain ? styles.recommendYes : styles.recommendNo
                ]}>
                  <Icon
                    name={review.wouldWorkForAgain ? "thumbs-up" : "thumbs-down"}
                    size={12}
                    color={review.wouldWorkForAgain ? colors.success[600] : colors.error[600]}
                  />
                  <Text style={[
                    styles.recommendText,
                    review.wouldWorkForAgain ? styles.recommendTextYes : styles.recommendTextNo
                  ]}>
                    {review.wouldWorkForAgain ? "Would work for again" : "Would not work for again"}
                  </Text>
                </View>
              )}
            </View>
          ))
        )}
      </View>

      <View style={styles.bottomPadding} />
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.neutral[100],
  },
  contentContainer: {
    padding: spacing.lg,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: colors.neutral[100],
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
    backgroundColor: colors.neutral[100],
    padding: spacing.xl,
  },
  errorText: {
    fontSize: typography.fontSize.base,
    color: colors.error[600],
    textAlign: "center",
    marginVertical: spacing.md,
  },
  retryButton: {
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
    gap: spacing.sm,
    marginBottom: spacing.xs,
  },
  headerTitle: {
    fontSize: typography.fontSize["2xl"],
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
  },
  headerSubtitle: {
    fontSize: typography.fontSize.base,
    color: colors.text.secondary,
    marginBottom: spacing.xl,
  },
  statsCard: {
    backgroundColor: colors.neutral[0],
    borderRadius: radius.xl,
    padding: spacing.xl,
    marginBottom: spacing.lg,
    ...shadows.md,
  },
  mainStat: {
    alignItems: "center",
    marginBottom: spacing.lg,
  },
  mainStatValue: {
    fontSize: 48,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
  },
  starsRow: {
    flexDirection: "row",
    gap: 2,
    marginVertical: spacing.xs,
  },
  mainStatLabel: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
  },
  statsDivider: {
    height: 1,
    backgroundColor: colors.neutral[200],
    marginBottom: spacing.lg,
  },
  secondaryStats: {
    flexDirection: "row",
    justifyContent: "space-around",
  },
  secondaryStat: {
    alignItems: "center",
  },
  secondaryStatValue: {
    fontSize: typography.fontSize["2xl"],
    fontWeight: typography.fontWeight.bold,
    color: colors.primary[600],
  },
  secondaryStatLabel: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
    marginTop: spacing.xs,
  },
  aspectsCard: {
    backgroundColor: colors.neutral[0],
    borderRadius: radius.xl,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    ...shadows.sm,
  },
  sectionTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
    marginBottom: spacing.md,
  },
  aspectRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.neutral[100],
  },
  aspectLabel: {
    fontSize: typography.fontSize.base,
    color: colors.text.secondary,
    flex: 1,
  },
  aspectRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  aspectStars: {
    flexDirection: "row",
    gap: 1,
  },
  aspectValue: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
    width: 30,
    textAlign: "right",
  },
  reviewsSection: {
    marginTop: spacing.md,
  },
  emptyContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: spacing["4xl"],
    backgroundColor: colors.neutral[0],
    borderRadius: radius.xl,
    ...shadows.sm,
  },
  emptyTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.secondary,
    marginTop: spacing.lg,
  },
  emptySubtitle: {
    fontSize: typography.fontSize.sm,
    color: colors.text.tertiary,
    marginTop: spacing.sm,
    textAlign: "center",
    paddingHorizontal: spacing.xl,
  },
  reviewCard: {
    backgroundColor: colors.neutral[0],
    borderRadius: radius.xl,
    padding: spacing.lg,
    marginBottom: spacing.md,
    ...shadows.sm,
  },
  reviewHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.md,
  },
  reviewerInfo: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  reviewerAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.primary[100],
    alignItems: "center",
    justifyContent: "center",
  },
  reviewerName: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
  },
  reviewDate: {
    fontSize: typography.fontSize.sm,
    color: colors.text.tertiary,
  },
  reviewRating: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  ratingValue: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
  },
  reviewComment: {
    fontSize: typography.fontSize.base,
    color: colors.text.secondary,
    fontStyle: "italic",
    lineHeight: 22,
    marginBottom: spacing.md,
  },
  reviewAspects: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.xs,
    marginBottom: spacing.sm,
  },
  aspectBadge: {
    backgroundColor: colors.neutral[100],
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.md,
  },
  aspectBadgeText: {
    fontSize: typography.fontSize.xs,
    color: colors.text.secondary,
  },
  recommendBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.full,
    alignSelf: "flex-start",
  },
  recommendYes: {
    backgroundColor: colors.success[50],
  },
  recommendNo: {
    backgroundColor: colors.error[50],
  },
  recommendText: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.medium,
  },
  recommendTextYes: {
    color: colors.success[700],
  },
  recommendTextNo: {
    color: colors.error[700],
  },
  bottomPadding: {
    height: spacing["4xl"],
  },
});

export default ClientReviews;
