import React, { useCallback } from "react";
import { Pressable, Text } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useNavigate } from "react-router-native";
import ButtonStyles from "../../services/styles/ButtonStyles";

const BecomeCleanerButton = ({ closeModal }) => {
  const navigate = useNavigate();

  const handlePress = useCallback(() => {
    closeModal();
    // Use setTimeout to allow modal to close before navigation
    setTimeout(() => {
      navigate("/apply");
    }, 0);
  }, [closeModal, navigate]);

  return (
    <Pressable
      style={({ pressed }) => [
        ButtonStyles.glassButton,
        pressed && ButtonStyles.glassButtonPressed,
      ]}
      onPress={handlePress}
    >
      <Feather name="briefcase" size={18} color="#E5E7EB" style={{ marginRight: 12 }} />
      <Text style={ButtonStyles.buttonText}>Become a Cleaner</Text>
    </Pressable>
  );
};

export default BecomeCleanerButton;
