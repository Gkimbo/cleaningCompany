import React, { useEffect, useState } from "react";
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
import topBarStyles from "../services/styles/TopBarStyles";
import { FadeInSection } from "../services/FadeInSection";
import { useNavigate } from "react-router-native";
import Animated, {
  interpolate,
  useAnimatedRef,
  useAnimatedStyle,
  useScrollViewOffset,
} from "react-native-reanimated";
import { Pressable } from "react-native-web";
import ReviewsOverview from "./reviews/ReviewsOverview";

const HomePage = ({ state, dispatch }) => {
  const scrollRef = useAnimatedRef();
  const scrollOffSet = useScrollViewOffset(scrollRef);
  const [redirect, setRedirect] = useState(false);
	const navigate = useNavigate();

  useEffect(() => {
		if (redirect) {
			navigate("/employee-assignments");
			setRedirect(false);
		}
	}, [redirect]);

	const handlePress = () => {
		setRedirect(true);
	};

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
  let upcomingPayment = 0

  const sortedAppointments = state.appointments.sort((a, b) => {
    return new Date(a.date) - new Date(b.date);
  });

  sortedAppointments.forEach((appointment, index) => {
    const totalPrice = Number(appointment.price)
    const correctedAmount = (totalPrice * 0.9)
    upcomingPayment = upcomingPayment + correctedAmount
    const today = new Date();
    let appointmentDate = new Date(appointment.date);

    if (appointmentDate.toDateString() === today.toDateString()) {
      foundToday = true;
      todaysAppointment = <TodaysAppointment appointment={appointment} />;
      if (index < sortedAppointments.length - 1) {
        nextAppointment = (
          <>
            <NextAppointment appointment={sortedAppointments[index + 1]} />
            
            <Pressable style={{
		            backgroundColor: "#f9bc60",
		            padding: 10,
		            borderRadius: 50,
                width:"40%",
                alignSelf: "center"
	              }} onPress={handlePress}>
			        <Text style={topBarStyles.buttonTextSchedule}>View all your appointments</Text>
		        </Pressable>
          </>
        );
      }
    } else if (!nextAppointment && appointmentDate > today) {
      nextAppointment = 
      <>
        <NextAppointment appointment={appointment} />
        <Pressable style={{
		            backgroundColor: "#f9bc60",
		            padding: 10,
		            borderRadius: 50,
                width:"40%",
                alignSelf: "center"
	              }} onPress={handlePress}>
			        <Text style={topBarStyles.buttonTextSchedule}>View all your appointments</Text>
		        </Pressable>
      </>
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
        <Text style={{...homePageStyles.homeTileTitle}}>
          {`Your'e expected payout is `}
        </Text>
        <Text style={{...homePageStyles.homeTileTitle, fontFamily: "italic", fontSize: 25}}>
          {`$${upcomingPayment}`}
        </Text>
        <Text style={{...homePageStyles.homeTileTitle, marginBottom: "40%"}}>
          {`After scheduled cleanings are completed!`}
        </Text>
        <Text style={{...homePageStyles.title, marginBottom: "30%"}}>
          You have no appointments scheduled for today
        </Text>
        <Text style={homePageStyles.smallTitle}>Your next cleaning is:</Text>
      </>
    );
  }

  return (
    <>
      {state.account === "cleaner" ? (
        <View
        style={{
          ...homePageStyles.container,
          flexDirection: "column",
          marginTop: 100,
        }}
      >
          {todaysAppointment}
          {nextAppointment}
          <ReviewsOverview state={state} dispatch={dispatch}/>
        </View>
      ) : (
        <View
      style={{
        ...homePageStyles.container,
        flexDirection: "column",
        marginTop: 105,
      }}
    >
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
      </View>
      )}
    </>
    
  );
};

export default HomePage;
