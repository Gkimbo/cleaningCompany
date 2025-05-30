import React, { useState, useEffect, useMemo } from "react";
import { Pressable, View, Text, ScrollView, Dimensions, ActivityIndicator } from "react-native";
import { useNavigate } from "react-router-native";
import homePageStyles from "../../../services/styles/HomePageStyles";
import Icon from "react-native-vector-icons/FontAwesome";
import topBarStyles from "../../../services/styles/TopBarStyles";
import FetchData from "../../../services/fetchRequests/fetchData";
import EmployeeAssignmentTile from "../tiles/EmployeeAssignmentTile";
import getCurrentUser from "../../../services/fetchRequests/getCurrentUser";

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
  const [refresh, setRefresh] = useState(false);
  const [userId, setUserId] = useState(null);
  const { width } = Dimensions.get("window");
  const iconSize = width < 400 ? 12 : width < 800 ? 16 : 20;
  const navigate = useNavigate();

  const fetchUser = async () => {
    const response = await getCurrentUser();
    setUserId(response.user.id);
  };

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
        setLoading(false);
      }
      return { ...appointment, distance };
    });

    if (sortOption === "distanceClosest") {
      sorted.sort(
        (a, b) => (a.distance || Infinity) - (b.distance || Infinity)
      );
    } else if (sortOption === "distanceFurthest") {
      sorted.sort((a, b) => (b.distance || 0) - (a.distance || 0));
    } else if (sortOption === "priceLow") {
      sorted.sort((a, b) => (Number(a.price) || 0) - (Number(b.price) || 0));
    } else if (sortOption === "priceHigh") {
      sorted.sort((a, b) => (Number(b.price) || 0) - (Number(a.price) || 0));
    }

    return sorted;
  }, [allAppointments, userLocation, appointmentLocations, sortOption]);

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
          setLoading(false);
          console.error("Error getting location:", error);
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
          dispatch({
            type: "USER_APPOINTMENTS",
            payload: response.employee.cleanerAppointments,
          });
          setAllAppointments(response.employee.cleanerAppointments);
        }
      );
    }
    fetchUser();
    
    if(refresh){
      setRefresh(false)
    }
  }, [state.currentUser.token, refresh]);

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

    if (allAppointments.length > 0) {
      fetchLocations();
    }
  }, [allAppointments]);
  const handlePress = () => {
    setRedirect(true);
  };

  const handleBackPress = () => {
    setBackRedirect(true);
  };

  const handlePressToJobsList = () => {
    setRedirectToJobs(true);
  };

  const removeEmployee = async (employeeId, appointmentId) => {
    const employeeRemoved = await FetchData.removeEmployee(
      employeeId,
      appointmentId
    );
    setRefresh(true);
  };

  const addEmployee = async (employeeId, appointmentId) => {
    const employeeAdded = await FetchData.addEmployee(
      employeeId,
      appointmentId
    );
    setRefresh(true);
  };

  const assignedAppointments = sortedAppointments.map((appointment) => {
    let isAssigned = appointment.employeesAssigned.includes(String(userId));

    return (
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
          addEmployee={addEmployee}
          removeEmployee={removeEmployee}
          assigned={isAssigned}
          distance={appointment.distance}
          timeToBeCompleted={appointment.timeToBeCompleted}
        />
      </View>
    );
  });

  return (
    <View
      style={{
        ...homePageStyles.container,
        flexDirection: "column",
      }}
    >
       <View
        style={{
          ...homePageStyles.backButtonSelectNewJobList,
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
          onPress={() => navigate("/my-appointment-calender")}
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

      {loading ? (
        <ActivityIndicator size="large" color="#0000ff" />
      ) : sortedAppointments.length ? (
        assignedAppointments
      ) : (
        <>
          <Text style={[homePageStyles.title, { fontSize: 18, fontWeight: "600", color: "#1E1E1E", textAlign: "center", letterSpacing: 0.5 }]}>
            You have no jobs scheduled.
          </Text>
          <Text
            style={[homePageStyles.homeTileTitle, { fontSize: 18, fontWeight: "600", color: "#1E1E1E", textAlign: "center", letterSpacing: 0.5 }]}
          >
            Schedule jobs
            <Pressable
              onPress={handlePressToJobsList}
              style={({ pressed }) => [
                {
                  textDecorationLine: pressed ? "underline" : "none",
                  color: pressed ? "#FF6B00" : "#007AFF",
                  fontWeight: "700",
                },
              ]}
            >
              <Text>{` HERE! `}</Text>
            </Pressable>
          </Text>
        </>
      )}
    </View>
  );
};

export default EmployeeAssignmentsList;
