import React, { useEffect, useState } from "react";
import { LayoutAnimation, Pressable, StyleSheet, Text, View } from "react-native";
import { useNavigate } from "react-router-native";
import FetchData from "../../../services/fetchRequests/fetchData";

const EmployeeAssignmentTile = ({
  id,
  cleanerId,
  date,
  price,
  homeId,
  bringSheets,
  bringTowels,
  completed,
  keyPadCode,
  keyLocation,
  addEmployee,
  removeEmployee,
  assigned,
  distance,
  timeToBeCompleted,
}) => {
  const navigate = useNavigate();
  const [expandWindow, setExpandWindow] = useState(false);
  const [home, setHome] = useState({
    address: "",
    city: "",
    state: "",
    zipcode: "",
    numBaths: "",
    numBeds: "",
    cleanersNeeded: "",
  });

  const amount = Number(price) * 0.9;

  const formatDate = (dateString) => {
    const date = new Date(dateString + "T00:00:00");
    const options = { weekday: "long", month: "short", day: "numeric", year: "numeric" };
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
  }, [homeId]);

  const miles = distance ? (distance * 0.621371).toFixed(1) : null;
  const kilometers = distance ? distance.toFixed(1) : null;

  const timeOptions = {
    anytime: "anytime",
    "10-3": "Between 10am and 3pm",
    "11-4": "Between 11am and 4pm",
    "12-2": "Between 12pm and 2pm",
  };

  const formattedTime = timeOptions[timeToBeCompleted] || null;

  return (
    <View style={styles.tileContainer}>
      <Pressable onPress={expandWindow ? contractDetails : expandDetails}>
        <Text style={styles.date}>{formatDate(date)}</Text>

        {formattedTime && (
          <View style={styles.timeContainer}>
            <Text style={styles.timeLabel}>Time to complete:</Text>
            <Text style={styles.timeText}>{`${formattedTime} on ${formatDate(date)}`}</Text>
          </View>
        )}

        <Text style={styles.amount}>You could make ${amount} cleaning this home</Text>
        <Text style={styles.location}>{home.city}</Text>
        <Text style={styles.location}>
          {home.state}, {home.zipcode}
        </Text>

        <View style={styles.distanceContainer}>
          {distance !== null ? (
            <>
              <Text style={styles.distanceLabel}>Distance to the center of town:</Text>
              <Text style={styles.distanceValue}>
                {miles} mi <Text style={styles.distanceKm}>({kilometers} km)</Text>
              </Text>
              <Text style={styles.addressInfo}>Address available on the day of the appointment.</Text>
            </>
          ) : (
            <Text style={styles.unknownDistance}>Distance: Unknown</Text>
          )}
        </View>

        {(expandWindow || assigned) && (
          <>
            <Text style={styles.infoText}>Beds: {home.numBeds}</Text>
            <Text style={styles.infoText}>Bathrooms: {home.numBaths}</Text>
            <Text style={styles.infoText}>Sheets needed: {bringSheets}</Text>
            <Text style={styles.infoText}>Towels needed: {bringTowels}</Text>

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

      {assigned ? (
        <Pressable
          style={[styles.button, { backgroundColor: "#E74C3C" }]}
          onPress={() => removeEmployee(cleanerId, id)}
        >
          <Text style={styles.buttonText}>I no longer want to clean this home!</Text>
        </Pressable>
      ) : (
        <Pressable
          style={[styles.button, { backgroundColor: "#2ECC71" }]}
          onPress={() => addEmployee(cleanerId, id)}
        >
          <Text style={styles.buttonText}>I want to clean this home!</Text>
        </Pressable>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  tileContainer: {
    backgroundColor: "#fff",
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
  amount: {
    fontSize: 15,
    fontWeight: "600",
    color: "#34495E",
    marginBottom: 6,
    textAlign: "center",
  },
  location: {
    fontSize: 14,
    fontWeight: "500",
    color: "#7F8C8D",
    textAlign: "center",
  },
  distanceContainer: {
    marginVertical: 10,
  },
  distanceLabel: {
    fontSize: 12,
    color: "#7F8C8D",
    marginBottom: 4,
  },
  distanceValue: {
    fontSize: 16,
    fontWeight: "700",
    color: "#2C3E50",
  },
  distanceKm: {
    fontSize: 12,
    color: "#7F8C8D",
  },
  addressInfo: {
    fontSize: 12,
    color: "#95A5A6",
    marginTop: 4,
    textAlign: "center",
  },
  unknownDistance: {
    fontSize: 14,
    color: "#95A5A6",
    textAlign: "center",
  },
  infoText: {
    fontSize: 14,
    color: "#34495E",
    marginTop: 4,
    textAlign: "center",
  },
  warning: {
    fontSize: 14,
    fontWeight: "bold",
    color: "#E74C3C",
    marginTop: 8,
    textAlign: "center",
  },
  button: {
    paddingVertical: 12,
    paddingHorizontal: 18,
    borderRadius: 10,
    marginTop: 12,
    justifyContent: "center",
    alignItems: "center",
    minWidth: "80%",
  },
  buttonText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#fff",
    textAlign: "center",
  },
  timeContainer: {
    alignItems: "center",
    marginVertical: 10,
  },
  timeLabel: {
    fontSize: 14,
    fontWeight: "bold",
    color: "#34495E",
  },
  timeText: {
    fontSize: 13,
    color: "#7F8C8D",
    marginTop: 2,
    textAlign: "center",
  },
});

export default EmployeeAssignmentTile;
