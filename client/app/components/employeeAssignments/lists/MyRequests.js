import { Picker } from "@react-native-picker/picker";
import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Dimensions,
  Pressable,
  ScrollView,
  Text,
  View
} from "react-native";
import Icon from "react-native-vector-icons/FontAwesome";
import { useNavigate } from "react-router-native";
import FetchData from "../../../services/fetchRequests/fetchData";
import getCurrentUser from "../../../services/fetchRequests/getCurrentUser";
import homePageStyles from "../../../services/styles/HomePageStyles";
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

const MyRequests = ({ state }) => {
  const [allRequests, setAllRequests] = useState([]);
  const [userId, setUserId] = useState(null);
  const [userLocation, setUserLocation] = useState(null);
  const [appointmentLocations, setAppointmentLocations] = useState(null);
  const [sortOption, setSortOption] = useState("distanceClosest");
  const [showSortPicker, setShowSortPicker] = useState(false);
  const [loading, setLoading] = useState(true);
  const [redirectToJobs, setRedirectToJobs] = useState(false);

  const { width } = Dimensions.get("window");
  const iconSize = width < 400 ? 12 : width < 800 ? 16 : 20;
  const navigate = useNavigate();

  // ✅ Function to open the calendar
  const pressedSeeCalendar = () => {
    navigate("/my-requests-calendar");
  };

  // ✅ Function to toggle sort picker
  const toggleSortPicker = () => setShowSortPicker((prev) => !prev);

  useEffect(() => {
    const fetchRequests = async () => {
      try {
        const response = await FetchData.get(
          "/api/v1/users/appointments/employee",
          state.currentUser.token
        );
        setAllRequests(response.requested || []);
      } catch (error) {
        console.error("Error fetching requests:", error);
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

    fetchRequests();
    fetchUser();
  }, []);

  useEffect(() => {
    const fetchLocations = async () => {
      try {
        const locations = await Promise.all(
          allRequests.map(async (appointment) => {
            const response = await FetchData.getLatAndLong(appointment.homeId);
            return { [appointment.homeId]: response };
          })
        );
        setAppointmentLocations(Object.assign({}, ...locations));
      } catch (error) {
        console.error("Error fetching appointment locations:", error);
      }
    };

    if (allRequests.length > 0) fetchLocations();
  }, [allRequests]);

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
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
      );
      return () => navigator.geolocation.clearWatch(watcher);
    } else {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (redirectToJobs) {
      navigate("/new-job-choice");
      setRedirectToJobs(false);
    }
  }, [redirectToJobs]);

  const sortedRequests = useMemo(() => {
    const processed = allRequests.map((appointment) => {
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

    const sortFn = {
      distanceClosest: (a, b) => (a.distance ?? Infinity) - (b.distance ?? Infinity),
      distanceFurthest: (a, b) => (b.distance ?? 0) - (a.distance ?? 0),
      priceLow: (a, b) => (Number(a.price) || 0) - (Number(b.price) || 0),
      priceHigh: (a, b) => (Number(b.price) || 0) - (Number(a.price) || 0),
    };

    return [...processed].sort((a, b) => {
      const primary = sortFn[sortOption]?.(a, b) ?? 0;
      return primary === 0 ? (a.id > b.id ? 1 : -1) : primary;
    });
  }, [allRequests, userLocation, appointmentLocations, sortOption]);

  return (
    <View
      style={{
        ...homePageStyles.container,
        flexDirection: "column",
        marginTop: "27%",
      }}
    >
  {/* First row: Back & Calendar */}
<View style={{ flexDirection: "row", justifyContent: "space-around", marginHorizontal: 10, marginTop: 10 }}>
  {/* Back Button */}
  <Pressable
    onPress={() => navigate("/")}
    style={{
      flex: 1,
      marginRight: 5,
      flexDirection: "row",
      justifyContent: "center",
      alignItems: "center",
      paddingVertical: 10,
      borderRadius: 15,
      backgroundColor: "rgba(0,123,255,0.2)", // glassy blue
      borderWidth: 1,
      borderColor: "rgba(0,123,255,0.3)",
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 3,
    }}
  >
    <Icon name="angle-left" size={18} color="#007BFF" />
    <Text style={{ color: "#007BFF", fontWeight: "600", marginLeft: 8 }}>Back</Text>
  </Pressable>

  {/* Calendar Button */}
  <Pressable
    onPress={pressedSeeCalendar}
    style={{
      flex: 1,
      marginLeft: 5,
      flexDirection: "row",
      justifyContent: "center",
      alignItems: "center",
      paddingVertical: 10,
      borderRadius: 15,
      backgroundColor: "rgba(0,123,255,0.2)", // glassy blue
      borderWidth: 1,
      borderColor: "rgba(0,123,255,0.3)",
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 3,
    }}
  >
    <Text style={{ color: "#007BFF", fontWeight: "600", marginRight: 8 }}>Calendar</Text>
    <Icon name="angle-right" size={18} color="#007BFF" />
  </Pressable>
</View>


{/* Second row: Sort button */}
<View
  style={{
    marginHorizontal: 20,
    marginBottom: 15,
  }}
>
<Pressable
  onPress={() => setShowSortPicker(!showSortPicker)}
  style={{
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 10,
    paddingHorizontal: 15,
    marginHorizontal: 10,
    marginTop: 10,
    borderRadius: 15,
    backgroundColor: "rgba(255,255,255,0.2)", // glass-like transparency
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.3)",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  }}
>
  <Text style={{ color: "#1E1E1E", fontWeight: "600" }}>
    {sortOption === "distanceClosest"
      ? "Distance (Closest)"
      : sortOption === "distanceFurthest"
      ? "Distance (Furthest)"
      : sortOption === "priceLow"
      ? "Price (Low to High)"
      : "Price (High to Low)"}
  </Text>
  <Icon
    name={showSortPicker ? "angle-up" : "angle-down"}
    size={18} // slightly smaller
    color="#1E1E1E"
  />
</Pressable>

  {/* Picker beneath Sort button */}
  {showSortPicker && (
    <View
      style={{
        marginTop: 10,
        borderRadius: 12,
        backgroundColor: "#fff",
        borderWidth: 1,
        borderColor: "#ddd",
        maxHeight: 200,
        overflow: "hidden",
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 4,
        elevation: 4,
      }}
    >
      <Picker
        selectedValue={sortOption}
        onValueChange={(itemValue) => {
          setSortOption(itemValue);
          setShowSortPicker(false);
        }}
        style={{ color: "#1E1E1E" }}
      >
        <Picker.Item label="Distance (Closest)" value="distanceClosest" />
        <Picker.Item label="Distance (Furthest)" value="distanceFurthest" />
        <Picker.Item label="Price (Low to High)" value="priceLow" />
        <Picker.Item label="Price (High to Low)" value="priceHigh" />
      </Picker>
    </View>
  )}
</View>

      {/* Requests List */}
      {loading ? (
        <ActivityIndicator size="large" color="#0000ff" style={{ marginTop: 20 }} />
      ) : sortedRequests.length === 0 ? (
        <View style={{ marginTop: 50, alignItems: "center", padding: 20 }}>
          <Text style={{ fontSize: 18, fontWeight: "600", color: "#444", marginBottom: 10 }}>
            You have no jobs requested.
          </Text>
          <Text style={{ fontSize: 16, color: "#666", textAlign: "center", lineHeight: 22 }}>
            Request jobs <Text style={{ color: "#007AFF", fontWeight: "700" }}>HERE!</Text>
          </Text>
        </View>
      ) : (
        <ScrollView>
          {sortedRequests.map((appointment) => (
            <RequestedTile
              key={appointment.id}
              {...appointment}
              cleanerId={userId}
              distance={appointment.distance}
              removeRequest={async (employeeId, appointmentId) => {
                try {
                  await FetchData.removeRequest(employeeId, appointmentId);
                  setAllRequests((prev) =>
                    prev.filter((a) => a.id !== appointmentId)
                  );
                } catch (error) {
                  console.error(error);
                }
              }}
            />
          ))}
        </ScrollView>
      )}
    </View>
  );
};

export default MyRequests;
