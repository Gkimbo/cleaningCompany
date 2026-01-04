import React, { useEffect, useState, useCallback } from "react";
import {
  ActivityIndicator,
  Dimensions,
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
import MessageService from "../../services/fetchRequests/MessageClass";
import FetchData from "../../services/fetchRequests/fetchData";
import NotificationsService from "../../services/fetchRequests/NotificationsService";
import { useSocket } from "../../services/SocketContext";
import {
  colors,
  spacing,
  radius,
  typography,
  shadows,
} from "../../services/styles/theme";
import TaxFormsSection from "../tax/TaxFormsSection";
import HomeownerAdjustmentNotification from "./HomeownerAdjustmentNotification";
import { parseLocalDate, isFutureOrToday, isPast, compareDates } from "../../utils/dateUtils";
import TodaysCleaningCard from "./TodaysCleaningCard";
import DiscountedPrice from "../pricing/DiscountedPrice";
import MyCleanerCard from "./MyCleanerCard";
import RecurringScheduleCard from "./RecurringScheduleCard";
import DeclinedAppointmentsSection from "./DeclinedAppointmentsSection";
import IncompleteHomeSetupBanner from "./IncompleteHomeSetupBanner";
import PendingBookingCard from "./PendingBookingCard";
import PendingBookingModal from "./PendingBookingModal";

const { width } = Dimensions.get("window");

// Stat Card Component
const StatCard = ({
  title,
  value,
  subtitle,
  color = colors.primary[500],
  onPress,
  showBadge = false,
  badgeCount = 0,
}) => (
  <Pressable
    onPress={onPress}
    style={({ pressed }) => [
      styles.statCard,
      { borderLeftColor: color },
      pressed && onPress && styles.statCardPressed,
    ]}
  >
    {showBadge && badgeCount > 0 && (
      <View style={styles.notificationBadge}>
        <Text style={styles.notificationBadgeText}>
          {badgeCount > 99 ? "99+" : badgeCount}
        </Text>
      </View>
    )}
    <Text style={styles.statValue}>{value}</Text>
    <Text style={styles.statTitle}>{title}</Text>
    {subtitle && <Text style={styles.statSubtitle}>{subtitle}</Text>}
  </Pressable>
);

// Section Header Component
const SectionHeader = ({ title, onPress, actionText }) => (
  <View style={styles.sectionHeader}>
    <Text style={styles.sectionTitle}>{title}</Text>
    {onPress && (
      <Pressable onPress={onPress}>
        <Text style={styles.sectionAction}>{actionText || "View All"}</Text>
      </Pressable>
    )}
  </View>
);

// Quick Action Button Component
const QuickActionButton = ({ title, subtitle, onPress, icon, iconColor, bgColor, accentColor }) => (
  <Pressable
    onPress={onPress}
    style={({ pressed }) => [
      styles.quickActionButton,
      { backgroundColor: bgColor },
      pressed && styles.quickActionButtonPressed,
    ]}
  >
    <View style={[styles.quickActionIconContainer, { backgroundColor: accentColor }]}>
      <Icon name={icon} size={14} color={iconColor} />
    </View>
    <Text style={styles.quickActionText}>{title}</Text>
    {subtitle && <Text style={styles.quickActionSubtext}>{subtitle}</Text>}
  </Pressable>
);

// Appointment Card Component
const AppointmentCard = ({ homes, appointment, onPress }) => {
  const appointmentDate = parseLocalDate(appointment.date);
  const today = new Date();
  const isTodayAppointment = appointmentDate.toDateString() === today.toDateString();

  const home = homes.find((h) => Number(h.id) === Number(appointment.homeId));

  const formatDateDisplay = (date) => {
    const options = { weekday: "short", month: "short", day: "numeric" };
    return date.toLocaleDateString("en-US", options);
  };

  const formatTime = (timeString) => {
    if (!timeString) return "";
    const [hours, minutes] = timeString.split(":");
    const hour = parseInt(hours, 10);
    const ampm = hour >= 12 ? "PM" : "AM";
    const displayHour = hour % 12 || 12;
    return `${displayHour}:${minutes} ${ampm}`;
  };

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.appointmentCard,
        isTodayAppointment && styles.appointmentCardToday,
        pressed && styles.cardPressed,
      ]}
    >
      <View style={styles.appointmentDateBadge}>
        <Text style={[styles.appointmentDateText, isTodayAppointment && styles.todayText]}>
          {isTodayAppointment ? "Today" : formatDateDisplay(appointmentDate)}
        </Text>
      </View>
      <View style={styles.appointmentDetails}>
        <Text style={styles.appointmentHome} numberOfLines={1}>
          {appointment.home?.nickName ||
            appointment.nickName ||
            home?.nickName ||
            ""}
        </Text>
        {appointment.time && (
          <Text style={styles.appointmentTime}>
            {formatTime(appointment.time)}
          </Text>
        )}
        <View style={styles.appointmentPriceContainer}>
          {appointment.discountApplied && appointment.originalPrice ? (
            <>
              <DiscountedPrice
                originalPrice={Number(appointment.originalPrice)}
                discountedPrice={Number(appointment.price)}
                size="sm"
              />
              <Text style={styles.discountBadge}>
                {Math.round(Number(appointment.discountPercent) * 100)}% new homeowner discount
              </Text>
            </>
          ) : (
            <Text style={styles.appointmentPrice}>
              ${Number(appointment.price).toFixed(2)}
            </Text>
          )}
        </View>
      </View>
    </Pressable>
  );
};

