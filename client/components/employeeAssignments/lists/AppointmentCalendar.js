import React, { useState, useEffect, useMemo } from "react";
import {
  Pressable,
  View,
  Text,
  ScrollView,
  Dimensions,
  ActivityIndicator,
  Modal,
  Button,
} from "react-native";
import { Calendar } from "react-native-calendars";
import calenderStyles from "../../../services/styles/CalenderSyles";
import UserFormStyles from "../../../services/styles/UserInputFormStyle";
import { useNavigate } from "react-router-native";
import { Picker } from "@react-native-picker/picker";
import Icon from "react-native-vector-icons/FontAwesome";
import FetchData from "../../../services/fetchRequests/fetchData";
import getCurrentUser from "../../../services/fetchRequests/getCurrentUser";


const haversineDistance = (lat1, lon1, lat2, lon2) => {
  const toRad = (x) => (x * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

const AppointmentCalendar = ({ state, dispatch }) => {
  const [allAppointments, setAllAppointments] = useState([]);
  const [selectedDates, setSelectedDates] = useState({});
  const [userId, setUserId] = useState(null);
  const [userLocation, setUserLocation] = useState(null);
  const [appointmentLocations, setAppointmentLocations] = useState(null);
  const [sortOption, setSortOption] = useState("distanceClosest");
  const [backToList, setBackToList] = useState(false);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [loading, setLoading] = useState(true);
  const { width } = Dimensions.get("window");
  const iconSize = width < 400 ? 12 : width < 800 ? 16 : 20;
  const navigate = useNavigate();

  useEffect(() => {
    const fetchAppointments = async () => {
      try {
        const response = await FetchData.get(
          "/api/v1/users/appointments",
          state.currentUser.token
        );
        setAllAppointments(response.appointments || []);
      } catch (error) {
        console.error("Error fetching appointments:", error);
      }
    };

    const fetchUser = async () => {
      try {
        const response = await getCurrentUser();
        setUserId(response.user.id);
      } catch (error) {
        console.error("Error fetching user:", error);
      }
    };

    fetchAppointments();
    fetchUser();
  }, []);

  useEffect(() => {
    const fetchLocations = async () => {
      try {
        const locations = await Promise.all(
          allAppointments.map(async (appointment) => {
            const response = await FetchData.getLatAndLong(appointment.homeId);
            return { [appointment.homeId]: response };
          })
        );
        setAppointmentLocations(Object.assign({}, ...locations));
      } catch (error) {
        console.error("Error fetching appointment locations:", error);
      }
    };

    if (allAppointments.length > 0) {
      fetchLocations();
    }
  }, [allAppointments]);

  useEffect(() => {
    if (navigator.geolocation) {
      const watcher = navigator.geolocation.watchPosition(
        (position) => {
          setUserLocation({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
          });
          setLoading(false);
        },
        (error) => {
          console.error("Error getting location:", error);
          setLoading(false);
        },
        { enableHighAccuracy: true, timeout: 30000, maximumAge: 0 }
      );

      return () => navigator.geolocation.clearWatch(watcher);
    } else {
      setLoading(false);
    }
  }, []);

  const handleRemoveBooking = (date) => {
    const currentDate = new Date();
    const selectedDate = new Date(date.dateString);
    console.log(date, "REMOVED APPOINTMENT");
  };

  const handleDateSelect = (date) => {
    const currentDate = new Date();
    const selectedDate = new Date(date.dateString);

    const updatedDates = { ...selectedDates };
    if (updatedDates[date.dateString]) {
      delete updatedDates[date.dateString];
    } else {
      updatedDates[date.dateString] = {
        selected: true,
        // price: calculatePrice(),
      };
    }

    setSelectedDates(updatedDates);
  };

  const handleSubmit = () => {
    const selectedDateArray = Object.keys(selectedDates).map((dateString) => {
      //   const { price } = selectedDates[dateString];
      //   return {
      //     date: dateString,
      //     price,
      //     paid: false,
      //     bringTowels: towels,
      //     bringSheets: sheets,
      //   };
      console.log(dateString);
    });

    // onDatesSelected(selectedDateArray);
  };

  const handleMonthChange = (date) => {
    setCurrentMonth(new Date(date.year, date.month - 1));
  };

  const isDateDisabled = (date) => {
    const currentDate = new Date();
    return new Date(date.dateString) < currentDate;
  };

    const isDateBooked = (date) => {
      return allAppointments.some(
        (appointment) => appointment.date === date.dateString
      );
    };

    const isDatePastAndNotPaid = (date) => {
      let toggle = false;
      allAppointments.forEach((appointment) => {
        if (appointment.date === date.dateString) {
          if (isDateDisabled(date) && !appointment.paid) {
            toggle = true;
          }
        }
      });
      return toggle;
    };

  //   const priceOfBooking = (date) => {
  //     let price;
  //     allAppointments.forEach((day) => {
  //       if (day.date === date.dateString) {
  //         price = day.price;
  //       }
  //     });
  //     return price;
  //   };

  const handleConfirmation = (deleteAppointment) => {
    if (deleteAppointment) {
      onAppointmentDelete(dateToDelete, 25);
    }
  };

  const renderDay = ({ date }) => {
    const selectedStyle = {
      justifyContent: "center",
      alignItems: "center",
      backgroundColor: "#3498db",
      borderRadius: 50,
      padding: 10,
    };

    const dayStyle = {
      justifyContent: "center",
      alignItems: "center",
      padding: 10,
      opacity: isDateDisabled(date) ? 0.5 : 1,
    };

    const pastDate = {
      backgroundColor: "#3498db",
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
            {/* <Text style={selectedPriceStyle}>${calculatePrice()}</Text> */}
          </Pressable>
        ) : (
          <Pressable style={dayStyle} onPress={() => handleDateSelect(date)}>
            <Text>{date.day}</Text>
            {/* <Text style={priceStyle}>${calculatePrice()}</Text> */}
          </Pressable>
        )}
      </>
    );
  };
  return (
    <>
      <View style={calenderStyles.container}>
        {/* {error && <Text style={UserFormStyles.error}>{error}</Text>} */}
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
    </>
  );
};

export default AppointmentCalendar;
