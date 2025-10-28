import React, { useEffect, useState } from "react";
import { Dimensions, Pressable, Text, View } from "react-native";
import Icon from "react-native-vector-icons/FontAwesome";
import { useNavigate } from "react-router-native";
import homePageStyles from "../../services/styles/HomePageStyles";
import HomeTile from "../tiles/HomeTile";

const HomeList = ({ state, dispatch }) => {
  const [redirect, setRedirect] = useState(false);
  const [backRedirect, setBackRedirect] = useState(false);
  const { width } = Dimensions.get("window");
  const iconSize = width < 400 ? 12 : width < 800 ? 16 : 20;
  const navigate = useNavigate();

  useEffect(() => {
    if (redirect) {
      navigate("/add-home");
      setRedirect(false);
    }
    if (backRedirect) {
      navigate("/");
      setBackRedirect(false);
    }
  }, [redirect, backRedirect]);

  const handlePress = () => {
    setRedirect(true);
  };

  const handleBackPress = () => {
    setBackRedirect(true);
  };

  const usersHomes = state.homes.map((home) => {
    return (
      <View key={home.id}>
        <HomeTile
          id={home.id}
          nickName={home.nickName}
          state={home.state}
          address={home.address}
          city={home.city}
          zipcode={home.zipcode}
          numBeds={home.numBeds}
          numBaths={home.numBaths}
          sheetsProvided={home.sheetsProvided}
          towelsProvided={home.towelsProvided}
          keyPadCode={home.keyPadCode}
          keyLocation={home.keyLocation}
          recyclingLocation={home.recyclingLocation}
          compostLocation={home.compostLocation}
          trashLocation={home.trashLocation}
        />
      </View>
    );
  });

  return (
    <View
      style={{
        ...homePageStyles.container,
        flexDirection: "column",
      }}
    >
      <View style={homePageStyles.backButtonContainerList}>
        <Pressable
          style={homePageStyles.backButtonForm}
          onPress={handleBackPress}
        >
          <Icon name="angle-left" size={iconSize + 2} color="white" />
          <Text
            style={{
              color: "white",
              fontWeight: "700",
              fontSize: width < 400 ? 14 : width < 800 ? 16 : 18,
              marginLeft: 10,
              letterSpacing: 0.5,
              textShadowColor: "rgba(0,0,0,0.2)",
              textShadowOffset: { width: 0, height: 1 },
              textShadowRadius: 2,
            }}
          >
            Back
          </Text>
        </Pressable>
      </View>

      <View>
        {state.homes.length > 0 ? (
          <>
            {usersHomes}
            <Pressable
              style={homePageStyles.AddHomeButton}
              onPress={handlePress}
            >
              <Text style={homePageStyles.AddHomeButtonText}>
                Add another Home
              </Text>
            </Pressable>
          </>
        ) : (
          <Pressable style={homePageStyles.AddHomeButton} onPress={handlePress}>
            <Text style={homePageStyles.AddHomeButtonText}>Add a Home</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
};

export default HomeList;
