import React, { useState, useEffect } from "react";
import { View, Text, Button, Pressable, Modal } from "react-native";
import { Calendar } from "react-native-calendars";
import calenderStyles from "../../services/styles/CalenderSyles";
import Icon from "react-native-vector-icons/FontAwesome";
import UserFormStyles from "../../services/styles/UserInputFormStyle";
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
  timeToBeCompleted
}) => {
  const [selectedDates, setSelectedDates] = useState({});
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [dateToDelete, setDateToDelete] = useState(null);
  const [error, setError] = useState(null);
  const [redirectToBill, setRedirectToBill] = useState(false);
  const navigate = useNavigate();

  const calculatePrice = () => {
    let price = 0;
    if (timeToBeCompleted === "anytime") {
      price += 0;
    } else if (timeToBeCompleted === "10-3") {
      price += 30;
    } else if (timeToBeCompleted === "11-4") {
      price += 30;
    } else if (timeToBeCompleted === "12-2") {
      price += 50;
    }
    if (sheets === "yes") {
      price += 25;
    }
    if (towels === "yes") {
      price += 25;
    }
    if (Number(numBeds) === 1 && Number(numBaths) === 1) {
      price = price + 100;
      return price;
    } else if (Number(numBeds) === 1) {
      const baths = (Number(numBaths) - 1) * 50;
      price += baths + 100;
      return price;
    } else if (Number(numBaths) === 1) {
      const beds = (Number(numBeds) - 1) * 50;
      price += beds + 100;
      return price;
    } else {
      const beds = (Number(numBeds) - 1) * 50;
      const baths = (Number(numBaths) - 1) * 50;
      price += beds + baths + 100;
      return price;
    }
  };

  const handleDateSelect = (date) => {
    const currentDate = new Date();
    const selectedDate = new Date(date.dateString);

    const isWithinWeek =
      selectedDate.getTime() - currentDate.getTime() <= 7 * 24 * 60 * 60 * 1000;

    if (isWithinWeek) {
      setError("Cannot book appointments within a week of the todays date.");
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

  const renderDay = ({ date }) => {
    const selectedStyle = {
      justifyContent: "center",
      alignItems: "center",
      backgroundColor: confirmationModalVisible
        ? "grey"
        : isDateBooked(date)
          ? "#28A745"
          : "#3498db",
      borderRadius: 50,
      padding: 10,
    };

    const dayStyle = {
      justifyContent: "center",
      alignItems: "center",
      padding: 10,
      opacity: confirmationModalVisible
        ? "grey"
        : isDateDisabled(date)
          ? 0.5
          : 1,
    };

    const pastDate = {
      backgroundColor: confirmationModalVisible
        ? "red"
        : isDateBooked(date)
          ? "red"
          : "#3498db",
      borderRadius: 50,
      padding: 10,
    };

    const selectedPriceStyle = {
      fontSize: 12,
      color: "black",
    };

    const priceStyle = {
      fontSize: 12,
      color: "gray",
    };

    return (
      <>
        {isDatePastAndNotPaid(date) ? (
          <Pressable style={pastDate} onPress={() => handleRedirectToBill()}>
            <Text>{date.day}</Text>
            <Text style={selectedPriceStyle}>${priceOfBooking(date)}</Text>
          </Pressable>
        ) : isDateDisabled(date) ? (
          <View style={dayStyle}>
            <Text>{date.day}</Text>
          </View>
        ) : isDateBooked(date) ? (
          <Pressable
            style={selectedStyle}
            onPress={() => handleRemoveBooking(date)}
          >
            <Text>{date.day}</Text>
            <Text style={selectedPriceStyle}>${priceOfBooking(date)}</Text>
          </Pressable>
        ) : selectedDates[date.dateString] ? (
          <Pressable
            style={selectedStyle}
            onPress={() => handleDateSelect(date)}
          >
            <Text>{date.day}</Text>
            <Text style={selectedPriceStyle}>${calculatePrice()}</Text>
          </Pressable>
        ) : (
          <Pressable style={dayStyle} onPress={() => handleDateSelect(date)}>
            <Text>{date.day}</Text>
            <Text style={priceStyle}>${calculatePrice()}</Text>
          </Pressable>
        )}
      </>
    );
  };
  return (
    <>
      <View style={calenderStyles.container}>
        {error && <Text style={UserFormStyles.error}>{error}</Text>}
        <Text style={calenderStyles.title}>Select Dates</Text>
        <Calendar
          current={currentMonth.toISOString().split("T")[0]}
          onMonthChange={handleMonthChange}
          renderArrow={(direction) => (
            <View>
              {direction === "left" ? (
                <Icon name="chevron-left" size={15} color="#3498db" />
              ) : (
                <Icon name="chevron-right" size={15} color="#3498db" />
              )}
            </View>
          )}
          dayComponent={renderDay}
        />
        <Button
          title="Book Cleanings!"
          onPress={handleSubmit}
          disabled={Object.keys(selectedDates).length === 0}
        />
      </View>
      <View style={calenderStyles.datesContainer}>
        {Object.keys(selectedDates).length > 0 && (
          <View style={calenderStyles.selectedDatesContainer}>
            <Text style={calenderStyles.selectedDatesText}>
              Selected Dates: {Object.keys(selectedDates).join(", ")}
            </Text>
          </View>
        )}
      </View>
      <Modal
        animationType="slide"
        transparent={true}
        visible={confirmationModalVisible}
        onRequestClose={() => setConfirmationModalVisible(false)}
      >
        <View style={calenderStyles.modalContainer}>
          <View style={calenderStyles.modalContent}>
            <Text style={calenderStyles.modalText}>
              Are you sure you want to delete this appointment? A $25
              cancellation fee will be charged.
            </Text>
            <View style={calenderStyles.modalButtons}>
              <Pressable onPress={() => handleConfirmation(true)}>
                <View style={calenderStyles.deleteButton}>
                  <Text style={calenderStyles.buttonText}>Delete</Text>
                </View>
              </Pressable>
              <Pressable onPress={() => handleConfirmation(false)}>
                <View style={calenderStyles.keepButton}>
                  <Text style={calenderStyles.buttonText}>Keep</Text>
                </View>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
};

export default CalendarComponent;
