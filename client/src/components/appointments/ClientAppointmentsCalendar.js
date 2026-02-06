import React, { useCallback, useEffect, useState } from "react";
import {
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Calendar } from "react-native-calendars";
import Icon from "react-native-vector-icons/FontAwesome";
import { useNavigate } from "react-router-native";
import FetchData from "../../services/fetchRequests/fetchData";
import HomeAppointmentTile from "../tiles/HomeAppointmentTile";
import {
  colors,
  spacing,
  radius,
  typography,
  shadows,
} from "../../services/styles/theme";

const ClientAppointmentsCalendar = ({ state, dispatch }) => {
  const [allAppointments, setAllAppointments] = useState([]);
  const [allHomes, setAllHomes] = useState([]);
  const [selectedDate, setSelectedDate] = useState(null);
  const [activeFilter, setActiveFilter] = useState("all");
  const [expandedHomes, setExpandedHomes] = useState({});
  const [changesSubmitted, setChangesSubmitted] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const navigate = useNavigate();

  // Fetch appointments data
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
  }, [changesSubmitted, state.currentUser.token]);

  // Initialize all homes as expanded
  useEffect(() => {
    if (allHomes.length > 0) {
      const initialExpanded = {};
      allHomes.forEach((home) => {
        if (expandedHomes[home.id] === undefined) {
          initialExpanded[home.id] = true;
        }
      });
      if (Object.keys(initialExpanded).length > 0) {
        setExpandedHomes((prev) => ({ ...prev, ...initialExpanded }));
      }
    }
  }, [allHomes]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    setChangesSubmitted(true);
    setTimeout(() => setRefreshing(false), 1000);
  }, []);

  // Calculate date values
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const sevenDaysFromNow = new Date(today);
  sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);

  // Filter calculations
  const totalAppointments = allAppointments.length;
  const upcomingAppointments = allAppointments.filter((apt) => {
    const aptDate = new Date(apt.date);
    return aptDate >= today && aptDate <= sevenDaysFromNow && !apt.completed;
  }).length;
  const assignedAppointments = allAppointments.filter(
    (apt) => apt.hasBeenAssigned && !apt.completed
  ).length;
  const unassignedAppointments = allAppointments.filter((apt) => {
    const aptDate = new Date(apt.date);
    return aptDate >= today && !apt.hasBeenAssigned && !apt.completed;
  }).length;
  const withRequestsAppointments = allAppointments.filter((apt) => {
    const aptDate = new Date(apt.date);
    return aptDate >= today && !apt.completed && apt.pendingRequestCount > 0;
  }).length;
  const noRequestsAppointments = allAppointments.filter((apt) => {
    const aptDate = new Date(apt.date);
    return (
      aptDate >= today &&
      !apt.completed &&
      !apt.hasBeenAssigned &&
      (!apt.pendingRequestCount || apt.pendingRequestCount === 0)
    );
  }).length;

  // Filter appointments based on active filter
  const getFilteredAppointments = useCallback(() => {
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
          return aptDate >= today && !apt.completed && apt.pendingRequestCount > 0;
        });
      case "noRequests":
        return allAppointments.filter((apt) => {
          const aptDate = new Date(apt.date);
          return (
            aptDate >= today &&
            !apt.completed &&
            !apt.hasBeenAssigned &&
            (!apt.pendingRequestCount || apt.pendingRequestCount === 0)
          );
        });
      case "all":
      default:
        return allAppointments;
    }
  }, [activeFilter, allAppointments, today, sevenDaysFromNow]);

  const filteredAppointments = getFilteredAppointments();

  // Handle filter click
  const handleFilterClick = (filter) => {
    if (activeFilter === filter) {
      setActiveFilter("all");
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

  // Handle date selection
  const handleDateSelect = useCallback((date) => {
    const dateString = date.dateString || date;
    setSelectedDate((prev) => (prev === dateString ? null : dateString));
  }, []);

  // Format selected date for display
  const formatSelectedDate = (dateString) => {
    if (!dateString) return "";
    const date = new Date(dateString + "T00:00:00");
    const options = { weekday: "long", month: "long", day: "numeric" };
    return date.toLocaleDateString("en-US", options);
  };

  // Get appointments for selected date
  const getAppointmentsForDate = (dateString) => {
    return filteredAppointments.filter((apt) => apt.date === dateString);
  };

  // Get homes that have appointments on the selected date
  const getHomesWithAppointmentsOnDate = (dateString) => {
    const appointmentsOnDate = getAppointmentsForDate(dateString);
    const homeIds = [...new Set(appointmentsOnDate.map((apt) => apt.homeId))];
    return allHomes.filter((home) => homeIds.includes(home.id));
  };

  // Handle appointment cancelled
  const handleAppointmentCancelled = (appointmentId) => {
    setAllAppointments((prev) => prev.filter((a) => a.id !== appointmentId));
    setChangesSubmitted(true);
  };

  // Toggle home expanded
  const toggleHomeExpanded = (homeId) => {
    setExpandedHomes((prev) => ({
      ...prev,
      [homeId]: !prev[homeId],
    }));
  };

  // Calendar day render
  const renderDay = useCallback(
    ({ date }) => {
      const dayDate = new Date(date.dateString);
      const isPast = dayDate < today;
      const isToday = date.dateString === today.toISOString().split("T")[0];

      const appointmentsOnDay = filteredAppointments.filter(
        (a) => a.date === date.dateString
      );
      const hasData = appointmentsOnDay.length > 0;
      const isSelected = selectedDate === date.dateString;

      // Determine color based on appointment status
      const allAssigned = appointmentsOnDay.every((a) => a.hasBeenAssigned);
      const hasUnassigned = appointmentsOnDay.some((a) => !a.hasBeenAssigned);

      return (
        <Pressable
          disabled={!hasData}
          style={({ pressed }) => [
            styles.dayContainer,
            isToday && styles.dayContainerToday,
            hasData && !isSelected && allAssigned && styles.dayContainerAssigned,
            hasData && !isSelected && hasUnassigned && styles.dayContainerUnassigned,
            isSelected && styles.dayContainerSelected,
            isPast && !hasData && styles.dayContainerPast,
            pressed && hasData && styles.dayContainerPressed,
          ]}
          onPress={() => hasData && handleDateSelect(date)}
        >
          <Text
            style={[
              styles.dayText,
              isToday && !isSelected && styles.dayTextToday,
              isSelected && styles.dayTextSelected,
              isPast && !hasData && styles.dayTextPast,
              hasData && !isSelected && styles.dayTextHasData,
            ]}
          >
            {date.day}
          </Text>
          {hasData ? (
            <View
              style={[
                styles.dayIndicator,
                allAssigned && styles.dayIndicatorAssigned,
                hasUnassigned && styles.dayIndicatorUnassigned,
                isSelected && styles.dayIndicatorSelected,
              ]}
            >
              <Text
                style={[
                  styles.dayIndicatorText,
                  isSelected && styles.dayIndicatorTextSelected,
                ]}
              >
                {appointmentsOnDay.length}
              </Text>
            </View>
          ) : (
            <View style={styles.dayIndicatorPlaceholder} />
          )}
        </Pressable>
      );
    },
    [filteredAppointments, selectedDate, handleDateSelect, today]
  );

  const selectedDateAppointments = selectedDate
    ? getAppointmentsForDate(selectedDate)
    : [];
  const homesOnSelectedDate = selectedDate
    ? getHomesWithAppointmentsOnDate(selectedDate)
    : [];

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable
          style={({ pressed }) => [
            styles.backButton,
            pressed && styles.backButtonPressed,
          ]}
          onPress={() => navigate("/appointments")}
        >
          <Icon name="angle-left" size={22} color={colors.primary[600]} />
          <Text style={styles.backButtonText}>Back</Text>
        </Pressable>
        <View style={styles.headerCenter}>
          <Icon name="calendar" size={18} color={colors.primary[600]} />
          <Text style={styles.title}>Calendar View</Text>
        </View>
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
        showsVerticalScrollIndicator={false}
      >
        {/* Filter Chips */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterChipsContainer}
        >
          <Pressable
            style={({ pressed }) => [
              styles.filterChip,
              activeFilter === "all" && styles.filterChipActive,
              pressed && styles.filterChipPressed,
            ]}
            onPress={() => handleFilterClick("all")}
          >
            <Text
              style={[
                styles.filterChipText,
                activeFilter === "all" && styles.filterChipTextActive,
              ]}
            >
              All ({totalAppointments})
            </Text>
          </Pressable>

          <Pressable
            style={({ pressed }) => [
              styles.filterChip,
              activeFilter === "next7days" && styles.filterChipActive,
              pressed && styles.filterChipPressed,
            ]}
            onPress={() => handleFilterClick("next7days")}
          >
            <Text
              style={[
                styles.filterChipText,
                activeFilter === "next7days" && styles.filterChipTextActive,
              ]}
            >
              Next 7 Days ({upcomingAppointments})
            </Text>
          </Pressable>

          <Pressable
            style={({ pressed }) => [
              styles.filterChip,
              activeFilter === "assigned" && styles.filterChipActive,
              pressed && styles.filterChipPressed,
            ]}
            onPress={() => handleFilterClick("assigned")}
          >
            <Text
              style={[
                styles.filterChipText,
                activeFilter === "assigned" && styles.filterChipTextActive,
              ]}
            >
              Assigned ({assignedAppointments})
            </Text>
          </Pressable>

          {unassignedAppointments > 0 && (
            <Pressable
              style={({ pressed }) => [
                styles.filterChip,
                activeFilter === "unassigned" && styles.filterChipActive,
                pressed && styles.filterChipPressed,
              ]}
              onPress={() => handleFilterClick("unassigned")}
            >
              <Text
                style={[
                  styles.filterChipText,
                  activeFilter === "unassigned" && styles.filterChipTextActive,
                ]}
              >
                Unassigned ({unassignedAppointments})
              </Text>
            </Pressable>
          )}

          {withRequestsAppointments > 0 && (
            <Pressable
              style={({ pressed }) => [
                styles.filterChip,
                activeFilter === "withRequests" && styles.filterChipActive,
                pressed && styles.filterChipPressed,
              ]}
              onPress={() => handleFilterClick("withRequests")}
            >
              <Text
                style={[
                  styles.filterChipText,
                  activeFilter === "withRequests" && styles.filterChipTextActive,
                ]}
              >
                With Requests ({withRequestsAppointments})
              </Text>
            </Pressable>
          )}

          {noRequestsAppointments > 0 && (
            <Pressable
              style={({ pressed }) => [
                styles.filterChip,
                activeFilter === "noRequests" && styles.filterChipActive,
                pressed && styles.filterChipPressed,
              ]}
              onPress={() => handleFilterClick("noRequests")}
            >
              <Text
                style={[
                  styles.filterChipText,
                  activeFilter === "noRequests" && styles.filterChipTextActive,
                ]}
              >
                No Requests ({noRequestsAppointments})
              </Text>
            </Pressable>
          )}
        </ScrollView>

        {/* Calendar Card */}
        <View style={styles.calendarCard}>
          <Calendar
            current={new Date().toISOString().split("T")[0]}
            onDayPress={handleDateSelect}
            dayComponent={renderDay}
            renderArrow={(direction) => (
              <View style={styles.arrowContainer}>
                <Icon
                  name={direction === "left" ? "chevron-left" : "chevron-right"}
                  size={16}
                  color={colors.primary[600]}
                />
              </View>
            )}
            theme={{
              backgroundColor: "transparent",
              calendarBackground: "transparent",
              textSectionTitleColor: colors.text.tertiary,
              monthTextColor: colors.text.primary,
              textMonthFontWeight: typography.fontWeight.bold,
              textMonthFontSize: typography.fontSize.lg,
            }}
          />

          {/* Legend inside card */}
          <View style={styles.legend}>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, styles.legendDotAssigned]} />
              <Text style={styles.legendText}>Assigned</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, styles.legendDotUnassigned]} />
              <Text style={styles.legendText}>Unassigned</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, styles.legendDotSelected]} />
              <Text style={styles.legendText}>Selected</Text>
            </View>
          </View>
        </View>

        {/* Selected Date Section */}
        {selectedDate && (
          <View style={styles.selectedDateSection}>
            <View style={styles.selectedDateCard}>
              <View style={styles.selectedDateHeader}>
                <View style={styles.selectedDateInfo}>
                  <Text style={styles.selectedDateLabel}>Viewing</Text>
                  <Text style={styles.selectedDateText}>
                    {formatSelectedDate(selectedDate)}
                  </Text>
                </View>
                <View style={styles.selectedDateBadge}>
                  <Text style={styles.selectedDateBadgeText}>
                    {selectedDateAppointments.length} {selectedDateAppointments.length === 1 ? 'apt' : 'apts'}
                  </Text>
                </View>
              </View>

              <Pressable
                style={styles.closeDateButton}
                onPress={() => setSelectedDate(null)}
              >
                <Icon name="times" size={12} color={colors.text.tertiary} />
              </Pressable>
            </View>

            {selectedDateAppointments.length === 0 ? (
              <View style={styles.noAppointmentsCard}>
                <View style={styles.noAppointmentsIcon}>
                  <Icon name="calendar-times-o" size={28} color={colors.text.tertiary} />
                </View>
                <Text style={styles.noAppointmentsTitle}>No Appointments</Text>
                <Text style={styles.noAppointmentsText}>
                  No appointments match the current filter for this date.
                </Text>
              </View>
            ) : (
              <View style={styles.homesContainer}>
                {homesOnSelectedDate.map((home) => {
                  const isExpanded = expandedHomes[home.id] !== false;
                  const appointmentsForHome = selectedDateAppointments.filter(
                    (apt) => apt.homeId === home.id
                  );

                  return (
                    <View key={home.id} style={styles.homeCard}>
                      {/* Home Header */}
                      <Pressable
                        style={({ pressed }) => [
                          styles.homeHeader,
                          pressed && styles.homeHeaderPressed,
                        ]}
                        onPress={() => toggleHomeExpanded(home.id)}
                      >
                        <View style={styles.homeIconContainer}>
                          <Icon name="home" size={14} color={colors.primary[600]} />
                        </View>
                        <View style={styles.homeInfo}>
                          <Text style={styles.homeName} numberOfLines={1}>
                            {home.nickName || home.address}
                          </Text>
                          <Text style={styles.homeAddress} numberOfLines={1}>
                            {home.city}, {home.state}
                          </Text>
                        </View>
                        <View style={styles.homeHeaderRight}>
                          <View style={styles.appointmentCountBadge}>
                            <Text style={styles.appointmentCountText}>
                              {appointmentsForHome.length}
                            </Text>
                          </View>
                          <Icon
                            name={isExpanded ? "chevron-up" : "chevron-down"}
                            size={12}
                            color={colors.text.tertiary}
                          />
                        </View>
                      </Pressable>

                      {/* Expandable Content */}
                      {isExpanded && (
                        <View style={styles.homeContent}>
                          <HomeAppointmentTile
                            id={home.id}
                            nickName={home.nickName}
                            address={home.address}
                            city={home.city}
                            state={home.state}
                            zipcode={home.zipcode}
                            contact={home.contact}
                            allAppointments={selectedDateAppointments}
                            setChangesSubmitted={setChangesSubmitted}
                            token={state.currentUser.token}
                            onAppointmentCancelled={handleAppointmentCancelled}
                            numBeds={home.numBeds}
                            numBaths={home.numBaths}
                          />
                        </View>
                      )}
                    </View>
                  );
                })}
              </View>
            )}
          </View>
        )}

        {/* Empty State when no date selected */}
        {!selectedDate && allAppointments.length > 0 && (
          <View style={styles.emptyStateCard}>
            <View style={styles.emptyStateIconContainer}>
              <Icon name="hand-pointer-o" size={32} color={colors.primary[400]} />
            </View>
            <Text style={styles.emptyStateTitle}>Tap a Date</Text>
            <Text style={styles.emptyStateText}>
              Select a highlighted date on the calendar to view appointment details.
            </Text>
          </View>
        )}

        {/* No Appointments at all */}
        {allAppointments.length === 0 && (
          <View style={styles.emptyStateCard}>
            <View style={styles.emptyStateIconContainer}>
              <Icon name="calendar-plus-o" size={32} color={colors.primary[400]} />
            </View>
            <Text style={styles.emptyStateTitle}>No Appointments Yet</Text>
            <Text style={styles.emptyStateText}>
              You don't have any appointments scheduled. Book a cleaning to get started!
            </Text>
            <Pressable
              style={({ pressed }) => [
                styles.ctaButton,
                pressed && styles.ctaButtonPressed,
              ]}
              onPress={() => navigate("/")}
            >
              <Icon name="plus" size={14} color={colors.neutral[0]} />
              <Text style={styles.ctaButtonText}>Schedule Cleaning</Text>
            </Pressable>
          </View>
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.secondary,
  },
  // Header
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    backgroundColor: colors.neutral[0],
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
  },
  backButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    paddingVertical: spacing.xs,
    paddingRight: spacing.sm,
  },
  backButtonPressed: {
    opacity: 0.7,
  },
  backButtonText: {
    fontSize: typography.fontSize.base,
    color: colors.primary[600],
    fontWeight: typography.fontWeight.medium,
  },
  headerCenter: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  title: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
  },
  headerSpacer: {
    width: 70,
  },
  // Scroll
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: spacing["3xl"],
  },
  // Filter Chips
  filterChipsContainer: {
    flexDirection: "row",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    gap: spacing.sm,
  },
  filterChip: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.full,
    backgroundColor: colors.neutral[0],
    borderWidth: 1,
    borderColor: colors.border.default,
    ...shadows.sm,
  },
  filterChipActive: {
    backgroundColor: colors.primary[600],
    borderColor: colors.primary[600],
  },
  filterChipPressed: {
    opacity: 0.8,
    transform: [{ scale: 0.98 }],
  },
  filterChipText: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
    fontWeight: typography.fontWeight.medium,
  },
  filterChipTextActive: {
    color: colors.neutral[0],
  },
  // Calendar Card
  calendarCard: {
    marginHorizontal: spacing.md,
    backgroundColor: colors.neutral[0],
    borderRadius: radius.xl,
    padding: spacing.md,
    ...shadows.md,
  },
  arrowContainer: {
    width: 36,
    height: 36,
    borderRadius: radius.full,
    backgroundColor: colors.primary[50],
    alignItems: "center",
    justifyContent: "center",
  },
  // Day Styles
  dayContainer: {
    width: 40,
    height: 48,
    alignItems: "center",
    justifyContent: "flex-start",
    paddingTop: 6,
    borderRadius: radius.md,
    marginVertical: 2,
  },
  dayContainerToday: {
    borderWidth: 2,
    borderColor: colors.primary[400],
  },
  dayContainerAssigned: {
    backgroundColor: colors.success[50],
  },
  dayContainerUnassigned: {
    backgroundColor: colors.warning[50],
  },
  dayContainerSelected: {
    backgroundColor: colors.primary[600],
  },
  dayContainerPast: {
    opacity: 0.35,
  },
  dayContainerPressed: {
    opacity: 0.7,
  },
  dayText: {
    fontSize: typography.fontSize.sm,
    color: colors.text.primary,
    fontWeight: typography.fontWeight.medium,
  },
  dayTextToday: {
    color: colors.primary[700],
    fontWeight: typography.fontWeight.bold,
  },
  dayTextSelected: {
    color: colors.neutral[0],
    fontWeight: typography.fontWeight.bold,
  },
  dayTextPast: {
    color: colors.text.tertiary,
  },
  dayTextHasData: {
    fontWeight: typography.fontWeight.semibold,
  },
  dayIndicator: {
    marginTop: 2,
    minWidth: 16,
    height: 14,
    borderRadius: radius.full,
    backgroundColor: colors.primary[600],
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 3,
  },
  dayIndicatorPlaceholder: {
    marginTop: 2,
    height: 14,
  },
  dayIndicatorAssigned: {
    backgroundColor: colors.success[500],
  },
  dayIndicatorUnassigned: {
    backgroundColor: colors.warning[500],
  },
  dayIndicatorSelected: {
    backgroundColor: colors.neutral[0],
  },
  dayIndicatorText: {
    fontSize: 9,
    fontWeight: typography.fontWeight.bold,
    color: colors.neutral[0],
  },
  dayIndicatorTextSelected: {
    color: colors.primary[600],
  },
  // Legend
  legend: {
    flexDirection: "row",
    justifyContent: "center",
    gap: spacing.xl,
    paddingTop: spacing.md,
    paddingBottom: spacing.xs,
    borderTopWidth: 1,
    borderTopColor: colors.border.light,
    marginTop: spacing.sm,
  },
  legendItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: radius.full,
  },
  legendDotAssigned: {
    backgroundColor: colors.success[500],
  },
  legendDotUnassigned: {
    backgroundColor: colors.warning[500],
  },
  legendDotSelected: {
    backgroundColor: colors.primary[600],
  },
  legendText: {
    fontSize: typography.fontSize.xs,
    color: colors.text.tertiary,
    fontWeight: typography.fontWeight.medium,
  },
  // Selected Date Section
  selectedDateSection: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.lg,
  },
  selectedDateCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: colors.primary[600],
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
    ...shadows.md,
  },
  selectedDateHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    flex: 1,
  },
  selectedDateInfo: {
    flex: 1,
  },
  selectedDateLabel: {
    fontSize: typography.fontSize.xs,
    color: colors.primary[200],
    fontWeight: typography.fontWeight.medium,
  },
  selectedDateText: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.bold,
    color: colors.neutral[0],
  },
  selectedDateBadge: {
    backgroundColor: colors.neutral[0],
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.full,
  },
  selectedDateBadgeText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.bold,
    color: colors.primary[700],
  },
  closeDateButton: {
    width: 28,
    height: 28,
    borderRadius: radius.full,
    backgroundColor: colors.primary[700],
    alignItems: "center",
    justifyContent: "center",
    marginLeft: spacing.sm,
  },
  // No Appointments
  noAppointmentsCard: {
    alignItems: "center",
    padding: spacing.xl,
    backgroundColor: colors.neutral[0],
    borderRadius: radius.lg,
    ...shadows.sm,
  },
  noAppointmentsIcon: {
    width: 56,
    height: 56,
    borderRadius: radius.full,
    backgroundColor: colors.background.secondary,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.md,
  },
  noAppointmentsTitle: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
    marginBottom: spacing.xs,
  },
  noAppointmentsText: {
    fontSize: typography.fontSize.sm,
    color: colors.text.tertiary,
    textAlign: "center",
  },
  // Homes Container
  homesContainer: {
    gap: spacing.md,
  },
  homeCard: {
    backgroundColor: colors.neutral[0],
    borderRadius: radius.lg,
    overflow: "hidden",
    ...shadows.sm,
  },
  homeHeader: {
    flexDirection: "row",
    alignItems: "center",
    padding: spacing.md,
    gap: spacing.md,
  },
  homeHeaderPressed: {
    backgroundColor: colors.primary[50],
  },
  homeIconContainer: {
    width: 36,
    height: 36,
    borderRadius: radius.md,
    backgroundColor: colors.primary[50],
    alignItems: "center",
    justifyContent: "center",
  },
  homeInfo: {
    flex: 1,
  },
  homeName: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
  },
  homeAddress: {
    fontSize: typography.fontSize.xs,
    color: colors.text.tertiary,
    marginTop: 2,
  },
  homeHeaderRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  appointmentCountBadge: {
    backgroundColor: colors.primary[100],
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.full,
    minWidth: 26,
    alignItems: "center",
  },
  appointmentCountText: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.bold,
    color: colors.primary[700],
  },
  homeContent: {
    borderTopWidth: 1,
    borderTopColor: colors.border.light,
  },
  // Empty State
  emptyStateCard: {
    alignItems: "center",
    marginHorizontal: spacing.md,
    marginTop: spacing.lg,
    padding: spacing["2xl"],
    backgroundColor: colors.neutral[0],
    borderRadius: radius.xl,
    ...shadows.sm,
  },
  emptyStateIconContainer: {
    width: 72,
    height: 72,
    borderRadius: radius.full,
    backgroundColor: colors.primary[50],
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.lg,
  },
  emptyStateTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
    marginBottom: spacing.sm,
  },
  emptyStateText: {
    fontSize: typography.fontSize.sm,
    color: colors.text.tertiary,
    textAlign: "center",
    lineHeight: 20,
    maxWidth: 260,
  },
  ctaButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    backgroundColor: colors.primary[600],
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    borderRadius: radius.lg,
    marginTop: spacing.lg,
    ...shadows.md,
  },
  ctaButtonPressed: {
    backgroundColor: colors.primary[700],
  },
  ctaButtonText: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.neutral[0],
  },
});

export default ClientAppointmentsCalendar;
