import React, { useState, useEffect } from "react";
import { Text, View, Pressable } from "react-native";
import homePageStyles from "../../services/styles/HomePageStyles";
import UserFormStyles from "../../services/styles/UserInputFormStyle";
import { TextInput, RadioButton } from "react-native-paper";
import Appointment from "../../services/fetchRequests/AppointmentClass";

const EachAppointment = ({
	id,
	index,
	date,
	price,
	bringSheets,
	bringTowels,
	keyPadCode,
	keyLocation,
	isDisabled,
	formatDate,
	handleTowelToggle,
	handleSheetsToggle,
	setChangesSubmitted,
}) => {
	const [code, setCode] = useState("");
	const [key, setKeyLocation] = useState("");
	const [keyCodeToggle, setKeyCodeToggle] = useState("");
	const [changeNotification, setChangeNotification] = useState(null);
	const [error, setError] = useState(null);

	const handleKeyPadCode = (newCode) => {
		const regex = /^[\d#]*(\.\d*)?(\s*)?$/;
		if (!regex.test(newCode)) {
			setError("Key Pad Code can only be a number!");
			return;
		}
		if (newCode === "") {
			setError("Key Pad Code cannot be blank!");
		} else {
			setError(null);
		}
		setCode(newCode);
	};

	const handleKeyLocation = (newLocation) => {
		setKeyLocation(newLocation);
	};

	const handleSubmit = async () => {
		if (!code && !key) {
			setError(
				"Please provide instructions on how to get into the property with either a key or a code"
			);
			return;
		}
		setError(null);
		if (code !== keyPadCode || key !== keyLocation) {
			if (code) {
				await Appointment.updateCodeAppointments(code, id);
				setChangesSubmitted(true);
				setChangeNotification("Changes made!");
			} else {
				await Appointment.updateKeyAppointments(key, id);
				setChangesSubmitted(true);
				setChangeNotification("Changes made!");
			}
		} else {
			// No changes made, display an error or message
			setError("No changes made.");
		}
	};
	const handleKeyToggle = (text) => {
		if (text === "code") {
			setKeyCodeToggle("code");
			setKeyLocation("");
		} else {
			setKeyCodeToggle("key");
			setCode("");
		}
	};

	useEffect(() => {
		if (keyPadCode !== "") {
			setCode(keyPadCode);
			setKeyCodeToggle("code");
		}
		if (keyLocation !== "") {
			setKeyLocation(keyLocation);
			setKeyCodeToggle("key");
		}
	}, []);

	return (
		<View
			style={[
				homePageStyles.eachAppointment,
				index % 2 === 1 && homePageStyles.appointmentOdd,
			]}
		>
			<Text style={homePageStyles.appointmentDate}>{formatDate(date)}</Text>
			<Text style={homePageStyles.appointmentPrice}>$ {price}</Text>
			<Text style={UserFormStyles.smallTitle}>Cleaner is bringing sheets:</Text>
			{isDisabled ? (
				<View
					style={{
						...UserFormStyles.radioButtonContainer,
						width: "15%",
						padding: 5,
					}}
				>
					<Text>{bringSheets}</Text>
				</View>
			) : (
				<View style={UserFormStyles.radioButtonContainer}>
					<View>
						<RadioButton.Group
							onValueChange={() => handleSheetsToggle("yes", id)}
							value={bringSheets}
						>
							<RadioButton.Item label="Yes" value="yes" />
						</RadioButton.Group>
					</View>
					<View>
						<RadioButton.Group
							onValueChange={() => handleSheetsToggle("no", id)}
							value={bringSheets}
						>
							<RadioButton.Item label="No" value="no" />
						</RadioButton.Group>
					</View>
				</View>
			)}
			<Text style={UserFormStyles.smallTitle}>Cleaner is bringing towels:</Text>
			{isDisabled ? (
				<>
					<View
						style={{
							...UserFormStyles.radioButtonContainer,
							width: "15%",
							padding: 5,
						}}
					>
						<Text>{bringTowels}</Text>
					</View>
					<Text style={{ ...homePageStyles.information }}>
						These values cannot be changed within a week of your
					</Text>
					<Text style={{ ...homePageStyles.information }}>
						Please contact us if you'd like to cancel or book sheets or towels
					</Text>
				</>
			) : (
				<View style={UserFormStyles.radioButtonContainer}>
					<View>
						<RadioButton.Group
							onValueChange={() => handleTowelToggle("yes", id)}
							value={bringTowels}
						>
							<RadioButton.Item label="Yes" value="yes" />
						</RadioButton.Group>
					</View>
					<View>
						<RadioButton.Group
							onValueChange={() => handleTowelToggle("no", id)}
							value={bringTowels}
						>
							<RadioButton.Item label="No" value="no" />
						</RadioButton.Group>
					</View>
				</View>
			)}
			<Text style={UserFormStyles.smallTitle}>Cleaner will get in with:</Text>
			<View style={UserFormStyles.radioButtonContainer}>
				<View>
					<RadioButton.Group
						onValueChange={handleKeyToggle}
						value={keyCodeToggle}
					>
						<RadioButton.Item
							label="Key"
							value="key"
							labelStyle={{ fontSize: 10 }}
						/>
					</RadioButton.Group>
				</View>
				<View>
					<RadioButton.Group
						onValueChange={handleKeyToggle}
						value={keyCodeToggle}
					>
						<RadioButton.Item
							label="Code"
							value="code"
							labelStyle={{ fontSize: 10 }}
						/>
					</RadioButton.Group>
				</View>
			</View>
			{keyCodeToggle === "code" ? (
				<>
					<Text style={UserFormStyles.smallTitle}>The code to get in is</Text>

					<TextInput
						mode="outlined"
						value={code ? code : ""}
						onChangeText={handleKeyPadCode}
						style={UserFormStyles.codeInput}
					/>
					{changeNotification && (
						<Text style={UserFormStyles.changeNotification}>
							{changeNotification}
						</Text>
					)}
				</>
			) : (
				<>
					<Text style={UserFormStyles.smallTitle}>
						The location of the key is
					</Text>
					<TextInput
						mode="outlined"
						value={key ? key : ""}
						onChangeText={handleKeyLocation}
						style={UserFormStyles.input}
					/>
					{changeNotification && (
						<Text style={UserFormStyles.changeNotification}>
							{changeNotification}
						</Text>
					)}
					<View style={{ textAlign: "center", marginBottom: 20 }}>
						<Text style={{ color: "grey", fontSize: 10 }}>
							Example: Under the fake rock to the right of the back door or to
							the right of the door in a lock box with code 5555#
						</Text>
					</View>
				</>
			)}

			{code !== keyPadCode || key !== keyLocation ? (
				<Pressable onPress={handleSubmit}>
					<Text style={{ ...UserFormStyles.button, width: "100%" }}>
						Submit change
					</Text>
				</Pressable>
			) : null}

			{error && <Text style={UserFormStyles.error}>{error}</Text>}
		</View>
	);
};

export default EachAppointment;
