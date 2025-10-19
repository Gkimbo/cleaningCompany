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
import RequestedTile from "../tiles/RequestedTile";

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

const MyRequestsCalendar = ({ state }) => {
  const [requests, setRequests] = useState([]);
  const [selectedDate, setSelectedDate] = useState(null);
  const [userId, setUserId] = useState(null);
  const [userLocation, setUserLocation] = useState(null);
  const [appointmentLocations, setAppointmentLocations] = useState({});
  const [filteredRequests, setFilteredRequests] = useState([]);
  const [sortOption, setSortOption] = useState("distanceClosest");
  const [showSortPicker, setShowSortPicker] = useState(false);
  const [loading, setLoading] = useState(true);

  const navigate = useNavigate();
  const { width } = Dimensions.get("window");
  const iconSize = width < 400 ? 12 : width < 800 ? 16 : 20;

  // Fetch requests
  useEffect(() => {
    const fetchRequests = async () => {
      try {
        const res = await FetchData.get(
          "/api/v1/users/appointments/employee",
          state.currentUser.token
        );
        setRequests(res.requested || []);

        const user = await getCurrentUser();
        setUserId(user.user.id);
      } catch (error) {
        console.error("Error fetching requests:", error);
      }
    };

    if (state.currentUser?.token) fetchRequests();
  }, [state.currentUser?.token]);

  // Get location
  useEffect(() => {
    if (navigator.geolocation) {
      const watcher = navigator.geolocation.watchPosition(
        (pos) =>
          setUserLocation({
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
          }),
        (err) => {
          console.error("Location error:", err);
          setUserLocation({ latitude: 0, longitude: 0 });
        },
        { enableHighAccuracy: true, timeout: 30000 }
      );

      return () => navigator.geolocation.clearWatch(watcher);
    }
  }, []);

  // Fetch distances
  useEffect(() => {
    const fetchDistances = async () => {
      if (!userLocation || requests.length === 0) {
        setLoading(false);
        return;
      }

      const locations = await Promise.all(
        requests.map(async (r) => {
          const loc = await FetchData.getLatAndLong(r.homeId);
          if (!loc) return null;
          const distance = haversineDistance(
            userLocation.latitude,
            userLocation.longitude,
            loc.latitude,
            loc.longitude
          );
          return { [r.homeId]: { location: loc, distance } };
        })
      );
      setAppointmentLocations(Object.assign({}, ...locations.filter(Boolean)));
      setLoading(false);
    };

    fetchDistances();
  }, [userLocation, requests]);

  // Sort helper
  const sortRequests = (list) => {
    return [...list].sort((a, b) => {
      const getDistance = (r) =>
        appointmentLocations[r.homeId]?.distance || Infinity;
      const getPrice = (r) => Number(r.price) || 0;

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

  const handleDateSelect = (date) => {
    setSelectedDate(date.dateString);

    const filtered = requests
      .filter((r) => r.date === date.dateString)
      .map((r) => ({
        ...r,
        distance: appointmentLocations[r.homeId]?.distance || null,
      }));

    setFilteredRequests(sortRequests(filtered));
  };

  useEffect(() => {
    if (selectedDate) handleDateSelect({ dateString: selectedDate });
  }, [sortOption]);

  const renderDay = useCallback(
    ({ date }) => {
      const today = new Date();
      const dayDate = new Date(date.dateString);
      const isPast = dayDate < new Date(today.toDateString());

      const hasData = requests.some((r) => r.date === date.dateString);
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
    [requests, selectedDate]
  );

  return (
    <ScrollView style={{ flex: 1, paddingBottom: 30 }}>
      {/* Top Buttons */}
      <View
        style={{
          flexDirection: "row",
          justifyContent: "center",
          marginTop: 40,
          marginBottom: 20,
          gap: 20,
        }}
      >
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
          onPress={() => navigate("/")}
        >
          <Icon name="angle-left" size={iconSize} color="#3498db" />
          <Text
            style={{
              ...topBarStyles.buttonTextSchedule,
              color: "#3498db",
              fontWeight: "600",
              marginLeft: 10,
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
          onPress={() => navigate("/my-requests")}
        >
          <Text
            style={{
              ...topBarStyles.buttonTextSchedule,
              color: "#3498db",
              fontWeight: "600",
              marginRight: 10,
            }}
          >
            List
          </Text>
          <Icon name="angle-right" size={iconSize} color="#3498db" />
        </Pressable>
      </View>

      <Text style={calenderStyles.title}>Tap a date to view your requests</Text>

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
          Sort by:{" "}
          {sortOption === "distanceClosest"
            ? "Distance (Closest)"
            : sortOption === "distanceFurthest"
            ? "Distance (Furthest)"
            : sortOption === "priceLow"
            ? "Price (Low)"
            : "Price (High)"}
        </Text>
        <Icon
          name={showSortPicker ? "angle-up" : "angle-down"}
          size={16}
          color="#3498db"
        />
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
          {[
            { label: "Distance (Closest)", value: "distanceClosest" },
            { label: "Distance (Furthest)", value: "distanceFurthest" },
            { label: "Price (Low to High)", value: "priceLow" },
            { label: "Price (High to Low)", value: "priceHigh" },
          ].map((item) => (
            <Pressable
              key={item.value}
              onPress={() => {
                setSortOption(item.value);
                setShowSortPicker(false);
              }}
            >
              <Text style={{ padding: 8, color: "#3498db", fontWeight: "500" }}>
                {item.label}
              </Text>
            </Pressable>
          ))}
        </View>
      )}

      {/* Display filtered requests */}
      {!selectedDate ? (
        <View
          style={{
            marginTop: 60,
            alignItems: "center",
            justifyContent: "center",
            padding: 24,
            backgroundColor: "rgba(52,152,219,0.05)",
            borderRadius: 16,
            marginHorizontal: 20,
            shadowColor: "#000",
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.08,
            shadowRadius: 4,
          }}
        >
          <Icon
            name="calendar"
            size={36}
            color="#3498db"
            style={{ marginBottom: 15, opacity: 0.9 }}
          />
          <Text
            style={{
              fontSize: 20,
              fontWeight: "700",
              color: "#2c3e50",
              marginBottom: 8,
              textAlign: "center",
            }}
          >
            Select a date to see your requests
          </Text>
          <Text
            style={{
              fontSize: 16,
              color: "#666",
              textAlign: "center",
              lineHeight: 22,
              maxWidth: 300,
            }}
          >
            Tap any highlighted date on the calendar to view pending job
            requests.
          </Text>
        </View>
      ) : loading ? (
        <ActivityIndicator
          size="large"
          color="#3498db"
          style={{ marginTop: 30 }}
        />
      ) : filteredRequests.length === 0 ? (
        <View
          style={{
            marginTop: 60,
            alignItems: "center",
            justifyContent: "center",
            padding: 24,
            backgroundColor: "rgba(52,152,219,0.05)",
            borderRadius: 16,
            marginHorizontal: 20,
            shadowColor: "#000",
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.08,
            shadowRadius: 4,
          }}
        >
          <Icon
            name="calendar-times-o"
            size={36}
            color="#999"
            style={{ marginBottom: 15, opacity: 0.8 }}
          />
          <Text
            style={{
              fontSize: 20,
              fontWeight: "700",
              color: "#444",
              marginBottom: 8,
              textAlign: "center",
            }}
          >
            No requests for this date
          </Text>
          <Text
            style={{
              fontSize: 16,
              color: "#666",
              textAlign: "center",
              lineHeight: 22,
              maxWidth: 300,
            }}
          >
            Try selecting a different date or check back later for updates.
          </Text>
        </View>
      ) : (
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingBottom: 60 }}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={calenderStyles.sectionTitle}>
            Requested Appointments
          </Text>
          {filteredRequests.map((req) => (
            <RequestedTile
              key={req.id}
              {...req}
              cleanerId={userId}
              removeRequest={async (employeeId, appointmentId) => {
                try {
                  await FetchData.removeRequest(employeeId, appointmentId);
                  setRequests((prev) =>
                    prev.filter((r) => r.id !== appointmentId)
                  );
                  setFilteredRequests((prev) =>
                    prev.filter((r) => r.id !== appointmentId)
                  );
                } catch (err) {
                  console.error("Error removing request:", err);
                }
              }}
            />
          ))}
        </ScrollView>
      )}
    </ScrollView>
  );
};

export default MyRequestsCalendar;
