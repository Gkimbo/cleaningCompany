import React, { useState, useEffect, useCallback } from "react";
import { View, Text, Pressable, Modal, StyleSheet } from "react-native";
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
  const navigate = useNavigate();

  const calculatePrice = () => {
    let price = 0;

    // Time window surcharge
    if (timeToBeCompleted === "anytime") {
      price += 0;
    } else if (timeToBeCompleted === "10-3") {
      price += 30;
    } else if (timeToBeCompleted === "11-4") {
      price += 30;
    } else if (timeToBeCompleted === "12-2") {
      price += 50;
    }

    // Linen pricing with new configuration-based pricing
    if (sheets === "yes") {
      if (bedConfigurations && Array.isArray(bedConfigurations) && bedConfigurations.length > 0) {
        // $30 per bed that needs sheets
        const bedsNeedingSheets = bedConfigurations.filter((b) => b.needsSheets).length;
        price += bedsNeedingSheets * 30;
      } else {
        // Fallback: charge for all beds
        price += Number(numBeds) * 30;
      }
    }

    if (towels === "yes") {
      if (bathroomConfigurations && Array.isArray(bathroomConfigurations) && bathroomConfigurations.length > 0) {
        // $10 per towel, $5 per face cloth
        bathroomConfigurations.forEach((bath) => {
          price += (bath.towels || 0) * 10;
          price += (bath.faceCloths || 0) * 5;
        });
      } else {
        // Fallback: default 2 towels + 1 face cloth per bathroom
        price += Number(numBaths) * (2 * 10 + 1 * 5);
      }
    }

    // Base price calculation
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

  const handleRemoveBooking = (date) => {
    const currentDate = new Date();
    const selectedDate = new Date(date.dateString);

    const isWithinWeek =
      selectedDate.getTime() - currentDate.getTime() <= 7 * 24 * 60 * 60 * 1000;

    if (isWithinWeek) {
      setDateToDelete(date);
      setConfirmationModalVisible(true);
    } else {
      onAppointmentDelete(date, null);
    }
  };

  const handleRedirectToBill = () => {
    setRedirectToBill(true);
  };

  const handleConfirmation = (deleteAppointment) => {
    setConfirmationModalVisible(false);
    if (deleteAppointment) {
      onAppointmentDelete(dateToDelete, 25);
    }
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
        style={containerStyle}
        onPress={handlePress}
        disabled={isPast && !isPastUnpaid}
      >
        <Text style={textStyle}>{date.day}</Text>
        {!isPast && <Text style={priceTextStyle}>${price}</Text>}
        {isBooked && !isPast && (
          <Icon name="check" size={10} color="#fff" style={styles.checkIcon} />
        )}
      </Pressable>
    );
  }, [selectedDates, appointments, confirmationModalVisible]);

  const selectedCount = Object.keys(selectedDates).length;
  const totalPrice = Object.values(selectedDates).reduce((sum, d) => sum + d.price, 0);

  return (
    <View style={styles.wrapper}>
      {/* Calendar Card */}
      <View style={styles.calendarCard}>
        <Text style={styles.title}>Schedule Cleanings</Text>
        <Text style={styles.subtitle}>
          Tap dates to schedule or manage appointments
        </Text>

        {error && (
          <View style={styles.errorContainer}>
            <Icon name="exclamation-circle" size={16} color="#dc2626" />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        {/* Legend */}
        <View style={styles.legend}>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: "#3b82f6" }]} />
            <Text style={styles.legendText}>Selected</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: "#10b981" }]} />
            <Text style={styles.legendText}>Booked</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: "#ef4444" }]} />
            <Text style={styles.legendText}>Unpaid</Text>
          </View>
        </View>

        <Calendar
          current={currentMonth.toISOString().split("T")[0]}
          onMonthChange={handleMonthChange}
          renderArrow={(direction) => (
            <View style={styles.arrowContainer}>
              <Icon
                name={direction === "left" ? "chevron-left" : "chevron-right"}
                size={16}
                color="#3b82f6"
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
        />

        {/* Selected Dates Summary */}
        {selectedCount > 0 && (
          <View style={styles.summaryCard}>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Selected Dates</Text>
              <Text style={styles.summaryValue}>{selectedCount}</Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Total</Text>
              <Text style={styles.summaryPrice}>${totalPrice}</Text>
            </View>
            <View style={styles.selectedDatesList}>
              {Object.keys(selectedDates).map((dateStr) => {
                const dateObj = new Date(dateStr + "T00:00:00");
                const formatted = dateObj.toLocaleDateString("en-US", {
                  weekday: "short",
                  month: "short",
                  day: "numeric",
                });
                return (
                  <View key={dateStr} style={styles.dateChip}>
                    <Text style={styles.dateChipText}>{formatted}</Text>
                    <Pressable
                      onPress={() => handleDateSelect({ dateString: dateStr })}
                      hitSlop={8}
                    >
                      <Icon name="times" size={12} color="#64748b" />
                    </Pressable>
                  </View>
                );
              })}
            </View>
          </View>
        )}

        {/* Book Button */}
        <Pressable
          style={[
            styles.bookButton,
            selectedCount === 0 && styles.bookButtonDisabled,
          ]}
          onPress={handleSubmit}
          disabled={selectedCount === 0}
        >
          <Icon name="calendar-check-o" size={18} color="#fff" style={{ marginRight: 10 }} />
          <Text style={styles.bookButtonText}>
            {selectedCount === 0
              ? "Select dates to book"
              : `Book ${selectedCount} Cleaning${selectedCount > 1 ? "s" : ""}`}
          </Text>
        </Pressable>

        <Text style={styles.helpText}>
          Tap a green date to cancel an existing appointment
        </Text>
      </View>

      {/* Cancellation Modal */}
      <Modal
        animationType="fade"
        transparent={true}
        visible={confirmationModalVisible}
        onRequestClose={() => setConfirmationModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalIconContainer}>
              <Icon name="exclamation-triangle" size={32} color="#f59e0b" />
            </View>
            <Text style={styles.modalTitle}>Cancel Appointment?</Text>
            <Text style={styles.modalText}>
              This appointment is within 7 days. A{" "}
              <Text style={styles.modalFee}>$25 cancellation fee</Text> will be
              charged to your account.
            </Text>
            <View style={styles.modalButtons}>
              <Pressable
                style={styles.keepButton}
                onPress={() => handleConfirmation(false)}
              >
                <Text style={styles.keepButtonText}>Keep Appointment</Text>
              </Pressable>
              <Pressable
                style={styles.deleteButton}
                onPress={() => handleConfirmation(true)}
              >
                <Text style={styles.deleteButtonText}>Cancel Anyway</Text>
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
    paddingHorizontal: 16,
    paddingBottom: 20,
  },
  calendarCard: {
    backgroundColor: "#fff",
    borderRadius: 20,
    padding: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 5,
  },
  title: {
    fontSize: 24,
    fontWeight: "700",
    color: "#1e293b",
    textAlign: "center",
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: "#64748b",
    textAlign: "center",
    marginBottom: 16,
  },
  errorContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fef2f2",
    padding: 12,
    borderRadius: 10,
    marginBottom: 16,
    gap: 8,
  },
  errorText: {
    color: "#dc2626",
    fontSize: 14,
    flex: 1,
  },
  legend: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 20,
    marginBottom: 16,
    paddingVertical: 10,
    backgroundColor: "#f8fafc",
    borderRadius: 10,
  },
  legendItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  legendDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  legendText: {
    fontSize: 12,
    color: "#64748b",
    fontWeight: "500",
  },
  dayContainer: {
    width: 44,
    height: 52,
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 10,
    margin: 2,
  },
  dayAvailable: {
    backgroundColor: "#f1f5f9",
  },
  daySelected: {
    backgroundColor: "#3b82f6",
  },
  dayBooked: {
    backgroundColor: "#10b981",
  },
  dayDisabled: {
    backgroundColor: "transparent",
    opacity: 0.4,
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
    fontSize: 10,
    color: "#64748b",
    marginTop: 2,
  },
  priceTextLight: {
    color: "rgba(255,255,255,0.9)",
  },
  priceTextDisabled: {
    color: "#cbd5e1",
  },
  checkIcon: {
    position: "absolute",
    top: 4,
    right: 4,
  },
  arrowContainer: {
    padding: 10,
    backgroundColor: "#eff6ff",
    borderRadius: 10,
  },
  summaryCard: {
    backgroundColor: "#f8fafc",
    borderRadius: 12,
    padding: 16,
    marginTop: 16,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  summaryLabel: {
    fontSize: 14,
    color: "#64748b",
  },
  summaryValue: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1e293b",
  },
  summaryPrice: {
    fontSize: 20,
    fontWeight: "700",
    color: "#3b82f6",
  },
  selectedDatesList: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#e2e8f0",
  },
  dateChip: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 20,
    gap: 8,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  dateChipText: {
    fontSize: 13,
    color: "#334155",
  },
  bookButton: {
    backgroundColor: "#3b82f6",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 16,
    borderRadius: 14,
    marginTop: 20,
    shadowColor: "#3b82f6",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  bookButtonDisabled: {
    backgroundColor: "#94a3b8",
    shadowOpacity: 0,
  },
  bookButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
  },
  helpText: {
    textAlign: "center",
    fontSize: 12,
    color: "#94a3b8",
    marginTop: 12,
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  modalContent: {
    backgroundColor: "#fff",
    borderRadius: 20,
    padding: 24,
    width: "100%",
    maxWidth: 340,
    alignItems: "center",
  },
  modalIconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "#fef3c7",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#1e293b",
    marginBottom: 8,
  },
  modalText: {
    fontSize: 14,
    color: "#64748b",
    textAlign: "center",
    lineHeight: 22,
    marginBottom: 24,
  },
  modalFee: {
    fontWeight: "700",
    color: "#ef4444",
  },
  modalButtons: {
    width: "100%",
    gap: 12,
  },
  keepButton: {
    backgroundColor: "#10b981",
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
  },
  keepButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  deleteButton: {
    backgroundColor: "#fee2e2",
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
  },
  deleteButtonText: {
    color: "#dc2626",
    fontSize: 16,
    fontWeight: "600",
  },
});

export default CalendarComponent;
