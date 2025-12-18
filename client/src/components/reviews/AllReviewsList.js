import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  Pressable,
  View,
  Text,
  ScrollView,
  RefreshControl,
  Modal,
  StyleSheet,
  ActivityIndicator,
} from "react-native";
import { useNavigate } from "react-router-native";
import Icon from "react-native-vector-icons/FontAwesome";
import ReviewTile from "./ReviewTile";
import Review from "../../services/fetchRequests/ReviewClass";

const theme = {
  colors: {
    primary: "#2196F3",
    success: "#4CAF50",
    warning: "#FF9800",
    error: "#F44336",
    background: "#F5F5F5",
    surface: "#FFFFFF",
    text: "#212121",
    textSecondary: "#757575",
    border: "#E0E0E0",
    star: "#FFD700",
    starEmpty: "#E0E0E0",
  },
  spacing: { xs: 4, sm: 8, md: 16, lg: 24 },
  radius: { sm: 4, md: 8, lg: 12, xl: 16 },
};

const AllReviewsList = ({ state, dispatch }) => {
  const [allReviews, setAllReviews] = useState([]);
  const [stats, setStats] = useState(null);
  const [sortOption, setSortOption] = useState("dateNewest");
  const [showSortModal, setShowSortModal] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  const fetchData = async () => {
    if (state.currentUser.token) {
      const [reviewsResponse, statsResponse] = await Promise.all([
        Review.getReviews(state.currentUser.token),
        Review.getReviewStats(state.currentUser.token),
      ]);
      setAllReviews(reviewsResponse.reviews || []);
      setStats(statsResponse);
    }
  };

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      await fetchData();
      setLoading(false);
    };
    loadData();
  }, [state.currentUser.token]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchData();
    setRefreshing(false);
  }, [state.currentUser.token]);

  const handleBackPress = () => {
    navigate("/");
  };

  const renderStars = (value, size = 18) => {
    const stars = [];
    const roundedRating = Math.round(value * 2) / 2;

    for (let i = 1; i <= 5; i++) {
      if (i <= roundedRating) {
        stars.push(
          <Icon key={i} name="star" size={size} color={theme.colors.star} />
        );
      } else if (i - 0.5 === roundedRating) {
        stars.push(
          <Icon
            key={i}
            name="star-half-full"
            size={size}
            color={theme.colors.star}
          />
        );
      } else {
        stars.push(
          <Icon key={i} name="star-o" size={size} color={theme.colors.starEmpty} />
        );
      }
    }
    return stars;
  };

  const sortOptions = [
    { value: "dateNewest", label: "Newest First", icon: "calendar" },
    { value: "dateOldest", label: "Oldest First", icon: "calendar-o" },
    { value: "highestRating", label: "Highest Rating", icon: "star" },
    { value: "lowestRating", label: "Lowest Rating", icon: "star-o" },
  ];

  const sortedReviews = useMemo(() => {
    let sorted = [...allReviews];

    if (sortOption === "dateNewest") {
      sorted.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    } else if (sortOption === "dateOldest") {
      sorted.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
    } else if (sortOption === "highestRating") {
      sorted.sort((a, b) => b.review - a.review);
    } else if (sortOption === "lowestRating") {
      sorted.sort((a, b) => a.review - b.review);
    }

    return sorted;
  }, [allReviews, sortOption]);

  const getSortLabel = () => {
    const option = sortOptions.find((o) => o.value === sortOption);
    return option ? option.label : "Sort";
  };

  const renderAspectStat = (label, value) => {
    if (value === null || value === undefined) return null;
    return (
      <View style={styles.aspectStatRow}>
        <Text style={styles.aspectStatLabel}>{label}</Text>
        <View style={styles.aspectStatValue}>
          <View style={styles.aspectStarsSmall}>{renderStars(value, 12)}</View>
          <Text style={styles.aspectStatNumber}>{value.toFixed(1)}</Text>
        </View>
      </View>
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
        <Text style={styles.loadingText}>Loading reviews...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable style={styles.backButton} onPress={handleBackPress}>
          <Icon name="arrow-left" size={18} color={theme.colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>My Reviews</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[theme.colors.primary]}
          />
        }
      >
        {/* Stats Card */}
        <View style={styles.statsCard}>
          <View style={styles.mainRating}>
            <Text style={styles.ratingNumber}>
              {stats?.averageRating?.toFixed(1) || "0.0"}
            </Text>
            <View style={styles.ratingStars}>
              {renderStars(stats?.averageRating || 0, 22)}
            </View>
            <Text style={styles.reviewCount}>
              {stats?.totalReviews || 0} review{stats?.totalReviews !== 1 ? "s" : ""}
            </Text>
          </View>

          {stats?.recommendationRate > 0 && (
            <View style={styles.recommendationBadge}>
              <Icon name="thumbs-up" size={14} color={theme.colors.success} />
              <Text style={styles.recommendationText}>
                {stats.recommendationRate}% recommend
              </Text>
            </View>
          )}

          {/* Aspect Averages */}
          {stats?.aspectAverages &&
            Object.keys(stats.aspectAverages).length > 0 && (
              <View style={styles.aspectsSection}>
                <Text style={styles.aspectsTitle}>Rating Breakdown</Text>
                {renderAspectStat(
                  "Cleaning Quality",
                  stats.aspectAverages.cleaningQuality
                )}
                {renderAspectStat("Punctuality", stats.aspectAverages.punctuality)}
                {renderAspectStat(
                  "Professionalism",
                  stats.aspectAverages.professionalism
                )}
                {renderAspectStat(
                  "Communication",
                  stats.aspectAverages.communication
                )}
                {renderAspectStat(
                  "Job Accuracy",
                  stats.aspectAverages.accuracyOfDescription
                )}
                {renderAspectStat(
                  "Home Readiness",
                  stats.aspectAverages.homeReadiness
                )}
                {renderAspectStat(
                  "Ease of Access",
                  stats.aspectAverages.easeOfAccess
                )}
              </View>
            )}
        </View>

        {/* Sort Button */}
        {allReviews.length > 0 && (
          <Pressable
            style={styles.sortButton}
            onPress={() => setShowSortModal(true)}
          >
            <Icon name="sort" size={14} color={theme.colors.textSecondary} />
            <Text style={styles.sortButtonText}>{getSortLabel()}</Text>
            <Icon
              name="chevron-down"
              size={12}
              color={theme.colors.textSecondary}
            />
          </Pressable>
        )}

        {/* Reviews List */}
        {sortedReviews.length > 0 ? (
          <View style={styles.reviewsList}>
            {sortedReviews.map((review) => (
              <ReviewTile
                key={review.id}
                id={review.id}
                userId={review.userId}
                reviewerId={review.reviewerId}
                appointmentId={review.appointmentId}
                rating={review.review}
                comment={review.reviewComment}
                createdAt={review.createdAt}
                reviewType={review.reviewType}
                reviewer={review.reviewer}
                cleaningQuality={review.cleaningQuality}
                punctuality={review.punctuality}
                professionalism={review.professionalism}
                communication={review.communication}
                wouldRecommend={review.wouldRecommend}
                accuracyOfDescription={review.accuracyOfDescription}
                homeReadiness={review.homeReadiness}
                easeOfAccess={review.easeOfAccess}
                wouldWorkForAgain={review.wouldWorkForAgain}
              />
            ))}
          </View>
        ) : (
          <View style={styles.emptyState}>
            <View style={styles.emptyIcon}>
              <Icon name="star-o" size={48} color={theme.colors.textSecondary} />
            </View>
            <Text style={styles.emptyTitle}>No Reviews Yet</Text>
            <Text style={styles.emptyText}>
              Reviews will appear here once both you and the other party have
              submitted reviews for a completed appointment.
            </Text>
          </View>
        )}
      </ScrollView>

      {/* Sort Modal */}
      <Modal
        visible={showSortModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowSortModal(false)}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setShowSortModal(false)}
        >
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Sort Reviews</Text>
            {sortOptions.map((option) => (
              <Pressable
                key={option.value}
                style={[
                  styles.modalOption,
                  sortOption === option.value && styles.modalOptionSelected,
                ]}
                onPress={() => {
                  setSortOption(option.value);
                  setShowSortModal(false);
                }}
              >
                <Icon
                  name={option.icon}
                  size={16}
                  color={
                    sortOption === option.value
                      ? theme.colors.primary
                      : theme.colors.textSecondary
                  }
                />
                <Text
                  style={[
                    styles.modalOptionText,
                    sortOption === option.value && styles.modalOptionTextSelected,
                  ]}
                >
                  {option.label}
                </Text>
                {sortOption === option.value && (
                  <Icon name="check" size={16} color={theme.colors.primary} />
                )}
              </Pressable>
            ))}
          </View>
        </Pressable>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: theme.colors.background,
  },
  loadingText: {
    marginTop: theme.spacing.md,
    fontSize: 14,
    color: theme.colors.textSecondary,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.md,
    backgroundColor: theme.colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: theme.colors.background,
    justifyContent: "center",
    alignItems: "center",
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: theme.colors.text,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: theme.spacing.md,
    paddingBottom: theme.spacing.lg * 2,
  },
  statsCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.xl,
    padding: theme.spacing.lg,
    marginBottom: theme.spacing.md,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  mainRating: {
    alignItems: "center",
    marginBottom: theme.spacing.md,
  },
  ratingNumber: {
    fontSize: 48,
    fontWeight: "700",
    color: theme.colors.text,
  },
  ratingStars: {
    flexDirection: "row",
    marginVertical: theme.spacing.sm,
  },
  reviewCount: {
    fontSize: 14,
    color: theme.colors.textSecondary,
  },
  recommendationBadge: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#E8F5E9",
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.radius.md,
    marginBottom: theme.spacing.md,
  },
  recommendationText: {
    fontSize: 14,
    fontWeight: "600",
    color: theme.colors.success,
    marginLeft: theme.spacing.sm,
  },
  aspectsSection: {
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    paddingTop: theme.spacing.md,
  },
  aspectsTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: theme.colors.text,
    marginBottom: theme.spacing.sm,
  },
  aspectStatRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: theme.spacing.xs,
  },
  aspectStatLabel: {
    fontSize: 13,
    color: theme.colors.textSecondary,
  },
  aspectStatValue: {
    flexDirection: "row",
    alignItems: "center",
  },
  aspectStarsSmall: {
    flexDirection: "row",
    marginRight: theme.spacing.sm,
  },
  aspectStatNumber: {
    fontSize: 13,
    fontWeight: "600",
    color: theme.colors.text,
    minWidth: 28,
    textAlign: "right",
  },
  sortButton: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-end",
    backgroundColor: theme.colors.surface,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.radius.md,
    marginBottom: theme.spacing.md,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  sortButtonText: {
    fontSize: 13,
    color: theme.colors.textSecondary,
    marginHorizontal: theme.spacing.sm,
  },
  reviewsList: {
    marginTop: theme.spacing.sm,
  },
  emptyState: {
    alignItems: "center",
    paddingVertical: theme.spacing.lg * 2,
    paddingHorizontal: theme.spacing.lg,
  },
  emptyIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: theme.colors.surface,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: theme.spacing.md,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: theme.colors.text,
    marginBottom: theme.spacing.sm,
  },
  emptyText: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    textAlign: "center",
    lineHeight: 20,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: theme.colors.surface,
    borderTopLeftRadius: theme.radius.xl,
    borderTopRightRadius: theme.radius.xl,
    padding: theme.spacing.lg,
    paddingBottom: theme.spacing.lg * 2,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: theme.colors.text,
    marginBottom: theme.spacing.md,
    textAlign: "center",
  },
  modalOption: {
    flexDirection: "row",
    alignItems: "center",
    padding: theme.spacing.md,
    borderRadius: theme.radius.md,
    marginBottom: theme.spacing.xs,
  },
  modalOptionSelected: {
    backgroundColor: "#E3F2FD",
  },
  modalOptionText: {
    flex: 1,
    fontSize: 15,
    color: theme.colors.text,
    marginLeft: theme.spacing.md,
  },
  modalOptionTextSelected: {
    color: theme.colors.primary,
    fontWeight: "600",
  },
});

export default AllReviewsList;
