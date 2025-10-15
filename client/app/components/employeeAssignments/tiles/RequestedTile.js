import React, { useEffect, useState } from "react";
import { LayoutAnimation, Pressable, StyleSheet, Text, View } from "react-native";
import { useNavigate } from "react-router-native";
import FetchData from "../../../services/fetchRequests/fetchData";

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
  timeToBeCompleted,
}) => {
  const navigate = useNavigate();
  const [expandWindow, setExpandWindow] = useState(false);
  const [home, setHome] = useState({});

  const amount = Number(price) * 0.9;

  const formatDate = (dateString) => {
    const date = new Date(dateString + "T00:00:00");
    const options = { weekday: "long", month: "short", day: "numeric", year: "numeric" };
    return date.toLocaleDateString(undefined, options);
  };

  const toggleDetails = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpandWindow(!expandWindow);
  };

  useEffect(() => {
    FetchData.getHome(homeId).then((response) => {
      setHome(response.home);
    });
  }, [homeId]);

  const miles = distance ? (distance * 0.621371).toFixed(1) : null;
  const kilometers = distance ? distance.toFixed(1) : null;
  const timeOptions = {
    anytime: "Anytime",
    "10-3": "Between 10am and 3pm",
    "11-4": "Between 11am and 4pm",
    "12-2": "Between 12pm and 2pm",
  };
  const formattedTime = timeOptions[timeToBeCompleted] || null;

  return (
    <View style={styles.tileContainer}>
      <Pressable onPress={toggleDetails} style={{ padding: 10 }}>
        <Text style={styles.date}>{formatDate(date)}</Text>

        {formattedTime && (
          <View style={styles.timeContainer}>
            <Text style={styles.timeLabel}>Time to complete:</Text>
            <Text style={styles.timeText}>{`${formattedTime} on ${formatDate(date)}`}</Text>
          </View>
        )}

        <Text style={styles.amount}>Potential Earnings: ${amount}</Text>
        <Text style={styles.location}>{home.city}, {home.state} {home.zipcode}</Text>

        <View style={styles.distanceContainer}>
          {distance !== null ? (
            <>
              <Text style={styles.distanceLabel}>Distance to center:</Text>
              <Text style={styles.distanceValue}>{miles} mi <Text style={styles.distanceKm}>({kilometers} km)</Text></Text>
              <Text style={styles.addressInfo}>Address available on the day of appointment.</Text>
            </>
          ) : (
            <Text style={styles.unknownDistance}>Distance: Unknown</Text>
          )}
        </View>

        {(expandWindow || assigned) && (
          <>
            <Text style={styles.detailText}>Beds: {home.numBeds}</Text>
            <Text style={styles.detailText}>Bathrooms: {home.numBaths}</Text>
            <Text style={styles.detailText}>Sheets needed: {bringSheets}</Text>
            <Text style={styles.detailText}>Towels needed: {bringTowels}</Text>
            {home.cleanersNeeded > 1 && (
              <>
                <Text style={styles.warningText}>This is a larger home. You may need more people.</Text>
                <Text style={styles.subWarningText}>If unsure, choose a smaller home!</Text>
              </>
            )}
          </>
        )}
      </Pressable>

      {/* Buttons */}
      <View style={styles.buttonsRow}>
        <View style={[styles.button, styles.glassBlue]}>
          <Text style={styles.buttonText}>Request Sent!</Text>
        </View>

        <Pressable
          style={[styles.button, styles.glassRed]}
          onPress={() => removeRequest(cleanerId, id)}
        >
          <Text style={styles.buttonText}>Cancel Request</Text>
        </Pressable>
      </View>
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
  },
  date: {
    fontSize: 18,
    fontWeight: "700",
    color: "#2C3E50",
    textAlign: "center",
    marginBottom: 6,
  },
  amount: {
    fontSize: 16,
    fontWeight: "600",
    color: "#34495E",
    textAlign: "center",
    marginBottom: 4,
  },
  location: {
    fontSize: 14,
    color: "#7F8C8D",
    textAlign: "center",
  },
  distanceContainer: {
    marginVertical: 12,
    alignItems: "center",
  },
  distanceLabel: {
    fontSize: 12,
    color: "#7F8C8D",
  },
  distanceValue: {
    fontSize: 16,
    fontWeight: "600",
    color: "#2C3E50",
  },
  distanceKm: {
    fontSize: 12,
    color: "#95A5A6",
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
  detailText: {
    fontSize: 15,
    fontWeight: "500",
    color: "#34495E",
    marginTop: 4,
  },
  warningText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#E74C3C",
    marginTop: 10,
  },
  subWarningText: {
    fontSize: 14,
    color: "#7F8C8D",
    marginBottom: 6,
  },
  timeContainer: {
    alignItems: "center",
    marginVertical: 10,
  },
  timeLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "#34495E",
  },
  timeText: {
    fontSize: 13,
    color: "#2C3E50",
    opacity: 0.8,
    marginTop: 2,
  },
  buttonsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 15,
  },
  button: {
    flex: 1,
    paddingVertical: 10,
    marginHorizontal: 5,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  glassBlue: {
    backgroundColor: "rgba(0, 123, 255, 0.2)",
    borderWidth: 1,
    borderColor: "rgba(0, 123, 255, 0.3)",
  },
  glassRed: {
    backgroundColor: "rgba(231, 76, 60, 0.2)",
    borderWidth: 1,
    borderColor: "rgba(231, 76, 60, 0.3)",
  },
  buttonText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#2C3E50",
  },
});

export default RequestedTile;