// Home Card Component
const HomeCard = ({ home, onPress }) => (
  <Pressable
    onPress={onPress}
    style={({ pressed }) => [styles.homeCard, pressed && styles.cardPressed]}
  >
    <Text style={styles.homeNickname} numberOfLines={1}>
      {home.nickName || "My Home"}
    </Text>
    <Text style={styles.homeAddress} numberOfLines={1}>
      {home.address}, {home.city}
    </Text>
    <View style={styles.homeStats}>
      <Text style={styles.homeStat}>{home.numBeds} bed</Text>
      <Text style={styles.homeStatDivider}>|</Text>
      <Text style={styles.homeStat}>{home.numBaths} bath</Text>
    </View>
    {home.outsideServiceArea && (
      <View style={styles.outsideAreaBadge}>
        <Text style={styles.outsideAreaText}>Outside Service Area</Text>
      </View>
    )}
  </Pressable>
);

const ClientDashboard = ({ state, dispatch }) => {
  const navigate = useNavigate();
  const { onBookingRequest } = useSocket();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [homes, setHomes] = useState([]);
  const [appointments, setAppointments] = useState([]);
  const [bill, setBill] = useState(null);
  const [firstName, setFirstName] = useState("");
  const [error, setError] = useState(null);
  const [pendingRequestsCount, setPendingRequestsCount] = useState(0);
  const [pendingAdjustments, setPendingAdjustments] = useState([]);
  const [myCleaner, setMyCleaner] = useState(null);
  const [myCleanerRelationship, setMyCleanerRelationship] = useState(null);
  const [recurringSchedules, setRecurringSchedules] = useState([]);
  const [pendingBookings, setPendingBookings] = useState([]);
  const [selectedBooking, setSelectedBooking] = useState(null);
  const [showBookingModal, setShowBookingModal] = useState(false);

  useEffect(() => {
    if (state.currentUser.token) {
      fetchDashboardData();
      fetchPendingBookings();
    }
  }, [state.currentUser.token]);

  // Fetch pending bookings (appointments awaiting client approval)
  const fetchPendingBookings = async () => {
    try {
      const data = await NotificationsService.getPendingApprovalAppointments(
        state.currentUser.token
      );
      setPendingBookings(data.appointments || []);
    } catch (error) {
      console.error("Error fetching pending bookings:", error);
    }
  };

  // Listen for new booking requests via socket
  useEffect(() => {
    const unsubscribe = onBookingRequest((data) => {
      if (data.appointment) {
        setPendingBookings((prev) => [data.appointment, ...prev]);
      }
    });
    return unsubscribe;
  }, [onBookingRequest]);

  const handleBookingAction = (action, appointment) => {
    // Remove from pending bookings list
    setPendingBookings((prev) =>
      prev.filter((booking) => booking.id !== appointment.id)
    );
    // Refresh dashboard data to reflect changes
    fetchDashboardData(true);
    setShowBookingModal(false);
    setSelectedBooking(null);
  };

  const fetchDashboardData = async (isRefresh = false) => {
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setError(null);

    try {
      // Fetch dashboard data, pending requests, adjustments, cleaner, and schedules in parallel
      const [dashboardData, requestsData, adjustmentsData, cleanerData, schedulesData] = await Promise.all([
        ClientDashboardService.getDashboardSummary(state.currentUser.token),
        ClientDashboardService.getPendingRequestsForClient(
          state.currentUser.token
        ),
        FetchData.getPendingAdjustments(state.currentUser.token),
        ClientDashboardService.getMyCleanerRelationship(state.currentUser.token),
        ClientDashboardService.getMyRecurringSchedules(state.currentUser.token),
      ]);

      if (dashboardData.user) {
        setHomes(dashboardData.user.homes || []);
        setAppointments(dashboardData.user.appointments || []);
        setBill(dashboardData.user.bill || null);
        setFirstName(dashboardData.user.firstName || "");

        // Update global state
        if (dispatch) {
          dispatch({
            type: "USER_HOME",
            payload: dashboardData.user.homes || [],
          });
          dispatch({
            type: "USER_APPOINTMENTS",
            payload: dashboardData.user.appointments || [],
          });
          if (dashboardData.user.bill) {
            dispatch({ type: "DB_BILL", payload: dashboardData.user.bill });
          }
        }
      }

      // Set pending requests count
      setPendingRequestsCount(requestsData.totalCount || 0);

      // Set pending home size adjustments
      if (adjustmentsData.adjustments) {
        setPendingAdjustments(adjustmentsData.adjustments);
      }

      // Set my cleaner data
      if (cleanerData.cleaner) {
        setMyCleaner(cleanerData.cleaner);
        setMyCleanerRelationship(cleanerData.relationship || null);
      }

      // Set recurring schedules
      if (schedulesData.schedules) {
        setRecurringSchedules(schedulesData.schedules);
      }
    } catch (err) {
      console.error("[ClientDashboard] Error fetching data:", err);
      setError("Failed to load dashboard data");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleAdjustmentResponse = (adjustmentId, action, result) => {
    // Remove the adjustment from the list after response
    setPendingAdjustments(prev => prev.filter(adj => adj.id !== adjustmentId));
  };

  const onRefresh = useCallback(() => {
    fetchDashboardData(true);
  }, [state.currentUser.token]);

  const formatCurrency = (value) => {
    if (!value && value !== 0) return "$0.00";
    return `$${Number(value).toFixed(2)}`;
  };

  const getGreeting = () => {
    const hour = new Date().getHours();
    let greeting;
    if (hour < 12) greeting = "Good morning";
    else if (hour < 18) greeting = "Good afternoon";
    else greeting = "Good evening";

    return firstName ? `${greeting}, ${firstName}` : greeting;
  };

  const formatDate = () => {
    const options = { weekday: "long", month: "long", day: "numeric" };
    return new Date().toLocaleDateString("en-US", options);
  };

  // Sort and filter upcoming appointments (exclude completed ones)
  const allUpcomingAppointments = appointments
    .filter((apt) => isFutureOrToday(apt.date) && !apt.completed)
    .sort((a, b) => compareDates(a.date, b.date));
  const upcomingAppointments = allUpcomingAppointments.slice(0, 3);
  const upcomingAppointmentsCount = allUpcomingAppointments.length;

  // Find today's appointment (for Today's Cleaning card) - only show if NOT completed
  // Completed appointments should appear in Pending Reviews section instead
  const todayStr = new Date().toDateString();
  const todaysAppointment = appointments.find((apt) => {
    const aptDate = parseLocalDate(apt.date);
    return aptDate.toDateString() === todayStr && !apt.completed;
  });
  const todaysHome = todaysAppointment
    ? homes.find((h) => Number(h.id) === Number(todaysAppointment.homeId))
    : null;

  // Find pending reviews (completed appointments without client review)
  const pendingReviews = appointments
    .filter((apt) => apt.completed && !apt.hasClientReview)
    .sort((a, b) => compareDates(b.date, a.date)); // Most recent first

  const handleReviewSubmitted = (appointmentId) => {
    // Update appointments state to mark as reviewed
    setAppointments((prev) =>
      prev.map((apt) =>
        apt.id === appointmentId ? { ...apt, hasClientReview: true } : apt
      )
    );
    // Refresh dashboard data to get latest state from server
    fetchDashboardData(true);
  };

  // Calculate auto-captured, prepaid, and pending amounts for upcoming appointments
  // Auto-captured: paid and within 3 days (system auto-captured the payment)
  // Prepaid: paid but more than 3 days away (client paid early)
  // Pending: not yet paid
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const autoCapturedAppointments = allUpcomingAppointments.filter((apt) => {
    if (!apt.paid) return false;
    const aptDate = parseLocalDate(apt.date);
    const daysUntil = Math.ceil((aptDate - today) / (1000 * 60 * 60 * 24));
    return daysUntil <= 3;
  });

  const prepaidAppointments = allUpcomingAppointments.filter((apt) => {
    if (!apt.paid) return false;
    const aptDate = parseLocalDate(apt.date);
    const daysUntil = Math.ceil((aptDate - today) / (1000 * 60 * 60 * 24));
    return daysUntil > 3;
  });

  const pendingPaymentAppointments = allUpcomingAppointments.filter((apt) => !apt.paid);

  const autoCapturedTotal = autoCapturedAppointments.reduce(
    (sum, apt) => sum + (Number(apt.price) || 0),
    0
  );
  const prepaidTotal = prepaidAppointments.reduce(
    (sum, apt) => sum + (Number(apt.price) || 0),
    0
  );
  const pendingPaymentTotal = pendingPaymentAppointments.reduce(
    (sum, apt) => sum + (Number(apt.price) || 0),
    0
  );

  // Get recent/past appointments
  const recentAppointments = appointments
    .filter((apt) => isPast(apt.date))
    .sort((a, b) => compareDates(b.date, a.date))
    .slice(0, 3);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary[500]} />
        <Text style={styles.loadingText}>Loading your dashboard...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>{error}</Text>
        <Pressable
          style={styles.retryButton}
          onPress={() => fetchDashboardData()}
        >
          <Text style={styles.retryButtonText}>Try Again</Text>
        </Pressable>
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
        <Text style={styles.greeting}>{getGreeting()}</Text>
        <Text style={styles.dateText}>{formatDate()}</Text>
      </View>

      {/* Incomplete Home Setup Banner */}
      {homes.filter(h => h.isSetupComplete === false).map(incompleteHome => (
        <IncompleteHomeSetupBanner
          key={incompleteHome.id}
          home={incompleteHome}
          onComplete={() => navigate(`/complete-home-setup/${incompleteHome.id}`)}
        />
      ))}

      {/* Pending Bookings - Appointments awaiting client approval */}
      {pendingBookings.length > 0 && (
        <View style={styles.pendingBookingsSection}>
          <View style={styles.pendingBookingsHeader}>
            <Icon name="bell" size={16} color={colors.warning[600]} />
            <Text style={styles.pendingBookingsTitle}>
              {pendingBookings.length === 1
                ? "1 Booking Awaiting Your Approval"
                : `${pendingBookings.length} Bookings Awaiting Your Approval`}
            </Text>
          </View>
          {pendingBookings.map((booking) => (
            <PendingBookingCard
              key={booking.id}
              booking={booking}
              onPress={() => {
                setSelectedBooking(booking);
                setShowBookingModal(true);
              }}
              onAccept={() => {
                setSelectedBooking(booking);
                setShowBookingModal(true);
              }}
              onDecline={() => {
                setSelectedBooking(booking);
                setShowBookingModal(true);
              }}
            />
          ))}
        </View>
      )}

      {/* Pending Booking Modal */}
      <PendingBookingModal
        visible={showBookingModal}
        booking={selectedBooking}
        onClose={() => {
          setShowBookingModal(false);
          setSelectedBooking(null);
        }}
        onActionComplete={handleBookingAction}
      />

      {/* Today's Cleaning - Show if there's an appointment today */}
      {todaysAppointment && (
        <TodaysCleaningCard
          appointment={todaysAppointment}
          home={todaysHome}
          state={state}
          onReviewSubmitted={handleReviewSubmitted}
        />
      )}

      {/* Pending Home Size Adjustments */}
      {pendingAdjustments.length > 0 && (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Action Required</Text>
          </View>
          {pendingAdjustments.map((adjustment) => (
            <HomeownerAdjustmentNotification
              key={adjustment.id}
              adjustment={adjustment}
              token={state.currentUser.token}
              onResponse={handleAdjustmentResponse}
            />
          ))}
        </View>
      )}

      {/* Declined Appointments - cleaner unavailable */}
      <DeclinedAppointmentsSection
        token={state.currentUser.token}
        onRefresh={onRefresh}
      />

      {/* Quick Actions */}
      <View style={styles.quickActionsContainer}>
        <Text style={styles.quickActionsTitle}>Quick Actions</Text>
        <View style={styles.quickActionsGrid}>
          <QuickActionButton
            title="Schedule"
            subtitle="Book a cleaning"
            icon="calendar-plus-o"
            iconColor="#fff"
            bgColor="#fff"
            accentColor="#6366f1"
            onPress={() => navigate("/schedule-cleaning")}
          />
          <QuickActionButton
            title="Add Home"
            subtitle="Register property"
            icon="home"
            iconColor="#fff"
            bgColor="#fff"
            accentColor="#10b981"
            onPress={() => navigate("/add-home")}
          />
          <QuickActionButton
            title="View Bill"
            subtitle="Check balance"
            icon="file-text-o"
            iconColor="#fff"
            bgColor="#fff"
            accentColor="#f59e0b"
            onPress={() => navigate("/bill")}
          />
          <QuickActionButton
            title="Get Help"
            subtitle="Contact support"
            icon="life-ring"
            iconColor="#fff"
            bgColor="#fff"
            accentColor="#3b82f6"
            onPress={() => {
              if (state.currentUser.token) {
                MessageService.createSupportConversation(state.currentUser.token)
                  .then((response) => {
                    if (response.conversation) {
                      navigate(`/messages/${response.conversation.id}`);
                    }
                  })
                  .catch((err) => console.error(err));
              }
            }}
          />
        </View>
      </View>

      {/* My Cleaner Card - for clients invited by a cleaner */}
      {myCleaner && (
        <View style={styles.section}>
          <MyCleanerCard
            cleaner={myCleaner}
            relationship={myCleanerRelationship}
            onMessage={() => {
              if (state.currentUser.token && myCleaner.id) {
                MessageService.createCleanerClientConversation(null, myCleaner.id, state.currentUser.token)
                  .then((response) => {
                    if (response.conversation) {
                      navigate(`/messages/${response.conversation.id}`);
                    }
                  })
                  .catch((err) => console.error(err));
              }
            }}
          />
        </View>
      )}

      {/* Recurring Schedules Card */}
      {recurringSchedules.length > 0 && (
        <View style={styles.section}>
          <RecurringScheduleCard
            schedules={recurringSchedules}
            onViewAll={() => navigate("/my-schedules")}
          />
        </View>
      )}

      {/* Quick Stats */}
      <View style={styles.statsRow}>
        <StatCard
          title="Upcoming"
          value={upcomingAppointmentsCount}
          subtitle="appointments"
          color={colors.primary[500]}
          onPress={() => navigate("/appointments")}
        />
        <StatCard
          title="Requests"
          value={pendingRequestsCount}
          subtitle={pendingRequestsCount === 1 ? "pending" : "pending"}
          color={
            pendingRequestsCount > 0 ? colors.warning[500] : colors.neutral[400]
          }
          onPress={() => navigate("/client-requests")}
          showBadge={true}
          badgeCount={pendingRequestsCount}
        />
        <StatCard
          title="Edit"
          value={upcomingAppointmentsCount}
          subtitle="appointments"
          color={colors.secondary[500]}
          onPress={() => navigate("/appointments")}
        />
      </View>

      {/* Pending Reviews Section */}
      {pendingReviews.length > 0 && (
        <View style={styles.section}>
          <SectionHeader title="Pending Reviews" />
          <View style={styles.pendingReviewsCard}>
            <View style={styles.pendingReviewsHeader}>
              <Icon name="star" size={16} color={colors.warning[500]} />
              <Text style={styles.pendingReviewsTitle}>
                {pendingReviews.length} cleaning{pendingReviews.length > 1 ? "s" : ""} to review
              </Text>
            </View>
            <Text style={styles.pendingReviewsSubtitle}>
              Share your feedback about your recent cleanings
            </Text>
            <View style={styles.pendingReviewsList}>
              {pendingReviews.slice(0, 3).map((apt) => {
                const home = homes.find((h) => Number(h.id) === Number(apt.homeId));
                return (
                  <TodaysCleaningCard
                    key={apt.id}
                    appointment={apt}
                    home={home}
                    state={state}
                    onReviewSubmitted={handleReviewSubmitted}
                  />
                );
              })}
            </View>
          </View>
        </View>
      )}

      {/* Upcoming Appointments Section */}
      <View style={styles.section}>
        <SectionHeader
          title="Upcoming Appointments"
          onPress={() => navigate("/appointments")}
          actionText="View All"
        />
        {upcomingAppointments.length > 0 ? (
          <View style={styles.appointmentsList}>
            {upcomingAppointments.map((apt, index) => (
              <AppointmentCard
                key={apt.id || index}
                homes={homes}
                appointment={apt}
                onPress={() => navigate("/appointments")}
              />
            ))}
          </View>
        ) : (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyText}>No upcoming appointments</Text>
            <Pressable
              style={styles.emptyAction}
              onPress={() => navigate("/schedule-cleaning")}
            >
              <Text style={styles.emptyActionText}>Schedule a Cleaning</Text>
            </Pressable>
          </View>
        )}
      </View>

      {/* Request a Cleaning Section */}
      {homes.filter((h) => !h.outsideServiceArea).length > 0 && (
        <View style={styles.section}>
          <SectionHeader title="Request a Cleaning" />
          <View style={styles.requestCleaningCard}>
            <Text style={styles.requestCleaningText}>
              Schedule a cleaning for one of your homes
            </Text>
            <View style={styles.quickBookList}>
              {homes
                .filter((h) => !h.outsideServiceArea)
                .slice(0, 3)
                .map((home, index) => (
                  <Pressable
                    key={home.id || index}
                    style={({ pressed }) => [
                      styles.quickBookItem,
                      pressed && styles.cardPressed,
                    ]}
                    onPress={() => navigate(`/quick-book/${home.id}`)}
                  >
                    <View style={styles.quickBookInfo}>
                      <Text style={styles.quickBookName} numberOfLines={1}>
                        {home.nickName || "My Home"}
                      </Text>
                      <Text style={styles.quickBookAddress} numberOfLines={1}>
                        {home.city}, {home.state}
                      </Text>
                    </View>
                    <View style={styles.quickBookButton}>
                      <Text style={styles.quickBookButtonText}>Book</Text>
                    </View>
                  </Pressable>
                ))}
            </View>
            {homes.filter((h) => !h.outsideServiceArea).length > 3 && (
              <Pressable
                style={styles.viewAllHomesButton}
                onPress={() => navigate("/list-of-homes")}
              >
                <Text style={styles.viewAllHomesText}>
                  View all {homes.filter((h) => !h.outsideServiceArea).length}{" "}
                  homes
                </Text>
              </Pressable>
            )}
          </View>
        </View>
      )}

      {/* My Homes Section */}
      <View style={styles.section}>
        <SectionHeader
          title="My Homes"
          onPress={() => navigate("/list-of-homes")}
          actionText="Manage"
        />
        {homes.length > 0 ? (
          <View style={styles.homesList}>
            {homes.map((home, index) => (
              <HomeCard
                key={home.id || index}
                home={home}
                onPress={() => navigate(`/edit-home/${home.id}`)}
              />
            ))}
          </View>
        ) : (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyText}>No homes registered yet</Text>
            <Pressable
              style={styles.emptyAction}
              onPress={() => navigate("/add-home")}
            >
              <Text style={styles.emptyActionText}>Add Your First Home</Text>
            </Pressable>
          </View>
        )}
      </View>

      {/* Billing Summary Section */}
      <View style={styles.section}>
        <SectionHeader
          title="Billing Summary"
          onPress={() => navigate("/bill")}
          actionText="Details"
        />
        <View style={styles.billingCard}>
          {/* Only show cancellation fees if there are any - these are actually due now */}
          {bill?.cancellationFee > 0 && (
            <View style={styles.billingRow}>
              <Text style={styles.billingLabel}>Cancellation Fees</Text>
              <Text style={[styles.billingValue, styles.billingWarning]}>
                {formatCurrency(bill.cancellationFee)}
              </Text>
            </View>
          )}
          {/* Show current amount due (fees only, not future appointments) */}
          <View style={[styles.billingRow, styles.billingTotal]}>
            <Text style={styles.billingTotalLabel}>Amount Due Now</Text>
            <Text style={styles.billingTotalValue}>
              {formatCurrency(bill?.cancellationFee || 0)}
            </Text>
          </View>
          {/* Show upcoming appointments as informational, not due */}
          {upcomingAppointmentsCount > 0 && (
            <View style={styles.billingUpcoming}>
              <View style={styles.billingUpcomingHeader}>
                <Icon name="calendar" size={12} color={colors.text.tertiary} />
                <Text style={styles.billingUpcomingLabel}>
                  Upcoming Services ({upcomingAppointmentsCount})
                </Text>
              </View>

              {/* Show auto-captured payments (within 3 days) */}
              {autoCapturedAppointments.length > 0 && (
                <View style={styles.billingAutoCapturedRow}>
                  <View style={styles.billingAutoCapturedBadge}>
                    <Icon name="credit-card" size={12} color={colors.primary[600]} />
                    <Text style={styles.billingAutoCapturedLabel}>
                      Auto-Captured ({autoCapturedAppointments.length})
                    </Text>
                  </View>
                  <Text style={styles.billingAutoCapturedValue}>
                    {formatCurrency(autoCapturedTotal)}
                  </Text>
                </View>
              )}

              {/* Show prepaid appointments (paid early, more than 3 days out) */}
              {prepaidAppointments.length > 0 && (
                <View style={styles.billingPrepaidRow}>
                  <View style={styles.billingPrepaidBadge}>
                    <Icon name="check-circle" size={12} color={colors.success[600]} />
                    <Text style={styles.billingPrepaidLabel}>
                      Prepaid ({prepaidAppointments.length})
                    </Text>
                  </View>
                  <Text style={styles.billingPrepaidValue}>
                    {formatCurrency(prepaidTotal)}
                  </Text>
                </View>
              )}

              {/* Show pending payment amount */}
              {pendingPaymentAppointments.length > 0 && (
                <View style={styles.billingPendingRow}>
                  <Text style={styles.billingPendingLabel}>
                    Pending ({pendingPaymentAppointments.length})
                  </Text>
                  <Text style={styles.billingPendingValue}>
                    {formatCurrency(pendingPaymentTotal)}
                  </Text>
                </View>
              )}

              <Text style={styles.billingUpcomingNote}>
                Payments are auto-captured 3 days before each cleaning.{"\n"}
                You can prepay for appointments in your{" "}
                <Text
                  style={styles.billingLink}
                  onPress={() => navigate("/bill")}
                >
                  Bill
                </Text>
                .
              </Text>
            </View>
          )}
          {bill?.totalPaid > 0 && (
            <View style={styles.billingPaid}>
              <Text style={styles.billingPaidText}>
                Total Paid to Date: {formatCurrency(bill.totalPaid)}
              </Text>
            </View>
          )}
        </View>
      </View>

      {/* Recent Activity Section */}
      {recentAppointments.length > 0 && (
        <View style={styles.section}>
          <SectionHeader title="Recent Cleanings" />
          <View style={styles.recentList}>
            {recentAppointments.map((apt, index) => (
              <View key={apt.id || index} style={styles.recentItem}>
                <View style={styles.recentDot} />
                <View style={styles.recentContent}>
                  <Text style={styles.recentHome}>
                    {apt.home?.nickName || apt.nickName || "Home"}
                  </Text>
                  <Text style={styles.recentDate}>
                    {parseLocalDate(apt.date).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                    })}
                  </Text>
                </View>
                <Text style={styles.recentPrice}>
                  {formatCurrency(apt.price)}
                </Text>
              </View>
            ))}
          </View>
        </View>
      )}

      {/* Tax Documents Section */}
      <TaxFormsSection state={state} />

      {/* Bottom padding */}
      <View style={styles.bottomPadding} />
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.neutral[100],
  },
  contentContainer: {
    paddingTop: spacing["3xl"],
    paddingHorizontal: spacing.lg,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: colors.neutral[100],
  },
  loadingText: {
    marginTop: spacing.md,
    fontSize: typography.fontSize.base,
    color: colors.text.secondary,
  },
  errorContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: colors.neutral[100],
    padding: spacing.xl,
  },
  errorText: {
    fontSize: typography.fontSize.base,
    color: colors.error[600],
    textAlign: "center",
    marginBottom: spacing.lg,
  },
  retryButton: {
    backgroundColor: colors.primary[600],
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    borderRadius: radius.lg,
  },
  retryButtonText: {
    color: colors.neutral[0],
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
  },

  // Header
  header: {
    marginBottom: spacing.xl,
  },
  greeting: {
    fontSize: typography.fontSize["2xl"],
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
  },
  dateText: {
    fontSize: typography.fontSize.base,
    color: colors.text.secondary,
    marginTop: spacing.xs,
  },

  // Quick Actions
  quickActionsContainer: {
    marginBottom: spacing.xl,
  },
  quickActionsTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
    marginBottom: spacing.md,
  },
  quickActionsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  quickActionButton: {
    width: (width - spacing.lg * 2 - spacing.sm) / 2,
    borderRadius: radius.lg,
    padding: spacing.sm,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 70,
    ...shadows.sm,
    shadowColor: "#6366f1",
    shadowOpacity: 0.06,
  },
  quickActionButtonPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.98 }],
  },
  quickActionIconContainer: {
    width: 28,
    height: 28,
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: spacing.xs,
  },
  quickActionText: {
    color: colors.text.primary,
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    textAlign: "center",
  },
  quickActionSubtext: {
    color: colors.text.tertiary,
    fontSize: 10,
    marginTop: 1,
    textAlign: "center",
  },

  // Stats Row
  statsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: spacing.xl,
    gap: spacing.sm,
  },
  statCard: {
    flex: 1,
    backgroundColor: colors.neutral[0],
    borderRadius: radius.lg,
    padding: spacing.md,
    borderLeftWidth: 4,
    position: "relative",
    ...shadows.sm,
  },
  statCardPressed: {
    opacity: 0.9,
  },
  statValue: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
  },
  statTitle: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
    marginTop: spacing.xs,
  },
  statSubtitle: {
    fontSize: typography.fontSize.xs,
    color: colors.text.tertiary,
  },
  notificationBadge: {
    position: "absolute",
    top: -6,
    right: -6,
    backgroundColor: colors.error[500],
    borderRadius: radius.full,
    minWidth: 20,
    height: 20,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 6,
    borderWidth: 2,
    borderColor: colors.neutral[0],
    zIndex: 1,
  },
  notificationBadgeText: {
    fontSize: 10,
    fontWeight: typography.fontWeight.bold,
    color: colors.neutral[0],
  },

  // Sections
  section: {
    marginBottom: spacing.xl,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.md,
  },
  sectionTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
  },
  sectionAction: {
    fontSize: typography.fontSize.sm,
    color: colors.primary[600],
    fontWeight: typography.fontWeight.medium,
  },

  // Appointments
  appointmentsList: {
    gap: spacing.sm,
  },
  appointmentCard: {
    backgroundColor: colors.neutral[0],
    borderRadius: radius.lg,
    padding: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    ...shadows.sm,
  },
  appointmentCardToday: {
    borderWidth: 2,
    borderColor: colors.primary[400],
  },
  cardPressed: {
    opacity: 0.9,
  },
  appointmentDateBadge: {
    backgroundColor: colors.primary[50],
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    marginRight: spacing.md,
  },
  appointmentDateText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    color: colors.primary[700],
  },
  todayText: {
    color: colors.primary[600],
    fontWeight: typography.fontWeight.bold,
  },
  appointmentDetails: {
    flex: 1,
  },
  appointmentHome: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
  },
  appointmentTime: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
    marginTop: spacing.xs,
  },
  appointmentPriceContainer: {
    position: "absolute",
    right: 0,
    top: 0,
    alignItems: "flex-end",
  },
  appointmentPrice: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.primary[600],
  },
  discountBadge: {
    fontSize: typography.fontSize.xs,
    color: colors.success[600],
    fontWeight: typography.fontWeight.medium,
    marginTop: spacing.xs,
  },

  // Homes
  homesList: {
    gap: spacing.sm,
  },
  homeCard: {
    backgroundColor: colors.neutral[0],
    borderRadius: radius.lg,
    padding: spacing.md,
    ...shadows.sm,
  },
  homeNickname: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
  },
  homeAddress: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
    marginTop: spacing.xs,
  },
  homeStats: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: spacing.sm,
  },
  homeStat: {
    fontSize: typography.fontSize.sm,
    color: colors.text.tertiary,
  },
  homeStatDivider: {
    marginHorizontal: spacing.sm,
    color: colors.text.tertiary,
  },
  outsideAreaBadge: {
    backgroundColor: colors.warning[100],
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.sm,
    alignSelf: "flex-start",
    marginTop: spacing.sm,
  },
  outsideAreaText: {
    fontSize: typography.fontSize.xs,
    color: colors.warning[700],
    fontWeight: typography.fontWeight.medium,
  },

  // Empty State
  emptyCard: {
    backgroundColor: colors.neutral[0],
    borderRadius: radius.lg,
    padding: spacing.xl,
    alignItems: "center",
    ...shadows.sm,
  },
  emptyText: {
    fontSize: typography.fontSize.base,
    color: colors.text.secondary,
    marginBottom: spacing.md,
  },
  emptyAction: {
    backgroundColor: colors.primary[50],
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.full,
  },
  emptyActionText: {
    fontSize: typography.fontSize.sm,
    color: colors.primary[600],
    fontWeight: typography.fontWeight.medium,
  },

  // Billing
  billingCard: {
    backgroundColor: colors.neutral[0],
    borderRadius: radius.lg,
    padding: spacing.lg,
    ...shadows.sm,
  },
  billingRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: spacing.sm,
  },
  billingLabel: {
    fontSize: typography.fontSize.base,
    color: colors.text.secondary,
  },
  billingValue: {
    fontSize: typography.fontSize.base,
    color: colors.text.primary,
    fontWeight: typography.fontWeight.medium,
  },
  billingWarning: {
    color: colors.warning[600],
  },
  billingTotal: {
    borderTopWidth: 1,
    borderTopColor: colors.border.light,
    marginTop: spacing.sm,
    paddingTop: spacing.md,
  },
  billingTotalLabel: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
  },
  billingTotalValue: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    color: colors.primary[600],
  },
  billingUpcoming: {
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border.light,
    backgroundColor: colors.neutral[50],
    marginHorizontal: -spacing.lg,
    marginBottom: -spacing.lg,
    padding: spacing.md,
    borderBottomLeftRadius: radius.lg,
    borderBottomRightRadius: radius.lg,
  },
  billingUpcomingHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  billingUpcomingLabel: {
    fontSize: typography.fontSize.sm,
    color: colors.text.tertiary,
    fontWeight: typography.fontWeight.medium,
  },
  billingUpcomingValue: {
    fontSize: typography.fontSize.lg,
    color: colors.text.secondary,
    fontWeight: typography.fontWeight.semibold,
    marginTop: spacing.xs,
  },
  billingUpcomingNote: {
    fontSize: typography.fontSize.xs,
    color: colors.text.tertiary,
    marginTop: spacing.sm,
    fontStyle: "italic",
  },
  billingAutoCapturedRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: spacing.sm,
    paddingVertical: spacing.xs,
  },
  billingAutoCapturedBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    backgroundColor: colors.primary[50],
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.full,
  },
  billingAutoCapturedLabel: {
    fontSize: typography.fontSize.sm,
    color: colors.primary[700],
    fontWeight: typography.fontWeight.medium,
  },
  billingAutoCapturedValue: {
    fontSize: typography.fontSize.base,
    color: colors.primary[600],
    fontWeight: typography.fontWeight.semibold,
  },
  billingPrepaidRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: spacing.xs,
    paddingVertical: spacing.xs,
  },
  billingPrepaidBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    backgroundColor: colors.success[50],
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.full,
  },
  billingPrepaidLabel: {
    fontSize: typography.fontSize.sm,
    color: colors.success[700],
    fontWeight: typography.fontWeight.medium,
  },
  billingPrepaidValue: {
    fontSize: typography.fontSize.base,
    color: colors.success[600],
    fontWeight: typography.fontWeight.semibold,
  },
  billingPendingRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: spacing.xs,
    paddingVertical: spacing.xs,
  },
  billingPendingLabel: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
  },
  billingPendingValue: {
    fontSize: typography.fontSize.base,
    color: colors.text.secondary,
    fontWeight: typography.fontWeight.medium,
  },
  billingLink: {
    color: colors.primary[600],
    fontWeight: typography.fontWeight.medium,
  },
  billingPaid: {
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border.light,
  },
  billingPaidText: {
    fontSize: typography.fontSize.sm,
    color: colors.success[600],
    textAlign: "center",
  },

  // Recent Activity
  recentList: {
    backgroundColor: colors.neutral[0],
    borderRadius: radius.lg,
    padding: spacing.md,
    ...shadows.sm,
  },
  recentItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: spacing.sm,
  },
  recentDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.success[400],
    marginRight: spacing.md,
  },
  recentContent: {
    flex: 1,
  },
  recentHome: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    color: colors.text.primary,
  },
  recentDate: {
    fontSize: typography.fontSize.xs,
    color: colors.text.tertiary,
  },
  recentPrice: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
    fontWeight: typography.fontWeight.medium,
  },

  // Request a Cleaning Section
  requestCleaningCard: {
    backgroundColor: colors.neutral[0],
    borderRadius: radius.lg,
    padding: spacing.lg,
    ...shadows.sm,
  },
  requestCleaningText: {
    fontSize: typography.fontSize.base,
    color: colors.text.secondary,
    marginBottom: spacing.md,
    textAlign: "center",
  },
  quickBookList: {
    gap: spacing.sm,
  },
  quickBookItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: colors.neutral[50],
    borderRadius: radius.md,
    padding: spacing.md,
  },
  quickBookInfo: {
    flex: 1,
    marginRight: spacing.md,
  },
  quickBookName: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
  },
  quickBookAddress: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
    marginTop: 2,
  },
  quickBookButton: {
    backgroundColor: colors.primary[600],
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.full,
  },
  quickBookButtonText: {
    color: colors.neutral[0],
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
  },
  viewAllHomesButton: {
    marginTop: spacing.md,
    alignItems: "center",
  },
  viewAllHomesText: {
    fontSize: typography.fontSize.sm,
    color: colors.primary[600],
    fontWeight: typography.fontWeight.medium,
  },

  // Pending Reviews
  pendingReviewsCard: {
    backgroundColor: colors.warning[50],
    borderRadius: radius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.warning[200],
  },
  pendingReviewsHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginBottom: spacing.xs,
  },
  pendingReviewsTitle: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.warning[700],
  },
  pendingReviewsSubtitle: {
    fontSize: typography.fontSize.sm,
    color: colors.warning[600],
    marginBottom: spacing.md,
  },
  pendingReviewsList: {
    gap: spacing.md,
  },

  // Pending Bookings Section
  pendingBookingsSection: {
    marginBottom: spacing.xl,
  },
  pendingBookingsHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginBottom: spacing.sm,
    paddingHorizontal: spacing.sm,
  },
  pendingBookingsTitle: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.warning[700],
  },

  bottomPadding: {
    height: spacing["4xl"],
  },
});

export default ClientDashboard;
