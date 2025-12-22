import React, { useEffect, useState, useCallback } from "react";
import {
  ScrollView,
  Text,
  View,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  Dimensions,
} from "react-native";
import { useNavigate } from "react-router-native";
import Icon from "react-native-vector-icons/FontAwesome";
import FetchData from "../../services/fetchRequests/fetchData";

const { width } = Dimensions.get("window");

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

  // Filter homes that can be scheduled (not outside service area)
  const schedulableHomes = homes.filter(home => !home.outsideServiceArea);
  const outsideAreaHomes = homes.filter(home => home.outsideServiceArea);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <View style={styles.loadingCard}>
          <Icon name="calendar" size={32} color="#6366f1" />
          <Text style={styles.loadingText}>Loading your homes...</Text>
        </View>
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
          colors={["#6366f1"]}
          tintColor="#6366f1"
        />
      }
    >
      {/* Header */}
      <View style={styles.header}>
        <Pressable style={styles.backButton} onPress={handleBack}>
          <Icon name="chevron-left" size={12} color="#6366f1" />
          <Text style={styles.backButtonText}>Back</Text>
        </Pressable>
      </View>

      {/* Title Card */}
      <View style={styles.titleCard}>
        <View style={styles.titleSection}>
          <View style={styles.titleIconContainer}>
            <Icon name="calendar-plus-o" size={24} color="#fff" />
          </View>
          <View style={styles.titleContent}>
            <Text style={styles.pageTitle}>Schedule Cleaning</Text>
            <Text style={styles.pageSubtitle}>
              Select a home to book a professional cleaning
            </Text>
          </View>
        </View>

        {/* Quick Stats */}
        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <Icon name="home" size={16} color="#6366f1" />
            <Text style={styles.statValue}>{schedulableHomes.length}</Text>
            <Text style={styles.statLabel}>Available</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Icon name="calendar-check-o" size={16} color="#10b981" />
            <Text style={styles.statValue}>{state.appointments?.filter(a => new Date(a.date) >= new Date()).length || 0}</Text>
            <Text style={styles.statLabel}>Upcoming</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Icon name="map-marker" size={16} color="#f59e0b" />
            <Text style={styles.statValue}>{outsideAreaHomes.length}</Text>
            <Text style={styles.statLabel}>Outside Area</Text>
          </View>
        </View>
      </View>

      {/* Schedulable Homes */}
      {schedulableHomes.length > 0 ? (
        <View style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <Icon name="home" size={14} color="#6366f1" />
            <Text style={styles.sectionTitle}>Your Homes</Text>
          </View>

          {schedulableHomes.map((home, index) => (
            <View
              key={home.id}
              style={[
                styles.homeItem,
                index < schedulableHomes.length - 1 && styles.homeItemBorder
              ]}
            >
              <View style={styles.homeInfo}>
                <Text style={styles.homeNickname}>{home.nickName || "My Home"}</Text>
                <Text style={styles.homeAddress}>{home.address}</Text>
                <View style={styles.homeMetaRow}>
                  <View style={styles.homeMeta}>
                    <Icon name="bed" size={12} color="#64748b" />
                    <Text style={styles.homeMetaText}>{home.numBeds} bed</Text>
                  </View>
                  <View style={styles.homeMeta}>
                    <Icon name="bath" size={12} color="#64748b" />
                    <Text style={styles.homeMetaText}>{home.numBaths} bath</Text>
                  </View>
                  <View style={styles.homeMeta}>
                    <Icon name="map-marker" size={12} color="#64748b" />
                    <Text style={styles.homeMetaText}>{home.city}</Text>
                  </View>
                </View>
              </View>

              <View style={styles.actionButtons}>
                <Pressable
                  style={({ pressed }) => [
                    styles.quickBookButton,
                    pressed && styles.buttonPressed,
                  ]}
                  onPress={() => handleQuickBook(home.id)}
                >
                  <Icon name="bolt" size={14} color="#fff" />
                  <Text style={styles.quickBookText}>Quick Book</Text>
                </Pressable>
                <Pressable
                  style={({ pressed }) => [
                    styles.calendarButton,
                    pressed && styles.buttonPressed,
                  ]}
                  onPress={() => handleSchedule(home.id)}
                >
                  <Icon name="calendar" size={14} color="#6366f1" />
                  <Text style={styles.calendarButtonText}>Calendar</Text>
                </Pressable>
              </View>
            </View>
          ))}
        </View>
      ) : (
        <View style={styles.emptyCard}>
          <View style={styles.emptyIconContainer}>
            <Icon name="home" size={32} color="#6366f1" />
          </View>
          <Text style={styles.emptyTitle}>No Homes Available</Text>
          <Text style={styles.emptyText}>
            Add a home to start scheduling professional cleaning services.
          </Text>
          <Pressable
            style={({ pressed }) => [
              styles.addFirstButton,
              pressed && styles.buttonPressed,
            ]}
            onPress={handleAddHome}
          >
            <Icon name="plus" size={14} color="#fff" />
            <Text style={styles.addFirstButtonText}>Add Your First Home</Text>
          </Pressable>
        </View>
      )}

      {/* Outside Service Area Homes */}
      {outsideAreaHomes.length > 0 && (
        <View style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <Icon name="map-marker" size={14} color="#f59e0b" />
            <Text style={styles.sectionTitle}>Outside Service Area</Text>
          </View>

          <View style={styles.outsideNote}>
            <Icon name="info-circle" size={12} color="#f59e0b" />
            <Text style={styles.outsideNoteText}>
              These homes are currently outside our service area
            </Text>
          </View>

          {outsideAreaHomes.map((home, index) => (
            <View
              key={home.id}
              style={[
                styles.outsideHomeItem,
                index < outsideAreaHomes.length - 1 && styles.homeItemBorder
              ]}
            >
              <View style={styles.outsideHomeInfo}>
                <Text style={styles.outsideHomeNickname}>{home.nickName || "My Home"}</Text>
                <Text style={styles.outsideHomeAddress}>{home.address}, {home.city}</Text>
              </View>
              <View style={styles.outsideBadge}>
                <Text style={styles.outsideBadgeText}>Unavailable</Text>
              </View>
            </View>
          ))}
        </View>
      )}

      {/* Add Another Home */}
      {homes.length > 0 && (
        <Pressable
          style={({ pressed }) => [
            styles.addAnotherButton,
            pressed && styles.buttonPressed,
          ]}
          onPress={handleAddHome}
        >
          <View style={styles.addAnotherIcon}>
            <Icon name="plus" size={16} color="#6366f1" />
          </View>
          <View style={styles.addAnotherContent}>
            <Text style={styles.addAnotherTitle}>Add Another Home</Text>
            <Text style={styles.addAnotherSubtitle}>Register a new property</Text>
          </View>
          <Icon name="chevron-right" size={14} color="#94a3b8" />
        </Pressable>
      )}

      <View style={styles.bottomSpacer} />
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f8fafc",
  },
  scrollContent: {
    paddingBottom: 40,
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: "#f8fafc",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  loadingCard: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 32,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: "#64748b",
  },

  // Header
  header: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
  },
  backButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 10,
    alignSelf: "flex-start",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
  },
  backButtonText: {
    marginLeft: 6,
    fontSize: 14,
    fontWeight: "600",
    color: "#6366f1",
  },

  // Title Card
  titleCard: {
    backgroundColor: "#fff",
    marginHorizontal: 16,
    marginTop: 8,
    borderRadius: 20,
    padding: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },
  titleSection: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  titleIconContainer: {
    width: 52,
    height: 52,
    borderRadius: 14,
    backgroundColor: "#6366f1",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 14,
  },
  titleContent: {
    flex: 1,
  },
  pageTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#1e293b",
    marginBottom: 4,
  },
  pageSubtitle: {
    fontSize: 14,
    color: "#64748b",
  },

  // Stats Row
  statsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
    backgroundColor: "#f8fafc",
    borderRadius: 12,
    padding: 16,
    marginTop: 20,
  },
  statItem: {
    alignItems: "center",
    flex: 1,
  },
  statValue: {
    fontSize: 18,
    fontWeight: "700",
    color: "#1e293b",
    marginTop: 6,
  },
  statLabel: {
    fontSize: 11,
    color: "#94a3b8",
    marginTop: 2,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  statDivider: {
    width: 1,
    height: 32,
    backgroundColor: "#e2e8f0",
  },

  // Section Card
  sectionCard: {
    backgroundColor: "#fff",
    marginHorizontal: 16,
    marginTop: 12,
    borderRadius: 16,
    padding: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 14,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#1e293b",
    marginLeft: 8,
  },

  // Home Item
  homeItem: {
    paddingVertical: 14,
  },
  homeItemBorder: {
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
  },
  homeInfo: {
    marginBottom: 12,
  },
  homeNickname: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1e293b",
    marginBottom: 2,
  },
  homeAddress: {
    fontSize: 14,
    color: "#64748b",
  },
  homeMetaRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    marginTop: 8,
  },
  homeMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  homeMetaText: {
    fontSize: 12,
    color: "#64748b",
  },

  // Action Buttons
  actionButtons: {
    flexDirection: "row",
    gap: 10,
  },
  quickBookButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#6366f1",
    paddingVertical: 12,
    borderRadius: 10,
    gap: 6,
    shadowColor: "#6366f1",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  quickBookText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#fff",
  },
  calendarButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#eef2ff",
    paddingVertical: 12,
    borderRadius: 10,
    gap: 6,
  },
  calendarButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#6366f1",
  },
  buttonPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.98 }],
  },

  // Outside Service Area
  outsideNote: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fffbeb",
    borderRadius: 8,
    padding: 10,
    marginBottom: 12,
    gap: 8,
  },
  outsideNoteText: {
    fontSize: 12,
    color: "#92400e",
    flex: 1,
  },
  outsideHomeItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
    opacity: 0.7,
  },
  outsideHomeInfo: {
    flex: 1,
  },
  outsideHomeNickname: {
    fontSize: 14,
    fontWeight: "600",
    color: "#64748b",
  },
  outsideHomeAddress: {
    fontSize: 12,
    color: "#94a3b8",
    marginTop: 2,
  },
  outsideBadge: {
    backgroundColor: "#fef3c7",
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 6,
  },
  outsideBadgeText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#d97706",
  },

  // Empty State
  emptyCard: {
    backgroundColor: "#fff",
    marginHorizontal: 16,
    marginTop: 12,
    borderRadius: 20,
    padding: 32,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  emptyIconContainer: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: "#eef2ff",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#1e293b",
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    color: "#64748b",
    textAlign: "center",
    lineHeight: 22,
    marginBottom: 20,
  },
  addFirstButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#6366f1",
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 12,
    gap: 8,
    shadowColor: "#6366f1",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  addFirstButtonText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#fff",
  },

  // Add Another Button
  addAnotherButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    marginHorizontal: 16,
    marginTop: 12,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  addAnotherIcon: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: "#eef2ff",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  addAnotherContent: {
    flex: 1,
  },
  addAnotherTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#1e293b",
  },
  addAnotherSubtitle: {
    fontSize: 12,
    color: "#94a3b8",
    marginTop: 2,
  },

  bottomSpacer: {
    height: 40,
  },
});

export default ScheduleCleaningList;
