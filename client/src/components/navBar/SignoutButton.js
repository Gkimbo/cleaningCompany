import React, { useContext } from "react";
import { Pressable, Text } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useNavigate } from "react-router-native";
import { API_BASE } from "../../services/config";
import { AuthContext } from "../../services/AuthContext";
import ButtonStyles from "../../services/styles/ButtonStyles";

const SignOutButton = ({ dispatch, closeModal }) => {
  const navigate = useNavigate();
  const { logout } = useContext(AuthContext);

  const signOut = async () => {
    try {
      // Call backend to clear server-side session
      await fetch(`${API_BASE}/user-sessions/logout`, {
        method: "POST",
        credentials: "include",
      });

      // Use AuthContext logout to properly clear SecureStorage token
      await logout(true); // force logout without sync check

      // Clear reducer state
      dispatch({ type: "LOGOUT" });

      if (closeModal) closeModal();
      navigate("/");
    } catch (error) {
      console.error("An error occurred while logging out:", error);
      // Still try to clear local state even if backend call fails
      await logout(true);
      dispatch({ type: "LOGOUT" });
      if (closeModal) closeModal();
      navigate("/");
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
