import React, { useEffect, useState } from "react";
import { LayoutAnimation, Pressable, StyleSheet, Text, View } from "react-native";
import FetchData from "../../../services/fetchRequests/fetchData";

const NextAppointment = ({ appointment }) => {
  const [expandWindow, setExpandWindow] = useState(false);
  const [home, setHome] = useState({
    address: "",
    city: "",
    compostLocation: "",
    contact: "",
    keyLocation: "",
    keyPadCode: "",
    numBaths: "",
    numBeds: "",
    recyclingLocation: "",
    sheetsProvided: "",
    specialNotes: "",
    state: "",
    towelsProvided: "",
    trashLocation: "",
    zipcode: "",
    cleanersNeeded: "",
    timeToBeCompleted: "",
  });

  const formatDate = (dateString) => {
    const options = { weekday: "long", month: "short", day: "numeric", year: "numeric" };
    return new Date(dateString).toLocaleDateString(undefined, options);
  };

  const totalPrice = Number(appointment.price);
  const correctedAmount = totalPrice * 0.9;

  const expandDetails = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpandWindow(true);
  };

  const contractDetails = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpandWindow(false);
  };

  useEffect(() => {
    FetchData.getHome(appointment.homeId).then((response) => {
      setHome(response.home);
    });
  }, [appointment.homeId]);

  return (
    <View style={styles.tileContainer}>
      <Pressable onPress={expandWindow ? contractDetails : expandDetails}>
        <Text style={styles.date}>{formatDate(appointment.date)}</Text>
        <Text style={styles.location}>
          {home.city}, {home.state}, {home.zipcode}
        </Text>
        <Text style={styles.amount}>Payout: ${correctedAmount}</Text>

        {expandWindow && (
          <>
            <Text style={styles.infoText}>Beds: {home.numBeds}</Text>
            <Text style={styles.infoText}>Bathrooms: {home.numBaths}</Text>
            <Text style={styles.infoText}>Sheets needed: {appointment.bringSheets}</Text>
            <Text style={styles.infoText}>Towels needed: {appointment.bringTowels}</Text>
            {home.cleanersNeeded > 1 && (
              <>
                <Text style={styles.warning}>
                  This is a larger home. You may need more people to clean it in a timely manner.
                </Text>
                <Text style={styles.infoText}>
                  If you don’t think you can complete it, please choose a smaller home!
                </Text>
              </>
            )}
          </>
        )}
      </Pressable>
    </View>
  );
};

const styles = StyleSheet.create({
  tileContainer: {
    backgroundColor: "#ffffff",
    padding: 18,
    marginVertical: 10,
    borderRadius: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 4,
    alignItems: "center",
  },
  date: {
    fontSize: 18,
    fontWeight: "700",
    color: "#2C3E50",
    marginBottom: 6,
    textAlign: "center",
  },
  location: {
    fontSize: 14,
    fontWeight: "500",
    color: "#34495E",
    textAlign: "center",
    marginBottom: 4,
  },
  amount: {
    fontSize: 16,
    fontWeight: "600",
    color: "#2C3E50",
    marginBottom: 8,
    textAlign: "center",
  },
  infoText: {
    fontSize: 13,
    color: "#7F8C8D",
    marginTop: 2,
    textAlign: "center",
  },
  warning: {
    fontSize: 14,
    fontWeight: "bold",
    color: "#E74C3C",
    marginTop: 10,
    textAlign: "center",
  },
});

export default NextAppointment;
