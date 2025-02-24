import React, { useState, useEffect, useMemo } from "react";
import {
  Pressable,
  View,
  Text,
  Dimensions,
  Button,
  ActivityIndicator,
} from "react-native";
import { Calendar } from "react-native-calendars";
import calenderStyles from "../../../services/styles/CalenderSyles";
import { useNavigate } from "react-router-native";
import { Picker } from "@react-native-picker/picker";
import Icon from "react-native-vector-icons/FontAwesome";
import FetchData from "../../../services/fetchRequests/fetchData";
import getCurrentUser from "../../../services/fetchRequests/getCurrentUser";
import EmployeeAssignmentTile from "../tiles/EmployeeAssignmentTile";
import homePageStyles from "../../../services/styles/HomePageStyles";
import topBarStyles from "../../../services/styles/TopBarStyles";

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
  const [dateSelectAppointments, setDateSelectAppointments] = useState([]);
  const [userId, setUserId] = useState(null);
  const [userLocation, setUserLocation] = useState(null);
  const [appointmentLocations, setAppointmentLocations] = useState(null);
  const [sortOption, setSortOption] = useState("distanceClosest");
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

    if (state.currentUser?.token) {
      fetchAppointments();
      fetchUser();
    }
  }, [state.currentUser.token]);

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
        },
        (error) => {
          console.error("Error getting location:", error);
          setUserLocation({ latitude: 0, longitude: 0 });
          setLoading(false);
        },
        { enableHighAccuracy: true, timeout: 30000, maximumAge: 0 }
      );

      return () => navigator.geolocation.clearWatch(watcher);
    } else {
      setLoading(false);
    }
  }, []);

  const handleDateSelectAppointments = (date) => {
    const selectedAppointments = allAppointments
      .filter((appointment) => appointment.date === date.dateString)
      .map((appointment) => {
        let distance = null;
        if (userLocation && appointmentLocations?.[appointment.homeId]) {
          const loc = appointmentLocations[appointment.homeId];
          distance = haversineDistance(
            userLocation.latitude,
            userLocation.longitude,
            loc.latitude,
            loc.longitude
          );
        }
        return { ...appointment, distance };
      });

    const sorted = selectedAppointments.sort((a, b) => {
      if (sortOption === "distanceClosest") {
        return (a.distance || Infinity) - (b.distance || Infinity);
      } else if (sortOption === "distanceFurthest") {
        return (b.distance || 0) - (a.distance || 0);
      } else if (sortOption === "priceLow") {
        return (Number(a.price) || 0) - (Number(b.price) || 0);
      } else if (sortOption === "priceHigh") {
        return (Number(b.price) || 0) - (Number(a.price) || 0);
      }
      return 0;
    });
    setLoading(false);
    setDateSelectAppointments(sorted);
  };

  useEffect(() => {
    if (dateSelectAppointments.length > 0) {
      const sorted = [...dateSelectAppointments].sort((a, b) => {
        if (sortOption === "distanceClosest") {
          return (a.distance || Infinity) - (b.distance || Infinity);
        } else if (sortOption === "distanceFurthest") {
          return (b.distance || 0) - (a.distance || 0);
        } else if (sortOption === "priceLow") {
          return (Number(a.price) || 0) - (Number(b.price) || 0);
        } else if (sortOption === "priceHigh") {
          return (Number(b.price) || 0) - (Number(a.price) || 0);
        }
        return 0;
      });

      setDateSelectAppointments(sorted);
    }
  }, [sortOption]);

  const handleDateSelect = (date) => {
    const currentDate = new Date();
    const selectedDate = new Date(date.dateString);

    const updatedDates = { ...selectedDates };
    if (updatedDates[date.dateString]) {
      delete updatedDates[date.dateString];
    } else {
      updatedDates[date.dateString] = {
        selected: true,
      };
    }
    setDateSelectAppointments([]);
    setSelectedDates(updatedDates);
  };

  const handleSubmit = () => {
    const selectedDateArray = Object.keys(selectedDates).map((dateString) => {
      console.log(dateString);
    });
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

  const numberOfAppointmentsOnDate = (date) => {
    return allAppointments.filter(
      (appointment) => appointment.date === date.dateString
    ).length;
  };

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
            <Text style={selectedPriceStyle}>
              {numberOfAppointmentsOnDate(date)}
            </Text>
          </Pressable>
        ) : isDateDisabled(date) ? (
          <View style={dayStyle}>
            <Text>{date.day}</Text>
          </View>
        ) : isDateBooked(date) ? (
          <Pressable
            style={selectedStyle}
            onPress={() => handleDateSelectAppointments(date)}
          >
            <Text>{date.day}</Text>
            <Text style={selectedPriceStyle}>
              {numberOfAppointmentsOnDate(date)}
            </Text>
          </Pressable>
        ) : selectedDates[date.dateString] ? (
          <Pressable
            style={selectedStyle}
            onPress={() => handleDateSelect(date)}
          >
            <Text>{date.day}</Text>
          </Pressable>
        ) : (
          <Pressable style={dayStyle} onPress={() => handleDateSelect(date)}>
            <Text>{date.day}</Text>
          </Pressable>
        )}
      </>
    );
  };
  return (
    <>
	 <View
        style={{
          ...homePageStyles.backButtonSelectNewJobList,
          flexDirection: "row",
          justifyContent: "space-evenly",
		  marginTop: "28%"
        }}
      >
        <Pressable
          style={homePageStyles.backButtonForm}
          onPress={() => navigate("/")}
        >
          <View
            style={{ flexDirection: "row", alignItems: "center", padding: 10 }}
          >
            <Icon name="angle-left" size={iconSize} color="black" />
            <View style={{ marginLeft: 15 }}>
              <Text style={topBarStyles.buttonTextSchedule}>Home</Text>
            </View>
          </View>
        </Pressable>
        <Pressable
          style={homePageStyles.backButtonForm}
          onPress={() => navigate("/new-job-choice")}
        >
          <View
            style={{ flexDirection: "row", alignItems: "center", padding: 10 }}
          >
            <View style={{ marginRight: 15 }}>
              <Text style={topBarStyles.buttonTextSchedule}>List</Text>
            </View>
            <Icon name="angle-right" size={iconSize} color="black" />
          </View>
        </Pressable>
      </View>
      <View style={{ flex: 1}}>
        <Text style={calenderStyles.title}>
          Select Dates to see available appointments
        </Text>
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
          title="Choose a date to see appointments"
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
      {dateSelectAppointments.length > 0 && (
        <>
          <View
            style={{
              margin: 10,
              borderWidth: 1,
              borderRadius: 5,
              borderColor: "#ccc",
            }}
          >
            <Picker
              selectedValue={sortOption}
              onValueChange={(itemValue) => setSortOption(itemValue)}
            >
              <Picker.Item
                label="Sort by: Distance (Closest)"
                value="distanceClosest"
              />
              <Picker.Item
                label="Sort by: Distance (Furthest)"
                value="distanceFurthest"
              />
              <Picker.Item
                label="Sort by: Price (Low to High)"
                value="priceLow"
              />
              <Picker.Item
                label="Sort by: Price (High to Low)"
                value="priceHigh"
              />
            </Picker>
          </View>
          {loading ? (
            <ActivityIndicator
              size="large"
              color="#0000ff"
              style={{ marginTop: 20 }}
            />
          ) : (
            <View
              style={
                dateSelectAppointments.length === 1
                  ? { flex: 0.5 }
                  : { flex: 1 }
              }
            >
              {dateSelectAppointments.map((appointment) => (
                <View key={appointment.id}>
                  <EmployeeAssignmentTile
                    id={appointment.id}
                    cleanerId={userId}
                    date={appointment.date}
                    price={appointment.price}
                    homeId={appointment.homeId}
                    hasBeenAssigned={appointment.hasBeenAssigned}
                    bringSheets={appointment.bringSheets}
                    bringTowels={appointment.bringTowels}
                    completed={appointment.completed}
                    keyPadCode={appointment.keyPadCode}
                    keyLocation={appointment.keyLocation}
                    distance={appointment.distance}
                    assigned={
                      appointment.employeesAssigned?.includes(String(userId)) ||
                      false
                    }
                    addEmployee={async (employeeId, appointmentId) => {
                      try {
                        await FetchData.addEmployee(employeeId, appointmentId);
                        setDateSelectAppointments((prevAppointments) =>
                          prevAppointments.map((appointment) =>
                            appointment.id === appointmentId
                              ? {
                                  ...appointment,
                                  employeesAssigned: [
                                    ...new Set([
                                      ...(appointment.employeesAssigned || []),
                                      String(employeeId),
                                    ]),
                                  ],
                                }
                              : appointment
                          )
                        );
                      } catch (error) {
                        console.error("Error adding employee:", error);
                      }
                    }}
                    removeEmployee={async (employeeId, appointmentId) => {
                      try {
                        await FetchData.removeEmployee(
                          employeeId,
                          appointmentId
                        );
                        setDateSelectAppointments((prevAppointments) =>
                          prevAppointments.map((appointment) =>
                            appointment.id === appointmentId
                              ? {
                                  ...appointment,
                                  employeesAssigned: [
                                    ...(appointment.employeesAssigned || []),
                                  ].filter((id) => id !== String(employeeId)),
                                }
                              : appointment
                          )
                        );
                      } catch (error) {
                        console.error("Error removing employee:", error);
                      }
                    }}
                  />
                </View>
              ))}
            </View>
          )}
        </>
      )}
    </>
  );
};

export default AppointmentCalendar;
