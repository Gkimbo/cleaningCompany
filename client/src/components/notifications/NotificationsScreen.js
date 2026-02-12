import React, { useEffect, useState, useCallback, useContext } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useNavigate } from "react-router-native";
import { Feather } from "@expo/vector-icons";
import { UserContext } from "../../context/UserContext";
import NotificationsService from "../../services/fetchRequests/NotificationsService";
import { useSocket } from "../../services/SocketContext";
import NotificationCard from "./NotificationCard";
import RebookingModal from "../cleaner/RebookingModal";
import BusinessOwnerDeclinedModal from "../client/BusinessOwnerDeclinedModal";
import { colors, spacing, radius, typography, shadows } from "../../services/styles/theme";

const NotificationsScreen = () => {
  const { state } = useContext(UserContext);
  const navigate = useNavigate();
  const { onNotification, onNotificationCountUpdate } = useSocket();

  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [showRebookModal, setShowRebookModal] = useState(false);
  const [selectedNotificationForRebook, setSelectedNotificationForRebook] = useState(null);
  const [showDeclinedModal, setShowDeclinedModal] = useState(false);
  const [selectedDeclinedNotification, setSelectedDeclinedNotification] = useState(null);
  const [pendingReviewsCount, setPendingReviewsCount] = useState(0);

  const fetchNotifications = useCallback(async (pageNum = 1, refresh = false) => {
    try {
      if (refresh) {
        setRefreshing(true);
      } else if (pageNum === 1) {
        setLoading(true);
      } else {
        setLoadingMore(true);
      }

      const data = await NotificationsService.getNotifications(
        state.currentUser.token,
        pageNum,
        20
      );

      if (pageNum === 1) {
        setNotifications(data.notifications || []);
      } else {
        setNotifications((prev) => [...prev, ...(data.notifications || [])]);
      }

      setHasMore(
        data.pagination?.page < data.pagination?.totalPages
      );
      setPage(pageNum);
    } catch (error) {
      console.error("Error fetching notifications:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
      setLoadingMore(false);
    }
  }, [state.currentUser.token]);

  useEffect(() => {
    fetchNotifications(1);
  }, [fetchNotifications]);

  // Fetch pending reviews count
  useEffect(() => {
    const fetchPendingReviews = async () => {
      if (state.currentUser.token) {
        try {
          const response = await fetch(
            `${require("../../services/config").API_BASE}/reviews/pending`,
            {
              headers: {
                Authorization: `Bearer ${state.currentUser.token}`,
              },
            }
          );
          const data = await response.json();
          if (response.ok) {
            setPendingReviewsCount(data.pendingReviews?.length || 0);
          }
        } catch (error) {
          console.error("Error fetching pending reviews:", error);
        }
      }
    };
    fetchPendingReviews();
  }, [state.currentUser.token]);

  // Listen for new notifications in real-time
  useEffect(() => {
    const unsubscribe = onNotification((data) => {
      if (data.notification) {
        setNotifications((prev) => [data.notification, ...prev]);
      }
    });
    return unsubscribe;
  }, [onNotification]);

  const handleRefresh = () => {
    fetchNotifications(1, true);
  };

  const handleLoadMore = () => {
    if (!loadingMore && hasMore) {
      fetchNotifications(page + 1);
    }
  };

  const handleNotificationPress = async (notification) => {
    // Mark as read
    if (!notification.isRead) {
      await NotificationsService.markAsRead(state.currentUser.token, notification.id);
      setNotifications((prev) =>
        prev.map((n) => (n.id === notification.id ? { ...n, isRead: true } : n))
      );
    }

    // Special case: business_owner_declined with action required shows modal
    if (notification.type === "business_owner_declined" && notification.actionRequired) {
      setSelectedDeclinedNotification(notification);
      setShowDeclinedModal(true);
      return;
    }

    // Navigate to notification detail page
    navigate(`/notifications/${notification.id}`);
  };

  const handleMarkAllRead = async () => {
    await NotificationsService.markAllAsRead(state.currentUser.token);
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
  };

  const handleRebook = (notification) => {
    // Convert notification data to appointment-like object for RebookingModal
    const appointmentForRebook = {
      id: notification.data?.appointmentId,
      date: notification.data?.date,
      price: notification.data?.price,
      timeWindow: notification.data?.timeWindow,
      declineReason: notification.data?.declineReason,
      clientSuggestedDates: notification.data?.suggestedDates,
      rebookingAttempts: notification.data?.rebookingAttempts || 0,
      client: {
        id: notification.data?.clientId,
        name: notification.data?.clientName,
      },
      home: {
        id: notification.data?.homeId,
        address: notification.data?.homeAddress,
      },
    };
    setSelectedNotificationForRebook(appointmentForRebook);
    setShowRebookModal(true);
  };

  const handleRebookSuccess = () => {
    setShowRebookModal(false);
    setSelectedNotificationForRebook(null);
    // Refresh notifications to update the list
    fetchNotifications(1, true);
  };

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  const renderEmpty = () => (
    <View style={styles.emptyContainer}>
      <Feather name="bell-off" size={48} color={colors.neutral[300]} />
      <Text style={styles.emptyTitle}>No Notifications</Text>
      <Text style={styles.emptyText}>
        You're all caught up! Notifications will appear here.
      </Text>
    </View>
  );

  const renderFooter = () => {
    if (!loadingMore) return null;
    return (
      <View style={styles.footer}>
        <ActivityIndicator size="small" color={colors.primary[500]} />
      </View>
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary[500]} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => navigate(-1)} style={styles.backButton}>
          <Feather name="arrow-left" size={24} color={colors.neutral[700]} />
        </Pressable>
        <Text style={styles.headerTitle}>Notifications</Text>
        {unreadCount > 0 && (
          <Pressable onPress={handleMarkAllRead} style={styles.markAllButton}>
            <Text style={styles.markAllText}>Mark All Read</Text>
          </Pressable>
        )}
      </View>

      {/* Pending Reviews Banner */}
      {pendingReviewsCount > 0 && (
        <Pressable
          style={styles.pendingReviewsBanner}
          onPress={() => navigate("/pending-reviews")}
        >
          <View style={styles.pendingReviewsIcon}>
            <Feather name="star" size={20} color={colors.warning[600]} />
          </View>
          <View style={styles.pendingReviewsContent}>
            <Text style={styles.pendingReviewsTitle}>
              {pendingReviewsCount} completed {pendingReviewsCount === 1 ? "job" : "jobs"} awaiting your review
            </Text>
            <Text style={styles.pendingReviewsSubtitle}>
              Tap to leave your feedback
            </Text>
          </View>
          <Feather name="chevron-right" size={20} color={colors.neutral[400]} />
        </Pressable>
      )}

      {/* Notification List */}
      <FlatList
        data={notifications}
        keyExtractor={(item) => item.id.toString()}
        renderItem={({ item }) => (
          <NotificationCard
            notification={item}
            onPress={() => handleNotificationPress(item)}
            onRebook={handleRebook}
          />
        )}
        ListEmptyComponent={renderEmpty}
        ListFooterComponent={renderFooter}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={colors.primary[500]}
          />
        }
        onEndReached={handleLoadMore}
        onEndReachedThreshold={0.5}
        contentContainerStyle={notifications.length === 0 && pendingReviewsCount === 0 && styles.emptyList}
      />

      {/* Rebooking Modal */}
      <RebookingModal
        visible={showRebookModal}
        appointment={selectedNotificationForRebook}
        onClose={() => {
          setShowRebookModal(false);
          setSelectedNotificationForRebook(null);
        }}
        onSuccess={handleRebookSuccess}
        token={state.currentUser.token}
      />

      {/* Business Owner Declined Modal */}
      <BusinessOwnerDeclinedModal
        visible={showDeclinedModal}
        notification={selectedDeclinedNotification}
        onClose={() => {
          setShowDeclinedModal(false);
          setSelectedDeclinedNotification(null);
        }}
        onComplete={() => {
          // Refresh notifications after action is taken
          fetchNotifications(1, true);
        }}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.neutral[50],
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: colors.neutral[50],
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    backgroundColor: colors.neutral[0],
    borderBottomWidth: 1,
    borderBottomColor: colors.neutral[200],
    ...shadows.sm,
  },
  backButton: {
    padding: spacing.sm,
    marginRight: spacing.sm,
  },
  headerTitle: {
    flex: 1,
    fontSize: typography.fontSize.xl,
    fontWeight: "600",
    color: colors.neutral[900],
  },
  markAllButton: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  markAllText: {
    fontSize: typography.fontSize.sm,
    color: colors.primary[600],
    fontWeight: "500",
  },
  emptyList: {
    flex: 1,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: spacing.xl,
  },
  emptyTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: "600",
    color: colors.neutral[700],
    marginTop: spacing.md,
  },
  emptyText: {
    fontSize: typography.fontSize.sm,
    color: colors.neutral[500],
    textAlign: "center",
    marginTop: spacing.sm,
  },
  footer: {
    padding: spacing.md,
    alignItems: "center",
  },
  pendingReviewsBanner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.warning[50],
    marginHorizontal: spacing.md,
    marginTop: spacing.md,
    padding: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.warning[200],
  },
  pendingReviewsIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.warning[100],
    alignItems: "center",
    justifyContent: "center",
    marginRight: spacing.md,
  },
  pendingReviewsContent: {
    flex: 1,
  },
  pendingReviewsTitle: {
    fontSize: typography.fontSize.base,
    fontWeight: "600",
    color: colors.warning[800],
  },
  pendingReviewsSubtitle: {
    fontSize: typography.fontSize.sm,
    color: colors.warning[600],
    marginTop: 2,
  },
});

export default NotificationsScreen;
