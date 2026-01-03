import React, { useEffect, useState } from "react";
import { Pressable, Text } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useNavigate } from "react-router-native";
import ButtonStyles from "../../services/styles/ButtonStyles";

const SeeAllAppointments = ({ closeModal }) => {
  const [redirect, setRedirect] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (redirect) {
      navigate("/all-appointments");
      setRedirect(false);
    }
  }, [redirect]);

  const handlePress = () => {
    closeModal();
    setRedirect(true);
  };

  return (
    <Pressable
      style={({ pressed }) => [
        ButtonStyles.glassButton,
        pressed && ButtonStyles.glassButtonPressed,
      ]}
      onPress={handlePress}
    >
      <Feather name="calendar" size={18} color="#E5E7EB" style={{ marginRight: 12 }} />
      <Text style={ButtonStyles.buttonText}>All Appointments</Text>
    </Pressable>
  );
};

export default SeeAllAppointments;
