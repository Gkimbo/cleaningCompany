import { Picker } from "@react-native-picker/picker";
import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Dimensions,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import Icon from "react-native-vector-icons/FontAwesome";
import { useNavigate } from "react-router-native";
import FetchData from "../../../services/fetchRequests/fetchData";
import getCurrentUser from "../../../services/fetchRequests/getCurrentUser";
import EmployeeAssignmentTile from "../tiles/EmployeeAssignmentTile";
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

const SelectNewJobList = ({ state }) => {
  const [allAppointments, setAllAppointments] = useState([]);
  const [allRequests, setAllRequests] = useState([]);
  const [userId, setUserId] = useState(null);
  const [userLocation, setUserLocation] = useState(null);
  const [appointmentLocations, setAppointmentLocations] = useState(null);
  const [sortOption, setSortOption] = useState("distanceClosest");
  const [seeCalender, setSeeCalender] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showSortPicker, setShowSortPicker] = useState(false);

  const { width } = Dimensions.get("window");
  const iconSize = width < 400 ? 12 : width < 800 ? 16 : 20;
  const navigate = useNavigate();

const sortLabelMap = {
  distanceClosest: "Distance (Closest)",
  distanceFurthest: "Distance (Furthest)",
  priceLow: "Price (Low → High)",
  priceHigh: "Price (High → Low)",
};

  const requestsAndAppointments = useMemo(() => {
    const requestsWithFlag = allRequests.map((item) => ({
      ...item,
      isRequest: true,
    }));
    const appointmentsWithFlag = allAppointments.map((item) => ({
      ...item,
      isRequest: false,
    }));
    return [...requestsWithFlag, ...appointmentsWithFlag];
  }, [allRequests, allAppointments]);

  useEffect(() => {
    const fetchAppointments = async () => {
      try {
        const response = await FetchData.get(
          "/api/v1/users/appointments/employee",
          state.currentUser.token
        );
        const now = new Date();

        const isUpcoming = (item) => {
          const itemDate = new Date(item.date);
          return itemDate >= now;
        };

        setAllAppointments((response.appointments || []).filter(isUpcoming));
        setAllRequests((response.requested || []).filter(isUpcoming));
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
          [...allAppointments, ...allRequests].map(async (appointment) => {
            const response = await FetchData.getLatAndLong(appointment.homeId);
            return { [appointment.homeId]: response };
          })
        );
        setAppointmentLocations(Object.assign({}, ...locations));
      } catch (error) {
        console.error("Error fetching appointment locations:", error);
      }
    };

    if (allAppointments.length > 0 || allRequests.length > 0) {
      fetchLocations();
    }
  }, [allAppointments, allRequests]);

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
    if (seeCalender) {
      navigate("/appointment-calender");
      setSeeCalender(false);
    }
  }, [seeCalender]);

  const pressedSeeCalender = () => setSeeCalender(true);

  const sortedData = useMemo(() => {
    const processed = requestsAndAppointments.map((appointment) => {
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

    const sortFn = {
      distanceClosest: (a, b) =>
        (a.distance ?? Infinity) - (b.distance ?? Infinity),
      distanceFurthest: (a, b) => (b.distance ?? 0) - (a.distance ?? 0),
      priceLow: (a, b) => (Number(a.price) || 0) - (Number(b.price) || 0),
      priceHigh: (a, b) => (Number(b.price) || 0) - (Number(a.price) || 0),
    };

    const sorted = [...processed].sort((a, b) => {
      const primary = sortFn[sortOption]?.(a, b) ?? 0;
      if (primary === 0) {
        return a.id > b.id ? 1 : -1; // Stable fallback using ID
      }
      return primary;
    });

    return sorted;
  }, [requestsAndAppointments, userLocation, appointmentLocations, sortOption]);

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: "#f8f9fa",
        paddingHorizontal: 16,
        paddingTop: 60, // more space from top bar
      }}
    >
      {/* --- Top Navigation Buttons --- */}
      <View
        style={{
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 25,
        }}
      >
        <Pressable
          style={styles.navButton}
          onPress={() => navigate("/")}
        >
          <Icon name="angle-left" size={iconSize + 4} color="#111" />
          <Text style={styles.navButtonText}>Back</Text>
        </Pressable>
  
        <Pressable
          style={styles.navButton}
          onPress={pressedSeeCalender}
        >
          <Text style={styles.navButtonText}>Calendar</Text>
          <Icon name="calendar" size={iconSize} color="#111" style={{ marginLeft: 8 }} />
        </Pressable>
      </View>
  
   {/* --- Sort Button & Picker Modal --- */}
<View style={styles.sortContainer}>
  <Pressable style={styles.sortButton} onPress={() => setShowSortPicker(true)}>
    <Icon name="sort" size={16} color="#3da9fc" />
    <Text style={styles.sortButtonText}>
      {sortLabelMap[sortOption] || "Sort Jobs"}
    </Text>
  </Pressable>

  {showSortPicker && (
  <View style={styles.pickerOverlay}>
    <View style={styles.bottomSheet}>
      <View style={styles.sheetHeader}>
        <Text style={styles.sheetTitle}>Sort Jobs By</Text>
        <Pressable onPress={() => setShowSortPicker(false)}>
          <Text style={styles.doneButtonText}>Done</Text>
        </Pressable>
      </View>

      <View style={styles.pickerContainer}>
        <Picker
          selectedValue={sortOption}
          onValueChange={(itemValue) => setSortOption(itemValue)}
          itemStyle={{ fontSize: 18, height: 150 }} // Makes it easier to scroll and tap
        >
          <Picker.Item label="Distance (Closest)" value="distanceClosest" />
          <Picker.Item label="Distance (Furthest)" value="distanceFurthest" />
          <Picker.Item label="Price (Low → High)" value="priceLow" />
          <Picker.Item label="Price (High → Low)" value="priceHigh" />
        </Picker>
      </View>
    </View>
  </View>
)}

