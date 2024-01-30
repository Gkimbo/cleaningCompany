import React, { useState, useEffect, useContext } from "react";
import { ScrollView, Text, Pressable, View } from "react-native";
import { TextInput } from "react-native-paper";
import FetchData from "../../../services/fetchRequests/fetchData";
import formStyles from "../../../services/styles/FormStyle";
import UserFormStyles from "../../../services/styles/UserInputFormStyle";
import { AuthContext } from "../../../services/AuthContext";
import { useParams, useNavigate } from "react-router-native";

const EditEmployeeForm = ({ setEmployeeList, employeeList }) => {
	const { id } = useParams();
	const [employee, setEmployee] = useState({
		id: id,
		username: "",
		email: "",
		password: "",
	});
	const [redirect, setRedirect] = useState(false);
	const [showPassword, setShowPassword] = useState(false);
	const [errors, setErrors] = useState([]);
	const navigate = useNavigate();
	const type = "cleaner";

	const validate = () => {
		const validationErrors = [];
		if (employee.username.length < 4) {
			validationErrors.push("Username must be greater than 4 characters");
		}

		const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
		if (!emailRegex.test(employee.email)) {
			validationErrors.push("Please enter a valid email address.");
		}

		setErrors(validationErrors);
		return validationErrors.length === 0;
	};

	const onSubmit = async () => {
		if (!validate()) {
			return;
		} else {
			const data = {
				id,
				userName: employee.username,
				password: employee.password,
				email: employee.email,
				type,
			};
			const response = await FetchData.editEmployee(data);
			if (
				response === "An account already has this email" ||
				response === "Username already exists"
			) {
				setErrors([response]);
			} else {
				const updatedEmployeeList = employeeList.filter(
					(existingEmployee) => existingEmployee.id !== Number(id)
				);
				updatedEmployeeList.push(response.user);
				setEmployeeList(updatedEmployeeList);
				setRedirect(true);
			}
		}
	};

	useEffect(() => {
		const idNeeded = Number(id);
		const foundEmployee = employeeList.find(
			(employee) => employee.id === idNeeded
		);
		setEmployee(foundEmployee);
		if (redirect) {
			navigate("/employees");
		}
	}, [redirect]);

	return (
		<View style={UserFormStyles.container}>
			<View style={formStyles.container}>
				{errors.length > 0 && (
					<View style={formStyles.errorContainer}>
						{errors.map((error, index) => (
							<Text key={index} style={formStyles.errorText}>
								{error}
							</Text>
						))}
					</View>
				)}

				<TextInput
					mode="outlined"
					placeholder="User Name"
					style={formStyles.input}
					value={employee.username}
					onChangeText={(text) => setEmployee({ ...employee, username: text })}
				/>
				<TextInput
					mode="outlined"
					secureTextEntry={!showPassword}
					value={employee.password}
					onChangeText={(text) => setEmployee({ ...employee, password: text })}
					placeholder="Password"
					right={
						<TextInput.Icon
							icon={showPassword ? "eye-off" : "eye"}
							onPress={() => setShowPassword(!showPassword)}
						/>
					}
					style={formStyles.input}
				/>
				<TextInput
					mode="outlined"
					placeholder="Email"
					style={formStyles.input}
					value={employee.email}
					onChangeText={(text) => setEmployee({ ...employee, email: text })}
					keyboardType="email-address"
				/>

				<Pressable onPress={onSubmit}>
					<Text style={formStyles.button}>Edit employee information</Text>
				</Pressable>
			</View>
		</View>
	);
};

export default EditEmployeeForm;
