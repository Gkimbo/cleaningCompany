import React, { useState } from "react";
import { Pressable, Text, View, StyleSheet } from "react-native";
import Icon from "react-native-vector-icons/FontAwesome";

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
  radius: { sm: 4, md: 8, lg: 12 },
};

const ReviewTile = ({
  id,
  userId,
  reviewerId,
  appointmentId,
  rating,
  comment,
  createdAt,
  reviewType,
  reviewer,
  reviewerName: reviewerNameProp,
  cleaningQuality,
  punctuality,
  professionalism,
  communication,
  wouldRecommend,
  accuracyOfDescription,
  homeReadiness,
  easeOfAccess,
  wouldWorkForAgain,
}) => {
  const [expanded, setExpanded] = useState(false);

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    const options = { day: "numeric", month: "long", year: "numeric" };
    return date.toLocaleDateString("en-GB", options);
  };

  const date = createdAt ? formatDate(createdAt) : null;

  const renderStars = (value, size = 16) => {
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

  const renderAspectRow = (label, value) => {
    if (value === null || value === undefined) return null;
    return (
      <View style={styles.aspectRow}>
        <Text style={styles.aspectLabel}>{label}</Text>
        <View style={styles.aspectStars}>{renderStars(value, 14)}</View>
        <Text style={styles.aspectValue}>{value.toFixed(1)}</Text>
      </View>
    );
  };

  const hasAspectRatings =
    cleaningQuality ||
    punctuality ||
    professionalism ||
    communication ||
    accuracyOfDescription ||
    homeReadiness ||
    easeOfAccess;

  const isHomeownerReview = reviewType === "homeowner_to_cleaner";
  const isCleanerReview = reviewType === "cleaner_to_homeowner";

  // Get reviewer display name with fallbacks:
  // 1. Full name from reviewer object (firstName + lastName)
  // 2. Username from reviewer object
  // 3. displayName from reviewer object (set when reviewer was deleted)
  // 4. reviewerName prop (stored on the review when created)
  const getReviewerDisplayName = () => {
    if (reviewer) {
      const fullName = `${reviewer.firstName || ""} ${reviewer.lastName || ""}`.trim();
      if (fullName) return fullName;
      if (reviewer.username) return reviewer.username;
      if (reviewer.displayName) return reviewer.displayName;
    }
    // Fallback to stored reviewerName prop
    return reviewerNameProp || null;
  };

  const reviewerName = getReviewerDisplayName();

  return (
    <Pressable
      style={styles.container}
      onPress={() => hasAspectRatings && setExpanded(!expanded)}
    >
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={styles.avatar}>
            <Icon name="user" size={16} color={theme.colors.textSecondary} />
          </View>
          <View>
            {reviewerName && (
              <Text style={styles.reviewerName}>{reviewerName}</Text>
            )}
            <Text style={styles.dateText}>
              {date || "Date not available"}
            </Text>
          </View>
        </View>
      </View>

      <View style={styles.ratingContainer}>
        <View style={styles.starsRow}>{renderStars(rating, 20)}</View>
        <Text style={styles.ratingText}>{rating.toFixed(1)}</Text>
      </View>

      {comment && <Text style={styles.commentText}>{comment}</Text>}

      {hasAspectRatings && (
        <Pressable
          style={styles.expandButton}
          onPress={() => setExpanded(!expanded)}
        >
          <Text style={styles.expandButtonText}>
            {expanded ? "Hide Details" : "Show Rating Details"}
          </Text>
          <Icon
            name={expanded ? "chevron-up" : "chevron-down"}
            size={12}
            color={theme.colors.primary}
          />
        </Pressable>
      )}

      {expanded && hasAspectRatings && (
        <View style={styles.aspectsContainer}>
          {isHomeownerReview && (
            <>
              {renderAspectRow("Cleaning Quality", cleaningQuality)}
              {renderAspectRow("Punctuality", punctuality)}
              {renderAspectRow("Professionalism", professionalism)}
              {renderAspectRow("Communication", communication)}
              {wouldRecommend !== null && wouldRecommend !== undefined && (
                <View style={styles.recommendRow}>
                  <Text style={styles.aspectLabel}>Would Recommend</Text>
                  <View style={styles.recommendBadge}>
                    <Icon
                      name={wouldRecommend ? "thumbs-up" : "thumbs-down"}
                      size={14}
                      color={
                        wouldRecommend
                          ? theme.colors.success
                          : theme.colors.error
                      }
                    />
                    <Text
                      style={[
                        styles.recommendText,
                        {
                          color: wouldRecommend
                            ? theme.colors.success
                            : theme.colors.error,
                        },
                      ]}
                    >
                      {wouldRecommend ? "Yes" : "No"}
                    </Text>
                  </View>
                </View>
              )}
            </>
          )}

          {isCleanerReview && (
            <>
              {renderAspectRow("Job Description Accuracy", accuracyOfDescription)}
              {renderAspectRow("Home Readiness", homeReadiness)}
              {renderAspectRow("Ease of Access", easeOfAccess)}
              {renderAspectRow("Communication", communication)}
              {wouldWorkForAgain !== null && wouldWorkForAgain !== undefined && (
                <View style={styles.recommendRow}>
                  <Text style={styles.aspectLabel}>Would Work For Again</Text>
                  <View style={styles.recommendBadge}>
                    <Icon
                      name={wouldWorkForAgain ? "thumbs-up" : "thumbs-down"}
                      size={14}
                      color={
                        wouldWorkForAgain
                          ? theme.colors.success
                          : theme.colors.error
                      }
                    />
                    <Text
                      style={[
                        styles.recommendText,
                        {
                          color: wouldWorkForAgain
                            ? theme.colors.success
                            : theme.colors.error,
                        },
                      ]}
                    >
                      {wouldWorkForAgain ? "Yes" : "No"}
                    </Text>
                  </View>
                </View>
              )}
            </>
          )}
        </View>
      )}
    </Pressable>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.md,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: theme.spacing.sm,
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: theme.colors.background,
    justifyContent: "center",
    alignItems: "center",
    marginRight: theme.spacing.sm,
  },
  reviewerName: {
    fontSize: 14,
    fontWeight: "600",
    color: theme.colors.text,
  },
  dateText: {
    fontSize: 12,
    color: theme.colors.textSecondary,
  },
  ratingContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: theme.spacing.sm,
  },
  starsRow: {
    flexDirection: "row",
    marginRight: theme.spacing.sm,
  },
  ratingText: {
    fontSize: 16,
    fontWeight: "700",
    color: theme.colors.text,
  },
  commentText: {
    fontSize: 14,
    color: theme.colors.text,
    lineHeight: 20,
    marginBottom: theme.spacing.sm,
  },
  expandButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: theme.spacing.sm,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    marginTop: theme.spacing.xs,
  },
  expandButtonText: {
    fontSize: 13,
    color: theme.colors.primary,
    fontWeight: "600",
    marginRight: theme.spacing.xs,
  },
  aspectsContainer: {
    marginTop: theme.spacing.sm,
    paddingTop: theme.spacing.sm,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
  },
  aspectRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: theme.spacing.xs,
  },
  aspectLabel: {
    flex: 1,
    fontSize: 13,
    color: theme.colors.textSecondary,
  },
  aspectStars: {
    flexDirection: "row",
    marginHorizontal: theme.spacing.sm,
  },
  aspectValue: {
    fontSize: 13,
    fontWeight: "600",
    color: theme.colors.text,
    minWidth: 30,
    textAlign: "right",
  },
  recommendRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: theme.spacing.xs,
    marginTop: theme.spacing.xs,
  },
  recommendBadge: {
    flexDirection: "row",
    alignItems: "center",
  },
  recommendText: {
    fontSize: 13,
    fontWeight: "600",
    marginLeft: theme.spacing.xs,
  },
});

export default ReviewTile;
