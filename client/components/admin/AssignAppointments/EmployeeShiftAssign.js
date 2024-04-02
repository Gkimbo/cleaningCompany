import React from "react";
import { Pressable, Text, View, Animated } from "react-native";
import homePageStyles from "../../../services/styles/HomePageStyles";
import Icon from "react-native-vector-icons/FontAwesome";

const EmployeeShiftAssign = ({ id, username, email, lastLogin, type }) => {
  return (
    <View style={homePageStyles.homeTileContainer}>
      <Text style={homePageStyles.homeTileTitle}>{username}</Text>
      <Text style={homePageStyles.homeTileAddress}>{`Email: ${email}`}</Text>
      <Text
        style={homePageStyles.homeTileContent}
      >{`Last Login: ${lastLogin}`}</Text>
      <Text style={homePageStyles.homeTileContent}>{type}</Text>
    </View>
  );
};

export default EmployeeShiftAssign;