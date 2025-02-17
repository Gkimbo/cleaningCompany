import React, { useState, useEffect, useContext } from "react";
import { ScrollView, Text, Pressable, View } from "react-native";
import { useNavigate } from "react-router-native";
import { TextInput } from "react-native-paper";

import FetchData from "../../../services/fetchRequests/fetchData";
import formStyles from "../../../services/styles/FormStyle";
import { AuthContext } from "../../../services/AuthContext";
import Application from "../../../services/fetchRequests/ApplicationClass";

const CreateNewEmployeeForm = ({id, firstName, lastName, email, setApplicationsList}) => {
	const [userName, setUserName] = useState(`${firstName}${lastName}`);
	const [password, setPassword] = useState(`${lastName}$${firstName}124`);
	const [emailInput, setEmail] = useState(email);
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
                const response = await Application.deleteApplication(id)
				setEmail("");
				setPassword("");
				setUserName("");
                FetchData.getApplicationsFromBackend().then((response) => {
                    setApplicationsList(response.serializedApplications);
                })
			}
        }
    }
    


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
				value={emailInput}
				onChangeText={setEmail}
				keyboardType="email-address"
			/>

			<Pressable onPress={onSubmit}>
				<Text style={formStyles.button}>Add new employee</Text>
			</Pressable>
		</View>
	);
};

export default CreateNewEmployeeForm;