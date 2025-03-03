import React, { useEffect, useState, useMemo } from "react";
import { Pressable, Text, View, LayoutAnimation } from "react-native";
import FetchData from "../../../services/fetchRequests/fetchData";
import { StyleSheet } from "react-native";
import EmployeeTile from "./EmployeeTile";

const RequestResponseTile = ({
  id,
  state,
  date,
  homeId,
  bringSheets,
  bringTowels,
  approveRequest,
  denyRequest,
  assigned,
}) => {
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
  const requestArray = useMemo(
    () => state.requests.map((request) => request.request) || [],
    [state]
  );
  const requestsForThisAppointment = requestArray.filter(
    (request) => request.appointmentId === id
  );
  const employeeIds = requestsForThisAppointment.map(
    (request) => request.employeeId
  );
  const employeeArray = useMemo(() => {
    if (!state.requests || state.requests.length === 0) {
      return [];
    }
    const uniqueEmployees = new Map();
    state.requests.forEach((request) => {
      uniqueEmployees.set(
        request.employeeRequesting.id,
        request.employeeRequesting
      );
    });
    return Array.from(uniqueEmployees.values());
  }, [state]);

  const matchingEmployees = employeeArray.filter((employee) =>
    employeeIds.includes(employee.id)
  );
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

  return (
    <View style={styles.homeTileContainer}>
      <Pressable onPress={expandWindow ? contractDetails : expandDetails}>
        <Text style={styles.appointmentDate}>{formatDate(date)}</Text>
        <Text style={styles.appointmentPrice}>{home.address}</Text>
        <Text style={styles.appointmentPrice}>{home.city}</Text>
        <Text style={styles.appointmentPrice}>
          {home.state}, {home.zipcode}
        </Text>
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
          </>
        )}
        <View style={{ flex: 1 }}>
          {matchingEmployees.map((employee) => (
            <View key={employee.id}>
              <EmployeeTile
                id={employee.id}
                username={employee.username}
                reviews={employee.reviews}
                approveRequest={approveRequest}
                denyRequest={denyRequest}
              />
            </View>
          ))}
        </View>
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

export default RequestResponseTile;
