import React, { useState, useEffect, useCallback } from "react";
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

const MyAppointmentsCalendar = ({ state, dispatch }) => {
  const [allAppointments, setAllAppointments] = useState([]);
  const [selectedDates, setSelectedDates] = useState({});
  const [dateSelectAppointments, setDateSelectAppointments] = useState([]);
  const [userId, setUserId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [sortOption, setSortOption] = useState("distanceClosest");

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

  const handleDateSelectAppointments = (date) => {
    const selectedAppointments = allAppointments.filter(
      (appointment) => appointment.date === date.dateString
    );

    setLoading(false);
    setDateSelectAppointments(selectedAppointments);
  };

  const numberOfAppointmentsOnDate = (date) => {
    const appointments = state.appointments.filter(
      (appointment) => appointment.date === date.dateString
    ).length;
    return appointments;
  };

  const handleDateSelect = (date) => {
    const updatedDates = { ...selectedDates };
    if (updatedDates[date.dateString]) {
      delete updatedDates[date.dateString];
    } else {
      updatedDates[date.dateString] = { selected: true };
    }
    setDateSelectAppointments([]);
    setSelectedDates(updatedDates);
  };

  const handleSubmit = () => {
    Object.keys(selectedDates).forEach((dateString) => console.log(dateString));
  };

  const handleMonthChange = (date) => {
    setCurrentMonth(new Date(date.year, date.month - 1));
  };

  const renderDay = useCallback(
    ({ date }) => {
      const isAssigned = allAppointments.some(
        (appointment) =>
          appointment.date === date.dateString &&
          appointment.employeesAssigned?.includes(String(userId))
      );

      const dayStyle = {
        justifyContent: "center",
        alignItems: "center",
        backgroundColor: isAssigned ? "green" : "transparent",
        borderRadius: 25,
        paddingVertical: 10,
        paddingHorizontal: 18,
      };

      const selectedPriceStyle = {
        fontSize: 12,
        color: "white",
      };

      return (
        <Pressable
          style={dayStyle}
          onPress={() => handleDateSelectAppointments(date)}
        >
          <Text style={{ color: isAssigned ? "white" : "black" }}>
            {date.day}
          </Text>
          {isAssigned ? (
            <Text style={selectedPriceStyle}>
              {numberOfAppointmentsOnDate(date)}
            </Text>
          ) : null}
        </Pressable>
      );
    },
    [allAppointments, dateSelectAppointments, userId]
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
          onPress={() => navigate("/employee-assignments")}
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
                    assigned={
                      appointment.employeesAssigned?.includes(String(userId)) ||
                      false
                    }
                    addEmployee={async (employeeId, appointmentId) => {
                      try {
                        await FetchData.addEmployee(employeeId, appointmentId);

                        const updateEmployeesAssigned = (
                          appointments,
                          appointmentId,
                          employeeId
                        ) =>
                          appointments.map((appointment) =>
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
                          );

                        setAllAppointments((prevAppointments) =>
                          updateEmployeesAssigned(
                            prevAppointments,
                            appointmentId,
                            employeeId
                          )
                        );
                        setDateSelectAppointments((prevAppointments) =>
                          updateEmployeesAssigned(
                            prevAppointments,
                            appointmentId,
                            employeeId
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

                        const removeEmployeeFromAssignments = (
                          appointments,
                          appointmentId,
                          employeeId
                        ) =>
                          appointments.map((appointment) =>
                            appointment.id === appointmentId
                              ? {
                                  ...appointment,
                                  employeesAssigned: (
                                    appointment.employeesAssigned || []
                                  ).filter((id) => id !== String(employeeId)),
                                }
                              : appointment
                          );

                        setAllAppointments((prevAppointments) =>
                          removeEmployeeFromAssignments(
                            prevAppointments,
                            appointmentId,
                            employeeId
                          )
                        );
                        setDateSelectAppointments((prevAppointments) =>
                          removeEmployeeFromAssignments(
                            prevAppointments,
                            appointmentId,
                            employeeId
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

export default MyAppointmentsCalendar;
