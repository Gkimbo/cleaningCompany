import React, { useEffect, useState, useCallback } from "react";
import {
  ScrollView,
  Text,
  View,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { useNavigate } from "react-router-native";
import Icon from "react-native-vector-icons/FontAwesome";
import FetchData from "../../services/fetchRequests/fetchData";
import { colors, spacing, radius, shadows, typography } from "../../services/styles/theme";

const ScheduleCleaningList = ({ state, dispatch }) => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [homes, setHomes] = useState([]);

  const fetchHomes = useCallback(async (isRefresh = false) => {
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    try {
      if (state.currentUser.token) {
        const response = await FetchData.get("/api/v1/user-info", state.currentUser.token);
        if (response.user?.homes) {
          setHomes(response.user.homes);
          dispatch({ type: "USER_HOME", payload: response.user.homes });
        }
      }
    } catch (error) {
      console.error("Error fetching homes:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [state.currentUser.token, dispatch]);

  useEffect(() => {
    fetchHomes();
  }, [fetchHomes]);

  const onRefresh = useCallback(() => {
    fetchHomes(true);
  }, [fetchHomes]);

  const handleBack = () => {
    navigate("/");
  };

  const handleSchedule = (homeId) => {
    navigate(`/details/${homeId}`);
  };

  const handleQuickBook = (homeId) => {
    navigate(`/quick-book/${homeId}`);
  };

  const handleAddHome = () => {
    navigate("/setup-home");
  };

  const handleViewCalendar = () => {
    navigate("/my-requests-calendar");
  };

  // Filter homes that can be scheduled (not outside service area)
  const schedulableHomes = homes.filter(home => !home.outsideServiceArea);
  const outsideAreaHomes = homes.filter(home => home.outsideServiceArea);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary[500]} />
        <Text style={styles.loadingText}>Loading your homes...</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
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
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={handleBack}>
          <Icon name="angle-left" size={20} color={colors.primary[600]} />
          <Text style={styles.backButtonText}>Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Schedule Cleaning</Text>
        <TouchableOpacity style={styles.calendarButton} onPress={handleViewCalendar}>
          <Icon name="calendar" size={18} color={colors.primary[600]} />
        </TouchableOpacity>
      </View>

      {/* Intro Text */}
      <View style={styles.introCard}>
        <Icon name="home" size={24} color={colors.primary[500]} />
        <Text style={styles.introText}>
          Select a home below to schedule a professional cleaning
        </Text>
      </View>

      {/* Schedulable Homes */}
      {schedulableHomes.length > 0 ? (
        <View style={styles.homesSection}>
          <Text style={styles.sectionTitle}>Your Homes</Text>
          {schedulableHomes.map((home) => (
            <View key={home.id} style={styles.homeCard}>
              <View style={styles.homeInfo}>
                <Text style={styles.homeNickname}>{home.nickName || "My Home"}</Text>
                <Text style={styles.homeAddress}>{home.address}</Text>
                <Text style={styles.homeLocation}>{home.city}, {home.state} {home.zipcode}</Text>
                <View style={styles.homeStats}>
                  <View style={styles.statBadge}>
                    <Icon name="bed" size={12} color={colors.text.secondary} />
                    <Text style={styles.statText}>{home.numBeds} bed</Text>
                  </View>
                  <View style={styles.statBadge}>
                    <Icon name="tint" size={12} color={colors.text.secondary} />
                    <Text style={styles.statText}>{home.numBaths} bath</Text>
                  </View>
                </View>
              </View>

              <View style={styles.actionButtons}>
                <TouchableOpacity
                  style={styles.quickBookButton}
                  onPress={() => handleQuickBook(home.id)}
                >
                  <Icon name="bolt" size={14} color={colors.neutral[0]} />
                  <Text style={styles.quickBookText}>Quick Book</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.scheduleButton}
                  onPress={() => handleSchedule(home.id)}
                >
                  <Icon name="calendar-plus-o" size={14} color={colors.primary[600]} />
                  <Text style={styles.scheduleText}>View Calendar</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))}
        </View>
      ) : (
        <View style={styles.emptyState}>
          <View style={styles.emptyIcon}>
            <Icon name="home" size={48} color={colors.primary[300]} />
          </View>
          <Text style={styles.emptyTitle}>No Homes Available</Text>
          <Text style={styles.emptyDescription}>
            Add a home to start scheduling professional cleaning services.
          </Text>
          <TouchableOpacity style={styles.addFirstButton} onPress={handleAddHome}>
            <Icon name="plus" size={16} color={colors.neutral[0]} />
            <Text style={styles.addFirstButtonText}>Add Your First Home</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Outside Service Area Homes */}
      {outsideAreaHomes.length > 0 && (
        <View style={styles.outsideSection}>
          <Text style={styles.sectionTitle}>Outside Service Area</Text>
          <Text style={styles.outsideNote}>
            These homes are currently outside our service area
          </Text>
          {outsideAreaHomes.map((home) => (
            <View key={home.id} style={styles.outsideHomeCard}>
              <View style={styles.homeInfo}>
                <Text style={styles.homeNickname}>{home.nickName || "My Home"}</Text>
                <Text style={styles.homeAddress}>{home.address}</Text>
                <Text style={styles.homeLocation}>{home.city}, {home.state}</Text>
              </View>
              <View style={styles.outsideBadge}>
                <Icon name="map-marker" size={12} color={colors.warning[600]} />
                <Text style={styles.outsideBadgeText}>Not Available</Text>
              </View>
            </View>
          ))}
        </View>
      )}

      {/* Add Another Home */}
      {homes.length > 0 && (
        <TouchableOpacity style={styles.addAnotherButton} onPress={handleAddHome}>
          <Icon name="plus-circle" size={20} color={colors.primary[600]} />
          <Text style={styles.addAnotherButtonText}>Add Another Home</Text>
        </TouchableOpacity>
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
  scrollContent: {
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
    marginBottom: spacing.xl,
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
  calendarButton: {
    padding: spacing.sm,
    backgroundColor: colors.primary[50],
    borderRadius: radius.md,
  },

  // Intro Card
  introCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.primary[50],
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginBottom: spacing.xl,
    gap: spacing.md,
  },
  introText: {
    flex: 1,
    fontSize: typography.fontSize.sm,
    color: colors.primary[700],
    lineHeight: 20,
  },

  // Sections
  homesSection: {
    marginBottom: spacing.xl,
  },
  sectionTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
    marginBottom: spacing.md,
  },

  // Home Card
  homeCard: {
    backgroundColor: colors.neutral[0],
    borderRadius: radius.xl,
    padding: spacing.lg,
    marginBottom: spacing.md,
    ...shadows.md,
  },
  homeInfo: {
    marginBottom: spacing.md,
  },
  homeNickname: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
    marginBottom: spacing.xs,
  },
  homeAddress: {
    fontSize: typography.fontSize.base,
    color: colors.text.secondary,
  },
  homeLocation: {
    fontSize: typography.fontSize.sm,
    color: colors.text.tertiary,
    marginTop: 2,
  },
  homeStats: {
    flexDirection: "row",
    gap: spacing.md,
    marginTop: spacing.sm,
  },
  statBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    backgroundColor: colors.neutral[100],
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.md,
  },
  statText: {
    fontSize: typography.fontSize.xs,
    color: colors.text.secondary,
  },

  // Action Buttons
  actionButtons: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  quickBookButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primary[600],
    paddingVertical: spacing.md,
    borderRadius: radius.lg,
    gap: spacing.xs,
    ...shadows.sm,
  },
  quickBookText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    color: colors.neutral[0],
  },
  scheduleButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.neutral[0],
    paddingVertical: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 2,
    borderColor: colors.primary[500],
    gap: spacing.xs,
  },
  scheduleText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    color: colors.primary[600],
  },

  // Outside Service Area
  outsideSection: {
    marginBottom: spacing.xl,
  },
  outsideNote: {
    fontSize: typography.fontSize.sm,
    color: colors.text.tertiary,
    marginBottom: spacing.md,
  },
  outsideHomeCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: colors.neutral[0],
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginBottom: spacing.sm,
    opacity: 0.7,
    borderWidth: 1,
    borderColor: colors.warning[200],
  },
  outsideBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    backgroundColor: colors.warning[100],
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.md,
  },
  outsideBadgeText: {
    fontSize: typography.fontSize.xs,
    color: colors.warning[700],
    fontWeight: typography.fontWeight.medium,
  },

  // Empty State
  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: spacing["4xl"],
  },
  emptyIcon: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: colors.primary[100],
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.xl,
  },
  emptyTitle: {
    fontSize: typography.fontSize["2xl"],
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
    marginBottom: spacing.sm,
  },
  emptyDescription: {
    fontSize: typography.fontSize.base,
    color: colors.text.secondary,
    textAlign: "center",
    marginBottom: spacing.xl,
    paddingHorizontal: spacing.xl,
    lineHeight: 24,
  },
  addFirstButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.primary[600],
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing["3xl"],
    borderRadius: radius.lg,
    gap: spacing.sm,
    ...shadows.md,
  },
  addFirstButtonText: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.bold,
    color: colors.neutral[0],
  },

  // Add Another Button
  addAnotherButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.neutral[0],
    paddingVertical: spacing.lg,
    borderRadius: radius.lg,
    borderWidth: 2,
    borderColor: colors.primary[500],
    borderStyle: "dashed",
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  addAnotherButtonText: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.primary[600],
  },

  bottomSpacer: {
    height: spacing["4xl"],
  },
});

export default ScheduleCleaningList;
