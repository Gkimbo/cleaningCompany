import React, { useState, useEffect } from "react";
import { Text, View, Pressable } from "react-native";
import homePageStyles from "../../services/styles/HomePageStyles";
import UserFormStyles from "../../services/styles/UserInputFormStyle";
import { TextInput, RadioButton } from "react-native-paper";

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
}) => {
	const [code, setCode] = useState(null);
	const [key, setKeyLocation] = useState(null);
	const [error, setError] = useState(null);

	console.log(code, key);
	const handleKeyPadCode = () => {};
	const handleKeyLocation = () => {};
	const handleSubmit = () => {};
	// const handleOnPress = () => {
	// 	navigate(`/details/${id}`);
	// };

	useEffect(() => {
		if (keyPadCode !== "") {
			setCode(keyPadCode);
		}
		if (keyLocation !== "") {
			setKeyLocation(keyLocation);
		}
	}, []);

	return (
		<View
			key={id ? id : date}
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
			{code ? (
				<>
					<Text style={UserFormStyles.smallTitle}>The code to get in is</Text>

					<TextInput
						mode="outlined"
						value={code ? code : ""}
						onChangeText={handleKeyPadCode}
						style={UserFormStyles.codeInput}
					/>
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
					<View style={{ textAlign: "center", marginBottom: 20 }}>
						<Text style={{ color: "grey", fontSize: 10 }}>
							Example: Under the fake rock to the right of the back door or to
							the right of the door in a lock box with code 5555#
						</Text>
					</View>
				</>
			)}
			{(code !== keyPadCode && keyPadCode !== "") ||
			(key !== keyLocation && keyLocation !== "") ? (
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
