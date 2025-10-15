import AsyncStorage from "@react-native-async-storage/async-storage";
import React from "react";
import { Dimensions, Pressable, Text, View } from "react-native";
import Icon from "react-native-vector-icons/FontAwesome";
import { useNavigate } from "react-router-native";
import topBarStyles from "../../services/styles/TopBarStyles";

const SignOutButton = ({ dispatch }) => {
  const { width } = Dimensions.get("window");
  const iconSize = width < 400 ? 12 : width < 800 ? 16 : 20;
  const navigate = useNavigate();

  const signOut = async () => {
    try {
      const response = await fetch("http://localhost:3000/api/v1/user-sessions/logout", {
        method: "POST",
        credentials: "include",
      });

      if (response.ok) {
        await AsyncStorage.removeItem("token");
        dispatch({ type: "CURRENT_USER", payload: null });
        dispatch({ type: "USER_ACCOUNT", payload: null });
        navigate("/");
      } else {
        console.error("Failed to log out");
      }
    } catch (error) {
      console.error("An error occurred while logging out:", error);
    }
  };

  return (
    <Pressable style={topBarStyles.signOutButton} onPress={signOut}>
      <View style={{ flexDirection: "row" }}>
        <Text style={{ ...topBarStyles.buttonTextSchedule, marginRight: 10 }}>
          Sign Out
        </Text>
        <Icon name="sign-out" size={iconSize} color="black" />
      </View>
    </Pressable>
  );
};

export default SignOutButton;
