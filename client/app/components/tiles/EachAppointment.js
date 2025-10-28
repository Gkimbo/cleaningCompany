import React, { useEffect, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { RadioButton, TextInput } from "react-native-paper";
import { useNavigate } from "react-router-native";
import Appointment from "../../services/fetchRequests/AppointmentClass";
import homePageStyles from "../../services/styles/HomePageStyles";
import UserFormStyles from "../../services/styles/UserInputFormStyle";

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
  changeNotification,
  setChangeNotification,
  contact,
  paid,
  completed,
  timeToBeCompleted,
}) => {
  const [code, setCode] = useState("");
  const [key, setKeyLocation] = useState("");
  const [keyCodeToggle, setKeyCodeToggle] = useState("");
  const [error, setError] = useState(null);
  const [redirect, setRedirect] = useState(false);
  const navigate = useNavigate();

  // Handle code and key inputs
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
    setChangeNotification({ message: "", appointment: "" });
  };

  const handleKeyLocation = (newLocation) => {
    setKeyLocation(newLocation);
    setChangeNotification({ message: "", appointment: "" });
  };

  // Submit updates
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
      } else {
        await Appointment.updateKeyAppointments(key, id);
      }
      setChangesSubmitted(true);
      setChangeNotification({
        message: `Changes made only to the ${formatDate(date)} appointment!`,
        appointment: id,
      });
    } else {
      setError("No changes made.");
    }
  };

  // Toggle between code/key
  const handleKeyToggle = (text) => {
    if (text === "code") {
      setKeyCodeToggle("code");
      setKeyLocation("");
    } else {
      setKeyCodeToggle("key");
      setCode("");
    }
    setChangeNotification({ message: "", appointment: "" });
  };

  // Preload values
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

  // Redirect handler
  useEffect(() => {
    if (redirect) {
      navigate("/bill");
      setRedirect(false);
    }
  }, [redirect]);

  const handleRedirectToBill = () => {
    setRedirect(true);
  };

  // --- Render ---
  return (
    <Pressable
      onPress={completed && !paid ? handleRedirectToBill : null}
      style={({ pressed }) => [
        homePageStyles.appointmentCard,
        pressed && homePageStyles.appointmentCardPressed,
      ]}
    >
      <View style={homePageStyles.appointmentHeader}>
        <Text style={homePageStyles.appointmentDate}>{formatDate(date)}</Text>
        <Text style={homePageStyles.appointmentPrice}>${price}</Text>
      </View>

      {completed && !paid ? (
        <Text style={homePageStyles.appointmentStatus}>
          Cleaning complete — tap to pay
        </Text>
      ) : completed && paid ? (
        <Text style={homePageStyles.appointmentStatusComplete}>Complete!</Text>
      ) : (
        <>
          <Text style={homePageStyles.appointmentContact}>
            Point of contact: {contact}
          </Text>

          <View style={{ marginBottom: 10 }}>
            <Text style={{ color: "grey", fontSize: 11, textAlign: "center" }}>
              This can be changed by editing your home.
            </Text>
          </View>

          {/* Cleaning time */}
          <Text style={UserFormStyles.smallTitle}>Time of cleaning:</Text>
          <Text
            style={{
              ...UserFormStyles.radioButtonContainer,
              justifyContent: "center",
              alignItems: "center",
              textAlign: "center",
              paddingVertical: 10,
            }}
          >
            {timeToBeCompleted === "anytime"
              ? `Anytime on ${formatDate(date)}`
              : timeToBeCompleted === "10-3"
              ? `10am to 3pm on ${formatDate(date)}`
              : timeToBeCompleted === "11-4"
              ? `11am to 4pm on ${formatDate(date)}`
              : timeToBeCompleted === "12-2"
              ? `12pm to 2pm on ${formatDate(date)}`
              : null}
          </Text>

          {/* Sheets toggle */}
          <Text style={UserFormStyles.smallTitle}>
            Cleaner is bringing sheets:
          </Text>
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
                  <RadioButton.Item
                    label="Yes"
                    value="yes"
                    labelStyle={{ fontSize: 10 }}
                  />
                </RadioButton.Group>
              </View>
              <View>
                <RadioButton.Group
                  onValueChange={() => handleSheetsToggle("no", id)}
                  value={bringSheets}
                >
                  <RadioButton.Item
                    label="No"
                    value="no"
                    labelStyle={{ fontSize: 10 }}
                  />
                </RadioButton.Group>
              </View>
            </View>
          )}

          {/* Towels toggle */}
          <Text style={UserFormStyles.smallTitle}>
            Cleaner is bringing towels:
          </Text>
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
              <Text style={homePageStyles.information}>
                These values cannot be changed within a week of your appointment
              </Text>
              <Text style={homePageStyles.information}>
                Please contact us if you'd like to cancel or book sheets or
                towels
              </Text>
            </>
          ) : (
            <View style={UserFormStyles.radioButtonContainer}>
              <View>
                <RadioButton.Group
                  onValueChange={() => handleTowelToggle("yes", id)}
                  value={bringTowels}
                >
                  <RadioButton.Item
                    label="Yes"
                    value="yes"
                    labelStyle={{ fontSize: 10 }}
                  />
                </RadioButton.Group>
              </View>
              <View>
                <RadioButton.Group
                  onValueChange={() => handleTowelToggle("no", id)}
                  value={bringTowels}
                >
                  <RadioButton.Item
                    label="No"
                    value="no"
                    labelStyle={{ fontSize: 10 }}
                  />
                </RadioButton.Group>
              </View>
            </View>
          )}

          {/* Key or code toggle */}
          <Text style={UserFormStyles.smallTitle}>
            Cleaner will get in with:
          </Text>
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

          {/* Code or key input */}
          {keyCodeToggle === "code" ? (
            <>
              <Text style={UserFormStyles.smallTitle}>
                The code to get in is
              </Text>
              <TextInput
                mode="outlined"
                value={code || ""}
                onChangeText={handleKeyPadCode}
                style={UserFormStyles.codeInput}
              />
              {changeNotification.appointment === id && (
                <Text style={UserFormStyles.changeNotification}>
                  {changeNotification.message}
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
                value={key || ""}
                onChangeText={handleKeyLocation}
                style={UserFormStyles.input}
              />
              <View style={{ textAlign: "center", marginBottom: 20 }}>
                <Text style={{ color: "grey", fontSize: 10 }}>
                  Example: Under the fake rock to the right of the back door or
                  to the right of the door in a lock box with code 5555#
                </Text>
              </View>
              {changeNotification.appointment === id && (
                <Text style={UserFormStyles.changeNotification}>
                  {changeNotification.message}
                </Text>
              )}
            </>
          )}

          {/* Submit button */}
          {code !== keyPadCode || key !== keyLocation ? (
            <Pressable onPress={handleSubmit}>
              <Text style={{ ...UserFormStyles.button, width: "100%" }}>
                Submit change
              </Text>
            </Pressable>
          ) : null}

          {error && <Text style={UserFormStyles.error}>{error}</Text>}
        </>
      )}
    </Pressable>
  );
};

export default EachAppointment;
