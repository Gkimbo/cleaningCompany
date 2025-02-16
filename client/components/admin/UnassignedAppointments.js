import React, { useState, useEffect } from "react";
import { Pressable, View, Text, Dimensions, Animated } from "react-native";
import { useNavigate } from "react-router-native";
import homePageStyles from "../../services/styles/HomePageStyles";
import AppointmentTile from "../tiles/AppointmentTile";
import Icon from "react-native-vector-icons/FontAwesome";
import topBarStyles from "../../services/styles/TopBarStyles";
import FetchData from "../../services/fetchRequests/fetchData";

const groupAppointmentsByDate = (appointments) => {
  const groupedAppointments = new Map();

  for (const appointment of appointments) {
    if(!appointment.employeesAssigned){
      appointment.employeesAssigned = []
    }
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
  const [deleteAnimation] = useState(new Animated.Value(0));
	const [deleteConfirmation, setDeleteConfirmation] = useState({});
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
    setUnassignedAppointments(response.appointments);
  };

  useEffect(() => {
    fetchAppointments()
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
			const appointment = await Appointment.deleteAppointmentById(id)
      fetchAppointments()
		} catch (error) {
			console.error("Error deleting appointment:", error);
		}
	};

  const handleDeletePress = (appointmentId) => {
		setDeleteConfirmation((prevConfirmations) => ({
			[appointmentId]: !prevConfirmations[appointmentId],
		}));
		if (deleteConfirmation[appointmentId]) {
			Animated.timing(deleteAnimation, {
				toValue: 0,
				duration: 300,
				easing: Easing.linear,
				useNativeDriver: false,
			}).start(() => {
				onDeleteAppointment(appointmentId);
				setDeleteConfirmation((prevConfirmations) => ({
					...prevConfirmations,
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
		setDeleteConfirmation((prevConfirmations) => ({
			[appointmentId]: !prevConfirmations[appointmentId],
		}));
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
            handleDeletePress={handleDeletePress}
					  deleteAnimation={deleteAnimation}
					  deleteConfirmation={deleteConfirmation}
					  setDeleteConfirmation={setDeleteConfirmation}
					  handleNoPress={handleNoPress}
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
