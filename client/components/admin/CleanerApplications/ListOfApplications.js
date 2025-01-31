import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
} from "react-native";

const ListOfApplications = (state, applicationList, setApplicationList) => {
  return (
    <View>
      {applicationList.map((application) => {
        return application.firstName;
      })}
    </View>
  );
};

export default ListOfApplications;
