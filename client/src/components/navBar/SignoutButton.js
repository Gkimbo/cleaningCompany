import AsyncStorage from "@react-native-async-storage/async-storage";
import React from "react";
import { Pressable, Text } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useNavigate } from "react-router-native";
import { API_BASE } from "../../services/config";
import ButtonStyles from "../../services/styles/ButtonStyles";

const SignOutButton = ({ dispatch, closeModal }) => {
  const navigate = useNavigate();

  const signOut = async () => {
    try {
      const response = await fetch(`${API_BASE}/user-sessions/logout`, {
        method: "POST",
        credentials: "include",
      });

      if (response.ok) {
        await AsyncStorage.removeItem("token");
        dispatch({ type: "LOGOUT" });
        if (closeModal) closeModal();
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
        ButtonStyles.glassButton,
        pressed && ButtonStyles.glassButtonPressed,
      ]}
      onPress={signOut}
    >
      <Feather name="log-out" size={18} color="#E5E7EB" style={{ marginRight: 12 }} />
      <Text style={ButtonStyles.buttonText}>Sign Out</Text>
    </Pressable>
  );
};

export default SignOutButton;
