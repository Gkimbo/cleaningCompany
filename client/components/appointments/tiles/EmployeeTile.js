import React, {useState} from "react";
import { Pressable, Text, View, LayoutAnimation } from "react-native";
import { useNavigate } from "react-router-native";
import { StyleSheet } from "react-native";

const EmployeeTile = ({ id, username, approveRequest, denyRequest }) => {
  const navigate = useNavigate();
  const [expandWindow, setExpandWindow] = useState(false);

  const expandDetails = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpandWindow(true);
  };

  const contractDetails = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpandWindow(false);
  };

  return (
    <View style={styles.homeTileContainer}>
      <Pressable onPress={expandWindow ? contractDetails : expandDetails}>
        
        <Text style={styles.appointmentPrice}>{username}</Text>
      </Pressable>
      <Pressable
        style={[styles.button, { backgroundColor: "green" }]}
        onPress={() => approveRequest(cleanerId, id)}
      >
        <Text style={styles.buttonText}>Approve Cleaner!</Text>
      </Pressable>
      <Pressable
        style={[styles.button, { backgroundColor: "#E74C3C" }]}
        onPress={() => denyRequest(cleanerId, id)}
      >
        <Text style={styles.buttonText}>Deny Cleaner!</Text>
      </Pressable>
    </View>
  );
};

const styles = StyleSheet.create({
  homeTileContainer: {
    backgroundColor: "#ffffff",
    padding: 20,
    marginVertical: 12,
    borderRadius: 12,
    shadowColor: "#2C3E50",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 5,
  },
  appointmentDate: {
    fontSize: 18,
    fontWeight: "700",
    color: "#34495E",
    marginBottom: 8,
    textAlign: "center",
  },
  appointmentPrice: {
    fontSize: 16,
    fontWeight: "600",
    color: "#7F8C8D",
    textAlign: "center",
  },
  distanceContainer: {
    marginVertical: 12,
  },
  distanceText: {
    fontSize: 12,
    color: "#7F8C8D",
    marginBottom: 4,
  },
  distanceValue: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#2C3E50",
  },
  distanceKm: {
    fontSize: 14,
    color: "#7F8C8D",
  },
  addressInfo: {
    fontSize: 12,
    color: "#95A5A6",
    marginTop: 6,
  },
  unknownDistance: {
    fontSize: 14,
    color: "#95A5A6",
    textAlign: "center",
  },
  appointmentDetails: {
    fontSize: 16,
    fontWeight: "600",
    color: "#34495E",
    marginTop: 6,
  },
  largeHomeMessage: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#E74C3C",
    marginTop: 12,
  },
  smallHomeMessage: {
    fontSize: 14,
    color: "#7F8C8D",
  },
  button: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    marginTop: 15,
    justifyContent: "center",
    alignItems: "center",
  },
  buttonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#ffffff",
  },
});

export default EmployeeTile;
