import React, { useState, useEffect } from "react";
import { View, Text, ScrollView, StyleSheet } from "react-native";
import homePageStyles from "../../../services/styles/HomePageStyles";
import FetchData from "../../../services/fetchRequests/fetchData";

const ListOfApplications = () => {
  const [listApplications, setApplicationsList] = useState([]);

  useEffect(() => {
    FetchData.getApplicationsFromBackend().then((response) => {
      console.log(response.serializedApplications);
      setApplicationsList(response.serializedApplications);
    });
  }, []);

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.header}>Applications List</Text>
      <View>
        {listApplications.length > 0 ? (
          listApplications.map((application, index) => (
            <View key={index} style={styles.card}>
              <Text style={styles.name}>
                {application.firstName} {application.lastName}
              </Text>
              <Text style={styles.label}>Availability: <Text style={styles.value}>{application.availability}</Text></Text>
              <Text style={styles.label}>Email: <Text style={styles.value}>{application.email}</Text></Text>
              <Text style={styles.label}>Phone: <Text style={styles.value}>{application.phone}</Text></Text>
              <Text style={styles.label}>Experience: <Text style={styles.value}>{application.experience}</Text></Text>
              <Text style={styles.label}>Message:</Text>
              <Text style={styles.message}>{application.message}</Text>
            </View>
          ))
        ) : (
          <Text style={styles.noData}>No applications found.</Text>
        )}
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    marginTop: "30%",
  },
  header: {
    fontSize: 22,
    fontWeight: "bold",
    textAlign: "center",
    marginBottom: 15,
  },
  card: {
    backgroundColor: "#f8f9fa",
    padding: 15,
    marginVertical: 8,
    borderRadius: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  name: {
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 5,
  },
  label: {
    fontSize: 14,
    fontWeight: "600",
    marginTop: 4,
  },
  value: {
    fontWeight: "400",
  },
  message: {
    marginTop: 4,
    fontStyle: "italic",
    color: "#555",
  },
  noData: {
    textAlign: "center",
    fontSize: 16,
    color: "#888",
  },
});

export default ListOfApplications;

