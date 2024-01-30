import React from "react";
import { View, Text } from "react-native";
import UserFormStyles from "../../services/styles/UserInputFormStyle";
import AddEmployeeForm from "./forms/AddNewEmployeeForm";

const AddEmployee = ({ state, dispatch }) => {
	return (
		<View style={UserFormStyles.container}>
			<AddEmployeeForm />
		</View>
	);
};

export default AddEmployee;
