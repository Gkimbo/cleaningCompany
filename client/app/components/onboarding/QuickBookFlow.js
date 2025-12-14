import React, { useState, useContext, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
} from "react-native";
import { useNavigate, useParams } from "react-router-native";
import { AuthContext } from "../../services/AuthContext";
import Appointment from "../../services/fetchRequests/AppointmentClass";
import styles from "./OnboardingStyles";
import { colors } from "../../services/styles/theme";

const QuickBookFlow = ({ state, dispatch }) => {
  const navigate = useNavigate();
  const { homeId } = useParams();
  const { user } = useContext(AuthContext);

  const [home, setHome] = useState(null);
  const [selectedDates, setSelectedDates] = useState([]);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [isLoading, setIsLoading] = useState(true);
  const [isBooking, setIsBooking] = useState(false);
  const [error, setError] = useState(null);
  const [existingAppointments, setExistingAppointments] = useState([]);

  useEffect(() => {
    loadHomeData();
  }, [homeId]);

  const loadHomeData = async () => {
    try {
      const homeData = state.homes.find((h) => h.id === Number(homeId));
      if (homeData) {
        setHome(homeData);
        const appts = state.appointments.filter((a) => a.homeId === Number(homeId));
        setExistingAppointments(appts.map((a) => a.date));
      }
    } catch (err) {
      setError("Failed to load home details");
    } finally {
      setIsLoading(false);
    }
  };

  const calculatePrice = () => {
    if (!home) return 0;

    let basePrice = 0;
    const beds = parseInt(home.numBeds) || 0;
    const baths = parseInt(home.numBaths) || 0;
    const rooms = beds + baths;

    if (rooms <= 3) basePrice = 100;
    else if (rooms <= 5) basePrice = 150;
    else if (rooms <= 7) basePrice = 200;
    else if (rooms <= 9) basePrice = 250;
    else basePrice = 300;

    // Time window surcharge
    if (home.timeToBeCompleted === "10-3" || home.timeToBeCompleted === "11-4") {
      basePrice += 30;
    }

    // Sheets/towels
    if (home.sheetsProvided === "yes") basePrice += 25;
    if (home.towelsProvided === "yes") basePrice += 25;

    return basePrice;
  };

  const getDaysInMonth = (date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const days = [];

    // Add empty slots for days before the first day of month
    for (let i = 0; i < firstDay.getDay(); i++) {
      days.push(null);
    }

    // Add all days of the month
    for (let i = 1; i <= lastDay.getDate(); i++) {
      days.push(new Date(year, month, i));
    }

    return days;
  };

  const formatDateString = (date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  const isDateSelectable = (date) => {
    if (!date) return false;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const minDate = new Date(today);
    minDate.setDate(minDate.getDate() + 7); // Must be at least 7 days out

    const dateStr = formatDateString(date);
    const isExisting = existingAppointments.includes(dateStr);

    return date >= minDate && !isExisting;
  };

  const toggleDate = (date) => {
    if (!isDateSelectable(date)) return;

    const dateStr = formatDateString(date);
    setSelectedDates((prev) => {
      if (prev.includes(dateStr)) {
        return prev.filter((d) => d !== dateStr);
      }
      return [...prev, dateStr];
    });
  };

  const prevMonth = () => {
    setCurrentMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
  };

  const nextMonth = () => {
    setCurrentMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
  };

  const handleBook = async () => {
    if (selectedDates.length === 0) return;

    setIsBooking(true);
    setError(null);

    try {
      const pricePerCleaning = calculatePrice();
      const datesWithPrice = selectedDates.map((date) => ({
        date,
        price: pricePerCleaning,
      }));

      const infoObject = {
        dateArray: datesWithPrice,
        homeId: home.id,
        token: user,
        keyPadCode: home.keyPadCode,
        keyLocation: home.keyLocation,
      };

      const response = await Appointment.addAppointmentToDb(infoObject);

      if (response) {
        const totalAmount = pricePerCleaning * selectedDates.length;
        dispatch({ type: "ADD_BILL", payload: totalAmount });
        dispatch({
          type: "ADD_DATES",
          payload: datesWithPrice.map((d) => ({ ...d, homeId: home.id })),
        });
        navigate("/list-of-homes");
      } else {
        setError("Failed to book appointments. Please try again.");
      }
    } catch (err) {
      setError("Something went wrong. Please try again.");
    } finally {
      setIsBooking(false);
    }
  };

  const days = getDaysInMonth(currentMonth);
  const weekDays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const monthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];

  if (isLoading) {
    return (
      <View style={[styles.container, { justifyContent: "center", alignItems: "center" }]}>
        <ActivityIndicator size="large" color={colors.primary[500]} />
      </View>
    );
  }

  if (!home) {
    return (
      <View style={[styles.container, { justifyContent: "center", alignItems: "center" }]}>
        <Text style={styles.title}>Home not found</Text>
        <TouchableOpacity
          style={[styles.primaryButton, { marginTop: 20 }]}
          onPress={() => navigate("/list-of-homes")}
        >
          <Text style={styles.primaryButtonText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const pricePerCleaning = calculatePrice();
  const totalPrice = pricePerCleaning * selectedDates.length;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.scrollContainer}>
      <View style={styles.contentContainer}>
        <View style={styles.header}>
          <Text style={styles.title}>Book Cleaning</Text>
          <Text style={styles.subtitle}>{home.nickName || home.address}</Text>
        </View>

        {error && (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        <View style={styles.formCard}>
          {/* Calendar Header */}
          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 20,
            }}
          >
            <TouchableOpacity onPress={prevMonth} style={{ padding: 10 }}>
              <Text style={{ fontSize: 24, color: colors.primary[600] }}>{"<"}</Text>
            </TouchableOpacity>
            <Text style={styles.sectionTitle}>
              {monthNames[currentMonth.getMonth()]} {currentMonth.getFullYear()}
            </Text>
            <TouchableOpacity onPress={nextMonth} style={{ padding: 10 }}>
              <Text style={{ fontSize: 24, color: colors.primary[600] }}>{">"}</Text>
            </TouchableOpacity>
          </View>

          {/* Week days header */}
          <View style={{ flexDirection: "row", marginBottom: 10 }}>
            {weekDays.map((day) => (
              <View key={day} style={{ flex: 1, alignItems: "center" }}>
                <Text style={{ color: colors.text.tertiary, fontSize: 12 }}>{day}</Text>
              </View>
            ))}
          </View>

          {/* Calendar grid */}
          <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
            {days.map((date, index) => {
              if (!date) {
                return <View key={`empty-${index}`} style={{ width: "14.28%", height: 44 }} />;
              }

              const dateStr = formatDateString(date);
              const isSelected = selectedDates.includes(dateStr);
              const isSelectable = isDateSelectable(date);
              const isExisting = existingAppointments.includes(dateStr);

              return (
                <TouchableOpacity
                  key={dateStr}
                  onPress={() => toggleDate(date)}
                  disabled={!isSelectable}
                  style={{
                    width: "14.28%",
                    height: 44,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <View
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: 18,
                      alignItems: "center",
                      justifyContent: "center",
                      backgroundColor: isSelected
                        ? colors.primary[500]
                        : isExisting
                        ? colors.success[100]
                        : "transparent",
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 14,
                        color: isSelected
                          ? colors.neutral[0]
                          : isSelectable
                          ? colors.text.primary
                          : colors.text.tertiary,
                        fontWeight: isSelected ? "bold" : "normal",
                      }}
                    >
                      {date.getDate()}
                    </Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Legend */}
          <View
            style={{
              flexDirection: "row",
              justifyContent: "center",
              marginTop: 20,
              gap: 20,
            }}
          >
            <View style={{ flexDirection: "row", alignItems: "center" }}>
              <View
                style={{
                  width: 12,
                  height: 12,
                  borderRadius: 6,
                  backgroundColor: colors.primary[500],
                  marginRight: 6,
                }}
              />
              <Text style={{ fontSize: 12, color: colors.text.secondary }}>Selected</Text>
            </View>
            <View style={{ flexDirection: "row", alignItems: "center" }}>
              <View
                style={{
                  width: 12,
                  height: 12,
                  borderRadius: 6,
                  backgroundColor: colors.success[100],
                  marginRight: 6,
                }}
              />
              <Text style={{ fontSize: 12, color: colors.text.secondary }}>Booked</Text>
            </View>
          </View>

          <View style={styles.infoBox}>
            <Text style={styles.infoBoxText}>
              Select dates at least 7 days in advance. Tap a date to select or deselect it.
            </Text>
          </View>
        </View>

        {/* Price Summary */}
        {selectedDates.length > 0 && (
          <View style={[styles.formCard, { marginTop: 16 }]}>
            <Text style={styles.sectionTitle}>Booking Summary</Text>

            <View style={{ marginBottom: 16 }}>
              <View
                style={{
                  flexDirection: "row",
                  justifyContent: "space-between",
                  paddingVertical: 8,
                  borderBottomWidth: 1,
                  borderBottomColor: colors.border.light,
                }}
              >
                <Text style={{ color: colors.text.secondary }}>Cleanings</Text>
                <Text style={{ fontWeight: "600" }}>{selectedDates.length}</Text>
              </View>
              <View
                style={{
                  flexDirection: "row",
                  justifyContent: "space-between",
                  paddingVertical: 8,
                  borderBottomWidth: 1,
                  borderBottomColor: colors.border.light,
                }}
              >
                <Text style={{ color: colors.text.secondary }}>Price each</Text>
                <Text style={{ fontWeight: "600" }}>${pricePerCleaning}</Text>
              </View>
            </View>

            <View style={styles.priceCard}>
              <Text style={styles.priceLabel}>Total</Text>
              <Text style={styles.priceAmount}>${totalPrice}</Text>
              <Text style={styles.priceNote}>Payment due 3 days before each cleaning</Text>
            </View>

            <View style={styles.buttonRow}>
              <TouchableOpacity
                style={styles.secondaryButton}
                onPress={() => navigate(`/homes/${homeId}`)}
              >
                <Text style={styles.secondaryButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.primaryButton, isBooking && styles.buttonDisabled]}
                onPress={handleBook}
                disabled={isBooking}
              >
                <Text style={styles.primaryButtonText}>
                  {isBooking ? "Booking..." : `Book ${selectedDates.length} Cleaning${selectedDates.length > 1 ? "s" : ""}`}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {selectedDates.length === 0 && (
          <TouchableOpacity
            style={[styles.secondaryButton, { marginTop: 16 }]}
            onPress={() => navigate(`/homes/${homeId}`)}
          >
            <Text style={styles.secondaryButtonText}>Back to Home Details</Text>
          </TouchableOpacity>
        )}
      </View>
    </ScrollView>
  );
};

export default QuickBookFlow;
