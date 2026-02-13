import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import Icon from "react-native-vector-icons/FontAwesome";
import { useNavigate } from "react-router-native";
import {
  colors,
  spacing,
  radius,
  typography,
  shadows,
} from "../../services/styles/theme";
import { API_BASE } from "../../services/config";
import MultiAspectReviewForm from "./MultiAspectReviewForm";
import PhotoComparisonModal from "../conflicts/modals/PhotoComparisonModal";

const PendingReviewsList = ({ state }) => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [pendingReviews, setPendingReviews] = useState([]);
  const [selectedReview, setSelectedReview] = useState(null);
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [showPhotosModal, setShowPhotosModal] = useState(false);
  const [photos, setPhotos] = useState({ before: [], after: [] });
  const [photosLoading, setPhotosLoading] = useState(false);

  // Use state.account to determine user type (cleaner, client, owner, etc.)
  const accountType = state?.account || "client";
  const isCleaner = accountType === "cleaner" || accountType === "employee";
  const isHomeowner = !isCleaner; // Homeowners, owners, HR all review cleaners

  const fetchPendingReviews = useCallback(async (isRefresh = false) => {
    if (!isRefresh) setLoading(true);

    try {
      const response = await fetch(`${API_BASE}/reviews/pending`, {
        headers: {
          Authorization: `Bearer ${state.currentUser.token}`,
        },
      });

      const data = await response.json();

      if (response.ok) {
        setPendingReviews(data.pendingReviews || []);
      }
    } catch (error) {
      console.error("Error fetching pending reviews:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [state.currentUser.token]);

  useEffect(() => {
    fetchPendingReviews();
  }, [fetchPendingReviews]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchPendingReviews(true);
  }, [fetchPendingReviews]);

  const formatDate = (dateString) => {
    const date = new Date(dateString + "T00:00:00");
    const options = { weekday: "short", month: "short", day: "numeric" };
    return date.toLocaleDateString("en-US", options);
  };

  const handleStartReview = (pendingReview) => {
    setSelectedReview(pendingReview);
    setShowReviewModal(true);
  };

  const handleReviewComplete = (data) => {
    setShowReviewModal(false);
    setSelectedReview(null);
    fetchPendingReviews(true);

    // Use setTimeout to ensure the modal is fully closed before showing the alert
    setTimeout(() => {
      const bothReviewed = data?.status?.bothReviewed;
      Alert.alert(
        "Thank you!",
        bothReviewed
          ? "Both reviews are now visible to each other."
          : "Your review has been submitted. It will become visible once the other party submits their review."
      );
    }, 300);
  };

  const getRevieweeInfo = (pendingReview) => {
    if (isHomeowner) {
      // Homeowner reviewing cleaners
      const cleaner = pendingReview.cleaners?.[0];
      return {
        userId: cleaner?.id,
        name: cleaner?.firstName
          ? `${cleaner.firstName} ${cleaner.lastName || ""}`.trim()
          : cleaner?.username || "Cleaner",
        reviewType: "homeowner_to_cleaner",
      };
    } else {
      // Cleaner reviewing homeowner - use homeowner data from API
      const homeowner = pendingReview.homeowner;
      const homeownerName = homeowner?.firstName
        ? `${homeowner.firstName} ${homeowner.lastName || ""}`.trim()
        : homeowner?.username || pendingReview.home?.nickName || "Homeowner";

      return {
        userId: homeowner?.id || pendingReview.home?.ownerId,
        name: homeownerName,
        reviewType: "cleaner_to_homeowner",
      };
    }
  };

  const fetchPhotos = async (appointmentId) => {
    setPhotosLoading(true);
    try {
      const response = await fetch(
        `${API_BASE}/job-photos/${appointmentId}`,
        {
          headers: {
            Authorization: `Bearer ${state.currentUser.token}`,
          },
        }
      );
      const data = await response.json();

      if (data.error) {
        console.error("Error fetching photos:", data.error);
        setPhotos({ before: [], after: [] });
      } else {
        setPhotos({
          before: data.beforePhotos || [],
          after: data.afterPhotos || [],
        });
      }
    } catch (err) {
      console.error("Error fetching photos:", err);
      setPhotos({ before: [], after: [] });
    } finally {
      setPhotosLoading(false);
    }
  };

  const handleViewPhotos = (pendingReview) => {
    setShowPhotosModal(true);
    fetchPhotos(pendingReview.appointmentId);
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary[500]} />
        <Text style={styles.loadingText}>Loading pending reviews...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable style={styles.backButton} onPress={() => navigate("/")}>
          <Icon name="angle-left" size={20} color={colors.primary[600]} />
          <Text style={styles.backButtonText}>Back</Text>
        </Pressable>
        <Text style={styles.title}>Leave a Review</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[colors.primary[500]]}
            tintColor={colors.primary[500]}
          />
        }
      >
        {pendingReviews.length > 0 ? (
          <>
            {/* Info Card */}
            <View style={styles.infoCard}>
              <Icon name="star" size={18} color={colors.warning[600]} />
              <Text style={styles.infoText}>
                {isHomeowner
                  ? "Rate your cleaners to help others find great service!"
                  : "Rate homeowners to help other cleaners find great clients!"}
              </Text>
            </View>

            {/* Stats */}
            <View style={styles.statsCard}>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{pendingReviews.length}</Text>
                <Text style={styles.statLabel}>Pending</Text>
              </View>
            </View>

            {/* Pending Reviews Section */}
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <View style={styles.sectionTitleRow}>
                  <View style={styles.sectionBadge}>
                    <Icon name="star-o" size={12} color={colors.warning[600]} />
                  </View>
                  <Text style={styles.sectionTitle}>Awaiting Your Review</Text>
                </View>
                <Text style={styles.sectionCount}>{pendingReviews.length}</Text>
              </View>

              {pendingReviews.map((pending) => {
                const reviewee = getRevieweeInfo(pending);
                return (
                  <View key={pending.appointmentId} style={styles.pendingCard}>
                    <Pressable onPress={() => handleStartReview(pending)}>
                      <View style={styles.pendingHeader}>
                        <View style={styles.dateContainer}>
                          <Icon name="calendar" size={12} color={colors.primary[600]} />
                          <Text style={styles.dateText}>{formatDate(pending.date)}</Text>
                        </View>
                        <View style={styles.reviewBadge}>
                          <Icon name="star-o" size={10} color={colors.warning[600]} />
                          <Text style={styles.reviewBadgeText}>Review</Text>
                        </View>
                      </View>

                      <View style={styles.pendingContent}>
                        <View style={styles.avatarContainer}>
                          <Text style={styles.avatarText}>
                            {reviewee.name.charAt(0).toUpperCase()}
                          </Text>
                        </View>
                        <View style={styles.pendingDetails}>
                          <Text style={styles.pendingName}>{reviewee.name}</Text>
                          {pending.home && (
                            <Text style={styles.pendingLocation}>
                              {isCleaner
                                ? `Job at ${pending.home.nickName || pending.home.city}`
                                : pending.home.nickName || pending.home.city}
                            </Text>
                          )}
                        </View>
                        <Icon name="chevron-right" size={16} color={colors.text.tertiary} />
                      </View>
                    </Pressable>

                    <View style={styles.pendingFooter}>
                      <Pressable
                        style={styles.viewPhotosButton}
                        onPress={() => handleViewPhotos(pending)}
                      >
                        <Icon name="camera" size={14} color={colors.primary[600]} />
                        <Text style={styles.viewPhotosText}>View Before & After Photos</Text>
                      </Pressable>
                      <Pressable
                        style={styles.reviewButton}
                        onPress={() => handleStartReview(pending)}
                      >
                        <Icon name="star" size={14} color={colors.neutral[0]} />
                        <Text style={styles.reviewButtonText}>Leave Review</Text>
                      </Pressable>
                    </View>
                  </View>
                );
              })}
            </View>

            {/* Double-blind Info */}
            <View style={styles.doubleBlindCard}>
              <Icon name="eye-slash" size={20} color={colors.primary[600]} />
              <View style={styles.doubleBlindContent}>
                <Text style={styles.doubleBlindTitle}>Fair Review System</Text>
                <Text style={styles.doubleBlindText}>
                  Reviews stay private until both parties submit their review.
                  Then both reviews become visible at the same time, ensuring
                  honest and unbiased feedback.
                </Text>
              </View>
            </View>
          </>
        ) : (
          /* Empty State */
          <View style={styles.emptyState}>
            <View style={styles.emptyIcon}>
              <Icon name="check-circle" size={40} color={colors.success[500]} />
            </View>
            <Text style={styles.emptyTitle}>All Caught Up!</Text>
            <Text style={styles.emptyText}>
              {isCleaner
                ? "You don't have any pending reviews. After your next completed job, you'll be able to leave a review for the homeowner here."
                : "You don't have any pending reviews. After your next completed appointment, you'll be able to leave a review here."}
            </Text>
            <Pressable style={styles.homeButton} onPress={() => navigate("/")}>
              <Text style={styles.homeButtonText}>Back to Dashboard</Text>
            </Pressable>
          </View>
        )}

        <View style={styles.bottomSpacer} />
      </ScrollView>

      {/* Review Modal */}
      <Modal
        visible={showReviewModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowReviewModal(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Pressable
              style={styles.modalCloseButton}
              onPress={() => setShowReviewModal(false)}
            >
              <Icon name="times" size={20} color={colors.text.secondary} />
            </Pressable>
            <Text style={styles.modalTitle}>Leave a Review</Text>
            <View style={styles.modalHeaderSpacer} />
          </View>

          {selectedReview && (
            <MultiAspectReviewForm
              state={state}
              appointmentId={selectedReview.appointmentId}
              userId={getRevieweeInfo(selectedReview).userId}
              reviewType={getRevieweeInfo(selectedReview).reviewType}
              revieweeName={getRevieweeInfo(selectedReview).name}
              homeId={selectedReview.home?.id}
              isCleanerPreferred={selectedReview.isCleanerPreferred || false}
              onComplete={handleReviewComplete}
            />
          )}
        </View>
      </Modal>

      {/* Photo Comparison Modal */}
      <PhotoComparisonModal
        visible={showPhotosModal}
        onClose={() => {
          setShowPhotosModal(false);
          setPhotos({ before: [], after: [] });
        }}
        beforePhotos={photos.before}
        afterPhotos={photos.after}
      />

      {/* Loading overlay for photos */}
      {photosLoading && showPhotosModal && (
        <View style={styles.photosLoadingOverlay}>
          <ActivityIndicator size="large" color={colors.neutral[0]} />
          <Text style={styles.photosLoadingText}>Loading photos...</Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.secondary,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: colors.background.secondary,
  },
  loadingText: {
    marginTop: spacing.md,
    fontSize: typography.fontSize.base,
    color: colors.text.secondary,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: spacing.lg,
  },

  // Header
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
    paddingTop: spacing["3xl"],
    paddingBottom: spacing.md,
    backgroundColor: colors.background.secondary,
  },
  backButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  backButtonText: {
    fontSize: typography.fontSize.base,
    color: colors.primary[600],
    fontWeight: typography.fontWeight.medium,
  },
  title: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
  },
  headerSpacer: {
    width: 60,
  },

  // Info Card
  infoCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.warning[50],
    padding: spacing.md,
    borderRadius: radius.lg,
    marginBottom: spacing.md,
    gap: spacing.sm,
  },
  infoText: {
    flex: 1,
    fontSize: typography.fontSize.sm,
    color: colors.warning[700],
    lineHeight: 20,
  },

  // Stats
  statsCard: {
    flexDirection: "row",
    backgroundColor: colors.neutral[0],
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    ...shadows.sm,
  },
  statItem: {
    flex: 1,
    alignItems: "center",
  },
  statValue: {
    fontSize: typography.fontSize["2xl"],
    fontWeight: typography.fontWeight.bold,
    color: colors.warning[600],
  },
  statLabel: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
    marginTop: spacing.xs,
  },

  // Section
  section: {
    marginBottom: spacing.xl,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: spacing.md,
  },
  sectionTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  sectionBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.warning[100],
    alignItems: "center",
    justifyContent: "center",
  },
  sectionTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
  },
  sectionCount: {
    fontSize: typography.fontSize.sm,
    color: colors.text.tertiary,
    fontWeight: typography.fontWeight.medium,
  },

  // Pending Card
  pendingCard: {
    backgroundColor: colors.neutral[0],
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.sm,
    ...shadows.sm,
  },
  pendingHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.sm,
  },
  dateContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    backgroundColor: colors.primary[50],
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.md,
  },
  dateText: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.medium,
    color: colors.primary[700],
  },
  reviewBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    backgroundColor: colors.warning[100],
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.md,
  },
  reviewBadgeText: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.medium,
    color: colors.warning[700],
  },
  pendingContent: {
    flexDirection: "row",
    alignItems: "center",
  },
  avatarContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.primary[100],
    alignItems: "center",
    justifyContent: "center",
    marginRight: spacing.md,
  },
  avatarText: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    color: colors.primary[700],
  },
  pendingDetails: {
    flex: 1,
  },
  pendingName: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
    marginBottom: 2,
  },
  pendingLocation: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
  },
  pendingFooter: {
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border.light,
    gap: spacing.sm,
  },
  viewPhotosButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primary[50],
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    gap: spacing.xs,
  },
  viewPhotosText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    color: colors.primary[600],
  },
  reviewButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primary[600],
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    gap: spacing.xs,
  },
  reviewButtonText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    color: colors.neutral[0],
  },

  // Double-blind Card
  doubleBlindCard: {
    flexDirection: "row",
    backgroundColor: colors.primary[50],
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.md,
  },
  doubleBlindContent: {
    flex: 1,
  },
  doubleBlindTitle: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.primary[700],
    marginBottom: spacing.xs,
  },
  doubleBlindText: {
    fontSize: typography.fontSize.sm,
    color: colors.primary[600],
    lineHeight: 20,
  },

  // Empty State
  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: spacing["4xl"],
    paddingHorizontal: spacing.xl,
  },
  emptyIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.success[100],
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.lg,
  },
  emptyTitle: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
    marginBottom: spacing.sm,
  },
  emptyText: {
    fontSize: typography.fontSize.base,
    color: colors.text.secondary,
    textAlign: "center",
    lineHeight: 22,
    marginBottom: spacing.xl,
  },
  homeButton: {
    backgroundColor: colors.primary[600],
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    borderRadius: radius.lg,
  },
  homeButtonText: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.neutral[0],
  },

  // Modal
  modalContainer: {
    flex: 1,
    backgroundColor: colors.background.secondary,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
    backgroundColor: colors.neutral[0],
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
  },
  modalCloseButton: {
    padding: spacing.sm,
  },
  modalTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
  },
  modalHeaderSpacer: {
    width: 36,
  },

  bottomSpacer: {
    height: spacing["4xl"],
  },

  // Photo loading overlay
  photosLoadingOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0, 0, 0, 0.8)",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1000,
  },
  photosLoadingText: {
    marginTop: spacing.md,
    fontSize: typography.fontSize.base,
    color: colors.neutral[0],
  },
});

export default PendingReviewsList;
