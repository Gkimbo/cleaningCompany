import React, { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text } from "react-native";
import { useNavigate } from "react-router-native";
import { Feather } from "@expo/vector-icons";

const AccountSettingsButton = ({ closeModal }) => {
  const [redirect, setRedirect] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (redirect) {
      navigate("/account-settings");
      setRedirect(false);
    }
  }, [redirect]);

  const handlePress = () => {
    closeModal();
    setRedirect(true);
  };

  return (
    <Pressable
      style={({ pressed }) => [styles.button, pressed && { opacity: 0.8 }]}
      onPress={handlePress}
    >
      <Feather name="settings" size={18} color="#fff" style={styles.icon} />
      <Text style={styles.buttonText}>Account Settings</Text>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  button: {
    marginVertical: 8,
    backgroundColor: "rgba(255, 255, 255, 0.3)",
    borderRadius: 50,
    paddingVertical: 10,
    paddingHorizontal: 20,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.3)",
    shadowColor: "#FF4500",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 6,
    elevation: 4,
  },
  buttonText: {
    color: "#fff",
    fontWeight: "600",
    fontSize: 16,
    textShadowColor: "rgba(0,0,0,0.35)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  icon: {
    marginRight: 8,
  },
});

export default AccountSettingsButton;
