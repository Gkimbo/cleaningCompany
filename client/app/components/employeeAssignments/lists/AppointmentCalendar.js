import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Dimensions,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { Calendar } from "react-native-calendars";
import Icon from "react-native-vector-icons/FontAwesome";
import { useNavigate } from "react-router-native";
import FetchData from "../../../services/fetchRequests/fetchData";
import getCurrentUser from "../../../services/fetchRequests/getCurrentUser";
import calenderStyles from "../../../services/styles/CalenderSyles";
import topBarStyles from "../../../services/styles/TopBarStyles";
import EmployeeAssignmentTile from "../tiles/EmployeeAssignmentTile";
import RequestedTile from "../tiles/RequestedTile";

const haversineDistance = (lat1, lon1, lat2, lon2) => {
  const toRad = (x) => (x * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) ** 2;
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
  const [showSortPicker, setShowSortPicker] = useState(false);
  const [loading, setLoading] = useState(true);

  const navigate = useNavigate();
  const { width } = Dimensions.get("window");
  const iconSize = width < 400 ? 12 : width < 800 ? 16 : 20;

  // Fetch appointments and user
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
        setLoading(false);
      }
    };

    if (state.currentUser?.token) fetchData();
  }, [state.currentUser?.token]);

  // Get user location
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

  // Fetch distances for sorting
  useEffect(() => {
    const fetchDistances = async () => {
      if (!userLocation || (appointments.length === 0 && requests.length === 0)) {
        setLoading(false); // Stop loading if no appointments/requests
        return;
      }

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
      setAppointmentLocations(Object.assign({}, ...locations.filter(Boolean)));
      setLoading(false);
    };

    fetchDistances();
  }, [userLocation, appointments, requests]);

  // Sorting helper
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

  // Filter by date
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

  // Update filtering when sort changes
  useEffect(() => {
    if (selectedDate) handleDateSelect({ dateString: selectedDate });
  }, [sortOption]);

  // Calendar day render
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
              ? "rgba(52,152,219,0.2)"
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
    <ScrollView style={{ flex: 1, paddingBottom: 30 }}>
     {/* Top Buttons */}
<View
  style={{
    flexDirection: "row",
    justifyContent: "center",
    marginTop: 40, // Increased top margin to move buttons down
    marginBottom: 20,
    gap: 20, // Space between buttons
  }}
>
  <Pressable
    style={{
      backgroundColor: "rgba(52,152,219,0.15)",
      paddingVertical: 12, // More vertical padding
      paddingHorizontal: 20, // More horizontal padding
      borderRadius: 14,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 3 },
      shadowOpacity: 0.1,
      shadowRadius: 5,
    }}
    onPress={() => navigate("/")}
  >
    <Icon name="angle-left" size={iconSize} color="#3498db" />
    <Text
      style={{
        ...topBarStyles.buttonTextSchedule,
        color: "#3498db",
        fontWeight: "600",
        marginLeft: 10, // Add spacing between icon and text
      }}
    >
      Home
    </Text>
  </Pressable>

  <Pressable
    style={{
      backgroundColor: "rgba(52,152,219,0.15)",
      paddingVertical: 12,
      paddingHorizontal: 20,
      borderRadius: 14,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 3 },
      shadowOpacity: 0.1,
      shadowRadius: 5,
    }}
    onPress={() => navigate("/new-job-choice")}
  >
    <Text
      style={{
        ...topBarStyles.buttonTextSchedule,
        color: "#3498db",
        fontWeight: "600",
        marginRight: 10, // Add spacing between text and icon
      }}
    >
      List
    </Text>
    <Icon name="angle-right" size={iconSize} color="#3498db" />
  </Pressable>
</View>


      <Text style={calenderStyles.title}>Tap a date to view appointments</Text>

      {/* Calendar */}
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

      {/* Sort Picker */}
      <Pressable
        onPress={() => setShowSortPicker(!showSortPicker)}
        style={{
          margin: 10,
          paddingVertical: 8,
          paddingHorizontal: 12,
          borderRadius: 12,
          backgroundColor: "rgba(52,152,219,0.15)",
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
          shadowColor: "#000",
          shadowOffset: { width: 0, height: 3 },
          shadowOpacity: 0.1,
          shadowRadius: 5,
        }}
      >
        <Text style={{ fontWeight: "600", color: "#3498db" }}>
          Sort by: {sortOption === "distanceClosest"
            ? "Distance (Closest)"
            : sortOption === "distanceFurthest"
            ? "Distance (Furthest)"
            : sortOption === "priceLow"
            ? "Price (Low)"
            : "Price (High)"}
        </Text>
        <Icon name={showSortPicker ? "angle-up" : "angle-down"} size={16} color="#3498db" />
      </Pressable>

      {showSortPicker && (
        <View
          style={{
            marginHorizontal: 10,
            marginBottom: 10,
            backgroundColor: "rgba(52,152,219,0.15)",
            borderRadius: 12,
            paddingVertical: 8,
          }}
        >
          <Pressable onPress={() => { setSortOption("distanceClosest"); setShowSortPicker(false); }}>
            <Text style={{ padding: 8, color: "#3498db", fontWeight: "500" }}>Distance (Closest)</Text>
          </Pressable>
          <Pressable onPress={() => { setSortOption("distanceFurthest"); setShowSortPicker(false); }}>
            <Text style={{ padding: 8, color: "#3498db", fontWeight: "500" }}>Distance (Furthest)</Text>
          </Pressable>
          <Pressable onPress={() => { setSortOption("priceLow"); setShowSortPicker(false); }}>
            <Text style={{ padding: 8, color: "#3498db", fontWeight: "500" }}>Price (Low to High)</Text>
          </Pressable>
          <Pressable onPress={() => { setSortOption("priceHigh"); setShowSortPicker(false); }}>
            <Text style={{ padding: 8, color: "#3498db", fontWeight: "500" }}>Price (High to Low)</Text>
          </Pressable>
        </View>
      )}

      {/* Loading / Empty */}
      {loading ? (
        <ActivityIndicator size="large" color="#3498db" style={{ marginTop: 30 }} />
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
            Try selecting a different date or check back later to see new job requests.
          </Text>
        </View>
      ) : (
        <>
          {filteredRequests.length > 0 && (
            <View>
              <Text style={calenderStyles.sectionTitle}>Requested Appointments</Text>
              {filteredRequests.map((appt) => (
                <RequestedTile key={appt.id} {...appt} cleanerId={userId} />
              ))}
            </View>
          )}
          {filteredAppointments.length > 0 && (
            <View>
              <Text style={calenderStyles.sectionTitle}>Available Appointments</Text>
              {filteredAppointments.map((appt) => (
                <EmployeeAssignmentTile
                  key={appt.id}
                  {...appt}
                  cleanerId={userId}
                  assigned={appt.employeesAssigned?.includes(String(userId))}
                  addEmployee={async () => {}}
                  removeEmployee={async () => {}}
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
