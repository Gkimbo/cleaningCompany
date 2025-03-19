import React, { useState, useEffect, useMemo, useCallback } from "react";
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
import RequestedTile from "../tiles/RequestedTile";
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
  const [allRequests, setAllRequests] = useState([]);
  const [selectedDates, setSelectedDates] = useState({});
  const [dateSelectAppointments, setDateSelectAppointments] = useState({
    appointments: [],
    requests: [],
  });
  const [selectedDate, setSelectedDate] = useState([]);
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
          "/api/v1/users/appointments/employee",
          state.currentUser.token
        );
        setAllAppointments(response.appointments || []);
        setAllRequests(response.requested || []);
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
        const locationsWithDistances = await Promise.all(
          allAppointments.map(async (appointment) => {
            const loc = await FetchData.getLatAndLong(appointment.homeId);
            if (!loc) return null;

            const distance = haversineDistance(
              userLocation.latitude,
              userLocation.longitude,
              loc.latitude,
              loc.longitude
            );

            return {
              [appointment.homeId]: {
                location: loc,
                distance: distance,
              },
            };
          }),
          allRequests.map(async (appointment) => {
            const loc = await FetchData.getLatAndLong(appointment.homeId);
            if (!loc) return null;

            const distance = haversineDistance(
              userLocation.latitude,
              userLocation.longitude,
              loc.latitude,
              loc.longitude
            );

            return {
              [appointment.homeId]: {
                location: loc,
                distance: distance,
              },
            };
          })
        );
        setAppointmentLocations(
          Object.assign({}, ...locationsWithDistances.filter(Boolean))
        );
      } catch (error) {
        console.error("Error fetching appointment locations:", error);
      }
    };

    if (allAppointments.length > 0 && userLocation) {
      fetchLocations();
    }
  }, [allAppointments, userLocation]);

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
    if (!appointmentLocations) {
      console.warn("Appointment locations not loaded yet.");
    }

    const sortAppointments = (appointments) => {
      return appointments.sort((a, b) => {
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
    };

    const processAppointments = (appointments) => {
      return appointments
        .filter((appointment) => appointment.date === date.dateString)
        .map((appointment) => {
          let distance = null;
          if (userLocation && appointmentLocations?.[appointment.homeId]) {
            distance = appointmentLocations[appointment.homeId].distance;
          }
          return { ...appointment, distance };
        });
    };

    const selectedRequests = sortAppointments(processAppointments(allRequests));
    const selectedAppointments = sortAppointments(
      processAppointments(allAppointments)
    );

    setLoading(false);

    setDateSelectAppointments({
      appointments: selectedAppointments,
      requests: selectedRequests,
    });
  };

  useEffect(() => {
    if (appointmentLocations && selectedDate) {
      handleDateSelectAppointments(selectedDate);
    }
  }, [appointmentLocations, selectedDate]);

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

  const myAppointments = (date, id) => {
    const employeeId = String(id);
    const appointments = allAppointments.some(
      (appointment) =>
        appointment.date === date.dateString &&
        Array.isArray(appointment.employeesAssigned) &&
        appointment.employeesAssigned.includes(employeeId)
    );
    return appointments;
  };

  const areAppointmentsAvailable = (date) => {
    const appointments = allAppointments.some(
      (appointment) => appointment.date === date.dateString
    );
    const requests = allRequests.some(
      (request) => request.date === date.dateString
    );

    return appointments || requests;
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
    const appointments = allAppointments.filter(
      (appointment) => appointment.date === date.dateString
    ).length;
    const requested = allRequests.filter(
      (appointment) => appointment.date === date.dateString
    ).length;
    let total = appointments + requested;
    return total;
  };

  const handleConfirmation = (deleteAppointment) => {
    if (deleteAppointment) {
      onAppointmentDelete(dateToDelete, 25);
    }
  };

  const renderDay = useCallback(
    ({ date }) => {
      if (!allAppointments.length || !userId) return <View />;

      const appointmentsOnDate = numberOfAppointmentsOnDate(date);
      const isDisabled = isDateDisabled(date);
      const hasMyAppointments = myAppointments(date, userId);
      const isAvailable = areAppointmentsAvailable(date);
      const isSelected = !!selectedDates[date.dateString];

      const commonStyle = {
        justifyContent: "center",
        alignItems: "center",
        borderRadius: 25,
        paddingVertical: 10,
        paddingHorizontal: 18,
      };

      if (isDatePastAndNotPaid(date)) {
        return (
          <Pressable
            style={{ ...commonStyle, backgroundColor: "#3498db" }}
            onPress={handleRedirectToBill}
          >
            <Text>{date.day}</Text>
            <Text style={{ fontSize: 12, color: "black" }}>
              {appointmentsOnDate}
            </Text>
          </Pressable>
        );
      }

      if (isDisabled || !appointmentsOnDate) {
        return (
          <View style={{ ...commonStyle, opacity: 0.5 }}>
            <Text>{date.day}</Text>
          </View>
        );
      }

      return (
        <Pressable
          style={{
            ...commonStyle,
            backgroundColor: hasMyAppointments
              ? "#28A745"
              : isAvailable || isSelected
                ? "#3498db"
                : "transparent",
          }}
          onPress={() => setSelectedDate(date)}
        >
          <Text>{date.day}</Text>
          {appointmentsOnDate > 0 && (
            <Text style={{ fontSize: 12, color: "black" }}>
              {appointmentsOnDate}
            </Text>
          )}
        </Pressable>
      );
    },
    [allAppointments, userId, selectedDates]
  );

  return (
    <>
      <View
        style={{
          ...homePageStyles.backButtonSelectNewJobList,
          flexDirection: "row",
          justifyContent: "space-evenly",
          marginTop: "28%",
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

      <View style={{ flex: 1 }}>
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

      {dateSelectAppointments.appointments.length > 0 ||
      dateSelectAppointments.requests.length > 0 ? (
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
              style={{
                flex:
                  dateSelectAppointments?.requests?.length === 1 &&
                  dateSelectAppointments?.appointments?.length === 1
                    ? 1.25 // Adjust this value if it's too small
                    : dateSelectAppointments?.requests?.length === 1 ||
                        dateSelectAppointments?.appointments?.length === 1
                      ? 0.5 // A balanced middle ground
                      : 1.25,
              }}
            >
              {dateSelectAppointments.requests.length > 0 && (
                <View>
                  <Text style={calenderStyles.sectionTitle}>
                    Requested Appointments
                  </Text>
                  {dateSelectAppointments.requests.map((appointment) => (
                    <View key={appointment.id}>
                      <RequestedTile
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
                        timeToBeCompleted={appointment.timeToBeCompleted}
                        removeRequest={async (employeeId, appointmentId) => {
                          try {
                            await FetchData.removeRequest(
                              employeeId,
                              appointmentId
                            );

                            setDateSelectAppointments((prevState) => {
                              const updatedRequests = prevState.requests.filter(
                                (appointment) =>
                                  appointment.id !== appointmentId
                              );

                              const appointmentToMove = prevState.requests.find(
                                (appointment) =>
                                  appointment.id === appointmentId
                              );

                              const updatedAppointments = appointmentToMove
                                ? [...prevState.appointments, appointmentToMove]
                                : prevState.appointments;

                              return {
                                ...prevState,
                                appointments: updatedAppointments,
                                requests: updatedRequests,
                              };
                            });
                          } catch (error) {
                            console.error("Error removing employee:", error);
                          }
                        }}
                      />
                    </View>
                  ))}
                </View>
              )}

              {dateSelectAppointments.appointments.length > 0 && (
                <View>
                  <Text style={calenderStyles.sectionTitle}>
                    Available Appointments
                  </Text>
                  {dateSelectAppointments.appointments.map((appointment) => (
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
                        timeToBeCompleted={appointment.timeToBeCompleted}
                        assigned={
                          appointment.employeesAssigned?.includes(
                            String(userId)
                          ) || false
                        }
                        addEmployee={async (employeeId, appointmentId) => {
                          try {
                            await FetchData.addEmployee(
                              employeeId,
                              appointmentId
                            );

                            setDateSelectAppointments((prevState) => {
                              const updatedAppointments =
                                prevState.appointments.filter(
                                  (appointment) =>
                                    appointment.id !== appointmentId
                                );

                              const updatedRequests = [
                                ...prevState.requests,
                                ...prevState.appointments.filter(
                                  (appointment) =>
                                    appointment.id === appointmentId
                                ),
                              ];

                              return {
                                ...prevState,
                                appointments: updatedAppointments,
                                requests: updatedRequests,
                              };
                            });
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

                            setDateSelectAppointments((prevState) => ({
                              appointments: prevState.appointments.map(
                                (appointment) =>
                                  appointment.id === appointmentId
                                    ? {
                                        ...appointment,
                                        employeesAssigned: (
                                          appointment.employeesAssigned || []
                                        ).filter(
                                          (id) => id !== String(employeeId)
                                        ),
                                      }
                                    : appointment
                              ),
                              requests: prevState.requests.map((request) =>
                                request.id === appointmentId
                                  ? {
                                      ...request,
                                      employeesAssigned: (
                                        request.employeesAssigned || []
                                      ).filter(
                                        (id) => id !== String(employeeId)
                                      ),
                                    }
                                  : request
                              ),
                            }));
                          } catch (error) {
                            console.error("Error removing employee:", error);
                          }
                        }}
                      />
                    </View>
                  ))}
                </View>
              )}
            </View>
          )}
        </>
      ) : null}
    </>
  );
};

export default AppointmentCalendar;
