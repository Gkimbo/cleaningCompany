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
      {/* Page Title */}
      <View style={styles.pageTitleRow}>
        <Pressable style={styles.backButton} onPress={handleBackPress}>
          <Icon name="angle-left" size={iconSize} color={colors.text.primary} />
          <Text style={styles.backButtonText}>Back</Text>
        </Pressable>
        <Text style={styles.pageTitle}>My Appointments</Text>
        <View style={styles.headerSpacer} />
      </View>

      {/* Header with Stats */}
      <View style={styles.headerRow}>
        {/* Stats Summary */}
        <View style={styles.statsRow}>
          <Pressable
            style={[styles.statItem, activeFilter === "all" && styles.statItemActive]}
            onPress={() => handleStatClick("all")}
          >
            <Text style={[styles.statValue, activeFilter === "all" && styles.statValueActive]}>
              {totalAppointments}
            </Text>
            <Text style={[styles.statLabel, activeFilter === "all" && styles.statLabelActive]}>
              Total
            </Text>
          </Pressable>
          <View style={styles.statDivider} />
          <Pressable
            style={[styles.statItem, activeFilter === "next7days" && styles.statItemActive]}
            onPress={() => handleStatClick("next7days")}
          >
            <Text style={[
              styles.statValue,
              { color: colors.primary[600] },
              activeFilter === "next7days" && styles.statValueActive,
            ]}>
              {upcomingAppointments}
            </Text>
            <Text style={[styles.statLabel, activeFilter === "next7days" && styles.statLabelActive]}>
              Next 7 Days
            </Text>
          </Pressable>
          <View style={styles.statDivider} />
          <Pressable
            style={[styles.statItem, activeFilter === "assigned" && styles.statItemActive]}
            onPress={() => handleStatClick("assigned")}
          >
            <Text style={[
              styles.statValue,
              { color: colors.success[600] },
              activeFilter === "assigned" && styles.statValueActive,
            ]}>
              {assignedAppointments}
            </Text>
            <Text style={[styles.statLabel, activeFilter === "assigned" && styles.statLabelActive]}>
              Assigned
            </Text>
          </Pressable>
          {unassignedAppointments > 0 && (
            <>
              <View style={styles.statDivider} />
              <Pressable
                style={[styles.statItem, activeFilter === "unassigned" && styles.statItemActive]}
                onPress={() => handleStatClick("unassigned")}
              >
                <Text style={[
                  styles.statValue,
                  { color: colors.warning[600] },
                  activeFilter === "unassigned" && styles.statValueActive,
                ]}>
                  {unassignedAppointments}
                </Text>
                <Text style={[styles.statLabel, activeFilter === "unassigned" && styles.statLabelActive]}>
                  Unassigned
                </Text>
              </Pressable>
            </>
          )}
        </View>
      </View>

      {/* Expand/Collapse All Buttons */}
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
              size={12}
              color={allExpandedCheck ? colors.text.disabled : colors.primary[600]}
            />
            <Text
              style={[
                styles.expandCollapseText,
                allExpandedCheck && styles.expandCollapseTextDisabled,
              ]}
            >
              Expand All
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
              size={12}
              color={allCollapsedCheck ? colors.text.disabled : colors.primary[600]}
            />
            <Text
              style={[
                styles.expandCollapseText,
                allCollapsedCheck && styles.expandCollapseTextDisabled,
              ]}
            >
              Collapse All
            </Text>
          </Pressable>
        </View>
      )}

      {/* Active Filter Indicator */}
      {activeFilter !== "all" && (
        <View style={styles.filterIndicator}>
          <View style={styles.filterIndicatorContent}>
            <Icon name="filter" size={12} color={colors.primary[600]} />
            <Text style={styles.filterIndicatorText}>
              Showing: {getFilterLabel()} ({filteredAppointmentsForDisplay.length})
            </Text>
          </View>
          <Pressable
            style={styles.clearFilterButton}
            onPress={() => setActiveFilter("all")}
          >
            <Icon name="times" size={12} color={colors.text.tertiary} />
            <Text style={styles.clearFilterText}>Clear</Text>
          </Pressable>
        </View>
      )}

      {/* Scrollable List of Homes */}
      <ScrollView contentContainerStyle={{ paddingBottom: 20 }}>
        {state.homes.length > 0 ? (
          <>
            {usersHomes}
            <Pressable style={homePageStyles.AddHomeButton} onPress={handlePress}>
              <Text style={homePageStyles.AddHomeButtonText}>Add another Home</Text>
            </Pressable>
          </>
        ) : (
          <Pressable style={homePageStyles.AddHomeButton} onPress={handlePress}>
            <Text style={homePageStyles.AddHomeButtonText}>Add a Home</Text>
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
  headerSpacer: {
    width: 60,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    marginBottom: spacing.sm,
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
  statsRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.background.secondary,
    borderRadius: radius.md,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  statItem: {
    alignItems: "center",
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.sm,
  },
  statItemActive: {
    backgroundColor: colors.primary[100],
  },
  statValue: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
  },
  statValueActive: {
    color: colors.primary[700],
  },
  statLabel: {
    fontSize: typography.fontSize.xs,
    color: colors.text.secondary,
    marginTop: -2,
  },
  statLabelActive: {
    color: colors.primary[700],
    fontWeight: typography.fontWeight.semibold,
  },
  statDivider: {
    width: 1,
    height: 24,
    backgroundColor: colors.border.light,
  },
  filterIndicator: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: colors.primary[50],
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    marginHorizontal: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.primary[200],
  },
  filterIndicatorContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  filterIndicatorText: {
    fontSize: typography.fontSize.sm,
    color: colors.primary[700],
    fontWeight: typography.fontWeight.medium,
  },
  clearFilterButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    backgroundColor: colors.neutral[0],
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border.default,
  },
  clearFilterText: {
    fontSize: typography.fontSize.xs,
    color: colors.text.secondary,
    fontWeight: typography.fontWeight.medium,
  },
  expandCollapseRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.sm,
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
  homeSection: {
    marginBottom: spacing.md,
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
});

export default AppointmentList;
