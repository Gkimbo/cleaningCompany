import React, { useEffect, useState } from "react";
import { Dimensions, Pressable, ScrollView, Text, View } from "react-native";
import Icon from "react-native-vector-icons/FontAwesome";
import { useNavigate, useParams } from "react-router-native";
import Appointment from "../../services/fetchRequests/AppointmentClass";
import homePageStyles from "../../services/styles/HomePageStyles";
import topBarStyles from "../../services/styles/TopBarStyles";
import CalendarComponent from "../calender/CalendarComponent";

const DetailsComponent = ({ state, dispatch }) => {
  const { id } = useParams();
  const [confirmationModalVisible, setConfirmationModalVisible] = useState(false);
  const [homeDetails, setHomeDetails] = useState(null);
  const [appointments, setAppointments] = useState([]);
  const [redirect, setRedirect] = useState(false);
  const { width } = Dimensions.get("window");
  const iconSize = width < 400 ? 12 : width < 800 ? 16 : 20;
  const navigate = useNavigate();

  const onAppointmentDelete = async (date, cancellationFee) => {
    if (!homeDetails) return;
    try {
      const homeId = homeDetails.id;
      const arrayOfAppointments = await Appointment.getHomeAppointments(homeId);
      const appointmentToDelete = arrayOfAppointments.appointments.find(
        (appointment) => appointment.date === date.dateString
      );
      if (appointmentToDelete) {
        let response;
        if (cancellationFee) {
          response = await Appointment.deleteAppointment(
            appointmentToDelete.id,
            cancellationFee,
            state.currentUser.token
          );
          dispatch({ type: "ADD_FEE", payload: cancellationFee });
          dispatch({ type: "SUBTRACT_BILL", payload: appointmentToDelete.price });
        } else {
          response = await Appointment.deleteAppointment(
            appointmentToDelete.id,
            0,
            state.currentUser.token
          );
          dispatch({ type: "SUBTRACT_BILL", payload: appointmentToDelete.price });
        }
        if (response.message === "Appointment Deleted") {
          const updatedAppointments = appointments.filter(
            (appointment) => appointment.date !== appointmentToDelete.date
          );
          setAppointments(updatedAppointments);
          dispatch({ type: "USER_APPOINTMENTS", payload: updatedAppointments });
        } else {
          console.error("Failed to delete appointment");
        }
      }
    } catch (error) {
      console.error("Error deleting appointment:", error);
    }
  };

  const onDatesSelected = async (datesOfCleaning) => {
    if (!homeDetails) return;
    const infoObject = {
      dateArray: datesOfCleaning,
      homeId: homeDetails.id,
      token: state.currentUser.token,
      keyPadCode: homeDetails.keyPadCode,
      keyLocation: homeDetails.keyLocation,
    };
    const response = await Appointment.addAppointmentToDb(infoObject);
    if (response) {
      const stateApp = datesOfCleaning.map((app) => ({ ...app, homeId: homeDetails.id }));
      let apptTotal = 0;
      datesOfCleaning.forEach((date) => {
        apptTotal += date.price;
      });
      dispatch({ type: "ADD_BILL", payload: apptTotal });
      dispatch({ type: "ADD_DATES", payload: stateApp });
      navigate("/list-of-homes");
    }
  };

  const handlePress = () => {
    setRedirect(true);
  };

  useEffect(() => {
    const idNeeded = Number(id);
    const foundHome = state.homes.find((home) => home.id === idNeeded) || null;
    setHomeDetails(foundHome);

    const filteredAppointments = state.appointments.filter(
      (appointment) => appointment.homeId === idNeeded
    );
    setAppointments(filteredAppointments);

    if (redirect) {
      navigate("/list-of-homes");
      setRedirect(false);
    }
  }, [id, redirect, state.appointments]);

  if (!homeDetails) {
    return (
      <View style={homePageStyles.container}>
        <Text style={homePageStyles.title}>Loading home details...</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={{
        backgroundColor: confirmationModalVisible ? "grey" : homePageStyles.container.backgroundColor,
      }}
      contentContainerStyle={{ paddingBottom: 20 }}
    >
      <View style={homePageStyles.detailsContainer}>
        {/* Back Button */}
        <View style={{ marginVertical: 12 }}>
          <Pressable style={homePageStyles.backButtonForm} onPress={handlePress}>
            <View style={{ flexDirection: "row", alignItems: "center", padding: 10 }}>
              <Icon name="angle-left" size={iconSize} color="black" />
              <View style={{ marginLeft: 15 }}>
                <Text style={topBarStyles.buttonTextSchedule}>Back</Text>
              </View>
            </View>
          </Pressable>
        </View>

        {/* Home Details */}
        <View
          style={{
            ...homePageStyles.homeTileContainer,
            backgroundColor: confirmationModalVisible ? "grey" : "rgba(58, 141, 255, 0.1)",
          }}
        >
          <Text style={homePageStyles.homeTileTitle}>{homeDetails.address}</Text>
          <Text style={homePageStyles.homeTileAddress}>
            {`${homeDetails.city}, ${homeDetails.zipcode}`}
          </Text>
          <Text style={homePageStyles.homeTileContent}>
            {`Beds: ${homeDetails.numBeds}, Baths: ${homeDetails.numBaths}`}
          </Text>
          <Text style={homePageStyles.homeTileContent}>
            {`Time the cleaner will clean: ${
              homeDetails.timeToBeCompleted === "anytime"
                ? "Anytime"
                : homeDetails.timeToBeCompleted === "10-3"
                ? "Between 10am and 3pm  (+ $30 per appointment)"
                : homeDetails.timeToBeCompleted === "11-4"
                ? "Between 11am and 4pm  (+ $30 per appointment)"
                : homeDetails.timeToBeCompleted === "12-2"
                ? "Between 12pm and 2pm  (+ $500 per appointment)"
                : null
            }`}
          </Text>
          <Text style={homePageStyles.homeTileContent}>
            {`Sheets provided: ${
              homeDetails.sheetsProvided === "yes"
                ? "Yes - changing to No will save $25 per appointment"
                : "No - changing to Yes will add $25 per appointment"
            }`}
          </Text>
          <Text style={homePageStyles.homeTileContent}>
            {`Towels provided: ${
              homeDetails.towelsProvided === "yes"
                ? "Yes - changing to No will save $25 per appointment"
                : "No - changing to Yes will add $25 per appointment"
            }`}
          </Text>
          {homeDetails.keyPadCode && (
            <Text style={homePageStyles.homeTileContent}>
              {`Keypad Code: ${homeDetails.keyPadCode}`}
            </Text>
          )}
          {homeDetails.keyLocation && (
            <Text style={homePageStyles.homeTileContent}>
              {`Key Location: ${homeDetails.keyLocation}`}
            </Text>
          )}
          {homeDetails.recyclingLocation && (
            <Text style={homePageStyles.homeTileContent}>
              {`Recycling Location: ${homeDetails.recyclingLocation}`}
            </Text>
          )}
          {homeDetails.compostLocation && (
            <Text style={homePageStyles.homeTileContent}>
              {`Compost Location: ${homeDetails.compostLocation}`}
            </Text>
          )}
          <Text style={homePageStyles.homeTileContent}>
            {`Trash Location: ${homeDetails.trashLocation}`}
          </Text>

          {/* Calendar Sync Button */}
          <Pressable
            style={{
              marginTop: 16,
              backgroundColor: "#4F46E5",
              paddingVertical: 12,
              paddingHorizontal: 20,
              borderRadius: 8,
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "center",
            }}
            onPress={() => navigate(`/calendar-sync/${homeDetails.id}`)}
          >
            <Icon name="calendar" size={iconSize} color="white" style={{ marginRight: 8 }} />
            <Text style={{ color: "white", fontWeight: "600", fontSize: 14 }}>
              Connect Airbnb/VRBO Calendar
            </Text>
          </Pressable>
        </View>

        {/* Calendar Component */}
        {homeDetails && (
          <CalendarComponent
            onDatesSelected={onDatesSelected}
            numBeds={homeDetails.numBeds}
            numBaths={homeDetails.numBaths}
            appointments={appointments}
            onAppointmentDelete={onAppointmentDelete}
            confirmationModalVisible={confirmationModalVisible}
            setConfirmationModalVisible={setConfirmationModalVisible}
            sheets={homeDetails.sheetsProvided}
            towels={homeDetails.towelsProvided}
            timeToBeCompleted={homeDetails.timeToBeCompleted}
          />
        )}
      </View>
    </ScrollView>
  );
};

export default DetailsComponent;
