import React, { useEffect, useState } from "react";
import { Pressable, Text } from "react-native";
import { useNavigate } from "react-router-native";
import ButtonStyles from "../../services/styles/ButtonStyles";

const IncentivesButton = ({ closeModal }) => {
  const [redirect, setRedirect] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (redirect) {
      navigate("/owner/incentives");
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
        pressed && { backgroundColor: "rgba(255,255,255,0.25)" },
      ]}
      onPress={handlePress}
    >
      <Text style={ButtonStyles.buttonText}>Incentives</Text>
    </Pressable>
  );
};

export default IncentivesButton;
