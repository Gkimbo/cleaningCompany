import React, { useState, useEffect, useCallback } from "react";
import { View, Text, Pressable, Modal, StyleSheet, Animated } from "react-native";
import { Calendar } from "react-native-calendars";
import Icon from "react-native-vector-icons/FontAwesome";
import FetchData from "../../services/fetchRequests/fetchData";
import { useNavigate } from "react-router-native";

const CalendarComponent = ({
  onDatesSelected,
  numBeds,
  numBaths,
  appointments,
  onAppointmentDelete,
  confirmationModalVisible,
  setConfirmationModalVisible,
  sheets,
  towels,
  timeToBeCompleted,
  bedConfigurations,
  bathroomConfigurations,
}) => {
  const [selectedDates, setSelectedDates] = useState({});
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [dateToDelete, setDateToDelete] = useState(null);
  const [error, setError] = useState(null);
  const [redirectToBill, setRedirectToBill] = useState(false);
  const [cancellationFee, setCancellationFee] = useState(0);
  const [appointmentToCancel, setAppointmentToCancel] = useState(null);
  const navigate = useNavigate();

  const calculatePrice = () => {
    let price = 0;

    // Time window surcharge
    if (timeToBeCompleted === "anytime") {
      price += 0;
    } else if (timeToBeCompleted === "10-3") {
      price += 25;
    } else if (timeToBeCompleted === "11-4") {
      price += 25;
    } else if (timeToBeCompleted === "12-2") {
      price += 30;
    }

    // Linen pricing with configuration-based pricing
    if (sheets === "yes") {
      if (bedConfigurations && Array.isArray(bedConfigurations) && bedConfigurations.length > 0) {
        const bedsNeedingSheets = bedConfigurations.filter((b) => b.needsSheets).length;
        price += bedsNeedingSheets * 30;
      } else {
        price += Number(numBeds) * 30;
      }
    }

    if (towels === "yes") {
      if (bathroomConfigurations && Array.isArray(bathroomConfigurations) && bathroomConfigurations.length > 0) {
        bathroomConfigurations.forEach((bath) => {
          price += (bath.towels || 0) * 5;
          price += (bath.faceCloths || 0) * 2;
        });
      } else {
        price += Number(numBaths) * (2 * 5 + 1 * 2);
      }
    }

    // Base price calculation ($150 for 1 bed/1 bath)
    if (Number(numBeds) === 1 && Number(numBaths) === 1) {
      price = price + 150;
      return price;
    } else if (Number(numBeds) === 1) {
      const baths = (Number(numBaths) - 1) * 50;
      price += baths + 150;
      return price;
    } else if (Number(numBaths) === 1) {
      const beds = (Number(numBeds) - 1) * 50;
      price += beds + 150;
      return price;
    } else {
      const beds = (Number(numBeds) - 1) * 50;
      const baths = (Number(numBaths) - 1) * 50;
      price += beds + baths + 150;
      return price;
    }
  };

  const handleDateSelect = (date) => {
    const currentDate = new Date();
    const selectedDate = new Date(date.dateString);

    const isWithinWeek =
      selectedDate.getTime() - currentDate.getTime() <= 7 * 24 * 60 * 60 * 1000;

    if (isWithinWeek) {
      setError("Cannot book appointments within a week of today's date.");
    } else {
      setError(null);
      const updatedDates = { ...selectedDates };
      if (updatedDates[date.dateString]) {
        delete updatedDates[date.dateString];
      } else {
        updatedDates[date.dateString] = {
          selected: true,
          price: calculatePrice(),
        };
      }

      setSelectedDates(updatedDates);
    }
  };

  const handleSubmit = () => {
    const selectedDateArray = Object.keys(selectedDates).map((dateString) => {
      const { price } = selectedDates[dateString];
      return {
        date: dateString,
        price,
        paid: false,
        bringTowels: towels,
        bringSheets: sheets,
        sheetConfigurations: sheets === "yes" ? bedConfigurations : null,
        towelConfigurations: towels === "yes" ? bathroomConfigurations : null,
      };
    });

    onDatesSelected(selectedDateArray);
  };

  const handleMonthChange = (date) => {
    setCurrentMonth(new Date(date.year, date.month - 1));
  };

  const isDateDisabled = (date) => {
    const currentDate = new Date();
    return new Date(date.dateString) < currentDate;
  };

  const isDateBooked = (date) => {
    return appointments.some(
      (appointment) => appointment.date === date.dateString
    );
  };

  const isDatePastAndNotPaid = (date) => {
    let toggle = false;
    appointments.forEach((appointment) => {
      if (appointment.date === date.dateString) {
        if (isDateDisabled(date) && !appointment.paid) {
          toggle = true;
        }
      }
    });
    return toggle;
  };

  const priceOfBooking = (date) => {
    let price;
    appointments.forEach((day) => {
      if (day.date === date.dateString) {
        price = day.price;
      }
    });
    return price;
  };

  const getAppointmentDetails = (date) => {
    return appointments.find((appt) => appt.date === date.dateString);
  };

  const handleRemoveBooking = (date) => {
    const currentDate = new Date();
    const selectedDate = new Date(date.dateString);
    const appointment = getAppointmentDetails(date);

    const isWithinWeek =
      selectedDate.getTime() - currentDate.getTime() <= 7 * 24 * 60 * 60 * 1000;

    setDateToDelete(date);
    setAppointmentToCancel(appointment);

    if (isWithinWeek) {
      setCancellationFee(25);
    } else {
      setCancellationFee(0);
    }

    setConfirmationModalVisible(true);
  };

  const handleRedirectToBill = () => {
    setRedirectToBill(true);
  };

  const handleConfirmation = (deleteAppointment) => {
    setConfirmationModalVisible(false);
    if (deleteAppointment) {
      onAppointmentDelete(dateToDelete, cancellationFee > 0 ? cancellationFee : null);
    }
    setAppointmentToCancel(null);
    setCancellationFee(0);
  };

  useEffect(() => {
    FetchData.getEmployeesWorking().then((response) => {
      console.log("response");
    });

    if (redirectToBill) {
      navigate("/bill");
      setRedirectToBill(false);
    }
  }, [redirectToBill]);

  const formatDate = (dateString) => {
    const date = new Date(dateString + "T00:00:00");
    return date.toLocaleDateString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
    });
  };

  const renderDay = useCallback(({ date }) => {
    const isPast = isDateDisabled(date);
    const isBooked = isDateBooked(date);
    const isSelected = selectedDates[date.dateString];
    const isPastUnpaid = isDatePastAndNotPaid(date);
    const price = isBooked ? priceOfBooking(date) : calculatePrice();

    // Determine the style based on state
    let containerStyle = [styles.dayContainer];
    let textStyle = [styles.dayText];
    let priceTextStyle = [styles.priceText];

    if (isPastUnpaid) {
      containerStyle.push(styles.dayPastUnpaid);
      textStyle.push(styles.dayTextLight);
      priceTextStyle.push(styles.priceTextLight);
    } else if (isPast) {
      containerStyle.push(styles.dayDisabled);
      textStyle.push(styles.dayTextDisabled);
      priceTextStyle.push(styles.priceTextDisabled);
    } else if (isBooked) {
      containerStyle.push(styles.dayBooked);
      textStyle.push(styles.dayTextLight);
      priceTextStyle.push(styles.priceTextLight);
    } else if (isSelected) {
      containerStyle.push(styles.daySelected);
      textStyle.push(styles.dayTextLight);
      priceTextStyle.push(styles.priceTextLight);
    } else {
      containerStyle.push(styles.dayAvailable);
    }

    const handlePress = () => {
      if (isPastUnpaid) {
        handleRedirectToBill();
      } else if (isBooked && !isPast) {
        handleRemoveBooking(date);
      } else if (!isPast) {
        handleDateSelect(date);
      }
    };

    return (
      <Pressable
        style={({ pressed }) => [
          containerStyle,
          pressed && !isPast && styles.dayPressed,
        ]}
        onPress={handlePress}
        disabled={isPast && !isPastUnpaid}
      >
        <Text style={textStyle}>{date.day}</Text>
        {!isPast && <Text style={priceTextStyle}>${price}</Text>}
        {isBooked && !isPast && (
          <View style={styles.bookedBadge}>
            <Icon name="check" size={8} color="#fff" />
          </View>
        )}
        {isSelected && (
          <View style={styles.selectedBadge}>
            <Icon name="plus" size={8} color="#fff" />
          </View>
        )}
      </Pressable>
    );
  }, [selectedDates, appointments, confirmationModalVisible]);

  const selectedCount = Object.keys(selectedDates).length;
  const totalPrice = Object.values(selectedDates).reduce((sum, d) => sum + d.price, 0);
  const bookedCount = appointments.filter(a => new Date(a.date) >= new Date()).length;

  return (
    <View style={styles.wrapper}>
      {/* Calendar Header */}
      <View style={styles.headerCard}>
        <View style={styles.headerStats}>
          <View style={styles.headerStatItem}>
            <View style={[styles.headerStatIcon, { backgroundColor: "#ecfdf5" }]}>
              <Icon name="calendar-check-o" size={16} color="#10b981" />
            </View>
            <View>
              <Text style={styles.headerStatValue}>{bookedCount}</Text>
              <Text style={styles.headerStatLabel}>Upcoming</Text>
            </View>
          </View>
          <View style={styles.headerStatDivider} />
          <View style={styles.headerStatItem}>
            <View style={[styles.headerStatIcon, { backgroundColor: "#eff6ff" }]}>
              <Icon name="dollar" size={16} color="#3b82f6" />
            </View>
            <View>
              <Text style={styles.headerStatValue}>${calculatePrice()}</Text>
              <Text style={styles.headerStatLabel}>Per Clean</Text>
            </View>
          </View>
        </View>
      </View>

      {/* Calendar Card */}
      <View style={styles.calendarCard}>
        {error && (
          <View style={styles.errorContainer}>
            <Icon name="exclamation-circle" size={14} color="#dc2626" />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        {/* Legend */}
        <View style={styles.legend}>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, styles.legendDotSelected]} />
            <Text style={styles.legendText}>New</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, styles.legendDotBooked]} />
            <Text style={styles.legendText}>Booked</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, styles.legendDotUnpaid]} />
            <Text style={styles.legendText}>Unpaid</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, styles.legendDotAvailable]} />
            <Text style={styles.legendText}>Available</Text>
          </View>
        </View>

        <Calendar
          current={currentMonth.toISOString().split("T")[0]}
          onMonthChange={handleMonthChange}
          renderArrow={(direction) => (
            <View style={styles.arrowButton}>
              <Icon
                name={direction === "left" ? "chevron-left" : "chevron-right"}
                size={16}
                color="#6366f1"
              />
            </View>
          )}
          dayComponent={renderDay}
          theme={{
            backgroundColor: "transparent",
            calendarBackground: "transparent",
            monthTextColor: "#1e293b",
            textMonthFontWeight: "700",
            textMonthFontSize: 18,
          }}
          style={styles.calendar}
        />

        {/* Selected Dates Summary */}
        {selectedCount > 0 && (
          <View style={styles.summaryCard}>
            <View style={styles.summaryHeader}>
              <Icon name="shopping-cart" size={14} color="#6366f1" />
              <Text style={styles.summaryTitle}>Your Selection</Text>
            </View>

            <View style={styles.selectedDatesList}>
              {Object.keys(selectedDates).sort().map((dateStr) => {
                const dateObj = new Date(dateStr + "T00:00:00");
                const formatted = dateObj.toLocaleDateString("en-US", {
                  weekday: "short",
                  month: "short",
                  day: "numeric",
                });
                return (
                  <View key={dateStr} style={styles.dateChip}>
                    <Icon name="calendar" size={10} color="#6366f1" />
                    <Text style={styles.dateChipText}>{formatted}</Text>
                    <Pressable
                      onPress={() => handleDateSelect({ dateString: dateStr })}
                      hitSlop={8}
                      style={styles.dateChipRemove}
                    >
                      <Icon name="times" size={10} color="#94a3b8" />
                    </Pressable>
                  </View>
                );
              })}
            </View>

            <View style={styles.summaryFooter}>
              <View>
                <Text style={styles.summaryLabel}>{selectedCount} cleaning{selectedCount > 1 ? "s" : ""}</Text>
              </View>
              <View style={styles.summaryPriceContainer}>
                <Text style={styles.summaryPriceLabel}>Total</Text>
                <Text style={styles.summaryPrice}>${totalPrice}</Text>
              </View>
            </View>
          </View>
        )}

        {/* Book Button */}
        <Pressable
          style={({ pressed }) => [
            styles.bookButton,
            selectedCount === 0 && styles.bookButtonDisabled,
            pressed && selectedCount > 0 && styles.bookButtonPressed,
          ]}
          onPress={handleSubmit}
          disabled={selectedCount === 0}
        >
          <View style={styles.bookButtonContent}>
            <Icon
              name="calendar-plus-o"
              size={18}
              color="#fff"
              style={styles.bookButtonIcon}
            />
            <Text style={styles.bookButtonText}>
              {selectedCount === 0
                ? "Select dates to book"
                : `Book ${selectedCount} Cleaning${selectedCount > 1 ? "s" : ""}`}
            </Text>
          </View>
          {selectedCount > 0 && (
            <Text style={styles.bookButtonPrice}>${totalPrice}</Text>
          )}
        </Pressable>

        <View style={styles.helpContainer}>
          <Icon name="info-circle" size={12} color="#94a3b8" />
          <Text style={styles.helpText}>
            Tap green dates to manage booked appointments
          </Text>
        </View>
      </View>

      {/* Cancellation Confirmation Modal */}
      <Modal
        animationType="fade"
        transparent={true}
        visible={confirmationModalVisible}
        onRequestClose={() => setConfirmationModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            {/* Modal Header */}
            <View style={[
              styles.modalIconContainer,
              cancellationFee > 0 ? styles.modalIconWarning : styles.modalIconInfo
            ]}>
              <Icon
                name={cancellationFee > 0 ? "exclamation-triangle" : "calendar-times-o"}
                size={28}
                color={cancellationFee > 0 ? "#f59e0b" : "#6366f1"}
              />
            </View>

            <Text style={styles.modalTitle}>
              {cancellationFee > 0 ? "Late Cancellation" : "Cancel Appointment?"}
            </Text>

            {/* Appointment Details */}
            {appointmentToCancel && (
              <View style={styles.modalAppointmentCard}>
                <View style={styles.modalAppointmentRow}>
                  <Icon name="calendar" size={14} color="#64748b" />
                  <Text style={styles.modalAppointmentDate}>
                    {formatDate(appointmentToCancel.date)}
                  </Text>
                </View>
                <View style={styles.modalAppointmentRow}>
                  <Icon name="dollar" size={14} color="#64748b" />
                  <Text style={styles.modalAppointmentPrice}>
                    ${appointmentToCancel.price} cleaning
                  </Text>
                </View>
              </View>
            )}

            {cancellationFee > 0 ? (
              <View style={styles.modalFeeWarning}>
                <Icon name="info-circle" size={14} color="#dc2626" />
                <Text style={styles.modalFeeText}>
                  This appointment is within 7 days. A{" "}
                  <Text style={styles.modalFeeAmount}>${cancellationFee} cancellation fee</Text>
                  {" "}will be charged.
                </Text>
              </View>
            ) : (
              <Text style={styles.modalText}>
                Are you sure you want to cancel this cleaning appointment? This action cannot be undone.
              </Text>
            )}

            {/* Action Buttons */}
            <View style={styles.modalButtons}>
              <Pressable
                style={({ pressed }) => [
                  styles.modalButtonKeep,
                  pressed && styles.modalButtonPressed,
                ]}
                onPress={() => handleConfirmation(false)}
              >
                <Icon name="check" size={14} color="#fff" style={{ marginRight: 8 }} />
                <Text style={styles.modalButtonKeepText}>Keep Appointment</Text>
              </Pressable>

              <Pressable
                style={({ pressed }) => [
                  styles.modalButtonCancel,
                  pressed && styles.modalButtonCancelPressed,
                ]}
                onPress={() => handleConfirmation(true)}
              >
                <Icon name="times" size={14} color="#dc2626" style={{ marginRight: 8 }} />
                <Text style={styles.modalButtonCancelText}>
                  {cancellationFee > 0 ? `Cancel & Pay $${cancellationFee}` : "Cancel Appointment"}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    flex: 1,
  },

  // Header Card
  headerCard: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  headerStats: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
  },
  headerStatItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  headerStatIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  headerStatValue: {
    fontSize: 18,
    fontWeight: "700",
    color: "#1e293b",
  },
  headerStatLabel: {
    fontSize: 12,
    color: "#94a3b8",
    marginTop: 1,
  },
  headerStatDivider: {
    width: 1,
    height: 40,
    backgroundColor: "#e2e8f0",
  },

  // Calendar Card
  calendarCard: {
    backgroundColor: "#fff",
    borderRadius: 20,
    padding: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },
  calendar: {
    marginBottom: 8,
  },
  errorContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fef2f2",
    padding: 12,
    borderRadius: 10,
    marginBottom: 12,
    gap: 8,
  },
  errorText: {
    color: "#dc2626",
    fontSize: 13,
    flex: 1,
    fontWeight: "500",
  },

  // Legend
  legend: {
    flexDirection: "row",
    justifyContent: "center",
    flexWrap: "wrap",
    gap: 16,
    marginBottom: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: "#f8fafc",
    borderRadius: 12,
  },
  legendItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  legendDotSelected: {
    backgroundColor: "#3b82f6",
  },
  legendDotBooked: {
    backgroundColor: "#10b981",
  },
  legendDotUnpaid: {
    backgroundColor: "#ef4444",
  },
  legendDotAvailable: {
    backgroundColor: "#e2e8f0",
    borderWidth: 1,
    borderColor: "#cbd5e1",
  },
  legendText: {
    fontSize: 11,
    color: "#64748b",
    fontWeight: "500",
  },

  // Day Cells
  dayContainer: {
    width: 42,
    height: 54,
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 12,
    margin: 2,
  },
  dayPressed: {
    opacity: 0.8,
    transform: [{ scale: 0.95 }],
  },
  dayAvailable: {
    backgroundColor: "#f8fafc",
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  daySelected: {
    backgroundColor: "#3b82f6",
    shadowColor: "#3b82f6",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  dayBooked: {
    backgroundColor: "#10b981",
    shadowColor: "#10b981",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  dayDisabled: {
    backgroundColor: "transparent",
    opacity: 0.35,
  },
  dayPastUnpaid: {
    backgroundColor: "#ef4444",
  },
  dayText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#1e293b",
  },
  dayTextLight: {
    color: "#fff",
  },
  dayTextDisabled: {
    color: "#94a3b8",
  },
  priceText: {
    fontSize: 9,
    color: "#64748b",
    marginTop: 2,
    fontWeight: "500",
  },
  priceTextLight: {
    color: "rgba(255,255,255,0.9)",
  },
  priceTextDisabled: {
    color: "#cbd5e1",
  },
  bookedBadge: {
    position: "absolute",
    top: 3,
    right: 3,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: "rgba(255,255,255,0.3)",
    justifyContent: "center",
    alignItems: "center",
  },
  selectedBadge: {
    position: "absolute",
    top: 3,
    right: 3,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: "rgba(255,255,255,0.3)",
    justifyContent: "center",
    alignItems: "center",
  },
  arrowButton: {
    width: 44,
    height: 44,
    backgroundColor: "#eef2ff",
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
  },

  // Summary Card
  summaryCard: {
    backgroundColor: "#f8fafc",
    borderRadius: 14,
    padding: 14,
    marginTop: 12,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  summaryHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 12,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
  },
  summaryTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#1e293b",
  },
  selectedDatesList: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  dateChip: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    paddingVertical: 8,
    paddingLeft: 10,
    paddingRight: 6,
    borderRadius: 10,
    gap: 6,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  dateChipText: {
    fontSize: 12,
    color: "#334155",
    fontWeight: "500",
  },
  dateChipRemove: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: "#f1f5f9",
    justifyContent: "center",
    alignItems: "center",
  },
  summaryFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#e2e8f0",
  },
  summaryLabel: {
    fontSize: 13,
    color: "#64748b",
  },
  summaryPriceContainer: {
    alignItems: "flex-end",
  },
  summaryPriceLabel: {
    fontSize: 11,
    color: "#94a3b8",
    marginBottom: 2,
  },
  summaryPrice: {
    fontSize: 22,
    fontWeight: "700",
    color: "#6366f1",
  },

  // Book Button
  bookButton: {
    backgroundColor: "#6366f1",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 14,
    marginTop: 16,
    shadowColor: "#6366f1",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  bookButtonDisabled: {
    backgroundColor: "#cbd5e1",
    shadowOpacity: 0,
    justifyContent: "center",
  },
  bookButtonPressed: {
    backgroundColor: "#4f46e5",
    transform: [{ scale: 0.98 }],
  },
  bookButtonContent: {
    flexDirection: "row",
    alignItems: "center",
  },
  bookButtonIcon: {
    marginRight: 10,
  },
  bookButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
  },
  bookButtonPrice: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "700",
    backgroundColor: "rgba(255,255,255,0.2)",
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 8,
  },

  // Help Text
  helpContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    marginTop: 14,
  },
  helpText: {
    fontSize: 12,
    color: "#94a3b8",
  },

  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  modalContent: {
    backgroundColor: "#fff",
    borderRadius: 24,
    padding: 24,
    width: "100%",
    maxWidth: 360,
    alignItems: "center",
  },
  modalIconContainer: {
    width: 72,
    height: 72,
    borderRadius: 36,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 20,
  },
  modalIconWarning: {
    backgroundColor: "#fef3c7",
  },
  modalIconInfo: {
    backgroundColor: "#eef2ff",
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: "700",
    color: "#1e293b",
    marginBottom: 16,
    textAlign: "center",
  },
  modalAppointmentCard: {
    backgroundColor: "#f8fafc",
    borderRadius: 12,
    padding: 14,
    width: "100%",
    marginBottom: 16,
    gap: 10,
  },
  modalAppointmentRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  modalAppointmentDate: {
    fontSize: 14,
    fontWeight: "600",
    color: "#1e293b",
  },
  modalAppointmentPrice: {
    fontSize: 14,
    color: "#64748b",
  },
  modalText: {
    fontSize: 14,
    color: "#64748b",
    textAlign: "center",
    lineHeight: 22,
    marginBottom: 20,
    paddingHorizontal: 8,
  },
  modalFeeWarning: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: "#fef2f2",
    borderRadius: 12,
    padding: 14,
    marginBottom: 20,
    gap: 10,
    width: "100%",
  },
  modalFeeText: {
    fontSize: 14,
    color: "#991b1b",
    flex: 1,
    lineHeight: 20,
  },
  modalFeeAmount: {
    fontWeight: "700",
    color: "#dc2626",
  },
  modalButtons: {
    width: "100%",
    gap: 10,
  },
  modalButtonKeep: {
    backgroundColor: "#10b981",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 16,
    borderRadius: 14,
  },
  modalButtonPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.98 }],
  },
  modalButtonKeepText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  modalButtonCancel: {
    backgroundColor: "#fee2e2",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 16,
    borderRadius: 14,
  },
  modalButtonCancelPressed: {
    backgroundColor: "#fecaca",
  },
  modalButtonCancelText: {
    color: "#dc2626",
    fontSize: 16,
    fontWeight: "600",
  },
});

export default CalendarComponent;
