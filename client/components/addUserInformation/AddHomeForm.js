import React, { useState, useContext, useEffect } from "react";
import { View, Text, Pressable, Dimensions } from "react-native";
import { TextInput, RadioButton } from "react-native-paper";
import { AuthContext } from "../../services/AuthContext";
import FetchData from "../../services/fetchRequests/fetchData";
import UserFormStyles from "../../services/styles/UserInputFormStyle";
import { useNavigate } from "react-router-native";
import homePageStyles from "../../services/styles/HomePageStyles";
import topBarStyles from "../../services/styles/TopBarStyles";
import Icon from "react-native-vector-icons/FontAwesome";

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
	const [key, setKey] = useState("code");
	const [recycle, setRecycle] = useState("no");
	const [compost, setCompost] = useState("no");
	const [error, setError] = useState(null);
	const [formRedirect, setFormRedirect] = useState(false);
	const [redirect, setRedirect] = useState(false);
	const { width } = Dimensions.get("window");
	const iconSize = width < 400 ? 12 : width < 800 ? 16 : 20;
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

	const handleKeyToggle = (text) => {
		setKey(text);
	};

	const handleRecyclingToggle = (text) => {
		setRecycle(text);
	};

	const handleCompostToggle = (text) => {
		setCompost(text);
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
				setFormRedirect(true);
			}
		});
	};

	useEffect(() => {
		if (formRedirect) {
			navigate("/");
			setFormRedirect(false);
		}
		if (redirect) {
			navigate("/list-of-homes");
			setRedirect(false);
		}
	}, [formRedirect, redirect]);

	const handlePress = () => {
		setRedirect(true);
	};

	return (
		<View style={{ marginTop: 85, paddingLeft: "5%", paddingRight: "5%" }}>
			<View style={homePageStyles.backButtonContainerForm}>
				<Pressable style={homePageStyles.backButtonForm} onPress={handlePress}>
					<View
						style={{ flexDirection: "row", alignItems: "center", padding: 10 }}
					>
						<Icon name="angle-left" size={iconSize} color="black" />
						<View style={{ marginLeft: 15 }}>
							<Text style={topBarStyles.buttonTextSchedule}>Back</Text>
						</View>
					</View>
				</Pressable>
			</View>
			<form onSubmit={handleSubmit}>
				<View>
					<Text style={UserFormStyles.title}>Add a home</Text>
					<Text style={UserFormStyles.smallTitle}>Address:</Text>

					<TextInput
						value={`${userHomeInfo.home.address}`}
						onChangeText={handleAddressChange}
						style={UserFormStyles.input}
					/>

					<Text style={UserFormStyles.smallTitle}>City:</Text>
					<TextInput
						mode="outlined"
						value={userHomeInfo.home.city}
						onChangeText={handleCityChange}
						style={UserFormStyles.input}
					/>
					<Text style={UserFormStyles.smallTitle}>Zipcode:</Text>
					<TextInput
						mode="outlined"
						value={userHomeInfo.home.zipcode}
						onChangeText={handleZipCodeChange}
						style={UserFormStyles.input}
					/>

					<Text style={UserFormStyles.smallTitle}>Number of Beds:</Text>
					<View style={UserFormStyles.inputSurround}>
						<TextInput
							value={userHomeInfo.home.numBeds}
							onChangeText={handleNumBedsChange}
							style={UserFormStyles.input}
						/>
						<Text style={{ paddingLeft: 10, color: "#000" }}>beds</Text>
					</View>
					<Text style={UserFormStyles.smallTitle}>Number of Bathrooms:</Text>

					<View style={UserFormStyles.inputSurround}>
						<TextInput
							value={userHomeInfo.home.numBaths}
							onChangeText={handleNumBathsChange}
							style={UserFormStyles.input}
						/>
						<Text style={{ paddingLeft: 10, color: "#000" }}>baths</Text>
					</View>
					<Text style={UserFormStyles.smallTitle}>
						Do you need us to bring sheets?
					</Text>
					<View style={UserFormStyles.radioButtonContainer}>
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
					<View style={UserFormStyles.radioButtonContainer}>
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
					<Text style={UserFormStyles.smallTitle}>
						Does the unit use a code or a key to get in?
					</Text>
					<View style={UserFormStyles.radioButtonContainer}>
						<View>
							<RadioButton.Group onValueChange={handleKeyToggle} value={key}>
								<RadioButton.Item label="Key" value="key" />
							</RadioButton.Group>
						</View>
						<View>
							<RadioButton.Group onValueChange={handleKeyToggle} value={key}>
								<RadioButton.Item label="Code" value="code" />
							</RadioButton.Group>
						</View>
					</View>
					{key === "code" ? (
						<>
							<Text style={UserFormStyles.smallTitle}>
								What is the code the cleaners can use to get into the unit?
							</Text>

							<View style={UserFormStyles.inputSurround}>
								<TextInput
									value={userHomeInfo.home.keyPadCode}
									onChangeText={handleKeyPadCode}
									style={UserFormStyles.input}
								/>
							</View>
						</>
					) : (
						<>
							<Text style={UserFormStyles.smallTitle}>
								Where is the key located that the cleaners can use to get into
								the home?
							</Text>

							<TextInput
								placeholder="Under the fake rock to the right of the back door..."
								value={userHomeInfo.home.keyLocation}
								onChangeText={handleKeyLocation}
								style={UserFormStyles.input}
							/>
						</>
					)}

					<Text style={UserFormStyles.smallTitle}>
						Where does the cleaner get rid of trash?
					</Text>
					<TextInput
						placeholder="In the red bin to the right side of the house when you're facing the home..."
						value={userHomeInfo.home.trashLocation}
						onChangeText={handleTrashLocation}
						style={UserFormStyles.input}
					/>

					<Text style={UserFormStyles.smallTitle}>
						Does the unit have recycling??
					</Text>
					<View style={UserFormStyles.radioButtonContainer}>
						<View>
							<RadioButton.Group
								onValueChange={handleRecyclingToggle}
								value={recycle}
							>
								<RadioButton.Item label="Yes" value="yes" />
							</RadioButton.Group>
						</View>
						<View>
							<RadioButton.Group
								onValueChange={handleRecyclingToggle}
								value={recycle}
							>
								<RadioButton.Item label="No" value="no" />
							</RadioButton.Group>
						</View>
					</View>

					{recycle === "yes" && (
						<>
							<Text style={UserFormStyles.smallTitle}>
								Where does the cleaner get rid of recycling?
							</Text>
							<TextInput
								placeholder="In the blue bin to the right side of the house when you're facing the home..."
								value={userHomeInfo.home.recyclingLocation}
								onChangeText={handleRecyclingLocation}
								style={UserFormStyles.input}
							/>
						</>
					)}

					<Text style={UserFormStyles.smallTitle}>
						Does the unit have composting?
					</Text>
					<View style={UserFormStyles.radioButtonContainer}>
						<View>
							<RadioButton.Group
								onValueChange={handleCompostToggle}
								value={compost}
							>
								<RadioButton.Item label="Yes" value="yes" />
							</RadioButton.Group>
						</View>
						<View>
							<RadioButton.Group
								onValueChange={handleCompostToggle}
								value={compost}
							>
								<RadioButton.Item label="No" value="no" />
							</RadioButton.Group>
						</View>
					</View>
					{compost === "yes" && (
						<>
							<Text style={UserFormStyles.smallTitle}>
								Where does the cleaner get rid of compost?
							</Text>
							<TextInput
								placeholder="In the small green bin to the right side of the house when you're facing the home..."
								value={userHomeInfo.home.compostLocation}
								onChangeText={handleCompostLocation}
								style={UserFormStyles.input}
							/>
						</>
					)}
					<Pressable onPress={handleSubmit}>
						<Text style={UserFormStyles.button}>Submit</Text>
					</Pressable>
				</View>
			</form>
		</View>
	);
};

export default UserHomeInfoForm;
