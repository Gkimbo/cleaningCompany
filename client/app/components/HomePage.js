import React, { useEffect, useState } from "react";
import { Dimensions, Image, Pressable, ScrollView, Text, View } from "react-native";
import { useNavigate } from "react-router-native";
import { cleaningCompany } from "../services/data/companyInfo";
import FetchData from "../services/fetchRequests/fetchData";
import image1 from "../services/photos/Best-Cleaning-Service.jpeg";
import image2 from "../services/photos/clean-laptop.jpg";
import image3 from "../services/photos/cleaning-tech.png";
import image4 from "../services/photos/cleaning_supplies_on_floor.jpg";
import homePageStyles from "../services/styles/HomePageStyles";
import NextAppointment from "./employeeAssignments/tiles/NextAppointment";
import TodaysAppointment from "./employeeAssignments/tiles/TodaysAppointment";
import ReviewsOverview from "./reviews/ReviewsOverview";
import GetHelpButton from "./messaging/GetHelpButton";
import TaxFormsSection from "./tax/TaxFormsSection";
import ManagerDashboard from "./manager/ManagerDashboard";
import ClientDashboard from "./client/ClientDashboard";

const HomePage = ({ state, dispatch }) => {
  const [redirect, setRedirect] = useState(false);
  const [redirectToJobs, setRedirectToJobs] = useState(false);
  const navigate = useNavigate();
  const { width } = Dimensions.get("window");

  useEffect(() => {
    if (redirect) {
      navigate("/employee-assignments");
      setRedirect(false);
    }
    if (redirectToJobs) {
      navigate("/new-job-choice");
      setRedirectToJobs(false);
    }
  }, [redirect, redirectToJobs]);

  const handlePress = () => setRedirect(true);
  const handlePressToJobsList = () => setRedirectToJobs(true);

  useEffect(() => {
    if (!state.currentUser.token) return;
    if (state.account === "cleaner") {
      FetchData.get("/api/v1/employee-info", state.currentUser.token).then(
        (response) => {
          dispatch({
            type: "USER_APPOINTMENTS",
            payload: response.employee.cleanerAppointments,
          });
        }
      );
    } else {
      FetchData.get("/api/v1/user-info", state.currentUser.token).then(
        (response) => {
          dispatch({ type: "USER_HOME", payload: response.user.homes });
          dispatch({ type: "USER_APPOINTMENTS", payload: response.user.appointments });
          dispatch({ type: "DB_BILL", payload: response.user.bill });
        }
      );
      FetchData.get("/api/v1/appointments/my-requests", state.currentUser.token).then(
        (response) => {
          dispatch({ type: "CLEANING_REQUESTS", payload: response.pendingRequestsEmployee });
        }
      );
    }
  }, []);

  let todaysAppointment = null;
  let nextAppointment = null;
  let foundToday = false;
  let upcomingPayment = 0;

  const sortedAppointments = state.appointments.sort(
    (a, b) => new Date(a.date) - new Date(b.date)
  );

  sortedAppointments.forEach((appointment, index) => {
    const correctedAmount = Number(appointment.price) * 0.9;
    upcomingPayment += correctedAmount;
    const today = new Date();
    const appointmentDate = new Date(appointment.date);

    if (appointmentDate.toDateString() === today.toDateString()) {
      foundToday = true;
      todaysAppointment = <TodaysAppointment appointment={appointment} />;
      if (index < sortedAppointments.length - 1) {
        nextAppointment = (
          <View style={{ marginVertical: 15 }}>
            <NextAppointment appointment={sortedAppointments[index + 1]} />
            <Pressable
              style={{
                backgroundColor: "#f9bc60",
                paddingVertical: 14,
                paddingHorizontal: 25,
                borderRadius: 25,
                alignSelf: "center",
                marginTop: 20,
                shadowColor: "#000",
                shadowOpacity: 0.2,
                shadowOffset: { width: 0, height: 2 },
                shadowRadius: 4,
                elevation: 3,
              }}
              onPress={handlePress}
            >
              <Text style={{ color: "#fff", fontWeight: "600", fontSize: 16 }}>
                View All Appointments
              </Text>
            </Pressable>
          </View>
        );
      }
    } else if (!nextAppointment && appointmentDate > today) {
      nextAppointment = (
        <View style={{ marginVertical: 15 }}>
          <NextAppointment appointment={appointment} />
          <Pressable
            style={{
              backgroundColor: "#f9bc60",
              paddingVertical: 14,
              paddingHorizontal: 25,
              borderRadius: 25,
              alignSelf: "center",
              marginTop: 20,
              shadowColor: "#000",
              shadowOpacity: 0.2,
              shadowOffset: { width: 0, height: 2 },
              shadowRadius: 4,
              elevation: 3,
            }}
            onPress={handlePress}
          >
            <Text style={{ color: "#fff", fontWeight: "600", fontSize: 16 }}>
              View All Appointments
            </Text>
          </Pressable>
        </View>
      );
    }
  });

  if (!foundToday && !nextAppointment) {
    nextAppointment = (
      <View style={{ marginVertical: 20, alignItems: "center" }}>
        <Text style={{ ...homePageStyles.title, fontSize: 18 }}>No appointments scheduled.</Text>
        <Pressable
          onPress={handlePressToJobsList}
          style={{
            marginTop: 15,
            backgroundColor: "#007AFF",
            paddingVertical: 12,
            paddingHorizontal: 20,
            borderRadius: 25,
            shadowColor: "#000",
            shadowOpacity: 0.2,
            shadowOffset: { width: 0, height: 2 },
            shadowRadius: 4,
            elevation: 3,
          }}
        >
          <Text style={{ color: "#fff", fontWeight: "600", fontSize: 16 }}>
            Schedule Jobs
          </Text>
        </Pressable>
      </View>
    );
  } else if (!foundToday) {
    todaysAppointment = (
      <View style={{ marginVertical: 20, alignItems: "center" }}>
        <Text style={{ ...homePageStyles.homeTileTitle }}>Expected payout:</Text>
        <Text style={{ ...homePageStyles.homeTileTitle, fontSize: 28, fontStyle: "italic", marginVertical: 5 }}>
          ${upcomingPayment.toFixed(2)}
        </Text>
        <Text style={{ ...homePageStyles.homeTileTitle, marginBottom: 20 }}>
          After scheduled cleanings are completed!
        </Text>
        <Text style={{ ...homePageStyles.title, marginBottom: 15 }}>
          No appointments scheduled for today
        </Text>
        <Text style={{ ...homePageStyles.smallTitle }}>Next cleaning:</Text>
      </View>
    );
  }

  const cardStyle = {
    backgroundColor: "#fff",
    borderRadius: 15,
    padding: 20,
    marginBottom: 20,
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 5,
    elevation: 3,
  };

  // Show Manager Dashboard for managers
  if (state.account === "manager1" && state.currentUser.token) {
    return <ManagerDashboard state={state} />;
  }

  // Show Client Dashboard for logged-in homeowners (not cleaner, not manager)
  if (state.currentUser.token && state.account !== "cleaner") {
    return <ClientDashboard state={state} dispatch={dispatch} />;
  }

  return (
    <ScrollView
      contentContainerStyle={{
        paddingTop: 40, // More space from top bar
        paddingHorizontal: 20,
        backgroundColor: "#f5f5f5",
        paddingBottom: 50,
      }}
    >
      {state.account === "cleaner" ? (
        <View style={{ flexDirection: "column" }}>
          {todaysAppointment}
          {nextAppointment}
          <ReviewsOverview state={state} dispatch={dispatch} />
          {/* Get Help Button for cleaners */}
          <View style={{ marginTop: 20, alignItems: "center" }}>
            <Text style={{ fontSize: 14, color: "#64748b", marginBottom: 10, textAlign: "center" }}>
              Need assistance with a booking or have feedback?
            </Text>
            <GetHelpButton token={state.currentUser.token} />
          </View>
          {/* Tax Forms Section for cleaners */}
          <TaxFormsSection state={state} />
        </View>
      ) : (
        <View style={{ flexDirection: "column" }}>
          <Text style={{ ...homePageStyles.title, marginBottom: 20, textAlign: "center" }}>
            Welcome to Cleaning Services!
          </Text>

          {/* About Service */}
          <View style={cardStyle}>
            <Text style={homePageStyles.smallTitle}>About Our Service:</Text>
            <Text style={homePageStyles.information}>{cleaningCompany.aboutService.description}</Text>
            <Image source={image3} style={{ width: "100%", height: 150, borderRadius: 12, marginTop: 10 }} />
          </View>

          {/* Booking Info */}
          <View style={{ ...cardStyle, flexDirection: width > 600 ? "row" : "column", alignItems: "center" }}>
            <Image source={image2} style={{ width: width > 600 ? 120 : "100%", height: 120, borderRadius: 12, marginRight: width > 600 ? 15 : 0, marginBottom: width > 600 ? 0 : 10 }} />
            <View style={{ flex: 1 }}>
              <Text style={homePageStyles.smallTitle}>Booking Information:</Text>
              <Text style={homePageStyles.information}>{cleaningCompany.bookingInfo.description}</Text>
            </View>
          </View>

          {/* Special Considerations */}
          <View style={cardStyle}>
            <Text style={homePageStyles.smallTitle}>Special Considerations:</Text>
            <Text style={homePageStyles.information}>{cleaningCompany.specialConsiderations.description}</Text>
            <Image source={image4} style={{ width: "100%", height: 150, borderRadius: 12, marginTop: 10 }} />
          </View>

          {/* Worry-Free Guarantee */}
          <View style={{ ...cardStyle, flexDirection: width > 600 ? "row" : "column", alignItems: "center" }}>
            <Image source={image1} style={{ width: width > 600 ? 120 : "100%", height: 120, borderRadius: 12, marginRight: width > 600 ? 15 : 0, marginBottom: width > 600 ? 0 : 10 }} />
            <View style={{ flex: 1 }}>
              <Text style={homePageStyles.smallTitle}>Our Worry-Free Guarantee:</Text>
              <Text style={homePageStyles.information}>{cleaningCompany.ourWorryFreeGuarantee.description}</Text>
            </View>
          </View>

          {/* Cancellation Policy */}
          <View style={cardStyle}>
            <Text style={homePageStyles.smallTitle}>Cancellation Policy:</Text>
            <Text style={homePageStyles.information}>{cleaningCompany.cancellationPolicy.description}</Text>
          </View>

          {/* Get Help Button for homeowners - only show when logged in */}
          {state.currentUser.token && (
            <View style={{ ...cardStyle, alignItems: "center", backgroundColor: "#f0f9ff" }}>
              <Text style={{ ...homePageStyles.smallTitle, marginBottom: 8 }}>Need Help?</Text>
              <Text style={{ fontSize: 14, color: "#64748b", marginBottom: 16, textAlign: "center" }}>
                Have questions about your booking, cleaning service, or want to provide feedback?
              </Text>
              <GetHelpButton token={state.currentUser.token} />
            </View>
          )}
          {/* Tax Forms Section for homeowners */}
          {state.currentUser.token && <TaxFormsSection state={state} />}
        </View>
      )}
    </ScrollView>
  );
};

export default HomePage;
