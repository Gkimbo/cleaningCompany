import React from "react";
import { Pressable, Text, View } from "react-native";
import homePageStyles from "../../../services/styles/HomePageStyles";

const EmployeeShiftAssign = ({
  id,
  username,
  email,
  lastLogin,
  type,
  assigned,
  removeEmployee,
  addEmployee,
}) => {
  return (
    <View style={homePageStyles.homeTileContainer}>
      <Text style={homePageStyles.homeTileTitle}>{username}</Text>
      <Text style={homePageStyles.homeTileAddress}>{`Email: ${email}`}</Text>
      <Text
        style={homePageStyles.homeTileContent}
      >{`Last Login: ${lastLogin}`}</Text>
      <Text style={homePageStyles.homeTileContent}>{type}</Text>
      {assigned ? (
        <Pressable
          style={{
            ...homePageStyles.button,
            backgroundColor: "red",
            marginTop: 15,
          }}
          onPress={() => removeEmployee(id)}
        >
          <Text>Remove Employee</Text>
        </Pressable>
      ) : (
        <Pressable
          style={{
            ...homePageStyles.button,
            backgroundColor: "green",
            marginTop: 15,
          }}
          onPress={() => addEmployee(id)}
        >
          <Text>Add Employee</Text>
        </Pressable>
      )}
    </View>
  );
};

export default EmployeeShiftAssign;
