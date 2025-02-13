import React, { useState, useEffect } from "react";
import { View, Text, ScrollView, StyleSheet } from "react-native";
import homePageStyles from "../../../services/styles/HomePageStyles";
import FetchData from "../../../services/fetchRequests/fetchData";
import ApplicationListStyles from "../../../services/styles/ApplicationListStyles"

const ListOfApplications = () => {
  const [listApplications, setApplicationsList] = useState([]);
  const styles = ApplicationListStyles

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

export default ListOfApplications;

