import React, { useEffect, useState } from "react";
import { Pressable, Text } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useNavigate } from "react-router-native";
import ButtonStyles from "../../services/styles/ButtonStyles";

const ManagePricingButton = ({ closeModal }) => {
  const [redirect, setRedirect] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (redirect) {
      navigate("/owner/pricing");
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
      <Feather name="dollar-sign" size={18} color="#E5E7EB" style={{ marginRight: 12 }} />
      <Text style={ButtonStyles.buttonText}>Manage Pricing</Text>
    </Pressable>
  );
};

export default ManagePricingButton;
