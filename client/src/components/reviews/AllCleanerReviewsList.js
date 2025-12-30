import React, { useState, useEffect, useMemo } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Dimensions,
  Alert,
} from "react-native";
import { useNavigate, useParams, useLocation } from "react-router-native";
import Icon from "react-native-vector-icons/FontAwesome";
import FetchData from "../../services/fetchRequests/fetchData";
import { colors, spacing, radius, shadows, typography } from "../../services/styles/theme";

// Review Card component with multi-aspect support
const ReviewCardWithAspects = ({ review, renderStars, formatDate }) => {
  const [expanded, setExpanded] = useState(false);

  const rating = review.review || review.rating || 0;
  const hasAspectRatings =
    review.cleaningQuality ||
    review.punctuality ||
    review.professionalism ||
    review.communication;

  const renderAspectRow = (label, value) => {
    if (value === null || value === undefined) return null;
    return (
      <View style={styles.aspectRow}>
        <Text style={styles.aspectLabel}>{label}</Text>
        <View style={styles.aspectStars}>{renderStars(value, 12)}</View>
        <Text style={styles.aspectValue}>{value.toFixed(1)}</Text>
      </View>
    );
  };

  return (
    <TouchableOpacity
      style={styles.reviewCard}
      onPress={() => hasAspectRatings && setExpanded(!expanded)}
      activeOpacity={hasAspectRatings ? 0.7 : 1}
    >
      <View style={styles.reviewHeader}>
        <View style={styles.reviewStars}>{renderStars(rating, 16)}</View>
        <Text style={styles.reviewDate}>{formatDate(review.createdAt)}</Text>
      </View>
      <Text style={styles.reviewRating}>{rating.toFixed(1)} / 5.0</Text>
      {(review.reviewComment || review.comment) && (
        <Text style={styles.reviewComment}>
          "{review.reviewComment || review.comment}"
        </Text>
      )}

      {hasAspectRatings && (
        <View style={styles.expandRow}>
          <Text style={styles.expandText}>
            {expanded ? "Hide Details" : "Show Rating Details"}
          </Text>
          <Icon
            name={expanded ? "chevron-up" : "chevron-down"}
            size={12}
            color={colors.primary[600]}
          />
        </View>
      )}

      {expanded && hasAspectRatings && (
        <View style={styles.aspectsContainer}>
          {renderAspectRow("Cleaning Quality", review.cleaningQuality)}
          {renderAspectRow("Punctuality", review.punctuality)}
          {renderAspectRow("Professionalism", review.professionalism)}
          {renderAspectRow("Communication", review.communication)}
          {review.wouldRecommend !== null &&
            review.wouldRecommend !== undefined && (
              <View style={styles.recommendRow}>
                <Text style={styles.aspectLabel}>Would Recommend</Text>
                <View style={styles.recommendBadge}>
                  <Icon
                    name={review.wouldRecommend ? "thumbs-up" : "thumbs-down"}
                    size={14}
                    color={
                      review.wouldRecommend
                        ? colors.success[500]
                        : colors.error[500]
                    }
                  />
                  <Text
                    style={[
                      styles.recommendText,
                      {
                        color: review.wouldRecommend
                          ? colors.success[600]
                          : colors.error[600],
                      },
                    ]}
                  >
                    {review.wouldRecommend ? "Yes" : "No"}
                  </Text>
                </View>
              </View>
            )}
        </View>
      )}
    </TouchableOpacity>
  );
};

