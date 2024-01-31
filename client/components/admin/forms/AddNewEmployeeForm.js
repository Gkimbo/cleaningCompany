import React, { useState, useEffect, useContext } from "react";
import { ScrollView, Text, Pressable, View } from "react-native";
import { useNavigate } from "react-router-native";
import { TextInput } from "react-native-paper";

import FetchData from "../../../services/fetchRequests/fetchData";
import formStyles from "../../../services/styles/FormStyle";
import { AuthContext } from "../../../services/AuthContext";

const AddEmployeeForm = ({ employeeList, setEmployeeList }) => {
	const [userName, setUserName] = useState("");
	const [password, setPassword] = useState("");
	const [email, setEmail] = useState("");
	const [redirect, setRedirect] = useState(false);
	const [showPassword, setShowPassword] = useState(false);
	const [errors, setErrors] = useState([]);
	const navigate = useNavigate();
	const { login } = useContext(AuthContext);
	const type = "cleaner";

	const validate = () => {
		const validationErrors = [];

		if (userName.length < 4 || userName.length > 12) {
			validationErrors.push("Username must be between 4 and 12 characters.");
		}

		const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
		if (!emailRegex.test(email)) {
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
				userName,
				password,
				email,
				type,
			};
			const response = await FetchData.makeNewEmployee(data);
			if (
				response === "An account already has this email" ||
				response === "Username already exists"
			) {
				setErrors([response]);
			} else {
				setEmployeeList([...employeeList, response.user]);
				setRedirect(true);
			}
		}
	};

	useEffect(() => {
		if (redirect) {
			navigate("/employees");
		}
	}, [redirect]);

	return (
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
				value={userName}
				onChangeText={setUserName}
			/>
			<TextInput
				mode="outlined"
				secureTextEntry={!showPassword}
				value={password}
				onChangeText={setPassword}
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
				value={email}
				onChangeText={setEmail}
				keyboardType="email-address"
			/>

			<Pressable onPress={onSubmit}>
				<Text style={formStyles.button}>Add new employee</Text>
			</Pressable>
		</View>
	);
};

export default AddEmployeeForm;
