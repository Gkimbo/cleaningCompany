import React, { useState, useContext, useEffect } from "react";
import { View, Text, ScrollView, Pressable } from "react-native";
import { TextInput, RadioButton } from "react-native-paper";
import RNPickerSelect from "react-native-picker-select";
import { AuthContext } from "../../services/AuthContext";
import FetchData from "../../services/fetchRequests/fetchData";
import UserFormStyles from "../../services/styles/UserInputFormStyle";
import pickerSelectStyles from "../../services/styles/PickerSelectStyles";
import { useNavigate } from "react-router-native";

const UserHomeInfoForm = () => {
	const { user } = useContext(AuthContext);
	const [userHomeInfo, setUserHomeInfoForm] = useState({
		user: user,
		home: {
			address: "",
			city: "",
			zipcode: "",
			numBeds: "",
			numBaths: "",
			sheetsProvided: "no",
			towelsProvided: "no",
			keyPadCode: "",
			keyLocation: "",
			recyclingLocation: "",
			compostLocation: "",
			trashLocation: "",
		},
	});
	const [error, setError] = useState(null);
	const [redirect, setRedirect] = useState(false);
	const navigate = useNavigate();

	const handleAddressChange = (text) => {
		setUserHomeInfoForm((prevState) => ({
			...prevState,
			home: {
				...prevState.home,
				address: text,
			},
		}));
	};

	const handleCityChange = (text) => {
		setUserHomeInfoForm((prevState) => ({
			...prevState,
			home: {
				...prevState.home,
				city: text,
			},
		}));
	};

	const handleZipCodeChange = (text) => {
		const regex = /^\d*(\.\d*)?(\s*)?$/;
		if (!regex.test(text)) {
			setError("Zipcode can only be a number!");
			return;
		}
		if (text === "") {
			setError("Zipcode cannot be blank!");
		} else if (text.length !== 5) {
			setError("A zipcode needs 5 numbers");
		} else {
			setError(null);
		}
		setUserHomeInfoForm((prevState) => ({
			...prevState,
			home: {
				...prevState.home,
				zipcode: text,
			},
		}));
	};

	const handleNumBedsChange = (text) => {
		const regex = /^\d*(\.\d*)?(\s*)?$/;
		if (!regex.test(text)) {
			setError("Number of Bedrooms can only be a number!");
			return;
		}
		if (text === "") {
			setError("Number of Bedrooms cannot be blank!");
		} else {
			setError(null);
		}
		setUserHomeInfoForm((prevState) => ({
			...prevState,
			home: {
				...prevState.home,
				numBeds: text,
			},
		}));
	};

	const handleNumBathsChange = (text) => {
		const regex = /^\d*(\.\d*)?(\s*)?$/;
		if (!regex.test(text)) {
			setError("Number of Bathrooms can only be a number!");
			return;
		}
		if (text === "") {
			setError("Number of Bathrooms cannot be blank!");
		} else {
			setError(null);
		}
		setUserHomeInfoForm((prevState) => ({
			...prevState,
			home: {
				...prevState.home,
				numBaths: text,
			},
		}));
	};

	const handleSheetsProvided = (unit) => {
		setUserHomeInfoForm((prevState) => ({
			...prevState,
			home: {
				...prevState.home,
				sheetsProvided: unit,
			},
		}));
	};
	const handleTowelsProvided = (unit) => {
		setUserHomeInfoForm((prevState) => ({
			...prevState,
			home: {
				...prevState.home,
				towelsProvided: unit,
			},
		}));
	};

	const handleKeyPadCode = (text) => {
		const regex = /^\d*(\.\d*)?(\s*)?$/;
		if (!regex.test(text)) {
			setError("Key Pad Code can only be a number!");
			return;
		}
		if (text === "") {
			setError("Key Pad Code cannot be blank!");
		} else {
			setError(null);
		}
		setUserHomeInfoForm((prevState) => ({
			...prevState,
			home: {
				...prevState.home,
				keyPadCode: text,
			},
		}));
	};

	const handleKeyLocation = (unit) => {
		setUserHomeInfoForm((prevState) => ({
			...prevState,
			home: {
				...prevState.home,
				keyLocation: unit,
			},
		}));
	};

	const handleRecyclingLocation = (unit) => {
		setUserHomeInfoForm((prevState) => ({
			...prevState,
			home: {
				...prevState.home,
				recyclingLocation: unit,
			},
		}));
	};

	const handleCompostLocation = (unit) => {
		setUserHomeInfoForm((prevState) => ({
			...prevState,
			home: {
				...prevState.home,
				compostLocation: unit,
			},
		}));
	};

	const handleTrashLocation = (unit) => {
		setUserHomeInfoForm((prevState) => ({
			...prevState,
			home: {
				...prevState.home,
				trashLocation: unit,
			},
		}));
	};

	const handleSubmit = (event) => {
		event.preventDefault();
		setError(null);
		FetchData.addHomeInfo(userHomeInfo).then((response) => {
			if (response === "Cannot find zipcode") {
				setError(response);
			} else {
				setError(null);
				setRedirect(true);
			}
		});
	};

	useEffect(() => {
		if (redirect) {
			navigate("/");
			setRedirect(false);
		}
	}, [redirect]);

	return (
		<ScrollView
			contentContainerStyle={{
				marginTop: 85,
				marginLeft: 15,
				marginRight: 15,
			}}
		>
			<form onSubmit={handleSubmit}>
				<View>
					<Text style={UserFormStyles.title}>Add a home</Text>
					<Text style={UserFormStyles.smallTitle}>Address:</Text>
					<View
						style={{
							flexDirection: "row",
							alignItems: "center",
							borderWidth: 1,
							borderColor: "#000",
							borderRadius: 5,
							backgroundColor: "#fff",
							padding: 5,
							marginBottom: 20,
						}}
					>
						<TextInput
							value={`${userHomeInfo.home.address}`}
							onChangeText={handleAddressChange}
							placeholder="1500 nantucket road..."
							style={{
								...UserFormStyles.input,
								borderWidth: 0,
								backgroundColor: "transparent",
							}}
						/>
					</View>

					<Text style={UserFormStyles.smallTitle}>City:</Text>
					<TextInput
						mode="outlined"
						placeholder="Sandwich..."
						value={userHomeInfo.home.city}
						onChangeText={handleCityChange}
						style={{
							...UserFormStyles.input,
							backgroundColor: "#fff",
						}}
					/>
					<Text style={UserFormStyles.smallTitle}>Zipcode:</Text>
					<TextInput
						mode="outlined"
						placeholder="02531..."
						value={userHomeInfo.home.zipcode}
						onChangeText={handleZipCodeChange}
						style={{
							...UserFormStyles.input,
							backgroundColor: "#fff",
						}}
					/>

					<Text style={UserFormStyles.smallTitle}>Number of Bedrooms:</Text>
					<View
						style={{
							flexDirection: "row",
							alignItems: "center",
							borderWidth: 1,
							borderColor: "#000",
							borderRadius: 5,
							backgroundColor: "#fff",
							padding: 5,
							marginBottom: 20,
						}}
					>
						<TextInput
							placeholder="1..."
							value={userHomeInfo.home.numBeds}
							onChangeText={handleNumBedsChange}
							style={{
								...UserFormStyles.input,
								borderWidth: 0,
								backgroundColor: "transparent",
							}}
						/>
						<Text style={{ paddingLeft: 10, color: "#000" }}>beds</Text>
					</View>
					<Text style={UserFormStyles.smallTitle}>Number of Bathrooms:</Text>

					<View
						style={{
							flexDirection: "row",
							alignItems: "center",
							borderWidth: 1,
							borderColor: "#000",
							borderRadius: 5,
							backgroundColor: "#fff",
							padding: 5,
							marginBottom: 20,
						}}
					>
						<TextInput
							placeholder="1..."
							value={userHomeInfo.home.numBaths}
							onChangeText={handleNumBathsChange}
							style={{
								...UserFormStyles.input,
								borderWidth: 0,
								backgroundColor: "transparent",
							}}
						/>
						<Text style={{ paddingLeft: 10, color: "#000" }}>baths</Text>
					</View>
					<Text style={UserFormStyles.smallTitle}>
						Do you need us to bring sheets?
					</Text>
					<View
						style={{
							...UserFormStyles.radioButtonContainer,
							backgroundColor: "#fff",
						}}
					>
						<View>
							<RadioButton.Group
								onValueChange={handleSheetsProvided}
								value={userHomeInfo.home.sheetsProvided}
							>
								<RadioButton.Item label="Yes" value="yes" />
							</RadioButton.Group>
						</View>
						<View>
							<RadioButton.Group
								onValueChange={handleSheetsProvided}
								value={userHomeInfo.home.sheetsProvided}
							>
								<RadioButton.Item label="No" value="no" />
							</RadioButton.Group>
						</View>
					</View>
					<Text style={UserFormStyles.smallTitle}>
						Do you need us to bring towels?
					</Text>
					<View
						style={{
							...UserFormStyles.radioButtonContainer,
							backgroundColor: "#fff",
						}}
					>
						<View>
							<RadioButton.Group
								onValueChange={handleTowelsProvided}
								value={userHomeInfo.home.towelsProvided}
							>
								<RadioButton.Item label="Yes" value="yes" />
							</RadioButton.Group>
						</View>
						<View>
							<RadioButton.Group
								onValueChange={handleTowelsProvided}
								value={userHomeInfo.home.towelsProvided}
							>
								<RadioButton.Item label="No" value="no" />
							</RadioButton.Group>
						</View>
					</View>
				</View>
			</form>
		</ScrollView>
	);
};

export default UserHomeInfoForm;
