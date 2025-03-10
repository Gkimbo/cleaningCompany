import React, { useEffect, useState } from "react";
import { Pressable, Text, View, LayoutAnimation } from "react-native";
import { useNavigate } from "react-router-native";
import homePageStyles from "../../../services/styles/HomePageStyles";
import FetchData from "../../../services/fetchRequests/fetchData";
import { StyleSheet } from "react-native";

const RequestedTile = ({
  id,
  cleanerId,
  date,
  price,
  homeId,
  bringSheets,
  bringTowels,
  removeRequest,
  assigned,
  distance,
  timeToBeCompleted
}) => {
  const navigate = useNavigate();
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
  });

  const amount = Number(price) * 0.9;
  const formatDate = (dateString) => {
    const date = new Date(dateString + "T00:00:00");
    const options = {
      weekday: "long",
      month: "short",
      day: "numeric",
      year: "numeric",
    };
    return date.toLocaleDateString(undefined, options);
  };

  const expandDetails = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpandWindow(true);
  };

  const contractDetails = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpandWindow(false);
  };

  useEffect(() => {
    FetchData.getHome(homeId).then((response) => {
      setHome(response.home);
    });
  }, []);

  const miles = distance ? (distance * 0.621371).toFixed(1) : null;
  const kilometers = distance ? distance.toFixed(1) : null;

  return (
    <View style={styles.homeTileContainer}>
      <Pressable onPress={expandWindow ? contractDetails : expandDetails}>
        <Text style={styles.appointmentDate}>{formatDate(date)}</Text>
        <Text style={{ ...styles.appointmentDate, fontSize: 15 }}>
          {`You could make $${amount} cleaning this home`}
        </Text>
        <Text style={styles.appointmentPrice}>{home.city}</Text>
        <Text style={styles.appointmentPrice}>
          {home.state}, {home.zipcode}
        </Text>
        <View style={styles.distanceContainer}>
          {distance !== null ? (
            <>
              <Text style={styles.distanceText}>
                Distance to the center of town:
              </Text>
              <Text style={styles.distanceValue}>
                {miles} mi{" "}
                <Text style={styles.distanceKm}>({kilometers} km)</Text>
              </Text>
              <Text style={styles.addressInfo}>
                Address will be available on the day of the appointment.
              </Text>
            </>
          ) : (
            <Text style={styles.unknownDistance}>Distance: Unknown</Text>
          )}
        </View>

        {(expandWindow || assigned) && (
          <>
            <Text style={styles.appointmentDetails}>
              Number of Beds: {home.numBeds}
            </Text>
            <Text style={styles.appointmentDetails}>
              Number of Bathrooms: {home.numBaths}
            </Text>
            <Text style={styles.appointmentDetails}>
              Sheets are needed: {bringSheets}
            </Text>
            <Text style={styles.appointmentDetails}>
              Towels are needed: {bringTowels}
            </Text>
            {home.cleanersNeeded > 1 && (
              <>
                <Text style={styles.largeHomeMessage}>
                  This is a larger home. You may need more people to clean it in
                  a timely manner.
                </Text>
                <Text style={styles.smallHomeMessage}>
                  If you don’t think you can complete it, please choose a
                  smaller home!
                </Text>
              </>
            )}
          </>
        )}
      </Pressable>
      <View style={[styles.button, { backgroundColor: "blue" }]}>
        <Text style={styles.buttonText}>Request to clean sent!</Text>
      </View>
      <Pressable
        style={[styles.button, { backgroundColor: "#E74C3C" }]}
        onPress={() => removeRequest(cleanerId, id)}
      >
        <Text style={styles.buttonText}>
          Cancel Request!
        </Text>
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

export default RequestedTile;
