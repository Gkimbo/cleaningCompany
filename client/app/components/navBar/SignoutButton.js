import AsyncStorage from "@react-native-async-storage/async-storage";
import React from "react";
import { Dimensions, Pressable, StyleSheet, Text, View } from "react-native";
import Icon from "react-native-vector-icons/FontAwesome";
import { useNavigate } from "react-router-native";

const SignOutButton = ({ dispatch }) => {
  const { width } = Dimensions.get("window");
  const iconSize = width < 400 ? 16 : width < 800 ? 18 : 20;
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
    <Pressable
      style={({ pressed }) => [
        styles.glassButton,
        pressed && { backgroundColor: "rgba(255,255,255,0.25)" },
      ]}
      onPress={signOut}
    >
      <View style={styles.row}>
        <Icon name="sign-out" size={iconSize} color="rgba(0, 0, 0, 0.5)" style={{ marginRight: 8 }} />
        <Text style={styles.buttonText}>Sign Out</Text>
      </View>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  glassButton: {
    marginTop: 15,
    backgroundColor: "rgba(255, 255, 255, 0.59)",
    borderRadius: 50,
    paddingVertical: 10,
    paddingHorizontal: 20,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.3)",
    shadowColor: "#00BFFF",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 4,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  buttonText: {
    color: "rgba(0, 0, 0, 0.5)",
    fontWeight: "600",
    fontSize: 16,
  },
});

export default SignOutButton;