</View>


  
      {/* --- Loading / Empty States --- */}
      {loading ? (
        <ActivityIndicator
          size="large"
          color="#007AFF"
          style={{ marginTop: 30 }}
        />
      ) : sortedData.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyTitle}>No appointments yet</Text>
          <Text style={styles.emptyText}>
            Check back later to see upcoming jobs or new requests.
          </Text>
        </View>
      ) : (
        /* --- Scrollable Job List --- */
        <ScrollView
          style={{ marginTop: 10 }}
          showsVerticalScrollIndicator={false}
        >
          {sortedData.map((appointment) => (
            <View key={appointment.id} style={styles.tileWrapper}>
              {appointment.isRequest ? (
                <RequestedTile
                  {...appointment}
                  cleanerId={userId}
                  removeRequest={async (employeeId, appointmentId) => {
                    try {
                      await FetchData.removeRequest(employeeId, appointmentId);
                      setAllRequests((prev) => {
                        const removed = prev.find((a) => a.id === appointmentId);
                        if (!removed) return prev;
                        setAllAppointments((apps) => [...apps, removed]);
                        return prev.filter((a) => a.id !== appointmentId);
                      });
                    } catch (err) {
                      console.error("Error removing request:", err);
                    }
                  }}
                />
              ) : (
                <EmployeeAssignmentTile
                  {...appointment}
                  cleanerId={userId}
                  assigned={
                    appointment.employeesAssigned?.includes(String(userId)) ||
                    false
                  }
                  addEmployee={async (employeeId, appointmentId) => {
                    try {
                      await FetchData.addEmployee(employeeId, appointmentId);
                      setAllAppointments((prev) => {
                        const assigned = prev.find((a) => a.id === appointmentId);
                        if (!assigned) return prev;
                        setAllRequests((reqs) => [...reqs, assigned]);
                        return prev.filter((a) => a.id !== appointmentId);
                      });
                    } catch (err) {
                      console.error("Error adding employee:", err);
                    }
                  }}
                  removeEmployee={async (employeeId, appointmentId) => {
                    try {
                      await FetchData.removeEmployee(employeeId, appointmentId);
                      setAllAppointments((prev) =>
                        prev.map((a) =>
                          a.id === appointmentId
                            ? {
                                ...a,
                                employeesAssigned: a.employeesAssigned?.filter(
                                  (id) => id !== String(employeeId)
                                ),
                              }
                            : a
                        )
                      );
                    } catch (err) {
                      console.error("Error removing employee:", err);
                    }
                  }}
                />
              )}
            </View>
          ))}
        </ScrollView>
      )}
    </View>
  );
  
};
const styles = {
  navButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 14,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 5,
    elevation: 3,
  },
  navButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#111",
    marginLeft: 8,
  },
  sortContainer: {
    backgroundColor: "#fff",
    borderRadius: 10,
    paddingVertical: 4,
    paddingHorizontal: 10,
    marginBottom: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  sortLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: "#444",
    marginRight: 8,
  },
  picker: {
    flex: 1,
    height: 32,
    transform: [{ scale: 0.9 }],
    color: "#333",
  },
  sortContainer: {
    alignItems: "flex-end",
    marginBottom: 15,
    marginRight: 15,
  },
  sortButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f2f6fa",
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  sortButtonText: {
    marginLeft: 8,
    fontSize: 14,
    color: "#3da9fc",
    fontWeight: "600",
  },
  pickerOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "center",
    alignItems: "center",
  },
  pickerModal: {
    backgroundColor: "#fff",
    width: "80%",
    borderRadius: 12,
    padding: 20,
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 10,
    textAlign: "center",
  },sortContainer: {
    alignItems: "flex-end",
    marginBottom: 15,
    marginRight: 15,
  },
  sortButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f2f6fa",
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  sortButtonText: {
    marginLeft: 8,
    fontSize: 14,
    color: "#3da9fc",
    fontWeight: "600",
  },

  // Picker overlay and bottom sheet
  pickerOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "flex-end",
  },
  bottomSheet: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    paddingBottom: 30,
    shadowColor: "#000",
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 10,
  },
  sheetHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
  },
  sheetTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#333",
  },
  doneButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#3da9fc",
  },
  pickerContainer: {
    backgroundColor: "#fff",
    justifyContent: "center",
  },
  closeButton: {
    backgroundColor: "#3da9fc",
    marginTop: 10,
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: "center",
  },
  closeButtonText: {
    color: "white",
    fontWeight: "600",
    fontSize: 14,
  },
  
  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    marginTop: 50,
    padding: 20,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#333",
    marginBottom: 10,
  },
  emptyText: {
    fontSize: 15,
    color: "#666",
    textAlign: "center",
    lineHeight: 22,
  },
  tileWrapper: {
    marginBottom: 15,
    borderRadius: 14,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
};


export default SelectNewJobList;
