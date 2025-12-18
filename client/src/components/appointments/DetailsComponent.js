import React, { useEffect, useState } from "react";
import { Dimensions, Pressable, ScrollView, Text, View } from "react-native";
import Icon from "react-native-vector-icons/FontAwesome";
import { useNavigate, useParams } from "react-router-native";
import Appointment from "../../services/fetchRequests/AppointmentClass";
import homePageStyles from "../../services/styles/HomePageStyles";
import topBarStyles from "../../services/styles/TopBarStyles";
import CalendarComponent from "../calender/CalendarComponent";
import { API_BASE } from "../../services/config";

const DetailsComponent = ({ state, dispatch }) => {
  const { id } = useParams();
  const [confirmationModalVisible, setConfirmationModalVisible] = useState(false);
  const [homeDetails, setHomeDetails] = useState(null);
  const [appointments, setAppointments] = useState([]);
  const [redirect, setRedirect] = useState(false);
  const [hasPaymentMethod, setHasPaymentMethod] = useState(null);
  const [checkingPayment, setCheckingPayment] = useState(true);
  const { width } = Dimensions.get("window");
  const iconSize = width < 400 ? 12 : width < 800 ? 16 : 20;
  const navigate = useNavigate();

  // Check if user has a payment method
  useEffect(() => {
    const checkPaymentMethod = async () => {
      if (!state.currentUser?.token) {
        setCheckingPayment(false);
        return;
      }
      try {
        const response = await fetch(`${API_BASE}/payments/payment-method-status`, {
          headers: {
            Authorization: `Bearer ${state.currentUser.token}`,
          },
        });
        const data = await response.json();
        if (response.ok) {
          setHasPaymentMethod(data.hasPaymentMethod);
        }
      } catch (err) {
        console.error("Error checking payment method:", err);
      } finally {
        setCheckingPayment(false);
      }
    };
    checkPaymentMethod();
  }, [state.currentUser?.token]);

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

        {/* Payment Method Required Message */}
        {homeDetails && !homeDetails.outsideServiceArea && !checkingPayment && !hasPaymentMethod && (
          <View style={{
            backgroundColor: "#fef3c7",
            borderRadius: 10,
            padding: 16,
            marginHorizontal: 16,
            marginTop: 16,
            borderWidth: 1,
            borderColor: "#fcd34d",
            flexDirection: "row",
            alignItems: "center",
          }}>
            <Icon name="credit-card" size={24} color="#f59e0b" style={{ marginRight: 12 }} />
            <View style={{ flex: 1 }}>
              <Text style={{
                fontSize: 14,
                fontWeight: "600",
                color: "#92400e",
                marginBottom: 4,
              }}>
                Payment Method Required
              </Text>
              <Text style={{
                fontSize: 12,
                color: "#a16207",
                lineHeight: 17,
              }}>
                Add a payment method to book cleanings.
              </Text>
            </View>
            <Pressable
              style={{
                backgroundColor: "#3b82f6",
                paddingVertical: 8,
                paddingHorizontal: 12,
                borderRadius: 6,
              }}
              onPress={() => navigate("/payment-setup")}
            >
              <Text style={{ color: "#fff", fontWeight: "600", fontSize: 12 }}>
                Set Up
              </Text>
            </Pressable>
          </View>
        )}

        {/* Calendar Component - Only show if home is within service area AND user has payment method */}
        {homeDetails && !homeDetails.outsideServiceArea && hasPaymentMethod && (
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

        {/* Outside Service Area Message */}
        {homeDetails && homeDetails.outsideServiceArea && (
          <View style={{
            backgroundColor: "#fef3c7",
            borderRadius: 16,
            padding: 24,
            marginHorizontal: 16,
            marginTop: 20,
            borderWidth: 1,
            borderColor: "#fcd34d",
            alignItems: "center",
          }}>
            <Icon name="exclamation-triangle" size={40} color="#f59e0b" style={{ marginBottom: 16 }} />
            <Text style={{
              fontSize: 18,
              fontWeight: "700",
              color: "#92400e",
              textAlign: "center",
              marginBottom: 8,
            }}>
              Outside Service Area
            </Text>
            <Text style={{
              fontSize: 14,
              color: "#a16207",
              textAlign: "center",
              lineHeight: 22,
            }}>
              This home is currently outside our service area. Booking is not available at this time.
              We'll notify you when we expand to your area.
            </Text>
            <Pressable
              style={{
                marginTop: 20,
                backgroundColor: "#f59e0b",
                paddingVertical: 12,
                paddingHorizontal: 24,
                borderRadius: 10,
              }}
              onPress={() => navigate("/list-of-homes")}
            >
              <Text style={{ color: "#fff", fontWeight: "600", fontSize: 14 }}>
                Back to My Homes
              </Text>
            </Pressable>
          </View>
        )}
      </View>
    </ScrollView>
  );
};

export default DetailsComponent;
