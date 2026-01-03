import React, { useEffect, useState } from "react";
import { Pressable, Text } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useNavigate } from "react-router-native";
import ButtonStyles from "../../services/styles/ButtonStyles";

const MyRequestsButton = ({ closeModal }) => {
  const [redirect, setRedirect] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (redirect) {
      navigate("/my-requests");
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
      <Feather name="inbox" size={18} color="#E5E7EB" style={{ marginRight: 12 }} />
      <Text style={ButtonStyles.buttonText}>My Requests</Text>
    </Pressable>
  );
};

export default MyRequestsButton;
