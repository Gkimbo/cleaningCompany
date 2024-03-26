import React from "react";
import { Pressable, Text, View } from "react-native";
import { useNavigate } from "react-router-native";
import homePageStyles from "../../services/styles/HomePageStyles";

const AppointmentTile = ({
  id,
  date,
  price,
  homeId,
  empoyeesNeeded,
  employeesAssigned,
  hasBeenAssigned,
}) => {
  const navigate = useNavigate();
  const assignedCleaners = JSON.parse(employeesAssigned);
  const numberOfAssigned = employeesAssigned.length;

  const formatDate = (dateString) => {
    const options = { month: "short", day: "numeric", year: "numeric" };
    return new Date(dateString).toLocaleDateString(undefined, options);
  };
//CREATE ROUTE TO DETAILS PAGE WHERE EMPLOYEES CAN BE ASSINED AND REMOVED
  const handleAppointmentPress = () => {
    navigate(`/assign-cleaner/${id}`);
  };

  return (
    <View style={[homePageStyles.eachAppointment]}>
      <Text style={homePageStyles.appointmentDate}>{formatDate(date)}</Text>
      <Text style={homePageStyles.appointmentPrice}>$ {price}</Text>
      {!hasBeenAssigned && (
        <>
          <Text style={homePageStyles.appointmentBanner}>NEEDS CLEANERS!</Text>
          <Text style={homePageStyles.appointmentPrice}>
            Number of cleaners needed: {empoyeesNeeded - numberOfAssigned}
          </Text>
          <Text style={homePageStyles.appointmentPrice}>
            Number of cleaners assigned {numberOfAssigned}
          </Text>
          <Pressable
            style={homePageStyles.backButtonForm}
            onPress={handleAppointmentPress}
          >Assign Employees</Pressable>
        </>
      )}
    </View>
  );
};

export default AppointmentTile;
