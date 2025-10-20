import React, { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import FetchData from "../../../services/fetchRequests/fetchData";

const TodaysAppointment = ({ appointment }) => {
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

  useEffect(() => {
    FetchData.getHome(appointment.homeId).then((response) => {
      setHome(response.home);
    });
  }, [appointment.homeId]);

  return (
    <View style={styles.tileContainer}>
      <Text style={styles.date}>{formatDate(appointment.date)}</Text>
      <Text style={styles.location}>{home.address} - {home.city}</Text>
      <Text style={styles.location}>{home.state}, {home.zipcode}</Text>
      {home.keyPadCode && <Text style={styles.infoText}>Code to get in: {home.keyPadCode}</Text>}
      {home.keyLocation && <Text style={styles.infoText}>Key Location: {home.keyLocation}</Text>}
      <Text style={styles.infoText}>Contact: {home.contact}</Text>
      <Text style={styles.infoText}>Beds: {home.numBeds}</Text>
      <Text style={styles.infoText}>Bathrooms: {home.numBaths}</Text>
      <Text style={styles.infoText}>Sheets needed: {appointment.bringSheets}</Text>
      <Text style={styles.infoText}>Towels needed: {appointment.bringTowels}</Text>
      <Text style={styles.amount}>Payout: ${correctedAmount}</Text>
      {home.specialNotes && <Text style={styles.notes}>Notes: {home.specialNotes}</Text>}
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
    marginBottom: 2,
  },
  infoText: {
    fontSize: 13,
    color: "#7F8C8D",
    textAlign: "center",
    marginTop: 2,
  },
  amount: {
    fontSize: 16,
    fontWeight: "600",
    color: "#2C3E50",
    marginTop: 8,
    textAlign: "center",
  },
  notes: {
    fontSize: 14,
    fontWeight: "500",
    color: "#E67E22",
    marginTop: 6,
    textAlign: "center",
  },
});

export default TodaysAppointment;
