import React, { useContext, useEffect, useState } from "react";
import { Dimensions, Pressable, ScrollView, Text, View } from "react-native";
import { RadioButton, TextInput } from "react-native-paper";
import Icon from "react-native-vector-icons/FontAwesome";
import { useNavigate } from "react-router-native";
import { AuthContext } from "../../services/AuthContext";
import FetchData from "../../services/fetchRequests/fetchData";
import homePageStyles from "../../services/styles/HomePageStyles";
import topBarStyles from "../../services/styles/TopBarStyles";
import UserFormStyles from "../../services/styles/UserInputFormStyle";

const UserHomeInfoForm = () => {
  const { user } = useContext(AuthContext);
  const [userHomeInfo, setUserHomeInfoForm] = useState({
    user: user,
    home: {
      nickName: "",
      address: "",
      city: "",
      state: "",
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
      contact: "",
      specialNotes: "",
      timeToBeCompleted: "",
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

  const handleNameChange = (text) => {
    setUserHomeInfoForm((prevState) => ({
      ...prevState,
      home: {
        ...prevState.home,
        nickName: text,
      },
    }));
  };

  const handleContactChange = (text) => {
    // If text is empty, set contact to an empty string
    if (!text.trim()) {
      setUserHomeInfoForm((prevState) => ({
        ...prevState,
        home: {
          ...prevState.home,
          contact: "",
        },
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
    setUserHomeInfoForm((prevState) => ({
      ...prevState,
      home: {
        ...prevState.home,
        contact: formattedText,
      },
    }));
  };

  const handleAddressChange = (text) => {
    setUserHomeInfoForm((prevState) => ({
      ...prevState,
      home: {
        ...prevState.home,
        address: text,
      },
    }));
  };

  const handleSpecialNotesChange = (text) => {
    setUserHomeInfoForm((prevState) => ({
      ...prevState,
      home: {
        ...prevState.home,
        specialNotes: text,
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
  const handleStateChange = (text) => {
    setUserHomeInfoForm((prevState) => ({
      ...prevState,
      home: {
        ...prevState.home,
        state: text,
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

  const handleTimeToComplete = (unit) => {
    setUserHomeInfoForm((prevState) => ({
      ...prevState,
      home: {
        ...prevState.home,
        timeToBeCompleted: unit,
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
    if (text === "code") {
      setUserHomeInfoForm((prevState) => ({
        ...prevState,
        home: {
          ...prevState.home,
          keyLocation: "",
        },
      }));
    } else {
      setUserHomeInfoForm((prevState) => ({
        ...prevState,
        home: {
          ...prevState.home,
          keyPadCode: "",
        },
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
    if (!userHomeInfo.home.nickName) {
      setError("Please provide a custom name to identify your home.");
      return;
    }
    if (!userHomeInfo.home.trashLocation) {
      setError("Please provide trash location");
      return;
    }
    if (!userHomeInfo.home.keyLocation && !userHomeInfo.home.keyPadCode) {
      setError(
        "Please provide instructions on how to get into the property with either a key or a code"
      );
      return;
    }
    if (!userHomeInfo.home.timeToBeCompleted) {
      setError("Please specify when you need the cleaner to clean.");
      return;
    }
    setError(null);
    FetchData.addHomeInfo(userHomeInfo).then((response) => {
      if (response === "Cannot find zipcode") {
        setError(response);
        setUserHomeInfoForm((prevState) => ({
          ...prevState,
          home: {
            ...prevState.home,
            zipcode: "",
          },
        }));
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
    <ScrollView style={UserFormStyles.container}>
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
          <Text style={UserFormStyles.smallTitle}>Name Your Home:</Text>
          <TextInput
            mode="outlined"
            value={`${userHomeInfo.home.nickName}`}
            onChangeText={handleNameChange}
            style={UserFormStyles.input}
          />
          <Text style={UserFormStyles.smallTitle}>Address:</Text>
          <TextInput
            mode="outlined"
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
          <Text style={UserFormStyles.smallTitle}>State:</Text>
          <TextInput
            mode="outlined"
            value={userHomeInfo.home.state}
            onChangeText={handleStateChange}
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
            <Text
              style={{
                paddingLeft: 3,
                color: "#000",
              }}
            >
              beds
            </Text>
          </View>
          <Text style={UserFormStyles.smallTitle}>Number of Bathrooms:</Text>

          <View style={UserFormStyles.inputSurround}>
            <TextInput
              value={userHomeInfo.home.numBaths}
              onChangeText={handleNumBathsChange}
              style={UserFormStyles.input}
            />
            <Text
              style={{
                paddingLeft: 3,
                color: "#000",
              }}
            >
              baths
            </Text>
          </View>
          <Text style={UserFormStyles.smallTitle}>
            What time do you need the home to be cleaned?
          </Text>
          <View style={{...UserFormStyles.radioButtonContainer, flexDirection: "column", }}>
            <View>
              <RadioButton.Group
                onValueChange={handleTimeToComplete}
                value={userHomeInfo.home.timeToBeCompleted}
              >
                <RadioButton.Item label="Anytime" value="anytime" />
              </RadioButton.Group>
            </View>
            <View>
              <RadioButton.Group
                onValueChange={handleTimeToComplete}
                value={userHomeInfo.home.timeToBeCompleted}
              >
                <RadioButton.Item label="Between 10am and 3pm" value="10-3" />
              </RadioButton.Group>
            </View>
            <View>
              <RadioButton.Group
                onValueChange={handleTimeToComplete}
                value={userHomeInfo.home.timeToBeCompleted}
              >
                <RadioButton.Item label="Between 11am and 4pm" value="11-4" />
              </RadioButton.Group>
            </View>
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
          <View style={{ textAlign: "center", marginBottom: 20 }}>
            <Text style={{ color: "grey", fontSize: 11 }}>
              You can change this value after your appointment has been booked
            </Text>
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
          <View style={{ textAlign: "center", marginBottom: 20 }}>
            <Text style={{ color: "grey", fontSize: 11 }}>
              You can change this value after your appointment has been booked
            </Text>
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
                value={userHomeInfo.home.keyPadCode}
                onChangeText={handleKeyPadCode}
                style={UserFormStyles.codeInput}
              />
              <View style={{ textAlign: "center", marginBottom: 20 }}>
                <Text style={{ color: "grey", fontSize: 11 }}>
                  You can change this code for each appointment after the
                  appointment has been booked.
                </Text>
              </View>
            </>
          ) : (
            <>
              <Text style={UserFormStyles.smallTitle}>
                Where is the key located that the cleaners can use to get into
                the home?
              </Text>

              <TextInput
                mode="outlined"
                value={userHomeInfo.home.keyLocation}
                onChangeText={handleKeyLocation}
                style={UserFormStyles.input}
              />
              <View style={{ textAlign: "center", marginBottom: 20 }}>
                <Text style={{ color: "grey", fontSize: 11 }}>
                  Example: Under the fake rock to the right of the back door or
                  to the right of the door in a lock box with code 5555#
                </Text>
              </View>
            </>
          )}

          <Text style={UserFormStyles.smallTitle}>
            Where does the cleaner get rid of trash?
          </Text>
          <TextInput
            mode="outlined"
            value={userHomeInfo.home.trashLocation}
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
                value={userHomeInfo.home.recyclingLocation}
                onChangeText={handleRecyclingLocation}
                style={UserFormStyles.input}
              />
              <View style={{ textAlign: "center", marginBottom: 20 }}>
                <Text style={{ color: "grey", fontSize: 11 }}>
                  Example: In the red bin to the right side of the house when
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
                value={userHomeInfo.home.compostLocation}
                onChangeText={handleCompostLocation}
                style={UserFormStyles.input}
              />
              <View style={{ textAlign: "center", marginBottom: 20 }}>
                <Text style={{ color: "grey", fontSize: 11 }}>
                  Example: In the small green bin to the right side of the house
                  when you're facing the home
                </Text>
              </View>
            </>
          )}
          <Text style={UserFormStyles.smallTitle}>
            Please add a contact phone number.
          </Text>

          <TextInput
            mode="outlined"
            value={userHomeInfo.home.contact}
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
            value={userHomeInfo.home.specialNotes}
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
      {error && <Text style={UserFormStyles.error}>{error}</Text>}
    </ScrollView>
  );
};

export default UserHomeInfoForm;
