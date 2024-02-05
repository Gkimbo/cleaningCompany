import React, { useState, useContext, useEffect } from "react";
import { View, Text, Pressable, Dimensions } from "react-native";
import { TextInput, RadioButton } from "react-native-paper";
import { AuthContext } from "../../services/AuthContext";
import { useParams, useNavigate } from "react-router-native";
import Icon from "react-native-vector-icons/FontAwesome";
import FetchData from "../../services/fetchRequests/fetchData";
import UserFormStyles from "../../services/styles/UserInputFormStyle";
import homePageStyles from "../../services/styles/HomePageStyles";
import topBarStyles from "../../services/styles/TopBarStyles";

const EditHomeForm = ({ state, dispatch }) => {
	const { id } = useParams();
	const { user } = useContext(AuthContext);
	const [homeDetails, setHomeDetails] = useState({
		id: "",
		nickName: "",
		address: "",
		city: "",
		zipcode: "",
		numBeds: "",
		numBaths: "",
		sheetsProvided: "",
		towelsProvided: "",
		keyPadCode: "",
		keyLocation: "",
		recyclingLocation: "",
		compostLocation: "",
		trashLocation: "",
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

	const handleNameChange = (text) => {
		setHomeDetails((prevState) => ({
			...prevState,
			nickName: text,
		}));
	};

	const handleAddressChange = (text) => {
		setHomeDetails((prevState) => ({
			...prevState,
			address: text,
		}));
	};

	const handleCityChange = (text) => {
		setHomeDetails((prevState) => ({
			...prevState,
			city: text,
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
		setHomeDetails((prevState) => ({
			...prevState,
			zipcode: text,
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
		setHomeDetails((prevState) => ({
			...prevState,
			numBeds: text,
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
		setHomeDetails((prevState) => ({
			...prevState,
			numBaths: text,
		}));
	};

	const handleSheetsProvided = (unit) => {
		setHomeDetails((prevState) => ({
			...prevState,
			sheetsProvided: unit,
		}));
	};
	const handleTowelsProvided = (unit) => {
		setHomeDetails((prevState) => ({
			...prevState,
			towelsProvided: unit,
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
		setHomeDetails((prevState) => ({
			...prevState,
			keyPadCode: text,
		}));
	};

	const handleKeyLocation = (unit) => {
		setHomeDetails((prevState) => ({
			...prevState,
			keyLocation: unit,
		}));
	};

	const handleRecyclingLocation = (unit) => {
		setHomeDetails((prevState) => ({
			...prevState,
			recyclingLocation: unit,
		}));
	};

	const handleCompostLocation = (unit) => {
		setHomeDetails((prevState) => ({
			...prevState,
			compostLocation: unit,
		}));
	};

	const handleTrashLocation = (unit) => {
		setHomeDetails((prevState) => ({
			...prevState,
			trashLocation: unit,
		}));
	};

	const handleSubmit = (event) => {
		event.preventDefault();
		if (!homeDetails.nickName) {
			setError("Please provide a custom name to identify your home.");
			return;
		}
		if (!homeDetails.trashLocation) {
			setError("Please provide trash location");
			return;
		}
		if (!homeDetails.keyLocation && !homeDetails.keyPadCode) {
			setError(
				"Please provide instructions on how to get into the property with either a key or a code"
			);
			return;
		}
		setError(null);
		FetchData.editHomeInfo(homeDetails, user).then((response) => {
			if (response === "Cannot find zipcode") {
				setError(response);
			} else {
				setError(null);
				dispatch({
					type: "UPDATE_HOME",
					payload: {
						id: homeDetails.id,
						updatedHome: homeDetails,
					},
				});
				setFormRedirect(true);
			}
		});
	};

	useEffect(() => {
		const idNeeded = Number(id);
		const foundHome = state.homes.find((home) => home.id === idNeeded);
		setHomeDetails(foundHome);

		if (formRedirect) {
			navigate("/edit-home");
			setFormRedirect(false);
		}
		if (redirect) {
			navigate("/edit-home");
			setRedirect(false);
		}
	}, [formRedirect, redirect, id]);

	const handlePress = () => {
		setRedirect(true);
	};

	return (
		<View style={UserFormStyles.container}>
			<View style={homePageStyles.backButtonContainerForm}>
				<Pressable style={homePageStyles.backButtonForm} onPress={handlePress}>
					<View style={{ flexDirection: "row", alignItems: "center" }}>
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
					<Text style={UserFormStyles.smallTitle}>Name Your Home:</Text>
					<TextInput
						mode="outlined"
						value={`${homeDetails.nickName}`}
						onChangeText={handleNameChange}
						style={UserFormStyles.input}
					/>
					<Text style={UserFormStyles.smallTitle}>Address:</Text>

					<TextInput
						mode="outlined"
						value={`${homeDetails.address}`}
						onChangeText={handleAddressChange}
						style={UserFormStyles.input}
					/>

					<Text style={UserFormStyles.smallTitle}>City:</Text>
					<TextInput
						mode="outlined"
						value={homeDetails.city}
						onChangeText={handleCityChange}
						style={UserFormStyles.input}
					/>
					<Text style={UserFormStyles.smallTitle}>Zipcode:</Text>
					<TextInput
						mode="outlined"
						value={homeDetails.zipcode}
						onChangeText={handleZipCodeChange}
						style={UserFormStyles.input}
					/>

					<Text style={UserFormStyles.smallTitle}>Number of Beds:</Text>
					<View style={UserFormStyles.inputSurround}>
						<TextInput
							value={homeDetails.numBeds}
							onChangeText={handleNumBedsChange}
							style={UserFormStyles.input}
						/>
						<Text style={{ paddingLeft: 10, color: "#000" }}>beds</Text>
					</View>
					<Text style={UserFormStyles.smallTitle}>Number of Bathrooms:</Text>

					<View style={UserFormStyles.inputSurround}>
						<TextInput
							value={homeDetails.numBaths}
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
								value={homeDetails.sheetsProvided}
							>
								<RadioButton.Item label="Yes" value="yes" />
							</RadioButton.Group>
						</View>
						<View>
							<RadioButton.Group
								onValueChange={handleSheetsProvided}
								value={homeDetails.sheetsProvided}
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
								value={homeDetails.towelsProvided}
							>
								<RadioButton.Item label="Yes" value="yes" />
							</RadioButton.Group>
						</View>
						<View>
							<RadioButton.Group
								onValueChange={handleTowelsProvided}
								value={homeDetails.towelsProvided}
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

							<TextInput
								mode="outlined"
								value={homeDetails.keyPadCode}
								onChangeText={handleKeyPadCode}
								style={UserFormStyles.codeInput}
							/>
						</>
					) : (
						<>
							<Text style={UserFormStyles.smallTitle}>
								Where is the key located that the cleaners can use to get into
								the home?
							</Text>

							<TextInput
								mode="outlined"
								placeholder="Under the fake rock to the right of the back door..."
								value={homeDetails.keyLocation}
								onChangeText={handleKeyLocation}
								style={UserFormStyles.input}
							/>
						</>
					)}

					<Text style={UserFormStyles.smallTitle}>
						Where does the cleaner get rid of trash?
					</Text>
					<TextInput
						mode="outlined"
						placeholder="In the red bin to the right side of the house when you're facing the home..."
						value={homeDetails.trashLocation}
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
								mode="outlined"
								placeholder="In the blue bin to the right side of the house when you're facing the home..."
								value={homeDetails.recyclingLocation}
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
								mode="outlined"
								placeholder="In the small green bin to the right side of the house when you're facing the home..."
								value={homeDetails.compostLocation}
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

export default EditHomeForm;
