import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Dimensions,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import Icon from "react-native-vector-icons/FontAwesome";
import { useNavigate } from "react-router-native";
import FetchData from "../../../services/fetchRequests/fetchData";
import getCurrentUser from "../../../services/fetchRequests/getCurrentUser";
import EmployeeAssignmentTile from "../tiles/EmployeeAssignmentTile";

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

const EmployeeAssignmentsList = ({ state, dispatch }) => {
  const [allAppointments, setAllAppointments] = useState([]);
  const [userLocation, setUserLocation] = useState(null);
  const [appointmentLocations, setAppointmentLocations] = useState(null);
  const [sortOption, setSortOption] = useState("distanceClosest");
  const [loading, setLoading] = useState(true);
  const [redirectToJobs, setRedirectToJobs] = useState(false);
  const [refresh, setRefresh] = useState(false);
  const [userId, setUserId] = useState(null);
  const [showSortPicker, setShowSortPicker] = useState(false);

  const { width } = Dimensions.get("window");
  const iconSize = width < 400 ? 12 : width < 800 ? 16 : 20;
  const navigate = useNavigate();

  const fetchUser = async () => {
    const response = await getCurrentUser();
    setUserId(response.user.id);
  };

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
          setLoading(false);
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
      );
      return () => navigator.geolocation.clearWatch(watcher);
    }
  }, []);

  useEffect(() => {
    if (state.currentUser.token) {
      FetchData.get("/api/v1/employee-info", state.currentUser.token).then(
        (response) => {
          const appointments = response.employee.cleanerAppointments;
          dispatch({
            type: "USER_APPOINTMENTS",
            payload: appointments,
          });
          setAllAppointments(appointments);
        }
      );
    }
    fetchUser();

    if (refresh) setRefresh(false);
  }, [state.currentUser.token, refresh]);

  useEffect(() => {
    if (redirectToJobs) {
      navigate("/new-job-choice");
      setRedirectToJobs(false);
    }
  }, [redirectToJobs]);

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
    if (allAppointments.length > 0) fetchLocations();
  }, [allAppointments]);

  useEffect(() => {
    if (
      allAppointments.length > 0 &&
      userLocation &&
      appointmentLocations
    ) {
      setLoading(false);
    }
  }, [userLocation, appointmentLocations, allAppointments]);

  const sortedAppointments = useMemo(() => {
    let sorted = allAppointments.map((appointment) => {
      let distance = null;

      if (
        userLocation &&
        appointmentLocations &&
        appointmentLocations[appointment.homeId]
      ) {
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

    if (sortOption === "distanceClosest") {
      sorted.sort((a, b) => (a.distance || Infinity) - (b.distance || Infinity));
    } else if (sortOption === "distanceFurthest") {
      sorted.sort((a, b) => (b.distance || 0) - (a.distance || 0));
    } else if (sortOption === "priceLow") {
      sorted.sort((a, b) => (Number(a.price) || 0) - (Number(b.price) || 0));
    } else if (sortOption === "priceHigh") {
      sorted.sort((a, b) => (Number(b.price) || 0) - (Number(a.price) || 0));
    }

    return sorted;
  }, [allAppointments, userLocation, appointmentLocations, sortOption]);

  const removeEmployee = async (employeeId, appointmentId) => {
    await FetchData.removeEmployee(employeeId, appointmentId);
    setRefresh(true);
  };

  const addEmployee = async (employeeId, appointmentId) => {
    await FetchData.addEmployee(employeeId, appointmentId);
    setRefresh(true);
  };

  const assignedAppointments = sortedAppointments
    .filter((appointment) =>
      appointment.employeesAssigned.includes(String(userId))
    )
    .map((appointment) => (
      <EmployeeAssignmentTile
        key={appointment.id}
        id={appointment.id}
        cleanerId={userId}
        date={appointment.date}
        price={appointment.price}
        homeId={appointment.homeId}
        bringSheets={appointment.bringSheets}
        bringTowels={appointment.bringTowels}
        completed={appointment.completed}
        keyPadCode={appointment.keyPadCode}
        keyLocation={appointment.keyLocation}
        addEmployee={addEmployee}
        removeEmployee={removeEmployee}
        assigned={true}
        distance={appointment.distance}
        timeToBeCompleted={appointment.timeToBeCompleted}
      />
    ));

  return (
    <View style={styles.container}>
      {/* Top Buttons */}
      <View style={styles.topButtonRow}>
        <Pressable style={styles.glassButton} onPress={() => navigate("/")}>
          <Icon name="angle-left" size={iconSize} color="#007AFF" />
          <Text style={styles.glassButtonText}>Back</Text>
        </Pressable>

        <Pressable
          style={styles.glassButton}
          onPress={() => navigate("/my-appointment-calender")}
        >
          <Text style={styles.glassButtonText}>Calendar</Text>
          <Icon name="angle-right" size={iconSize} color="#007AFF" />
        </Pressable>
      </View>

      {/* Sort Button */}
      <Pressable
        style={styles.sortButton}
        onPress={() => setShowSortPicker(!showSortPicker)}
      >
        <Text style={styles.sortText}>
          Sort by:{" "}
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
          size={20}
          color="#007AFF"
        />
      </Pressable>

      {showSortPicker && (
        <View style={styles.sortOptions}>
          <Pressable onPress={() => setSortOption("distanceClosest")} style={styles.option}>
            <Text>Distance (Closest)</Text>
          </Pressable>
          <Pressable onPress={() => setSortOption("distanceFurthest")} style={styles.option}>
            <Text>Distance (Furthest)</Text>
          </Pressable>
          <Pressable onPress={() => setSortOption("priceLow")} style={styles.option}>
            <Text>Price (Low to High)</Text>
          </Pressable>
          <Pressable onPress={() => setSortOption("priceHigh")} style={styles.option}>
            <Text>Price (High to Low)</Text>
          </Pressable>
        </View>
      )}

      {loading ? (
        <ActivityIndicator size="large" color="#007AFF" />
      ) : assignedAppointments.length > 0 ? (
        <ScrollView style={{ marginTop: 10 }}>{assignedAppointments}</ScrollView>
      ) : (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>You have no jobs scheduled.</Text>
          <Pressable onPress={() => setRedirectToJobs(true)}>
            <Text style={styles.linkText}>Schedule jobs HERE!</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, padding: 15, backgroundColor: "#F8F9FB" },
  topButtonRow: { flexDirection: "row", justifyContent: "space-around", marginBottom: 15 },
  glassButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(0,122,255,0.1)",
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(0,122,255,0.3)",
    gap: 8,
  },
  glassButtonText: { color: "#007AFF", fontWeight: "600", fontSize: 16 },
  sortButton: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "rgba(0,122,255,0.1)",
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(0,122,255,0.3)",
    marginBottom: 10,
  },
  sortText: { color: "#007AFF", fontWeight: "600", fontSize: 15 },
  sortOptions: {
    backgroundColor: "#fff",
    borderRadius: 12,
    paddingVertical: 5,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.1)",
  },
  option: {
    paddingVertical: 10,
    paddingHorizontal: 15,
  },
  emptyContainer: { alignItems: "center", marginTop: 50 },
  emptyText: { fontSize: 18, fontWeight: "600", marginBottom: 10, color: "#1E1E1E" },
  linkText: { fontSize: 16, color: "#007AFF", fontWeight: "700" },
});

export default EmployeeAssignmentsList;

