import React, { useEffect, useState } from "react";
import {
  Animated,
  Dimensions,
  Easing,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import Icon from "react-native-vector-icons/FontAwesome";
import { useNavigate } from "react-router-native";
import Appointment from "../../services/fetchRequests/AppointmentClass";
import FetchData from "../../services/fetchRequests/fetchData";
import homePageStyles from "../../services/styles/HomePageStyles";
import topBarStyles from "../../services/styles/TopBarStyles";
import AppointmentTile from "../tiles/AppointmentTile";

// Helper: group appointments by homeId
const groupAppointmentsByHome = (appointments) => {
  const groupedByHome = new Map();
  for (const appointment of appointments) {
    if (!appointment.employeesAssigned) {
      appointment.employeesAssigned = [];
    }
    const homeId = appointment.homeId;
    if (!groupedByHome.has(homeId)) {
      groupedByHome.set(homeId, []);
    }
    groupedByHome.get(homeId).push(appointment);
  }
  return groupedByHome;
};

const AllAppointments = ({ state }) => {
  const [allAppointments, setAllAppointments] = useState([]);
  const [backRedirect, setBackRedirect] = useState(false);
  const [deleteAnimation] = useState(new Animated.Value(0));
  const [deleteConfirmation, setDeleteConfirmation] = useState({});
  const { width } = Dimensions.get("window");
  const iconSize = width < 400 ? 12 : width < 800 ? 16 : 20;
  const navigate = useNavigate();

  // Fetch appointments from API
  const fetchAppointments = async () => {
    try {
      const response = await FetchData.get(
        "/api/v1/users/appointments",
        state.currentUser.token
      );
      setAllAppointments(response.appointments);
    } catch (error) {
      console.error("Error fetching appointments:", error);
    }
  };

  useEffect(() => {
    fetchAppointments();
    if (backRedirect) {
      navigate("/");
      setBackRedirect(false);
    }
  }, [backRedirect]);

  const handleBackPress = () => setBackRedirect(true);

  const onDeleteAppointment = async (id) => {
    try {
      await Appointment.deleteAppointmentById(id);
      fetchAppointments();
    } catch (error) {
      console.error("Error deleting appointment:", error);
    }
  };

  const handleDeletePress = (appointmentId) => {
    setDeleteConfirmation((prev) => ({
      [appointmentId]: !prev[appointmentId],
    }));

    if (deleteConfirmation[appointmentId]) {
      Animated.timing(deleteAnimation, {
        toValue: 0,
        duration: 300,
        easing: Easing.linear,
        useNativeDriver: false,
      }).start(() => {
        onDeleteAppointment(appointmentId);
        setDeleteConfirmation((prev) => ({
          ...prev,
          [appointmentId]: false,
        }));
      });
    } else {
      Animated.timing(deleteAnimation, {
        toValue: 1,
        duration: 300,
        easing: Easing.linear,
        useNativeDriver: false,
      }).start();
    }
  };

  const handleNoPress = (appointmentId) => {
    setDeleteConfirmation((prev) => ({
      [appointmentId]: !prev[appointmentId],
    }));
  };

  // Sort and group appointments
  const filteredAppointments = allAppointments.sort(
    (a, b) => new Date(a.date) - new Date(b.date)
  );
  const groupedAppointments = groupAppointmentsByHome(filteredAppointments);

  // Styles
  const homeContainerStyle = {
    marginBottom: 16,
    padding: 16,
    borderRadius: 20,
    backgroundColor: "rgba(58, 141, 255, 0.12)",
    borderWidth: 1,
    borderColor: "rgba(58, 141, 255, 0.3)",
    shadowColor: "#3a8dff",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 6,
    width:
      width > 1000
        ? "60%"
        : width > 700
        ? "78%"
        : width > 500
        ? "88%"
        : "95%",
    alignSelf: "center",
  };

  const homeTitleStyle = {
    fontWeight: "700",
    fontSize: 18,
    color: "#0f172a",
    marginBottom: 12,
  };

  const scrollViewStyle = {
    flex: 1,
    paddingHorizontal: 10,
    paddingBottom: 20,
  };

  const backButtonContainerStyle = {
    marginTop: 10,
    marginBottom: 12,
    alignSelf: "flex-start",
  };

  // Build appointment cards
  const appointmentArray = [];
  for (const [homeId, appointments] of groupedAppointments) {
    appointmentArray.push(
      <View key={homeId} style={homeContainerStyle}>
        <Text style={homeTitleStyle}>Home ID: {homeId}</Text>
        {appointments.map((appointment) => (
          <AppointmentTile
            key={appointment.id}
            id={appointment.id}
            date={appointment.date}
            price={appointment.price}
            homeId={appointment.homeId}
            employeesAssigned={appointment.employeesAssigned}
            hasBeenAssigned={appointment.hasBeenAssigned}
            empoyeesNeeded={appointment.empoyeesNeeded}
            handleDeletePress={handleDeletePress}
            deleteAnimation={deleteAnimation}
            deleteConfirmation={deleteConfirmation}
            setDeleteConfirmation={setDeleteConfirmation}
            handleNoPress={handleNoPress}
          />
        ))}
      </View>
    );
  }

  return (
    <View
      style={{
        ...homePageStyles.container,
        flexDirection: "column",
        paddingTop: 10,
      }}
    >
      <View style={backButtonContainerStyle}>
        <Pressable style={homePageStyles.backButtonForm} onPress={handleBackPress}>
          <View style={{ flexDirection: "row", alignItems: "center", padding: 10 }}>
            <Icon name="angle-left" size={iconSize} color="black" />
            <View style={{ marginLeft: 10 }}>
              <Text style={topBarStyles.buttonTextSchedule}>Back</Text>
            </View>
          </View>
        </Pressable>
      </View>

      <ScrollView style={scrollViewStyle} contentContainerStyle={{ paddingBottom: 40 }}>
        {appointmentArray}
      </ScrollView>
    </View>
  );
};

export default AllAppointments;
