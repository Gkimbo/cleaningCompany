import React, { useEffect, useState } from "react";
import { Dimensions, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import Icon from "react-native-vector-icons/FontAwesome";
import { useNavigate } from "react-router-native";
import FetchData from "../../services/fetchRequests/fetchData";
import homePageStyles from "../../services/styles/HomePageStyles";
import topBarStyles from "../../services/styles/TopBarStyles";
import HomeAppointmentTile from "../tiles/HomeAppointmentTile";
import { colors, spacing, radius, typography } from "../../services/styles/theme";

const AppointmentList = ({ state, dispatch }) => {
  const [allHomes, setAllHomes] = useState([]);
  const [allAppointments, setAllAppointments] = useState([]);
  const [changesSubmitted, setChangesSubmitted] = useState(false);
  const [redirect, setRedirect] = useState(false);
  const [backRedirect, setBackRedirect] = useState(false);
  const [expandedHomes, setExpandedHomes] = useState({});
  const [activeFilter, setActiveFilter] = useState("all"); // "all", "next7days", "assigned", "unassigned"
  const { width } = Dimensions.get("window");
  const iconSize = width < 400 ? 12 : width < 800 ? 16 : 20;
  const navigate = useNavigate();

  const toggleHomeExpanded = (homeId) => {
    setExpandedHomes((prev) => ({
      ...prev,
      [homeId]: !prev[homeId],
    }));
  };

  const expandAll = () => {
    const allExpanded = {};
    state.homes.forEach((home) => {
      allExpanded[home.id] = true;
    });
    setExpandedHomes(allExpanded);
  };

  const collapseAll = () => {
    const allCollapsed = {};
    state.homes.forEach((home) => {
      allCollapsed[home.id] = false;
    });
    setExpandedHomes(allCollapsed);
  };

  const allExpandedCheck = state.homes.length > 0 &&
    state.homes.every((home) => expandedHomes[home.id] !== false);
  const allCollapsedCheck = state.homes.length > 0 &&
    state.homes.every((home) => expandedHomes[home.id] === false);

  // Initialize all homes as expanded when data loads
  useEffect(() => {
    if (state.homes.length > 0) {
      const initialExpanded = {};
      state.homes.forEach((home) => {
        if (expandedHomes[home.id] === undefined) {
          initialExpanded[home.id] = true;
        }
      });
      if (Object.keys(initialExpanded).length > 0) {
        setExpandedHomes((prev) => ({ ...prev, ...initialExpanded }));
      }
    }
  }, [state.homes]);

  useEffect(() => {
    if (state.currentUser.token) {
      FetchData.get("/api/v1/user-info", state.currentUser.token).then(
        (response) => {
          dispatch({
            type: "USER_HOME",
            payload: response.user.homes,
          });
          setAllHomes(response.user.homes);
          dispatch({
            type: "USER_APPOINTMENTS",
            payload: response.user.appointments,
          });
          setAllAppointments(response.user.appointments);
          dispatch({
            type: "DB_BILL",
            payload: response.user.bill,
          });
        }
      );
    }
    setChangesSubmitted(false);
    if (redirect) {
      navigate("/add-home");
      setRedirect(false);
    }
    if (backRedirect) {
      navigate("/");
      setBackRedirect(false);
    }
  }, [redirect, backRedirect, changesSubmitted]);

  const handlePress = () => {
    setRedirect(true);
  };

  const handleBackPress = () => {
    setBackRedirect(true);
  };

  const handleAppointmentCancelled = (appointmentId) => {
    setAllAppointments(prev => prev.filter(a => a.id !== appointmentId));
    setChangesSubmitted(true);
  };

  // Get appointment count for a home (based on filtered appointments)
  const getAppointmentCountForHome = (homeId) => {
    return filteredAppointmentsForDisplay.filter((apt) => apt.homeId === homeId).length;
  };

  // Calculate total stats
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const sevenDaysFromNow = new Date(today);
  sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);

  const totalAppointments = allAppointments.length;
  const upcomingAppointments = allAppointments.filter((apt) => {
    const aptDate = new Date(apt.date);
    return aptDate >= today && aptDate <= sevenDaysFromNow && !apt.completed;
  }).length;
  const completedAppointments = allAppointments.filter((apt) => apt.completed).length;
  const assignedAppointments = allAppointments.filter((apt) => apt.hasBeenAssigned && !apt.completed).length;
  const unassignedAppointments = allAppointments.filter((apt) => {
    const aptDate = new Date(apt.date);
    return aptDate >= today && !apt.hasBeenAssigned && !apt.completed;
  }).length;
  const withRequestsAppointments = allAppointments.filter((apt) => {
    const aptDate = new Date(apt.date);
    return aptDate >= today && !apt.completed && (apt.pendingRequestCount > 0);
  }).length;
  const noRequestsAppointments = allAppointments.filter((apt) => {
    const aptDate = new Date(apt.date);
    return aptDate >= today && !apt.completed && !apt.hasBeenAssigned && (!apt.pendingRequestCount || apt.pendingRequestCount === 0);
  }).length;

  // Filter appointments based on active filter
  const getFilteredAppointments = () => {
    switch (activeFilter) {
      case "next7days":
        return allAppointments.filter((apt) => {
          const aptDate = new Date(apt.date);
          return aptDate >= today && aptDate <= sevenDaysFromNow && !apt.completed;
        });
      case "assigned":
        return allAppointments.filter((apt) => apt.hasBeenAssigned && !apt.completed);
      case "unassigned":
        return allAppointments.filter((apt) => {
          const aptDate = new Date(apt.date);
          return aptDate >= today && !apt.hasBeenAssigned && !apt.completed;
        });
      case "withRequests":
        return allAppointments.filter((apt) => {
          const aptDate = new Date(apt.date);
          return aptDate >= today && !apt.completed && (apt.pendingRequestCount > 0);
        });
      case "noRequests":
        return allAppointments.filter((apt) => {
          const aptDate = new Date(apt.date);
          return aptDate >= today && !apt.completed && !apt.hasBeenAssigned && (!apt.pendingRequestCount || apt.pendingRequestCount === 0);
        });
      case "all":
      default:
        return allAppointments;
    }
  };

  const filteredAppointmentsForDisplay = getFilteredAppointments();

  // Handle stat click
  const handleStatClick = (filter) => {
    if (activeFilter === filter) {
      setActiveFilter("all"); // Toggle off if already active
    } else {
      setActiveFilter(filter);
    }
  };

  // Get filter label for display
  const getFilterLabel = () => {
    switch (activeFilter) {
      case "next7days":
        return "Next 7 Days";
      case "assigned":
        return "Assigned";
      case "unassigned":
        return "Unassigned";
      case "withRequests":
        return "With Requests";
      case "noRequests":
        return "No Requests";
      default:
        return null;
    }
  };

  const usersHomes = state.homes.map((home) => {
    const isExpanded = expandedHomes[home.id] !== false;
    const appointmentCount = getAppointmentCountForHome(home.id);

    return (
      <View key={home.id} style={styles.homeSection}>
        {/* Clickable Home Header */}
        <Pressable
          style={({ pressed }) => [
            styles.homeHeader,
            pressed && styles.homeHeaderPressed,
          ]}
          onPress={() => toggleHomeExpanded(home.id)}
        >
          <View style={styles.homeHeaderLeft}>
            <Icon name="home" size={16} color={colors.primary[600]} />
            <Text style={styles.homeName}>
              {home.nickName || home.address}
            </Text>
            {appointmentCount > 0 && (
              <View style={styles.appointmentCountBadge}>
                <Text style={styles.appointmentCountText}>
                  {appointmentCount}
                </Text>
              </View>
            )}
          </View>
          <Icon
            name={isExpanded ? "chevron-up" : "chevron-down"}
            size={14}
            color={colors.text.tertiary}
          />
        </Pressable>

        {/* Expandable Content */}
        {isExpanded && (
          <HomeAppointmentTile
            id={home.id}
            nickName={home.nickName}
            address={home.address}
            city={home.city}
            state={home.state}
            zipcode={home.zipcode}
            contact={home.contact}
            allAppointments={filteredAppointmentsForDisplay}
            setChangesSubmitted={setChangesSubmitted}
            token={state.currentUser.token}
            onAppointmentCancelled={handleAppointmentCancelled}
            numBeds={home.numBeds}
            numBaths={home.numBaths}
          />
        )}
      </View>
    );
  });

  return (
    <View style={{ ...homePageStyles.container, flex: 1, marginTop: 10 }}>
      {/* Fixed Header - Back Button & Title */}
      <View style={styles.pageTitleRow}>
        <Pressable style={styles.backButton} onPress={handleBackPress}>
          <Icon name="angle-left" size={iconSize} color={colors.text.primary} />
          <Text style={styles.backButtonText}>Back</Text>
        </Pressable>
        <Text style={styles.pageTitle}>My Appointments</Text>
        <Pressable style={styles.calendarButton} onPress={() => navigate("/appointments-calendar")}>
          <Icon name="calendar" size={iconSize} color={colors.primary[600]} />
        </Pressable>
      </View>

      {/* Scrollable Content */}
      <ScrollView
        style={styles.scrollContainer}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Compact Filter Chips */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterChipsContainer}
        >
          <Pressable
            style={[styles.filterChip, activeFilter === "all" && styles.filterChipActive]}
            onPress={() => handleStatClick("all")}
          >
            <Text style={[styles.filterChipText, activeFilter === "all" && styles.filterChipTextActive]}>
              All ({totalAppointments})
            </Text>
          </Pressable>

          <Pressable
            style={[styles.filterChip, activeFilter === "next7days" && styles.filterChipActive]}
            onPress={() => handleStatClick("next7days")}
          >
            <Text style={[styles.filterChipText, activeFilter === "next7days" && styles.filterChipTextActive]}>
              Next 7 Days ({upcomingAppointments})
            </Text>
          </Pressable>

          <Pressable
            style={[styles.filterChip, activeFilter === "assigned" && styles.filterChipActive]}
            onPress={() => handleStatClick("assigned")}
          >
            <Text style={[styles.filterChipText, activeFilter === "assigned" && styles.filterChipTextActive]}>
              Assigned ({assignedAppointments})
            </Text>
          </Pressable>

          {unassignedAppointments > 0 && (
            <Pressable
              style={[styles.filterChip, activeFilter === "unassigned" && styles.filterChipActive]}
              onPress={() => handleStatClick("unassigned")}
            >
              <Text style={[styles.filterChipText, activeFilter === "unassigned" && styles.filterChipTextActive]}>
                Unassigned ({unassignedAppointments})
              </Text>
            </Pressable>
          )}

          {withRequestsAppointments > 0 && (
            <Pressable
              style={[styles.filterChip, activeFilter === "withRequests" && styles.filterChipActive]}
              onPress={() => handleStatClick("withRequests")}
            >
              <Text style={[styles.filterChipText, activeFilter === "withRequests" && styles.filterChipTextActive]}>
                With Requests ({withRequestsAppointments})
              </Text>
            </Pressable>
          )}

          {noRequestsAppointments > 0 && (
            <Pressable
              style={[styles.filterChip, activeFilter === "noRequests" && styles.filterChipActive]}
              onPress={() => handleStatClick("noRequests")}
            >
              <Text style={[styles.filterChipText, activeFilter === "noRequests" && styles.filterChipTextActive]}>
                No Requests ({noRequestsAppointments})
              </Text>
            </Pressable>
          )}
        </ScrollView>

        {/* Expand/Collapse & Filter Info Row */}
        {(state.homes.length > 1 || activeFilter !== "all") && (
          <View style={styles.controlsRow}>
            {state.homes.length > 1 && (
              <View style={styles.expandCollapseRow}>
                <Pressable
                  style={({ pressed }) => [
                    styles.expandCollapseButton,
                    allExpandedCheck && styles.expandCollapseButtonDisabled,
                    pressed && !allExpandedCheck && styles.expandCollapseButtonPressed,
                  ]}
                  onPress={expandAll}
                  disabled={allExpandedCheck}
                >
                  <Icon
                    name="expand"
                    size={10}
                    color={allExpandedCheck ? colors.text.disabled : colors.primary[600]}
                  />
                  <Text
                    style={[
                      styles.expandCollapseText,
                      allExpandedCheck && styles.expandCollapseTextDisabled,
                    ]}
                  >
                    Expand
                  </Text>
                </Pressable>
                <Pressable
                  style={({ pressed }) => [
                    styles.expandCollapseButton,
                    allCollapsedCheck && styles.expandCollapseButtonDisabled,
                    pressed && !allCollapsedCheck && styles.expandCollapseButtonPressed,
                  ]}
                  onPress={collapseAll}
                  disabled={allCollapsedCheck}
                >
                  <Icon
                    name="compress"
                    size={10}
                    color={allCollapsedCheck ? colors.text.disabled : colors.primary[600]}
                  />
                  <Text
                    style={[
                      styles.expandCollapseText,
                      allCollapsedCheck && styles.expandCollapseTextDisabled,
                    ]}
                  >
                    Collapse
                  </Text>
                </Pressable>
              </View>
            )}
            {activeFilter !== "all" && (
              <Pressable
                style={styles.clearFilterButton}
                onPress={() => setActiveFilter("all")}
              >
                <Text style={styles.clearFilterText}>
                  {getFilterLabel()} ({filteredAppointmentsForDisplay.length})
                </Text>
                <Icon name="times-circle" size={14} color={colors.primary[600]} />
              </Pressable>
            )}
          </View>
        )}

        {/* Homes List */}
        {state.homes.length > 0 ? (
          <>
            {usersHomes}
            <Pressable
              style={({ pressed }) => [
                styles.addHomeButton,
                pressed && styles.addHomeButtonPressed
              ]}
              onPress={handlePress}
            >
              <View style={styles.addHomeIconContainer}>
                <Icon name="plus" size={16} color={colors.primary[600]} />
              </View>
              <View style={styles.addHomeTextContainer}>
                <Text style={styles.addHomeTitle}>Add Another Home</Text>
                <Text style={styles.addHomeSubtitle}>Manage multiple properties</Text>
              </View>
              <Icon name="chevron-right" size={14} color={colors.text.tertiary} />
            </Pressable>
          </>
        ) : (
          <Pressable
            style={({ pressed }) => [
              styles.addHomeButtonEmpty,
              pressed && styles.addHomeButtonPressed
            ]}
            onPress={handlePress}
          >
            <View style={styles.addHomeIconContainerEmpty}>
              <Icon name="home" size={24} color={colors.primary[600]} />
            </View>
            <Text style={styles.addHomeTitleEmpty}>Add Your First Home</Text>
            <Text style={styles.addHomeSubtitleEmpty}>Get started by adding a property</Text>
            <View style={styles.addHomeButtonAction}>
              <Icon name="plus" size={12} color={colors.neutral[0]} />
              <Text style={styles.addHomeButtonActionText}>Add Home</Text>
            </View>
          </Pressable>
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  pageTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  pageTitle: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
  },
  calendarButton: {
    width: 60,
    alignItems: "flex-end",
    paddingVertical: spacing.xs,
  },
  backButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingVertical: spacing.xs,
    paddingRight: spacing.md,
  },
  backButtonText: {
    fontSize: typography.fontSize.base,
    color: colors.text.primary,
    fontWeight: typography.fontWeight.medium,
  },
  // Scroll container
  scrollContainer: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: spacing.xl,
  },
  // Filter Chips
  filterChipsContainer: {
    flexDirection: "row",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: spacing.sm,
  },
  filterChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.full,
    backgroundColor: colors.background.secondary,
    borderWidth: 1,
    borderColor: colors.border.light,
  },
  filterChipActive: {
    backgroundColor: colors.primary[600],
    borderColor: colors.primary[600],
  },
  filterChipText: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
    fontWeight: typography.fontWeight.medium,
  },
  filterChipTextActive: {
    color: colors.neutral[0],
  },
  // Controls Row (expand/collapse + clear filter)
  controlsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.md,
    marginBottom: spacing.sm,
  },
  expandCollapseRow: {
    flexDirection: "row",
    gap: spacing.xs,
  },
  expandCollapseButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.sm,
    backgroundColor: colors.background.secondary,
  },
  expandCollapseButtonDisabled: {
    opacity: 0.5,
  },
  expandCollapseButtonPressed: {
    backgroundColor: colors.primary[50],
  },
  expandCollapseText: {
    fontSize: typography.fontSize.xs,
    color: colors.primary[600],
    fontWeight: typography.fontWeight.medium,
  },
  expandCollapseTextDisabled: {
    color: colors.text.disabled,
  },
  clearFilterButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    backgroundColor: colors.primary[50],
    borderRadius: radius.full,
  },
  clearFilterText: {
    fontSize: typography.fontSize.xs,
    color: colors.primary[700],
    fontWeight: typography.fontWeight.medium,
  },
  homeSection: {
    marginBottom: spacing.sm,
    marginHorizontal: spacing.md,
    backgroundColor: colors.background.primary,
    borderRadius: radius.md,
    overflow: "hidden",
  },
  homeHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.background.secondary,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
  },
  homeHeaderPressed: {
    backgroundColor: colors.primary[50],
  },
  homeHeaderLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    flex: 1,
  },
  homeName: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
    flex: 1,
  },
  appointmentCountBadge: {
    backgroundColor: colors.primary[100],
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.full,
    minWidth: 24,
    alignItems: "center",
  },
  appointmentCountText: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.semibold,
    color: colors.primary[700],
  },
  // Add Home Button Styles
  addHomeButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.neutral[0],
    marginHorizontal: spacing.md,
    marginTop: spacing.lg,
    marginBottom: spacing.md,
    padding: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 2,
    borderColor: colors.primary[200],
    borderStyle: "dashed",
    gap: spacing.md,
  },
  addHomeButtonPressed: {
    backgroundColor: colors.primary[50],
    borderColor: colors.primary[400],
  },
  addHomeIconContainer: {
    width: 40,
    height: 40,
    borderRadius: radius.full,
    backgroundColor: colors.primary[50],
    alignItems: "center",
    justifyContent: "center",
  },
  addHomeTextContainer: {
    flex: 1,
  },
  addHomeTitle: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
  },
  addHomeSubtitle: {
    fontSize: typography.fontSize.sm,
    color: colors.text.tertiary,
    marginTop: 2,
  },
  // Empty state button (when no homes)
  addHomeButtonEmpty: {
    alignItems: "center",
    backgroundColor: colors.neutral[0],
    marginHorizontal: spacing.md,
    marginTop: spacing["2xl"],
    padding: spacing.xl,
    borderRadius: radius.xl,
    borderWidth: 2,
    borderColor: colors.primary[200],
    borderStyle: "dashed",
  },
  addHomeIconContainerEmpty: {
    width: 64,
    height: 64,
    borderRadius: radius.full,
    backgroundColor: colors.primary[50],
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.md,
  },
  addHomeTitleEmpty: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
    marginBottom: spacing.xs,
  },
  addHomeSubtitleEmpty: {
    fontSize: typography.fontSize.sm,
    color: colors.text.tertiary,
    marginBottom: spacing.lg,
    textAlign: "center",
  },
  addHomeButtonAction: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    backgroundColor: colors.primary[600],
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.lg,
  },
  addHomeButtonActionText: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.neutral[0],
  },
});

export default AppointmentList;
