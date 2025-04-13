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
import formStyles from "../../services/styles/FormStyle";

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
    contact: "",
    specialNotes: "",
    timeToBeCompleted: "",
  });
  const [choiceOfTime, setChoiceOfTime] = useState(null);
  const [key, setKey] = useState("");
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

  const handleContactChange = (text) => {
    // If text is empty or contains only whitespace characters, set contact to an empty string
    if (!text.trim()) {
      setHomeDetails((prevState) => ({
        ...prevState,
        contact: "",
      }));
      setError("");
      return;
    }

    const cleanedText = text.replace(/\D/g, "");

    // Regular expression to match only numbers
    const numbersRegex = /^\d+$/;
    if (!numbersRegex.test(cleanedText)) {
      setError("That's not a valid Phone Number");
      return;
    }

    let formattedText = cleanedText.replace(
      /(\d{3})(\d{3})(\d{4})/,
      "$1-$2-$3"
    );
    const longer = cleanedText.length > 10;
    if (longer) {
      if (cleanedText.length === 11) {
        formattedText = cleanedText.replace(
          /(\d{1})(\d{3})(\d{3})(\d{4})/,
          "+$1-$2-$3-$4"
        );
      } else {
        formattedText = cleanedText.replace(
          /(\d{2})(\d{3})(\d{4})(\d{6})/,
          "+$1-$2-$3-$4"
        );
      }
    }
    setError("");
    setHomeDetails((prevState) => ({
      ...prevState,
      contact: formattedText,
    }));
  };

  const handleSpecialNotesChange = (text) => {
    setHomeDetails((prevState) => ({
      ...prevState,
      specialNotes: text,
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
  const handleTimeToComplete = (unit) => {
    if (unit === "10-3") {
      setChoiceOfTime(
        `For this choice $30 will be added to each appointment. Switch to "Anytime" to remove any extra charge.`
      );
    } else if (unit === "11-4") {
      setChoiceOfTime(
        `For this choice $30 will be added to each appointment. Switch to "Anytime" to remove any extra charge.`
      );
    } else if (unit === "12-2") {
      setChoiceOfTime(
        `For this choice $50 will be added to each appointment. Switch to "Anytime" to remove any extra charge.`
      );
    }else if(unit === "anytime"){
		setChoiceOfTime(null)
	}

    setHomeDetails((prevState) => ({
      ...prevState,
      timeToBeCompleted: unit,
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
    if (text === "code") {
      setHomeDetails((prevState) => ({
        ...prevState,
        keyLocation: "",
      }));
    } else {
      setHomeDetails((prevState) => ({
        ...prevState,
        keyPadCode: "",
      }));
    }
    setKey(text);
  };

  const handleRecyclingToggle = (text) => {
    setRecycle(text);
  };

  const handleCompostToggle = (text) => {
    setCompost(text);
  };

  const handleKeyPadCode = (text) => {
    const regex = /^[\d#]*(\.\d*)?(\s*)?$/;
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
    setKey(foundHome.keyPadCode !== "" ? "code" : "key");

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
            What time do you need the home to be cleaned?
          </Text>
          <View
            style={{
              ...UserFormStyles.radioButtonContainer,
              flexDirection: "column",
            }}
          >
            <View>
              <RadioButton.Group
                onValueChange={handleTimeToComplete}
                value={homeDetails.timeToBeCompleted}
              >
                <RadioButton.Item label="Anytime" value="anytime" />
              </RadioButton.Group>
            </View>
            <View>
              <RadioButton.Group
                onValueChange={handleTimeToComplete}
                value={homeDetails.timeToBeCompleted}
              >
                <RadioButton.Item label="Between 10am and 3pm" value="10-3" />
              </RadioButton.Group>
            </View>
            <View>
              <RadioButton.Group
                onValueChange={handleTimeToComplete}
                value={homeDetails.timeToBeCompleted}
              >
                <RadioButton.Item label="Between 11am and 4pm" value="11-4" />
              </RadioButton.Group>
            </View>
            <View>
              <RadioButton.Group
                onValueChange={handleTimeToComplete}
                value={homeDetails.timeToBeCompleted}
              >
                <RadioButton.Item label="Between 12am and 2pm" value="12-2" />
              </RadioButton.Group>
            </View>
          </View>

          {choiceOfTime ? (
            <View style={formStyles.errorContainer}>
              <Text style={formStyles.errorText}>{choiceOfTime}</Text>
            </View>
          ) : null}

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
                value={homeDetails.keyLocation}
                onChangeText={handleKeyLocation}
                style={UserFormStyles.input}
              />
              <View style={{ textAlign: "center", marginBottom: 20 }}>
                <Text style={{ color: "grey", fontSize: 11 }}>
                  Example: Under the fake rock to the right of the back door.
                </Text>
              </View>
            </>
          )}

          <Text style={UserFormStyles.smallTitle}>
            Where does the cleaner get rid of trash?
          </Text>
          <TextInput
            mode="outlined"
            value={homeDetails.trashLocation}
            onChangeText={handleTrashLocation}
            style={UserFormStyles.input}
          />
          <View style={{ textAlign: "center", marginBottom: 20 }}>
            <Text style={{ color: "grey", fontSize: 11 }}>
              Example: In the red bin to the right side of the house when you're
              facing the home.
            </Text>
          </View>

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
                value={homeDetails.recyclingLocation}
                onChangeText={handleRecyclingLocation}
                style={UserFormStyles.input}
              />
              <View style={{ textAlign: "center", marginBottom: 20 }}>
                <Text style={{ color: "grey", fontSize: 11 }}>
                  Example: In the blue bin to the right side of the house when
                  you're facing the home.
                </Text>
              </View>
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
                value={homeDetails.compostLocation}
                onChangeText={handleCompostLocation}
                style={UserFormStyles.input}
              />
              <View style={{ textAlign: "center", marginBottom: 20 }}>
                <Text style={{ color: "grey", fontSize: 11 }}>
                  Example: In the small green bin to the right side of the house
                  when you're facing the home.
                </Text>
              </View>
            </>
          )}
          <Text style={UserFormStyles.smallTitle}>
            Please add a contact phone number.
          </Text>

          <TextInput
            mode="outlined"
            value={homeDetails.contact}
            onChangeText={handleContactChange}
            style={UserFormStyles.codeInput}
            keyboardType="phone-pad"
          />
          <View style={{ textAlign: "center", marginBottom: 20 }}>
            <Text style={{ color: "grey", fontSize: 11, marginBottom: 5 }}>
              The cleaner will contact this number if they cannot get into the
              home for any reason
            </Text>
            <Text style={{ color: "grey", fontSize: 11 }}>
              If after contacting this number and the cleaner still cannot get
              into the home to clean the person who booked the appointment will
              be charged 50$.
            </Text>
          </View>
          <Text style={UserFormStyles.smallTitle}>
            Add any Special Requirements
          </Text>

          <TextInput
            mode="outlined"
            value={homeDetails.specialNotes}
            onChangeText={handleSpecialNotesChange}
            style={UserFormStyles.codeInput}
          />
          <View style={{ textAlign: "center", marginBottom: 20 }}>
            <Text style={{ color: "grey", fontSize: 11 }}>
              Example: Is there a dog? Is there a specific area the cleaner
              should park?
            </Text>
          </View>
          <Pressable onPress={handleSubmit}>
            <Text style={UserFormStyles.button}>Submit</Text>
          </Pressable>
        </View>
      </form>
    </View>
  );
};

export default EditHomeForm;
