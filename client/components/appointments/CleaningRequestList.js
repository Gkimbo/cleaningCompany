import React, { useState, useEffect, useMemo } from "react";
import {
  Pressable,
  View,
  Text,
  Dimensions,
  ActivityIndicator,
} from "react-native";
import { useNavigate } from "react-router-native";
import { Picker } from "@react-native-picker/picker";
import homePageStyles from "../../services/styles/HomePageStyles";
import Icon from "react-native-vector-icons/FontAwesome";
import topBarStyles from "../../services/styles/TopBarStyles";
import FetchData from "../../services/fetchRequests/fetchData";
import getCurrentUser from "../../services/fetchRequests/getCurrentUser";
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

const CleaningRequestList = ({ state }) => {
  const [userId, setUserId] = useState(null);
  const [userLocation, setUserLocation] = useState(null);
  const [appointmentLocations, setAppointmentLocations] = useState(null);
  const [sortOption, setSortOption] = useState("dateNewest");
  const [seeCalender, setSeeCalender] = useState(false);
  const [loading, setLoading] = useState(true);
  const { width } = Dimensions.get("window");
  const iconSize = width < 400 ? 12 : width < 800 ? 16 : 20;
  const appointmentArray = useMemo(() => state.requests.map(request => request.appointment) || [], [state]);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const response = await getCurrentUser();
        setUserId(response.user.id);
      } catch (error) {
        console.error("Error fetching user:", error);
      }
    };
    fetchUser();
  }, []);

  useEffect(() => {
    const fetchLocations = async () => {
      try {
        const locations = await Promise.all(
          appointmentArray.map(async (appointment) => {
            const response = await FetchData.getLatAndLong(appointment.homeId);
            return { [appointment.homeId]: response };
          }),
        );
        setAppointmentLocations(Object.assign({}, ...locations));
        
      } catch (error) {
        console.error("Error fetching appointment locations:", error);
      }
    };

    if (appointmentArray.length > 0) {
      fetchLocations();
    }
  }, [appointmentArray]);

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
      navigate("/my-requests-calendar");
      setSeeCalender(false);
    }
  }, [seeCalender]);

  const pressedSeeCalender = () => {
    setSeeCalender(true);
  };

  const sortedRequests = useMemo(() => {
    let sorted = appointmentArray.map((appointment) => {
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
        setLoading(false);
      }
  
      return { ...appointment, distance };
    });
  
    if (sortOption === "dateOldest") {
      sorted.sort((a, b) => new Date(b.date) - new Date(a.date));
    } else if (sortOption === "dateNewest") {
      sorted.sort((a, b) => new Date(a.date) - new Date(b.date));
    }
  
    return sorted;
  }, [appointmentArray, userLocation, appointmentLocations, sortOption]);
  

  return (
    <View
      style={{
        ...homePageStyles.container,
        flexDirection: "column",
        marginTop: "27%",
      }}
    >
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
            style={{ flexDirection: "row", alignItems: "center", padding: 10 }}
          >
            <Icon name="angle-left" size={iconSize} color="black" />
            <View style={{ marginLeft: 15 }}>
              <Text style={topBarStyles.buttonTextSchedule}>Back</Text>
            </View>
          </View>
        </Pressable>
        <Pressable
          style={homePageStyles.backButtonForm}
          onPress={pressedSeeCalender}
        >
          <View
            style={{ flexDirection: "row", alignItems: "center", padding: 10 }}
          >
            <View style={{ marginRight: 15 }}>
              <Text style={topBarStyles.buttonTextSchedule}>Calender</Text>
            </View>
            <Icon name="angle-right" size={iconSize} color="black" />
          </View>
        </Pressable>
      </View>

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
            label="Sort by: Upcoming"
            value="dateNewest"
          />
          <Picker.Item
            label="Sort by: Furthest Out"
            value="dateOldest"
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
        <View style={{ flex: 1 }}>
          {sortedRequests.map((appointment) => (
            <View key={appointment.id}>
              <RequestResponseTile
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
                approveRequest={async (employeeId, appointmentId) => {
                //   try {
                //     await FetchData.approveRequest(employeeId, appointmentId);
                //     appointmentArray((prevRequests) => {
                //       const removedAppointment = prevRequests.find(
                //         (appointment) => appointment.id === appointmentId
                //       );
                //       if (!removedAppointment) return prevRequests;
                //       return prevRequests.filter((appointment) => appointment.id !== appointmentId);
                //     });
                //   } catch (error) {
                //     console.error("Error removing request:", error);
                //   }
                }}
                denyRequest={async (employeeId, appointmentId) => {
                    // try {
                    //   await FetchData.denyRequest(employeeId, appointmentId);
                    //   appointmentArray((prevRequests) => {
                    //     const removedAppointment = prevRequests.find(
                    //       (appointment) => appointment.id === appointmentId
                    //     );
                    //     if (!removedAppointment) return prevRequests;
                    //     return prevRequests.filter((appointment) => appointment.id !== appointmentId);
                    //   });
                    // } catch (error) {
                    //   console.error("Error removing request:", error);
                    // }
                  }}                                
              />
            </View>
          ))}
        </View>
      )}
    </View>
  );
};

export default CleaningRequestList;
