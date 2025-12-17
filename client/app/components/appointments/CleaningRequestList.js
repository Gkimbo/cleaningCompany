import { Picker } from "@react-native-picker/picker";
import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Dimensions,
  Pressable,
  Text,
  View,
} from "react-native";
import Icon from "react-native-vector-icons/FontAwesome";
import { useNavigate } from "react-router-native";
import FetchData from "../../services/fetchRequests/fetchData";
import getCurrentUser from "../../services/fetchRequests/getCurrentUser";
import homePageStyles from "../../services/styles/HomePageStyles";
import topBarStyles from "../../services/styles/TopBarStyles";
import UserFormStyles from "../../services/styles/UserInputFormStyle";
import RequestResponseTile from "./tiles/RequestResponseTile";

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

const CleaningRequestList = ({ state, dispatch }) => {
  const [userId, setUserId] = useState(null);
  const [userLocation, setUserLocation] = useState(null);
  const [appointmentLocations, setAppointmentLocations] = useState({});
  const [sortOption, setSortOption] = useState("dateNewest");
  const [seeCalendar, setSeeCalendar] = useState(false);
  const [loading, setLoading] = useState(true);
  const { width } = Dimensions.get("window");
  const iconSize = width < 400 ? 12 : width < 800 ? 16 : 20;

  const navigate = useNavigate();

  // Safely extract appointments (each request has a single appointment object, not an array)
  const appointmentArray = useMemo(() => {
    return (state.requests || [])
      .map((request) => request.appointment)
      .filter((appointment) => appointment && typeof appointment === 'object' && !Array.isArray(appointment));
  }, [state.requests]);

  // Fetch user ID
  useEffect(() => {
    const fetchUser = async () => {
      try {
        const response = await getCurrentUser();
        setUserId(response?.user?.id || null);
      } catch (error) {
        console.error("Error fetching user:", error);
      }
    };
    fetchUser();
  }, []);

  // Fetch appointment locations
  useEffect(() => {
    const fetchLocations = async () => {
      try {
        const locations = await Promise.all(
          appointmentArray.map(async (appointment) => {
            const loc = await FetchData.getLatAndLong(appointment.homeId);
            return { [appointment.homeId]: loc };
          })
        );
        setAppointmentLocations(Object.assign({}, ...locations));
      } catch (error) {
        console.error("Error fetching appointment locations:", error);
      }
    };
    if (appointmentArray.length > 0) fetchLocations();
  }, [appointmentArray]);

  // Get user geolocation
  useEffect(() => {
    if (!navigator.geolocation) {
      setLoading(false);
      return;
    }

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
  }, []);

  // Navigate to calendar
  useEffect(() => {
    if (seeCalendar) {
      navigate("/all-requests-calendar");
      setSeeCalendar(false);
    }
  }, [seeCalendar]);

  const pressedSeeCalendar = () => setSeeCalendar(true);

  // Sort and calculate distances
  const sortedRequests = useMemo(() => {
    if (!appointmentArray || appointmentArray.length === 0) return [];

    const mapped = appointmentArray.map((appointment) => {
      let distance = null;
      const loc = appointmentLocations[appointment.homeId];
      if (userLocation && loc) {
        distance = haversineDistance(
          userLocation.latitude,
          userLocation.longitude,
          loc.latitude,
          loc.longitude
        );
      }
      return { ...appointment, distance };
    });

    if (sortOption === "dateOldest") {
      mapped.sort((a, b) => new Date(a.date) - new Date(b.date));
    } else if (sortOption === "dateNewest") {
      mapped.sort((a, b) => new Date(b.date) - new Date(a.date));
    }

    return mapped;
  }, [appointmentArray, userLocation, appointmentLocations, sortOption]);

  return (
    <View
      style={{
        ...homePageStyles.container,
        flexDirection: "column",
        paddingTop: 20,
      }}
    >
      {appointmentArray.length > 0 ? (
        <>
          {/* Top buttons: Back + Calendar */}
          <View
            style={{
              ...homePageStyles.backButtonSelectNewJob,
              flexDirection: "row",
              justifyContent: "space-evenly",
            }}
          >
            <Pressable
              style={homePageStyles.backButtonForm}
              onPress={() => navigate("/")}
            >
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  padding: 10,
                }}
              >
                <Icon name="angle-left" size={iconSize} color="black" />
                <View style={{ marginLeft: 15 }}>
                  <Text style={topBarStyles.buttonTextSchedule}>Back</Text>
                </View>
              </View>
            </Pressable>

            <Pressable
              style={homePageStyles.backButtonForm}
              onPress={pressedSeeCalendar}
            >
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  padding: 10,
                }}
              >
                <View style={{ marginRight: 15 }}>
                  <Text style={topBarStyles.buttonTextSchedule}>Calendar</Text>
                </View>
                <Icon name="angle-right" size={iconSize} color="black" />
              </View>
            </Pressable>
          </View>

          {/* Sort picker */}
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
              <Picker.Item label="Sort by: Upcoming" value="dateNewest" />
              <Picker.Item label="Sort by: Furthest Out" value="dateOldest" />
            </Picker>
          </View>

          {/* Requests list */}
          {loading ? (
            <ActivityIndicator
              size="large"
              color="#0000ff"
              style={{ marginTop: 20 }}
            />
          ) : (
            <View style={{ flex: 1 }}>
              {sortedRequests.map((appointment) => (
                <RequestResponseTile
                  key={appointment.id}
                  id={appointment.id}
                  state={state}
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
                  approveRequest={async (
                    employeeId,
                    appointmentId,
                    requestId
                  ) => {
                    try {
                      dispatch({
                        type: "UPDATE_REQUEST_STATUS",
                        payload: {
                          employeeId,
                          appointmentId,
                          status: "approved",
                        },
                      });
                      await FetchData.approveRequest(requestId, true);
                    } catch (error) {
                      console.error("Error approving request:", error);
                    }
                  }}
                  denyRequest={async (employeeId, appointmentId) => {
                    try {
                      dispatch({
                        type: "UPDATE_REQUEST_STATUS",
                        payload: {
                          employeeId,
                          appointmentId,
                          status: "denied",
                        },
                      });
                      await FetchData.denyRequest(employeeId, appointmentId);
                    } catch (error) {
                      console.error("Error denying request:", error);
                    }
                  }}
                  undoRequest={async (employeeId, appointmentId) => {
                    try {
                      dispatch({
                        type: "UPDATE_REQUEST_STATUS",
                        payload: {
                          employeeId,
                          appointmentId,
                          status: "pending",
                        },
                      });
                      await FetchData.undoRequest(employeeId, appointmentId);
                    } catch (error) {
                      console.error("Error undoing request:", error);
                    }
                  }}
                />
              ))}
            </View>
          )}
        </>
      ) : (
        <Text
          style={{
            ...UserFormStyles.error,
            fontSize: 18, // slightly larger for readability
            color: "#333", // dark text for contrast
            marginVertical: 20, // reasonable spacing top and bottom
            textAlign: "center", // center text
            lineHeight: 24, // improves readability
          }}
        >
          You don’t have any cleaning requests
        </Text>
      )}
    </View>
  );
};

export default CleaningRequestList;
