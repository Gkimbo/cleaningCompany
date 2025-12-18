import React, { useEffect, useState, useMemo } from "react";
import {
  Modal,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Dimensions,
} from "react-native";
import Icon from "react-native-vector-icons/FontAwesome";
import { useNavigate } from "react-router-native";
import FetchData from "../../services/fetchRequests/fetchData";
import { colors, spacing, radius, shadows, typography } from "../../services/styles/theme";

const HomeRequestsModal = ({ visible, homeId, token, onClose, onRequestUpdate }) => {
  const [loading, setLoading] = useState(true);
  const [requests, setRequests] = useState([]);
  const [home, setHome] = useState(null);
  const [processingRequest, setProcessingRequest] = useState(null);
  const navigate = useNavigate();
  const { width } = Dimensions.get("window");
  const iconSize = width < 400 ? 16 : width < 800 ? 20 : 24;

  useEffect(() => {
    if (visible && homeId && token) {
      fetchRequests();
    }
  }, [visible, homeId, token]);

  const fetchRequests = async () => {
    setLoading(true);
    try {
      const response = await FetchData.getRequestsForHome(token, homeId);
      setRequests(response.requests || []);
      setHome(response.home || null);
    } catch (error) {
      console.error("Error fetching requests:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (requestId, cleanerId, appointmentId) => {
    setProcessingRequest(requestId);
    try {
      await FetchData.approveRequest(requestId, true);
      // Remove the request from local state
      setRequests((prev) => prev.filter((r) => r.request.id !== requestId));
      if (onRequestUpdate) {
        onRequestUpdate();
      }
    } catch (error) {
      console.error("Error approving request:", error);
    } finally {
      setProcessingRequest(null);
    }
  };

  const handleDeny = async (cleanerId, appointmentId, requestId) => {
    setProcessingRequest(requestId);
    try {
      await FetchData.denyRequest(cleanerId, appointmentId);
      // Remove the request from local state
      setRequests((prev) => prev.filter((r) => r.request.id !== requestId));
      if (onRequestUpdate) {
        onRequestUpdate();
      }
    } catch (error) {
      console.error("Error denying request:", error);
    } finally {
      setProcessingRequest(null);
    }
  };

  const handleViewCleanerReviews = (cleanerId, requestId, appointmentId) => {
    onClose();
    navigate(`/all-cleaner-reviews/${cleanerId}`, {
      state: {
        fromRequests: true,
        requestId,
        appointmentId,
        homeId,
        cleanerId,
      },
    });
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString + "T00:00:00");
    const options = {
      weekday: "long",
      month: "short",
      day: "numeric",
      year: "numeric",
    };
    return date.toLocaleDateString(undefined, options);
  };

  const getAverageRating = (reviews) => {
    if (!reviews || reviews.length === 0) return 0;
    const totalRating = reviews.reduce((sum, review) => sum + review.review, 0);
    return totalRating / reviews.length;
  };

  const renderStars = (reviews) => {
    const averageRating = getAverageRating(reviews);
    const roundedRating = Math.round(averageRating * 2) / 2;
    const stars = [];

    for (let i = 1; i <= 5; i++) {
      if (i <= roundedRating) {
        stars.push(
          <Icon key={i} name="star" size={iconSize} color="#FFD700" />
        );
      } else if (i - 0.5 === roundedRating) {
        stars.push(
          <Icon key={i} name="star-half-full" size={iconSize} color="#FFD700" />
        );
      } else {
        stars.push(
          <Icon key={i} name="star-o" size={iconSize} color="#cccccc" />
        );
      }
    }
    return stars;
  };

  // Group requests by appointment date
  const groupedRequests = useMemo(() => {
    const groups = {};
    requests.forEach((req) => {
      const date = req.appointment?.date;
      if (!groups[date]) {
        groups[date] = [];
      }
      groups[date].push(req);
    });
    // Sort by date
    return Object.entries(groups).sort(
      (a, b) => new Date(a[0]) - new Date(b[0])
    );
  }, [requests]);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.modalContainer}>
          <View style={styles.header}>
            <View style={styles.headerTitleContainer}>
              <Text style={styles.headerTitle}>Cleaning Requests</Text>
              {home && (
                <Text style={styles.headerSubtitle}>{home.nickName || home.address}</Text>
              )}
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Icon name="times" size={24} color={colors.text.secondary} />
            </TouchableOpacity>
          </View>

          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={colors.primary[500]} />
              <Text style={styles.loadingText}>Loading requests...</Text>
            </View>
          ) : requests.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Icon name="inbox" size={48} color={colors.text.tertiary} />
              <Text style={styles.emptyTitle}>No Pending Requests</Text>
              <Text style={styles.emptyText}>
                There are no cleaner requests for this home at the moment.
              </Text>
            </View>
          ) : (
            <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
              {groupedRequests.map(([date, dateRequests]) => (
                <View key={date} style={styles.dateGroup}>
                  <View style={styles.dateHeader}>
                    <Icon name="calendar" size={16} color={colors.primary[600]} />
                    <Text style={styles.dateText}>{formatDate(date)}</Text>
                  </View>

                  {dateRequests.map((req) => {
                    const cleaner = req.cleaner;
                    const request = req.request;
                    const appointment = req.appointment;
                    const reviews = cleaner?.reviews || [];
                    const averageRating = getAverageRating(reviews);
                    const isProcessing = processingRequest === request.id;

                    return (
                      <View key={request.id} style={styles.requestCard}>
                        <TouchableOpacity
                          style={styles.cleanerInfo}
                          onPress={() => handleViewCleanerReviews(cleaner.id, request.id, appointment.id)}
                          activeOpacity={0.7}
                        >
                          <View style={styles.cleanerHeader}>
                            <View style={styles.avatarPlaceholder}>
                              <Text style={styles.avatarText}>
                                {cleaner?.username?.charAt(0)?.toUpperCase() || "?"}
                              </Text>
                            </View>
                            <View style={styles.cleanerDetails}>
                              <Text style={styles.cleanerName}>{cleaner?.username}</Text>
                              <View style={styles.ratingContainer}>
                                <View style={styles.starsRow}>{renderStars(reviews)}</View>
                                {reviews.length > 0 ? (
                                  <Text style={styles.ratingText}>
                                    {averageRating.toFixed(1)} ({reviews.length} {reviews.length === 1 ? "review" : "reviews"})
                                  </Text>
                                ) : (
                                  <Text style={styles.noRatingText}>No reviews yet</Text>
                                )}
                              </View>
                            </View>
                            <Icon name="chevron-right" size={16} color={colors.text.tertiary} />
                          </View>
                          <Text style={styles.tapHint}>Tap to view all reviews</Text>
                        </TouchableOpacity>

                        <View style={styles.appointmentDetails}>
                          <View style={styles.detailRow}>
                            <Text style={styles.detailLabel}>Sheets needed:</Text>
                            <Text style={styles.detailValue}>
                              {appointment?.bringSheets === "yes" ? "Yes" : "No"}
                            </Text>
                          </View>
                          <View style={styles.detailRow}>
                            <Text style={styles.detailLabel}>Towels needed:</Text>
                            <Text style={styles.detailValue}>
                              {appointment?.bringTowels === "yes" ? "Yes" : "No"}
                            </Text>
                          </View>
                        </View>

                        <View style={styles.actionButtons}>
                          <TouchableOpacity
                            style={[styles.actionButton, styles.approveButton]}
                            onPress={() => handleApprove(request.id, cleaner.id, appointment.id)}
                            disabled={isProcessing}
                          >
                            {isProcessing ? (
                              <ActivityIndicator size="small" color={colors.neutral[0]} />
                            ) : (
                              <>
                                <Icon name="check" size={16} color={colors.neutral[0]} />
                                <Text style={styles.approveButtonText}>Approve</Text>
                              </>
                            )}
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={[styles.actionButton, styles.denyButton]}
                            onPress={() => handleDeny(cleaner.id, appointment.id, request.id)}
                            disabled={isProcessing}
                          >
                            {isProcessing ? (
                              <ActivityIndicator size="small" color={colors.neutral[0]} />
                            ) : (
                              <>
                                <Icon name="times" size={16} color={colors.neutral[0]} />
                                <Text style={styles.denyButtonText}>Deny</Text>
                              </>
                            )}
                          </TouchableOpacity>
                        </View>
                      </View>
                    );
                  })}
                </View>
              ))}
            </ScrollView>
          )}
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: colors.glass.overlay,
    justifyContent: "flex-end",
  },
  modalContainer: {
    backgroundColor: colors.background.secondary,
    borderTopLeftRadius: radius["2xl"],
    borderTopRightRadius: radius["2xl"],
    maxHeight: "90%",
    minHeight: "50%",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
    backgroundColor: colors.neutral[0],
    borderTopLeftRadius: radius["2xl"],
    borderTopRightRadius: radius["2xl"],
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
  },
  headerTitleContainer: {
    flex: 1,
  },
  headerTitle: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
  },
  headerSubtitle: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
    marginTop: 2,
  },
  closeButton: {
    padding: spacing.sm,
  },
  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: spacing["4xl"],
  },
  loadingText: {
    marginTop: spacing.md,
    fontSize: typography.fontSize.base,
    color: colors.text.secondary,
  },
  emptyContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: spacing["4xl"],
  },
  emptyTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
    marginTop: spacing.lg,
  },
  emptyText: {
    fontSize: typography.fontSize.base,
    color: colors.text.secondary,
    textAlign: "center",
    marginTop: spacing.sm,
  },
  scrollView: {
    flex: 1,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing["4xl"],
  },
  dateGroup: {
    marginBottom: spacing.xl,
  },
  dateHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: spacing.md,
    gap: spacing.sm,
  },
  dateText: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.primary[700],
  },
  requestCard: {
    backgroundColor: colors.neutral[0],
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginBottom: spacing.md,
    ...shadows.sm,
  },
  cleanerInfo: {
    marginBottom: spacing.md,
  },
  cleanerHeader: {
    flexDirection: "row",
    alignItems: "center",
  },
  avatarPlaceholder: {
    width: 48,
    height: 48,
    borderRadius: 24,
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
  cleanerDetails: {
    flex: 1,
  },
  cleanerName: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
    marginBottom: 4,
  },
  ratingContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    flexWrap: "wrap",
  },
  starsRow: {
    flexDirection: "row",
    gap: 2,
  },
  ratingText: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
  },
  noRatingText: {
    fontSize: typography.fontSize.sm,
    color: colors.text.tertiary,
    fontStyle: "italic",
  },
  tapHint: {
    fontSize: typography.fontSize.xs,
    color: colors.text.tertiary,
    marginTop: spacing.xs,
    marginLeft: 64,
  },
  appointmentDetails: {
    backgroundColor: colors.neutral[50],
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  detailRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: spacing.xs,
  },
  detailLabel: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
  },
  detailValue: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    color: colors.text.primary,
  },
  actionButtons: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  actionButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    gap: spacing.xs,
  },
  approveButton: {
    backgroundColor: colors.success[500],
  },
  approveButtonText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    color: colors.neutral[0],
  },
  denyButton: {
    backgroundColor: colors.error[500],
  },
  denyButtonText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    color: colors.neutral[0],
  },
});

export default HomeRequestsModal;
