import React, { useEffect } from "react";
import { Text, View, Image, ScrollView } from "react-native";
import homePageStyles from "../services/styles/HomePageStyles";
import FetchData from "../services/fetchRequests/fetchData";
import image1 from "../services/photos/Best-Cleaning-Service.jpeg";
import image2 from "../services/photos/clean-laptop.jpg";
import image3 from "../services/photos/cleaning-tech.png";
import image4 from "../services/photos/cleaning_supplies_on_floor.jpg";
import { cleaningCompany } from "../services/data/companyInfo";
import TodaysAppointment from "./employeeAssignments/tiles/TodaysAppointment";
import NextAppointment from "./employeeAssignments/tiles/NextAppointment";
import { FadeInSection } from "../services/FadeInSection";
import Animated, {
  interpolate,
  useAnimatedRef,
  useAnimatedStyle,
  useScrollViewOffset,
} from "react-native-reanimated";

const HomePage = ({ state, dispatch }) => {
  const scrollRef = useAnimatedRef();
  const scrollOffSet = useScrollViewOffset(scrollRef);

  const imageAnimatedStyles = useAnimatedStyle(() => {
    return {
      transform: [
        {
          translateY: interpolate(
            scrollOffSet.value,
            [-300, 0, 300],
            [-300 / 2, 0, 300 * 0.75]
          ),
        },
        {
          scale: interpolate(scrollOffSet.value, [-300, 0, 300], [2, 1, 1]),
        },
      ],
    };
  });

  useEffect(() => {
    if (state.currentUser.token) {
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
            dispatch({
              type: "USER_HOME",
              payload: response.user.homes,
            });
            dispatch({
              type: "USER_APPOINTMENTS",
              payload: response.user.appointments,
            });
            dispatch({
              type: "DB_BILL",
              payload: response.user.bill,
            });
          }
        );
      }
    }
  }, []);

  let todaysAppointment = null;
  let nextAppointment = null;
  let foundToday = false;

  const sortedAppointments = state.appointments.sort((a, b) => {
    return new Date(a.date) - new Date(b.date);
  });

  sortedAppointments.forEach((appointment, index) => {
    const today = new Date();
    let appointmentDate = new Date(appointment.date);

    if (appointmentDate.toDateString() === today.toDateString()) {
      foundToday = true;
      todaysAppointment = <TodaysAppointment appointment={appointment} />;
      if (index < sortedAppointments.length - 1) {
        nextAppointment = (
          <NextAppointment appointment={sortedAppointments[index + 1]} />
        );
      }
    } else if (!nextAppointment && appointmentDate > today) {
      nextAppointment = <NextAppointment appointment={appointment} />;
    }
  });

  if (!foundToday && !nextAppointment) {
    nextAppointment = (
      <Text style={homePageStyles.title}>
        You have no appointments scheduled
      </Text>
    );
  } else if (!foundToday) {
    todaysAppointment = (
      <>
        <Text style={homePageStyles.title}>
          You have no appointments scheduled for today
        </Text>
        <Text style={homePageStyles.smallTitle}>Your next cleaning is:</Text>
      </>
    );
  }

  return (
    <View
      style={{
        ...homePageStyles.container,
        flexDirection: "column",
        marginTop: 105,
      }}
    >
      {state.account === "cleaner" ? (
        <>
          {todaysAppointment}
          {nextAppointment}
        </>
      ) : (
        <View
          style={{
            ...homePageStyles.container,
            flexDirection: "column",
            justifyContent: "flex-start",
            paddingLeft: "10%",
            paddingRight: "10%",
            marginTop: 20,
          }}
        >
          <Text style={homePageStyles.title}>
            Welcome to Cleaning Services!
          </Text>
          <View style={homePageStyles.homePageParagraphSurround}>
            <View style={homePageStyles.homePageParagraphText}>
              <Text style={homePageStyles.smallTitle}>About Our Service: </Text>
              <Text style={homePageStyles.information}>
                {cleaningCompany.aboutService.description}
              </Text>
            </View>
            <Image source={image3} style={homePageStyles.image} />
          </View>
          <View style={homePageStyles.homePageParagraphSurround}>
            <View style={homePageStyles.reverseImage}>
              <Image source={image2} style={homePageStyles.image} />
              <View style={homePageStyles.homePageParagraphText}>
                <Text style={homePageStyles.smallTitle}>
                  Booking Information:{" "}
                </Text>
                <Text style={homePageStyles.information}>
                  {cleaningCompany.bookingInfo.description}
                </Text>
              </View>
            </View>
          </View>
          <View style={homePageStyles.homePageParagraphSurround}>
            <View style={homePageStyles.homePageParagraphText}>
              <Text style={homePageStyles.smallTitle}>
                Special Considerations:
              </Text>
              <Text style={homePageStyles.information}>
                {cleaningCompany.specialConsiderations.description}
              </Text>
            </View>
            <Image source={image4} style={homePageStyles.image} />
          </View>
          <View style={homePageStyles.homePageParagraphSurround}>
            <View style={homePageStyles.reverseImage}>
              <Image source={image1} style={homePageStyles.imageGuarantee} />
              <View style={homePageStyles.homePageParagraphText}>
                <Text style={homePageStyles.smallTitle}>
                  Our Worry-Free Guarantee:{" "}
                </Text>
                <Text style={homePageStyles.information}>
                  {cleaningCompany.ourWorryFreeGuarantee.description}
                </Text>
              </View>
            </View>
          </View>
          <Text style={homePageStyles.smallTitle}>Cancellation Policy: </Text>
          <Text style={homePageStyles.information}>
            {cleaningCompany.cancellationPolicy.description}
          </Text>
        </View>
      )}
    </View>
  );
};

export default HomePage;
