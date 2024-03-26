import React, { useEffect } from "react";
import { View, Text } from "react-native";
import { useParams } from "react-router-native";
import UserFormStyles from "../../../services/styles/UserInputFormStyle";
import FetchData from "../../../services/fetchRequests/fetchData";

const AppointmentDetailsPage = ({ state }) => {

  const { id } = useParams();
  useEffect(()=>{
    const response =  FetchData.get(
        "/api/v1/appointments/unassigned",
        state.currentUser.token
      ).then
  },[])
  return (
    <View style={UserFormStyles.container}>
      <Text>{`This is the details for the appointment: ${id}`}</Text>
    </View>
  );
};

export default AppointmentDetailsPage;