const AllCleanerReviewsList = ({ state, dispatch }) => {
  const [cleaner, setCleaner] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sortOption, setSortOption] = useState("newest");
  const [isProcessing, setIsProcessing] = useState(false);
  const [requestHandled, setRequestHandled] = useState(false);
  const { width } = Dimensions.get("window");
  const iconSize = width < 400 ? 16 : width < 800 ? 20 : 24;
  const navigate = useNavigate();
  const location = useLocation();
  const { id } = useParams();

  // Get request context from navigation state
  const requestContext = location.state || {};
  const { fromRequests, requestId, appointmentId, homeId, cleanerId } = requestContext;

  useEffect(() => {
    fetchCleanerProfile();
  }, [id]);

  const fetchCleanerProfile = async () => {
    setLoading(true);
    try {
      // First try to get from API
      const response = await FetchData.getCleanerProfile(id);
      if (response.cleaner) {
        setCleaner(response.cleaner);
      } else {
        // Fallback to state if available
        const employeeFromState = state.requests?.find(
          (r) => r.employeeRequesting?.id === Number(id)
        )?.employeeRequesting;
        if (employeeFromState) {
          setCleaner({
            ...employeeFromState,
            completedJobs: 0,
            totalReviews: employeeFromState.reviews?.length || 0,
          });
        }
      }
    } catch (error) {
      console.error("Error fetching cleaner:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleBack = () => {
    if (fromRequests) {
      // Go back to homes list where they can view requests
      navigate("/list-of-homes");
    } else {
      navigate(-1);
    }
  };

  const handleApprove = async () => {
    if (!requestId) return;
    setIsProcessing(true);
    try {
      await FetchData.approveRequest(requestId, true);
      setRequestHandled("approved");
      if (dispatch) {
        dispatch({ type: "DECREMENT_PENDING_CLEANER_REQUESTS" });
      }
      Alert.alert("Success", "Cleaner has been approved for this appointment!", [
        { text: "OK", onPress: () => navigate("/list-of-homes") }
      ]);
    } catch (error) {
      console.error("Error approving request:", error);
      Alert.alert("Error", "Failed to approve the request. Please try again.");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDeny = async () => {
    if (!cleanerId || !appointmentId) {
      console.error("Missing cleanerId or appointmentId:", { cleanerId, appointmentId });
      Alert.alert("Error", "Unable to deny request. Missing required information.");
      return;
    }

    setIsProcessing(true);
    try {
      const result = await FetchData.denyRequest(cleanerId, appointmentId);
      // Check if result is an error (denyRequest returns error instead of throwing)
      if (result instanceof Error) {
        throw result;
      }
      setRequestHandled("denied");
      if (dispatch) {
        dispatch({ type: "DECREMENT_PENDING_CLEANER_REQUESTS" });
      }
      Alert.alert("Request Denied", "The cleaner's request has been denied.", [
        { text: "OK", onPress: () => navigate("/list-of-homes") }
      ]);
    } catch (error) {
      console.error("Error denying request:", error);
      Alert.alert("Error", "Failed to deny the request. Please try again.");
    } finally {
      setIsProcessing(false);
    }
  };

  const reviews = cleaner?.reviews || [];

  const getAverageRating = () => {
    if (reviews.length === 0) return 0;
    const totalRating = reviews.reduce((sum, review) => sum + (review.review || review.rating || 0), 0);
    return totalRating / reviews.length;
  };

  const averageRating = getAverageRating();
  const roundedRating = Math.round(averageRating * 2) / 2;

  const sortedReviews = useMemo(() => {
    const reviewsCopy = [...reviews];
    switch (sortOption) {
      case "newest":
        return reviewsCopy.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      case "oldest":
        return reviewsCopy.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
      case "highest":
        return reviewsCopy.sort((a, b) => (b.review || b.rating) - (a.review || a.rating));
      case "lowest":
        return reviewsCopy.sort((a, b) => (a.review || a.rating) - (b.review || b.rating));
      default:
        return reviewsCopy;
    }
  }, [reviews, sortOption]);

  const ratingDistribution = useMemo(() => {
    const dist = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
    reviews.forEach((review) => {
      const rating = Math.round(review.review || review.rating || 0);
      if (rating >= 1 && rating <= 5) {
        dist[rating]++;
      }
    });
    return dist;
  }, [reviews]);

  const renderStars = (rating, size = iconSize) => {
    const stars = [];
    const rounded = Math.round(rating * 2) / 2;
    for (let i = 1; i <= 5; i++) {
      if (i <= rounded) {
        stars.push(<Icon key={i} name="star" size={size} color="#FFD700" />);
      } else if (i - 0.5 === rounded) {
        stars.push(<Icon key={i} name="star-half-full" size={size} color="#FFD700" />);
      } else {
        stars.push(<Icon key={i} name="star-o" size={size} color="#cccccc" />);
      }
    }
    return stars;
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    const options = { day: "numeric", month: "long", year: "numeric" };
    return date.toLocaleDateString("en-GB", options);
  };

  const formatMemberSince = (dateString) => {
    if (!dateString) return "Unknown";
    const date = new Date(dateString);
    const options = { month: "long", year: "numeric" };
    return date.toLocaleDateString("en-GB", options);
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary[500]} />
        <Text style={styles.loadingText}>Loading cleaner profile...</Text>
      </View>
    );
  }

  if (!cleaner) {
    return (
      <View style={styles.errorContainer}>
        <Icon name="exclamation-circle" size={48} color={colors.error[500]} />
        <Text style={styles.errorTitle}>Cleaner Not Found</Text>
        <Text style={styles.errorText}>Unable to load cleaner information.</Text>
        <TouchableOpacity style={styles.backButton} onPress={handleBack}>
          <Text style={styles.backButtonText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backIcon} onPress={handleBack}>
          <Icon name="arrow-left" size={20} color={colors.text.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Cleaner Profile</Text>
        <View style={styles.headerSpacer} />
      </View>

      {/* Profile Card */}
      <View style={styles.profileCard}>
        <View style={styles.avatarContainer}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {cleaner.username?.charAt(0)?.toUpperCase() || "?"}
            </Text>
          </View>
          <View style={styles.verifiedBadge}>
            <Icon name="check" size={10} color={colors.neutral[0]} />
          </View>
        </View>

        <Text style={styles.cleanerName}>{cleaner.username}</Text>

        <View style={styles.ratingRow}>
          <View style={styles.starsContainer}>{renderStars(averageRating, 20)}</View>
          <Text style={styles.ratingNumber}>{averageRating.toFixed(1)}</Text>
        </View>

        <Text style={styles.reviewCount}>
          {reviews.length} {reviews.length === 1 ? "review" : "reviews"}
        </Text>

        {/* Stats Row */}
        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <Icon name="check-circle" size={20} color={colors.success[500]} />
            <Text style={styles.statNumber}>{cleaner.completedJobs || 0}</Text>
            <Text style={styles.statLabel}>Jobs Done</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Icon name="calendar" size={20} color={colors.primary[500]} />
            <Text style={styles.statNumber}>{formatMemberSince(cleaner.memberSince)}</Text>
            <Text style={styles.statLabel}>Member Since</Text>
          </View>
        </View>

        {/* Days Working */}
        {cleaner.daysWorking && cleaner.daysWorking.length > 0 && (
          <View style={styles.daysContainer}>
            <Text style={styles.daysTitle}>Available Days</Text>
            <View style={styles.daysRow}>
              {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((day, index) => {
                const fullDay = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"][index];
                const isWorking = cleaner.daysWorking.includes(fullDay);
                return (
                  <View
                    key={day}
                    style={[styles.dayBadge, isWorking && styles.dayBadgeActive]}
                  >
                    <Text style={[styles.dayText, isWorking && styles.dayTextActive]}>
                      {day}
                    </Text>
                  </View>
                );
              })}
            </View>
          </View>
        )}
      </View>

      {/* Approve/Deny Buttons - Only show when coming from requests */}
      {fromRequests && requestId && (
        <View style={[styles.actionCard, requestHandled && styles.actionCardHandled]}>
          {requestHandled ? (
            <>
              <View style={[styles.handledIconContainer, requestHandled === "approved" ? styles.handledIconApproved : styles.handledIconDenied]}>
                <Icon
                  name={requestHandled === "approved" ? "check" : "times"}
                  size={24}
                  color={colors.neutral[0]}
                />
              </View>
              <Text style={styles.actionTitle}>
                {requestHandled === "approved" ? "Request Approved" : "Request Denied"}
              </Text>
              <Text style={styles.actionSubtitle}>
                {requestHandled === "approved"
                  ? "This cleaner has been approved for your appointment."
                  : "This cleaner's request has been denied."}
              </Text>
              <TouchableOpacity
                style={styles.backToHomesButton}
                onPress={() => navigate("/list-of-homes")}
              >
                <Text style={styles.backToHomesButtonText}>Back to My Homes</Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              <Text style={styles.actionTitle}>Cleaning Request</Text>
              <Text style={styles.actionSubtitle}>
                Would you like this cleaner to clean your home?
              </Text>
              <View style={styles.actionButtons}>
                <TouchableOpacity
                  style={[styles.actionButton, styles.approveButton]}
                  onPress={handleApprove}
                  disabled={isProcessing}
                >
                  {isProcessing ? (
                    <ActivityIndicator size="small" color={colors.neutral[0]} />
                  ) : (
                    <>
                      <Icon name="check" size={18} color={colors.neutral[0]} />
                      <Text style={styles.approveButtonText}>Approve</Text>
                    </>
                  )}
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.actionButton, styles.denyButton]}
                  onPress={handleDeny}
                  disabled={isProcessing}
                >
                  {isProcessing ? (
                    <ActivityIndicator size="small" color={colors.neutral[0]} />
                  ) : (
                    <>
                      <Icon name="times" size={18} color={colors.neutral[0]} />
                      <Text style={styles.denyButtonText}>Deny</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            </>
          )}
        </View>
      )}

      {/* Rating Distribution */}
      {reviews.length > 0 && (
        <View style={styles.distributionCard}>
          <Text style={styles.sectionTitle}>Rating Distribution</Text>
          {[5, 4, 3, 2, 1].map((star) => {
            const count = ratingDistribution[star];
            const percentage = reviews.length > 0 ? (count / reviews.length) * 100 : 0;
            return (
              <View key={star} style={styles.distributionRow}>
                <Text style={styles.distributionStar}>{star}</Text>
                <Icon name="star" size={12} color="#FFD700" />
                <View style={styles.distributionBarContainer}>
                  <View style={[styles.distributionBar, { width: `${percentage}%` }]} />
                </View>
                <Text style={styles.distributionCount}>{count}</Text>
              </View>
            );
          })}
        </View>
      )}

      {/* Reviews Section */}
      <View style={styles.reviewsSection}>
        <View style={styles.reviewsHeader}>
          <Text style={styles.sectionTitle}>Reviews</Text>
          {reviews.length > 0 && (
            <TouchableOpacity
              style={styles.sortButton}
              onPress={() => {
                const options = ["newest", "oldest", "highest", "lowest"];
                const currentIndex = options.indexOf(sortOption);
                const nextIndex = (currentIndex + 1) % options.length;
                setSortOption(options[nextIndex]);
              }}
            >
              <Icon name="sort" size={14} color={colors.primary[600]} />
              <Text style={styles.sortButtonText}>
                {sortOption === "newest" && "Newest"}
                {sortOption === "oldest" && "Oldest"}
                {sortOption === "highest" && "Highest"}
                {sortOption === "lowest" && "Lowest"}
              </Text>
            </TouchableOpacity>
          )}
        </View>

        {reviews.length === 0 ? (
          <View style={styles.noReviewsContainer}>
            <Icon name="comment-o" size={40} color={colors.text.tertiary} />
            <Text style={styles.noReviewsTitle}>No Reviews Yet</Text>
            <Text style={styles.noReviewsText}>
              This cleaner hasn't received any reviews yet.
            </Text>
          </View>
        ) : (
          sortedReviews.map((review, index) => (
            <ReviewCardWithAspects
              key={review.id || index}
              review={review}
              renderStars={renderStars}
              formatDate={formatDate}
            />
          ))
        )}
      </View>

      <View style={styles.bottomSpacer} />
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.secondary,
  },
  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.background.secondary,
  },
  loadingText: {
    marginTop: spacing.md,
    fontSize: typography.fontSize.base,
    color: colors.text.secondary,
  },
  errorContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.background.secondary,
    padding: spacing.xl,
  },
  errorTitle: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  errorText: {
    fontSize: typography.fontSize.base,
    color: colors.text.secondary,
    textAlign: "center",
    marginBottom: spacing.xl,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
    paddingTop: spacing["3xl"],
    paddingBottom: spacing.lg,
    backgroundColor: colors.neutral[0],
  },
  backIcon: {
    padding: spacing.sm,
  },
  headerTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
  },
  headerSpacer: {
    width: 36,
  },
  profileCard: {
    backgroundColor: colors.neutral[0],
    marginHorizontal: spacing.lg,
    marginTop: spacing.lg,
    borderRadius: radius.xl,
    padding: spacing.xl,
    alignItems: "center",
    ...shadows.md,
  },
  avatarContainer: {
    position: "relative",
    marginBottom: spacing.md,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.primary[100],
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    fontSize: 32,
    fontWeight: typography.fontWeight.bold,
    color: colors.primary[700],
  },
  verifiedBadge: {
    position: "absolute",
    bottom: 0,
    right: 0,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.success[500],
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: colors.neutral[0],
  },
  cleanerName: {
    fontSize: typography.fontSize["2xl"],
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
    marginBottom: spacing.sm,
  },
  ratingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginBottom: spacing.xs,
  },
  starsContainer: {
    flexDirection: "row",
    gap: 2,
  },
  ratingNumber: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
  },
  reviewCount: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
    marginBottom: spacing.xl,
  },
  statsRow: {
    flexDirection: "row",
    alignItems: "center",
    width: "100%",
    paddingTop: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.border.light,
  },
  statItem: {
    flex: 1,
    alignItems: "center",
  },
  statDivider: {
    width: 1,
    height: 40,
    backgroundColor: colors.border.light,
  },
  statNumber: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
    marginTop: spacing.xs,
  },
  statLabel: {
    fontSize: typography.fontSize.xs,
    color: colors.text.tertiary,
    marginTop: 2,
  },
  daysContainer: {
    width: "100%",
    marginTop: spacing.lg,
    paddingTop: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.border.light,
  },
  daysTitle: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.secondary,
    marginBottom: spacing.sm,
    textAlign: "center",
  },
  daysRow: {
    flexDirection: "row",
    justifyContent: "center",
    gap: spacing.xs,
    flexWrap: "wrap",
  },
  dayBadge: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: colors.neutral[100],
  },
  dayBadgeActive: {
    backgroundColor: colors.primary[100],
  },
  dayText: {
    fontSize: typography.fontSize.xs,
    color: colors.text.tertiary,
    fontWeight: typography.fontWeight.medium,
  },
  dayTextActive: {
    color: colors.primary[700],
  },
  distributionCard: {
    backgroundColor: colors.neutral[0],
    marginHorizontal: spacing.lg,
    marginTop: spacing.lg,
    borderRadius: radius.xl,
    padding: spacing.lg,
    ...shadows.sm,
  },
  sectionTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
    marginBottom: spacing.md,
  },
  distributionRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: spacing.sm,
    gap: spacing.xs,
  },
  distributionStar: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    color: colors.text.secondary,
    width: 16,
    textAlign: "right",
  },
  distributionBarContainer: {
    flex: 1,
    height: 8,
    backgroundColor: colors.neutral[100],
    borderRadius: radius.full,
    marginHorizontal: spacing.sm,
    overflow: "hidden",
  },
  distributionBar: {
    height: "100%",
    backgroundColor: colors.primary[500],
    borderRadius: radius.full,
  },
  distributionCount: {
    fontSize: typography.fontSize.xs,
    color: colors.text.tertiary,
    width: 24,
    textAlign: "right",
  },
  reviewsSection: {
    marginHorizontal: spacing.lg,
    marginTop: spacing.lg,
  },
  reviewsHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.md,
  },
  sortButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    backgroundColor: colors.primary[50],
    borderRadius: radius.md,
  },
  sortButtonText: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.medium,
    color: colors.primary[600],
  },
  noReviewsContainer: {
    backgroundColor: colors.neutral[0],
    borderRadius: radius.xl,
    padding: spacing["3xl"],
    alignItems: "center",
    ...shadows.sm,
  },
  noReviewsTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
    marginTop: spacing.md,
    marginBottom: spacing.xs,
  },
  noReviewsText: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
    textAlign: "center",
  },
  reviewCard: {
    backgroundColor: colors.neutral[0],
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginBottom: spacing.md,
    ...shadows.sm,
  },
  reviewHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.xs,
  },
  reviewStars: {
    flexDirection: "row",
    gap: 2,
  },
  reviewDate: {
    fontSize: typography.fontSize.xs,
    color: colors.text.tertiary,
  },
  reviewRating: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
    marginBottom: spacing.sm,
  },
  reviewComment: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
    fontStyle: "italic",
    lineHeight: 20,
  },
  expandRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingTop: spacing.md,
    marginTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border.light,
    gap: spacing.xs,
  },
  expandText: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.semibold,
    color: colors.primary[600],
  },
  aspectsContainer: {
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border.light,
  },
  aspectRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: spacing.xs,
  },
  aspectLabel: {
    flex: 1,
    fontSize: typography.fontSize.xs,
    color: colors.text.secondary,
  },
  aspectStars: {
    flexDirection: "row",
    marginHorizontal: spacing.sm,
    gap: 1,
  },
  aspectValue: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
    minWidth: 24,
    textAlign: "right",
  },
  recommendRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: spacing.xs,
    marginTop: spacing.xs,
  },
  recommendBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  recommendText: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.semibold,
  },
  bottomSpacer: {
    height: spacing["4xl"],
  },
  backButton: {
    backgroundColor: colors.primary[600],
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    borderRadius: radius.lg,
  },
  backButtonText: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.neutral[0],
  },
  // Action card styles for approve/deny
  actionCard: {
    backgroundColor: colors.neutral[0],
    marginHorizontal: spacing.lg,
    marginTop: spacing.lg,
    borderRadius: radius.xl,
    padding: spacing.xl,
    ...shadows.md,
    borderWidth: 2,
    borderColor: colors.primary[200],
  },
  actionTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
    textAlign: "center",
    marginBottom: spacing.xs,
  },
  actionSubtitle: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
    textAlign: "center",
    marginBottom: spacing.lg,
  },
  actionButtons: {
    flexDirection: "row",
    gap: spacing.md,
  },
  actionButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: spacing.lg,
    borderRadius: radius.lg,
    gap: spacing.sm,
  },
  approveButton: {
    backgroundColor: colors.success[500],
  },
  approveButtonText: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.neutral[0],
  },
  denyButton: {
    backgroundColor: colors.error[500],
  },
  denyButtonText: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.neutral[0],
  },
  actionCardHandled: {
    borderColor: colors.success[200],
  },
  handledIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "center",
    marginBottom: spacing.md,
  },
  handledIconApproved: {
    backgroundColor: colors.success[500],
  },
  handledIconDenied: {
    backgroundColor: colors.error[500],
  },
  backToHomesButton: {
    backgroundColor: colors.primary[600],
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    borderRadius: radius.lg,
    alignSelf: "center",
  },
  backToHomesButtonText: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.neutral[0],
  },
});

export default AllCleanerReviewsList;
