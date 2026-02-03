import React, { useEffect, useState, useCallback } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useNavigate } from "react-router-native";
import Icon from "react-native-vector-icons/FontAwesome";
import ClientDashboardService from "../../services/fetchRequests/ClientDashboardService";
import FetchData from "../../services/fetchRequests/fetchData";
import {
  colors,
  spacing,
  radius,
  typography,
  shadows,
} from "../../services/styles/theme";

const ClientRequestsList = ({ state, dispatch }) => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [requestsByHome, setRequestsByHome] = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  const [processingRequest, setProcessingRequest] = useState(null);
  const [expandedHomes, setExpandedHomes] = useState({});

  const toggleHomeExpanded = (homeId) => {
    setExpandedHomes((prev) => ({
      ...prev,
      [homeId]: !prev[homeId],
    }));
  };

  const expandAll = () => {
    const allExpanded = {};
    requestsByHome.forEach((homeGroup) => {
      allExpanded[homeGroup.home.id] = true;
    });
    setExpandedHomes(allExpanded);
  };

  const collapseAll = () => {
    const allCollapsed = {};
    requestsByHome.forEach((homeGroup) => {
      allCollapsed[homeGroup.home.id] = false;
    });
    setExpandedHomes(allCollapsed);
  };

  const allExpanded = requestsByHome.length > 0 &&
    requestsByHome.every((homeGroup) => expandedHomes[homeGroup.home.id] !== false);
  const allCollapsed = requestsByHome.length > 0 &&
    requestsByHome.every((homeGroup) => expandedHomes[homeGroup.home.id] === false);

  // Initialize all homes as expanded when data loads
  useEffect(() => {
    if (requestsByHome.length > 0) {
      const initialExpanded = {};
      requestsByHome.forEach((homeGroup) => {
        // Only set if not already defined (preserve user's preference)
        if (expandedHomes[homeGroup.home.id] === undefined) {
          initialExpanded[homeGroup.home.id] = true;
        }
      });
      if (Object.keys(initialExpanded).length > 0) {
        setExpandedHomes((prev) => ({ ...prev, ...initialExpanded }));
      }
    }
  }, [requestsByHome]);

  const fetchRequests = useCallback(async (isRefresh = false) => {
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    try {
      const data = await ClientDashboardService.getPendingRequestsForClient(
        state.currentUser.token
      );
      setRequestsByHome(data.requestsByHome || []);
      setTotalCount(data.totalCount || 0);
    } catch (error) {
      console.error("Error fetching requests:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [state.currentUser.token]);

  useEffect(() => {
    fetchRequests();
  }, [fetchRequests]);

  const onRefresh = useCallback(() => {
    fetchRequests(true);
  }, [fetchRequests]);

  const handleApprove = async (requestId, cleanerId, appointmentId, cleanerName) => {
    setProcessingRequest(requestId);
    try {
      await FetchData.approveRequest(requestId, true);
      // Remove the request from local state
      setRequestsByHome((prev) =>
        prev
          .map((homeGroup) => ({
            ...homeGroup,
            requests: homeGroup.requests.filter(
              (r) => r.request.id !== requestId
            ),
          }))
          .filter((homeGroup) => homeGroup.requests.length > 0)
      );
      setTotalCount((prev) => prev - 1);

      // Update the global pending requests count in TopBar
      if (dispatch) {
        dispatch({ type: "DECREMENT_PENDING_CLEANER_REQUESTS" });
      }

      // Refresh appointments in global state so Bill page gets updated paymentIntentId
      try {
        const dashboardData = await ClientDashboardService.getDashboardSummary(
          state.currentUser.token
        );
        if (dashboardData.user?.appointments && dispatch) {
          dispatch({
            type: "USER_APPOINTMENTS",
            payload: dashboardData.user.appointments,
          });
        }
      } catch (refreshError) {
        console.warn("Failed to refresh appointments:", refreshError);
      }

      Alert.alert(
        "Cleaner Approved",
        `${cleanerName || "The cleaner"} has been approved for this appointment.`
      );
    } catch (error) {
      console.error("Error approving request:", error);
      Alert.alert("Error", "Failed to approve the request. Please try again.");
    } finally {
      setProcessingRequest(null);
    }
  };

  const handleDeny = async (cleanerId, appointmentId, requestId, cleanerName) => {
    setProcessingRequest(requestId);
    try {
      await FetchData.denyRequest(cleanerId, appointmentId);
      // Remove the request from local state
      setRequestsByHome((prev) =>
        prev
          .map((homeGroup) => ({
            ...homeGroup,
            requests: homeGroup.requests.filter(
              (r) => r.request.id !== requestId
            ),
          }))
          .filter((homeGroup) => homeGroup.requests.length > 0)
      );
      setTotalCount((prev) => prev - 1);

      // Update the global pending requests count in TopBar
      if (dispatch) {
        dispatch({ type: "DECREMENT_PENDING_CLEANER_REQUESTS" });
      }

      Alert.alert(
        "Request Denied",
        `${cleanerName || "The cleaner"}'s request has been denied.`
      );
    } catch (error) {
      console.error("Error denying request:", error);
      Alert.alert("Error", "Failed to deny the request. Please try again.");
    } finally {
      setProcessingRequest(null);
    }
  };

  const handleViewCleanerReviews = (cleanerId, requestId, appointmentId, homeId) => {
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
      weekday: "short",
      month: "short",
      day: "numeric",
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
          <Icon key={i} name="star" size={14} color="#FFD700" />
        );
      } else if (i - 0.5 === roundedRating) {
        stars.push(
          <Icon key={i} name="star-half-full" size={14} color="#FFD700" />
        );
      } else {
        stars.push(
          <Icon key={i} name="star-o" size={14} color="#cccccc" />
        );
      }
    }
    return stars;
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary[500]} />
        <Text style={styles.loadingText}>Loading requests...</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.contentContainer}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          colors={[colors.primary[500]]}
          tintColor={colors.primary[500]}
        />
      }
    >
      {/* Header */}
      <View style={styles.header}>
        <Pressable style={styles.backButton} onPress={() => navigate("/")}>
          <Icon name="angle-left" size={20} color={colors.primary[600]} />
          <Text style={styles.backButtonText}>Back</Text>
        </Pressable>
        <Text style={styles.title}>Cleaner Requests</Text>
        <View style={styles.headerSpacer} />
      </View>

      {/* Summary */}
      {totalCount > 0 && (
        <View style={styles.summaryCard}>
          <Icon name="bell" size={20} color={colors.primary[600]} />
          <Text style={styles.summaryText}>
            You have {totalCount} pending request{totalCount !== 1 ? "s" : ""} from cleaners
          </Text>
        </View>
      )}

      {/* Expand/Collapse All Buttons */}
      {requestsByHome.length > 1 && (
        <View style={styles.expandCollapseRow}>
          <Pressable
            style={({ pressed }) => [
              styles.expandCollapseButton,
              allExpanded && styles.expandCollapseButtonDisabled,
              pressed && !allExpanded && styles.expandCollapseButtonPressed,
            ]}
            onPress={expandAll}
            disabled={allExpanded}
          >
            <Icon
              name="expand"
              size={12}
              color={allExpanded ? colors.text.tertiary : colors.primary[600]}
            />
            <Text
              style={[
                styles.expandCollapseButtonText,
                allExpanded && styles.expandCollapseButtonTextDisabled,
              ]}
            >
              Expand All
            </Text>
          </Pressable>
          <Pressable
            style={({ pressed }) => [
              styles.expandCollapseButton,
              allCollapsed && styles.expandCollapseButtonDisabled,
              pressed && !allCollapsed && styles.expandCollapseButtonPressed,
            ]}
            onPress={collapseAll}
            disabled={allCollapsed}
          >
            <Icon
              name="compress"
              size={12}
              color={allCollapsed ? colors.text.tertiary : colors.primary[600]}
            />
            <Text
              style={[
                styles.expandCollapseButtonText,
                allCollapsed && styles.expandCollapseButtonTextDisabled,
              ]}
            >
              Collapse All
            </Text>
          </Pressable>
        </View>
      )}

      {/* Requests by Home */}
      {requestsByHome.length > 0 ? (
        requestsByHome.map((homeGroup) => {
          const isExpanded = expandedHomes[homeGroup.home.id] !== false;
          return (
          <View key={homeGroup.home.id} style={styles.homeSection}>
            <Pressable
              style={({ pressed }) => [
                styles.homeHeader,
                styles.homeHeaderClickable,
                pressed && styles.homeHeaderPressed,
              ]}
              onPress={() => toggleHomeExpanded(homeGroup.home.id)}
            >
              <Icon name="home" size={16} color={colors.primary[600]} />
              <Text style={styles.homeName}>
                {homeGroup.home.nickName || homeGroup.home.address}
              </Text>
              <View style={styles.requestCountBadge}>
                <Text style={styles.requestCountText}>
                  {homeGroup.requests.length}
                </Text>
              </View>
              <Icon
                name={isExpanded ? "chevron-up" : "chevron-down"}
                size={14}
                color={colors.text.tertiary}
                style={styles.expandIcon}
              />
            </Pressable>

            {isExpanded && homeGroup.requests.map((req) => {
              const cleaner = req.cleaner;
              const request = req.request;
              const appointment = req.appointment;
              const reviews = cleaner?.reviews || [];
              const averageRating = getAverageRating(reviews);
              const isProcessing = processingRequest === request.id;
              const isOnHold = request.status === "onHold";

              return (
                <View
                  key={request.id}
                  style={[styles.requestCard, isOnHold && styles.requestCardOnHold]}
                >
                  {/* On Hold Badge */}
                  {isOnHold && (
                    <View style={styles.onHoldBadge}>
                      <Icon name="pause-circle" size={12} color={colors.text.tertiary} />
                      <Text style={styles.onHoldBadgeText}>On hold - cleaner already assigned</Text>
                    </View>
                  )}

                  {/* Date Badge */}
                  <View style={[styles.dateBadge, isOnHold && styles.dateBadgeOnHold]}>
                    <Icon name="calendar" size={12} color={isOnHold ? colors.text.tertiary : colors.primary[600]} />
                    <Text style={[styles.dateText, isOnHold && styles.dateTextOnHold]}>{formatDate(appointment.date)}</Text>
                  </View>

                  {/* Cleaner Info */}
                  <Pressable
                    style={[styles.cleanerInfo, isOnHold && styles.cleanerInfoOnHold]}
                    onPress={() =>
                      handleViewCleanerReviews(
                        cleaner.id,
                        request.id,
                        appointment.id,
                        homeGroup.home.id
                      )
                    }
                  >
                    <View style={[styles.avatarContainer, isOnHold && styles.avatarContainerOnHold]}>
                      <Text style={[styles.avatarText, isOnHold && styles.avatarTextOnHold]}>
                        {cleaner?.username?.charAt(0)?.toUpperCase() || "?"}
                      </Text>
                    </View>
                    <View style={styles.cleanerDetails}>
                      <Text style={[styles.cleanerName, isOnHold && styles.cleanerNameOnHold]}>{cleaner?.username}</Text>
                      <View style={styles.ratingRow}>
                        <View style={styles.starsRow}>{renderStars(reviews)}</View>
                        {reviews.length > 0 ? (
                          <Text style={styles.ratingText}>
                            {averageRating.toFixed(1)} ({reviews.length})
                          </Text>
                        ) : (
                          <Text style={styles.noRatingText}>No reviews</Text>
                        )}
                      </View>
                    </View>
                    <Icon name="chevron-right" size={14} color={colors.text.tertiary} />
                  </Pressable>

                  {/* Tap hint */}
                  <Text style={styles.tapHint}>Tap to view reviews</Text>

                  {/* Action Buttons */}
                  <View style={styles.actionButtons}>
                    {isOnHold ? (
                      <View style={[styles.actionButton, styles.onHoldButton]}>
                        <Icon name="pause" size={14} color={colors.text.tertiary} />
                        <Text style={styles.onHoldButtonText}>On Hold</Text>
                      </View>
                    ) : (
                      <>
                        <Pressable
                          style={[styles.actionButton, styles.approveButton]}
                          onPress={() =>
                            handleApprove(request.id, cleaner.id, appointment.id, cleaner?.username)
                          }
                          disabled={isProcessing}
                        >
                          {isProcessing ? (
                            <ActivityIndicator size="small" color={colors.neutral[0]} />
                          ) : (
                            <>
                              <Icon name="check" size={14} color={colors.neutral[0]} />
                              <Text style={styles.approveButtonText}>Approve</Text>
                            </>
                          )}
                        </Pressable>
                        <Pressable
                          style={[styles.actionButton, styles.denyButton]}
                          onPress={() =>
                            handleDeny(cleaner.id, appointment.id, request.id, cleaner?.username)
                          }
                          disabled={isProcessing}
                        >
                          {isProcessing ? (
                            <ActivityIndicator size="small" color={colors.neutral[0]} />
                          ) : (
                            <>
                              <Icon name="times" size={14} color={colors.neutral[0]} />
                              <Text style={styles.denyButtonText}>Deny</Text>
                            </>
                          )}
                        </Pressable>
                      </>
                    )}
                  </View>
                </View>
              );
            })}
          </View>
        );})
      ) : (
        <View style={styles.emptyState}>
          <View style={styles.emptyIcon}>
            <Icon name="inbox" size={40} color={colors.primary[300]} />
          </View>
          <Text style={styles.emptyTitle}>No Pending Requests</Text>
          <Text style={styles.emptyText}>
            You don't have any cleaner requests at the moment. When cleaners
            request to clean your home, they'll appear here.
          </Text>
          <Pressable style={styles.emptyButton} onPress={() => navigate("/")}>
            <Text style={styles.emptyButtonText}>Back to Dashboard</Text>
          </Pressable>
        </View>
      )}

      <View style={styles.bottomSpacer} />
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.secondary,
  },
  contentContainer: {
    padding: spacing.lg,
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

  // Header
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: spacing.lg,
    paddingTop: spacing.md,
  },
  backButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: spacing.sm,
    paddingRight: spacing.md,
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

  // Summary Card
  summaryCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.primary[50],
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.lg,
    gap: spacing.sm,
  },
  summaryText: {
    flex: 1,
    fontSize: typography.fontSize.sm,
    color: colors.primary[700],
  },

  // Expand/Collapse Buttons
  expandCollapseRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  expandCollapseButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.neutral[0],
    borderWidth: 1,
    borderColor: colors.primary[200],
  },
  expandCollapseButtonPressed: {
    backgroundColor: colors.primary[50],
  },
  expandCollapseButtonDisabled: {
    borderColor: colors.neutral[200],
    backgroundColor: colors.neutral[50],
  },
  expandCollapseButtonText: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.medium,
    color: colors.primary[600],
  },
  expandCollapseButtonTextDisabled: {
    color: colors.text.tertiary,
  },

  // Home Section
  homeSection: {
    marginBottom: spacing.xl,
  },
  homeHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: spacing.md,
    gap: spacing.sm,
  },
  homeHeaderClickable: {
    backgroundColor: colors.neutral[0],
    padding: spacing.md,
    borderRadius: radius.lg,
    ...shadows.sm,
  },
  homeHeaderPressed: {
    backgroundColor: colors.neutral[100],
  },
  expandIcon: {
    marginLeft: spacing.xs,
  },
  homeName: {
    flex: 1,
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
  },
  requestCountBadge: {
    backgroundColor: colors.primary[600],
    borderRadius: radius.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    minWidth: 24,
    alignItems: "center",
  },
  requestCountText: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.bold,
    color: colors.neutral[0],
  },

  // Request Card
  requestCard: {
    backgroundColor: colors.neutral[0],
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.sm,
    ...shadows.sm,
  },
  dateBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    backgroundColor: colors.primary[50],
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.md,
    alignSelf: "flex-start",
    marginBottom: spacing.sm,
  },
  dateText: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.medium,
    color: colors.primary[700],
  },
  cleanerInfo: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: spacing.sm,
  },
  avatarContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primary[100],
    alignItems: "center",
    justifyContent: "center",
    marginRight: spacing.md,
  },
  avatarText: {
    fontSize: typography.fontSize.base,
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
    marginBottom: 2,
  },
  ratingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  starsRow: {
    flexDirection: "row",
    gap: 2,
  },
  ratingText: {
    fontSize: typography.fontSize.xs,
    color: colors.text.secondary,
  },
  noRatingText: {
    fontSize: typography.fontSize.xs,
    color: colors.text.tertiary,
    fontStyle: "italic",
  },
  tapHint: {
    fontSize: typography.fontSize.xs,
    color: colors.text.tertiary,
    marginBottom: spacing.sm,
    marginLeft: 56,
  },

  // Action Buttons
  actionButtons: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  actionButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: spacing.sm,
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

  // On Hold Styles
  requestCardOnHold: {
    opacity: 0.6,
    backgroundColor: colors.neutral[100],
  },
  onHoldBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    backgroundColor: colors.neutral[200],
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.md,
    alignSelf: "flex-start",
    marginBottom: spacing.sm,
  },
  onHoldBadgeText: {
    fontSize: typography.fontSize.xs,
    color: colors.text.tertiary,
    fontWeight: typography.fontWeight.medium,
  },
  dateBadgeOnHold: {
    backgroundColor: colors.neutral[100],
  },
  dateTextOnHold: {
    color: colors.text.tertiary,
  },
  cleanerInfoOnHold: {
    opacity: 0.8,
  },
  avatarContainerOnHold: {
    backgroundColor: colors.neutral[200],
  },
  avatarTextOnHold: {
    color: colors.text.tertiary,
  },
  cleanerNameOnHold: {
    color: colors.text.secondary,
  },
  onHoldButton: {
    flex: 1,
    backgroundColor: colors.neutral[300],
  },
  onHoldButtonText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.tertiary,
  },

  // Empty State
  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: spacing["4xl"],
  },
  emptyIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.primary[100],
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
    paddingHorizontal: spacing.xl,
    marginBottom: spacing.xl,
  },
  emptyButton: {
    backgroundColor: colors.primary[600],
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    borderRadius: radius.lg,
  },
  emptyButtonText: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.neutral[0],
  },

  bottomSpacer: {
    height: spacing["4xl"],
  },
});

export default ClientRequestsList;
