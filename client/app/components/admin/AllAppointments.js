import React, { useEffect, useState } from "react";
import { Animated, Dimensions, Easing, Pressable, ScrollView, Text, View } from "react-native";
import Icon from "react-native-vector-icons/FontAwesome";
import { useNavigate } from "react-router-native";
import Appointment from "../../services/fetchRequests/AppointmentClass";
import FetchData from "../../services/fetchRequests/fetchData";
import homePageStyles from "../../services/styles/HomePageStyles";
import topBarStyles from "../../services/styles/TopBarStyles";
import AppointmentTile from "../tiles/AppointmentTile";

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

  const fetchAppointments = async () => {
    const response = await FetchData.get(
      "/api/v1/users/appointments",
      state.currentUser.token
    );
    setAllAppointments(response.appointments);
  };

  useEffect(() => {
    fetchAppointments();
    if (backRedirect) {
      navigate("/");
      setBackRedirect(false);
    }
  }, [backRedirect]);

  const handleBackPress = () => {
    setBackRedirect(true);
  };

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

  const filteredAppointments = allAppointments.sort(
    (a, b) => new Date(a.date) - new Date(b.date)
  );

  const groupedAppointments = groupAppointmentsByHome(filteredAppointments);
  const appointmentArray = [];

  for (const [homeId, appointments] of groupedAppointments) {
    const appointmentsContainer = (
      <View key={homeId} style={{ marginBottom: 10, borderWidth: 3, borderColor: "black", padding: 5 }}>
        <Text style={{ fontWeight: "bold", fontSize: 16, marginBottom: 5 }}>
          Home ID: {homeId}
        </Text>
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

    appointmentArray.push(appointmentsContainer);
  }

  return (
    <View style={{ ...homePageStyles.container, flexDirection: "column" }}>
      <View style={homePageStyles.backButtonAllAppointments}>
        <Pressable style={homePageStyles.backButtonForm} onPress={handleBackPress}>
          <View style={{ flexDirection: "row", alignItems: "center", padding: 10 }}>
            <Icon name="angle-left" size={iconSize} color="black" />
            <View style={{ marginLeft: 15 }}>
              <Text style={topBarStyles.buttonTextSchedule}>Back</Text>
            </View>
          </View>
        </Pressable>
      </View>

      {/* Make this scrollable */}
      <ScrollView style={{ flex: 1 }}>
        {appointmentArray}
      </ScrollView>
    </View>
  );
};

export default AllAppointments;
