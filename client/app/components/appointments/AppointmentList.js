import React, { useEffect, useState } from "react";
import { Dimensions, Pressable, ScrollView, Text, View } from "react-native";
import Icon from "react-native-vector-icons/FontAwesome";
import { useNavigate } from "react-router-native";
import FetchData from "../../services/fetchRequests/fetchData";
import homePageStyles from "../../services/styles/HomePageStyles";
import topBarStyles from "../../services/styles/TopBarStyles";
import HomeAppointmentTile from "../tiles/HomeAppointmentTile";

const AppointmentList = ({ state, dispatch }) => {
  const [allHomes, setAllHomes] = useState([]);
  const [allAppointments, setAllAppointments] = useState([]);
  const [changesSubmitted, setChangesSubmitted] = useState(false);
  const [redirect, setRedirect] = useState(false);
  const [backRedirect, setBackRedirect] = useState(false);
  const { width } = Dimensions.get("window");
  const iconSize = width < 400 ? 12 : width < 800 ? 16 : 20;
  const navigate = useNavigate();

  useEffect(() => {
    if (state.currentUser.token) {
      FetchData.get("/api/v1/user-info", state.currentUser.token).then(
        (response) => {
          dispatch({
            type: "USER_HOME",
            payload: response.user.homes,
          });
          setAllHomes(response.user.homes);
          dispatch({
            type: "USER_APPOINTMENTS",
            payload: response.user.appointments,
          });
          setAllAppointments(response.user.appointments);
          dispatch({
            type: "DB_BILL",
            payload: response.user.bill,
          });
        }
      );
    }
    setChangesSubmitted(false);
    if (redirect) {
      navigate("/add-home");
      setRedirect(false);
    }
    if (backRedirect) {
      navigate("/");
      setBackRedirect(false);
    }
  }, [redirect, backRedirect, changesSubmitted]);

  const handlePress = () => {
    setRedirect(true);
  };

  const handleBackPress = () => {
    setBackRedirect(true);
  };

  const usersHomes = state.homes.map((home) => (
    <View key={home.id} style={{ marginBottom: 16 }}>
      <HomeAppointmentTile
        id={home.id}
        nickName={home.nickName}
        address={home.address}
        city={home.city}
        state={home.state}
        zipcode={home.zipcode}
        contact={home.contact}
        allAppointments={allAppointments}
        setChangesSubmitted={setChangesSubmitted}
      />
    </View>
  ));

  return (
    <View style={{ ...homePageStyles.container, flex: 1, marginTop: 10 }}>
      {/* Back Button */}
      <View style={homePageStyles.backButtonAppointmentList}>
        <Pressable style={{...homePageStyles.backButtonForm, width: 10}} onPress={handleBackPress}>
          <View style={{ flexDirection: "row", alignItems: "center", padding: 10 }}>
            <Icon name="angle-left" size={iconSize} color="black" />
            <View style={{ marginLeft: 15 }}>
              <Text style={topBarStyles.buttonTextSchedule}>Back</Text>
            </View>
          </View>
        </Pressable>
      </View>

      {/* Scrollable List of Homes */}
      <ScrollView contentContainerStyle={{ paddingBottom: 20 }}>
        {state.homes.length > 0 ? (
          <>
            {usersHomes}
            <Pressable style={homePageStyles.AddHomeButton} onPress={handlePress}>
              <Text style={homePageStyles.AddHomeButtonText}>Add another Home</Text>
            </Pressable>
          </>
        ) : (
          <Pressable style={homePageStyles.AddHomeButton} onPress={handlePress}>
            <Text style={homePageStyles.AddHomeButtonText}>Add a Home</Text>
          </Pressable>
        )}
      </ScrollView>
    </View>
  );
};

export default AppointmentList;
