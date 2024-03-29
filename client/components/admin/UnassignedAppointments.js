import React, { useState, useEffect } from "react";
import { Pressable, View, Text, Dimensions } from "react-native";
import { useNavigate } from "react-router-native";
import homePageStyles from "../../services/styles/HomePageStyles";
import AppointmentTile from "../tiles/AppointmentTile";
import Icon from "react-native-vector-icons/FontAwesome";
import topBarStyles from "../../services/styles/TopBarStyles";
import FetchData from "../../services/fetchRequests/fetchData";

const groupAppointmentsByDate = (appointments) => {
  const groupedAppointments = new Map();

  for (const appointment of appointments) {
    const date = appointment.date;

    if (!groupedAppointments.has(date)) {
      groupedAppointments.set(date, []);
    }

    groupedAppointments.get(date).push(appointment);
  }

  return groupedAppointments;
};

const UnassignedAppointments = ({ state }) => {
  const [unassignedAppointments, setUnassignedAppointments] = useState([]);
  const [backRedirect, setBackRedirect] = useState(false);
  const { width } = Dimensions.get("window");
  const iconSize = width < 400 ? 12 : width < 800 ? 16 : 20;
  const navigate = useNavigate();

  const filteredAppointments = unassignedAppointments.sort(
    (a, b) => new Date(a.date) - new Date(b.date)
  );

  const fetchAppointments = async () => {
    const response = await FetchData.get(
      "/api/v1/appointments/unassigned",
      state.currentUser.token
    );
    console.log(response);
    setUnassignedAppointments(response.appointments);
  };

  useEffect(() => {
    fetchAppointments().then((response) => {
      console.log("response");
    });

    if (backRedirect) {
      navigate("/");
      setBackRedirect(false);
    }
  }, [backRedirect]);

  const handleBackPress = () => {
    setBackRedirect(true);
  };

  const groupedAppointments = groupAppointmentsByDate(filteredAppointments);
  const appointmentArray = [];

  for (const [date, appointments] of groupedAppointments) {
    if (appointments.length > 1) {
      const appointmentsContainer = (
        <View style={{ marginBottom: 10, borderWidth: 5, borderColor: "red" }}>
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
            />
          ))}
        </View>
      );

      appointmentArray.push(appointmentsContainer);
    } else {
      // If only one appointment on the date, no need for a container
      const appointment = appointments[0];
      const singleAppointment = (
        <View key={appointment.id}>
          <AppointmentTile
            id={appointment.id}
            date={appointment.date}
            price={appointment.price}
            homeId={appointment.homeId}
            employeesAssigned={appointment.employeesAssigned}
            empoyeesNeeded={appointment.empoyeesNeeded}
            hasBeenAssigned={appointment.hasBeenAssigned}
          />
        </View>
      );

      appointmentArray.push(singleAppointment);
    }
  }

  return (
    <View
      style={{
        ...homePageStyles.container,
        flexDirection: "column",
      }}
    >
      <View style={homePageStyles.backButtonunassignedAppointments}>
        <Pressable
          style={homePageStyles.backButtonForm}
          onPress={handleBackPress}
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
      </View>
      {appointmentArray}
    </View>
  );
};

export default UnassignedAppointments;
