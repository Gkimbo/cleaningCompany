import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  Dimensions,
  Pressable,
  ActivityIndicator,
  ScrollView,
} from "react-native";
import { Calendar } from "react-native-calendars";
import { Picker } from "@react-native-picker/picker";
import Icon from "react-native-vector-icons/FontAwesome";
import { useNavigate } from "react-router-native";
import FetchData from "../../../services/fetchRequests/fetchData";
import getCurrentUser from "../../../services/fetchRequests/getCurrentUser";
import EmployeeAssignmentTile from "../tiles/EmployeeAssignmentTile";
import RequestedTile from "../tiles/RequestedTile";
import homePageStyles from "../../../services/styles/HomePageStyles";
import topBarStyles from "../../../services/styles/TopBarStyles";
import calenderStyles from "../../../services/styles/CalenderSyles";

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

const AppointmentCalendar = ({ state }) => {
  const [appointments, setAppointments] = useState([]);
  const [requests, setRequests] = useState([]);
  const [selectedDate, setSelectedDate] = useState(null);
  const [userId, setUserId] = useState(null);
  const [userLocation, setUserLocation] = useState(null);
  const [appointmentLocations, setAppointmentLocations] = useState({});
  const [filteredAppointments, setFilteredAppointments] = useState([]);
  const [filteredRequests, setFilteredRequests] = useState([]);
  const [sortOption, setSortOption] = useState("distanceClosest");
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const { width } = Dimensions.get("window");
  const iconSize = width < 400 ? 12 : width < 800 ? 16 : 20;

  useEffect(() => {
    const fetchData = async () => {
      try {
        const appointmentData = await FetchData.get(
          "/api/v1/users/appointments/employee",
          state.currentUser.token
        );
        setAppointments(appointmentData.appointments || []);
        setRequests(appointmentData.requested || []);

        const userData = await getCurrentUser();
        setUserId(userData.user.id);
      } catch (error) {
        console.error("Fetch error:", error);
      }
    };

    if (state.currentUser?.token) fetchData();
  }, [state.currentUser?.token]);

  useEffect(() => {
    if (navigator.geolocation) {
      const watcher = navigator.geolocation.watchPosition(
        (pos) =>
          setUserLocation({
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
          }),
        (err) => {
          console.error("Geolocation error:", err);
          setUserLocation({ latitude: 0, longitude: 0 });
        },
        { enableHighAccuracy: true, timeout: 30000 }
      );

      return () => navigator.geolocation.clearWatch(watcher);
    }
  }, []);

  useEffect(() => {
    const fetchDistances = async () => {
      const all = [...appointments, ...requests];

      const locations = await Promise.all(
        all.map(async (appt) => {
          const loc = await FetchData.getLatAndLong(appt.homeId);
          if (!loc) return null;
          const distance = haversineDistance(
            userLocation.latitude,
            userLocation.longitude,
            loc.latitude,
            loc.longitude
          );
          return { [appt.homeId]: { location: loc, distance } };
        })
      );

      const merged = Object.assign({}, ...locations.filter(Boolean));
      setAppointmentLocations(merged);
      setLoading(false);
    };

    if (userLocation && appointments.length) fetchDistances();
  }, [userLocation, appointments, requests]);

  const sortAppointments = (list) => {
    return [...list].sort((a, b) => {
      const getDistance = (appt) =>
        appointmentLocations[appt.homeId]?.distance || Infinity;

      const getPrice = (appt) => Number(appt.price) || 0;

      switch (sortOption) {
        case "distanceClosest":
          return getDistance(a) - getDistance(b);
        case "distanceFurthest":
          return getDistance(b) - getDistance(a);
        case "priceLow":
          return getPrice(a) - getPrice(b);
        case "priceHigh":
          return getPrice(b) - getPrice(a);
        default:
          return 0;
      }
    });
  };

  const handleDateSelect = (date, appts = appointments, reqs = requests) => {
    setSelectedDate(date.dateString);

    const sameDay = (appt) => appt.date === date.dateString;

    const updatedAppointments = appts.filter(sameDay).map((a) => ({
      ...a,
      distance: appointmentLocations[a.homeId]?.distance || null,
    }));

    const updatedRequests = reqs.filter(sameDay).map((r) => ({
      ...r,
      distance: appointmentLocations[r.homeId]?.distance || null,
    }));

    setFilteredAppointments(sortAppointments(updatedAppointments));
    setFilteredRequests(sortAppointments(updatedRequests));
  };

  useEffect(() => {
    if (selectedDate) {
      handleDateSelect({ dateString: selectedDate });
    }
  }, [sortOption]);

  const renderDay = useCallback(
    ({ date }) => {
      const today = new Date();
      const dayDate = new Date(date.dateString);
      const isPast = dayDate < new Date(today.toDateString());

      const hasData =
        appointments.some((a) => a.date === date.dateString) ||
        requests.some((r) => r.date === date.dateString);

      const isSelected = selectedDate === date.dateString;

      return (
        <Pressable
          disabled={isPast || !hasData}
          style={{
            justifyContent: "center",
            alignItems: "center",
            padding: 10,
            borderRadius: 20,
            backgroundColor: isSelected
              ? "#3498db"
              : hasData && !isPast
                ? "#b2ebf2"
                : "transparent",
            opacity: isPast ? 0.4 : 1, 
          }}
          onPress={() => !isPast && hasData && handleDateSelect(date)}
        >
          <Text style={{ color: isPast ? "#999" : "#000" }}>{date.day}</Text>
        </Pressable>
      );
    },
    [appointments, requests, selectedDate]
  );

  return (
    <ScrollView style={{ flex: 1 }}>
      <View
        style={{
          flexDirection: "row",
          justifyContent: "space-between",
          marginHorizontal: 20,
          marginTop: "30%",
          marginBottom: 10,
        }}
      >
        <Pressable
          style={{
            ...homePageStyles.backButtonForm,
          }}
          onPress={() => navigate("/")}
        >
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            <Icon name="angle-left" size={iconSize} />
            <Text style={topBarStyles.buttonTextSchedule}>Home</Text>
          </View>
        </Pressable>
        <Pressable
          style={{
            ...homePageStyles.backButtonForm,
          }}
          onPress={() => navigate("/new-job-choice")}
        >
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            <Text style={topBarStyles.buttonTextSchedule}>List</Text>
            <Icon name="angle-right" size={iconSize} />
          </View>
        </Pressable>
      </View>

      <Text style={calenderStyles.title}>Tap a date to view appointments</Text>

      <Calendar
        current={new Date().toISOString().split("T")[0]}
        onDayPress={handleDateSelect}
        dayComponent={renderDay}
        renderArrow={(direction) => (
          <Icon
            name={direction === "left" ? "chevron-left" : "chevron-right"}
            size={15}
            color="#3498db"
          />
        )}
      />

      <View style={{ margin: 10 }}>
        <Picker
          selectedValue={sortOption}
          onValueChange={(val) => setSortOption(val)}
        >
          <Picker.Item label="Distance (Closest)" value="distanceClosest" />
          <Picker.Item label="Distance (Furthest)" value="distanceFurthest" />
          <Picker.Item label="Price (Low to High)" value="priceLow" />
          <Picker.Item label="Price (High to Low)" value="priceHigh" />
        </Picker>
      </View>

      {loading ? (
        <ActivityIndicator size="large" color="blue" />
      ) : filteredRequests.length === 0 && filteredAppointments.length === 0 ? (
        <View style={{ marginTop: 50, alignItems: "center", padding: 20 }}>
          <Text
            style={{
              fontSize: 18,
              fontWeight: "600",
              color: "#444",
              marginBottom: 10,
            }}
          >
            No appointments available for this day.
          </Text>
          <Text
            style={{
              fontSize: 16,
              color: "#666",
              textAlign: "center",
              lineHeight: 22,
            }}
          >
            Try selecting a different date or check back later to see any new
            job requests or available shifts.
          </Text>
        </View>
      ) : (
        <>
          {filteredRequests.length > 0 && (
            <View>
              <Text style={calenderStyles.sectionTitle}>
                Requested Appointments
              </Text>
              {filteredRequests.map((appt) => (
                <RequestedTile
                  key={appt.id}
                  {...appt}
                  cleanerId={userId}
                  removeRequest={async (employeeId, appointmentId) => {
                    await FetchData.removeRequest(employeeId, appointmentId);

                    const removedRequest = requests.find(
                      (r) => r.id === appointmentId
                    );
                    if (!removedRequest) return;

                    const updatedAppt = {
                      ...removedRequest,
                      employeesAssigned: (
                        removedRequest.employeesAssigned || []
                      ).filter((id) => id !== String(employeeId)),
                    };

                    const updatedRequests = requests.filter(
                      (r) => r.id !== appointmentId
                    );
                    const updatedAppointments = [...appointments, updatedAppt];

                    setRequests(updatedRequests);
                    setAppointments(updatedAppointments);

                    handleDateSelect(
                      { dateString: selectedDate },
                      updatedAppointments,
                      updatedRequests
                    );
                  }}
                />
              ))}
            </View>
          )}

          {filteredAppointments.length > 0 && (
            <View>
              <Text style={calenderStyles.sectionTitle}>
                Available Appointments
              </Text>
              {filteredAppointments.map((appt) => (
                <EmployeeAssignmentTile
                  key={appt.id}
                  {...appt}
                  cleanerId={userId}
                  assigned={appt.employeesAssigned?.includes(String(userId))}
                  addEmployee={async (employeeId, appointmentId) => {
                    await FetchData.addEmployee(employeeId, appointmentId);

                    const updatedAppointment = appointments.find(
                      (a) => a.id === appointmentId
                    );
                    if (!updatedAppointment) return;

                    const updatedAppt = {
                      ...updatedAppointment,
                      employeesAssigned: [
                        ...(updatedAppointment.employeesAssigned || []),
                        String(employeeId),
                      ],
                    };

                    const updatedAppointments = appointments.filter(
                      (a) => a.id !== appointmentId
                    );
                    const updatedRequests = [...requests, updatedAppt];

                    setAppointments(updatedAppointments);
                    setRequests(updatedRequests);

                    handleDateSelect(
                      { dateString: selectedDate },
                      updatedAppointments,
                      updatedRequests
                    );
                  }}
                  removeEmployee={async (employeeId, appointmentId) => {
                    await FetchData.removeEmployee(employeeId, appointmentId);
                    const updatedAppointments = appointments.map((a) =>
                      a.id === appointmentId
                        ? {
                            ...a,
                            employeesAssigned: (
                              a.employeesAssigned || []
                            ).filter((id) => id !== String(employeeId)),
                          }
                        : a
                    );
                    const updatedRequests = requests.filter(
                      (r) => r.id !== appointmentId
                    );
                    setAppointments(updatedAppointments);
                    setRequests(updatedRequests);
                    handleDateSelect(
                      { dateString: selectedDate },
                      updatedAppointments,
                      updatedRequests
                    );
                  }}
                />
              ))}
            </View>
          )}
        </>
      )}
    </ScrollView>
  );
};

export default AppointmentCalendar;
