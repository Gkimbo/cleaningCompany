import React, { useEffect, useState } from "react";
import { Dimensions, Pressable, StyleSheet } from "react-native";
import Icon from "react-native-vector-icons/FontAwesome";
import { useNavigate } from "react-router-native";

const HomeButton = () => {
  const [redirect, setRedirect] = useState(false);
  const navigate = useNavigate();
  const { width } = Dimensions.get("window");
  const iconSize = width < 400 ? 18 : width < 800 ? 20 : 22;

  useEffect(() => {
    if (redirect) {
      navigate("/");
      setRedirect(false);
    }
  }, [redirect]);

  const handlePress = () => setRedirect(true);

  return (
    <Pressable
      style={({ pressed }) => [
        styles.glassButton,
        pressed && { backgroundColor: "rgba(255,255,255,0.25)" },
      ]}
      onPress={handlePress}
    >
      <Icon name="home" size={iconSize} color="#fff" />
    </Pressable>
  );
};

const styles = StyleSheet.create({
  glassButton: {
    backgroundColor: "rgba(255, 255, 255, 0.15)",
    borderRadius: 50,
    padding: 10,
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
});

export default HomeButton;
